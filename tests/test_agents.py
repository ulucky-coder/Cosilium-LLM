"""
Cosilium-LLM: Agent Tests
Тесты для агентов
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.agents.base import BaseAgent
from src.agents.llm_agents import (
    ChatGPTAgent,
    ClaudeAgent,
    GeminiAgent,
    DeepSeekAgent,
    create_all_agents,
)
from src.agents.synthesizer import Synthesizer
from src.models.state import AgentAnalysis, AgentCritique


class TestBaseAgentParsing:
    """Тесты парсинга ответов базового агента"""

    @pytest.fixture
    def mock_agent(self):
        """Создать mock агента для тестирования парсинга"""
        with patch.object(BaseAgent, "__abstractmethods__", set()):
            with patch.object(BaseAgent, "_create_llm", return_value=MagicMock()):
                agent = BaseAgent("chatgpt")
                return agent

    def test_extract_confidence(self, mock_agent):
        text = "Общий уровень уверенности: 85%"
        assert mock_agent._extract_confidence(text) == 0.85

        text2 = "Уверенность: 70%"
        assert mock_agent._extract_confidence(text2) == 0.70

        # Default
        assert mock_agent._extract_confidence("No confidence") == 0.7

    def test_extract_score(self, mock_agent):
        text = "Общая оценка: 7.5/10"
        assert mock_agent._extract_score(text) == 7.5

        text2 = "8/10"
        assert mock_agent._extract_score(text2) == 8.0

        # Default
        assert mock_agent._extract_score("No score") == 5.0

    def test_extract_key_points(self, mock_agent):
        text = """## Ключевые выводы
- Вывод 1
- Вывод 2
- Вывод 3

## Другой раздел
"""
        points = mock_agent._extract_key_points(text)
        assert len(points) == 3
        assert "Вывод 1" in points

    def test_extract_risks(self, mock_agent):
        text = """## Риски
- Риск санкций
- Риск конкуренции

## Допущения
"""
        risks = mock_agent._extract_risks(text)
        assert len(risks) == 2
        assert "Риск санкций" in risks

    def test_extract_empty_section(self, mock_agent):
        text = "No sections here"
        assert mock_agent._extract_key_points(text) == []
        assert mock_agent._extract_risks(text) == []


class TestChatGPTAgent:
    """Тесты для ChatGPT агента"""

    @pytest.mark.unit
    def test_agent_config(self):
        with patch("src.agents.llm_agents.ChatOpenAI"):
            agent = ChatGPTAgent()
            assert agent.name == "ChatGPT"
            assert agent.agent_type == "chatgpt"

    @pytest.mark.unit
    async def test_analyze(self, mock_llm_response):
        with patch("src.agents.llm_agents.ChatOpenAI") as mock_llm:
            mock_llm.return_value.ainvoke = AsyncMock(return_value=mock_llm_response)

            agent = ChatGPTAgent()
            result = await agent.analyze(
                task="Test task",
                task_type="research",
                context="Test context",
            )

            assert isinstance(result, AgentAnalysis)
            assert result.agent_name == "ChatGPT"
            assert 0 <= result.confidence <= 1

    @pytest.mark.unit
    async def test_critique(self, mock_critique_response):
        with patch("src.agents.llm_agents.ChatOpenAI") as mock_llm:
            mock_llm.return_value.ainvoke = AsyncMock(return_value=mock_critique_response)

            agent = ChatGPTAgent()
            result = await agent.critique(
                task="Test task",
                target_name="Claude",
                analysis="Test analysis",
            )

            assert isinstance(result, AgentCritique)
            assert result.critic_name == "ChatGPT"
            assert result.target_name == "Claude"


class TestClaudeAgent:
    """Тесты для Claude агента"""

    @pytest.mark.unit
    def test_agent_config(self):
        with patch("src.agents.llm_agents.ChatAnthropic"):
            agent = ClaudeAgent()
            assert agent.name == "Claude"
            assert agent.agent_type == "claude"


class TestGeminiAgent:
    """Тесты для Gemini агента"""

    @pytest.mark.unit
    def test_agent_config(self):
        with patch("src.agents.llm_agents.ChatGoogleGenerativeAI"):
            agent = GeminiAgent()
            assert agent.name == "Gemini"
            assert agent.agent_type == "gemini"


class TestDeepSeekAgent:
    """Тесты для DeepSeek агента"""

    @pytest.mark.unit
    def test_agent_config(self):
        with patch("src.agents.llm_agents.ChatOpenAI"):
            agent = DeepSeekAgent()
            assert agent.name == "DeepSeek"
            assert agent.agent_type == "deepseek"


class TestCreateAllAgents:
    """Тесты для фабрики агентов"""

    @pytest.mark.unit
    def test_create_all_agents(self):
        with patch("src.agents.llm_agents.ChatOpenAI"), \
             patch("src.agents.llm_agents.ChatAnthropic"), \
             patch("src.agents.llm_agents.ChatGoogleGenerativeAI"):

            agents = create_all_agents()

            assert len(agents) == 4
            assert "chatgpt" in agents
            assert "claude" in agents
            assert "gemini" in agents
            assert "deepseek" in agents


class TestSynthesizer:
    """Тесты для синтезатора"""

    @pytest.mark.unit
    async def test_synthesize(self, sample_analyses, sample_critiques, mock_synthesis_response):
        with patch("src.agents.synthesizer.ChatAnthropic") as mock_llm:
            mock_llm.return_value.ainvoke = AsyncMock(return_value=mock_synthesis_response)

            synth = Synthesizer()
            result = await synth.synthesize(
                task="Test task",
                analyses=sample_analyses,
                critiques=sample_critiques,
            )

            assert result.summary is not None
            assert 0 <= result.consensus_level <= 1

    @pytest.mark.unit
    def test_format_analyses(self, sample_analyses):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            formatted = synth._format_analyses(sample_analyses)

            assert "ChatGPT" in formatted
            assert "Claude" in formatted
            assert "75%" in formatted or "0.75" in formatted

    @pytest.mark.unit
    def test_format_critiques(self, sample_critiques):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            formatted = synth._format_critiques(sample_critiques)

            assert "Claude" in formatted
            assert "ChatGPT" in formatted

    @pytest.mark.unit
    def test_calculate_consensus(self, sample_critiques):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            consensus = synth._calculate_consensus(sample_critiques)

            # Average of 7.5 and 8.0 = 7.75, normalized = 0.775
            assert 0.7 < consensus < 0.8

    @pytest.mark.unit
    def test_calculate_consensus_empty(self):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            consensus = synth._calculate_consensus([])
            assert consensus == 0.5

    @pytest.mark.unit
    def test_extract_summary(self):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            text = """## Резюме

Это краткое резюме результатов.

## Другой раздел
"""
            summary = synth._extract_summary(text)
            assert "краткое резюме" in summary

    @pytest.mark.unit
    def test_extract_conclusions(self):
        with patch("src.agents.synthesizer.ChatAnthropic"):
            synth = Synthesizer()
            text = """## Таблица выводов

| Вывод | Вероятность | Условие фальсификации |
|-------|-------------|----------------------|
| Вывод 1 | 75% | Условие 1 |
| Вывод 2 | 60% | Условие 2 |

## Другой раздел
"""
            conclusions = synth._extract_conclusions(text)
            assert len(conclusions) == 2
            assert conclusions[0]["conclusion"] == "Вывод 1"
