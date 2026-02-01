"""
Cosilium-LLM: Webhooks
Уведомления о завершении анализа
"""

import asyncio
import hashlib
import hmac
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, HttpUrl
import httpx
import redis.asyncio as redis

from src.config import get_settings


class WebhookConfig(BaseModel):
    """Конфигурация webhook"""
    id: str
    url: HttpUrl
    secret: Optional[str] = None  # Для подписи payload
    events: list[str] = ["analysis.completed"]  # Типы событий
    active: bool = True
    created_at: datetime = datetime.utcnow()
    last_triggered: Optional[datetime] = None
    failure_count: int = 0


class WebhookPayload(BaseModel):
    """Payload для webhook"""
    event: str
    timestamp: datetime
    task_id: str
    data: dict


class WebhookDelivery(BaseModel):
    """Результат доставки webhook"""
    webhook_id: str
    payload: WebhookPayload
    status_code: int
    response_body: Optional[str] = None
    success: bool
    duration_ms: int
    timestamp: datetime = datetime.utcnow()


class WebhookManager:
    """
    Менеджер webhooks

    Функции:
    - Регистрация/удаление webhooks
    - Доставка уведомлений
    - Retry при ошибках
    - Подпись payload
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:webhooks:"
        self.max_retries = 3
        self.retry_delays = [10, 60, 300]  # секунды

    async def register_webhook(
        self,
        url: str,
        secret: Optional[str] = None,
        events: list[str] = None
    ) -> WebhookConfig:
        """Зарегистрировать webhook"""
        webhook_id = hashlib.md5(f"{url}{datetime.utcnow()}".encode()).hexdigest()[:12]

        config = WebhookConfig(
            id=webhook_id,
            url=url,
            secret=secret,
            events=events or ["analysis.completed"],
        )

        await self.redis.set(
            f"{self.prefix}config:{webhook_id}",
            config.model_dump_json()
        )

        # Добавляем в индекс по событиям
        for event in config.events:
            await self.redis.sadd(f"{self.prefix}events:{event}", webhook_id)

        return config

    async def delete_webhook(self, webhook_id: str) -> bool:
        """Удалить webhook"""
        config = await self.get_webhook(webhook_id)
        if not config:
            return False

        # Удаляем из индексов событий
        for event in config.events:
            await self.redis.srem(f"{self.prefix}events:{event}", webhook_id)

        # Удаляем конфигурацию
        await self.redis.delete(f"{self.prefix}config:{webhook_id}")

        return True

    async def get_webhook(self, webhook_id: str) -> Optional[WebhookConfig]:
        """Получить webhook"""
        data = await self.redis.get(f"{self.prefix}config:{webhook_id}")
        if data:
            return WebhookConfig.model_validate_json(data)
        return None

    async def list_webhooks(self) -> list[WebhookConfig]:
        """Список всех webhooks"""
        webhooks = []
        pattern = f"{self.prefix}config:*"

        async for key in self.redis.scan_iter(match=pattern):
            data = await self.redis.get(key)
            if data:
                webhooks.append(WebhookConfig.model_validate_json(data))

        return webhooks

    async def trigger_event(
        self,
        event: str,
        task_id: str,
        data: dict
    ):
        """
        Триггер события (отправка всем подписанным webhooks)
        """
        # Получаем webhooks для этого события
        webhook_ids = await self.redis.smembers(f"{self.prefix}events:{event}")

        if not webhook_ids:
            return

        payload = WebhookPayload(
            event=event,
            timestamp=datetime.utcnow(),
            task_id=task_id,
            data=data,
        )

        # Отправляем параллельно
        tasks = []
        for webhook_id in webhook_ids:
            webhook_id = webhook_id.decode() if isinstance(webhook_id, bytes) else webhook_id
            tasks.append(self._deliver_webhook(webhook_id, payload))

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_webhook(
        self,
        webhook_id: str,
        payload: WebhookPayload,
        retry: int = 0
    ) -> WebhookDelivery:
        """Доставить webhook"""
        config = await self.get_webhook(webhook_id)
        if not config or not config.active:
            return None

        headers = {
            "Content-Type": "application/json",
            "X-Cosilium-Event": payload.event,
            "X-Cosilium-Delivery": hashlib.md5(
                f"{webhook_id}{payload.timestamp}".encode()
            ).hexdigest(),
        }

        # Подпись если есть secret
        if config.secret:
            signature = self._sign_payload(payload.model_dump_json(), config.secret)
            headers["X-Cosilium-Signature"] = signature

        start_time = datetime.utcnow()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    str(config.url),
                    json=payload.model_dump(),
                    headers=headers,
                    timeout=30.0,
                )

            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            success = 200 <= response.status_code < 300

            delivery = WebhookDelivery(
                webhook_id=webhook_id,
                payload=payload,
                status_code=response.status_code,
                response_body=response.text[:1000] if response.text else None,
                success=success,
                duration_ms=duration_ms,
            )

            # Обновляем статистику
            if success:
                config.last_triggered = datetime.utcnow()
                config.failure_count = 0
            else:
                config.failure_count += 1

            await self._save_config(config)

            # Сохраняем лог доставки
            await self._log_delivery(delivery)

            # Retry если неуспешно
            if not success and retry < self.max_retries:
                delay = self.retry_delays[retry]
                await asyncio.sleep(delay)
                return await self._deliver_webhook(webhook_id, payload, retry + 1)

            return delivery

        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            delivery = WebhookDelivery(
                webhook_id=webhook_id,
                payload=payload,
                status_code=0,
                response_body=str(e),
                success=False,
                duration_ms=duration_ms,
            )

            config.failure_count += 1
            await self._save_config(config)
            await self._log_delivery(delivery)

            # Деактивируем после многих ошибок
            if config.failure_count >= 10:
                config.active = False
                await self._save_config(config)

            # Retry
            if retry < self.max_retries:
                delay = self.retry_delays[retry]
                await asyncio.sleep(delay)
                return await self._deliver_webhook(webhook_id, payload, retry + 1)

            return delivery

    def _sign_payload(self, payload: str, secret: str) -> str:
        """Подписать payload"""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    async def _save_config(self, config: WebhookConfig):
        """Сохранить конфигурацию"""
        await self.redis.set(
            f"{self.prefix}config:{config.id}",
            config.model_dump_json()
        )

    async def _log_delivery(self, delivery: WebhookDelivery):
        """Логировать доставку"""
        key = f"{self.prefix}log:{delivery.webhook_id}"
        await self.redis.lpush(key, delivery.model_dump_json())
        await self.redis.ltrim(key, 0, 99)  # Храним последние 100
        await self.redis.expire(key, 86400 * 7)  # 7 дней

    async def get_delivery_log(
        self,
        webhook_id: str,
        limit: int = 10
    ) -> list[WebhookDelivery]:
        """Получить лог доставок"""
        key = f"{self.prefix}log:{webhook_id}"
        items = await self.redis.lrange(key, 0, limit - 1)
        return [WebhookDelivery.model_validate_json(item) for item in items]

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


# События
class WebhookEvents:
    """Типы событий для webhooks"""
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"
    ITERATION_COMPLETED = "iteration.completed"
