import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { calculateCost } from "@/lib/metrics";

const DEFAULT_USER_ID = "default";

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  agent_id: string;
  status: "draft" | "running" | "paused" | "completed";
  sample_size: number;
  metrics_to_track: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  winner_variant_id?: string;
  results_summary?: Record<string, unknown>;
  variants?: Variant[];
}

export interface Variant {
  id: string;
  experiment_id: string;
  name: string;
  prompt_content: string;
  traffic_percentage: number;
  total_runs: number;
  avg_quality_score?: number;
  avg_latency_ms?: number;
  avg_cost_usd?: number;
  error_count: number;
}

export interface ExperimentRun {
  id: string;
  experiment_id: string;
  variant_id: string;
  test_input: string;
  output?: string;
  quality_score?: number;
  latency_ms?: number;
  tokens_used?: number;
  cost_usd?: number;
  status: "pending" | "running" | "completed" | "error";
  error_message?: string;
  evaluated_by?: string;
  created_at: string;
  completed_at?: string;
}

// GET /api/studio/experiments - List experiments
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;
  const experimentId = searchParams.get("id");
  const status = searchParams.get("status");

  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: getMockExperiments(),
      source: "mock",
    });
  }

  try {
    // If specific experiment requested, return with variants and runs
    if (experimentId) {
      const { data: experiment, error: expError } = await supabase
        .from("llm_top_experiments")
        .select("*")
        .eq("id", experimentId)
        .single();

      if (expError) throw expError;

      const { data: variants } = await supabase
        .from("llm_top_experiment_variants")
        .select("*")
        .eq("experiment_id", experimentId)
        .order("created_at", { ascending: true });

      const { data: runs } = await supabase
        .from("llm_top_experiment_runs")
        .select("*")
        .eq("experiment_id", experimentId)
        .order("created_at", { ascending: false })
        .limit(100);

      return NextResponse.json({
        success: true,
        data: { ...experiment, variants, runs },
        source: "database",
      });
    }

    // List all experiments
    let query = supabase
      .from("llm_top_experiments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get variants count for each experiment
    const experimentsWithCounts = await Promise.all(
      (data || []).map(async (exp) => {
        const { count } = await supabase
          .from("llm_top_experiment_variants")
          .select("*", { count: "exact", head: true })
          .eq("experiment_id", exp.id);
        return { ...exp, variants_count: count || 0 };
      })
    );

    return NextResponse.json({
      success: true,
      data: experimentsWithCounts,
      source: "database",
    });
  } catch (error) {
    console.error("Error fetching experiments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch experiments" },
      { status: 500 }
    );
  }
}

// POST /api/studio/experiments - Create experiment or add variant
export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  const body = await request.json();
  const { action = "create_experiment" } = body;

  if (!supabase) {
    return NextResponse.json({
      success: true,
      data: { id: `mock-${Date.now()}` },
      message: "Created (mock)",
    });
  }

  try {
    switch (action) {
      case "create_experiment": {
        const {
          user_id = DEFAULT_USER_ID,
          name,
          description,
          agent_id,
          sample_size = 10,
          metrics_to_track = ["quality", "latency", "cost"],
          variants = [],
        } = body;

        if (!name || !agent_id) {
          return NextResponse.json(
            { success: false, error: "Missing required fields: name, agent_id" },
            { status: 400 }
          );
        }

        // Create experiment
        const { data: experiment, error: expError } = await supabase
          .from("llm_top_experiments")
          .insert({
            user_id,
            name,
            description,
            agent_id,
            sample_size,
            metrics_to_track,
            status: "draft",
          })
          .select()
          .single();

        if (expError) throw expError;

        // Create variants if provided
        if (variants.length > 0) {
          const variantData = variants.map((v: { name: string; prompt_content: string; traffic_percentage?: number }, i: number) => ({
            experiment_id: experiment.id,
            name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
            prompt_content: v.prompt_content,
            traffic_percentage: v.traffic_percentage || Math.floor(100 / variants.length),
          }));

          await supabase.from("llm_top_experiment_variants").insert(variantData);
        }

        return NextResponse.json({
          success: true,
          data: experiment,
          message: "Experiment created",
        });
      }

      case "add_variant": {
        const { experiment_id, name, prompt_content, traffic_percentage = 50 } = body;

        if (!experiment_id || !prompt_content) {
          return NextResponse.json(
            { success: false, error: "Missing required fields" },
            { status: 400 }
          );
        }

        const { data, error } = await supabase
          .from("llm_top_experiment_variants")
          .insert({
            experiment_id,
            name: name || "New Variant",
            prompt_content,
            traffic_percentage,
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data,
          message: "Variant added",
        });
      }

      case "run_test": {
        const { experiment_id, variant_id, test_input } = body;

        if (!experiment_id || !variant_id || !test_input) {
          return NextResponse.json(
            { success: false, error: "Missing required fields" },
            { status: 400 }
          );
        }

        // Create run record
        const { data: run, error: runError } = await supabase
          .from("llm_top_experiment_runs")
          .insert({
            experiment_id,
            variant_id,
            test_input,
            status: "running",
          })
          .select()
          .single();

        if (runError) throw runError;

        // Get variant prompt
        const { data: variant } = await supabase
          .from("llm_top_experiment_variants")
          .select("prompt_content")
          .eq("id", variant_id)
          .single();

        // Get experiment agent
        const { data: experiment } = await supabase
          .from("llm_top_experiments")
          .select("agent_id")
          .eq("id", experiment_id)
          .single();

        // Execute the test (simplified - in real app would call actual LLM)
        const startTime = Date.now();
        try {
          // Call analyze API with the variant prompt
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/analyze`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                task: test_input,
                task_type: "experiment",
                max_iterations: 1,
              }),
            }
          );

          const result = await response.json();
          const agentResult = result.analyses?.find(
            (a: { agent_id: string }) => a.agent_id === experiment?.agent_id
          );

          const latencyMs = Date.now() - startTime;

          // Update run with results
          const { error: updateError } = await supabase
            .from("llm_top_experiment_runs")
            .update({
              output: agentResult?.analysis || "No output",
              latency_ms: latencyMs,
              tokens_used: agentResult?.tokens || 0,
              cost_usd: agentResult?.cost || 0,
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);

          if (updateError) throw updateError;

          return NextResponse.json({
            success: true,
            data: {
              run_id: run.id,
              output: agentResult?.analysis,
              latency_ms: latencyMs,
              tokens: agentResult?.tokens,
              cost: agentResult?.cost,
            },
            message: "Test completed",
          });
        } catch (testError) {
          // Update run with error
          await supabase
            .from("llm_top_experiment_runs")
            .update({
              status: "error",
              error_message: testError instanceof Error ? testError.message : "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);

          throw testError;
        }
      }

      case "evaluate_run": {
        const { run_id, quality_score, evaluation_notes, evaluated_by = "human" } = body;

        if (!run_id || quality_score === undefined) {
          return NextResponse.json(
            { success: false, error: "Missing required fields" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("llm_top_experiment_runs")
          .update({
            quality_score,
            evaluation_notes,
            evaluated_by,
          })
          .eq("id", run_id);

        if (error) throw error;

        return NextResponse.json({
          success: true,
          message: "Run evaluated",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in experiment action:", error);
    return NextResponse.json(
      { success: false, error: "Operation failed" },
      { status: 500 }
    );
  }
}

// PUT /api/studio/experiments - Update experiment status
export async function PUT(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json({
      success: true,
      message: "Updated (mock)",
    });
  }

  try {
    const body = await request.json();
    const { id, status, winner_variant_id, results_summary } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing experiment id" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      if (status === "running") {
        updateData.started_at = new Date().toISOString();
      } else if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (winner_variant_id) {
      updateData.winner_variant_id = winner_variant_id;
    }

    if (results_summary) {
      updateData.results_summary = results_summary;
    }

    const { error } = await supabase
      .from("llm_top_experiments")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Experiment updated",
    });
  } catch (error) {
    console.error("Error updating experiment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update experiment" },
      { status: 500 }
    );
  }
}

// DELETE /api/studio/experiments - Delete experiment
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing experiment id" },
      { status: 400 }
    );
  }

  if (!supabase) {
    return NextResponse.json({
      success: true,
      message: "Deleted (mock)",
    });
  }

  try {
    const { error } = await supabase
      .from("llm_top_experiments")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Experiment deleted",
    });
  } catch (error) {
    console.error("Error deleting experiment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete experiment" },
      { status: 500 }
    );
  }
}

// Mock data for demo
function getMockExperiments(): Experiment[] {
  return [
    {
      id: "mock-exp-1",
      name: "Prompt Clarity Test",
      description: "Сравнение краткого vs детального системного промпта",
      agent_id: "chatgpt",
      status: "completed",
      sample_size: 10,
      metrics_to_track: ["quality", "latency", "cost"],
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      started_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      winner_variant_id: "mock-var-1a",
      results_summary: {
        conclusion: "Детальный промпт показал лучшее качество при небольшом увеличении latency",
        quality_improvement: "+15%",
        latency_increase: "+200ms",
      },
      variants: [
        {
          id: "mock-var-1a",
          experiment_id: "mock-exp-1",
          name: "Control (Краткий)",
          prompt_content: "Ты аналитик. Отвечай кратко и по делу.",
          traffic_percentage: 50,
          total_runs: 10,
          avg_quality_score: 7.2,
          avg_latency_ms: 2100,
          avg_cost_usd: 0.012,
          error_count: 0,
        },
        {
          id: "mock-var-1b",
          experiment_id: "mock-exp-1",
          name: "Variant A (Детальный)",
          prompt_content: "Ты логический аналитик. Твоя задача — провести структурированный анализ...",
          traffic_percentage: 50,
          total_runs: 10,
          avg_quality_score: 8.3,
          avg_latency_ms: 2300,
          avg_cost_usd: 0.015,
          error_count: 0,
        },
      ],
    },
    {
      id: "mock-exp-2",
      name: "Temperature Comparison",
      description: "Тест влияния temperature на креативность ответов",
      agent_id: "claude",
      status: "running",
      sample_size: 20,
      metrics_to_track: ["quality", "creativity", "latency"],
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      variants: [
        {
          id: "mock-var-2a",
          experiment_id: "mock-exp-2",
          name: "Low Temp (0.3)",
          prompt_content: "Системный промпт для Claude с temperature 0.3",
          traffic_percentage: 33,
          total_runs: 7,
          avg_quality_score: 7.8,
          avg_latency_ms: 3100,
          avg_cost_usd: 0.022,
          error_count: 0,
        },
        {
          id: "mock-var-2b",
          experiment_id: "mock-exp-2",
          name: "Medium Temp (0.7)",
          prompt_content: "Системный промпт для Claude с temperature 0.7",
          traffic_percentage: 34,
          total_runs: 8,
          avg_quality_score: 8.1,
          avg_latency_ms: 3200,
          avg_cost_usd: 0.024,
          error_count: 1,
        },
        {
          id: "mock-var-2c",
          experiment_id: "mock-exp-2",
          name: "High Temp (1.0)",
          prompt_content: "Системный промпт для Claude с temperature 1.0",
          traffic_percentage: 33,
          total_runs: 5,
          avg_quality_score: 7.4,
          avg_latency_ms: 3400,
          avg_cost_usd: 0.026,
          error_count: 2,
        },
      ],
    },
    {
      id: "mock-exp-3",
      name: "Draft: New Agent Prompt",
      description: "Черновик эксперимента для нового промпта",
      agent_id: "deepseek",
      status: "draft",
      sample_size: 15,
      metrics_to_track: ["quality", "latency", "cost"],
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
