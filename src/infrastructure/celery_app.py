"""
LLM-top: Celery Application
Распределённые задачи для длинных анализов
"""

from celery import Celery
from celery.result import AsyncResult
import asyncio

from src.config import get_settings

settings = get_settings()

# Создаём Celery app
celery_app = Celery(
    "cosilium",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

# Конфигурация
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 минут максимум
    task_soft_time_limit=540,  # Soft limit 9 минут
    worker_prefetch_multiplier=1,  # Один task за раз для LLM
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)


def run_async(coro):
    """Запуск async функции в sync контексте Celery"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="cosilium.analyze")
def analyze_task(self, task: str, task_type: str, context: str, max_iterations: int = 3):
    """
    Celery task для анализа

    Args:
        task: Задача для анализа
        task_type: Тип задачи
        context: Контекст
        max_iterations: Максимум итераций
    """
    from src.graph.workflow import app as langgraph_app
    from src.models.state import CosiliumState, CosiliumOutput

    # Обновляем статус
    self.update_state(state="ANALYZING", meta={"iteration": 0})

    initial_state: CosiliumState = {
        "task": task,
        "task_type": task_type,
        "context": context,
        "analyses": [],
        "critiques": [],
        "synthesis": None,
        "iteration": 0,
        "max_iterations": max_iterations,
        "should_continue": True,
        "error": None,
    }

    config = {"configurable": {"thread_id": self.request.id}}

    async def run():
        return await langgraph_app.ainvoke(initial_state, config)

    try:
        final_state = run_async(run())

        output = CosiliumOutput(
            task=final_state["task"],
            analyses=final_state["analyses"],
            critiques=final_state["critiques"],
            synthesis=final_state["synthesis"],
            iterations_used=final_state["iteration"],
        )

        return output.model_dump()

    except Exception as e:
        self.update_state(state="FAILED", meta={"error": str(e)})
        raise


@celery_app.task(bind=True, name="cosilium.analyze_with_rag")
def analyze_with_rag_task(
    self,
    task: str,
    task_type: str,
    context: str,
    use_thinking_patterns: bool = True,
    use_prompt_evolution: bool = True
):
    """
    Celery task для анализа с RAG

    Использует:
    - Образы мышления великих умов
    - Эволюционирующие промпты
    """
    from src.rag import ThinkingPatterns, PromptEvolution
    from src.graph.workflow import app as langgraph_app
    from src.models.state import CosiliumState, CosiliumOutput

    self.update_state(state="PREPARING", meta={"stage": "rag_setup"})

    async def run():
        enhanced_task = task
        enhanced_context = context

        # Добавляем thinking patterns
        if use_thinking_patterns:
            patterns = ThinkingPatterns()
            relevant_patterns = await patterns.find_relevant_patterns(task, limit=2)
            if relevant_patterns:
                pattern_prompt = patterns.generate_thinking_prompt(relevant_patterns, task)
                enhanced_context = f"{context}\n\n{pattern_prompt}"

        # Получаем лучшие промпты
        if use_prompt_evolution:
            # Промпт эволюция будет применена внутри агентов
            pass

        self.update_state(state="ANALYZING", meta={"stage": "main_analysis"})

        initial_state: CosiliumState = {
            "task": enhanced_task,
            "task_type": task_type,
            "context": enhanced_context,
            "analyses": [],
            "critiques": [],
            "synthesis": None,
            "iteration": 0,
            "max_iterations": 3,
            "should_continue": True,
            "error": None,
        }

        config = {"configurable": {"thread_id": self.request.id}}
        return await langgraph_app.ainvoke(initial_state, config)

    try:
        final_state = run_async(run())

        output = CosiliumOutput(
            task=final_state["task"],
            analyses=final_state["analyses"],
            critiques=final_state["critiques"],
            synthesis=final_state["synthesis"],
            iterations_used=final_state["iteration"],
        )

        return output.model_dump()

    except Exception as e:
        self.update_state(state="FAILED", meta={"error": str(e)})
        raise


@celery_app.task(name="cosilium.warmup")
def warmup_task():
    """Прогрев кэшей и соединений"""
    from src.infrastructure import RedisStateStore, AnalysisCache

    async def run():
        # Проверяем Redis
        store = RedisStateStore()
        await store.redis.ping()
        await store.close()

        cache = AnalysisCache()
        await cache.redis.ping()
        await cache.close()

        return {"status": "ok"}

    return run_async(run())


def get_task_status(task_id: str) -> dict:
    """Получить статус задачи"""
    result = AsyncResult(task_id, app=celery_app)

    return {
        "task_id": task_id,
        "status": result.status,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
        "result": result.result if result.ready() else None,
        "meta": result.info if not result.ready() else None,
    }


def cancel_task(task_id: str) -> bool:
    """Отменить задачу"""
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=True)
    return True
