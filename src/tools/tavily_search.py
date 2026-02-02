"""
LLM-top: Tavily Search Integration
Поиск актуальной информации через Tavily API (альтернатива Perplexity)
"""

import httpx
from typing import Optional
from pydantic import BaseModel
from src.config import get_settings


class TavilySearchResult(BaseModel):
    """Результат поиска Tavily"""
    title: str
    url: str
    content: str
    score: float
    published_date: Optional[str] = None


class TavilySearchResponse(BaseModel):
    """Ответ от Tavily API"""
    query: str
    results: list[TavilySearchResult]
    answer: Optional[str] = None  # AI-generated answer
    follow_up_questions: list[str] = []


class TavilySearch:
    """
    Клиент для Tavily Search API.

    Tavily — специализированный поисковик для AI-агентов.
    Преимущества перед обычным поиском:
    - Оптимизирован для LLM (чистый контент без мусора)
    - Может генерировать ответ на основе результатов
    - Поддерживает фильтрацию по типу контента
    - Быстрее и дешевле чем Perplexity API

    Цены (на 2024):
    - Free: 1000 запросов/месяц
    - Basic: $20/месяц за 10K запросов
    """

    BASE_URL = "https://api.tavily.com"

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.tavily_api_key
        self.enabled = settings.tavily_enabled and bool(self.api_key)

    async def search(
        self,
        query: str,
        search_depth: str = "advanced",  # "basic" или "advanced"
        include_answer: bool = True,
        include_domains: list[str] = None,
        exclude_domains: list[str] = None,
        max_results: int = 5,
    ) -> TavilySearchResponse:
        """
        Поиск информации через Tavily.

        Args:
            query: Поисковый запрос
            search_depth: "basic" (быстрый) или "advanced" (глубокий)
            include_answer: Генерировать AI-ответ
            include_domains: Только эти домены
            exclude_domains: Исключить домены
            max_results: Максимум результатов (1-10)

        Returns:
            TavilySearchResponse с результатами
        """
        if not self.enabled:
            return TavilySearchResponse(
                query=query,
                results=[],
                answer="Tavily API не настроен. Добавьте TAVILY_API_KEY в .env",
            )

        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": include_answer,
            "max_results": min(max_results, 10),
        }

        if include_domains:
            payload["include_domains"] = include_domains
        if exclude_domains:
            payload["exclude_domains"] = exclude_domains

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/search",
                json=payload,
                timeout=30.0,
            )

            if response.status_code != 200:
                return TavilySearchResponse(
                    query=query,
                    results=[],
                    answer=f"Ошибка Tavily API: {response.status_code} - {response.text}",
                )

            data = response.json()

            results = [
                TavilySearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    content=r.get("content", ""),
                    score=r.get("score", 0.0),
                    published_date=r.get("published_date"),
                )
                for r in data.get("results", [])
            ]

            return TavilySearchResponse(
                query=query,
                results=results,
                answer=data.get("answer"),
                follow_up_questions=data.get("follow_up_questions", []),
            )

    async def search_news(
        self,
        query: str,
        days: int = 7,
        max_results: int = 5,
    ) -> TavilySearchResponse:
        """
        Поиск новостей за последние N дней.

        Args:
            query: Поисковый запрос
            days: За сколько дней искать (1-30)
            max_results: Максимум результатов

        Returns:
            TavilySearchResponse с новостями
        """
        # Добавляем временной фильтр к запросу
        time_query = f"{query} (за последние {days} дней)"

        return await self.search(
            query=time_query,
            search_depth="advanced",
            include_answer=True,
            max_results=max_results,
        )

    async def verify_fact(
        self,
        statement: str,
        context: str = "",
    ) -> dict:
        """
        Проверить факт/утверждение на актуальность.

        Args:
            statement: Утверждение для проверки
            context: Дополнительный контекст

        Returns:
            dict с результатами верификации
        """
        query = f"Проверить факт: {statement}"
        if context:
            query += f" (контекст: {context})"

        result = await self.search(
            query=query,
            search_depth="advanced",
            include_answer=True,
            max_results=5,
        )

        # Анализируем результаты
        sources_confirm = 0
        sources_deny = 0
        sources_unclear = 0

        for r in result.results:
            content_lower = r.content.lower()
            statement_lower = statement.lower()

            # Простая эвристика (в production использовать LLM)
            if any(word in content_lower for word in ["подтверждает", "верно", "правда", "действительно"]):
                sources_confirm += 1
            elif any(word in content_lower for word in ["опровергает", "неверно", "ложь", "устарело"]):
                sources_deny += 1
            else:
                sources_unclear += 1

        total = len(result.results)
        confidence = sources_confirm / total if total > 0 else 0

        return {
            "statement": statement,
            "verified": confidence > 0.5,
            "confidence": confidence,
            "sources_confirm": sources_confirm,
            "sources_deny": sources_deny,
            "sources_unclear": sources_unclear,
            "answer": result.answer,
            "sources": [
                {"title": r.title, "url": r.url, "date": r.published_date}
                for r in result.results
            ],
        }

    def format_results_for_context(self, response: TavilySearchResponse) -> str:
        """
        Форматировать результаты для добавления в контекст LLM.

        Args:
            response: Ответ от Tavily

        Returns:
            Форматированная строка для контекста
        """
        parts = [f"## Результаты поиска: {response.query}\n"]

        if response.answer:
            parts.append(f"### AI Summary\n{response.answer}\n")

        parts.append("### Источники\n")
        for i, r in enumerate(response.results, 1):
            date_str = f" ({r.published_date})" if r.published_date else ""
            parts.append(f"""**{i}. {r.title}**{date_str}
URL: {r.url}
{r.content[:500]}...

""")

        if response.follow_up_questions:
            parts.append("### Связанные вопросы\n")
            for q in response.follow_up_questions:
                parts.append(f"- {q}\n")

        return "".join(parts)
