"""
LLM-top: Prompt Loader
Загрузка промптов из базы данных Supabase
"""

from typing import Optional
from functools import lru_cache
from supabase import create_client, Client

from src.config import get_settings


class PromptLoader:
    """Загрузчик промптов из таблицы rag_prompts"""

    def __init__(self):
        settings = get_settings()
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
        self._cache: dict[str, str] = {}

    def get_prompt(
        self,
        agent_name: str,
        prompt_type: str,
        use_cache: bool = True
    ) -> Optional[str]:
        """
        Получить промпт для агента из БД.

        Args:
            agent_name: chatgpt, claude, gemini, deepseek
            prompt_type: system, analysis, critique, synthesis, verification

        Returns:
            Текст промпта или None
        """
        cache_key = f"{agent_name}:{prompt_type}"

        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            result = self.client.table("rag_prompts")\
                .select("content")\
                .eq("agent_name", agent_name)\
                .eq("prompt_type", prompt_type)\
                .eq("is_active", True)\
                .order("version", desc=True)\
                .limit(1)\
                .execute()

            if result.data:
                content = result.data[0]["content"]
                self._cache[cache_key] = content
                return content
        except Exception as e:
            print(f"Error loading prompt {cache_key}: {e}")

        return None

    def get_all_prompts(self, agent_name: str) -> dict[str, str]:
        """Получить все промпты для агента"""
        try:
            result = self.client.table("rag_prompts")\
                .select("prompt_type, content")\
                .eq("agent_name", agent_name)\
                .eq("is_active", True)\
                .execute()

            prompts = {}
            for row in result.data:
                prompts[row["prompt_type"]] = row["content"]
            return prompts
        except Exception as e:
            print(f"Error loading prompts for {agent_name}: {e}")
            return {}

    def clear_cache(self):
        """Очистить кэш промптов"""
        self._cache.clear()

    def increment_usage(self, agent_name: str, prompt_type: str):
        """Увеличить счётчик использования промпта"""
        try:
            self.client.rpc("increment_prompt_usage", {
                "p_agent": agent_name,
                "p_type": prompt_type
            }).execute()
        except Exception:
            pass  # Не критично


@lru_cache
def get_prompt_loader() -> PromptLoader:
    """Получить singleton экземпляр загрузчика промптов"""
    return PromptLoader()
