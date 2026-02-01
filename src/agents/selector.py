"""
Cosilium-LLM: Agent Selector
Динамический выбор агентов и fallback механизм
"""

import asyncio
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from enum import Enum

from src.agents.base import BaseAgent
from src.agents.personas import ExpertPersona, get_personas_for_task, generate_persona_prompt
from src.config import AGENT_CONFIGS


class AgentStatus(str, Enum):
    AVAILABLE = "available"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"


class AgentHealth(BaseModel):
    """Состояние здоровья агента"""
    agent_name: str
    status: AgentStatus = AgentStatus.AVAILABLE
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    failure_count: int = 0
    avg_latency_ms: float = 0
    error_rate: float = 0


class AgentCapability(BaseModel):
    """Возможности агента по типам задач"""
    agent_name: str
    task_scores: dict[str, float] = Field(default_factory=dict)
    # Оценка 0-1 для каждого типа задачи


# Матрица специализации агентов
AGENT_SPECIALIZATION = {
    "chatgpt": AgentCapability(
        agent_name="ChatGPT",
        task_scores={
            "strategy": 0.85,
            "research": 0.90,
            "investment": 0.80,
            "development": 0.85,
            "audit": 0.75,
        }
    ),
    "claude": AgentCapability(
        agent_name="Claude",
        task_scores={
            "strategy": 0.90,
            "research": 0.90,
            "investment": 0.85,
            "development": 0.80,
            "audit": 0.90,
        }
    ),
    "gemini": AgentCapability(
        agent_name="Gemini",
        task_scores={
            "strategy": 0.80,
            "research": 0.85,
            "investment": 0.75,
            "development": 0.80,
            "audit": 0.70,
        }
    ),
    "deepseek": AgentCapability(
        agent_name="DeepSeek",
        task_scores={
            "strategy": 0.75,
            "research": 0.80,
            "investment": 0.85,
            "development": 0.90,
            "audit": 0.80,
        }
    ),
}


class FallbackChain(BaseModel):
    """Цепочка fallback агентов"""
    primary: str
    fallbacks: list[str]


# Цепочки fallback
FALLBACK_CHAINS = {
    "chatgpt": FallbackChain(primary="chatgpt", fallbacks=["claude", "gemini"]),
    "claude": FallbackChain(primary="claude", fallbacks=["chatgpt", "deepseek"]),
    "gemini": FallbackChain(primary="gemini", fallbacks=["chatgpt", "claude"]),
    "deepseek": FallbackChain(primary="deepseek", fallbacks=["chatgpt", "claude"]),
}


class AgentSelector:
    """
    Динамический выбор агентов

    Выбирает оптимальный набор агентов на основе:
    - Типа задачи
    - Текущего состояния агентов
    - Исторической производительности
    """

    def __init__(self):
        self.health_status: dict[str, AgentHealth] = {
            name: AgentHealth(agent_name=name)
            for name in AGENT_CONFIGS.keys()
        }
        self.specialization = AGENT_SPECIALIZATION

    def select_agents(
        self,
        task_type: str,
        min_agents: int = 2,
        max_agents: int = 4,
        required_agents: list[str] = None
    ) -> list[str]:
        """
        Выбрать агентов для задачи

        Args:
            task_type: Тип задачи
            min_agents: Минимальное количество агентов
            max_agents: Максимальное количество агентов
            required_agents: Обязательные агенты

        Returns:
            Список выбранных агентов
        """
        required = set(required_agents or [])
        available_agents = []

        # Проверяем доступность и получаем scores
        for agent_name, capability in self.specialization.items():
            health = self.health_status.get(agent_name)

            if health and health.status == AgentStatus.UNAVAILABLE:
                continue

            score = capability.task_scores.get(task_type, 0.5)

            # Штраф за degraded статус
            if health and health.status == AgentStatus.DEGRADED:
                score *= 0.7

            available_agents.append((agent_name, score))

        # Сортируем по score
        available_agents.sort(key=lambda x: x[1], reverse=True)

        # Выбираем топ агентов
        selected = list(required)
        for agent_name, score in available_agents:
            if agent_name not in selected:
                selected.append(agent_name)
            if len(selected) >= max_agents:
                break

        # Проверяем минимум
        if len(selected) < min_agents:
            # Добавляем даже degraded если нужно
            for agent_name, _ in available_agents:
                if agent_name not in selected:
                    selected.append(agent_name)
                if len(selected) >= min_agents:
                    break

        return selected

    def select_with_personas(
        self,
        task_type: str,
        task_description: str
    ) -> list[tuple[str, Optional[ExpertPersona]]]:
        """
        Выбрать агентов с персонами

        Returns:
            Список (agent_name, persona) туплов
        """
        # Получаем релевантные персоны
        personas = get_personas_for_task(task_type)

        # Выбираем агентов
        agents = self.select_agents(task_type)

        # Назначаем персоны агентам
        result = []
        for i, agent in enumerate(agents):
            persona = personas[i] if i < len(personas) else None
            result.append((agent, persona))

        return result

    def record_success(self, agent_name: str, latency_ms: float):
        """Записать успешный вызов"""
        if agent_name not in self.health_status:
            return

        health = self.health_status[agent_name]
        health.last_success = datetime.utcnow()
        health.failure_count = 0

        # Экспоненциальное скользящее среднее latency
        alpha = 0.3
        health.avg_latency_ms = alpha * latency_ms + (1 - alpha) * health.avg_latency_ms

        # Обновляем статус
        if health.avg_latency_ms < 5000:  # < 5 sec
            health.status = AgentStatus.AVAILABLE
        else:
            health.status = AgentStatus.DEGRADED

    def record_failure(self, agent_name: str, error: str):
        """Записать неудачный вызов"""
        if agent_name not in self.health_status:
            return

        health = self.health_status[agent_name]
        health.last_failure = datetime.utcnow()
        health.failure_count += 1

        # Обновляем error_rate
        alpha = 0.3
        health.error_rate = alpha * 1.0 + (1 - alpha) * health.error_rate

        # Обновляем статус
        if health.failure_count >= 3:
            health.status = AgentStatus.UNAVAILABLE
        elif health.failure_count >= 1:
            health.status = AgentStatus.DEGRADED

    def get_fallback(self, agent_name: str) -> Optional[str]:
        """Получить fallback агента"""
        if agent_name not in FALLBACK_CHAINS:
            return None

        chain = FALLBACK_CHAINS[agent_name]

        for fallback in chain.fallbacks:
            health = self.health_status.get(fallback)
            if health and health.status != AgentStatus.UNAVAILABLE:
                return fallback

        return None

    def reset_agent(self, agent_name: str):
        """Сбросить статус агента"""
        if agent_name in self.health_status:
            self.health_status[agent_name] = AgentHealth(agent_name=agent_name)

    def get_health_report(self) -> dict[str, AgentHealth]:
        """Получить отчёт о здоровье всех агентов"""
        return self.health_status.copy()


class FallbackExecutor:
    """
    Исполнитель с fallback

    Автоматически переключается на fallback агентов при ошибках
    """

    def __init__(self, selector: AgentSelector):
        self.selector = selector
        self.max_retries = 3

    async def execute_with_fallback(
        self,
        primary_agent: BaseAgent,
        operation: str,  # "analyze" или "critique"
        **kwargs
    ) -> tuple[any, str]:
        """
        Выполнить операцию с fallback

        Returns:
            (result, actual_agent_name)
        """
        import time
        from src.agents.llm_agents import create_all_agents

        agents = create_all_agents()
        current_agent_name = primary_agent.agent_type
        attempts = 0

        while attempts < self.max_retries:
            try:
                agent = agents.get(current_agent_name, primary_agent)

                start_time = time.time()

                if operation == "analyze":
                    result = await agent.analyze(**kwargs)
                elif operation == "critique":
                    result = await agent.critique(**kwargs)
                else:
                    raise ValueError(f"Unknown operation: {operation}")

                latency_ms = (time.time() - start_time) * 1000
                self.selector.record_success(current_agent_name, latency_ms)

                return result, current_agent_name

            except Exception as e:
                self.selector.record_failure(current_agent_name, str(e))
                attempts += 1

                # Пробуем fallback
                fallback = self.selector.get_fallback(current_agent_name)
                if fallback:
                    current_agent_name = fallback
                else:
                    # Нет доступных fallback
                    raise

        raise Exception(f"All agents failed after {self.max_retries} attempts")


class AdaptiveAgentPool:
    """
    Адаптивный пул агентов

    Динамически подстраивает состав агентов под задачу
    """

    def __init__(self):
        self.selector = AgentSelector()
        self.executor = FallbackExecutor(self.selector)

    async def run_parallel_analysis(
        self,
        task: str,
        task_type: str,
        context: str,
        use_personas: bool = True
    ) -> list[tuple[any, str]]:
        """
        Параллельный анализ с адаптивным выбором агентов

        Returns:
            Список (analysis, agent_name) туплов
        """
        from src.agents.llm_agents import create_all_agents

        agents = create_all_agents()

        if use_personas:
            agent_personas = self.selector.select_with_personas(task_type, task)
        else:
            selected = self.selector.select_agents(task_type)
            agent_personas = [(name, None) for name in selected]

        tasks = []
        for agent_name, persona in agent_personas:
            agent = agents.get(agent_name)
            if agent:
                # Модифицируем task если есть персона
                modified_task = task
                if persona:
                    modified_task = generate_persona_prompt(persona, task)

                tasks.append(
                    self.executor.execute_with_fallback(
                        agent,
                        "analyze",
                        task=modified_task,
                        task_type=task_type,
                        context=context,
                    )
                )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Фильтруем ошибки
        valid_results = [
            r for r in results
            if not isinstance(r, Exception)
        ]

        return valid_results
