import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_USER_ID = "default";

// GET /api/studio/prompts - Get all prompts for user
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  if (!supabase) {
    // Return default prompts from memory if Supabase not configured
    return NextResponse.json({
      success: true,
      data: getDefaultPrompts(),
      source: "memory"
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get("agent_id");
  const userId = searchParams.get("user_id") || DEFAULT_USER_ID;

  try {
    let query = supabase
      .from("llm_top_prompts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query.order("agent_id");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "database"
    });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

// POST /api/studio/prompts - Create or update a prompt
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
    const { agent_id, prompt_type, content, user_id = DEFAULT_USER_ID } = body;

    if (!agent_id || !prompt_type || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: agent_id, prompt_type, content" },
        { status: 400 }
      );
    }

    // Deactivate existing prompt
    await supabase
      .from("llm_top_prompts")
      .update({ is_active: false })
      .eq("user_id", user_id)
      .eq("agent_id", agent_id)
      .eq("prompt_type", prompt_type)
      .eq("is_active", true);

    // Get max version
    const { data: versionData } = await supabase
      .from("llm_top_prompts")
      .select("version")
      .eq("user_id", user_id)
      .eq("agent_id", agent_id)
      .eq("prompt_type", prompt_type)
      .order("version", { ascending: false })
      .limit(1);

    const newVersion = (versionData?.[0]?.version || 0) + 1;

    // Insert new prompt
    const { data, error } = await supabase
      .from("llm_top_prompts")
      .insert({
        user_id,
        agent_id,
        prompt_type,
        content,
        version: newVersion,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: `Prompt saved (version ${newVersion})`
    });
  } catch (error) {
    console.error("Error saving prompt:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save prompt" },
      { status: 500 }
    );
  }
}

// Default prompts when Supabase is not configured
function getDefaultPrompts() {
  return [
    {
      id: "default-chatgpt-system",
      agent_id: "chatgpt",
      prompt_type: "system",
      content: `Ты логический аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Логический анализ, выявление противоречий, когнитивных искажений
Твои сильные стороны: Структурированность, логика, выявление ошибок в рассуждениях

ПРИНЦИПЫ АНАЛИЗА:
1. Если можно посчитать — нужно посчитать
2. Если нельзя посчитать — нужно объяснить почему
3. Если нельзя фальсифицировать — вывод считается слабым

Проверяй каждое утверждение на логическую непротиворечивость.`,
      version: 1,
    },
    {
      id: "default-claude-system",
      agent_id: "claude",
      prompt_type: "system",
      content: `Ты системный архитектор в мульти-агентной системе LLM-top.

Твоя специализация: Методология, интеграция различных перспектив, финальная редакция
Твои сильные стороны: Синтез, структурирование, целостное видение

ПРИНЦИПЫ АНАЛИЗА:
1. Интегрируй различные точки зрения в единую картину
2. Выявляй системные связи и зависимости
3. Формулируй практические рекомендации

Стремись к балансу между глубиной анализа и практичностью выводов.`,
      version: 1,
    },
    {
      id: "default-gemini-system",
      agent_id: "gemini",
      prompt_type: "system",
      content: `Ты генератор альтернатив в мульти-агентной системе LLM-top.

Твоя специализация: Генерация гипотез, сценариев, cross-domain аналогии
Твои сильные стороны: Креативность, широта охвата, нестандартный подход

ПРИНЦИПЫ АНАЛИЗА:
1. Генерируй минимум 3 альтернативных сценария
2. Ищи аналогии в других областях
3. Задавай неочевидные вопросы

Не ограничивайся первым решением — исследуй пространство возможностей.`,
      version: 1,
    },
    {
      id: "default-deepseek-system",
      agent_id: "deepseek",
      prompt_type: "system",
      content: `Ты формальный аналитик в мульти-агентной системе LLM-top.

Твоя специализация: Данные, модели, математика, технический аудит
Твои сильные стороны: Точность, формализация, количественный анализ

ПРИНЦИПЫ АНАЛИЗА:
1. Каждое утверждение должно быть подкреплено данными
2. Используй формальные модели где возможно
3. Указывай доверительные интервалы и погрешности

Приоритет — точность и воспроизводимость результатов.`,
      version: 1,
    },
  ];
}
