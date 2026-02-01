"""
Cosilium-LLM: Feedback Collector
Сбор и обработка обратной связи от пользователей
"""

from typing import Optional
from datetime import datetime, date, timedelta
from enum import Enum
from pydantic import BaseModel, Field
import redis.asyncio as redis

from src.config import get_settings


class FeedbackType(str, Enum):
    QUALITY = "quality"
    RELEVANCE = "relevance"
    USEFULNESS = "usefulness"
    ACCURACY = "accuracy"
    COMPLETENESS = "completeness"


class FeedbackRating(str, Enum):
    VERY_BAD = "very_bad"
    BAD = "bad"
    NEUTRAL = "neutral"
    GOOD = "good"
    VERY_GOOD = "very_good"


RATING_SCORES = {
    FeedbackRating.VERY_BAD: 1,
    FeedbackRating.BAD: 2,
    FeedbackRating.NEUTRAL: 3,
    FeedbackRating.GOOD: 4,
    FeedbackRating.VERY_GOOD: 5,
}


class Feedback(BaseModel):
    """Обратная связь от пользователя"""
    id: Optional[str] = None
    task_id: str
    user_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Оценки
    overall_rating: FeedbackRating
    type_ratings: dict[FeedbackType, FeedbackRating] = {}

    # Текстовая обратная связь
    comment: Optional[str] = None
    improvement_suggestions: Optional[str] = None

    # Метаданные
    task_type: Optional[str] = None
    iterations_used: Optional[int] = None


class FeedbackSummary(BaseModel):
    """Сводка по обратной связи"""
    period: str
    start_date: date
    end_date: date

    total_feedback: int = 0
    avg_overall_rating: float = 0

    # Распределение оценок
    rating_distribution: dict[str, int] = {}

    # По типам
    avg_by_type: dict[str, float] = {}

    # Частые комментарии/темы
    common_issues: list[str] = []
    common_praise: list[str] = []


class FeedbackCollector:
    """
    Сборщик обратной связи

    Функции:
    - Сбор оценок и комментариев
    - Агрегация и анализ
    - Триггеры для prompt evolution
    - Интеграция с LangSmith
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:feedback:"

    async def submit_feedback(self, feedback: Feedback) -> str:
        """
        Отправить обратную связь

        Returns:
            feedback_id
        """
        import hashlib

        # Генерируем ID
        feedback.id = hashlib.md5(
            f"{feedback.task_id}{datetime.utcnow()}".encode()
        ).hexdigest()[:12]

        # Сохраняем
        today = date.today().isoformat()
        key = f"{self.prefix}daily:{today}"

        await self.redis.rpush(key, feedback.model_dump_json())
        await self.redis.expire(key, 86400 * 180)  # 180 дней

        # Сохраняем по task_id для быстрого поиска
        await self.redis.set(
            f"{self.prefix}task:{feedback.task_id}",
            feedback.model_dump_json(),
            ex=86400 * 30  # 30 дней
        )

        # Обновляем агрегаты
        await self._update_aggregates(today, feedback)

        # Триггер для prompt evolution если низкая оценка
        if RATING_SCORES[feedback.overall_rating] <= 2:
            await self._trigger_prompt_review(feedback)

        return feedback.id

    async def _update_aggregates(self, day: str, feedback: Feedback):
        """Обновить агрегированные метрики"""
        pipe = self.redis.pipeline()

        score = RATING_SCORES[feedback.overall_rating]

        # Счётчик и сумма для среднего
        pipe.incr(f"{self.prefix}count:{day}")
        pipe.incrbyfloat(f"{self.prefix}sum:{day}", score)

        # Распределение оценок
        pipe.incr(f"{self.prefix}dist:{day}:{feedback.overall_rating.value}")

        # По типам
        for ftype, rating in feedback.type_ratings.items():
            type_score = RATING_SCORES[rating]
            pipe.incrbyfloat(f"{self.prefix}type:{day}:{ftype.value}", type_score)
            pipe.incr(f"{self.prefix}type_count:{day}:{ftype.value}")

        # TTL
        for suffix in ["count", "sum"]:
            pipe.expire(f"{self.prefix}{suffix}:{day}", 86400 * 180)

        await pipe.execute()

    async def _trigger_prompt_review(self, feedback: Feedback):
        """Триггер для проверки промптов при плохом feedback"""
        # Добавляем в очередь на review
        await self.redis.rpush(
            f"{self.prefix}review_queue",
            feedback.model_dump_json()
        )

    async def get_feedback_for_task(self, task_id: str) -> Optional[Feedback]:
        """Получить feedback для задачи"""
        data = await self.redis.get(f"{self.prefix}task:{task_id}")
        if data:
            return Feedback.model_validate_json(data)
        return None

    async def get_daily_summary(self, day: Optional[date] = None) -> FeedbackSummary:
        """Получить сводку за день"""
        day = day or date.today()
        day_str = day.isoformat()

        count = await self.redis.get(f"{self.prefix}count:{day_str}")
        total_sum = await self.redis.get(f"{self.prefix}sum:{day_str}")

        count = int(count) if count else 0
        avg_rating = float(total_sum) / count if count > 0 and total_sum else 0

        # Распределение оценок
        distribution = {}
        for rating in FeedbackRating:
            dist_count = await self.redis.get(f"{self.prefix}dist:{day_str}:{rating.value}")
            if dist_count:
                distribution[rating.value] = int(dist_count)

        # По типам
        avg_by_type = {}
        for ftype in FeedbackType:
            type_sum = await self.redis.get(f"{self.prefix}type:{day_str}:{ftype.value}")
            type_count = await self.redis.get(f"{self.prefix}type_count:{day_str}:{ftype.value}")
            if type_sum and type_count:
                avg_by_type[ftype.value] = float(type_sum) / int(type_count)

        return FeedbackSummary(
            period="daily",
            start_date=day,
            end_date=day,
            total_feedback=count,
            avg_overall_rating=avg_rating,
            rating_distribution=distribution,
            avg_by_type=avg_by_type,
        )

    async def get_weekly_summary(self, week_start: Optional[date] = None) -> FeedbackSummary:
        """Получить сводку за неделю"""
        if week_start is None:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

        week_end = week_start + timedelta(days=6)

        total_count = 0
        total_sum = 0
        all_distributions = {}
        all_by_type = {}

        current = week_start
        while current <= week_end:
            daily = await self.get_daily_summary(current)
            total_count += daily.total_feedback
            total_sum += daily.avg_overall_rating * daily.total_feedback

            for rating, count in daily.rating_distribution.items():
                all_distributions[rating] = all_distributions.get(rating, 0) + count

            current += timedelta(days=1)

        return FeedbackSummary(
            period="weekly",
            start_date=week_start,
            end_date=week_end,
            total_feedback=total_count,
            avg_overall_rating=total_sum / total_count if total_count > 0 else 0,
            rating_distribution=all_distributions,
        )

    async def get_low_rated_tasks(self, days: int = 7, threshold: int = 2) -> list[Feedback]:
        """Получить задачи с низкими оценками"""
        low_rated = []

        for i in range(days):
            day = (date.today() - timedelta(days=i)).isoformat()
            key = f"{self.prefix}daily:{day}"

            records = await self.redis.lrange(key, 0, -1)
            for record_json in records:
                feedback = Feedback.model_validate_json(record_json)
                if RATING_SCORES[feedback.overall_rating] <= threshold:
                    low_rated.append(feedback)

        return low_rated

    async def get_review_queue(self, limit: int = 10) -> list[Feedback]:
        """Получить очередь на review"""
        items = await self.redis.lrange(f"{self.prefix}review_queue", 0, limit - 1)
        return [Feedback.model_validate_json(item) for item in items]

    async def process_review_queue(self) -> int:
        """Обработать очередь review (вызывается периодически)"""
        # Получаем и удаляем элементы из очереди
        processed = 0

        while True:
            item = await self.redis.lpop(f"{self.prefix}review_queue")
            if not item:
                break

            feedback = Feedback.model_validate_json(item)

            # Здесь можно добавить логику для prompt evolution
            # Например, пометить промпты как требующие улучшения

            processed += 1

        return processed

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()
