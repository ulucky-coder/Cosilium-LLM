"""
LLM-top: Rate Limiter
Ограничение частоты запросов к LLM API
"""

import asyncio
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
import redis.asyncio as redis
from pydantic import BaseModel

from src.config import get_settings


class RateLimitConfig(BaseModel):
    """Конфигурация rate limit"""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    tokens_per_minute: int = 100000
    tokens_per_hour: int = 1000000
    concurrent_requests: int = 10


# Дефолтные лимиты по провайдерам
DEFAULT_LIMITS = {
    "openai": RateLimitConfig(
        requests_per_minute=60,
        requests_per_hour=3500,
        tokens_per_minute=90000,
        concurrent_requests=10,
    ),
    "anthropic": RateLimitConfig(
        requests_per_minute=50,
        requests_per_hour=1000,
        tokens_per_minute=100000,
        concurrent_requests=5,
    ),
    "google": RateLimitConfig(
        requests_per_minute=60,
        requests_per_hour=1500,
        tokens_per_minute=120000,
        concurrent_requests=10,
    ),
    "deepseek": RateLimitConfig(
        requests_per_minute=60,
        requests_per_hour=2000,
        tokens_per_minute=100000,
        concurrent_requests=10,
    ),
}


class RateLimitExceeded(Exception):
    """Исключение при превышении лимита"""
    def __init__(self, provider: str, limit_type: str, retry_after: int):
        self.provider = provider
        self.limit_type = limit_type
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded for {provider}: {limit_type}. Retry after {retry_after}s")


class RateLimiter:
    """
    Rate limiter для LLM API

    Поддерживает:
    - Per-minute и per-hour лимиты
    - Token-based лимиты
    - Concurrent request лимиты
    - Distributed rate limiting через Redis
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:ratelimit:"
        self.limits = DEFAULT_LIMITS.copy()
        self._semaphores: dict[str, asyncio.Semaphore] = {}

    def _key(self, provider: str, limit_type: str) -> str:
        return f"{self.prefix}{provider}:{limit_type}"

    async def check_and_increment(
        self,
        provider: str,
        tokens: int = 0
    ) -> bool:
        """
        Проверить лимиты и инкрементировать счётчики

        Args:
            provider: Провайдер (openai, anthropic, etc)
            tokens: Количество токенов в запросе

        Returns:
            True если запрос разрешён

        Raises:
            RateLimitExceeded: если лимит превышен
        """
        config = self.limits.get(provider, RateLimitConfig())

        # Проверяем concurrent requests
        semaphore = self._get_semaphore(provider, config.concurrent_requests)
        if semaphore.locked():
            raise RateLimitExceeded(provider, "concurrent", 1)

        # Проверяем RPM
        rpm_key = self._key(provider, "rpm")
        rpm_count = await self.redis.get(rpm_key)
        if rpm_count and int(rpm_count) >= config.requests_per_minute:
            ttl = await self.redis.ttl(rpm_key)
            raise RateLimitExceeded(provider, "requests_per_minute", max(ttl, 1))

        # Проверяем RPH
        rph_key = self._key(provider, "rph")
        rph_count = await self.redis.get(rph_key)
        if rph_count and int(rph_count) >= config.requests_per_hour:
            ttl = await self.redis.ttl(rph_key)
            raise RateLimitExceeded(provider, "requests_per_hour", max(ttl, 1))

        # Проверяем TPM
        if tokens > 0:
            tpm_key = self._key(provider, "tpm")
            tpm_count = await self.redis.get(tpm_key)
            if tpm_count and int(tpm_count) + tokens > config.tokens_per_minute:
                ttl = await self.redis.ttl(tpm_key)
                raise RateLimitExceeded(provider, "tokens_per_minute", max(ttl, 1))

        # Инкрементируем счётчики
        pipe = self.redis.pipeline()

        # RPM с TTL 60 секунд
        pipe.incr(rpm_key)
        pipe.expire(rpm_key, 60)

        # RPH с TTL 3600 секунд
        pipe.incr(rph_key)
        pipe.expire(rph_key, 3600)

        # TPM
        if tokens > 0:
            tpm_key = self._key(provider, "tpm")
            pipe.incrby(tpm_key, tokens)
            pipe.expire(tpm_key, 60)

        await pipe.execute()
        return True

    def _get_semaphore(self, provider: str, limit: int) -> asyncio.Semaphore:
        """Получить или создать семафор для провайдера"""
        if provider not in self._semaphores:
            self._semaphores[provider] = asyncio.Semaphore(limit)
        return self._semaphores[provider]

    async def acquire(self, provider: str, tokens: int = 0):
        """
        Получить разрешение на запрос (context manager)

        Usage:
            async with rate_limiter.acquire("openai", tokens=1000):
                response = await llm.invoke(...)
        """
        await self.check_and_increment(provider, tokens)
        semaphore = self._get_semaphore(
            provider,
            self.limits.get(provider, RateLimitConfig()).concurrent_requests
        )
        return _RateLimitContext(semaphore)

    async def get_usage(self, provider: str) -> dict:
        """Получить текущее использование"""
        config = self.limits.get(provider, RateLimitConfig())

        rpm = await self.redis.get(self._key(provider, "rpm")) or 0
        rph = await self.redis.get(self._key(provider, "rph")) or 0
        tpm = await self.redis.get(self._key(provider, "tpm")) or 0

        return {
            "requests_per_minute": {
                "current": int(rpm),
                "limit": config.requests_per_minute,
                "percent": int(rpm) / config.requests_per_minute * 100,
            },
            "requests_per_hour": {
                "current": int(rph),
                "limit": config.requests_per_hour,
                "percent": int(rph) / config.requests_per_hour * 100,
            },
            "tokens_per_minute": {
                "current": int(tpm),
                "limit": config.tokens_per_minute,
                "percent": int(tpm) / config.tokens_per_minute * 100,
            },
        }

    async def reset(self, provider: str):
        """Сбросить счётчики для провайдера"""
        await self.redis.delete(
            self._key(provider, "rpm"),
            self._key(provider, "rph"),
            self._key(provider, "tpm"),
        )

    def set_limits(self, provider: str, config: RateLimitConfig):
        """Установить кастомные лимиты"""
        self.limits[provider] = config

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


class _RateLimitContext:
    """Context manager для rate limiting"""

    def __init__(self, semaphore: asyncio.Semaphore):
        self.semaphore = semaphore

    async def __aenter__(self):
        await self.semaphore.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.semaphore.release()


class AdaptiveRateLimiter(RateLimiter):
    """
    Адаптивный rate limiter

    Автоматически подстраивается под реальные лимиты API
    на основе ответов с 429 ошибками
    """

    def __init__(self):
        super().__init__()
        self.backoff_multiplier: dict[str, float] = defaultdict(lambda: 1.0)

    async def handle_rate_limit_error(
        self,
        provider: str,
        retry_after: Optional[int] = None
    ):
        """Обработать ошибку rate limit от API"""
        # Увеличиваем backoff
        self.backoff_multiplier[provider] *= 1.5

        # Ждём
        wait_time = retry_after or int(60 * self.backoff_multiplier[provider])
        await asyncio.sleep(min(wait_time, 300))  # Max 5 минут

    def handle_success(self, provider: str):
        """Обработать успешный запрос"""
        # Постепенно снижаем backoff
        if self.backoff_multiplier[provider] > 1.0:
            self.backoff_multiplier[provider] *= 0.9
            if self.backoff_multiplier[provider] < 1.0:
                self.backoff_multiplier[provider] = 1.0

    def get_effective_limit(self, provider: str, base_limit: int) -> int:
        """Получить эффективный лимит с учётом backoff"""
        return int(base_limit / self.backoff_multiplier[provider])
