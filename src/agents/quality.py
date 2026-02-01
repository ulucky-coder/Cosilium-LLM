"""
Cosilium-LLM: Quality Enhancement
Улучшение качества анализа: калибровка, веса, fact-checking
"""

import re
import asyncio
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage

from src.models.state import AgentAnalysis, AgentCritique, SynthesisResult
from src.config import get_settings


class CalibrationRecord(BaseModel):
    """Запись о калибровке уверенности"""
    agent_name: str
    predicted_confidence: float
    actual_accuracy: float
    task_type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentWeight(BaseModel):
    """Вес агента для взвешенного синтеза"""
    agent_name: str
    base_weight: float = 1.0
    calibration_factor: float = 1.0  # Корректировка на основе калибровки
    domain_weight: dict[str, float] = {}  # Веса по доменам
    recent_performance: float = 1.0


class FactCheckResult(BaseModel):
    """Результат проверки факта"""
    claim: str
    verified: bool
    confidence: float
    sources: list[str] = []
    contradiction: Optional[str] = None


class ConfidenceCalibrator:
    """
    Калибратор уверенности агентов

    Отслеживает соотношение заявленной уверенности и фактической точности,
    корректирует оценки для более реалистичных прогнозов
    """

    def __init__(self):
        self.history: list[CalibrationRecord] = []
        self.calibration_curves: dict[str, dict] = {}

    def record_outcome(
        self,
        agent_name: str,
        predicted_confidence: float,
        actual_accuracy: float,
        task_type: str
    ):
        """Записать результат для калибровки"""
        record = CalibrationRecord(
            agent_name=agent_name,
            predicted_confidence=predicted_confidence,
            actual_accuracy=actual_accuracy,
            task_type=task_type,
        )
        self.history.append(record)
        self._update_calibration_curve(agent_name)

    def _update_calibration_curve(self, agent_name: str):
        """Обновить кривую калибровки для агента"""
        agent_records = [r for r in self.history if r.agent_name == agent_name]

        if len(agent_records) < 10:
            return

        # Группируем по бинам уверенности (0-0.5, 0.5-0.6, ..., 0.9-1.0)
        bins = {}
        for r in agent_records:
            bin_key = int(r.predicted_confidence * 10) / 10
            if bin_key not in bins:
                bins[bin_key] = []
            bins[bin_key].append(r.actual_accuracy)

        # Средняя точность для каждого бина
        calibration = {}
        for bin_key, accuracies in bins.items():
            calibration[bin_key] = sum(accuracies) / len(accuracies)

        self.calibration_curves[agent_name] = calibration

    def calibrate_confidence(
        self,
        agent_name: str,
        raw_confidence: float
    ) -> float:
        """
        Калибровать уверенность агента

        Returns:
            Откалиброванная уверенность
        """
        if agent_name not in self.calibration_curves:
            return raw_confidence

        curve = self.calibration_curves[agent_name]
        bin_key = int(raw_confidence * 10) / 10

        if bin_key in curve:
            # Интерполяция между соседними бинами
            return curve[bin_key]

        return raw_confidence

    def get_calibration_factor(self, agent_name: str) -> float:
        """
        Получить фактор калибровки (overconfidence/underconfidence)

        Returns:
            > 1.0: агент недооценивает уверенность
            < 1.0: агент переоценивает уверенность
            = 1.0: хорошо откалиброван
        """
        agent_records = [r for r in self.history if r.agent_name == agent_name]

        if len(agent_records) < 5:
            return 1.0

        avg_predicted = sum(r.predicted_confidence for r in agent_records) / len(agent_records)
        avg_actual = sum(r.actual_accuracy for r in agent_records) / len(agent_records)

        if avg_predicted == 0:
            return 1.0

        return avg_actual / avg_predicted


class WeightedSynthesizer:
    """
    Взвешенный синтезатор

    Объединяет анализы с учётом:
    - Исторической точности агентов
    - Калибровки уверенности
    - Специализации по доменам
    - Недавней производительности
    """

    def __init__(self):
        self.agent_weights: dict[str, AgentWeight] = {
            "ChatGPT": AgentWeight(
                agent_name="ChatGPT",
                base_weight=1.0,
                domain_weight={
                    "strategy": 0.9,
                    "research": 1.0,
                    "development": 1.1,
                }
            ),
            "Claude": AgentWeight(
                agent_name="Claude",
                base_weight=1.1,  # Немного выше из-за роли интегратора
                domain_weight={
                    "strategy": 1.1,
                    "research": 1.0,
                    "audit": 1.2,
                }
            ),
            "Gemini": AgentWeight(
                agent_name="Gemini",
                base_weight=0.9,
                domain_weight={
                    "research": 1.1,
                    "investment": 0.8,
                }
            ),
            "DeepSeek": AgentWeight(
                agent_name="DeepSeek",
                base_weight=1.0,
                domain_weight={
                    "development": 1.2,
                    "investment": 1.1,
                }
            ),
        }
        self.calibrator = ConfidenceCalibrator()

    def get_weight(self, agent_name: str, task_type: str) -> float:
        """Получить итоговый вес агента для задачи"""
        if agent_name not in self.agent_weights:
            return 1.0

        w = self.agent_weights[agent_name]
        domain_factor = w.domain_weight.get(task_type, 1.0)
        calibration_factor = self.calibrator.get_calibration_factor(agent_name)

        return w.base_weight * domain_factor * calibration_factor * w.recent_performance

    def weighted_average_confidence(
        self,
        analyses: list[AgentAnalysis],
        task_type: str
    ) -> float:
        """Взвешенное среднее уверенности"""
        if not analyses:
            return 0.5

        total_weight = 0
        weighted_sum = 0

        for analysis in analyses:
            weight = self.get_weight(analysis.agent_name, task_type)
            calibrated_conf = self.calibrator.calibrate_confidence(
                analysis.agent_name,
                analysis.confidence
            )
            weighted_sum += calibrated_conf * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.5

    def update_performance(
        self,
        agent_name: str,
        critique_scores: list[float]
    ):
        """Обновить показатель недавней производительности"""
        if agent_name not in self.agent_weights:
            return

        if not critique_scores:
            return

        # Среднее от последних критик, нормализованное к 1.0
        avg_score = sum(critique_scores) / len(critique_scores) / 10
        alpha = 0.3  # Скорость обновления

        current = self.agent_weights[agent_name].recent_performance
        self.agent_weights[agent_name].recent_performance = (
            alpha * avg_score + (1 - alpha) * current
        )


class FactChecker:
    """
    Проверка фактов

    Использует поисковые API и LLM для верификации утверждений
    """

    def __init__(self):
        settings = get_settings()
        from langchain_openai import ChatOpenAI
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0,
            api_key=settings.openai_api_key,
        )

    async def extract_claims(self, analysis: str) -> list[str]:
        """Извлечь проверяемые утверждения из анализа"""
        system = """Извлеки из текста конкретные фактические утверждения, которые можно проверить.

Включай только:
- Статистику и цифры
- Исторические факты
- Утверждения о компаниях/продуктах
- Научные факты

Не включай:
- Мнения и оценки
- Прогнозы
- Общие утверждения

Верни список утверждений, по одному на строку."""

        response = await self.llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=analysis),
        ])

        claims = [
            line.strip().lstrip("- ").lstrip("• ")
            for line in response.content.split("\n")
            if line.strip() and not line.startswith("#")
        ]

        return claims[:10]  # Ограничиваем количество

    async def verify_claim(self, claim: str) -> FactCheckResult:
        """Верифицировать одно утверждение"""
        system = """Проверь фактическое утверждение.

Оцени:
1. Можно ли это проверить?
2. Насколько это вероятно правда? (0-1)
3. Есть ли известные противоречия?

Отвечай в формате:
VERIFIED: true/false/uncertain
CONFIDENCE: 0.X
CONTRADICTION: [если есть]
REASONING: [краткое объяснение]"""

        response = await self.llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Утверждение: {claim}"),
        ])

        content = response.content

        # Парсинг ответа
        verified = "true" in content.lower().split("verified:")[1].split("\n")[0] if "verified:" in content.lower() else None

        confidence = 0.5
        conf_match = re.search(r"confidence:\s*(0\.\d+)", content.lower())
        if conf_match:
            confidence = float(conf_match.group(1))

        contradiction = None
        if "contradiction:" in content.lower():
            contr_part = content.lower().split("contradiction:")[1].split("\n")[0].strip()
            if contr_part and contr_part not in ["none", "нет", "-"]:
                contradiction = contr_part

        return FactCheckResult(
            claim=claim,
            verified=verified if verified is not None else (confidence > 0.7),
            confidence=confidence,
            contradiction=contradiction,
        )

    async def check_analysis(
        self,
        analysis: AgentAnalysis,
        max_claims: int = 5
    ) -> list[FactCheckResult]:
        """Проверить факты в анализе"""
        claims = await self.extract_claims(analysis.analysis)
        claims = claims[:max_claims]

        # Параллельная проверка
        results = await asyncio.gather(*[
            self.verify_claim(claim) for claim in claims
        ], return_exceptions=True)

        return [r for r in results if isinstance(r, FactCheckResult)]


class ChainOfThoughtEnhancer:
    """
    Улучшение через Chain-of-Thought

    Добавляет явные шаги рассуждения в промпты
    """

    COT_TEMPLATE = """Решай задачу пошагово, явно показывая ход рассуждений.

## Шаг 1: Понимание задачи
Переформулируй задачу своими словами. Что именно нужно определить/решить?

## Шаг 2: Декомпозиция
Разбей задачу на подзадачи. Какие вопросы нужно ответить?

## Шаг 3: Сбор информации
Что мы знаем? Что нужно предположить? Какие данные критичны?

## Шаг 4: Анализ каждого аспекта
Для каждой подзадачи:
- Предпосылки
- Рассуждение
- Промежуточный вывод

## Шаг 5: Синтез
Объедини выводы. Проверь на противоречия.

## Шаг 6: Валидация
- Есть ли логические ошибки?
- Что может быть неправильно?
- Насколько уверен в выводах?

## Шаг 7: Финальный ответ
Сформулируй итоговый вывод с уровнем уверенности.

---

Задача: {task}

Контекст: {context}

Начинай анализ:"""

    STRUCTURED_OUTPUT_TEMPLATE = """После Chain-of-Thought анализа, структурируй ответ:

```json
{{
  "understanding": "краткое понимание задачи",
  "sub_questions": ["вопрос 1", "вопрос 2"],
  "assumptions": ["допущение 1", "допущение 2"],
  "reasoning_steps": [
    {{"step": 1, "question": "...", "analysis": "...", "conclusion": "..."}},
    ...
  ],
  "synthesis": "объединённый вывод",
  "confidence": 0.X,
  "risks": ["риск 1", "риск 2"],
  "falsification": "при каких условиях вывод неверен"
}}
```"""

    @classmethod
    def enhance_prompt(cls, base_prompt: str, task: str, context: str = "") -> str:
        """Добавить Chain-of-Thought к промпту"""
        cot_section = cls.COT_TEMPLATE.format(task=task, context=context)
        return f"{base_prompt}\n\n{cot_section}"

    @classmethod
    def get_structured_prompt(cls, task: str, context: str = "") -> str:
        """Получить промпт с CoT и структурированным выводом"""
        return cls.COT_TEMPLATE.format(task=task, context=context) + "\n\n" + cls.STRUCTURED_OUTPUT_TEMPLATE


class QualityEnhancer:
    """
    Комплексное улучшение качества

    Объединяет калибровку, веса, fact-checking и CoT
    """

    def __init__(self):
        self.calibrator = ConfidenceCalibrator()
        self.weighted_synth = WeightedSynthesizer()
        self.fact_checker = FactChecker()
        self.cot = ChainOfThoughtEnhancer()

    async def enhance_analysis(
        self,
        analysis: AgentAnalysis,
        task_type: str,
        check_facts: bool = True
    ) -> dict:
        """
        Улучшить анализ

        Returns:
            {
                "calibrated_confidence": float,
                "weight": float,
                "fact_check_results": list[FactCheckResult],
                "quality_score": float
            }
        """
        result = {
            "original_confidence": analysis.confidence,
            "calibrated_confidence": self.calibrator.calibrate_confidence(
                analysis.agent_name,
                analysis.confidence
            ),
            "weight": self.weighted_synth.get_weight(
                analysis.agent_name,
                task_type
            ),
            "fact_check_results": [],
            "quality_score": 0.0,
        }

        if check_facts:
            fact_results = await self.fact_checker.check_analysis(analysis, max_claims=3)
            result["fact_check_results"] = fact_results

            # Quality score на основе верифицированных фактов
            if fact_results:
                verified_ratio = sum(1 for f in fact_results if f.verified) / len(fact_results)
                avg_confidence = sum(f.confidence for f in fact_results) / len(fact_results)
                result["quality_score"] = (verified_ratio + avg_confidence) / 2
            else:
                result["quality_score"] = result["calibrated_confidence"]
        else:
            result["quality_score"] = result["calibrated_confidence"]

        return result
