-- Migration 004: A/B Testing tables for prompt experiments
-- Enables comparison of different prompt variants

-- Experiments table (main experiment definition)
CREATE TABLE IF NOT EXISTS llm_top_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, running, paused, completed

  -- Test configuration
  sample_size INTEGER DEFAULT 10,
  metrics_to_track TEXT[] DEFAULT ARRAY['quality', 'latency', 'cost'],

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Results summary (populated when completed)
  winner_variant_id UUID,
  results_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_status
  ON llm_top_experiments(user_id, status);

-- Experiment variants (different prompt versions to test)
CREATE TABLE IF NOT EXISTS llm_top_experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES llm_top_experiments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Control", "Variant A", "Variant B"
  prompt_content TEXT NOT NULL,

  -- Traffic allocation (percentage, should sum to 100 across variants)
  traffic_percentage INTEGER DEFAULT 50,

  -- Aggregated metrics (updated as results come in)
  total_runs INTEGER DEFAULT 0,
  avg_quality_score DECIMAL(4,2),
  avg_latency_ms INTEGER,
  avg_cost_usd DECIMAL(10,6),
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_experiment
  ON llm_top_experiment_variants(experiment_id);

-- Individual test runs (each execution of a variant)
CREATE TABLE IF NOT EXISTS llm_top_experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES llm_top_experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES llm_top_experiment_variants(id) ON DELETE CASCADE,

  -- Input
  test_input TEXT NOT NULL,

  -- Output
  output TEXT,

  -- Metrics
  quality_score DECIMAL(4,2), -- 0-10 scale, can be auto or manual
  latency_ms INTEGER,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),

  -- Status
  status TEXT DEFAULT 'pending', -- pending, running, completed, error
  error_message TEXT,

  -- Evaluation
  evaluated_by TEXT, -- 'auto', 'human', or user_id
  evaluation_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_runs_variant
  ON llm_top_experiment_runs(variant_id, status);

CREATE INDEX IF NOT EXISTS idx_runs_experiment
  ON llm_top_experiment_runs(experiment_id, created_at DESC);

-- Test inputs pool (reusable test cases)
CREATE TABLE IF NOT EXISTS llm_top_test_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  input_text TEXT NOT NULL,
  expected_output TEXT, -- optional, for evaluation
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_inputs_user
  ON llm_top_test_inputs(user_id);

-- Function to update variant aggregates after a run completes
CREATE OR REPLACE FUNCTION update_variant_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE llm_top_experiment_variants
    SET
      total_runs = total_runs + 1,
      avg_quality_score = (
        SELECT AVG(quality_score)
        FROM llm_top_experiment_runs
        WHERE variant_id = NEW.variant_id AND status = 'completed' AND quality_score IS NOT NULL
      ),
      avg_latency_ms = (
        SELECT AVG(latency_ms)::INTEGER
        FROM llm_top_experiment_runs
        WHERE variant_id = NEW.variant_id AND status = 'completed' AND latency_ms IS NOT NULL
      ),
      avg_cost_usd = (
        SELECT AVG(cost_usd)
        FROM llm_top_experiment_runs
        WHERE variant_id = NEW.variant_id AND status = 'completed' AND cost_usd IS NOT NULL
      )
    WHERE id = NEW.variant_id;
  ELSIF NEW.status = 'error' THEN
    UPDATE llm_top_experiment_variants
    SET error_count = error_count + 1
    WHERE id = NEW.variant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for aggregate updates
DROP TRIGGER IF EXISTS run_completed_trigger ON llm_top_experiment_runs;
CREATE TRIGGER run_completed_trigger
  AFTER UPDATE OF status ON llm_top_experiment_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_variant_aggregates();

-- Insert some sample test inputs
INSERT INTO llm_top_test_inputs (user_id, name, input_text, tags) VALUES
  ('default', 'Инвестиционный анализ', 'Оценить инвестиционную привлекательность стартапа в сфере AI с оценкой $10M', ARRAY['strategy', 'investment']),
  ('default', 'Бизнес-стратегия', 'Разработать стратегию выхода на рынок B2B SaaS в России', ARRAY['strategy', 'market']),
  ('default', 'Технический аудит', 'Провести аудит архитектуры микросервисного приложения на Kubernetes', ARRAY['technical', 'audit']),
  ('default', 'Риск-анализ', 'Оценить риски запуска нового продукта в условиях высокой инфляции', ARRAY['risk', 'strategy']),
  ('default', 'Конкурентный анализ', 'Сравнить позиционирование ChatGPT, Claude и Gemini для enterprise рынка', ARRAY['research', 'competition'])
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE llm_top_experiments IS 'A/B test experiments for comparing prompt variants';
COMMENT ON TABLE llm_top_experiment_variants IS 'Different prompt versions being tested in an experiment';
COMMENT ON TABLE llm_top_experiment_runs IS 'Individual test executions and their results';
COMMENT ON TABLE llm_top_test_inputs IS 'Reusable test cases for experiments';
