-- ============================================================
-- LLM-top: Seed Data - Thinking Patterns of Great Minds
-- Version: 1.0
-- Date: 2026-02-01
-- ============================================================

-- Note: embeddings will be generated via n8n workflow using OpenAI API
-- For now, we insert without embeddings (NULL)

INSERT INTO rag_thinking_patterns (thinker_name, domains, pattern_description, heuristics, examples) VALUES

-- ============================================================
-- SCIENTISTS & ENGINEERS
-- ============================================================

('Richard Feynman',
 ARRAY['physics', 'science', 'learning', 'problem_solving'],
 'Декомпозиция до первых принципов (First Principles). Объяснение простым языком как тест понимания ("Если ты не можешь объяснить это просто, ты не понимаешь это достаточно хорошо"). Активное сомнение в авторитетах. Поиск удовольствия в процессе познания.',
 '{
   "first_principles": true,
   "simplify_to_teach": true,
   "question_authority": true,
   "enjoy_the_process": true,
   "admit_ignorance": true,
   "multiple_representations": "объяснять одно и то же разными способами"
 }'::jsonb,
 ARRAY[
   'Разобрал причины катастрофы Challenger через простой эксперимент со стаканом ледяной воды',
   'Изучал биологию, играя на барабанах, рисуя — чтобы понять с разных сторон',
   'Отказался от Нобелевского комитета, потому что "награды мешают думать"'
 ]),

('Claude Shannon',
 ARRAY['information_theory', 'engineering', 'mathematics', 'problem_solving'],
 'Упрощение до математической сути. Игровой подход к серьёзным проблемам. Поиск границ возможного (теоретические пределы). Визуализация абстрактных концепций через физические модели.',
 '{
   "find_theoretical_limits": true,
   "mathematical_essence": true,
   "playful_approach": true,
   "physical_intuition": "строить модели руками",
   "information_is_everything": true
 }'::jsonb,
 ARRAY[
   'Создал теорию информации, определив фундаментальные пределы передачи данных',
   'Строил машины для решения кубика Рубика и игры в шахматы для развлечения',
   'Связал термодинамику и информацию через понятие энтропии'
 ]),

('Nikola Tesla',
 ARRAY['engineering', 'invention', 'visualization'],
 'Экстремальная визуализация — способность "строить" и "тестировать" изобретения полностью в уме. Системное мышление о взаимосвязях. Долгосрочное видение применений технологий.',
 '{
   "mental_simulation": "полное моделирование в уме до физической реализации",
   "systems_thinking": true,
   "long_term_vision": true,
   "attention_to_harmonics": "резонанс и частоты как ключ к пониманию"
 }'::jsonb,
 ARRAY[
   'Изобрёл AC мотор, полностью смоделировав его работу в уме',
   'Предсказал смартфоны и беспроводную передачу энергии за 100 лет',
   'Мог визуализировать машины с точностью до износа деталей'
 ]),

-- ============================================================
-- INVESTORS & BUSINESS
-- ============================================================

('Warren Buffett',
 ARRAY['investing', 'business', 'strategy', 'decision_making'],
 'Маржа безопасности — покупать значительно ниже внутренней стоимости. Круг компетенций — инвестировать только в то, что понимаешь. Долгосрочное мышление. Простота важнее сложности. "Будь жадным, когда другие боятся, и бойся, когда другие жадничают".',
 '{
   "margin_of_safety": 0.30,
   "circle_of_competence": true,
   "long_term_holding": "идеальный срок — навсегда",
   "simplicity_over_complexity": true,
   "contrarian_timing": true,
   "owner_mindset": "думай как владелец бизнеса, не как трейдер",
   "moat_analysis": "ищи устойчивые конкурентные преимущества"
 }'::jsonb,
 ARRAY[
   'Держит Coca-Cola с 1988 года, несмотря на все кризисы',
   'Отказался от dot-com пузыря, потому что "не понимал" технологии',
   'Покупал во время паники 2008-2009, когда все продавали'
 ]),

('Charlie Munger',
 ARRAY['investing', 'mental_models', 'decision_making', 'psychology'],
 'Латтис ментальных моделей — использование знаний из разных дисциплин. Инверсия — "Скажите мне, где я умру, и я туда не пойду". Избегание глупости важнее поиска гениальности. Second-order thinking.',
 '{
   "mental_models_lattice": ["inversion", "incentives", "opportunity_cost", "compound_interest", "margin_of_safety"],
   "inversion": "думай о том, чего избегать",
   "avoid_stupidity": "важнее, чем быть умным",
   "second_order_thinking": "что произойдёт потом?",
   "incentives_matter": "покажи мне стимулы, и я покажу результат",
   "multidisciplinary": true
 }'::jsonb,
 ARRAY[
   'Отказ от инвестиции: "Как я могу потерять всё? Какие сценарии?"',
   'Анализ компании через психологию менеджмента, не только финансы',
   'Чтение по 500 страниц в день из разных областей'
 ]),

('Ray Dalio',
 ARRAY['investing', 'management', 'systems', 'decision_making'],
 'Принципы — чёткие правила для повторяющихся ситуаций. Радикальная прозрачность. Меритократия идей. Машинное мышление — алгоритмизация решений. Изучение истории как паттернов.',
 '{
   "principles_based": "записывать и следовать принципам",
   "radical_transparency": true,
   "idea_meritocracy": "лучшая идея побеждает, независимо от источника",
   "algorithmic_decisions": "формализовать процесс принятия решений",
   "historical_patterns": "изучать аналогичные ситуации в истории",
   "stress_testing": "тестировать решения на исторических данных"
 }'::jsonb,
 ARRAY[
   'Создал систему "dot collector" для оценки идей на совещаниях',
   'Алгоритмизировал 99% инвестиционных решений Bridgewater',
   'Написал "Principles" — 500+ правил для жизни и работы'
 ]),

('Peter Thiel',
 ARRAY['startups', 'investing', 'strategy', 'contrarian'],
 'Монополия vs конкуренция — стремиться к монополии, избегать конкуренции. Секреты — искать то, что истинно, но мало кто в это верит. Definite optimism — конкретное видение будущего. 0 to 1 > 1 to n.',
 '{
   "monopoly_over_competition": true,
   "secrets": "что истинно, но непопулярно?",
   "definite_optimism": "конкретный план, не надежда",
   "zero_to_one": "создавать новое, не копировать",
   "contrarian_question": "в чём вы уверены, но большинство не согласно?",
   "power_law": "немногие инвестиции определяют весь результат"
 }'::jsonb,
 ARRAY[
   'PayPal — создал новую категорию вместо конкуренции с банками',
   'Palantir — секрет: госструктуры нуждаются в современных технологиях',
   'Первый внешний инвестор Facebook — увидел монопольный потенциал'
 ]),

-- ============================================================
-- STRATEGISTS & MILITARY
-- ============================================================

('Sun Tzu',
 ARRAY['strategy', 'military', 'competition', 'negotiation'],
 'Победа без боя — высшее мастерство. Знай себя и противника. Используй обман и непредсказуемость. Побеждай до начала сражения через позиционирование.',
 '{
   "win_without_fighting": "высшая форма победы",
   "know_enemy_know_self": true,
   "deception": "война — путь обмана",
   "positioning": "победа определяется до боя",
   "adaptability": "как вода, принимай форму сосуда",
   "concentration_of_force": "сила в точке удара"
 }'::jsonb,
 ARRAY[
   '"Тот, кто знает, когда может сражаться, а когда нет, победит"',
   '"Высшее искусство войны — покорить врага без боя"',
   '"Быстрота — суть войны"'
 ]),

('John Boyd',
 ARRAY['strategy', 'military', 'decision_making', 'agility'],
 'OODA Loop (Observe-Orient-Decide-Act) — скорость цикла принятия решений важнее качества отдельного решения. Agility побеждает силу. Дезориентация противника.',
 '{
   "ooda_loop": "observe-orient-decide-act",
   "tempo": "быстрее цикл = преимущество",
   "agility_over_power": true,
   "disorient_enemy": "нарушить его OODA loop",
   "adaptability": "меняйся быстрее среды",
   "implicit_guidance": "действовать без явных приказов"
 }'::jsonb,
 ARRAY[
   'Концепция OODA loop революционизировала военную стратегию',
   'Истребители F-15 и F-16 созданы на основе его теорий',
   'Показал, что Blitzkrieg работал из-за скорости OODA, не силы'
 ]),

-- ============================================================
-- PSYCHOLOGISTS & DECISION SCIENTISTS
-- ============================================================

('Daniel Kahneman',
 ARRAY['psychology', 'decision_making', 'economics', 'cognitive_bias'],
 'System 1 vs System 2 — автоматическое vs аналитическое мышление. Когнитивные искажения неизбежны, но можно создать среду, уменьшающую их влияние. Pre-mortem: представь, что план провалился, и объясни почему.',
 '{
   "system_1_system_2": true,
   "cognitive_biases": ["availability", "anchoring", "confirmation", "hindsight", "overconfidence"],
   "pre_mortem": "представь провал и объясни причины",
   "base_rates": "всегда начинай с базовых вероятностей",
   "outside_view": "смотри на проблему извне, не изнутри",
   "noise_reduction": "уменьшать случайные отклонения в решениях"
 }'::jsonb,
 ARRAY[
   'Pre-mortem: "Прошёл год, проект провалился. Почему?"',
   'Reference class forecasting: "Как обычно заканчиваются похожие проекты?"',
   'Получил Нобелевку по экономике за описание иррациональности'
 ]),

('Nassim Taleb',
 ARRAY['risk', 'probability', 'philosophy', 'decision_making'],
 'Антихрупкость — системы, которые усиливаются от стресса. Black Swan — редкие, непредсказуемые события с огромным влиянием. Skin in the game — асимметрия рисков и вознаграждений. Via negativa — улучшение через удаление.',
 '{
   "antifragility": "усиливаться от стресса и хаоса",
   "black_swans": "готовиться к непредсказуемому",
   "skin_in_the_game": "рисковать своим",
   "via_negativa": "улучшать через удаление",
   "barbell_strategy": "крайности вместо середины",
   "optionality": "ценность возможности выбора",
   "fat_tails": "экстремальные события важнее средних"
 }'::jsonb,
 ARRAY[
   'Barbell: 90% в сверхнадёжное + 10% в сверхрисковое',
   'Optionality: ситуации с ограниченным downside, неограниченным upside',
   'Via negativa: "Что убрать?" важнее "Что добавить?"'
 ]),

-- ============================================================
-- ENTREPRENEURS & INNOVATORS
-- ============================================================

('Elon Musk',
 ARRAY['engineering', 'business', 'innovation', 'first_principles'],
 'First principles reasoning — разбивать проблему до физических законов и строить заново. Вертикальная интеграция. 10x мышление — цель в 10 раз амбициознее обычной. Невозможное = ещё не сделанное.',
 '{
   "first_principles": "до физических законов",
   "vertical_integration": true,
   "10x_thinking": "цель в 10 раз амбициознее",
   "impossible_is_temporary": true,
   "feedback_loops": "быстрые итерации",
   "physics_time": "законы физики, не аналогий",
   "urgency": "действовать так, будто это критично"
 }'::jsonb,
 ARRAY[
   'SpaceX: "Из чего состоит ракета? Сколько стоят материалы? Почему так дорого?"',
   'Tesla: вертикальная интеграция батарей, когда все покупали у поставщиков',
   'Boring Company: "Почему туннели дорогие? Можно ли изменить физику процесса?"'
 ]),

('Steve Jobs',
 ARRAY['product', 'design', 'innovation', 'leadership'],
 'Intersection of technology and humanities. Simplicity through elimination. Reality distortion field — вдохновлять команду на "невозможное". Focus — говорить "нет" 1000 вещам.',
 '{
   "intersection": "технологии + гуманитарные науки",
   "simplicity": "через устранение лишнего",
   "focus": "говорить нет большинству идей",
   "end_to_end_experience": "контролировать весь опыт пользователя",
   "a_players": "нанимать только лучших",
   "reality_distortion": "убеждать в возможности невозможного"
 }'::jsonb,
 ARRAY[
   'iPod: 1000 песен в кармане (не "5GB storage")',
   'Отказ от Flash, несмотря на критику — оказался прав',
   '"Людям не нужна дрель, им нужна дырка в стене"'
 ]),

('Jeff Bezos',
 ARRAY['business', 'strategy', 'customer', 'long_term'],
 'Customer obsession — начинать с клиента и двигаться назад. Day 1 mentality — всегда действовать как стартап. Regret minimization framework. High-velocity decisions — большинство решений обратимы.',
 '{
   "customer_obsession": "начинать с клиента",
   "day_1_mentality": "избегать Day 2 (стагнации)",
   "regret_minimization": "в 80 лет о чём пожалею?",
   "two_way_doors": "большинство решений обратимы",
   "disagree_and_commit": "не согласен, но делаю",
   "long_term": "готов терять деньги 7 лет",
   "working_backwards": "от пресс-релиза к продукту"
 }'::jsonb,
 ARRAY[
   'Regret minimization: "В 80 лет пожалею, что не попробовал интернет"',
   'Working backwards: сначала пресс-релиз продукта, потом разработка',
   'Day 1: "День 2 — это стагнация, затем боль, затем смерть"'
 ]);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE rag_thinking_patterns IS
'RAG #2: Thinking patterns of great minds. Used for quality benchmarking and heuristic search.
Embeddings should be generated via OpenAI text-embedding-3-small model.
When searching, use cosine similarity to find relevant patterns for the task domain.';
