"""
Cosilium-LLM: Analysis Cache
Кэширование результатов анализа
"""

import hashlib
import json
from typing import Optional, Any
from datetime import timedelta
import redis.asyncio as redis
from pydantic import BaseModel

from src.config import get_settings
from src.models.state import AgentAnalysis, CosiliumOutput


class CacheEntry(BaseModel):
    """Запись кэша"""
    key: str
    task_hash: str
    hit_count: int = 0
    created_at: str
    expires_at: str


class AnalysisCache:
    """
    Кэш результатов анализа

    Кэширует:
    - Полные результаты анализа (по хэшу задачи)
    - Промежуточные результаты агентов
    - Embedding'и для семантического кэширования
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:cache:"
        self.default_ttl = timedelta(hours=24)

    def _hash_task(self, task: str, task_type: str, context: str) -> str:
        """Создать хэш задачи для ключа кэша"""
        content = f"{task}|{task_type}|{context}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _key(self, task_hash: str, suffix: str = "") -> str:
        """Сформировать ключ Redis"""
        return f"{self.prefix}{task_hash}{':' + suffix if suffix else ''}"

    async def get_analysis(
        self,
        task: str,
        task_type: str,
        context: str = ""
    ) -> Optional[CosiliumOutput]:
        """
        Получить закэшированный результат анализа

        Returns:
            CosiliumOutput если найден, None если нет
        """
        task_hash = self._hash_task(task, task_type, context)
        key = self._key(task_hash, "full")

        data = await self.redis.get(key)
        if data:
            # Увеличиваем счётчик попаданий
            await self.redis.incr(self._key(task_hash, "hits"))

            return CosiliumOutput.model_validate_json(data)

        return None

    async def set_analysis(
        self,
        task: str,
        task_type: str,
        context: str,
        result: CosiliumOutput,
        ttl: Optional[timedelta] = None
    ) -> str:
        """
        Сохранить результат анализа в кэш

        Returns:
            Ключ кэша
        """
        ttl = ttl or self.default_ttl
        task_hash = self._hash_task(task, task_type, context)
        key = self._key(task_hash, "full")

        await self.redis.setex(
            key,
            ttl,
            result.model_dump_json()
        )

        # Сохраняем метаданные
        await self.redis.setex(
            self._key(task_hash, "meta"),
            ttl,
            json.dumps({
                "task": task[:100],
                "task_type": task_type,
                "iterations": result.iterations_used,
            })
        )

        return task_hash

    async def get_agent_analysis(
        self,
        task_hash: str,
        agent_name: str
    ) -> Optional[AgentAnalysis]:
        """Получить закэшированный анализ конкретного агента"""
        key = self._key(task_hash, f"agent:{agent_name}")
        data = await self.redis.get(key)

        if data:
            return AgentAnalysis.model_validate_json(data)
        return None

    async def set_agent_analysis(
        self,
        task_hash: str,
        analysis: AgentAnalysis,
        ttl: Optional[timedelta] = None
    ) -> bool:
        """Сохранить анализ агента"""
        ttl = ttl or self.default_ttl
        key = self._key(task_hash, f"agent:{analysis.agent_name}")

        await self.redis.setex(
            key,
            ttl,
            analysis.model_dump_json()
        )
        return True

    async def invalidate(self, task_hash: str) -> bool:
        """Инвалидировать кэш для задачи"""
        # Находим все ключи
        pattern = self._key(task_hash, "*")
        keys = []

        async for key in self.redis.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            await self.redis.delete(*keys)

        return True

    async def get_stats(self) -> dict:
        """Получить статистику кэша"""
        # Общее количество записей
        pattern = f"{self.prefix}*:full"
        count = 0
        total_hits = 0

        async for key in self.redis.scan_iter(match=pattern):
            count += 1
            # Получаем hits
            task_hash = key.decode().replace(self.prefix, "").replace(":full", "")
            hits = await self.redis.get(self._key(task_hash, "hits"))
            if hits:
                total_hits += int(hits)

        return {
            "total_entries": count,
            "total_hits": total_hits,
            "avg_hits_per_entry": total_hits / count if count > 0 else 0,
        }

    async def cleanup_expired(self) -> int:
        """Очистить истёкшие записи (Redis делает это автоматически, но можно форсировать)"""
        # Redis автоматически удаляет по TTL
        # Этот метод для явной очистки если нужно
        return 0

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


class SemanticCache(AnalysisCache):
    """
    Семантический кэш

    Находит похожие задачи по embedding'ам, а не точному совпадению
    """

    def __init__(self):
        super().__init__()
        self.similarity_threshold = 0.95

    async def get_similar_analysis(
        self,
        task: str,
        task_type: str,
        context: str = ""
    ) -> Optional[tuple[CosiliumOutput, float]]:
        """
        Найти похожий закэшированный результат

        Returns:
            (result, similarity_score) или None
        """
        from langchain_openai import OpenAIEmbeddings
        settings = get_settings()

        embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small"
        )

        # Получаем embedding запроса
        query_embedding = await embeddings.aembed_query(f"{task} {task_type} {context}")

        # Ищем похожие в кэше
        pattern = f"{self.prefix}*:embedding"
        best_match = None
        best_similarity = 0

        async for key in self.redis.scan_iter(match=pattern):
            cached_embedding = await self.redis.get(key)
            if cached_embedding:
                cached_vec = json.loads(cached_embedding)
                similarity = self._cosine_similarity(query_embedding, cached_vec)

                if similarity > best_similarity:
                    best_similarity = similarity
                    task_hash = key.decode().replace(self.prefix, "").replace(":embedding", "")
                    best_match = task_hash

        if best_match and best_similarity >= self.similarity_threshold:
            result = await self.get_analysis_by_hash(best_match)
            if result:
                return result, best_similarity

        return None

    async def get_analysis_by_hash(self, task_hash: str) -> Optional[CosiliumOutput]:
        """Получить анализ по хэшу"""
        key = self._key(task_hash, "full")
        data = await self.redis.get(key)
        if data:
            return CosiliumOutput.model_validate_json(data)
        return None

    async def set_with_embedding(
        self,
        task: str,
        task_type: str,
        context: str,
        result: CosiliumOutput,
        ttl: Optional[timedelta] = None
    ) -> str:
        """Сохранить с embedding для семантического поиска"""
        from langchain_openai import OpenAIEmbeddings
        settings = get_settings()

        # Сохраняем основной результат
        task_hash = await self.set_analysis(task, task_type, context, result, ttl)

        # Сохраняем embedding
        embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small"
        )
        embedding = await embeddings.aembed_query(f"{task} {task_type} {context}")

        await self.redis.setex(
            self._key(task_hash, "embedding"),
            ttl or self.default_ttl,
            json.dumps(embedding)
        )

        return task_hash

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """Косинусное сходство между векторами"""
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            return 0

        return dot_product / (norm1 * norm2)
