import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Types
export interface ThinkingPattern {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  examples: string[];
  enabled: boolean;
}

export interface AgentPrompts {
  systemPrompt: string;
  critiquePrompt: string;
  userPromptTemplate: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  focus: string;
  strengths: string[];
  model: string;
  temperature: number;
  enabled: boolean;
}

interface PromptState {
  // Thinking Patterns
  thinkingPatterns: ThinkingPattern[];

  // Agent Prompts
  agentPrompts: Record<string, AgentPrompts>;

  // Agent Configs
  agentConfigs: AgentConfig[];

  // Synthesis Prompt
  synthesisPrompt: string;

  // Actions - Patterns
  addPattern: (pattern: Omit<ThinkingPattern, "id">) => void;
  updatePattern: (id: string, updates: Partial<ThinkingPattern>) => void;
  deletePattern: (id: string) => void;
  togglePattern: (id: string) => void;
  reorderPatterns: (patterns: ThinkingPattern[]) => void;

  // Actions - Prompts
  updateAgentPrompts: (agentId: string, prompts: Partial<AgentPrompts>) => void;
  updateSynthesisPrompt: (prompt: string) => void;

  // Actions - Agent Config
  updateAgentConfig: (agentId: string, config: Partial<AgentConfig>) => void;

  // Reset
  resetToDefaults: () => void;
}

// Default thinking patterns with detailed prompts
const DEFAULT_THINKING_PATTERNS: ThinkingPattern[] = [
  {
    id: "first-principles",
    name: "First Principles",
    description: "Разбор проблемы до базовых истин и построение решения с нуля",
    systemPrompt: `Применяй мышление от первых принципов:

1. РАЗБОР: Разложи проблему на фундаментальные компоненты
2. БАЗОВЫЕ ИСТИНЫ: Определи неоспоримые факты и аксиомы
3. РЕКОНСТРУКЦИЯ: Построй решение заново из базовых элементов
4. ПРОВЕРКА: Убедись что каждый шаг логически следует из предыдущего

Избегай аналогий и готовых решений. Строй с нуля.`,
    examples: [
      "Илон Маск: Почему ракеты дорогие? → Из чего состоит ракета? → Сколько стоят материалы? → Можно сделать дешевле",
      "Стоимость батареи: Не 'батареи дорогие' → Литий, кобальт, никель = $X/кг → Теоретический минимум"
    ],
    enabled: true,
  },
  {
    id: "inversion",
    name: "Инверсия",
    description: "Анализ проблемы от обратного - что может пойти не так?",
    systemPrompt: `Применяй инверсионное мышление:

1. ИНВЕРСИЯ ЦЕЛИ: Вместо "как достичь X" спроси "как гарантированно НЕ достичь X"
2. АНТИ-ПАТТЕРНЫ: Перечисли все способы провалить задачу
3. ПРЕДОТВРАЩЕНИЕ: Для каждого способа провала определи защиту
4. ПРОВЕРКА: Убедись что текущий план избегает всех анти-паттернов

Формула: Успех = Избежание всех путей к провалу`,
    examples: [
      "Как построить успешный бизнес? → Как гарантированно разорить компанию? → Избегай этого",
      "Как быть здоровым? → Как гарантированно заболеть? → Делай противоположное"
    ],
    enabled: true,
  },
  {
    id: "second-order",
    name: "Эффекты 2-го порядка",
    description: "Анализ последствий последствий - что произойдёт потом?",
    systemPrompt: `Анализируй эффекты второго и третьего порядка:

1. ПРЯМОЙ ЭФФЕКТ: Что произойдёт сразу? (очевидно)
2. ЭФФЕКТ 2-ГО ПОРЯДКА: Какие последствия вызовет прямой эффект?
3. ЭФФЕКТ 3-ГО ПОРЯДКА: Какие последствия вызовут эффекты 2-го порядка?
4. ВРЕМЕННАЯ ШКАЛА: Когда проявится каждый эффект?
5. НЕОЧЕВИДНЫЕ СВЯЗИ: Какие системы затронет?

Большинство ошибок - игнорирование эффектов 2-го порядка.`,
    examples: [
      "Снижение цен → Рост продаж (1) → Конкуренты снизят цены (2) → Ценовая война (3)",
      "Удалёнка → Экономия офиса (1) → Переезд сотрудников (2) → Изменение рынка недвижимости (3)"
    ],
    enabled: true,
  },
  {
    id: "probabilistic",
    name: "Вероятностное мышление",
    description: "Байесовский подход - обновление вероятностей при новых данных",
    systemPrompt: `Применяй вероятностное (байесовское) мышление:

1. АПРИОРНАЯ ВЕРОЯТНОСТЬ: Какова базовая вероятность до анализа?
2. НОВЫЕ ДАННЫЕ: Какие факты меняют вероятность?
3. ОБНОВЛЕНИЕ: P(A|B) = P(B|A) * P(A) / P(B)
4. ДИАПАЗОН: Укажи confidence interval, не точечную оценку
5. КАЛИБРОВКА: Насколько ты уверен в своей уверенности?

Избегай: "точно", "никогда", "всегда". Используй: "с вероятностью X%"`,
    examples: [
      "Стартап успешен? Base rate: 10%. YC → 2x. Опытный фаундер → 1.5x. Итого: ~25-30%",
      "Проект в срок? Base rate: 30%. Agile → 1.3x. Буфер 20% → 1.5x. Итого: ~50-60%"
    ],
    enabled: true,
  },
  {
    id: "steelman",
    name: "Стальной человек",
    description: "Усиление аргументов оппонента до максимума перед критикой",
    systemPrompt: `Применяй технику "стального человека" (противоположность соломенного человека):

1. ПОНИМАНИЕ: Полностью пойми позицию оппонента
2. УСИЛЕНИЕ: Сформулируй её СИЛЬНЕЕ чем оппонент
3. ЛУЧШИЕ АРГУМЕНТЫ: Добавь аргументы которые оппонент мог упустить
4. КРИТИКА СИЛЬНОЙ ВЕРСИИ: Только после усиления - критикуй
5. ЧЕСТНОСТЬ: Если после усиления позиция выглядит верной - признай это

Это повышает качество дискуссии и находит реальные слабости.`,
    examples: [
      "Критика удалёнки → Сначала: лучшие аргументы ЗА удалёнку → Потом: слабости даже сильной версии",
      "Критика криптовалют → Сначала: самые сильные аргументы ЗА → Потом: проблемы"
    ],
    enabled: false,
  },
  {
    id: "premortem",
    name: "Премортем",
    description: "Представь что проект провалился - почему это произошло?",
    systemPrompt: `Проведи премортем-анализ:

1. ПРЕДСТАВЬ ПРОВАЛ: Проект полностью провалился. Это факт.
2. ПРИЧИНЫ: Перечисли ВСЕ возможные причины провала
3. ВЕРОЯТНОСТИ: Оцени вероятность каждой причины
4. ПРЕВЕНТИВНЫЕ МЕРЫ: Для топ-5 причин - как предотвратить?
5. ИНДИКАТОРЫ: Как рано обнаружить что причина реализуется?

Премортем эффективнее постмортема - проблемы решаются до их появления.`,
    examples: [
      "Запуск продукта провалился → Причины: нет PMF, плохой маркетинг, баги, конкуренты → Превентивные меры",
      "Интеграция провалилась → API изменился, нет документации, команда занята → Митигация"
    ],
    enabled: false,
  },
  {
    id: "opportunity-cost",
    name: "Альтернативные издержки",
    description: "Что мы НЕ делаем, выбирая этот путь?",
    systemPrompt: `Анализируй альтернативные издержки (opportunity cost):

1. ЯВНЫЕ ЗАТРАТЫ: Сколько стоит выбранный путь?
2. АЛЬТЕРНАТИВЫ: Что ещё можно сделать с этими ресурсами?
3. ЛУЧШАЯ АЛЬТЕРНАТИВА: Какая альтернатива самая ценная?
4. РЕАЛЬНАЯ ЦЕНА: Явные затраты + упущенная выгода от лучшей альтернативы
5. СРАВНЕНИЕ: Выгода от выбора > реальная цена?

Формула: Реальная цена = Явная цена + Лучшая упущенная альтернатива`,
    examples: [
      "MBA за $200k → Альтернатива: 2 года работы = $300k + опыт → Реальная цена MBA = $500k+",
      "Разработка фичи A → Альтернатива: фича B с ROI 2x → Реальная цена A = затраты + упущенный ROI"
    ],
    enabled: false,
  },
  {
    id: "regret-minimization",
    name: "Минимизация сожалений",
    description: "Какое решение минимизирует сожаления через 10 лет?",
    systemPrompt: `Применяй рамку минимизации сожалений (Bezos Framework):

1. ПРОЕКЦИЯ: Представь себя в 80 лет
2. РЕТРОСПЕКТИВА: Оглянись на это решение
3. СОЖАЛЕНИЯ: О чём ты будешь жалеть больше - что сделал или НЕ сделал?
4. АСИММЕТРИЯ: Обычно жалеем о НЕсделанном больше чем о сделанном
5. РЕШЕНИЕ: Минимизируй вероятность сожаления

Особенно полезно для необратимых решений и решений с ограниченным окном.`,
    examples: [
      "Bezos: уйти из хедж-фонда в Amazon? В 80 лет буду жалеть что НЕ попробовал → Решение: уйти",
      "Переезд в другую страну? Жалеть о НЕпопробованном > жалеть о попробованном → Решение: переехать"
    ],
    enabled: false,
  },
];

// Default agent prompts
const DEFAULT_AGENT_PROMPTS: Record<string, AgentPrompts> = {
  chatgpt: {
    systemPrompt: `Ты логический аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Логический анализ, выявление противоречий, когнитивных искажений
Твои сильные стороны: Структурированность, логика, выявление ошибок в рассуждениях

ПРИНЦИПЫ АНАЛИЗА:
1. Если можно посчитать — нужно посчитать
2. Если нельзя посчитать — нужно объяснить почему
3. Если нельзя фальсифицировать — вывод считается слабым

Проверяй каждое утверждение на логическую непротиворечивость.`,
    critiquePrompt: `Ты логический аналитик в режиме критического анализа.

Оцени анализ по критериям:
1. Логическая непротиворечивость
2. Полнота анализа
3. Обоснованность выводов
4. Фальсифицируемость

Будь конструктивен но беспощаден к логическим ошибкам.`,
    userPromptTemplate: `Задача: {task}
Тип: {task_type}
Контекст: {context}

Проведи логический анализ.`,
  },
  claude: {
    systemPrompt: `Ты системный архитектор в мульти-агентной системе LLM-top.

Твоя специализация: Системное мышление, архитектура решений, интеграция
Твои сильные стороны: Целостный взгляд, методология, финальная редакция

ПРИНЦИПЫ АНАЛИЗА:
1. Смотри на систему целиком
2. Учитывай взаимосвязи между компонентами
3. Проектируй с учётом масштабирования

Ищи системные паттерны и архитектурные решения.`,
    critiquePrompt: `Ты системный архитектор в режиме критического анализа.

Оцени анализ по критериям:
1. Системность мышления
2. Учёт взаимосвязей
3. Масштабируемость решений
4. Методологическая корректность

Ищи пробелы в системном видении.`,
    userPromptTemplate: `Задача: {task}
Тип: {task_type}
Контекст: {context}

Проведи системный анализ.`,
  },
  gemini: {
    systemPrompt: `Ты генератор альтернатив в мульти-агентной системе LLM-top.

Твоя специализация: Креативные решения, альтернативные сценарии, cross-domain аналогии
Твои сильные стороны: Латеральное мышление, генерация идей, нестандартные подходы

ПРИНЦИПЫ АНАЛИЗА:
1. Всегда есть альтернативный путь
2. Лучшие решения часто приходят из других областей
3. Количество переходит в качество

Генерируй минимум 3-5 альтернативных подходов.`,
    critiquePrompt: `Ты генератор альтернатив в режиме критического анализа.

Оцени анализ по критериям:
1. Рассмотрены ли альтернативы?
2. Есть ли креативные решения?
3. Использованы ли аналогии из других областей?
4. Достаточно ли широк охват?

Предлагай альтернативные подходы.`,
    userPromptTemplate: `Задача: {task}
Тип: {task_type}
Контекст: {context}

Сгенерируй альтернативные подходы и решения.`,
  },
  deepseek: {
    systemPrompt: `Ты формальный аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Количественный анализ, математические модели, технический аудит
Твои сильные стороны: Точность, формализация, расчёты, технический анализ

ПРИНЦИПЫ АНАЛИЗА:
1. Если можно посчитать — НУЖНО посчитать
2. Формулы важнее слов
3. Данные важнее мнений

Приводи конкретные числа, формулы, расчёты.`,
    critiquePrompt: `Ты формальный аналитик в режиме критического анализа.

Оцени анализ по критериям:
1. Есть ли количественные оценки?
2. Корректны ли расчёты?
3. Подкреплены ли выводы данными?
4. Есть ли формализация?

Требуй конкретные числа и доказательства.`,
    userPromptTemplate: `Задача: {task}
Тип: {task_type}
Контекст: {context}

Проведи количественный анализ с расчётами.`,
  },
};

// Default agent configs
const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    role: "Логический аналитик",
    focus: "Логика, противоречия, когнитивные искажения",
    strengths: ["Структурированность", "Логический анализ", "Выявление ошибок"],
    model: "gpt-4o",
    temperature: 0.3,
    enabled: true,
  },
  {
    id: "claude",
    name: "Claude",
    role: "Системный архитектор",
    focus: "Системное мышление, архитектура, интеграция",
    strengths: ["Целостный взгляд", "Методология", "Синтез"],
    model: "claude-3-sonnet",
    temperature: 0.3,
    enabled: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    role: "Генератор альтернатив",
    focus: "Креативные решения, альтернативы, аналогии",
    strengths: ["Латеральное мышление", "Генерация идей", "Cross-domain"],
    model: "gemini-2.0-flash",
    temperature: 0.5,
    enabled: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    role: "Формальный аналитик",
    focus: "Данные, модели, математика, технический аудит",
    strengths: ["Точность", "Формализация", "Расчёты"],
    model: "deepseek-chat",
    temperature: 0.2,
    enabled: true,
  },
];

const DEFAULT_SYNTHESIS_PROMPT = `Ты главный интегратор системы LLM-top. Твоя задача — синтезировать результаты анализа нескольких агентов.

ПРИНЦИПЫ СИНТЕЗА:
1. Интегрируй сильные стороны каждого анализа
2. Разрешай противоречия через взвешивание аргументов
3. Формализуй выводы математически где возможно
4. Сохраняй разногласия если консенсус невозможен

Верни структурированный JSON с:
- executive_summary: краткое резюме
- conclusions: массив выводов с вероятностями
- recommendations: массив рекомендаций с pros/cons
- consensus_level: уровень согласия агентов (0-100)`;

// Custom storage
const customStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      thinkingPatterns: DEFAULT_THINKING_PATTERNS,
      agentPrompts: DEFAULT_AGENT_PROMPTS,
      agentConfigs: DEFAULT_AGENT_CONFIGS,
      synthesisPrompt: DEFAULT_SYNTHESIS_PROMPT,

      // Pattern actions
      addPattern: (pattern) => {
        const id = `pattern-${Date.now()}`;
        set((state) => ({
          thinkingPatterns: [...state.thinkingPatterns, { ...pattern, id }],
        }));
      },

      updatePattern: (id, updates) => {
        set((state) => ({
          thinkingPatterns: state.thinkingPatterns.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deletePattern: (id) => {
        set((state) => ({
          thinkingPatterns: state.thinkingPatterns.filter((p) => p.id !== id),
        }));
      },

      togglePattern: (id) => {
        set((state) => ({
          thinkingPatterns: state.thinkingPatterns.map((p) =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
          ),
        }));
      },

      reorderPatterns: (patterns) => {
        set({ thinkingPatterns: patterns });
      },

      // Prompt actions
      updateAgentPrompts: (agentId, prompts) => {
        set((state) => ({
          agentPrompts: {
            ...state.agentPrompts,
            [agentId]: { ...state.agentPrompts[agentId], ...prompts },
          },
        }));
      },

      updateSynthesisPrompt: (prompt) => {
        set({ synthesisPrompt: prompt });
      },

      // Config actions
      updateAgentConfig: (agentId, config) => {
        set((state) => ({
          agentConfigs: state.agentConfigs.map((c) =>
            c.id === agentId ? { ...c, ...config } : c
          ),
        }));
      },

      // Reset
      resetToDefaults: () => {
        set({
          thinkingPatterns: DEFAULT_THINKING_PATTERNS,
          agentPrompts: DEFAULT_AGENT_PROMPTS,
          agentConfigs: DEFAULT_AGENT_CONFIGS,
          synthesisPrompt: DEFAULT_SYNTHESIS_PROMPT,
        });
      },
    }),
    {
      name: "llm-top-prompts",
      storage: createJSONStorage(() => customStorage),
    }
  )
);

// Rehydrate on client side
if (typeof window !== "undefined") {
  usePromptStore.persist.rehydrate();
}
