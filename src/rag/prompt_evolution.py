"""
Cosilium-LLM: Prompt Evolution
Система эволюции и оптимизации промптов на основе результатов
"""

import json
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from src.config import get_settings
from src.rag.vector_store import VectorStore, Document


class PromptVersion(BaseModel):
    """Версия промпта"""
    version: int
    content: str
    agent_type: str
    prompt_type: str  # analysis, critique, synthesis
    performance_score: float = 0.0
    usage_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PromptFeedback(BaseModel):
    """Обратная связь по промпту"""
    prompt_id: str
    task_id: str
    quality_score: float  # 0-1
    relevance_score: float  # 0-1
    completeness_score: float  # 0-1
    user_feedback: Optional[str] = None


class PromptEvolution:
    """
    Система эволюции промптов

    Автоматически улучшает промпты на основе:
    - Качества генерируемых ответов
    - Оценок критиков
    - Обратной связи пользователей
    """

    def __init__(self):
        settings = get_settings()
        self.vector_store = VectorStore()
        self.llm = ChatAnthropic(
            model="claude-3-haiku-20240307",  # Быстрая модель для мета-анализа
            temperature=0.3,
            api_key=settings.anthropic_api_key,
        )

    async def get_best_prompt(
        self,
        agent_type: str,
        prompt_type: str,
        task_context: str
    ) -> str:
        """
        Получить лучший промпт для данного контекста

        Args:
            agent_type: Тип агента (chatgpt, claude, gemini, deepseek)
            prompt_type: Тип промпта (analysis, critique, synthesis)
            task_context: Контекст задачи для семантического подбора
        """
        # Ищем релевантные промпты
        query = f"{agent_type} {prompt_type} {task_context}"
        docs = await self.vector_store.search(
            query=query,
            doc_type=f"prompt_{agent_type}_{prompt_type}",
            limit=5,
            threshold=0.6
        )

        if not docs:
            # Возвращаем базовый промпт
            return self._get_default_prompt(agent_type, prompt_type)

        # Выбираем промпт с лучшим performance_score
        best_doc = max(docs, key=lambda d: d.metadata.get("performance_score", 0))
        return best_doc.content

    async def evolve_prompt(
        self,
        prompt_id: str,
        feedback: PromptFeedback
    ) -> Optional[str]:
        """
        Эволюционировать промпт на основе обратной связи

        Если качество низкое, генерирует улучшенную версию
        """
        doc = await self.vector_store.get_by_id(prompt_id)
        if not doc:
            return None

        # Обновляем метаданные
        current_score = doc.metadata.get("performance_score", 0.5)
        usage_count = doc.metadata.get("usage_count", 0) + 1

        # Экспоненциальное скользящее среднее
        alpha = 0.3
        avg_feedback = (
            feedback.quality_score +
            feedback.relevance_score +
            feedback.completeness_score
        ) / 3

        new_score = alpha * avg_feedback + (1 - alpha) * current_score

        doc.metadata["performance_score"] = new_score
        doc.metadata["usage_count"] = usage_count

        # Если качество падает, генерируем улучшенную версию
        if new_score < 0.6 and usage_count >= 5:
            improved_prompt = await self._generate_improved_prompt(
                doc.content,
                feedback,
                doc.metadata
            )
            if improved_prompt:
                # Сохраняем новую версию
                new_doc = Document(
                    content=improved_prompt,
                    doc_type=doc.doc_type,
                    metadata={
                        "version": doc.metadata.get("version", 1) + 1,
                        "parent_id": doc.id,
                        "performance_score": 0.5,  # Начальный score
                        "usage_count": 0,
                    }
                )
                await self.vector_store.add_document(new_doc)
                return improved_prompt

        # Обновляем существующий документ
        await self.vector_store.add_document(doc)
        return None

    async def _generate_improved_prompt(
        self,
        current_prompt: str,
        feedback: PromptFeedback,
        metadata: dict
    ) -> Optional[str]:
        """Генерация улучшенной версии промпта с помощью LLM"""

        system = """Ты эксперт по prompt engineering. Твоя задача — улучшить промпт на основе обратной связи.

Принципы улучшения:
1. Сохрани основную структуру и цель промпта
2. Усиль слабые области, указанные в feedback
3. Добавь конкретные инструкции для повышения качества
4. Используй Chain-of-Thought где уместно
5. Добавь примеры если это поможет

Верни ТОЛЬКО улучшенный промпт, без объяснений."""

        user = f"""Текущий промпт:
```
{current_prompt}
```

Метрики качества:
- Quality: {feedback.quality_score:.2f}
- Relevance: {feedback.relevance_score:.2f}
- Completeness: {feedback.completeness_score:.2f}

Пользовательский feedback: {feedback.user_feedback or 'Не предоставлен'}

История использования: {metadata.get('usage_count', 0)} раз
Текущий performance score: {metadata.get('performance_score', 0):.2f}

Улучши этот промпт."""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content=system),
                HumanMessage(content=user),
            ])
            return response.content
        except Exception:
            return None

    def _get_default_prompt(self, agent_type: str, prompt_type: str) -> str:
        """Базовые промпты по умолчанию"""
        defaults = {
            "analysis": """Проведи глубокий анализ задачи.

Структура ответа:
1. Контекст и понимание задачи
2. Ключевые факторы и переменные
3. Анализ с обоснованием
4. Выводы с уровнем уверенности
5. Риски и допущения
6. Условия фальсификации выводов

Принципы:
- Если можно посчитать — посчитай
- Если нельзя — объясни почему
- Каждый вывод должен быть фальсифицируем""",

            "critique": """Критически оцени анализ по критериям:
1. Логическая непротиворечивость
2. Полнота анализа
3. Обоснованность выводов
4. Учёт рисков
5. Практическая применимость

Будь конструктивен но беспощаден к слабостям.
Предлагай конкретные улучшения.""",

            "synthesis": """Синтезируй результаты анализа нескольких агентов.

1. Объедини сильные стороны каждого анализа
2. Разреши противоречия через взвешивание аргументов
3. Формализуй выводы математически где возможно
4. Сохрани разногласия если консенсус невозможен

Формат: таблицы выводов, формулы, рекомендации."""
        }

        return defaults.get(prompt_type, defaults["analysis"])

    async def save_prompt(
        self,
        content: str,
        agent_type: str,
        prompt_type: str,
        metadata: dict = None
    ) -> str:
        """Сохранить новый промпт"""
        doc = Document(
            content=content,
            doc_type=f"prompt_{agent_type}_{prompt_type}",
            metadata={
                "agent_type": agent_type,
                "prompt_type": prompt_type,
                "version": 1,
                "performance_score": 0.5,
                "usage_count": 0,
                **(metadata or {}),
            }
        )
        return await self.vector_store.add_document(doc)

    async def get_prompt_stats(self, agent_type: str = None) -> dict:
        """Статистика по промптам"""
        doc_type = f"prompt_{agent_type}_" if agent_type else "prompt_"

        # Получаем все промпты
        docs = await self.vector_store.list_by_type(doc_type)

        stats = {
            "total_prompts": len(docs),
            "by_type": {},
            "avg_performance": 0,
            "top_performers": [],
        }

        if docs:
            scores = [d.metadata.get("performance_score", 0) for d in docs]
            stats["avg_performance"] = sum(scores) / len(scores)

            # Группировка по типу
            for doc in docs:
                pt = doc.metadata.get("prompt_type", "unknown")
                if pt not in stats["by_type"]:
                    stats["by_type"][pt] = 0
                stats["by_type"][pt] += 1

            # Топ-5 по performance
            sorted_docs = sorted(
                docs,
                key=lambda d: d.metadata.get("performance_score", 0),
                reverse=True
            )
            stats["top_performers"] = [
                {
                    "id": d.id,
                    "score": d.metadata.get("performance_score", 0),
                    "usage": d.metadata.get("usage_count", 0),
                }
                for d in sorted_docs[:5]
            ]

        return stats
