"""
LLM-top: Quality Metrics
Метрики качества анализа
"""

import re
from typing import Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import redis.asyncio as redis

from src.config import get_settings
from src.models.state import AgentAnalysis, AgentCritique, SynthesisResult


class AnalysisMetrics(BaseModel):
    """Метрики одного анализа"""
    task_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Структурные метрики
    has_key_points: bool = False
    has_risks: bool = False
    has_assumptions: bool = False
    has_confidence: bool = False
    has_falsification: bool = False

    # Количественные метрики
    key_points_count: int = 0
    risks_count: int = 0
    word_count: int = 0
    section_count: int = 0

    # Качественные метрики (от критиков)
    avg_critique_score: float = 0
    consensus_level: float = 0

    # Вычисляемые
    completeness_score: float = 0
    structure_score: float = 0
    overall_quality: float = 0


class AggregatedMetrics(BaseModel):
    """Агрегированные метрики"""
    period: str  # daily, weekly, monthly
    start_date: date
    end_date: date

    total_analyses: int = 0
    avg_quality: float = 0
    avg_consensus: float = 0
    avg_iterations: float = 0

    # По агентам
    agent_scores: dict[str, float] = {}

    # По типам задач
    task_type_scores: dict[str, float] = {}

    # Тренды
    quality_trend: float = 0  # +/- от предыдущего периода


class QualityMetrics:
    """
    Система метрик качества

    Измеряет:
    - Структурную полноту анализа
    - Согласованность между агентами
    - Качество выводов
    - Тренды во времени
    """

    def __init__(self):
        settings = get_settings()
        self.redis = redis.from_url(settings.redis_url)
        self.prefix = "cosilium:metrics:"

    def calculate_analysis_metrics(
        self,
        task_id: str,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique],
        synthesis: Optional[SynthesisResult]
    ) -> AnalysisMetrics:
        """Рассчитать метрики для анализа"""
        metrics = AnalysisMetrics(task_id=task_id)

        if not analyses:
            return metrics

        # Агрегируем по всем анализам
        total_key_points = 0
        total_risks = 0
        total_words = 0
        has_structure = 0

        for analysis in analyses:
            # Проверяем наличие компонентов
            if analysis.key_points:
                metrics.has_key_points = True
                total_key_points += len(analysis.key_points)

            if analysis.risks:
                metrics.has_risks = True
                total_risks += len(analysis.risks)

            if analysis.assumptions:
                metrics.has_assumptions = True

            if analysis.confidence > 0:
                metrics.has_confidence = True

            # Проверяем фальсифицируемость
            if "фальсификац" in analysis.analysis.lower():
                metrics.has_falsification = True

            # Подсчёт слов и секций
            total_words += len(analysis.analysis.split())
            sections = len(re.findall(r"^##\s+", analysis.analysis, re.MULTILINE))
            if sections >= 3:
                has_structure += 1

        metrics.key_points_count = total_key_points
        metrics.risks_count = total_risks
        metrics.word_count = total_words // len(analyses)
        metrics.section_count = has_structure

        # Метрики от критиков
        if critiques:
            metrics.avg_critique_score = sum(c.score for c in critiques) / len(critiques)

        # Консенсус от синтеза
        if synthesis:
            metrics.consensus_level = synthesis.consensus_level

        # Вычисляем composite scores
        metrics.completeness_score = self._calc_completeness(metrics)
        metrics.structure_score = self._calc_structure(metrics, len(analyses))
        metrics.overall_quality = self._calc_overall(metrics)

        return metrics

    def _calc_completeness(self, m: AnalysisMetrics) -> float:
        """Рассчитать полноту"""
        score = 0
        if m.has_key_points:
            score += 0.25
        if m.has_risks:
            score += 0.25
        if m.has_assumptions:
            score += 0.2
        if m.has_confidence:
            score += 0.15
        if m.has_falsification:
            score += 0.15
        return score

    def _calc_structure(self, m: AnalysisMetrics, num_analyses: int) -> float:
        """Рассчитать структурированность"""
        score = 0

        # Наличие секций
        if m.section_count >= num_analyses * 0.5:
            score += 0.4

        # Достаточное количество контента
        if m.word_count >= 200:
            score += 0.3

        # Количество key points
        if m.key_points_count >= num_analyses * 2:
            score += 0.3

        return score

    def _calc_overall(self, m: AnalysisMetrics) -> float:
        """Рассчитать общее качество"""
        weights = {
            "completeness": 0.25,
            "structure": 0.20,
            "critique_score": 0.30,
            "consensus": 0.25,
        }

        score = (
            m.completeness_score * weights["completeness"] +
            m.structure_score * weights["structure"] +
            (m.avg_critique_score / 10) * weights["critique_score"] +
            m.consensus_level * weights["consensus"]
        )

        return score

    async def save_metrics(self, metrics: AnalysisMetrics):
        """Сохранить метрики"""
        today = date.today().isoformat()
        key = f"{self.prefix}daily:{today}"

        await self.redis.rpush(key, metrics.model_dump_json())
        await self.redis.expire(key, 86400 * 90)  # 90 дней

        # Обновляем агрегаты
        await self._update_aggregates(today, metrics)

    async def _update_aggregates(self, day: str, metrics: AnalysisMetrics):
        """Обновить агрегированные метрики"""
        pipe = self.redis.pipeline()

        # Инкрементируем счётчик
        pipe.incr(f"{self.prefix}count:{day}")

        # Суммы для средних
        pipe.incrbyfloat(f"{self.prefix}sum_quality:{day}", metrics.overall_quality)
        pipe.incrbyfloat(f"{self.prefix}sum_consensus:{day}", metrics.consensus_level)

        # TTL
        for suffix in ["count", "sum_quality", "sum_consensus"]:
            pipe.expire(f"{self.prefix}{suffix}:{day}", 86400 * 90)

        await pipe.execute()

    async def get_daily_metrics(self, day: Optional[date] = None) -> AggregatedMetrics:
        """Получить метрики за день"""
        day = day or date.today()
        day_str = day.isoformat()

        count = await self.redis.get(f"{self.prefix}count:{day_str}")
        sum_quality = await self.redis.get(f"{self.prefix}sum_quality:{day_str}")
        sum_consensus = await self.redis.get(f"{self.prefix}sum_consensus:{day_str}")

        count = int(count) if count else 0
        avg_quality = float(sum_quality) / count if count > 0 and sum_quality else 0
        avg_consensus = float(sum_consensus) / count if count > 0 and sum_consensus else 0

        return AggregatedMetrics(
            period="daily",
            start_date=day,
            end_date=day,
            total_analyses=count,
            avg_quality=avg_quality,
            avg_consensus=avg_consensus,
        )

    async def get_weekly_metrics(self, week_start: Optional[date] = None) -> AggregatedMetrics:
        """Получить метрики за неделю"""
        if week_start is None:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

        week_end = week_start + timedelta(days=6)

        total_count = 0
        total_quality = 0
        total_consensus = 0

        current = week_start
        while current <= week_end:
            daily = await self.get_daily_metrics(current)
            total_count += daily.total_analyses
            total_quality += daily.avg_quality * daily.total_analyses
            total_consensus += daily.avg_consensus * daily.total_analyses
            current += timedelta(days=1)

        return AggregatedMetrics(
            period="weekly",
            start_date=week_start,
            end_date=week_end,
            total_analyses=total_count,
            avg_quality=total_quality / total_count if total_count > 0 else 0,
            avg_consensus=total_consensus / total_count if total_count > 0 else 0,
        )

    async def get_agent_performance(self, days: int = 7) -> dict[str, float]:
        """Получить производительность по агентам"""
        # Собираем метрики за период
        performance = {}

        for i in range(days):
            day = (date.today() - timedelta(days=i)).isoformat()
            key = f"{self.prefix}daily:{day}"

            records = await self.redis.lrange(key, 0, -1)
            for record_json in records:
                metrics = AnalysisMetrics.model_validate_json(record_json)
                # Здесь можно было бы парсить по агентам
                # Упрощённо - общий score
                if "overall" not in performance:
                    performance["overall"] = []
                performance["overall"].append(metrics.overall_quality)

        # Средние
        return {
            agent: sum(scores) / len(scores)
            for agent, scores in performance.items()
            if scores
        }

    async def close(self):
        """Закрыть соединение"""
        await self.redis.close()
