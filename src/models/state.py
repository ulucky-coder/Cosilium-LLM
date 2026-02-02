"""
Cosilium-LLM: State Models
Модели состояния для LangGraph
"""

from typing import TypedDict, Annotated, Literal, Optional
from pydantic import BaseModel, Field
from operator import add


class AgentAnalysis(BaseModel):
    """Анализ от одного агента"""
    agent_name: str
    analysis: str
    confidence: float = Field(ge=0, le=1)
    key_points: list[str] = []
    risks: list[str] = []
    assumptions: list[str] = []


class AgentCritique(BaseModel):
    """Критика от агента на анализ другого агента"""
    critic_name: str
    target_name: str
    critique: str
    score: float = Field(ge=0, le=10)
    weaknesses: list[str] = []
    strengths: list[str] = []
    suggestions: list[str] = []


class SynthesisResult(BaseModel):
    """Результат синтеза"""
    summary: str
    conclusions: list[dict]  # {conclusion, probability, falsification_condition}
    recommendations: list[dict]  # {recommendation, pros, cons}
    formalized_result: str  # Математическая формализация
    consensus_level: float = Field(ge=0, le=1)
    dissenting_opinions: list[str] = []


class CosiliumState(TypedDict):
    """
    Состояние графа Cosilium

    Аннотация `add` означает, что новые элементы добавляются к списку,
    а не заменяют его
    """
    # Входные данные
    task: str
    task_type: Literal["strategy", "research", "investment", "development", "audit"]
    context: str

    # Итерация 1: Независимый анализ
    analyses: Annotated[list[AgentAnalysis], add]

    # Итерация 2: Adversarial mode
    critiques: Annotated[list[AgentCritique], add]

    # Итерация 3: Синтез
    synthesis: Optional[SynthesisResult]

    # Метаданные
    iteration: int
    max_iterations: int
    should_continue: bool
    error: Optional[str]


class TaskInput(BaseModel):
    """Входные данные для анализа"""
    task: str = Field(..., min_length=1, description="Задача для анализа")
    task_type: Literal["strategy", "research", "investment", "development", "audit"] = "research"
    context: str = Field(default="", description="Дополнительный контекст")
    max_iterations: int = Field(default=3, ge=1, le=5)


class CosiliumOutput(BaseModel):
    """Выходные данные анализа"""
    task: str
    analyses: list[AgentAnalysis]
    critiques: list[AgentCritique]
    synthesis: SynthesisResult
    iterations_used: int
