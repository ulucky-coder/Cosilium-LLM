"""
Cosilium-LLM: Base Agent
Базовый класс агента
"""

import re
from abc import ABC, abstractmethod
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.language_models import BaseChatModel

from src.models.state import AgentAnalysis, AgentCritique
from src.prompts.agent_prompts import get_analysis_prompt, get_critique_prompt
from src.config import AGENT_CONFIGS


class BaseAgent(ABC):
    """Базовый класс для всех агентов"""

    def __init__(self, agent_type: str):
        self.agent_type = agent_type
        self.config = AGENT_CONFIGS[agent_type]
        self.name = self.config["name"]
        self.llm = self._create_llm()

    @abstractmethod
    def _create_llm(self) -> BaseChatModel:
        """Создать LLM для агента"""
        pass

    async def analyze(self, task: str, task_type: str, context: str) -> AgentAnalysis:
        """Провести анализ задачи"""
        system_prompt, user_prompt = get_analysis_prompt(
            self.config, task, task_type, context
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        response = await self.llm.ainvoke(messages)
        content = response.content

        # Парсинг ответа
        return AgentAnalysis(
            agent_name=self.name,
            analysis=content,
            confidence=self._extract_confidence(content),
            key_points=self._extract_key_points(content),
            risks=self._extract_risks(content),
            assumptions=self._extract_assumptions(content),
        )

    async def critique(self, task: str, target_name: str, analysis: str) -> AgentCritique:
        """Критиковать анализ другого агента"""
        system_prompt, user_prompt = get_critique_prompt(
            self.config, task, target_name, analysis
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        response = await self.llm.ainvoke(messages)
        content = response.content

        return AgentCritique(
            critic_name=self.name,
            target_name=target_name,
            critique=content,
            score=self._extract_score(content),
            weaknesses=self._extract_weaknesses(content),
            strengths=self._extract_strengths(content),
            suggestions=self._extract_suggestions(content),
        )

    def _extract_confidence(self, text: str) -> float:
        """Извлечь уровень уверенности из текста"""
        patterns = [
            r"[Уу]веренность[:\s]+(\d+)%",
            r"[Уу]ровень уверенности[:\s]+(\d+)%",
            r"(\d+)%\s*уверенност",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return float(match.group(1)) / 100
        return 0.7  # default

    def _extract_score(self, text: str) -> float:
        """Извлечь оценку из критики"""
        patterns = [
            r"[Оо]бщая оценка[:\s]+(\d+(?:\.\d+)?)/10",
            r"(\d+(?:\.\d+)?)/10",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return float(match.group(1))
        return 5.0  # default

    def _extract_key_points(self, text: str) -> list[str]:
        """Извлечь ключевые выводы"""
        return self._extract_list_section(text, "Ключевые выводы")

    def _extract_risks(self, text: str) -> list[str]:
        """Извлечь риски"""
        return self._extract_list_section(text, "Риски")

    def _extract_assumptions(self, text: str) -> list[str]:
        """Извлечь допущения"""
        return self._extract_list_section(text, "Допущения")

    def _extract_weaknesses(self, text: str) -> list[str]:
        """Извлечь слабости"""
        return self._extract_list_section(text, "Слабости")

    def _extract_strengths(self, text: str) -> list[str]:
        """Извлечь сильные стороны"""
        return self._extract_list_section(text, "Сильные стороны")

    def _extract_suggestions(self, text: str) -> list[str]:
        """Извлечь предложения"""
        return self._extract_list_section(text, "Предложения")

    def _extract_list_section(self, text: str, section_name: str) -> list[str]:
        """Извлечь список из секции"""
        pattern = rf"##\s*{section_name}\s*\n((?:[-*]\s*.+\n?)+)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            items = re.findall(r"[-*]\s*(.+)", match.group(1))
            return [item.strip() for item in items if item.strip()]
        return []
