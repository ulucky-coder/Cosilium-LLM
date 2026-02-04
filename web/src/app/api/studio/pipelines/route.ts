import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_USER_ID = "default";

// GET /api/studio/pipelines - Get all pipelines for user
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: [getDefaultPipeline()],
      source: "memory"
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const pipelineId = searchParams.get("id");

  try {
    let query = supabase
      .from("llm_top_pipelines")
      .select("*")
      .eq("user_id", userId);

    if (pipelineId) {
      query = query.eq("id", pipelineId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "database"
    });
  } catch (error) {
    console.error("Error fetching pipelines:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pipelines" },
      { status: 500 }
    );
  }
}

// POST /api/studio/pipelines - Create a new pipeline
export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { name, description, nodes, user_id = DEFAULT_USER_ID } = body;

    if (!name || !nodes) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, nodes" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("llm_top_pipelines")
      .insert({
        user_id,
        name,
        description,
        nodes,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Pipeline created"
    });
  } catch (error) {
    console.error("Error creating pipeline:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create pipeline" },
      { status: 500 }
    );
  }
}

// PUT /api/studio/pipelines - Update a pipeline
export async function PUT(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, description, nodes, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing pipeline id" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (nodes !== undefined) updateData.nodes = nodes;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("llm_top_pipelines")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Pipeline updated"
    });
  } catch (error) {
    console.error("Error updating pipeline:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update pipeline" },
      { status: 500 }
    );
  }
}

// DELETE /api/studio/pipelines - Delete a pipeline
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing pipeline id" },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase
      .from("llm_top_pipelines")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Pipeline deleted"
    });
  } catch (error) {
    console.error("Error deleting pipeline:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete pipeline" },
      { status: 500 }
    );
  }
}

function getDefaultPipeline() {
  return {
    id: "default",
    name: "Main Analysis Pipeline",
    description: "Стандартный пайплайн анализа с 4 агентами",
    is_default: true,
    is_active: true,
    nodes: [
      {
        id: "input",
        type: "input",
        name: "Input",
        config: { fields: ["task", "context", "task_type"] },
        position: { x: 100, y: 50 },
        connections: ["parallel-agents"],
      },
      {
        id: "parallel-agents",
        type: "parallel",
        name: "Parallel Agents",
        config: { agents: ["chatgpt", "claude", "gemini", "deepseek"] },
        position: { x: 100, y: 150 },
        connections: ["critique"],
      },
      {
        id: "critique",
        type: "critique",
        name: "Critique Round",
        config: { enabled: true, rounds: 1 },
        position: { x: 100, y: 250 },
        connections: ["synthesis"],
      },
      {
        id: "synthesis",
        type: "synthesis",
        name: "Synthesis",
        config: { agent: "claude", consensusThreshold: 0.8 },
        position: { x: 100, y: 350 },
        connections: ["output"],
      },
      {
        id: "output",
        type: "output",
        name: "Output",
        config: { format: "json" },
        position: { x: 100, y: 450 },
        connections: [],
      },
    ],
  };
}
