-- Migration: Control Plane tables for LLM-top
-- Created: 2024-02-04

-- Table for storing agent prompts
CREATE TABLE IF NOT EXISTS llm_top_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  agent_id TEXT NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('system', 'critique', 'user_template')),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_id, prompt_type, is_active)
);

-- Table for storing agent configurations
CREATE TABLE IF NOT EXISTS llm_top_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  focus TEXT,
  strengths TEXT[],
  model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_id)
);

-- Table for storing pipelines
CREATE TABLE IF NOT EXISTS llm_top_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for API usage metrics
CREATE TABLE IF NOT EXISTS llm_top_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  session_id UUID,
  agent_id TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for system logs
CREATE TABLE IF NOT EXISTS llm_top_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  level TEXT CHECK (level IN ('info', 'warning', 'error', 'success')),
  message TEXT NOT NULL,
  agent_id TEXT,
  session_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_user_agent ON llm_top_prompts(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_configs_user ON llm_top_agent_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_user ON llm_top_pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user_created ON llm_top_metrics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_created ON llm_top_logs(user_id, created_at DESC);

-- Insert default prompts for agents
INSERT INTO llm_top_prompts (user_id, agent_id, prompt_type, content) VALUES
('default', 'chatgpt', 'system', 'Ты логический аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Логический анализ, выявление противоречий, когнитивных искажений
Твои сильные стороны: Структурированность, логика, выявление ошибок в рассуждениях

ПРИНЦИПЫ АНАЛИЗА:
1. Если можно посчитать — нужно посчитать
2. Если нельзя посчитать — нужно объяснить почему
3. Если нельзя фальсифицировать — вывод считается слабым

Проверяй каждое утверждение на логическую непротиворечивость.'),
('default', 'claude', 'system', 'Ты системный архитектор в мульти-агентной системе LLM-top.

Твоя специализация: Методология, интеграция различных перспектив, финальная редакция
Твои сильные стороны: Синтез, структурирование, целостное видение

ПРИНЦИПЫ АНАЛИЗА:
1. Интегрируй различные точки зрения в единую картину
2. Выявляй системные связи и зависимости
3. Формулируй практические рекомендации

Стремись к балансу между глубиной анализа и практичностью выводов.'),
('default', 'gemini', 'system', 'Ты генератор альтернатив в мульти-агентной системе LLM-top.

Твоя специализация: Генерация гипотез, сценариев, cross-domain аналогии
Твои сильные стороны: Креативность, широта охвата, нестандартный подход

ПРИНЦИПЫ АНАЛИЗА:
1. Генерируй минимум 3 альтернативных сценария
2. Ищи аналогии в других областях
3. Задавай неочевидные вопросы

Не ограничивайся первым решением — исследуй пространство возможностей.'),
('default', 'deepseek', 'system', 'Ты формальный аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Данные, модели, математика, технический аудит
Твои сильные стороны: Точность, формализация, количественный анализ

ПРИНЦИПЫ АНАЛИЗА:
1. Каждое утверждение должно быть подкреплено данными
2. Используй формальные модели где возможно
3. Указывай доверительные интервалы и погрешности

Приоритет — точность и воспроизводимость результатов.')
ON CONFLICT DO NOTHING;

-- Insert default agent configs
INSERT INTO llm_top_agent_configs (user_id, agent_id, name, role, focus, strengths, model, temperature) VALUES
('default', 'chatgpt', 'ChatGPT', 'Логический аналитик', 'Логика, противоречия, когнитивные искажения', ARRAY['Структурированность', 'Логика', 'Выявление ошибок'], 'gpt-4-turbo', 0.7),
('default', 'claude', 'Claude', 'Системный архитектор', 'Методология, интеграция, финальная редакция', ARRAY['Синтез', 'Структурирование', 'Целостное видение'], 'claude-3-opus', 0.7),
('default', 'gemini', 'Gemini', 'Генератор альтернатив', 'Гипотезы, сценарии, cross-domain аналогии', ARRAY['Креативность', 'Широта охвата', 'Нестандартный подход'], 'gemini-pro', 0.8),
('default', 'deepseek', 'DeepSeek', 'Формальный аналитик', 'Данные, модели, математика, технический аудит', ARRAY['Точность', 'Формализация', 'Количественный анализ'], 'deepseek-chat', 0.5)
ON CONFLICT DO NOTHING;

-- Insert default pipeline
INSERT INTO llm_top_pipelines (user_id, name, description, is_default, nodes) VALUES
('default', 'Main Analysis Pipeline', 'Стандартный пайплайн анализа с 4 агентами', true, '[
  {"id": "input", "type": "input", "name": "Input", "config": {"fields": ["task", "context", "task_type"]}, "position": {"x": 100, "y": 50}, "connections": ["parallel-agents"]},
  {"id": "parallel-agents", "type": "parallel", "name": "Parallel Agents", "config": {"agents": ["chatgpt", "claude", "gemini", "deepseek"]}, "position": {"x": 100, "y": 150}, "connections": ["critique"]},
  {"id": "critique", "type": "critique", "name": "Critique Round", "config": {"enabled": true, "rounds": 1}, "position": {"x": 100, "y": 250}, "connections": ["synthesis"]},
  {"id": "synthesis", "type": "synthesis", "name": "Synthesis", "config": {"agent": "claude", "consensusThreshold": 0.8}, "position": {"x": 100, "y": 350}, "connections": ["output"]},
  {"id": "output", "type": "output", "name": "Output", "config": {"format": "json"}, "position": {"x": 100, "y": 450}, "connections": []}
]')
ON CONFLICT DO NOTHING;
