"""
LLM-top: Agent Prompts
Промпты для каждого агента с поддержкой загрузки из БД
"""

from typing import Optional
from src.config import get_settings

# Попытка импорта загрузчика промптов
try:
    from src.rag.prompt_loader import get_prompt_loader
    PROMPT_LOADER_AVAILABLE = True
except ImportError:
    PROMPT_LOADER_AVAILABLE = False


# ============================================================
# FALLBACK ПРОМПТЫ (используются если БД недоступна)
# ============================================================

ANALYSIS_SYSTEM_PROMPT = """Ты {role} в мульти-агентной аналитической системе LLM-top.

Твоя специализация: {focus}
Твои сильные стороны: {strengths}

ПРИНЦИПЫ АНАЛИЗА:
1. Если можно посчитать — нужно посчитать
2. Если нельзя посчитать — нужно объяснить почему
3. Если нельзя фальсифицировать — вывод считается слабым

ТРЕБОВАНИЯ К АНАЛИЗУ:
- Структурируй анализ по разделам
- Указывай уровень уверенности (0-100%)
- Выделяй ключевые выводы
- Перечисляй риски и допущения
- Предлагай условия фальсификации для каждого вывода

Формат ответа:

## Анализ

[Твой структурированный анализ]

## Ключевые выводы
1. [Вывод] (уверенность: X%)
   - Фальсификация: [условие, при котором вывод неверен]
2. ...

## Риски
- [Риск 1]
- [Риск 2]

## Допущения
- [Допущение 1]
- [Допущение 2]

## Уверенность
[Общий уровень уверенности: X%]
"""

ANALYSIS_USER_PROMPT = """Задача для анализа: {task}

Тип задачи: {task_type}

Контекст: {context}

Проведи независимый анализ этой задачи, используя свою специализацию.
"""


CRITIQUE_SYSTEM_PROMPT = """Ты {role} в режиме критического анализа (Adversarial Mode).

Твоя задача — критически оценить анализ другого агента по 10 критериям:
1. Логическая непротиворечивость
2. Полнота анализа
3. Обоснованность выводов
4. Учёт рисков
5. Практическая применимость
6. Фальсифицируемость выводов
7. Количественная оценка
8. Учёт альтернатив
9. Временной горизонт
10. Когнитивные искажения

ПРИНЦИПЫ КРИТИКИ:
- Будь конструктивен, но беспощаден к слабостям
- Указывай конкретные проблемы, не общие фразы
- Предлагай улучшения
- Отмечай сильные стороны

Формат ответа:

## Оценка по критериям

| Критерий | Оценка (1-10) | Комментарий |
|----------|---------------|-------------|
| ... | ... | ... |

## Сильные стороны
- [Что хорошо]

## Слабости
- [Что плохо]

## Предложения по улучшению
- [Как исправить]

## Общая оценка: X/10
"""

CRITIQUE_USER_PROMPT = """Исходная задача: {task}

Анализ от агента {target_name}:

{analysis}

---

Проведи критический анализ этого ответа.
"""


SYNTHESIS_SYSTEM_PROMPT = """Ты главный интегратор системы LLM-top. Твоя задача — синтезировать результаты анализа нескольких агентов в единый отчёт.

ПРИНЦИПЫ СИНТЕЗА:
1. Интегрируй сильные стороны каждого анализа
2. Разрешай противоречия через взвешивание аргументов
3. Формализуй выводы математически где возможно
4. Сохраняй разногласия если консенсус невозможен

ФОРМАТ РЕЗУЛЬТАТА:

## Резюме
[Краткое описание задачи и ключевых выводов]

## Таблица выводов

| Вывод | Вероятность | Условие фальсификации | Источник |
|-------|-------------|----------------------|----------|
| ... | ... | ... | ... |

## Формализованный итог
[Математические формулы с расшифровкой переменных]

## Рекомендации

| Рекомендация | За | Против | Приоритет |
|--------------|----|----|----------|
| ... | ... | ... | ... |

## Разногласия
[Если есть существенные разногласия между агентами]

## Уровень консенсуса: X%
"""

SYNTHESIS_USER_PROMPT = """Исходная задача: {task}

## Анализы агентов:

{analyses}

## Критики:

{critiques}

---

Синтезируй результаты в единый отчёт.
"""


# ============================================================
# ФУНКЦИИ ПОЛУЧЕНИЯ ПРОМПТОВ
# ============================================================

def _load_from_db(agent_name: str, prompt_type: str) -> Optional[str]:
    """Попытаться загрузить промпт из БД"""
    settings = get_settings()
    if not settings.enable_rag or not PROMPT_LOADER_AVAILABLE:
        return None

    try:
        loader = get_prompt_loader()
        return loader.get_prompt(agent_name, prompt_type)
    except Exception:
        return None


def get_analysis_prompt(agent_config: dict, task: str, task_type: str, context: str) -> tuple[str, str]:
    """Получить промпты для анализа"""
    agent_name = agent_config.get("name", "").lower()

    # Пробуем загрузить из БД
    db_system = _load_from_db(agent_name, "system")

    if db_system:
        system = db_system
    else:
        # Fallback на захардкоженный промпт
        system = ANALYSIS_SYSTEM_PROMPT.format(
            role=agent_config["role"],
            focus=agent_config["focus"],
            strengths=", ".join(agent_config["strengths"]),
        )

    user = ANALYSIS_USER_PROMPT.format(
        task=task,
        task_type=task_type,
        context=context or "Не предоставлен",
    )
    return system, user


def get_critique_prompt(agent_config: dict, task: str, target_name: str, analysis: str) -> tuple[str, str]:
    """Получить промпты для критики"""
    agent_name = agent_config.get("name", "").lower()

    # Пробуем загрузить из БД
    db_critique = _load_from_db(agent_name, "critique")

    if db_critique:
        system = db_critique
    else:
        system = CRITIQUE_SYSTEM_PROMPT.format(role=agent_config["role"])

    user = CRITIQUE_USER_PROMPT.format(
        task=task,
        target_name=target_name,
        analysis=analysis,
    )
    return system, user


def get_synthesis_prompt(task: str, analyses: str, critiques: str) -> tuple[str, str]:
    """Получить промпты для синтеза"""
    # Пробуем загрузить из БД (Claude - интегратор)
    db_synthesis = _load_from_db("claude", "synthesis")

    system = db_synthesis if db_synthesis else SYNTHESIS_SYSTEM_PROMPT

    user = SYNTHESIS_USER_PROMPT.format(
        task=task,
        analyses=analyses,
        critiques=critiques,
    )
    return system, user
