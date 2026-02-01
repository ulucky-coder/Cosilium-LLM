"""
Cosilium-LLM: Cost Tracker
Отслеживание стоимости LLM вызовов
"""

from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from pydantic import BaseModel, Field
import redis.asyncio as redis

from src.config import get_settings


class TokenPricing(BaseModel):
    """Ценообразование по токенам"""
    input_per_1k: Decimal
    output_per_1k: Decimal
    cached_input_per_1k: Optional[Decimal] = None


# Актуальные цены (январь 2026)
MODEL_PRICING: dict[str, TokenPricing] = {
    # OpenAI
    "gpt-4-turbo-preview": TokenPricing(
        input_per_1k=Decimal("0.01"),
        output_per_1k=Decimal("0.03"),
    ),
    "gpt-4o": TokenPricing(
        input_per_1k=Decimal("0.005"),
        output_per_1k=Decimal("0.015"),
    ),
    "gpt-4o-mini": TokenPricing(
        input_per_1k=Decimal("0.00015"),
        output_per_1k=Decimal("0.0006"),
    ),

    # Anthropic
    "claude-3-opus-20240229": TokenPricing(
        input_per_1k=Decimal("0.015"),
        output_per_1k=Decimal("0.075"),
    ),
    "claude-3-sonnet-20240229": TokenPricing(
        input_per_1k=Decimal("0.003"),
        output_per_1k=Decimal("0.015"),
    ),
    "claude-3-haiku-20240307": TokenPricing(
        input_per_1k=Decimal("0.00025"),
        output_per_1k=Decimal("0.00125"),
    ),

    # Google
    "gemini-pro": TokenPricing(
        input_per_1k=Decimal("0.00025"),
        output_per_1k=Decimal("0.0005"),
    ),
    "gemini-1.5-pro": TokenPricing(
        input_per_1k=Decimal("0.00125"),
        output_per_1k=Decimal("0.005"),
    ),

    # DeepSeek
    "deepseek-chat": TokenPricing(
        input_per_1k=Decimal("0.00014"),
        output_per_1k=Decimal("0.00028"),
        cached_input_per_1k=Decimal("0.000014"),
    ),
    "deepseek-reasoner": TokenPricing(
        input_per_1k=Decimal("0.00055"),
        output_per_1k=Decimal("0.00219"),
    ),
}


class UsageRecord(BaseModel):
    """Запись об использовании"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    task_id: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int = 0
    cost_usd: Decimal
    latency_ms: int


class DailyCost(BaseModel):
    """Дневная стоимость"""
    date: date
    total_cost_usd: Decimal
    total_input_tokens: int
    total_output_tokens: int
    requests_count: int
    by_provider: dict[str, Decimal]
    by_model: dict[str, Decimal]


class CostTracker:
    """
    Отслеживание стоимости LLM вызовов

    Функции:
    - Расчёт стоимости по токенам
    - Ежедневная/месячная агрегация
    - Бюджетные лимиты
    - Алерты при превышении
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:cost:"
        self.pricing = MODEL_PRICING

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0
    ) -> Decimal:
        """Рассчитать стоимость вызова"""
        pricing = self.pricing.get(model)
        if not pricing:
            # Fallback на средние цены
            pricing = TokenPricing(
                input_per_1k=Decimal("0.001"),
                output_per_1k=Decimal("0.002"),
            )

        input_cost = (Decimal(input_tokens) / 1000) * pricing.input_per_1k
        output_cost = (Decimal(output_tokens) / 1000) * pricing.output_per_1k

        cached_cost = Decimal(0)
        if cached_tokens > 0 and pricing.cached_input_per_1k:
            cached_cost = (Decimal(cached_tokens) / 1000) * pricing.cached_input_per_1k

        return input_cost + output_cost + cached_cost

    async def record_usage(
        self,
        task_id: str,
        model: str,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
        latency_ms: int = 0
    ) -> UsageRecord:
        """Записать использование"""
        cost = self.calculate_cost(model, input_tokens, output_tokens, cached_tokens)

        record = UsageRecord(
            task_id=task_id,
            model=model,
            provider=provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
        )

        # Сохраняем запись
        today = date.today().isoformat()
        key = f"{self.prefix}daily:{today}"

        await self.redis.rpush(key, record.model_dump_json())
        await self.redis.expire(key, 86400 * 90)  # 90 дней

        # Обновляем агрегаты
        await self._update_aggregates(today, record)

        return record

    async def _update_aggregates(self, day: str, record: UsageRecord):
        """Обновить агрегированные метрики"""
        pipe = self.redis.pipeline()

        # Общая стоимость за день
        pipe.incrbyfloat(f"{self.prefix}total:{day}", float(record.cost_usd))

        # По провайдеру
        pipe.incrbyfloat(
            f"{self.prefix}provider:{day}:{record.provider}",
            float(record.cost_usd)
        )

        # По модели
        pipe.incrbyfloat(
            f"{self.prefix}model:{day}:{record.model}",
            float(record.cost_usd)
        )

        # Счётчики токенов
        pipe.incrby(f"{self.prefix}tokens:{day}:input", record.input_tokens)
        pipe.incrby(f"{self.prefix}tokens:{day}:output", record.output_tokens)

        # Счётчик запросов
        pipe.incr(f"{self.prefix}requests:{day}")

        # TTL для всех ключей
        for key in [
            f"{self.prefix}total:{day}",
            f"{self.prefix}provider:{day}:{record.provider}",
            f"{self.prefix}model:{day}:{record.model}",
            f"{self.prefix}tokens:{day}:input",
            f"{self.prefix}tokens:{day}:output",
            f"{self.prefix}requests:{day}",
        ]:
            pipe.expire(key, 86400 * 90)

        await pipe.execute()

    async def get_daily_cost(self, day: Optional[date] = None) -> DailyCost:
        """Получить стоимость за день"""
        day = day or date.today()
        day_str = day.isoformat()

        total = await self.redis.get(f"{self.prefix}total:{day_str}")
        input_tokens = await self.redis.get(f"{self.prefix}tokens:{day_str}:input")
        output_tokens = await self.redis.get(f"{self.prefix}tokens:{day_str}:output")
        requests = await self.redis.get(f"{self.prefix}requests:{day_str}")

        # По провайдерам
        by_provider = {}
        for provider in ["openai", "anthropic", "google", "deepseek"]:
            cost = await self.redis.get(f"{self.prefix}provider:{day_str}:{provider}")
            if cost:
                by_provider[provider] = Decimal(cost)

        # По моделям
        by_model = {}
        for model in MODEL_PRICING.keys():
            cost = await self.redis.get(f"{self.prefix}model:{day_str}:{model}")
            if cost:
                by_model[model] = Decimal(cost)

        return DailyCost(
            date=day,
            total_cost_usd=Decimal(total) if total else Decimal(0),
            total_input_tokens=int(input_tokens) if input_tokens else 0,
            total_output_tokens=int(output_tokens) if output_tokens else 0,
            requests_count=int(requests) if requests else 0,
            by_provider=by_provider,
            by_model=by_model,
        )

    async def get_monthly_cost(self, year: int, month: int) -> Decimal:
        """Получить стоимость за месяц"""
        total = Decimal(0)

        # Собираем за все дни месяца
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        current = start_date
        while current < end_date:
            daily = await self.get_daily_cost(current)
            total += daily.total_cost_usd
            current += timedelta(days=1)

        return total

    async def get_task_cost(self, task_id: str) -> Decimal:
        """Получить стоимость конкретной задачи"""
        # Ищем все записи за последние 7 дней
        total = Decimal(0)

        for i in range(7):
            day = (date.today() - timedelta(days=i)).isoformat()
            key = f"{self.prefix}daily:{day}"

            records = await self.redis.lrange(key, 0, -1)
            for record_json in records:
                record = UsageRecord.model_validate_json(record_json)
                if record.task_id == task_id:
                    total += record.cost_usd

        return total

    async def check_budget(
        self,
        daily_limit: Optional[Decimal] = None,
        monthly_limit: Optional[Decimal] = None
    ) -> dict:
        """
        Проверить бюджетные лимиты

        Returns:
            {
                "daily_ok": bool,
                "monthly_ok": bool,
                "daily_usage": Decimal,
                "daily_limit": Decimal,
                "monthly_usage": Decimal,
                "monthly_limit": Decimal,
            }
        """
        today = date.today()
        daily_cost = await self.get_daily_cost(today)
        monthly_cost = await self.get_monthly_cost(today.year, today.month)

        result = {
            "daily_usage": daily_cost.total_cost_usd,
            "daily_limit": daily_limit,
            "daily_ok": True,
            "monthly_usage": monthly_cost,
            "monthly_limit": monthly_limit,
            "monthly_ok": True,
        }

        if daily_limit:
            result["daily_ok"] = daily_cost.total_cost_usd < daily_limit

        if monthly_limit:
            result["monthly_ok"] = monthly_cost < monthly_limit

        return result

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()
