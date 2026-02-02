"""
LLM-top: FastAPI Application
REST API для системы
"""

import uuid
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json

from src.models.state import TaskInput, CosiliumOutput, CosiliumState
from src.graph.workflow import app as langgraph_app
from src.config import get_settings

settings = get_settings()

# FastAPI app
api = FastAPI(
    title="LLM-top API",
    description="Мульти-агентная аналитическая система",
    version="1.0.0",
)

# CORS
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилище задач в памяти (в production использовать Redis)
tasks_store: dict[str, dict] = {}


@api.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "service": "LLM-top",
        "version": "1.0.0",
    }


@api.post("/analyze")
async def analyze(input_data: TaskInput) -> CosiliumOutput:
    """
    Синхронный анализ задачи

    Выполняет полный цикл анализа и возвращает результат.
    Может занять несколько минут.
    """
    # Начальное состояние
    initial_state: CosiliumState = {
        "task": input_data.task,
        "task_type": input_data.task_type,
        "context": input_data.context,
        "analyses": [],
        "critiques": [],
        "synthesis": None,
        "iteration": 0,
        "max_iterations": input_data.max_iterations,
        "should_continue": True,
        "error": None,
    }

    # Конфигурация для checkpointing
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    try:
        # Запускаем граф
        final_state = await langgraph_app.ainvoke(initial_state, config)

        return CosiliumOutput(
            task=final_state["task"],
            analyses=final_state["analyses"],
            critiques=final_state["critiques"],
            synthesis=final_state["synthesis"],
            iterations_used=final_state["iteration"],
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api.post("/analyze/async")
async def analyze_async(input_data: TaskInput, background_tasks: BackgroundTasks) -> dict:
    """
    Асинхронный анализ задачи

    Запускает анализ в фоне и возвращает task_id.
    Используйте GET /tasks/{task_id} для получения результата.
    """
    task_id = str(uuid.uuid4())

    # Сохраняем начальный статус
    tasks_store[task_id] = {
        "status": "pending",
        "input": input_data.model_dump(),
        "result": None,
        "error": None,
    }

    # Запускаем в фоне
    background_tasks.add_task(run_analysis_background, task_id, input_data)

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "Analysis started. Use GET /tasks/{task_id} to check status.",
    }


async def run_analysis_background(task_id: str, input_data: TaskInput):
    """Фоновое выполнение анализа"""
    tasks_store[task_id]["status"] = "running"

    initial_state: CosiliumState = {
        "task": input_data.task,
        "task_type": input_data.task_type,
        "context": input_data.context,
        "analyses": [],
        "critiques": [],
        "synthesis": None,
        "iteration": 0,
        "max_iterations": input_data.max_iterations,
        "should_continue": True,
        "error": None,
    }

    config = {"configurable": {"thread_id": task_id}}

    try:
        final_state = await langgraph_app.ainvoke(initial_state, config)

        tasks_store[task_id]["status"] = "completed"
        tasks_store[task_id]["result"] = CosiliumOutput(
            task=final_state["task"],
            analyses=final_state["analyses"],
            critiques=final_state["critiques"],
            synthesis=final_state["synthesis"],
            iterations_used=final_state["iteration"],
        ).model_dump()

    except Exception as e:
        tasks_store[task_id]["status"] = "failed"
        tasks_store[task_id]["error"] = str(e)


@api.get("/tasks/{task_id}")
async def get_task(task_id: str) -> dict:
    """Получить статус и результат задачи"""
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="Task not found")

    return tasks_store[task_id]


@api.get("/analyze/stream")
async def analyze_stream(
    task: str,
    task_type: str = "research",
    context: str = "",
):
    """
    Streaming анализ задачи

    Возвращает результаты по мере выполнения каждого этапа.
    """
    async def event_generator():
        initial_state: CosiliumState = {
            "task": task,
            "task_type": task_type,
            "context": context,
            "analyses": [],
            "critiques": [],
            "synthesis": None,
            "iteration": 0,
            "max_iterations": 3,
            "should_continue": True,
            "error": None,
        }

        config = {"configurable": {"thread_id": str(uuid.uuid4())}}

        try:
            async for event in langgraph_app.astream(initial_state, config):
                # Отправляем каждое событие как SSE
                yield f"data: {json.dumps(event, default=str, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.1)

            yield "data: {\"status\": \"completed\"}\n\n"

        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@api.get("/agents")
async def list_agents():
    """Список доступных агентов"""
    from src.config import AGENT_CONFIGS
    return AGENT_CONFIGS


@api.get("/health")
async def health():
    """Детальный health check"""
    return {
        "status": "healthy",
        "agents": list(AGENT_CONFIGS.keys()),
        "active_tasks": len([t for t in tasks_store.values() if t["status"] == "running"]),
    }


@api.post("/collect-data")
async def collect_data(input_data: TaskInput):
    """
    Создать план сбора данных для задачи.

    Используется когда RAG #3 (контекст) пуст или недостаточен.
    Возвращает детальный план с указанием инструментов и запросов.
    """
    from src.agents.data_collector import DataCollectionAgent

    agent = DataCollectionAgent()

    plan = await agent.create_collection_plan(
        task=input_data.task,
        task_type=input_data.task_type,
        context=input_data.context,
    )

    # Возвращаем и структурированные данные, и Markdown
    return {
        "plan": plan.model_dump(),
        "markdown": agent.format_plan_as_markdown(plan),
    }


@api.post("/analyze/smart")
async def analyze_smart(input_data: TaskInput, background_tasks: BackgroundTasks):
    """
    Умный анализ: проверяет наличие данных и предлагает план сбора если нужно.

    1. Если context пуст/минимален → возвращает план сбора данных
    2. Если context достаточен → запускает полный анализ
    """
    from src.agents.data_collector import DataCollectionAgent

    # Проверяем достаточность контекста
    context_length = len(input_data.context or "")
    has_sufficient_context = context_length > 500  # Минимум 500 символов

    if not has_sufficient_context:
        # Создаём план сбора данных
        agent = DataCollectionAgent()
        plan = await agent.create_collection_plan(
            task=input_data.task,
            task_type=input_data.task_type,
            context=input_data.context,
        )

        return {
            "status": "needs_data",
            "message": "Недостаточно данных для качественного анализа. Следуйте плану сбора данных.",
            "context_length": context_length,
            "minimum_required": 500,
            "data_collection_plan": plan.model_dump(),
            "markdown": agent.format_plan_as_markdown(plan),
        }

    # Контекст достаточен — запускаем анализ
    task_id = str(uuid.uuid4())
    tasks_store[task_id] = {
        "status": "pending",
        "input": input_data.model_dump(),
        "result": None,
        "error": None,
    }
    background_tasks.add_task(run_analysis_background, task_id, input_data)

    return {
        "status": "analysis_started",
        "message": "Контекст достаточен. Анализ запущен.",
        "task_id": task_id,
        "context_length": context_length,
    }


# Import для удобства
from src.config import AGENT_CONFIGS
