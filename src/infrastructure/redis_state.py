"""
Cosilium-LLM: Redis State Store
Персистентное хранение состояния в Redis
"""

import json
from typing import Optional, Any
from datetime import datetime, timedelta
import redis.asyncio as redis
from pydantic import BaseModel

from src.config import get_settings


class StateMetadata(BaseModel):
    """Метаданные состояния"""
    task_id: str
    created_at: datetime
    updated_at: datetime
    iteration: int
    status: str  # pending, running, completed, failed


class RedisStateStore:
    """
    Хранилище состояния на базе Redis

    Обеспечивает:
    - Персистентность состояния между вызовами
    - TTL для автоматической очистки
    - Атомарные обновления
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:"
        self.default_ttl = timedelta(hours=24)

    def _key(self, task_id: str, suffix: str = "") -> str:
        """Сформировать ключ Redis"""
        return f"{self.prefix}state:{task_id}{':' + suffix if suffix else ''}"

    async def save_state(
        self,
        task_id: str,
        state: dict,
        ttl: Optional[timedelta] = None
    ) -> bool:
        """
        Сохранить состояние

        Args:
            task_id: ID задачи
            state: Состояние для сохранения
            ttl: Время жизни (по умолчанию 24 часа)
        """
        ttl = ttl or self.default_ttl

        # Сериализуем состояние
        serialized = self._serialize_state(state)

        # Сохраняем
        await self.redis.setex(
            self._key(task_id),
            ttl,
            serialized
        )

        # Обновляем метаданные
        metadata = StateMetadata(
            task_id=task_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            iteration=state.get("iteration", 0),
            status=self._get_status(state),
        )
        await self.redis.setex(
            self._key(task_id, "meta"),
            ttl,
            metadata.model_dump_json()
        )

        return True

    async def load_state(self, task_id: str) -> Optional[dict]:
        """Загрузить состояние"""
        data = await self.redis.get(self._key(task_id))
        if data:
            return self._deserialize_state(data)
        return None

    async def update_state(
        self,
        task_id: str,
        updates: dict
    ) -> bool:
        """
        Обновить состояние (merge)

        Args:
            task_id: ID задачи
            updates: Обновления для merge
        """
        current = await self.load_state(task_id)
        if current is None:
            return False

        # Merge updates
        current.update(updates)
        return await self.save_state(task_id, current)

    async def delete_state(self, task_id: str) -> bool:
        """Удалить состояние"""
        await self.redis.delete(
            self._key(task_id),
            self._key(task_id, "meta")
        )
        return True

    async def get_metadata(self, task_id: str) -> Optional[StateMetadata]:
        """Получить метаданные"""
        data = await self.redis.get(self._key(task_id, "meta"))
        if data:
            return StateMetadata.model_validate_json(data)
        return None

    async def list_active_tasks(self, limit: int = 100) -> list[StateMetadata]:
        """Получить список активных задач"""
        pattern = f"{self.prefix}state:*:meta"
        keys = []

        async for key in self.redis.scan_iter(match=pattern, count=limit):
            keys.append(key)
            if len(keys) >= limit:
                break

        tasks = []
        for key in keys:
            data = await self.redis.get(key)
            if data:
                tasks.append(StateMetadata.model_validate_json(data))

        return tasks

    async def save_checkpoint(
        self,
        task_id: str,
        checkpoint_name: str,
        state: dict
    ) -> bool:
        """Сохранить checkpoint"""
        key = self._key(task_id, f"checkpoint:{checkpoint_name}")
        serialized = self._serialize_state(state)
        await self.redis.setex(key, self.default_ttl, serialized)
        return True

    async def load_checkpoint(
        self,
        task_id: str,
        checkpoint_name: str
    ) -> Optional[dict]:
        """Загрузить checkpoint"""
        key = self._key(task_id, f"checkpoint:{checkpoint_name}")
        data = await self.redis.get(key)
        if data:
            return self._deserialize_state(data)
        return None

    async def list_checkpoints(self, task_id: str) -> list[str]:
        """Список checkpoint'ов для задачи"""
        pattern = self._key(task_id, "checkpoint:*")
        checkpoints = []

        async for key in self.redis.scan_iter(match=pattern):
            # Извлекаем имя checkpoint
            name = key.decode().split("checkpoint:")[-1]
            checkpoints.append(name)

        return checkpoints

    def _serialize_state(self, state: dict) -> str:
        """Сериализация состояния в JSON"""
        def default_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if hasattr(obj, "model_dump"):
                return obj.model_dump()
            if hasattr(obj, "__dict__"):
                return obj.__dict__
            return str(obj)

        return json.dumps(state, default=default_serializer)

    def _deserialize_state(self, data: bytes) -> dict:
        """Десериализация состояния"""
        return json.loads(data)

    def _get_status(self, state: dict) -> str:
        """Определить статус по состоянию"""
        if state.get("error"):
            return "failed"
        if state.get("synthesis"):
            return "completed"
        if state.get("analyses"):
            return "running"
        return "pending"

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


class RedisCheckpointer:
    """
    LangGraph-совместимый checkpointer на базе Redis

    Для использования с langgraph.checkpoint
    """

    def __init__(self):
        self.store = RedisStateStore()

    async def put(self, config: dict, checkpoint: dict) -> None:
        """Сохранить checkpoint"""
        thread_id = config.get("configurable", {}).get("thread_id", "default")
        await self.store.save_state(thread_id, checkpoint)

    async def get(self, config: dict) -> Optional[dict]:
        """Загрузить checkpoint"""
        thread_id = config.get("configurable", {}).get("thread_id", "default")
        return await self.store.load_state(thread_id)

    async def list(self, config: dict) -> list[dict]:
        """Список checkpoint'ов"""
        thread_id = config.get("configurable", {}).get("thread_id", "default")
        checkpoints = await self.store.list_checkpoints(thread_id)
        return [{"name": cp} for cp in checkpoints]
