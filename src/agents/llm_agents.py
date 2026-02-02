"""
LLM-top: LLM Agents
Конкретные реализации агентов для каждой LLM
"""

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models import BaseChatModel

from src.agents.base import BaseAgent
from src.config import get_settings


def _create_proxy_llm(model: str) -> BaseChatModel:
    """Создать LLM через vsellm.ru прокси"""
    settings = get_settings()
    return ChatOpenAI(
        model=model,
        temperature=settings.temperature,
        max_tokens=settings.max_tokens,
        api_key=settings.llm_proxy_api_key,
        base_url=settings.llm_proxy_base_url,
    )


class ChatGPTAgent(BaseAgent):
    """Агент на базе ChatGPT - Логический аналитик"""

    def __init__(self):
        super().__init__("chatgpt")

    def _create_llm(self) -> BaseChatModel:
        settings = get_settings()
        if settings.llm_proxy_enabled:
            return _create_proxy_llm(settings.chatgpt_model)
        return ChatOpenAI(
            model=settings.chatgpt_model,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            api_key=settings.openai_api_key,
        )


class ClaudeAgent(BaseAgent):
    """Агент на базе Claude - Системный архитектор"""

    def __init__(self):
        super().__init__("claude")

    def _create_llm(self) -> BaseChatModel:
        settings = get_settings()
        if settings.llm_proxy_enabled:
            return _create_proxy_llm(settings.claude_model)
        return ChatAnthropic(
            model=settings.claude_model,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            api_key=settings.anthropic_api_key,
        )


class GeminiAgent(BaseAgent):
    """Агент на базе Gemini - Генератор альтернатив"""

    def __init__(self):
        super().__init__("gemini")

    def _create_llm(self) -> BaseChatModel:
        settings = get_settings()
        if settings.llm_proxy_enabled:
            return _create_proxy_llm(settings.gemini_model)
        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            temperature=settings.temperature,
            max_output_tokens=settings.max_tokens,
            google_api_key=settings.google_api_key,
        )


class DeepSeekAgent(BaseAgent):
    """Агент на базе DeepSeek - Формальный аналитик"""

    def __init__(self):
        super().__init__("deepseek")

    def _create_llm(self) -> BaseChatModel:
        settings = get_settings()
        if settings.llm_proxy_enabled:
            return _create_proxy_llm(settings.deepseek_model)
        # DeepSeek использует OpenAI-совместимый API
        return ChatOpenAI(
            model=settings.deepseek_model,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com/v1",
        )


def create_all_agents() -> dict[str, BaseAgent]:
    """Создать все агенты"""
    return {
        "chatgpt": ChatGPTAgent(),
        "claude": ClaudeAgent(),
        "gemini": GeminiAgent(),
        "deepseek": DeepSeekAgent(),
    }
