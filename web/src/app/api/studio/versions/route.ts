import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_USER_ID = "default";

export interface PromptVersion {
  id: string;
  agent_id: string;
  version: number;
  content: string;
  change_summary?: string;
  created_at: string;
  created_by: string;
}

// GET /api/studio/versions - Get version history
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const agentId = searchParams.get("agent_id");
  const type = searchParams.get("type") || "prompt"; // prompt, config, pipeline
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!supabase) {
    // Return mock version history
    return NextResponse.json({
      success: true,
      data: getMockVersions(agentId),
      source: "mock",
    });
  }

  try {
    const tableName = getTableName(type);

    let query = supabase
      .from(tableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "database",
    });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

// POST /api/studio/versions - Create a new version (manual save)
export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: { id: `mock-${Date.now()}`, version: 1 },
      message: "Version saved (mock)",
    });
  }

  try {
    const body = await request.json();
    const {
      user_id = DEFAULT_USER_ID,
      agent_id,
      type = "prompt",
      content,
      config,
      change_summary,
    } = body;

    if (!agent_id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: agent_id" },
        { status: 400 }
      );
    }

    const tableName = getTableName(type);

    // Get next version number
    const { data: maxVersion } = await supabase
      .from(tableName)
      .select("version")
      .eq("user_id", user_id)
      .eq("agent_id", agent_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (maxVersion?.version || 0) + 1;

    // Insert new version
    const insertData: Record<string, unknown> = {
      user_id,
      agent_id,
      version: nextVersion,
      change_summary: change_summary || `Version ${nextVersion}`,
      created_by: "user",
    };

    if (type === "prompt") {
      insertData.content = content;
    } else if (type === "config") {
      insertData.config = config;
    }

    const { data, error } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: `Version ${nextVersion} created`,
    });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create version" },
      { status: 500 }
    );
  }
}

// PUT /api/studio/versions/rollback - Rollback to a specific version
export async function PUT(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      message: "Rollback successful (mock)",
    });
  }

  try {
    const body = await request.json();
    const {
      user_id = DEFAULT_USER_ID,
      agent_id,
      version,
      type = "prompt",
    } = body;

    if (!agent_id || version === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: agent_id, version" },
        { status: 400 }
      );
    }

    const versionTableName = getTableName(type);
    const currentTableName = getCurrentTableName(type);

    // Get the version to restore
    const { data: versionData, error: versionError } = await supabase
      .from(versionTableName)
      .select("*")
      .eq("user_id", user_id)
      .eq("agent_id", agent_id)
      .eq("version", version)
      .single();

    if (versionError || !versionData) {
      return NextResponse.json(
        { success: false, error: "Version not found" },
        { status: 404 }
      );
    }

    // First, save current state as a new version
    const { data: currentData } = await supabase
      .from(currentTableName)
      .select("*")
      .eq("user_id", user_id)
      .eq("agent_id", agent_id)
      .single();

    if (currentData) {
      // Get next version number for backup
      const { data: maxVersion } = await supabase
        .from(versionTableName)
        .select("version")
        .eq("user_id", user_id)
        .eq("agent_id", agent_id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const backupVersion = (maxVersion?.version || 0) + 1;

      // Save current as backup before rollback
      const backupData: Record<string, unknown> = {
        user_id,
        agent_id,
        version: backupVersion,
        change_summary: `Backup before rollback to v${version}`,
        created_by: "system",
      };

      if (type === "prompt") {
        backupData.content = currentData.content;
      } else if (type === "config") {
        backupData.config = currentData.config;
      }

      await supabase.from(versionTableName).insert(backupData);
    }

    // Update current record with version data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (type === "prompt") {
      updateData.content = versionData.content;
    } else if (type === "config") {
      updateData.model = versionData.config?.model;
      updateData.temperature = versionData.config?.temperature;
      updateData.max_tokens = versionData.config?.max_tokens;
      updateData.enabled = versionData.config?.enabled;
    }

    const { error: updateError } = await supabase
      .from(currentTableName)
      .update(updateData)
      .eq("user_id", user_id)
      .eq("agent_id", agent_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Rolled back to version ${version}`,
      data: versionData,
    });
  } catch (error) {
    console.error("Error rolling back version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to rollback" },
      { status: 500 }
    );
  }
}

// Helper functions
function getTableName(type: string): string {
  switch (type) {
    case "config":
      return "llm_top_config_versions";
    case "pipeline":
      return "llm_top_pipeline_versions";
    default:
      return "llm_top_prompt_versions";
  }
}

function getCurrentTableName(type: string): string {
  switch (type) {
    case "config":
      return "llm_top_agent_configs";
    case "pipeline":
      return "llm_top_pipelines";
    default:
      return "llm_top_prompts";
  }
}

function getMockVersions(agentId?: string | null): PromptVersion[] {
  const agents = agentId ? [agentId] : ["chatgpt", "claude", "gemini", "deepseek"];
  const versions: PromptVersion[] = [];
  const now = new Date();

  for (const agent of agents) {
    for (let v = 3; v >= 1; v--) {
      versions.push({
        id: `mock-${agent}-v${v}`,
        agent_id: agent,
        version: v,
        content: `Промпт для ${agent} версии ${v}.\n\nЭто тестовая версия промпта для демонстрации системы версионирования.`,
        change_summary: v === 3
          ? "Добавлена обработка ошибок"
          : v === 2
          ? "Улучшена структура ответа"
          : "Начальная версия",
        created_at: new Date(now.getTime() - (3 - v) * 24 * 60 * 60 * 1000).toISOString(),
        created_by: "user",
      });
    }
  }

  return versions.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
