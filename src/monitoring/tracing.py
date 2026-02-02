"""
LLM-top: Tracing
LangSmith интеграция для мониторинга
"""

import os
from typing import Optional, Any
from datetime import datetime
from contextlib import contextmanager
from functools import wraps
import uuid

from langsmith import Client
from langsmith.run_trees import RunTree
from pydantic import BaseModel

from src.config import get_settings


class TraceMetadata(BaseModel):
    """Метаданные трейса"""
    task_id: str
    task_type: str
    iteration: int = 0
    agent_name: Optional[str] = None
    stage: str  # analysis, critique, synthesis
    start_time: datetime
    end_time: Optional[datetime] = None
    tokens_used: int = 0
    cost_usd: float = 0
    error: Optional[str] = None


class CosiliumTracer:
    """
    Трейсер для LangSmith

    Обеспечивает:
    - Детальный трейсинг каждого LLM вызова
    - Группировку по задачам
    - Метрики качества
    - Визуализацию в LangSmith UI
    """

    def __init__(self):
        settings = get_settings()
        self.enabled = settings.langchain_tracing_v2
        self.project = settings.langchain_project

        if self.enabled and settings.langchain_api_key:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
            os.environ["LANGCHAIN_PROJECT"] = self.project

            self.client = Client()
        else:
            self.client = None

        self._active_runs: dict[str, RunTree] = {}

    @contextmanager
    def trace_task(self, task_id: str, task: str, task_type: str):
        """
        Context manager для трейсинга всей задачи

        Usage:
            with tracer.trace_task(task_id, task, task_type) as trace:
                # ... выполнение задачи
                trace.log_iteration(1, analyses, critiques)
        """
        if not self.enabled:
            yield _NoOpTrace()
            return

        run = RunTree(
            name=f"Cosilium Analysis: {task[:50]}...",
            run_type="chain",
            inputs={"task": task, "task_type": task_type},
            project_name=self.project,
            extra={
                "metadata": {
                    "task_id": task_id,
                    "task_type": task_type,
                }
            }
        )

        self._active_runs[task_id] = run

        try:
            yield _TaskTrace(run, self)
            run.end(outputs={"status": "completed"})
        except Exception as e:
            run.end(error=str(e))
            raise
        finally:
            run.post()
            del self._active_runs[task_id]

    @contextmanager
    def trace_agent(
        self,
        task_id: str,
        agent_name: str,
        stage: str,
        inputs: dict
    ):
        """
        Context manager для трейсинга агента

        Usage:
            with tracer.trace_agent(task_id, "ChatGPT", "analysis", inputs) as span:
                result = await agent.analyze(...)
                span.set_outputs(result)
        """
        if not self.enabled or task_id not in self._active_runs:
            yield _NoOpSpan()
            return

        parent_run = self._active_runs[task_id]

        child_run = parent_run.create_child(
            name=f"{agent_name} - {stage}",
            run_type="llm",
            inputs=inputs,
        )

        try:
            yield _AgentSpan(child_run)
            child_run.end()
        except Exception as e:
            child_run.end(error=str(e))
            raise
        finally:
            child_run.post()

    def log_feedback(
        self,
        run_id: str,
        score: float,
        comment: Optional[str] = None,
        feedback_type: str = "quality"
    ):
        """Записать feedback для run"""
        if not self.client:
            return

        self.client.create_feedback(
            run_id=run_id,
            key=feedback_type,
            score=score,
            comment=comment,
        )

    def get_run_url(self, task_id: str) -> Optional[str]:
        """Получить URL для просмотра run в LangSmith"""
        if task_id in self._active_runs:
            run = self._active_runs[task_id]
            return f"https://smith.langchain.com/o/default/projects/p/{self.project}/r/{run.id}"
        return None

    async def get_project_stats(self) -> dict:
        """Получить статистику проекта"""
        if not self.client:
            return {}

        try:
            runs = list(self.client.list_runs(
                project_name=self.project,
                execution_order=1,
                limit=100,
            ))

            total_runs = len(runs)
            successful = sum(1 for r in runs if r.error is None)
            total_tokens = sum(
                (r.total_tokens or 0) for r in runs
            )
            total_cost = sum(
                (r.total_cost or 0) for r in runs
            )

            return {
                "total_runs": total_runs,
                "success_rate": successful / total_runs if total_runs > 0 else 0,
                "total_tokens": total_tokens,
                "total_cost_usd": total_cost,
                "avg_tokens_per_run": total_tokens / total_runs if total_runs > 0 else 0,
            }
        except Exception:
            return {}


class _TaskTrace:
    """Хелпер для трейсинга задачи"""

    def __init__(self, run: RunTree, tracer: CosiliumTracer):
        self.run = run
        self.tracer = tracer
        self.iterations = []

    def log_iteration(
        self,
        iteration: int,
        analyses: list,
        critiques: list,
        consensus: float = 0
    ):
        """Записать итерацию"""
        self.iterations.append({
            "iteration": iteration,
            "analyses_count": len(analyses),
            "critiques_count": len(critiques),
            "consensus": consensus,
        })

        self.run.add_metadata({
            f"iteration_{iteration}": {
                "analyses": len(analyses),
                "critiques": len(critiques),
                "consensus": consensus,
            }
        })

    def set_result(self, result: dict):
        """Установить результат"""
        self.run.end(outputs=result)


class _AgentSpan:
    """Хелпер для трейсинга агента"""

    def __init__(self, run: RunTree):
        self.run = run
        self.start_time = datetime.utcnow()

    def set_outputs(self, outputs: dict):
        """Установить выходы"""
        self.run.end(outputs=outputs)

    def set_tokens(self, input_tokens: int, output_tokens: int):
        """Установить использованные токены"""
        self.run.add_metadata({
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        })


class _NoOpTrace:
    """No-op трейс когда трейсинг отключён"""

    def log_iteration(self, *args, **kwargs):
        pass

    def set_result(self, *args, **kwargs):
        pass


class _NoOpSpan:
    """No-op span когда трейсинг отключён"""

    def set_outputs(self, *args, **kwargs):
        pass

    def set_tokens(self, *args, **kwargs):
        pass


# Декоратор для автоматического трейсинга
def trace_function(name: str = None, run_type: str = "chain"):
    """
    Декоратор для трейсинга функции

    Usage:
        @trace_function("my_function")
        async def my_function(x, y):
            return x + y
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            settings = get_settings()
            if not settings.langchain_tracing_v2:
                return await func(*args, **kwargs)

            run = RunTree(
                name=name or func.__name__,
                run_type=run_type,
                inputs={"args": str(args), "kwargs": str(kwargs)},
                project_name=settings.langchain_project,
            )

            try:
                result = await func(*args, **kwargs)
                run.end(outputs={"result": str(result)[:1000]})
                return result
            except Exception as e:
                run.end(error=str(e))
                raise
            finally:
                run.post()

        return wrapper
    return decorator
