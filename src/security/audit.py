"""
Cosilium-LLM: Audit Logger
Логирование всех действий для безопасности и compliance
"""

import json
from typing import Optional, Any
from datetime import datetime, date, timedelta
from enum import Enum
from pydantic import BaseModel, Field
import redis.asyncio as redis

from src.config import get_settings


class AuditAction(str, Enum):
    """Типы действий для аудита"""
    # Аутентификация
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    TOKEN_REFRESH = "auth.token_refresh"
    API_KEY_CREATED = "auth.api_key_created"
    API_KEY_REVOKED = "auth.api_key_revoked"

    # Анализ
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"

    # Данные
    DATA_ACCESSED = "data.accessed"
    DATA_EXPORTED = "data.exported"
    DATA_DELETED = "data.deleted"

    # Администрирование
    SETTINGS_CHANGED = "admin.settings_changed"
    USER_CREATED = "admin.user_created"
    USER_DELETED = "admin.user_deleted"
    PERMISSIONS_CHANGED = "admin.permissions_changed"

    # Безопасность
    SUSPICIOUS_ACTIVITY = "security.suspicious"
    RATE_LIMIT_EXCEEDED = "security.rate_limit"
    BLOCKED_REQUEST = "security.blocked"


class AuditLog(BaseModel):
    """Запись аудит-лога"""
    id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action: AuditAction
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Детали действия
    resource_type: Optional[str] = None  # task, user, webhook, etc.
    resource_id: Optional[str] = None
    details: dict = {}

    # Результат
    success: bool = True
    error_message: Optional[str] = None

    # Метаданные
    request_id: Optional[str] = None
    session_id: Optional[str] = None


class AuditLogger:
    """
    Аудит логгер

    Функции:
    - Логирование всех значимых действий
    - Поиск по логам
    - Retention policy
    - Экспорт для compliance
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:audit:"
        self.retention_days = 90  # Хранить 90 дней

    async def log(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: dict = None,
        success: bool = True,
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> str:
        """
        Записать событие в аудит-лог

        Returns:
            log_id
        """
        import hashlib

        log_id = hashlib.md5(
            f"{action}{datetime.utcnow()}{user_id}".encode()
        ).hexdigest()[:16]

        log = AuditLog(
            id=log_id,
            action=action,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            success=success,
            error_message=error_message,
            request_id=request_id,
        )

        # Сохраняем по дате
        today = date.today().isoformat()
        key = f"{self.prefix}daily:{today}"

        await self.redis.rpush(key, log.model_dump_json())
        await self.redis.expire(key, 86400 * self.retention_days)

        # Индекс по пользователю
        if user_id:
            user_key = f"{self.prefix}user:{user_id}"
            await self.redis.rpush(user_key, log.model_dump_json())
            await self.redis.ltrim(user_key, -1000, -1)  # Последние 1000
            await self.redis.expire(user_key, 86400 * self.retention_days)

        # Индекс по действию
        action_key = f"{self.prefix}action:{action.value}:{today}"
        await self.redis.rpush(action_key, log.model_dump_json())
        await self.redis.expire(action_key, 86400 * self.retention_days)

        # Алерты для критических событий
        if action in [
            AuditAction.SUSPICIOUS_ACTIVITY,
            AuditAction.BLOCKED_REQUEST,
            AuditAction.LOGIN_FAILED,
        ]:
            await self._trigger_security_alert(log)

        return log_id

    async def _trigger_security_alert(self, log: AuditLog):
        """Триггер алерта безопасности"""
        alert_key = f"{self.prefix}alerts"
        await self.redis.rpush(alert_key, log.model_dump_json())
        await self.redis.ltrim(alert_key, -100, -1)  # Последние 100 алертов

    async def get_logs(
        self,
        day: Optional[date] = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[AuditLog]:
        """Получить логи за день"""
        day = day or date.today()
        key = f"{self.prefix}daily:{day.isoformat()}"

        items = await self.redis.lrange(key, offset, offset + limit - 1)
        return [AuditLog.model_validate_json(item) for item in items]

    async def get_user_logs(
        self,
        user_id: str,
        limit: int = 100
    ) -> list[AuditLog]:
        """Получить логи пользователя"""
        key = f"{self.prefix}user:{user_id}"
        items = await self.redis.lrange(key, -limit, -1)
        return [AuditLog.model_validate_json(item) for item in reversed(items)]

    async def get_action_logs(
        self,
        action: AuditAction,
        day: Optional[date] = None,
        limit: int = 100
    ) -> list[AuditLog]:
        """Получить логи по типу действия"""
        day = day or date.today()
        key = f"{self.prefix}action:{action.value}:{day.isoformat()}"
        items = await self.redis.lrange(key, 0, limit - 1)
        return [AuditLog.model_validate_json(item) for item in items]

    async def get_security_alerts(self, limit: int = 50) -> list[AuditLog]:
        """Получить последние алерты безопасности"""
        key = f"{self.prefix}alerts"
        items = await self.redis.lrange(key, -limit, -1)
        return [AuditLog.model_validate_json(item) for item in reversed(items)]

    async def search_logs(
        self,
        start_date: date,
        end_date: date,
        user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        success: Optional[bool] = None,
    ) -> list[AuditLog]:
        """
        Поиск по логам

        Простой поиск - для production лучше использовать ElasticSearch
        """
        results = []
        current = start_date

        while current <= end_date:
            logs = await self.get_logs(current, limit=10000)

            for log in logs:
                if user_id and log.user_id != user_id:
                    continue
                if action and log.action != action:
                    continue
                if success is not None and log.success != success:
                    continue

                results.append(log)

            current += timedelta(days=1)

        return results

    async def export_logs(
        self,
        start_date: date,
        end_date: date,
        format: str = "json"
    ) -> str:
        """
        Экспорт логов для compliance

        Returns:
            JSON или CSV строка
        """
        logs = await self.search_logs(start_date, end_date)

        if format == "json":
            return json.dumps(
                [log.model_dump() for log in logs],
                default=str,
                indent=2
            )
        elif format == "csv":
            lines = [
                "timestamp,action,user_id,resource_type,resource_id,success,ip_address"
            ]
            for log in logs:
                lines.append(
                    f"{log.timestamp},{log.action.value},{log.user_id or ''},"
                    f"{log.resource_type or ''},{log.resource_id or ''},"
                    f"{log.success},{log.ip_address or ''}"
                )
            return "\n".join(lines)
        else:
            raise ValueError(f"Unknown format: {format}")

    async def get_stats(self, days: int = 7) -> dict:
        """Статистика по аудит-логам"""
        stats = {
            "total_events": 0,
            "by_action": {},
            "by_user": {},
            "failed_events": 0,
            "security_alerts": 0,
        }

        for i in range(days):
            day = date.today() - timedelta(days=i)
            logs = await self.get_logs(day, limit=10000)

            stats["total_events"] += len(logs)

            for log in logs:
                # По действиям
                action_key = log.action.value
                stats["by_action"][action_key] = stats["by_action"].get(action_key, 0) + 1

                # По пользователям
                if log.user_id:
                    stats["by_user"][log.user_id] = stats["by_user"].get(log.user_id, 0) + 1

                # Ошибки
                if not log.success:
                    stats["failed_events"] += 1

                # Алерты
                if log.action in [
                    AuditAction.SUSPICIOUS_ACTIVITY,
                    AuditAction.BLOCKED_REQUEST,
                ]:
                    stats["security_alerts"] += 1

        return stats

    async def cleanup_old_logs(self) -> int:
        """Очистить старые логи (Redis делает по TTL, но можно форсировать)"""
        # Redis автоматически удаляет по TTL
        return 0

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()
