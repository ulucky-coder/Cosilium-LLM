"""
LLM-top: A/B Testing
Сравнение разных конфигураций агентов
"""

import random
import hashlib
from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel, Field
import redis.asyncio as redis

from src.config import get_settings


class Experiment(BaseModel):
    """Эксперимент A/B теста"""
    id: str
    name: str
    description: str
    status: str = "draft"  # draft, running, completed, stopped
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Варианты
    control: dict  # Контрольная группа (текущая конфигурация)
    treatment: dict  # Тестовая группа (новая конфигурация)

    # Распределение трафика
    treatment_percentage: float = 0.5  # 50% по умолчанию

    # Метрики для отслеживания
    primary_metric: str = "overall_quality"
    secondary_metrics: list[str] = []

    # Результаты
    control_results: list[float] = []
    treatment_results: list[float] = []


class ExperimentResult(BaseModel):
    """Результат эксперимента"""
    experiment_id: str
    variant: str  # control или treatment
    task_id: str
    metric_values: dict[str, float]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ABTester:
    """
    Система A/B тестирования

    Позволяет сравнивать:
    - Разные наборы агентов
    - Разные промпты
    - Разные параметры (temperature, max_tokens)
    - Разные конфигурации RAG
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:ab:"
        self.experiments: dict[str, Experiment] = {}

    async def create_experiment(
        self,
        name: str,
        description: str,
        control: dict,
        treatment: dict,
        treatment_percentage: float = 0.5,
        primary_metric: str = "overall_quality"
    ) -> Experiment:
        """Создать новый эксперимент"""
        exp_id = hashlib.md5(f"{name}{datetime.utcnow()}".encode()).hexdigest()[:8]

        experiment = Experiment(
            id=exp_id,
            name=name,
            description=description,
            control=control,
            treatment=treatment,
            treatment_percentage=treatment_percentage,
            primary_metric=primary_metric,
        )

        # Сохраняем в Redis
        await self.redis.set(
            f"{self.prefix}exp:{exp_id}",
            experiment.model_dump_json()
        )

        self.experiments[exp_id] = experiment
        return experiment

    async def start_experiment(self, experiment_id: str) -> bool:
        """Запустить эксперимент"""
        experiment = await self.get_experiment(experiment_id)
        if not experiment:
            return False

        experiment.status = "running"
        await self._save_experiment(experiment)
        return True

    async def stop_experiment(self, experiment_id: str) -> bool:
        """Остановить эксперимент"""
        experiment = await self.get_experiment(experiment_id)
        if not experiment:
            return False

        experiment.status = "stopped"
        await self._save_experiment(experiment)
        return True

    async def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        """Получить эксперимент"""
        if experiment_id in self.experiments:
            return self.experiments[experiment_id]

        data = await self.redis.get(f"{self.prefix}exp:{experiment_id}")
        if data:
            experiment = Experiment.model_validate_json(data)
            self.experiments[experiment_id] = experiment
            return experiment

        return None

    async def _save_experiment(self, experiment: Experiment):
        """Сохранить эксперимент"""
        await self.redis.set(
            f"{self.prefix}exp:{experiment.id}",
            experiment.model_dump_json()
        )
        self.experiments[experiment.id] = experiment

    def assign_variant(
        self,
        experiment: Experiment,
        user_id: str
    ) -> tuple[str, dict]:
        """
        Назначить вариант для пользователя

        Детерминированное назначение на основе user_id
        (один и тот же пользователь всегда получает один вариант)

        Returns:
            (variant_name, config)
        """
        if experiment.status != "running":
            return "control", experiment.control

        # Детерминированный хэш
        hash_input = f"{experiment.id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        bucket = (hash_value % 100) / 100

        if bucket < experiment.treatment_percentage:
            return "treatment", experiment.treatment
        else:
            return "control", experiment.control

    async def record_result(
        self,
        experiment_id: str,
        variant: str,
        task_id: str,
        metric_values: dict[str, float]
    ):
        """Записать результат"""
        result = ExperimentResult(
            experiment_id=experiment_id,
            variant=variant,
            task_id=task_id,
            metric_values=metric_values,
        )

        # Сохраняем результат
        key = f"{self.prefix}results:{experiment_id}:{variant}"
        await self.redis.rpush(key, result.model_dump_json())

        # Обновляем агрегаты в эксперименте
        experiment = await self.get_experiment(experiment_id)
        if experiment:
            primary_value = metric_values.get(experiment.primary_metric, 0)
            if variant == "control":
                experiment.control_results.append(primary_value)
            else:
                experiment.treatment_results.append(primary_value)
            await self._save_experiment(experiment)

    async def get_experiment_stats(self, experiment_id: str) -> dict:
        """Получить статистику эксперимента"""
        experiment = await self.get_experiment(experiment_id)
        if not experiment:
            return {}

        control = experiment.control_results
        treatment = experiment.treatment_results

        stats = {
            "experiment_id": experiment_id,
            "name": experiment.name,
            "status": experiment.status,
            "control": {
                "count": len(control),
                "mean": sum(control) / len(control) if control else 0,
                "min": min(control) if control else 0,
                "max": max(control) if control else 0,
            },
            "treatment": {
                "count": len(treatment),
                "mean": sum(treatment) / len(treatment) if treatment else 0,
                "min": min(treatment) if treatment else 0,
                "max": max(treatment) if treatment else 0,
            },
        }

        # Расчёт статистической значимости (упрощённый)
        if len(control) >= 10 and len(treatment) >= 10:
            control_mean = stats["control"]["mean"]
            treatment_mean = stats["treatment"]["mean"]
            lift = (treatment_mean - control_mean) / control_mean if control_mean > 0 else 0

            stats["lift"] = lift
            stats["lift_percent"] = lift * 100

            # Простой t-test (очень упрощённый)
            stats["significant"] = abs(lift) > 0.05 and min(len(control), len(treatment)) >= 30

        return stats

    async def list_experiments(self, status: Optional[str] = None) -> list[Experiment]:
        """Список экспериментов"""
        pattern = f"{self.prefix}exp:*"
        experiments = []

        async for key in self.redis.scan_iter(match=pattern):
            data = await self.redis.get(key)
            if data:
                exp = Experiment.model_validate_json(data)
                if status is None or exp.status == status:
                    experiments.append(exp)

        return experiments

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()


# Примеры конфигураций для экспериментов
EXPERIMENT_TEMPLATES = {
    "agent_selection": {
        "control": {
            "agents": ["chatgpt", "claude", "gemini", "deepseek"],
            "parallel": True,
        },
        "treatment": {
            "agents": ["chatgpt", "claude"],  # Только 2 агента
            "parallel": True,
        },
    },
    "prompt_style": {
        "control": {
            "prompt_style": "structured",
            "use_cot": False,
        },
        "treatment": {
            "prompt_style": "structured",
            "use_cot": True,  # Chain of Thought
        },
    },
    "temperature": {
        "control": {
            "temperature": 0.7,
        },
        "treatment": {
            "temperature": 0.3,  # Более детерминированный
        },
    },
    "rag_patterns": {
        "control": {
            "use_thinking_patterns": False,
        },
        "treatment": {
            "use_thinking_patterns": True,
        },
    },
}
