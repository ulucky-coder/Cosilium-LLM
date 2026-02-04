import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_USER_ID = "default";

// GET /api/studio/logs - Get logs
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const level = searchParams.get("level");
  const agentId = searchParams.get("agent_id");
  const limit = parseInt(searchParams.get("limit") || "100");

  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: getMockLogs(),
      source: "mock"
    });
  }

  try {
    let query = supabase
      .from("llm_top_logs")
      .select("*")
      .eq("user_id", userId);

    if (level && level !== "all") {
      query = query.eq("level", level);
    }

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "database"
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

// POST /api/studio/logs - Create a log entry
export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    // Just return success even if Supabase not configured
    return NextResponse.json({ success: true, message: "Log stored (memory)" });
  }

  try {
    const body = await request.json();
    const {
      user_id = DEFAULT_USER_ID,
      level = "info",
      message,
      agent_id,
      session_id,
      metadata,
    } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Missing required field: message" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("llm_top_logs")
      .insert({
        user_id,
        level,
        message,
        agent_id,
        session_id,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Log created"
    });
  } catch (error) {
    console.error("Error creating log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create log" },
      { status: 500 }
    );
  }
}

// DELETE /api/studio/logs - Clear old logs
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const olderThan = searchParams.get("older_than"); // ISO date string

  try {
    let query = supabase
      .from("llm_top_logs")
      .delete()
      .eq("user_id", userId);

    if (olderThan) {
      query = query.lt("created_at", olderThan);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Logs cleared"
    });
  } catch (error) {
    console.error("Error clearing logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}

function getMockLogs() {
  const now = new Date();
  return [
    {
      id: "1",
      created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      level: "error",
      message: "OpenAI rate limit exceeded",
      agent_id: "chatgpt",
    },
    {
      id: "2",
      created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      level: "success",
      message: "Analysis completed successfully",
      agent_id: "all",
    },
    {
      id: "3",
      created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      level: "warning",
      message: "DeepSeek response timeout, retrying...",
      agent_id: "deepseek",
    },
    {
      id: "4",
      created_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      level: "success",
      message: "Session created: abc-123",
      agent_id: "system",
    },
    {
      id: "5",
      created_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      level: "info",
      message: "User started new analysis",
      agent_id: "system",
    },
    {
      id: "6",
      created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      level: "success",
      message: "Synthesis completed",
      agent_id: "claude",
    },
    {
      id: "7",
      created_at: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
      level: "error",
      message: "Invalid JSON in response",
      agent_id: "gemini",
    },
    {
      id: "8",
      created_at: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      level: "success",
      message: "Analysis completed successfully",
      agent_id: "all",
    },
  ];
}
