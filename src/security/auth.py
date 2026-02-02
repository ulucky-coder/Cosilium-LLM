"""
LLM-top: Authentication
JWT и API Key аутентификация
"""

import hashlib
import secrets
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext
import redis.asyncio as redis

from src.config import get_settings


class User(BaseModel):
    """Пользователь"""
    id: str
    email: str
    hashed_password: str
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime = datetime.utcnow()
    api_keys: list[str] = []


class TokenData(BaseModel):
    """Данные токена"""
    user_id: str
    email: Optional[str] = None
    scopes: list[str] = []
    exp: datetime


class APIKey(BaseModel):
    """API ключ"""
    key_hash: str
    user_id: str
    name: str
    scopes: list[str] = ["analyze"]
    created_at: datetime = datetime.utcnow()
    last_used: Optional[datetime] = None
    is_active: bool = True


class JWTAuth:
    """
    JWT аутентификация

    Функции:
    - Создание access/refresh токенов
    - Валидация токенов
    - Refresh flow
    """

    def __init__(self):
        settings = get_settings()
        self.secret_key = getattr(settings, 'jwt_secret_key', 'dev-secret-key-change-in-production')
        self.algorithm = "HS256"
        self.access_token_expire = timedelta(minutes=30)
        self.refresh_token_expire = timedelta(days=7)
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def create_access_token(
        self,
        user_id: str,
        email: str,
        scopes: list[str] = None
    ) -> str:
        """Создать access token"""
        expires = datetime.utcnow() + self.access_token_expire

        payload = {
            "sub": user_id,
            "email": email,
            "scopes": scopes or [],
            "exp": expires,
            "type": "access",
        }

        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, user_id: str) -> str:
        """Создать refresh token"""
        expires = datetime.utcnow() + self.refresh_token_expire

        payload = {
            "sub": user_id,
            "exp": expires,
            "type": "refresh",
        }

        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str, token_type: str = "access") -> Optional[TokenData]:
        """
        Верифицировать токен

        Returns:
            TokenData если валидный, None если нет
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            if payload.get("type") != token_type:
                return None

            return TokenData(
                user_id=payload["sub"],
                email=payload.get("email"),
                scopes=payload.get("scopes", []),
                exp=datetime.fromtimestamp(payload["exp"]),
            )

        except JWTError:
            return None

    def hash_password(self, password: str) -> str:
        """Хэшировать пароль"""
        return self.pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Проверить пароль"""
        return self.pwd_context.verify(plain_password, hashed_password)


class APIKeyAuth:
    """
    API Key аутентификация

    Функции:
    - Генерация ключей
    - Валидация
    - Управление scopes
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:apikeys:"

    def generate_key(self) -> tuple[str, str]:
        """
        Сгенерировать API ключ

        Returns:
            (plain_key, key_hash)
            plain_key показывается пользователю один раз
        """
        # Генерируем случайный ключ
        plain_key = f"csl_{secrets.token_urlsafe(32)}"

        # Хэшируем для хранения
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()

        return plain_key, key_hash

    async def create_key(
        self,
        user_id: str,
        name: str,
        scopes: list[str] = None
    ) -> tuple[str, APIKey]:
        """
        Создать новый API ключ

        Returns:
            (plain_key, api_key_object)
        """
        plain_key, key_hash = self.generate_key()

        api_key = APIKey(
            key_hash=key_hash,
            user_id=user_id,
            name=name,
            scopes=scopes or ["analyze"],
        )

        # Сохраняем
        await self.redis.set(
            f"{self.prefix}{key_hash}",
            api_key.model_dump_json()
        )

        # Добавляем в список ключей пользователя
        await self.redis.sadd(f"{self.prefix}user:{user_id}", key_hash)

        return plain_key, api_key

    async def verify_key(self, plain_key: str) -> Optional[APIKey]:
        """
        Верифицировать API ключ

        Returns:
            APIKey если валидный, None если нет
        """
        if not plain_key.startswith("csl_"):
            return None

        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()

        data = await self.redis.get(f"{self.prefix}{key_hash}")
        if not data:
            return None

        api_key = APIKey.model_validate_json(data)

        if not api_key.is_active:
            return None

        # Обновляем last_used
        api_key.last_used = datetime.utcnow()
        await self.redis.set(
            f"{self.prefix}{key_hash}",
            api_key.model_dump_json()
        )

        return api_key

    async def revoke_key(self, key_hash: str) -> bool:
        """Отозвать ключ"""
        data = await self.redis.get(f"{self.prefix}{key_hash}")
        if not data:
            return False

        api_key = APIKey.model_validate_json(data)
        api_key.is_active = False

        await self.redis.set(
            f"{self.prefix}{key_hash}",
            api_key.model_dump_json()
        )

        return True

    async def list_user_keys(self, user_id: str) -> list[APIKey]:
        """Список ключей пользователя"""
        key_hashes = await self.redis.smembers(f"{self.prefix}user:{user_id}")

        keys = []
        for key_hash in key_hashes:
            key_hash = key_hash.decode() if isinstance(key_hash, bytes) else key_hash
            data = await self.redis.get(f"{self.prefix}{key_hash}")
            if data:
                keys.append(APIKey.model_validate_json(data))

        return keys

    def has_scope(self, api_key: APIKey, required_scope: str) -> bool:
        """Проверить наличие scope"""
        return required_scope in api_key.scopes or "admin" in api_key.scopes

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


# Scopes
class Scopes:
    """Доступные scopes"""
    ANALYZE = "analyze"
    ADMIN = "admin"
    FEEDBACK = "feedback"
    WEBHOOKS = "webhooks"
    METRICS = "metrics"
