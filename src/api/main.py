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


# Import для удобства
from src.config import AGENT_CONFIGS
