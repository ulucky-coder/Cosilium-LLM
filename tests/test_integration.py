"""
Cosilium-LLM: Integration Tests
Интеграционные тесты (требуют API ключи)
"""

import pytest
import os
from unittest.mock import patch

# Skip all tests if no API keys
pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="Integration tests require OPENAI_API_KEY"
)


@pytest.mark.integration
@pytest.mark.slow
class TestFullWorkflow:
    """Полные интеграционные тесты"""

    @pytest.mark.asyncio
    async def test_full_analysis_flow(self):
        """Тест полного цикла анализа с реальными LLM"""
        from src.graph.workflow import app
        from src.models.state import CosiliumState

        initial_state: CosiliumState = {
            "task": "Оценить перспективы Python в 2026 году",
            "task_type": "research",
            "context": "Для принятия решения об обучении",
            "analyses": [],
            "critiques": [],
            "synthesis": None,
            "iteration": 0,
            "max_iterations": 2,  # Меньше итераций для теста
            "should_continue": True,
            "error": None,
        }

        config = {"configurable": {"thread_id": "integration-test"}}

        result = await app.ainvoke(initial_state, config)

        # Проверяем результат
        assert result["iteration"] > 0
        assert len(result["analyses"]) > 0
        assert result["synthesis"] is not None

    @pytest.mark.asyncio
    async def test_single_agent_analysis(self):
        """Тест одного агента"""
        from src.agents.llm_agents import ChatGPTAgent

        agent = ChatGPTAgent()
        result = await agent.analyze(
            task="Что такое Python?",
            task_type="research",
            context="",
        )

        assert result.agent_name == "ChatGPT"
        assert len(result.analysis) > 0
        assert 0 <= result.confidence <= 1


@pytest.mark.integration
class TestAPIWithRealLLM:
    """Тесты API с реальными LLM"""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from src.api.main import api
        return TestClient(api)

    def test_real_analyze(self, client):
        """Тест /analyze с реальным LLM"""
        response = client.post(
            "/analyze",
            json={
                "task": "Краткий тест: 2+2=?",
                "task_type": "research",
                "max_iterations": 1,
            },
            timeout=120,  # LLM может быть медленным
        )

        assert response.status_code == 200
        data = response.json()
        assert "analyses" in data
        assert len(data["analyses"]) > 0


@pytest.mark.integration
@pytest.mark.slow
class TestAgentInteraction:
    """Тесты взаимодействия агентов"""

    @pytest.mark.asyncio
    async def test_critique_flow(self):
        """Тест критики одного агента другим"""
        from src.agents.llm_agents import ChatGPTAgent, ClaudeAgent

        # Создаём агентов
        gpt = ChatGPTAgent()

        # GPT анализирует
        analysis = await gpt.analyze(
            task="Плюсы и минусы микросервисов",
            task_type="development",
            context="",
        )

        assert len(analysis.analysis) > 100

        # Claude критикует (если есть ключ)
        if os.getenv("ANTHROPIC_API_KEY"):
            claude = ClaudeAgent()
            critique = await claude.critique(
                task="Плюсы и минусы микросервисов",
                target_name="ChatGPT",
                analysis=analysis.analysis,
            )

            assert critique.critic_name == "Claude"
            assert critique.target_name == "ChatGPT"
            assert 0 <= critique.score <= 10


@pytest.mark.integration
class TestSynthesizerIntegration:
    """Тесты синтезатора"""

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not os.getenv("ANTHROPIC_API_KEY"),
        reason="Requires ANTHROPIC_API_KEY"
    )
    async def test_real_synthesis(self, sample_analyses, sample_critiques):
        """Тест синтеза с реальным Claude"""
        from src.agents.synthesizer import Synthesizer

        synth = Synthesizer()
        result = await synth.synthesize(
            task="Тестовая задача",
            analyses=sample_analyses,
            critiques=sample_critiques,
        )

        assert result.summary is not None
        assert 0 <= result.consensus_level <= 1
