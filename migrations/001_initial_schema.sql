-- ============================================================
-- Cosilium-LLM: Initial Database Schema
-- Version: 1.0
-- Date: 2026-02-01
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Analysis sessions (main entity)
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  task_description TEXT NOT NULL,
  task_type TEXT CHECK (task_type IN ('strategy', 'research', 'investment', 'development', 'audit')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'iteration_1', 'iteration_2', 'iteration_3', 'completed', 'failed')),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent responses for each iteration
CREATE TABLE IF NOT EXISTS agent_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL CHECK (agent_name IN ('chatgpt', 'claude', 'gemini', 'deepseek')),
  iteration INTEGER NOT NULL CHECK (iteration BETWEEN 1 AND 3),
  response_type TEXT CHECK (response_type IN ('analysis', 'critique', 'synthesis', 'verification')),
  content JSONB NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),
  methodology TEXT,
  assumptions TEXT[],
  processing_time_ms INTEGER,
  token_count INTEGER,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inter-agent dialogues (critique exchanges)
CREATE TABLE IF NOT EXISTS inter_agent_dialogues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  message_type TEXT CHECK (message_type IN ('critique', 'question', 'clarification', 'agreement', 'disagreement')),
  content TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final results
CREATE TABLE IF NOT EXISTS final_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE UNIQUE,
  report JSONB NOT NULL,
  conclusions_table JSONB NOT NULL,
  formulas JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  overall_confidence DECIMAL(3,2),
  quality_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RAG TABLES
-- ============================================================

-- RAG #1: Optimal prompts for agents
CREATE TABLE IF NOT EXISTS rag_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('system', 'analysis', 'critique', 'synthesis', 'verification')),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  performance_score DECIMAL(3,2),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_name, prompt_type, version)
);

-- RAG #2: Thinking patterns of great minds
CREATE TABLE IF NOT EXISTS rag_thinking_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thinker_name TEXT NOT NULL,
  domains TEXT[] NOT NULL,
  pattern_description TEXT NOT NULL,
  heuristics JSONB,
  examples TEXT[],
  embedding VECTOR(1536),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RAG #3: Task context (user-provided documents)
CREATE TABLE IF NOT EXISTS task_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  document_name TEXT,
  document_type TEXT, -- 'text', 'pdf', 'csv', 'json'
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUALITY & METRICS TABLES
-- ============================================================

-- Quality metrics per session
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('user_rating', 'self_assessment', 'verification', 'consistency')),
  score DECIMAL(3,2) CHECK (score BETWEEN 0 AND 1),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt A/B testing logs
CREATE TABLE IF NOT EXISTS prompt_ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  is_experimental BOOLEAN DEFAULT false,
  outcome_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Analysis sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON analysis_sessions(created_at DESC);

-- Agent responses
CREATE INDEX IF NOT EXISTS idx_responses_session ON agent_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_agent ON agent_responses(agent_name);
CREATE INDEX IF NOT EXISTS idx_responses_iteration ON agent_responses(session_id, iteration);

-- Inter-agent dialogues
CREATE INDEX IF NOT EXISTS idx_dialogues_session ON inter_agent_dialogues(session_id);

-- RAG prompts
CREATE INDEX IF NOT EXISTS idx_prompts_agent ON rag_prompts(agent_name, prompt_type) WHERE is_active = true;

-- Thinking patterns - vector similarity search
CREATE INDEX IF NOT EXISTS idx_patterns_embedding ON rag_thinking_patterns
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Task context - vector similarity search
CREATE INDEX IF NOT EXISTS idx_context_embedding ON task_context
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Quality metrics
CREATE INDEX IF NOT EXISTS idx_metrics_session ON quality_metrics(session_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_sessions_updated
  BEFORE UPDATE ON analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_prompts_updated
  BEFORE UPDATE ON rag_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to get active prompt for agent
CREATE OR REPLACE FUNCTION get_active_prompt(p_agent TEXT, p_type TEXT)
RETURNS TABLE(content TEXT, version INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT rp.content, rp.version
  FROM rag_prompts rp
  WHERE rp.agent_name = p_agent
    AND rp.prompt_type = p_type
    AND rp.is_active = true
  ORDER BY rp.version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to search similar thinking patterns
CREATE OR REPLACE FUNCTION search_thinking_patterns(
  query_embedding VECTOR(1536),
  match_count INTEGER DEFAULT 3
)
RETURNS TABLE(
  id UUID,
  thinker_name TEXT,
  domains TEXT[],
  pattern_description TEXT,
  heuristics JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tp.id,
    tp.thinker_name,
    tp.domains,
    tp.pattern_description,
    tp.heuristics,
    1 - (tp.embedding <=> query_embedding) as similarity
  FROM rag_thinking_patterns tp
  WHERE tp.is_active = true
  ORDER BY tp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to search task context
CREATE OR REPLACE FUNCTION search_task_context(
  p_session_id UUID,
  query_embedding VECTOR(1536),
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  document_name TEXT,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.document_name,
    tc.content,
    1 - (tc.embedding <=> query_embedding) as similarity
  FROM task_context tc
  WHERE tc.session_id = p_session_id
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate session quality score
CREATE OR REPLACE FUNCTION calculate_session_quality(p_session_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  avg_score DECIMAL(3,2);
BEGIN
  SELECT AVG(score) INTO avg_score
  FROM quality_metrics
  WHERE session_id = p_session_id;

  RETURN COALESCE(avg_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (optional, for multi-tenant)
-- ============================================================

-- Enable RLS on main tables
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_context ENABLE ROW LEVEL SECURITY;

-- Policies (customize based on auth strategy)
-- Example: Users can only see their own sessions
CREATE POLICY sessions_user_policy ON analysis_sessions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE analysis_sessions IS 'Main table for analysis sessions';
COMMENT ON TABLE agent_responses IS 'Responses from each LLM agent per iteration';
COMMENT ON TABLE inter_agent_dialogues IS 'Critique exchanges between agents';
COMMENT ON TABLE final_results IS 'Final integrated results for each session';
COMMENT ON TABLE rag_prompts IS 'RAG #1: Self-evolving prompts for agents';
COMMENT ON TABLE rag_thinking_patterns IS 'RAG #2: Thinking patterns of great minds';
COMMENT ON TABLE task_context IS 'RAG #3: User-provided context documents';
COMMENT ON TABLE quality_metrics IS 'Quality metrics for continuous improvement';
