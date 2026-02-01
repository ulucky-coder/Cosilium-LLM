"""
Cosilium-LLM: LangGraph Workflow
Основной граф выполнения
"""

import asyncio
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from src.models.state import CosiliumState, AgentAnalysis, AgentCritique


# Lazy initialization
_agents = None
_synthesizer = None


def get_agents():
    """Lazy load agents"""
    global _agents
    if _agents is None:
        from src.agents.llm_agents import create_all_agents
        _agents = create_all_agents()
    return _agents


def get_synthesizer():
    """Lazy load synthesizer"""
    global _synthesizer
    if _synthesizer is None:
        from src.agents.synthesizer import Synthesizer
        _synthesizer = Synthesizer()
    return _synthesizer


# ============================================================
# NODE: Параллельный анализ всеми агентами
# ============================================================
async def parallel_analysis(state: CosiliumState) -> dict:
    """
    Итерация 1: Каждый агент анализирует задачу независимо
    """
    task = state["task"]
    task_type = state["task_type"]
    context = state["context"]

    # Запускаем всех агентов параллельно
    analysis_tasks = [
        agent.analyze(task, task_type, context)
        for agent in get_agents().values()
    ]

    analyses = await asyncio.gather(*analysis_tasks, return_exceptions=True)

    # Фильтруем ошибки
    valid_analyses = [
        a for a in analyses
        if isinstance(a, AgentAnalysis)
    ]

    return {
        "analyses": valid_analyses,
        "iteration": state["iteration"] + 1,
    }


# ============================================================
# NODE: Adversarial mode - взаимная критика
# ============================================================
async def adversarial_critique(state: CosiliumState) -> dict:
    """
    Итерация 2: Каждый агент критикует анализы других агентов
    """
    task = state["task"]
    analyses = state["analyses"]

    critique_tasks = []

    # Каждый агент критикует каждого другого
    for critic_name, critic_agent in get_agents().items():
        for analysis in analyses:
            # Не критикуем самого себя
            if analysis.agent_name.lower() != critic_name:
                critique_tasks.append(
                    critic_agent.critique(task, analysis.agent_name, analysis.analysis)
                )

    critiques = await asyncio.gather(*critique_tasks, return_exceptions=True)

    # Фильтруем ошибки
    valid_critiques = [
        c for c in critiques
        if isinstance(c, AgentCritique)
    ]

    return {
        "critiques": valid_critiques,
        "iteration": state["iteration"] + 1,
    }


# ============================================================
# NODE: Синтез результатов
# ============================================================
async def synthesize_results(state: CosiliumState) -> dict:
    """
    Итерация 3: Синтез всех анализов и критик в единый результат
    """
    synthesis = await get_synthesizer().synthesize(
        task=state["task"],
        analyses=state["analyses"],
        critiques=state["critiques"],
    )

    return {
        "synthesis": synthesis,
        "iteration": state["iteration"] + 1,
    }


# ============================================================
# NODE: Проверка необходимости дополнительных итераций
# ============================================================
def check_consensus(state: CosiliumState) -> dict:
    """Проверить достигнут ли консенсус"""
    synthesis = state.get("synthesis")
    iteration = state["iteration"]
    max_iterations = state["max_iterations"]

    # Условия остановки
    if iteration >= max_iterations:
        return {"should_continue": False}

    if synthesis and synthesis.consensus_level >= 0.8:
        return {"should_continue": False}

    return {"should_continue": True}


# ============================================================
# CONDITIONAL: Решение о продолжении
# ============================================================
def should_continue(state: CosiliumState) -> Literal["refine", "end"]:
    """Решить продолжать ли итерации"""
    if state.get("should_continue", False):
        return "refine"
    return "end"


# ============================================================
# NODE: Уточнение анализа (дополнительная итерация)
# ============================================================
async def refine_analysis(state: CosiliumState) -> dict:
    """
    Дополнительная итерация: уточнение на основе критики
    """
    # В этой версии просто перезапускаем adversarial
    # В продвинутой версии можно передавать критику обратно агентам
    return {"iteration": state["iteration"]}


# ============================================================
# BUILD GRAPH
# ============================================================
def create_workflow() -> StateGraph:
    """Создать граф workflow"""

    # Создаём граф
    workflow = StateGraph(CosiliumState)

    # Добавляем ноды
    workflow.add_node("parallel_analysis", parallel_analysis)
    workflow.add_node("adversarial_critique", adversarial_critique)
    workflow.add_node("synthesize", synthesize_results)
    workflow.add_node("check_consensus", check_consensus)
    workflow.add_node("refine", refine_analysis)

    # Определяем flow
    workflow.set_entry_point("parallel_analysis")

    workflow.add_edge("parallel_analysis", "adversarial_critique")
    workflow.add_edge("adversarial_critique", "synthesize")
    workflow.add_edge("synthesize", "check_consensus")

    # Условный переход
    workflow.add_conditional_edges(
        "check_consensus",
        should_continue,
        {
            "refine": "refine",
            "end": END,
        }
    )

    workflow.add_edge("refine", "adversarial_critique")

    return workflow


def create_app():
    """Создать приложение с checkpointing"""
    workflow = create_workflow()
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)


# Создаём приложение
app = create_app()
