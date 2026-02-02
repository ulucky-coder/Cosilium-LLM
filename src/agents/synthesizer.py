"""
LLM-top: Synthesizer
Компонент для синтеза результатов всех агентов
"""

import re
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from src.models.state import AgentAnalysis, AgentCritique, SynthesisResult
from src.prompts.agent_prompts import get_synthesis_prompt
from src.config import get_settings


class Synthesizer:
    """Синтезатор результатов анализа"""

    def __init__(self):
        settings = get_settings()
        # Используем Claude как главного интегратора
        self.llm = ChatAnthropic(
            model=settings.claude_model,
            temperature=0.5,  # Меньше креативности для синтеза
            max_tokens=settings.max_tokens,
            api_key=settings.anthropic_api_key,
        )

    async def synthesize(
        self,
        task: str,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique],
    ) -> SynthesisResult:
        """Синтезировать результаты в единый отчёт"""

        # Форматируем анализы
        analyses_text = self._format_analyses(analyses)
        critiques_text = self._format_critiques(critiques)

        system_prompt, user_prompt = get_synthesis_prompt(
            task, analyses_text, critiques_text
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        response = await self.llm.ainvoke(messages)
        content = response.content

        return SynthesisResult(
            summary=self._extract_summary(content),
            conclusions=self._extract_conclusions(content),
            recommendations=self._extract_recommendations(content),
            formalized_result=self._extract_formalized(content),
            consensus_level=self._calculate_consensus(critiques),
            dissenting_opinions=self._extract_dissenting(content),
        )

    def _format_analyses(self, analyses: list[AgentAnalysis]) -> str:
        """Форматировать анализы для промпта"""
        result = []
        for a in analyses:
            result.append(f"### {a.agent_name} (уверенность: {a.confidence:.0%})\n")
            result.append(a.analysis)
            result.append("\n---\n")
        return "\n".join(result)

    def _format_critiques(self, critiques: list[AgentCritique]) -> str:
        """Форматировать критики для промпта"""
        result = []
        for c in critiques:
            result.append(f"### {c.critic_name} -> {c.target_name} (оценка: {c.score}/10)\n")
            result.append(c.critique)
            result.append("\n---\n")
        return "\n".join(result)

    def _extract_summary(self, text: str) -> str:
        """Извлечь резюме"""
        match = re.search(r"##\s*Резюме\s*\n(.*?)(?=\n##|\Z)", text, re.DOTALL)
        return match.group(1).strip() if match else text[:500]

    def _extract_conclusions(self, text: str) -> list[dict]:
        """Извлечь выводы из таблицы"""
        conclusions = []
        # Ищем таблицу выводов
        table_match = re.search(
            r"##\s*Таблица выводов\s*\n\|.*\n\|[-|]+\n((?:\|.*\n)+)",
            text,
            re.IGNORECASE
        )
        if table_match:
            rows = table_match.group(1).strip().split("\n")
            for row in rows:
                cells = [c.strip() for c in row.split("|")[1:-1]]
                if len(cells) >= 3:
                    conclusions.append({
                        "conclusion": cells[0],
                        "probability": cells[1],
                        "falsification_condition": cells[2] if len(cells) > 2 else "",
                    })
        return conclusions

    def _extract_recommendations(self, text: str) -> list[dict]:
        """Извлечь рекомендации из таблицы"""
        recommendations = []
        table_match = re.search(
            r"##\s*Рекомендации\s*\n\|.*\n\|[-|]+\n((?:\|.*\n)+)",
            text,
            re.IGNORECASE
        )
        if table_match:
            rows = table_match.group(1).strip().split("\n")
            for row in rows:
                cells = [c.strip() for c in row.split("|")[1:-1]]
                if len(cells) >= 3:
                    recommendations.append({
                        "recommendation": cells[0],
                        "pros": cells[1] if len(cells) > 1 else "",
                        "cons": cells[2] if len(cells) > 2 else "",
                    })
        return recommendations

    def _extract_formalized(self, text: str) -> str:
        """Извлечь формализованный итог"""
        match = re.search(
            r"##\s*Формализованный итог\s*\n(.*?)(?=\n##|\Z)",
            text,
            re.DOTALL | re.IGNORECASE
        )
        return match.group(1).strip() if match else ""

    def _extract_dissenting(self, text: str) -> list[str]:
        """Извлечь разногласия"""
        match = re.search(
            r"##\s*Разногласия\s*\n(.*?)(?=\n##|\Z)",
            text,
            re.DOTALL | re.IGNORECASE
        )
        if match:
            items = re.findall(r"[-*]\s*(.+)", match.group(1))
            return [item.strip() for item in items]
        return []

    def _calculate_consensus(self, critiques: list[AgentCritique]) -> float:
        """Рассчитать уровень консенсуса на основе оценок"""
        if not critiques:
            return 0.5
        avg_score = sum(c.score for c in critiques) / len(critiques)
        # Нормализуем к 0-1
        return avg_score / 10
