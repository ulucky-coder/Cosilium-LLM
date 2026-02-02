"""
LLM-top: Iterative Process Improvements
Adaptive iterations, focused refinement, disagreement resolution
"""

import re
from typing import Optional
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from src.models.state import AgentAnalysis, AgentCritique, SynthesisResult
from src.config import get_settings


class IterationMetrics(BaseModel):
    """Метрики итерации"""
    iteration_number: int
    consensus_level: float
    avg_critique_score: float
    disagreement_count: int
    improvement_delta: float = 0.0  # Изменение качества от прошлой итерации
    weak_areas: list[str] = []


class DisagreementPoint(BaseModel):
    """Точка разногласия между агентами"""
    topic: str
    positions: dict[str, str]  # agent_name -> position
    severity: float  # 0-1, насколько критично
    resolution_attempts: int = 0
    resolved: bool = False
    resolution: Optional[str] = None


class RefinementTarget(BaseModel):
    """Цель для уточнения"""
    area: str
    description: str
    agent_suggestions: list[str]
    priority: float  # 0-1


class AdaptiveIterationController:
    """
    Контроллер адаптивных итераций

    Динамически определяет:
    - Нужна ли следующая итерация
    - Какие области требуют уточнения
    - Когда достаточно консенсуса
    """

    def __init__(self):
        self.iteration_history: list[IterationMetrics] = []
        self.min_consensus = 0.75
        self.max_iterations = 5
        self.improvement_threshold = 0.05  # Минимальное улучшение для продолжения

    def should_continue(
        self,
        current_metrics: IterationMetrics,
        synthesis: Optional[SynthesisResult]
    ) -> tuple[bool, str]:
        """
        Решить, продолжать ли итерации

        Returns:
            (should_continue, reason)
        """
        # Максимум итераций
        if current_metrics.iteration_number >= self.max_iterations:
            return False, "max_iterations_reached"

        # Достаточный консенсус
        if current_metrics.consensus_level >= self.min_consensus:
            return False, "consensus_reached"

        # Проверяем улучшение
        if len(self.iteration_history) > 0:
            prev = self.iteration_history[-1]
            improvement = current_metrics.consensus_level - prev.consensus_level

            if improvement < self.improvement_threshold and current_metrics.iteration_number >= 2:
                return False, "diminishing_returns"

            current_metrics.improvement_delta = improvement

        # Есть слабые области - продолжаем
        if current_metrics.weak_areas:
            return True, "weak_areas_identified"

        # Есть серьёзные разногласия - продолжаем
        if current_metrics.disagreement_count > 2:
            return True, "unresolved_disagreements"

        # По умолчанию продолжаем если консенсус низкий
        return current_metrics.consensus_level < self.min_consensus, "consensus_building"

    def calculate_metrics(
        self,
        iteration: int,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique],
        synthesis: Optional[SynthesisResult]
    ) -> IterationMetrics:
        """Рассчитать метрики итерации"""
        # Средний score критик
        avg_score = 0
        if critiques:
            avg_score = sum(c.score for c in critiques) / len(critiques)

        # Уровень консенсуса
        consensus = synthesis.consensus_level if synthesis else avg_score / 10

        # Подсчёт разногласий
        disagreements = self._count_disagreements(critiques)

        # Слабые области
        weak_areas = self._identify_weak_areas(critiques)

        metrics = IterationMetrics(
            iteration_number=iteration,
            consensus_level=consensus,
            avg_critique_score=avg_score,
            disagreement_count=disagreements,
            weak_areas=weak_areas,
        )

        self.iteration_history.append(metrics)
        return metrics

    def _count_disagreements(self, critiques: list[AgentCritique]) -> int:
        """Подсчитать количество разногласий"""
        count = 0
        for critique in critiques:
            if critique.score < 6.0:  # Низкая оценка = разногласие
                count += 1
        return count

    def _identify_weak_areas(self, critiques: list[AgentCritique]) -> list[str]:
        """Определить слабые области из критик"""
        weak_areas = []
        for critique in critiques:
            weak_areas.extend(critique.weaknesses)

        # Дедупликация и приоритизация
        unique_areas = list(set(weak_areas))
        return unique_areas[:5]  # Топ-5


class FocusedRefiner:
    """
    Фокусированное уточнение

    Вместо полного повторного анализа, уточняет только слабые области
    """

    def __init__(self):
        settings = get_settings()
        self.llm = ChatAnthropic(
            model=settings.claude_model,
            temperature=0.5,
            api_key=settings.anthropic_api_key,
        )

    async def identify_refinement_targets(
        self,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique]
    ) -> list[RefinementTarget]:
        """Определить цели для уточнения"""
        # Агрегируем слабости из всех критик
        all_weaknesses = []
        for critique in critiques:
            for weakness in critique.weaknesses:
                all_weaknesses.append({
                    "weakness": weakness,
                    "critic": critique.critic_name,
                    "target": critique.target_name,
                    "suggestions": critique.suggestions,
                })

        # Группируем похожие слабости
        targets = []
        processed = set()

        for w in all_weaknesses:
            if w["weakness"] in processed:
                continue

            # Находим похожие
            related = [
                x for x in all_weaknesses
                if self._is_similar(w["weakness"], x["weakness"])
            ]

            suggestions = []
            for r in related:
                suggestions.extend(r.get("suggestions", []))

            priority = len(related) / len(all_weaknesses) if all_weaknesses else 0

            targets.append(RefinementTarget(
                area=w["weakness"],
                description=f"Критикуется {len(related)} агентами",
                agent_suggestions=list(set(suggestions))[:3],
                priority=priority,
            ))

            for r in related:
                processed.add(r["weakness"])

        # Сортируем по приоритету
        targets.sort(key=lambda t: t.priority, reverse=True)
        return targets[:3]  # Топ-3 для уточнения

    def _is_similar(self, text1: str, text2: str) -> bool:
        """Простая проверка похожести текстов"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        if not words1 or not words2:
            return False
        intersection = words1 & words2
        return len(intersection) / min(len(words1), len(words2)) > 0.5

    async def refine_analysis(
        self,
        original_analysis: AgentAnalysis,
        targets: list[RefinementTarget],
        critiques: list[AgentCritique]
    ) -> AgentAnalysis:
        """
        Уточнить анализ по целевым областям

        Не переписывает весь анализ, а дополняет слабые места
        """
        # Собираем релевантные критики
        relevant_critiques = [
            c for c in critiques
            if c.target_name == original_analysis.agent_name
        ]

        system = """Ты улучшаешь существующий анализ, фокусируясь на конкретных слабостях.

НЕ переписывай весь анализ. Только:
1. Усиль указанные слабые области
2. Добавь недостающие аспекты
3. Учти предложения критиков

Формат: верни ДОПОЛНЕНИЕ к анализу, не полную замену."""

        targets_text = "\n".join([
            f"- {t.area}: {t.description}\n  Предложения: {', '.join(t.agent_suggestions)}"
            for t in targets
        ])

        critiques_text = "\n".join([
            f"От {c.critic_name}: {c.critique[:500]}..."
            for c in relevant_critiques[:2]
        ])

        user = f"""Оригинальный анализ от {original_analysis.agent_name}:
```
{original_analysis.analysis}
```

Слабые области для улучшения:
{targets_text}

Критики:
{critiques_text}

Напиши ДОПОЛНЕНИЕ к анализу, усиливающее слабые области:"""

        response = await self.llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user),
        ])

        # Объединяем оригинал и дополнение
        refined_analysis = f"{original_analysis.analysis}\n\n## Дополнение (после критики)\n\n{response.content}"

        return AgentAnalysis(
            agent_name=original_analysis.agent_name,
            analysis=refined_analysis,
            confidence=min(original_analysis.confidence + 0.05, 0.95),  # Небольшое повышение
            key_points=original_analysis.key_points,
            risks=original_analysis.risks,
            assumptions=original_analysis.assumptions,
        )


class DisagreementResolver:
    """
    Разрешение разногласий между агентами

    Структурированный процесс для разрешения противоречий
    """

    def __init__(self):
        settings = get_settings()
        self.llm = ChatAnthropic(
            model=settings.claude_model,
            temperature=0.3,
            api_key=settings.anthropic_api_key,
        )

    async def identify_disagreements(
        self,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique]
    ) -> list[DisagreementPoint]:
        """Выявить точки разногласий"""
        system = """Проанализируй анализы нескольких агентов и выяви точки разногласий.

Для каждого разногласия укажи:
- Тему разногласия
- Позицию каждого агента
- Насколько это критично (0-1)

Формат:
DISAGREEMENT: [тема]
AGENT1: [имя] - [позиция]
AGENT2: [имя] - [позиция]
SEVERITY: [0-1]
---"""

        analyses_text = "\n\n".join([
            f"### {a.agent_name}\n{a.analysis[:1000]}..."
            for a in analyses
        ])

        response = await self.llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Анализы:\n{analyses_text}"),
        ])

        # Парсим разногласия
        disagreements = []
        blocks = response.content.split("---")

        for block in blocks:
            if "DISAGREEMENT:" not in block:
                continue

            lines = block.strip().split("\n")
            topic = ""
            positions = {}
            severity = 0.5

            for line in lines:
                if line.startswith("DISAGREEMENT:"):
                    topic = line.replace("DISAGREEMENT:", "").strip()
                elif line.startswith("AGENT"):
                    # Parse "AGENT1: Name - Position"
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        agent_pos = parts[1].strip()
                        if " - " in agent_pos:
                            name, pos = agent_pos.split(" - ", 1)
                            positions[name.strip()] = pos.strip()
                elif line.startswith("SEVERITY:"):
                    try:
                        severity = float(line.replace("SEVERITY:", "").strip())
                    except ValueError:
                        pass

            if topic and positions:
                disagreements.append(DisagreementPoint(
                    topic=topic,
                    positions=positions,
                    severity=severity,
                ))

        return disagreements

    async def resolve_disagreement(
        self,
        disagreement: DisagreementPoint,
        task: str
    ) -> DisagreementPoint:
        """Попытаться разрешить разногласие"""
        system = """Ты арбитр, разрешающий разногласие между экспертами.

Твоя задача:
1. Понять суть каждой позиции
2. Оценить аргументы
3. Найти точки соприкосновения
4. Предложить синтезированное решение или объяснить, почему обе позиции валидны

Будь объективен. Не выбирай сторону просто так — аргументируй."""

        positions_text = "\n".join([
            f"- {agent}: {pos}"
            for agent, pos in disagreement.positions.items()
        ])

        user = f"""Задача: {task}

Тема разногласия: {disagreement.topic}

Позиции:
{positions_text}

Критичность: {disagreement.severity}

Разреши это разногласие:"""

        response = await self.llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user),
        ])

        disagreement.resolution_attempts += 1
        disagreement.resolution = response.content
        disagreement.resolved = True

        return disagreement


class MetaAnalyzer:
    """
    Мета-анализ качества предыдущих анализов

    Анализирует паттерны в качестве анализов для улучшения процесса
    """

    def __init__(self):
        settings = get_settings()
        self.llm = ChatAnthropic(
            model="claude-3-haiku-20240307",
            temperature=0.2,
            api_key=settings.anthropic_api_key,
        )

    async def analyze_quality_patterns(
        self,
        analyses: list[AgentAnalysis],
        critiques: list[AgentCritique]
    ) -> dict:
        """
        Анализ паттернов качества

        Returns:
            {
                "overall_quality": float,
                "agent_rankings": {agent: score},
                "common_weaknesses": [str],
                "improvement_suggestions": [str],
            }
        """
        # Агрегируем scores по агентам
        agent_scores = {}
        for critique in critiques:
            target = critique.target_name
            if target not in agent_scores:
                agent_scores[target] = []
            agent_scores[target].append(critique.score)

        # Средние scores
        agent_rankings = {
            agent: sum(scores) / len(scores)
            for agent, scores in agent_scores.items()
            if scores
        }

        # Общее качество
        all_scores = [s for scores in agent_scores.values() for s in scores]
        overall_quality = sum(all_scores) / len(all_scores) if all_scores else 5.0

        # Общие слабости
        all_weaknesses = []
        for critique in critiques:
            all_weaknesses.extend(critique.weaknesses)

        # Подсчёт частоты
        weakness_counts = {}
        for w in all_weaknesses:
            w_lower = w.lower()
            weakness_counts[w_lower] = weakness_counts.get(w_lower, 0) + 1

        common_weaknesses = [
            w for w, count in sorted(weakness_counts.items(), key=lambda x: -x[1])
            if count >= 2
        ][:5]

        # Предложения по улучшению
        all_suggestions = []
        for critique in critiques:
            all_suggestions.extend(critique.suggestions)

        return {
            "overall_quality": overall_quality / 10,  # Нормализуем к 0-1
            "agent_rankings": agent_rankings,
            "common_weaknesses": common_weaknesses,
            "improvement_suggestions": list(set(all_suggestions))[:5],
        }

    async def suggest_process_improvements(
        self,
        iteration_history: list[IterationMetrics]
    ) -> list[str]:
        """Предложить улучшения процесса на основе истории"""
        if len(iteration_history) < 2:
            return []

        # Анализируем тренды
        consensus_trend = [m.consensus_level for m in iteration_history]
        improving = all(
            consensus_trend[i] <= consensus_trend[i + 1]
            for i in range(len(consensus_trend) - 1)
        )

        suggestions = []

        if not improving:
            suggestions.append("Консенсус не улучшается — рассмотреть смену состава агентов")

        if iteration_history[-1].disagreement_count > 3:
            suggestions.append("Много разногласий — добавить раунд структурированного debate")

        avg_improvement = sum(m.improvement_delta for m in iteration_history[1:]) / (len(iteration_history) - 1)
        if avg_improvement < 0.02:
            suggestions.append("Низкий прирост качества — возможно, задача требует другого подхода")

        return suggestions
