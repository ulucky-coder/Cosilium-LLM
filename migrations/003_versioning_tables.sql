-- Migration 003: Versioning tables for Control Plane
-- Creates tables for tracking version history of prompts and configurations

-- Prompt versions table
CREATE TABLE IF NOT EXISTS llm_top_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'user',

  -- Ensure unique version per agent per user
  UNIQUE(user_id, agent_id, version)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent
  ON llm_top_prompt_versions(user_id, agent_id, version DESC);

-- Agent config versions table
CREATE TABLE IF NOT EXISTS llm_top_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'user',

  UNIQUE(user_id, agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_config_versions_agent
  ON llm_top_config_versions(user_id, agent_id, version DESC);

-- Pipeline versions table
CREATE TABLE IF NOT EXISTS llm_top_pipeline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  pipeline_id UUID NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'user',

  UNIQUE(user_id, pipeline_id, version)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_versions_pipeline
  ON llm_top_pipeline_versions(user_id, pipeline_id, version DESC);

-- Function to auto-increment version number for prompts
CREATE OR REPLACE FUNCTION get_next_prompt_version(p_user_id TEXT, p_agent_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM llm_top_prompt_versions
  WHERE user_id = p_user_id AND agent_id = p_agent_id;
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-increment version number for configs
CREATE OR REPLACE FUNCTION get_next_config_version(p_user_id TEXT, p_agent_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM llm_top_config_versions
  WHERE user_id = p_user_id AND agent_id = p_agent_id;
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to create version on prompt update
CREATE OR REPLACE FUNCTION create_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content actually changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO llm_top_prompt_versions (user_id, agent_id, version, content, change_summary)
    VALUES (
      NEW.user_id,
      NEW.agent_id,
      get_next_prompt_version(NEW.user_id, NEW.agent_id),
      OLD.content,
      'Auto-saved before update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on prompts table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'llm_top_prompts') THEN
    DROP TRIGGER IF EXISTS prompt_version_trigger ON llm_top_prompts;
    CREATE TRIGGER prompt_version_trigger
      BEFORE UPDATE ON llm_top_prompts
      FOR EACH ROW
      EXECUTE FUNCTION create_prompt_version();
  END IF;
END $$;

-- Comments
COMMENT ON TABLE llm_top_prompt_versions IS 'Version history for agent prompts';
COMMENT ON TABLE llm_top_config_versions IS 'Version history for agent configurations';
COMMENT ON TABLE llm_top_pipeline_versions IS 'Version history for pipelines';
