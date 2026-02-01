"""
Cosilium-LLM: Graph Tests
Тесты для LangGraph workflow
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.graph.workflow import (
    parallel_analysis,
    adversarial_critique,
    synthesize_results,
    check_consensus,
    should_continue,
    create_workflow,
    create_app,
)
from src.models.state import CosiliumState, AgentAnalysis, AgentCritique, SynthesisResult


class TestParallelAnalysis:
    """Тесты для ноды parallel_analysis"""

    @pytest.mark.unit
    async def test_parallel_analysis(self, initial_state, sample_analysis):
        mock_agent = MagicMock()
        mock_agent.analyze = AsyncMock(return_value=sample_analysis)
        mock_agents = {
            "chatgpt": mock_agent,
            "claude": mock_agent,
            "gemini": mock_agent,
            "deepseek": mock_agent,
        }

        with patch("src.graph.workflow.get_agents", return_value=mock_agents):
            result = await parallel_analysis(initial_state)

            assert "analyses" in result
            assert result["iteration"] == 1

    @pytest.mark.unit
    async def test_parallel_analysis_handles_errors(self, initial_state):
        mock_agent_ok = MagicMock()
        mock_agent_ok.analyze = AsyncMock(
            return_value=AgentAnalysis(
                agent_name="OK",
                analysis="OK",
                confidence=0.8,
            )
        )
        mock_agent_fail = MagicMock()
        mock_agent_fail.analyze = AsyncMock(side_effect=Exception("API Error"))

        mock_agents = {
            "ok_agent": mock_agent_ok,
            "fail_agent": mock_agent_fail,
        }

        with patch("src.graph.workflow.get_agents", return_value=mock_agents):
            result = await parallel_analysis(initial_state)

            # Should still return valid analyses
            assert "analyses" in result
            assert len(result["analyses"]) >= 1


class TestAdversarialCritique:
    """Тесты для ноды adversarial_critique"""

    @pytest.mark.unit
    async def test_adversarial_critique(self, sample_analyses, sample_critique):
        state = CosiliumState(
            task="Test",
            task_type="research",
            context="",
            analyses=sample_analyses,
            critiques=[],
            synthesis=None,
            iteration=1,
            max_iterations=3,
            should_continue=True,
            error=None,
        )

        mock_agent = MagicMock()
        mock_agent.critique = AsyncMock(return_value=sample_critique)

        mock_agents = {
            "chatgpt": mock_agent,
            "claude": mock_agent,
        }

        with patch("src.graph.workflow.get_agents", return_value=mock_agents):
            result = await adversarial_critique(state)

            assert "critiques" in result
            assert result["iteration"] == 2


class TestSynthesizeResults:
    """Тесты для ноды synthesize_results"""

    @pytest.mark.unit
    async def test_synthesize_results(self, sample_analyses, sample_critiques, sample_synthesis):
        state = CosiliumState(
            task="Test",
            task_type="research",
            context="",
            analyses=sample_analyses,
            critiques=sample_critiques,
            synthesis=None,
            iteration=2,
            max_iterations=3,
            should_continue=True,
            error=None,
        )

        mock_synth = MagicMock()
        mock_synth.synthesize = AsyncMock(return_value=sample_synthesis)

        with patch("src.graph.workflow.get_synthesizer", return_value=mock_synth):
            result = await synthesize_results(state)

            assert "synthesis" in result
            assert result["synthesis"] == sample_synthesis
            assert result["iteration"] == 3


class TestCheckConsensus:
    """Тесты для ноды check_consensus"""

    @pytest.mark.unit
    def test_high_consensus_stops(self, sample_synthesis):
        sample_synthesis.consensus_level = 0.85
        state = CosiliumState(
            task="Test",
            task_type="research",
            context="",
            analyses=[],
            critiques=[],
            synthesis=sample_synthesis,
            iteration=2,
            max_iterations=5,
            should_continue=True,
            error=None,
        )

        result = check_consensus(state)
        assert result["should_continue"] is False

    @pytest.mark.unit
    def test_low_consensus_continues(self, sample_synthesis):
        sample_synthesis.consensus_level = 0.65
        state = CosiliumState(
            task="Test",
            task_type="research",
            context="",
            analyses=[],
            critiques=[],
            synthesis=sample_synthesis,
            iteration=2,
            max_iterations=5,
            should_continue=True,
            error=None,
        )

        result = check_consensus(state)
        assert result["should_continue"] is True

    @pytest.mark.unit
    def test_max_iterations_stops(self, sample_synthesis):
        sample_synthesis.consensus_level = 0.5
        state = CosiliumState(
            task="Test",
            task_type="research",
            context="",
            analyses=[],
            critiques=[],
            synthesis=sample_synthesis,
            iteration=5,
            max_iterations=5,
            should_continue=True,
            error=None,
        )

        result = check_consensus(state)
        assert result["should_continue"] is False


class TestShouldContinue:
    """Тесты для conditional edge"""

    @pytest.mark.unit
    def test_should_continue_true(self):
        state = {"should_continue": True}
        assert should_continue(state) == "refine"

    @pytest.mark.unit
    def test_should_continue_false(self):
        state = {"should_continue": False}
        assert should_continue(state) == "end"

    @pytest.mark.unit
    def test_should_continue_missing(self):
        state = {}
        assert should_continue(state) == "end"


class TestWorkflowCreation:
    """Тесты создания workflow"""

    @pytest.mark.unit
    def test_create_workflow(self):
        workflow = create_workflow()
        assert workflow is not None

        # Check nodes exist
        assert "parallel_analysis" in workflow.nodes
        assert "adversarial_critique" in workflow.nodes
        assert "synthesize" in workflow.nodes
        assert "check_consensus" in workflow.nodes

    @pytest.mark.unit
    def test_create_app(self):
        with patch("src.graph.workflow.create_workflow") as mock_create:
            mock_workflow = MagicMock()
            mock_workflow.compile.return_value = MagicMock()
            mock_create.return_value = mock_workflow

            app = create_app()

            assert app is not None
            mock_workflow.compile.assert_called_once()
