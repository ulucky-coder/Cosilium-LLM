# LLM-top: Roadmap реализации

> **Версия:** 1.0
> **Дата:** 2026-02-01

---

## Обзор фаз

| Фаза | Название | Код | Инфра | Статус |
|------|----------|-----|-------|--------|
| 0 | Подготовка инфраструктуры | ✅ SQL готов | ✅ Применено | **Готово** |
| 1 | Базовая оркестрация | ✅ LangGraph | — | Готово |
| 2 | RAG-агенты | ✅ Python | ✅ Seed данные | **Готово** |
| 3 | Итеративный процесс | ✅ Python | — | Готово |
| 4 | Формализация и вывод | ✅ Python | — | Готово |
| 5 | Эволюция и оптимизация | ✅ Python | 🔲 | Частично |

---

## Фаза 0: Подготовка инфраструктуры

### 0.1 Схема данных Supabase

**Таблица: `analysis_sessions`**
```sql
CREATE TABLE analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  task_description TEXT NOT NULL,
  task_type TEXT, -- 'strategy', 'research', 'investment', 'development', 'audit'
  status TEXT DEFAULT 'pending', -- pending, iteration_1, iteration_2, iteration_3, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Таблица: `agent_responses`**
```sql
CREATE TABLE agent_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id),
  agent_name TEXT NOT NULL, -- 'chatgpt', 'claude', 'gemini', 'deepseek'
  iteration INTEGER NOT NULL, -- 1, 2, 3
  response_type TEXT, -- 'analysis', 'critique', 'synthesis'
  content JSONB NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 - 1.00
  methodology TEXT,
  assumptions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Таблица: `inter_agent_dialogues`**
```sql
CREATE TABLE inter_agent_dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  message_type TEXT, -- 'critique', 'question', 'clarification', 'agreement'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Таблица: `final_results`**
```sql
CREATE TABLE final_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id) UNIQUE,
  report JSONB NOT NULL,
  conclusions_table JSONB NOT NULL,
  formulas JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Таблица: `rag_prompts`** (RAG-агент оптимальных промтов)
```sql
CREATE TABLE rag_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  performance_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Таблица: `rag_thinking_patterns`** (RAG-агент образов мышления)
```sql
CREATE TABLE rag_thinking_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinker_name TEXT NOT NULL, -- 'Feynman', 'Buffett', 'Musk', etc.
  domain TEXT[], -- ['physics', 'business', 'investing']
  pattern_description TEXT NOT NULL,
  heuristics JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 0.2 Настройка векторного хранилища

```sql
-- Включить расширение pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Индекс для семантического поиска
CREATE INDEX ON rag_thinking_patterns
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 0.3 Redis структура

```
cosilium:session:{session_id}:state     — текущее состояние сессии (JSON)
cosilium:session:{session_id}:iteration — номер текущей итерации
cosilium:agent:{agent_name}:queue       — очередь задач для агента
cosilium:rate_limit:{api_name}          — rate limiting для API
```

### 0.4 API Credentials в n8n

| Credential | Тип | Назначение |
|------------|-----|------------|
| OpenAI API | API Key | ChatGPT агент |
| Anthropic API | API Key | Claude агент |
| Google AI API | API Key | Gemini агент |
| DeepSeek API | API Key | DeepSeek агент |
| Supabase | Connection | База данных |
| Redis | Connection | Кэш и состояние |

---

## Фаза 1: Базовая оркестрация

### 1.1 Главный workflow: `Cosilium-Orchestrator`

```
┌─────────────────┐
│  Webhook/Chat   │
│    Trigger      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Session │
│   (Supabase)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Load Prompts   │
│   (RAG #1)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Iteration 1:   │
│ Independent     │
│   Analysis      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Iteration 2:   │
│  Adversarial    │
│    Critique     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Iteration 3:   │
│   Synthesis     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Format Output   │
│  & Save Result  │
└─────────────────┘
```

### 1.2 Sub-workflow: `Agent-ChatGPT`

```json
{
  "nodes": [
    {
      "name": "Load Prompt",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "getAll",
        "table": "rag_prompts",
        "filters": {"agent_name": "chatgpt"}
      }
    },
    {
      "name": "ChatGPT Analysis",
      "type": "n8n-nodes-langchain.lmchatopenai",
      "parameters": {
        "model": "gpt-4o",
        "options": {
          "temperature": 0.3,
          "maxTokens": 4096
        }
      }
    },
    {
      "name": "Save Response",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "insert",
        "table": "agent_responses"
      }
    }
  ]
}
```

### 1.3 Sub-workflows для других агентов

- `Agent-Claude` — Anthropic Claude API
- `Agent-Gemini` — Google Gemini API
- `Agent-DeepSeek` — DeepSeek API

### 1.4 Параллельный вызов агентов

```javascript
// В Code node оркестратора
const agents = ['chatgpt', 'claude', 'gemini', 'deepseek'];

// Вызвать все агенты параллельно через Execute Workflow
return agents.map(agent => ({
  json: {
    agent_name: agent,
    session_id: $json.session_id,
    task: $json.task_description,
    iteration: 1
  }
}));
```

---

## Фаза 2: RAG-агенты

### 2.1 RAG #1: Оптимальные промты

**Начальные промты агентов:**

```javascript
const initialPrompts = {
  chatgpt: {
    system: `Ты — Логический аналитик в мульти-агентной системе.

ТВОЯ РОЛЬ:
- Проверка логической корректности рассуждений
- Выявление логических разрывов и противоречий
- Анализ явных и скрытых предпосылок
- Обнаружение когнитивных искажений
- Оценка фальсифицируемости выводов

ФОРМАТ ОТВЕТА:
1. ЛОГИЧЕСКИЙ АНАЛИЗ
   - Цепочка рассуждений
   - Выявленные разрывы

2. ПРЕДПОСЫЛКИ
   - Явные (stated)
   - Скрытые (implied)

3. КОГНИТИВНЫЕ ИСКАЖЕНИЯ
   - Список обнаруженных
   - Влияние на выводы

4. ФАЛЬСИФИЦИРУЕМОСТЬ
   - Условия опровержения каждого вывода

5. УВЕРЕННОСТЬ: X%
   - Обоснование уровня уверенности`,

    critique: `Ты проводишь КРИТИЧЕСКИЙ АНАЛИЗ ответа другого агента.

КРИТЕРИИ ОЦЕНКИ:
1. Логическая корректность (есть ли разрывы?)
2. Скрытые предпосылки (что не озвучено?)
3. Когнитивные искажения (confirmation bias, etc.)
4. Фальсифицируемость (можно ли опровергнуть?)

ФОРМАТ:
- СЛАБЫЕ МЕСТА: [список]
- ОШИБКИ: [список с объяснением]
- ПРЕДЛОЖЕНИЯ ПО УСИЛЕНИЮ: [конкретные шаги]`
  },

  claude: {
    system: `Ты — Системный архитектор и интегратор.

ТВОЯ РОЛЬ:
- Методология анализа
- Целостность рассуждения
- Ясность понятий и терминов
- Границы применимости выводов
- Финальная интеграция результатов

ФОРМАТ:
1. МЕТОДОЛОГИЯ
   - Выбранный подход
   - Обоснование

2. ПОНЯТИЙНЫЙ АППАРАТ
   - Ключевые термины
   - Определения

3. ГРАНИЦЫ ПРИМЕНИМОСТИ
   - Где работает
   - Где не работает

4. СТРУКТУРА АНАЛИЗА
   - Декомпозиция задачи
   - Связи между частями`,

    synthesis: `Ты интегрируешь результаты всех агентов в финальный отчёт.

ЗАДАЧА:
- Устранить противоречия
- Усилить слабые места
- Сформировать единый вывод
- Обеспечить математическую строгость`
  },

  gemini: {
    system: `Ты — Генератор альтернатив и широты.

ТВОЯ РОЛЬ:
- Альтернативные гипотезы
- Нестандартные сценарии
- Cross-domain аналогии
- Расширение пространства решений

ФОРМАТ:
1. АЛЬТЕРНАТИВНЫЕ ГИПОТЕЗЫ
   - Минимум 3 альтернативы
   - Вероятность каждой

2. СЦЕНАРИИ
   - Оптимистичный
   - Базовый
   - Пессимистичный

3. АНАЛОГИИ ИЗ ДРУГИХ ОБЛАСТЕЙ
   - Область → Аналогия → Инсайт

4. НЕОЧЕВИДНЫЕ ФАКТОРЫ
   - Что упущено в стандартном анализе?`
  },

  deepseek: {
    system: `Ты — Формальный и технический аналитик.

ТВОЯ РОЛЬ:
- Данные и их корректность
- Формальные модели
- Количественные оценки
- Математическая строгость
- Технический аудит

ПРИНЦИП: Если можно посчитать — нужно посчитать.

ФОРМАТ:
1. ДАННЫЕ
   - Источники
   - Качество
   - Ограничения

2. КОЛИЧЕСТВЕННЫЙ АНАЛИЗ
   - Формулы
   - Расчёты
   - Доверительные интервалы

3. МОДЕЛИ
   - Используемые модели
   - Допущения
   - Sensitivity analysis

4. ЧИСЛЕННЫЕ ВЫВОДЫ
   - Точечные оценки
   - Диапазоны
   - Risk-adjusted метрики`
  }
};
```

### 2.2 RAG #2: Образы мышления

**Seed данные:**

```sql
INSERT INTO rag_thinking_patterns (thinker_name, domain, pattern_description, heuristics) VALUES
('Richard Feynman', ARRAY['physics', 'science', 'learning'],
 'Декомпозиция до первых принципов. Объяснение простым языком как тест понимания.',
 '{"first_principles": true, "simplify_to_teach": true, "question_everything": true}'::jsonb),

('Warren Buffett', ARRAY['investing', 'business', 'strategy'],
 'Маржа безопасности. Круг компетенций. Долгосрочное мышление. Простота.',
 '{"margin_of_safety": 0.3, "circle_of_competence": true, "long_term": true}'::jsonb),

('Charlie Munger', ARRAY['investing', 'mental_models', 'decision_making'],
 'Латтис ментальных моделей. Инверсия. Мультидисциплинарность.',
 '{"mental_models": ["inversion", "second_order_thinking", "opportunity_cost"], "avoid_mistakes": true}'::jsonb),

('Elon Musk', ARRAY['engineering', 'business', 'innovation'],
 'Первые принципы в инженерии. Вертикальная интеграция. 10x мышление.',
 '{"first_principles": true, "vertical_integration": true, "10x_thinking": true}'::jsonb),

('Daniel Kahneman', ARRAY['psychology', 'decision_making', 'economics'],
 'System 1 vs System 2. Когнитивные искажения. Pre-mortem.',
 '{"cognitive_biases": true, "pre_mortem": true, "base_rates": true}'::jsonb),

('Peter Thiel', ARRAY['startups', 'investing', 'strategy'],
 'Монополия vs конкуренция. Секреты. Definite optimism.',
 '{"monopoly_thinking": true, "secrets": true, "definite_optimism": true}'::jsonb);
```

### 2.3 RAG #3: Контекст задачи

**Workflow для загрузки контекста:**

```
User Upload → Parse Documents → Generate Embeddings → Store in Supabase
```

```sql
CREATE TABLE task_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id),
  document_name TEXT,
  content TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Фаза 3: Итеративный процесс

### 3.1 Итерация 1: Независимый анализ

```javascript
// Orchestrator: Iteration 1
async function iteration1(sessionId, task) {
  // 1. Загрузить контекст (если есть)
  const context = await loadTaskContext(sessionId);

  // 2. Загрузить образы мышления (релевантные)
  const patterns = await searchThinkingPatterns(task, 3);

  // 3. Вызвать всех агентов параллельно
  const responses = await Promise.all([
    callAgent('chatgpt', { task, context, patterns, iteration: 1 }),
    callAgent('claude', { task, context, patterns, iteration: 1 }),
    callAgent('gemini', { task, context, patterns, iteration: 1 }),
    callAgent('deepseek', { task, context, patterns, iteration: 1 })
  ]);

  // 4. Сохранить ответы
  await saveResponses(sessionId, responses, 1);

  return responses;
}
```

### 3.2 Итерация 2: Adversarial Critique

```javascript
// Orchestrator: Iteration 2
async function iteration2(sessionId, iteration1Results) {
  // Каждый агент критикует всех остальных
  const critiquePairs = [
    { critic: 'chatgpt', targets: ['claude', 'gemini', 'deepseek'] },
    { critic: 'claude', targets: ['chatgpt', 'gemini', 'deepseek'] },
    { critic: 'gemini', targets: ['chatgpt', 'claude', 'deepseek'] },
    { critic: 'deepseek', targets: ['chatgpt', 'claude', 'gemini'] }
  ];

  const critiques = [];

  for (const pair of critiquePairs) {
    const targetResponses = iteration1Results
      .filter(r => pair.targets.includes(r.agent_name));

    const critique = await callAgent(pair.critic, {
      mode: 'critique',
      responses_to_critique: targetResponses,
      criteria: QUALITY_CRITERIA,
      iteration: 2
    });

    critiques.push(critique);

    // Сохранить межагентный диалог
    for (const target of pair.targets) {
      await saveDialogue(sessionId, pair.critic, target, critique);
    }
  }

  return critiques;
}
```

### 3.3 Итерация 3: Синтез

```javascript
// Orchestrator: Iteration 3
async function iteration3(sessionId, allPreviousResults) {
  // Claude как интегратор собирает финальный результат
  const synthesis = await callAgent('claude', {
    mode: 'synthesis',
    iteration1: allPreviousResults.iteration1,
    iteration2: allPreviousResults.iteration2,
    format: OUTPUT_FORMAT,
    iteration: 3
  });

  // DeepSeek верифицирует математику
  const verification = await callAgent('deepseek', {
    mode: 'verify_math',
    synthesis: synthesis,
    iteration: 3
  });

  // Финальная доработка если нужно
  if (verification.errors.length > 0) {
    synthesis = await callAgent('claude', {
      mode: 'fix_errors',
      synthesis: synthesis,
      errors: verification.errors
    });
  }

  return synthesis;
}
```

---

## Фаза 4: Формализация и вывод

### 4.1 Структура финального результата

```typescript
interface FinalResult {
  report: {
    executive_summary: string;
    methodology: {
      approach: string;
      justification: string;
      limitations: string[];
    };
    analysis: {
      main_findings: Finding[];
      alternative_scenarios: Scenario[];
      assumptions: Assumption[];
    };
    boundaries: {
      where_applicable: string[];
      where_not_applicable: string[];
    };
  };

  conclusions_table: {
    conclusion: string;
    probability: number; // 0-1
    confidence_interval: [number, number];
    key_risks: string[];
    falsification_conditions: string[];
    numerical_parameters?: Record<string, number>;
  }[];

  formulas: {
    formula: string; // LaTeX
    variables: {
      symbol: string;
      description: string;
      unit?: string;
      range?: [number, number];
    }[];
    interpretation: string;
  }[];

  recommendations: {
    option: string;
    description: string;
    pros: string[];
    cons: string[];
    optimal_when: string[];
    dangerous_when: string[];
    quantitative_comparison: Record<string, number>;
  }[];
}
```

### 4.2 Форматирование вывода

```javascript
// Format Output node
function formatFinalOutput(synthesis) {
  return {
    // A. Аналитический отчёт (Markdown)
    report_md: generateMarkdownReport(synthesis.report),

    // B. Таблица выводов (для отображения)
    conclusions_table: synthesis.conclusions_table,

    // C. Формулы (LaTeX + интерпретация)
    formulas_display: synthesis.formulas.map(f => ({
      latex: f.formula,
      rendered: renderLatex(f.formula),
      variables_table: f.variables,
      plain_text: f.interpretation
    })),

    // D. Рекомендации (структурированные)
    recommendations: synthesis.recommendations.map(r => ({
      ...r,
      score: calculateRecommendationScore(r)
    })).sort((a, b) => b.score - a.score)
  };
}
```

---

## Фаза 5: Эволюция и оптимизация

### 5.1 Метрики качества

```sql
CREATE TABLE quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id),
  metric_type TEXT, -- 'user_rating', 'self_assessment', 'verification'
  score DECIMAL(3,2),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Эволюция промтов

```javascript
// После каждой сессии
async function evolvePrompts(sessionId) {
  const metrics = await getSessionMetrics(sessionId);

  if (metrics.overall_score < 0.7) {
    // Анализ слабых мест
    const weaknesses = analyzeWeaknesses(sessionId);

    // Генерация улучшенного промта
    for (const agent of weaknesses.agents) {
      const currentPrompt = await getPrompt(agent.name);

      const improvedPrompt = await callAgent('claude', {
        mode: 'improve_prompt',
        current_prompt: currentPrompt,
        weaknesses: agent.weaknesses,
        target_improvement: 0.1
      });

      // Сохранить новую версию
      await savePrompt(agent.name, improvedPrompt, currentPrompt.version + 1);
    }
  }
}
```

### 5.3 A/B тестирование промтов

```javascript
// При вызове агента
async function callAgentWithABTest(agentName, params) {
  const prompts = await getPromptVersions(agentName);

  // 80% — лучший промт, 20% — экспериментальный
  const useExperimental = Math.random() < 0.2;
  const prompt = useExperimental ? prompts.experimental : prompts.best;

  const response = await callLLM(agentName, prompt, params);

  // Логировать для анализа
  await logABTest(agentName, prompt.version, params.session_id);

  return response;
}
```

---

## Чек-лист реализации

### Фаза 0: Инфраструктура
- [x] Создать SQL-скрипт таблиц (`migrations/001_initial_schema.sql`)
- [x] Применить миграции в Supabase ✅ 2026-02-02
- [x] Настроить pgvector расширение ✅ (включено в миграции)
- [ ] Настроить Redis (опционально)
- [x] Добавить .env.example с инструкциями

### Фаза 1: Базовая оркестрация (Python/LangGraph)
- [x] Создать LangGraph workflow (`src/graph/workflow.py`)
- [x] Создать агент ChatGPT (`src/agents/llm_agents.py`)
- [x] Создать агент Claude (`src/agents/llm_agents.py`)
- [x] Создать агент Gemini (`src/agents/llm_agents.py`)
- [x] Создать агент DeepSeek (`src/agents/llm_agents.py`)
- [x] Реализовать параллельный вызов агентов
- [x] Создать FastAPI endpoints (`src/api/main.py`)

### Фаза 2: RAG-агенты
- [x] Создать SQL seed для промптов (`migrations/002_seed_prompts.sql`)
- [x] Создать SQL seed для паттернов (`migrations/003_seed_thinking_patterns.sql`)
- [x] Реализовать vector store (`src/rag/vector_store.py`)
- [x] Реализовать thinking patterns (`src/rag/thinking_patterns.py`)
- [x] Применить seed данные в Supabase ✅ 2026-02-02
- [ ] Сгенерировать embeddings для паттернов

### Фаза 3: Итеративный процесс
- [x] Реализовать Iteration 1 — независимый анализ (`parallel_analysis`)
- [x] Реализовать Iteration 2 — adversarial critique (`adversarial_critique`)
- [x] Реализовать Iteration 3 — synthesis (`synthesize`)
- [x] Реализовать условие продолжения (`should_continue`)
- [ ] Интеграционное тестирование с реальными API

### Фаза 4: Формализация и вывод
- [x] Реализовать модели вывода (`CosiliumOutput`, `SynthesisResult`)
- [x] Реализовать таблицу выводов (`conclusions`)
- [x] Реализовать рекомендации (`recommendations`)
- [ ] Реализовать LaTeX рендеринг формул

### Фаза 5: Эволюция и оптимизация
- [x] Реализовать сбор метрик (`src/monitoring/`)
- [x] Реализовать эволюцию промптов (`src/rag/prompt_evolution.py`)
- [x] Создать таблицу для A/B тестирования
- [ ] Реализовать полноценное A/B тестирование
- [ ] Создать dashboard мониторинга

---

## Приоритеты MVP

**Код готов, осталась инфраструктура:**

1. ✅ Документация (ARCHITECTURE.md, ROADMAP.md, README.md)
2. ✅ Python код (LangGraph workflow, 4 агента, FastAPI)
3. ✅ SQL миграции (схема БД, seed данные)
4. ✅ Тесты (61 passed)
5. 🔲 **API ключи** — добавить в .env
6. 🔲 **Supabase** — применить миграции
7. 🔲 **Интеграционный тест** — проверить с реальными LLM

**Для запуска MVP нужно:**
```bash
# 1. Скопировать и настроить .env
cp .env.example .env
# Добавить как минимум OPENAI_API_KEY и ANTHROPIC_API_KEY

# 2. Применить миграции в Supabase (через SQL Editor)
# migrations/001_initial_schema.sql
# migrations/002_seed_prompts.sql
# migrations/003_seed_thinking_patterns.sql

# 3. Запустить сервер
python main.py

# 4. Протестировать
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"task": "Оценить рынок", "task_type": "strategy"}'
```

**После MVP:**
- Сгенерировать embeddings для thinking patterns
- Включить RAG (`ENABLE_RAG=true`)
- Настроить LangSmith мониторинг
- Реализовать LaTeX рендеринг
