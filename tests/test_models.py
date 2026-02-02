"""
LLM-top: Model Tests
Тесты для Pydantic моделей
"""

import pytest
from pydantic import ValidationError

from src.models.state import (
    AgentAnalysis,
    AgentCritique,
    SynthesisResult,
    TaskInput,
    CosiliumOutput,
)


class TestAgentAnalysis:
    """Тесты для AgentAnalysis"""

    def test_create_valid(self):
        analysis = AgentAnalysis(
            agent_name="ChatGPT",
            analysis="Test analysis",
            confidence=0.8,
        )
        assert analysis.agent_name == "ChatGPT"
        assert analysis.confidence == 0.8
        assert analysis.key_points == []

    def test_confidence_bounds(self):
        # Valid bounds
        AgentAnalysis(agent_name="Test", analysis="", confidence=0.0)
        AgentAnalysis(agent_name="Test", analysis="", confidence=1.0)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentAnalysis(agent_name="Test", analysis="", confidence=-0.1)

        with pytest.raises(ValidationError):
            AgentAnalysis(agent_name="Test", analysis="", confidence=1.1)

    def test_with_all_fields(self):
        analysis = AgentAnalysis(
            agent_name="Claude",
            analysis="Full analysis",
            confidence=0.85,
            key_points=["Point 1", "Point 2"],
            risks=["Risk 1"],
            assumptions=["Assumption 1"],
        )
        assert len(analysis.key_points) == 2
        assert len(analysis.risks) == 1


class TestAgentCritique:
    """Тесты для AgentCritique"""

    def test_create_valid(self):
        critique = AgentCritique(
            critic_name="Claude",
            target_name="ChatGPT",
            critique="Test critique",
            score=7.5,
        )
        assert critique.critic_name == "Claude"
        assert critique.score == 7.5

    def test_score_bounds(self):
        # Valid bounds
        AgentCritique(
            critic_name="A", target_name="B", critique="", score=0.0
        )
        AgentCritique(
            critic_name="A", target_name="B", critique="", score=10.0
        )

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentCritique(
                critic_name="A", target_name="B", critique="", score=-1
            )

        with pytest.raises(ValidationError):
            AgentCritique(
                critic_name="A", target_name="B", critique="", score=11
            )


class TestSynthesisResult:
    """Тесты для SynthesisResult"""

    def test_create_valid(self):
        result = SynthesisResult(
            summary="Test summary",
            conclusions=[{"conclusion": "C1", "probability": "80%"}],
            recommendations=[{"recommendation": "R1"}],
            formalized_result="P(X) = 0.8",
            consensus_level=0.82,
        )
        assert result.consensus_level == 0.82
        assert len(result.conclusions) == 1

    def test_consensus_bounds(self):
        with pytest.raises(ValidationError):
            SynthesisResult(
                summary="",
                conclusions=[],
                recommendations=[],
                formalized_result="",
                consensus_level=1.5,
            )


class TestTaskInput:
    """Тесты для TaskInput"""

    def test_create_minimal(self):
        task = TaskInput(task="Test task")
        assert task.task == "Test task"
        assert task.task_type == "research"  # default
        assert task.max_iterations == 3  # default

    def test_create_full(self):
        task = TaskInput(
            task="Strategy task",
            task_type="strategy",
            context="Company context",
            max_iterations=5,
        )
        assert task.task_type == "strategy"
        assert task.max_iterations == 5

    def test_invalid_task_type(self):
        with pytest.raises(ValidationError):
            TaskInput(task="Test", task_type="invalid")

    def test_iteration_bounds(self):
        with pytest.raises(ValidationError):
            TaskInput(task="Test", max_iterations=0)

        with pytest.raises(ValidationError):
            TaskInput(task="Test", max_iterations=10)


class TestCosiliumOutput:
    """Тесты для CosiliumOutput"""

    def test_create_valid(self, sample_analyses, sample_critiques, sample_synthesis):
        output = CosiliumOutput(
            task="Test task",
            analyses=sample_analyses,
            critiques=sample_critiques,
            synthesis=sample_synthesis,
            iterations_used=3,
        )
        assert output.iterations_used == 3
        assert len(output.analyses) == 4

    def test_serialization(self, sample_analyses, sample_critiques, sample_synthesis):
        output = CosiliumOutput(
            task="Test",
            analyses=sample_analyses,
            critiques=sample_critiques,
            synthesis=sample_synthesis,
            iterations_used=2,
        )
        json_data = output.model_dump()
        assert "task" in json_data
        assert "synthesis" in json_data
        assert isinstance(json_data["analyses"], list)
