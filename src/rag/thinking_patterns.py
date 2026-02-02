"""
LLM-top: Thinking Patterns
Образы мышления величайших умов человечества
"""

from typing import Optional
from pydantic import BaseModel

from src.rag.vector_store import VectorStore, Document


class ThinkingPattern(BaseModel):
    """Образ мышления"""
    name: str
    domain: str  # business, science, investment, technology, philosophy
    description: str
    principles: list[str]
    questions: list[str]  # Вопросы, которые задаёт этот мыслитель
    mental_models: list[str]
    quotes: list[str]
    anti_patterns: list[str]  # Чего избегать


# Библиотека образов мышления
THINKING_PATTERNS: dict[str, ThinkingPattern] = {
    "elon_musk": ThinkingPattern(
        name="Илон Маск",
        domain="technology",
        description="Мышление первых принципов, экспоненциальное мышление, межотраслевой трансфер",
        principles=[
            "Разбей проблему до базовых физических/экономических истин",
            "Игнорируй 'так принято' — думай с чистого листа",
            "10x мышление: не улучшай на 10%, улучшай в 10 раз",
            "Вертикальная интеграция для контроля критических компонентов",
            "Быстрые итерации важнее идеального планирования",
            "Переноси решения между индустриями",
        ],
        questions=[
            "Каковы фундаментальные физические ограничения?",
            "Почему это стоит столько? Из чего состоит себестоимость?",
            "Что если убрать все искусственные ограничения?",
            "Как сделать это в 10 раз лучше/дешевле/быстрее?",
            "Какие технологии из других областей можно применить?",
            "Что является узким местом и как его расширить?",
        ],
        mental_models=[
            "First Principles Thinking",
            "Exponential vs Linear Growth",
            "Vertical Integration",
            "Rapid Iteration",
            "Cross-Industry Transfer",
        ],
        quotes=[
            "Если что-то достаточно важно, ты делаешь это, даже если шансы против тебя",
            "Провал — это опция. Если ты не терпишь неудач, ты не инновируешь",
        ],
        anti_patterns=[
            "Принятие статуса-кво без вопросов",
            "Инкрементальные улучшения вместо прорывов",
            "Аутсорсинг критических компетенций",
        ],
    ),

    "warren_buffett": ThinkingPattern(
        name="Уоррен Баффет",
        domain="investment",
        description="Value investing, долгосрочное мышление, круг компетенций",
        principles=[
            "Инвестируй только в то, что понимаешь (круг компетенций)",
            "Margin of Safety — покупай со скидкой к внутренней стоимости",
            "Думай как владелец бизнеса, а не спекулянт",
            "Время — друг хорошего бизнеса, враг плохого",
            "Жадничай когда другие боятся, бойся когда другие жадничают",
            "Moat (ров) — устойчивое конкурентное преимущество",
        ],
        questions=[
            "Понимаю ли я этот бизнес достаточно глубоко?",
            "Какой экономический ров защищает этот бизнес?",
            "Какова внутренняя стоимость и какой margin of safety?",
            "Хотел бы я владеть этим бизнесом 10+ лет?",
            "Насколько честен и компетентен менеджмент?",
            "Что может пойти не так? Каков downside?",
        ],
        mental_models=[
            "Circle of Competence",
            "Margin of Safety",
            "Economic Moat",
            "Owner Earnings",
            "Mr. Market (рыночная иррациональность)",
        ],
        quotes=[
            "Правило №1: Никогда не теряй деньги. Правило №2: Никогда не забывай правило №1",
            "Цена — это то, что платишь. Ценность — то, что получаешь",
            "Будь жадным когда другие напуганы, и напуган когда другие жадны",
        ],
        anti_patterns=[
            "Инвестиции вне круга компетенций",
            "Погоня за хайпом и модой",
            "Краткосрочные спекуляции",
            "Игнорирование downside риска",
        ],
    ),

    "charlie_munger": ThinkingPattern(
        name="Чарли Мангер",
        domain="investment",
        description="Мультидисциплинарное мышление, инверсия, латтицы ментальных моделей",
        principles=[
            "Собери латтицу ментальных моделей из разных дисциплин",
            "Инверсия: думай о том, чего избегать, а не что делать",
            "Избегай когнитивных искажений систематически",
            "Простота лучше сложности",
            "Терпение — конкурентное преимущество",
            "Учись постоянно, читай много",
        ],
        questions=[
            "Какие ментальные модели применимы к этой ситуации?",
            "Инверсия: что точно приведёт к провалу?",
            "Какие когнитивные искажения могут влиять на моё суждение?",
            "Где я могу быть неправ?",
            "Что бы сказал умный оппонент?",
            "Достаточно ли это просто, чтобы работать?",
        ],
        mental_models=[
            "Inversion",
            "Lollapalooza Effect (сочетание факторов)",
            "Opportunity Cost",
            "Incentive-caused Bias",
            "Confirmation Bias avoidance",
            "Second-Order Thinking",
        ],
        quotes=[
            "Инвертируй, всегда инвертируй",
            "Всё что я хочу знать — где я умру, чтобы никогда туда не ходить",
            "Покажи мне стимулы, и я покажу результат",
        ],
        anti_patterns=[
            "Однодисциплинарное мышление",
            "Игнорирование когнитивных искажений",
            "Чрезмерная сложность",
            "Нетерпеливость",
        ],
    ),

    "richard_feynman": ThinkingPattern(
        name="Ричард Фейнман",
        domain="science",
        description="Глубокое понимание через упрощение, скептицизм, интеллектуальная честность",
        principles=[
            "Если не можешь объяснить просто — не понимаешь достаточно глубоко",
            "Не обманывай себя — а себя обмануть легче всего",
            "Сомневайся в авторитетах, проверяй сам",
            "Учись через игру и эксперимент",
            "Признавай незнание честно",
            "Ищи дырки в собственных теориях",
        ],
        questions=[
            "Могу ли я объяснить это 12-летнему?",
            "Какой эксперимент мог бы опровергнуть эту идею?",
            "Что я точно НЕ знаю?",
            "Какие предположения я делаю неявно?",
            "Откуда я это знаю? Каков источник?",
            "Что было бы если бы я был неправ?",
        ],
        mental_models=[
            "Feynman Technique (объясни просто)",
            "Falsifiability (фальсифицируемость)",
            "First-Principles Derivation",
            "Intellectual Honesty",
            "Cargo Cult Science avoidance",
        ],
        quotes=[
            "Первый принцип — не обманывать себя. А себя обмануть легче всего",
            "Я лучше буду иметь вопросы, на которые нет ответа, чем ответы, которые нельзя подвергнуть сомнению",
            "Наука — это вера в невежество экспертов",
        ],
        anti_patterns=[
            "Слепое доверие авторитетам",
            "Использование сложных слов для маскировки непонимания",
            "Нефальсифицируемые утверждения",
            "Cargo cult подход (форма без содержания)",
        ],
    ),

    "ray_dalio": ThinkingPattern(
        name="Рэй Далио",
        domain="investment",
        description="Принципы, радикальная прозрачность, системное мышление о машине",
        principles=[
            "Записывай принципы и следуй им систематически",
            "Радикальная прозрачность и честность",
            "Относись к жизни как к игре/машине",
            "Боль + Рефлексия = Прогресс",
            "Ищи людей, которые не согласны, но умны",
            "Believability-weighted decision making",
        ],
        questions=[
            "Какой принцип применим к этой ситуации?",
            "Как эта машина/система работает на самом деле?",
            "Кто самый believable человек по этому вопросу?",
            "Что я могу узнать из этого провала/боли?",
            "Какова причинно-следственная связь?",
            "Как я могу систематизировать это решение?",
        ],
        mental_models=[
            "Principles-based Decision Making",
            "Radical Transparency",
            "Believability Weighting",
            "Pain + Reflection = Progress",
            "Machine/System Thinking",
        ],
        quotes=[
            "Он величайший машин, который смотрит на свою машину",
            "Если ты не агрессивно атакуешь свои слабости, они атакуют тебя",
        ],
        anti_patterns=[
            "Решения без принципов",
            "Избегание неприятной правды",
            "Игнорирование мнения экспертов",
            "Неспособность учиться на ошибках",
        ],
    ),

    "jeff_bezos": ThinkingPattern(
        name="Джефф Безос",
        domain="business",
        description="Долгосрочное мышление, customer obsession, Day 1 mentality",
        principles=[
            "Customer obsession вместо competitor obsession",
            "Day 1 mentality — всегда стартап",
            "Долгосрочное мышление как конкурентное преимущество",
            "Two-way door vs One-way door решения",
            "Высокие стандарты заразительны",
            "Disagree and commit",
        ],
        questions=[
            "Что хочет клиент и как дать это лучше?",
            "Как это будет выглядеть через 10 лет?",
            "Это one-way или two-way door решение?",
            "Что бы мы делали если бы начинали с нуля?",
            "Достаточно ли высоки наши стандарты?",
            "Оптимизируем ли мы для долгосрока?",
        ],
        mental_models=[
            "Customer Obsession",
            "Day 1 vs Day 2",
            "Two-way Door Decisions",
            "Working Backwards",
            "Regret Minimization Framework",
        ],
        quotes=[
            "Ваша маржа — моя возможность",
            "День 2 — это стазис, затем нерелевантность, затем болезненный упадок, затем смерть",
            "Если ты не упрям, ты сдашься слишком рано. Если ты не гибок, ты будешь биться головой об стену",
        ],
        anti_patterns=[
            "Фокус на конкурентах вместо клиентов",
            "Краткосрочная оптимизация",
            "Day 2 бюрократия",
            "Низкие стандарты",
        ],
    ),
}


class ThinkingPatterns:
    """
    Система образов мышления

    Позволяет применять паттерны мышления великих умов к анализу задач
    """

    def __init__(self):
        self.vector_store = VectorStore()
        self.patterns = THINKING_PATTERNS

    async def initialize_patterns(self):
        """Загрузить паттерны в векторное хранилище"""
        for pattern_id, pattern in self.patterns.items():
            content = self._format_pattern_for_storage(pattern)
            doc = Document(
                id=f"pattern_{pattern_id}",
                content=content,
                doc_type="thinking_pattern",
                metadata={
                    "name": pattern.name,
                    "domain": pattern.domain,
                    "pattern_id": pattern_id,
                }
            )
            await self.vector_store.add_document(doc)

    def _format_pattern_for_storage(self, pattern: ThinkingPattern) -> str:
        """Форматировать паттерн для хранения"""
        return f"""# {pattern.name}

Область: {pattern.domain}
Описание: {pattern.description}

## Принципы
{chr(10).join(f'- {p}' for p in pattern.principles)}

## Ключевые вопросы
{chr(10).join(f'- {q}' for q in pattern.questions)}

## Ментальные модели
{chr(10).join(f'- {m}' for m in pattern.mental_models)}

## Цитаты
{chr(10).join(f'> {q}' for q in pattern.quotes)}

## Антипаттерны (чего избегать)
{chr(10).join(f'- {a}' for a in pattern.anti_patterns)}
"""

    def get_pattern(self, pattern_id: str) -> Optional[ThinkingPattern]:
        """Получить паттерн по ID"""
        return self.patterns.get(pattern_id)

    async def find_relevant_patterns(
        self,
        task: str,
        domain: Optional[str] = None,
        limit: int = 3
    ) -> list[ThinkingPattern]:
        """
        Найти релевантные паттерны для задачи

        Args:
            task: Описание задачи
            domain: Фильтр по домену
            limit: Максимальное количество паттернов
        """
        # Семантический поиск
        docs = await self.vector_store.search(
            query=task,
            doc_type="thinking_pattern",
            limit=limit * 2,
            threshold=0.5
        )

        patterns = []
        for doc in docs:
            pattern_id = doc.metadata.get("pattern_id")
            if pattern_id and pattern_id in self.patterns:
                pattern = self.patterns[pattern_id]
                # Фильтр по домену
                if domain is None or pattern.domain == domain:
                    patterns.append(pattern)

        return patterns[:limit]

    def generate_thinking_prompt(
        self,
        patterns: list[ThinkingPattern],
        task: str
    ) -> str:
        """
        Генерировать промпт на основе паттернов мышления

        Args:
            patterns: Список паттернов для применения
            task: Задача для анализа
        """
        prompt_parts = [
            "Проанализируй задачу, применяя образы мышления следующих экспертов:\n"
        ]

        for i, pattern in enumerate(patterns, 1):
            prompt_parts.append(f"\n## {i}. {pattern.name} ({pattern.domain})")
            prompt_parts.append(f"\nПодход: {pattern.description}")

            prompt_parts.append("\nПрименяй принципы:")
            for p in pattern.principles[:3]:
                prompt_parts.append(f"- {p}")

            prompt_parts.append("\nЗадай себе вопросы:")
            for q in pattern.questions[:3]:
                prompt_parts.append(f"- {q}")

            prompt_parts.append(f"\nИзбегай: {', '.join(pattern.anti_patterns[:2])}")

        prompt_parts.append(f"\n\n## Задача\n{task}")
        prompt_parts.append("\n\n## Инструкции")
        prompt_parts.append("1. Для каждого эксперта укажи его уникальный взгляд на задачу")
        prompt_parts.append("2. Примени их ментальные модели")
        prompt_parts.append("3. Синтезируй общие выводы")
        prompt_parts.append("4. Отметь где эксперты согласны, а где расходятся")

        return "\n".join(prompt_parts)

    def get_all_patterns(self) -> list[ThinkingPattern]:
        """Получить все паттерны"""
        return list(self.patterns.values())

    def get_patterns_by_domain(self, domain: str) -> list[ThinkingPattern]:
        """Получить паттерны по домену"""
        return [p for p in self.patterns.values() if p.domain == domain]
