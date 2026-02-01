"""
Cosilium-LLM: Test Configuration
Фикстуры и конфигурация для тестов
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from src.models.state import (
    AgentAnalysis,
    AgentCritique,
    SynthesisResult,
    CosiliumState,
    TaskInput,
)
from src.api.main import api


# ============================================================
# Fixtures: Test Data
# ============================================================

@pytest.fixture
def sample_task() -> str:
    return "Оценить перспективы выхода на рынок облачных решений в России"


@pytest.fixture
def sample_task_input() -> TaskInput:
    return TaskInput(
        task="Оценить перспективы выхода на рынок облачных решений",
        task_type="strategy",
        context="B2B SaaS стартап с ARR $2M",
        max_iterations=2,
    )


@pytest.fixture
def sample_analysis() -> AgentAnalysis:
    return AgentAnalysis(
        agent_name="ChatGPT",
        analysis="""## Анализ

Рынок облачных решений в России показывает устойчивый рост.

## Ключевые выводы
- Рост рынка 15-20% в год (уверенность: 80%)
- Конкуренция высокая (уверенность: 90%)

## Риски
- Санкционное давление
- Уход западных вендоров

## Допущения
- Экономика стабильна
- Регуляторная среда не ужесточится

## Уверенность
Общий уровень уверенности: 75%
""",
        confidence=0.75,
        key_points=["Рост рынка 15-20%", "Высокая конкуренция"],
        risks=["Санкционное давление", "Уход западных вендоров"],
        assumptions=["Экономика стабильна"],
    )


@pytest.fixture
def sample_analyses(sample_analysis) -> list[AgentAnalysis]:
    return [
        sample_analysis,
        AgentAnalysis(
            agent_name="Claude",
            analysis="Методологический анализ...",
            confidence=0.80,
            key_points=["Ключевой вывод 1"],
            risks=["Риск 1"],
            assumptions=["Допущение 1"],
        ),
        AgentAnalysis(
            agent_name="Gemini",
            analysis="Альтернативный анализ...",
            confidence=0.70,
            key_points=["Альтернатива 1"],
            risks=["Риск альт"],
            assumptions=["Допущение альт"],
        ),
        AgentAnalysis(
            agent_name="DeepSeek",
            analysis="Формальный анализ...",
            confidence=0.85,
            key_points=["Формальный вывод"],
            risks=["Формальный риск"],
            assumptions=["Формальное допущение"],
        ),
    ]


@pytest.fixture
def sample_critique() -> AgentCritique:
    return AgentCritique(
        critic_name="Claude",
        target_name="ChatGPT",
        critique="""## Оценка по критериям

| Критерий | Оценка (1-10) | Комментарий |
|----------|---------------|-------------|
| Логика | 8 | Хорошо |
| Полнота | 7 | Средне |

## Сильные стороны
- Структурированность
- Конкретные цифры

## Слабости
- Недостаточно данных
- Нет альтернатив

## Предложения по улучшению
- Добавить источники
- Рассмотреть сценарии

## Общая оценка: 7.5/10
""",
        score=7.5,
        weaknesses=["Недостаточно данных", "Нет альтернатив"],
        strengths=["Структурированность", "Конкретные цифры"],
        suggestions=["Добавить источники", "Рассмотреть сценарии"],
    )


@pytest.fixture
def sample_critiques(sample_critique) -> list[AgentCritique]:
    return [
        sample_critique,
        AgentCritique(
            critic_name="ChatGPT",
            target_name="Claude",
            critique="Критика...",
            score=8.0,
            weaknesses=["Слабость"],
            strengths=["Сила"],
            suggestions=["Предложение"],
        ),
    ]


@pytest.fixture
def sample_synthesis() -> SynthesisResult:
    return SynthesisResult(
        summary="Рынок облачных решений в России перспективен, но рискован.",
        conclusions=[
            {
                "conclusion": "Рост рынка 15-20%",
                "probability": "75%",
                "falsification_condition": "Если санкции ужесточатся",
            }
        ],
        recommendations=[
            {
                "recommendation": "Выход на рынок в Q2 2026",
                "pros": "Растущий рынок",
                "cons": "Высокая конкуренция",
            }
        ],
        formalized_result="P(success) = 0.65 * (1 - P(sanctions))",
        consensus_level=0.82,
        dissenting_opinions=["DeepSeek считает риски выше"],
    )


@pytest.fixture
def sample_state(sample_task, sample_analyses, sample_critiques, sample_synthesis) -> CosiliumState:
    return CosiliumState(
        task=sample_task,
        task_type="strategy",
        context="B2B SaaS стартап",
        analyses=sample_analyses,
        critiques=sample_critiques,
        synthesis=sample_synthesis,
        iteration=3,
        max_iterations=3,
        should_continue=False,
        error=None,
    )


@pytest.fixture
def initial_state(sample_task) -> CosiliumState:
    return CosiliumState(
        task=sample_task,
        task_type="strategy",
        context="",
        analyses=[],
        critiques=[],
        synthesis=None,
        iteration=0,
        max_iterations=3,
        should_continue=True,
        error=None,
    )


# ============================================================
# Fixtures: Mocks
# ============================================================

@pytest.fixture
def mock_llm_response():
    """Mock LLM response"""
    mock = AsyncMock()
    mock.content = """## Анализ

Тестовый анализ.

## Ключевые выводы
- Вывод 1 (уверенность: 80%)

## Риски
- Риск 1

## Допущения
- Допущение 1

## Уверенность
Общий уровень уверенности: 75%
"""
    return mock


@pytest.fixture
def mock_critique_response():
    """Mock critique response"""
    mock = AsyncMock()
    mock.content = """## Оценка по критериям

| Критерий | Оценка |
|----------|--------|
| Логика | 8 |

## Сильные стороны
- Сила 1

## Слабости
- Слабость 1

## Предложения по улучшению
- Предложение 1

## Общая оценка: 7.5/10
"""
    return mock


@pytest.fixture
def mock_synthesis_response():
    """Mock synthesis response"""
    mock = AsyncMock()
    mock.content = """## Резюме

Синтезированный результат анализа.

## Таблица выводов

| Вывод | Вероятность | Условие фальсификации |
|-------|-------------|----------------------|
| Вывод 1 | 75% | Условие 1 |

## Формализованный итог

P(X) = 0.75

## Рекомендации

| Рекомендация | За | Против |
|--------------|----|----|
| Рекомендация 1 | Плюс | Минус |

## Разногласия
- Разногласие 1

## Уровень консенсуса: 82%
"""
    return mock


# ============================================================
# Fixtures: API Client
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(api)


@pytest.fixture
def mock_langgraph_app(sample_state):
    """Mock LangGraph app"""
    with patch("src.api.main.langgraph_app") as mock:
        mock.ainvoke = AsyncMock(return_value=sample_state)
        mock.astream = AsyncMock(return_value=iter([{"test": "event"}]))
        yield mock
