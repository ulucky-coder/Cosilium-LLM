"""
Cosilium-LLM: Configuration
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Настройки приложения"""

    # API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    deepseek_api_key: str = ""

    # Model settings
    chatgpt_model: str = "gpt-4-turbo-preview"
    claude_model: str = "claude-3-opus-20240229"
    gemini_model: str = "gemini-pro"
    deepseek_model: str = "deepseek-chat"

    # LLM parameters
    temperature: float = 0.7
    max_tokens: int = 4096

    # Database
    database_url: str = "postgresql://localhost:5432/cosilium"
    redis_url: str = "redis://localhost:6379"

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # LangSmith (для мониторинга)
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "cosilium-llm"

    # Security
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"

    # Telegram Bot
    telegram_bot_token: str = ""

    # Budgets
    daily_budget_usd: float = 50.0
    monthly_budget_usd: float = 500.0

    # Feature flags
    enable_rag: bool = True
    enable_thinking_patterns: bool = True
    enable_prompt_evolution: bool = True
    enable_caching: bool = True
    enable_webhooks: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Agent configurations
AGENT_CONFIGS = {
    "chatgpt": {
        "name": "ChatGPT",
        "role": "Логический аналитик",
        "focus": "Логика, противоречия, когнитивные искажения",
        "strengths": ["Логический анализ", "Выявление противоречий", "Структурирование"],
    },
    "claude": {
        "name": "Claude",
        "role": "Системный архитектор",
        "focus": "Методология, интеграция, финальная редакция",
        "strengths": ["Методология", "Синтез", "Нюансы"],
    },
    "gemini": {
        "name": "Gemini",
        "role": "Генератор альтернатив",
        "focus": "Гипотезы, сценарии, cross-domain аналогии",
        "strengths": ["Креативность", "Альтернативы", "Аналогии"],
    },
    "deepseek": {
        "name": "DeepSeek",
        "role": "Формальный аналитик",
        "focus": "Данные, модели, математика, технический аудит",
        "strengths": ["Математика", "Формализация", "Технический анализ"],
    },
}

# Критерии качества для adversarial mode
QUALITY_CRITERIA = [
    "Логическая непротиворечивость",
    "Полнота анализа",
    "Обоснованность выводов",
    "Учёт рисков",
    "Практическая применимость",
    "Фальсифицируемость выводов",
    "Количественная оценка",
    "Учёт альтернатив",
    "Временной горизонт",
    "Когнитивные искажения",
]
