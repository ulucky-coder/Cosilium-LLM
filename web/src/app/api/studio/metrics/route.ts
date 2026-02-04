import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_USER_ID = "default";

// GET /api/studio/metrics - Get metrics summary
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const period = searchParams.get("period") || "24h";
  const agentId = searchParams.get("agent_id");

  // Calculate time range
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "1h":
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "24h":
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  if (!supabase) {
    // Return mock data when Supabase is not configured
    return NextResponse.json({
      success: true,
      data: getMockMetrics(),
      source: "mock"
    });
  }

  try {
    let query = supabase
      .from("llm_top_metrics")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Aggregate metrics
    const summary = aggregateMetrics(data || []);

    return NextResponse.json({
      success: true,
      data: summary,
      raw: data,
      source: "database"
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

// POST /api/studio/metrics - Record a new metric
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
    const {
      user_id = DEFAULT_USER_ID,
      session_id,
      agent_id,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      cost_usd,
      latency_ms,
      status,
      error_message,
    } = body;

    if (!agent_id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: agent_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("llm_top_metrics")
      .insert({
        user_id,
        session_id,
        agent_id,
        model,
        prompt_tokens: prompt_tokens || 0,
        completion_tokens: completion_tokens || 0,
        total_tokens: total_tokens || (prompt_tokens || 0) + (completion_tokens || 0),
        cost_usd: cost_usd || 0,
        latency_ms,
        status: status || "success",
        error_message,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Metric recorded"
    });
  } catch (error) {
    console.error("Error recording metric:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record metric" },
      { status: 500 }
    );
  }
}

function aggregateMetrics(data: any[]) {
  const byAgent: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    errors: number;
  }> = {};

  let totalRequests = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalErrors = 0;

  for (const row of data) {
    const agent = row.agent_id;
    if (!byAgent[agent]) {
      byAgent[agent] = { requests: 0, tokens: 0, cost: 0, avgLatency: 0, errors: 0 };
    }

    byAgent[agent].requests++;
    byAgent[agent].tokens += row.total_tokens || 0;
    byAgent[agent].cost += parseFloat(row.cost_usd) || 0;
    byAgent[agent].avgLatency += row.latency_ms || 0;
    if (row.status === "error") {
      byAgent[agent].errors++;
      totalErrors++;
    }

    totalRequests++;
    totalTokens += row.total_tokens || 0;
    totalCost += parseFloat(row.cost_usd) || 0;
  }

  // Calculate averages
  for (const agent of Object.keys(byAgent)) {
    if (byAgent[agent].requests > 0) {
      byAgent[agent].avgLatency = Math.round(byAgent[agent].avgLatency / byAgent[agent].requests);
    }
  }

  return {
    totalRequests,
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    totalErrors,
    byAgent,
  };
}

function getMockMetrics() {
  return {
    totalRequests: 147,
    totalTokens: 245892,
    totalCost: 4.23,
    totalErrors: 3,
    byAgent: {
      chatgpt: { requests: 66, tokens: 112450, cost: 1.68, avgLatency: 2300, errors: 1 },
      claude: { requests: 51, tokens: 87320, cost: 1.31, avgLatency: 3100, errors: 0 },
      gemini: { requests: 18, tokens: 29940, cost: 0.15, avgLatency: 1800, errors: 1 },
      deepseek: { requests: 12, tokens: 19982, cost: 0.04, avgLatency: 4500, errors: 1 },
    },
  };
}
