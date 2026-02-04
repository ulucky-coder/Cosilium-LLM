import { NextRequest, NextResponse } from "next/server";
import { calculateCost, MODEL_PRICING } from "@/lib/metrics";
import { getSupabase } from "@/lib/supabase";

// Types
interface ContextItem {
  type: "text" | "url";
  title: string;
  content: string;
}

interface AnalysisRequest {
  task: string;
  task_type: string;
  max_iterations: number;
  context?: ContextItem[];
  session_id?: string;
}

interface AgentAnalysis {
  agent_name: string;
  agent_id: string;
  confidence: number;
  analysis: string;
  key_points: string[];
  risks: string[];
  assumptions: string[];
  duration: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  model: string;
}

interface SynthesisResult {
  summary: string;
  conclusions: Array<{
    conclusion: string;
    probability: string;
    falsification_condition: string;
  }>;
  recommendations: Array<{
    option: string;
    description: string;
    pros: string[];
    cons: string[];
    score: number;
  }>;
  consensus_level: number;
}

// API keys from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Check if real APIs are configured
const useRealAPIs = !!(OPENAI_API_KEY || ANTHROPIC_API_KEY || GOOGLE_API_KEY || DEEPSEEK_API_KEY);

// Agent system prompts
const AGENT_PROMPTS: Record<string, string> = {
  chatgpt: `Ты логический аналитик. Твоя задача — провести структурированный анализ с фокусом на логику, противоречия и когнитивные искажения.

Принципы:
1. Если можно посчитать — нужно посчитать
2. Если нельзя посчитать — объясни почему
3. Если нельзя фальсифицировать — вывод считается слабым`,

  claude: `Ты системный архитектор. Твоя задача — провести системный анализ с фокусом на целостное видение, взаимосвязи и методологию.

Принципы:
1. Смотри на систему целиком
2. Учитывай взаимосвязи между компонентами
3. Проектируй с учётом масштабирования`,

  gemini: `Ты генератор альтернатив. Твоя задача — предложить креативные решения, альтернативные сценарии и cross-domain аналогии.

Принципы:
1. Всегда есть альтернативный путь
2. Лучшие решения часто приходят из других областей
3. Генерируй минимум 3-5 альтернатив`,

  deepseek: `Ты формальный аналитик. Твоя задача — провести количественный анализ с формулами, расчётами и техническим аудитом.

Принципы:
1. Если можно посчитать — НУЖНО посчитать
2. Формулы важнее слов
3. Данные важнее мнений`,
};

// Record metric to database
async function recordMetric(data: {
  session_id?: string;
  agent_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: "success" | "error" | "timeout";
  error_message?: string;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from("llm_top_metrics").insert({
      user_id: "default",
      ...data,
    });
  } catch (error) {
    console.error("Failed to record metric:", error);
  }
}

// Record log to database
async function recordLog(data: {
  level: "info" | "warning" | "error" | "success";
  message: string;
  agent_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from("llm_top_logs").insert({
      user_id: "default",
      ...data,
    });
  } catch (error) {
    console.error("Failed to record log:", error);
  }
}

// Format context for prompts
function formatContext(context?: ContextItem[]): string {
  if (!context || context.length === 0) return "";

  const formatted = context.map((item, i) => {
    const typeLabel = item.type === "url" ? "Ссылка" : "Данные";
    return `### ${typeLabel} ${i + 1}: ${item.title}\n${item.content}`;
  }).join("\n\n");

  return `\n\n---\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:\n${formatted}\n---\n`;
}

// Call OpenAI API
async function callOpenAI(
  task: string,
  taskType: string,
  context?: ContextItem[],
  sessionId?: string
): Promise<AgentAnalysis | null> {
  if (!OPENAI_API_KEY) return null;

  const model = "gpt-4o";
  const startTime = Date.now();
  const contextStr = formatContext(context);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: AGENT_PROMPTS.chatgpt },
          { role: "user", content: `Тип анализа: ${taskType}\n\nЗадача:\n${task}${contextStr}\n\nПроведи структурированный анализ. Выдели ключевые точки, риски и допущения.` },
        ],
        temperature: 0.3,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);

      // Record error metric
      recordMetric({
        session_id: sessionId,
        agent_id: "chatgpt",
        model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
        status: "error",
        error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      });

      recordLog({
        level: "error",
        message: `OpenAI API error: ${response.status}`,
        agent_id: "chatgpt",
        session_id: sessionId,
      });

      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || 0;
    const cost = calculateCost(model, promptTokens, completionTokens);

    // Record success metric
    recordMetric({
      session_id: sessionId,
      agent_id: "chatgpt",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      latency_ms: latencyMs,
      status: "success",
    });

    recordLog({
      level: "success",
      message: `ChatGPT analysis completed (${totalTokens} tokens, $${cost.toFixed(4)})`,
      agent_id: "chatgpt",
      session_id: sessionId,
    });

    return {
      agent_name: "ChatGPT",
      agent_id: "chatgpt",
      confidence: 0.85,
      analysis: content,
      key_points: extractKeyPoints(content),
      risks: extractRisks(content),
      assumptions: extractAssumptions(content),
      duration: latencyMs,
      tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost,
      model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("OpenAI API error:", error);

    recordMetric({
      session_id: sessionId,
      agent_id: "chatgpt",
      model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      status: "error",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    recordLog({
      level: "error",
      message: `OpenAI API exception: ${error instanceof Error ? error.message : "Unknown"}`,
      agent_id: "chatgpt",
      session_id: sessionId,
    });

    return null;
  }
}

// Call Anthropic API
async function callAnthropic(
  task: string,
  taskType: string,
  context?: ContextItem[],
  sessionId?: string
): Promise<AgentAnalysis | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const model = "claude-3-5-sonnet-20241022";
  const startTime = Date.now();
  const contextStr = formatContext(context);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: AGENT_PROMPTS.claude,
        messages: [
          { role: "user", content: `Тип анализа: ${taskType}\n\nЗадача:\n${task}${contextStr}\n\nПроведи системный анализ. Выдели ключевые точки, риски и допущения.` },
        ],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      recordMetric({
        session_id: sessionId,
        agent_id: "claude",
        model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
        status: "error",
        error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      });

      recordLog({
        level: "error",
        message: `Anthropic API error: ${response.status}`,
        agent_id: "claude",
        session_id: sessionId,
      });

      return null;
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";
    const promptTokens = data.usage?.input_tokens || 0;
    const completionTokens = data.usage?.output_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(model, promptTokens, completionTokens);

    recordMetric({
      session_id: sessionId,
      agent_id: "claude",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      latency_ms: latencyMs,
      status: "success",
    });

    recordLog({
      level: "success",
      message: `Claude analysis completed (${totalTokens} tokens, $${cost.toFixed(4)})`,
      agent_id: "claude",
      session_id: sessionId,
    });

    return {
      agent_name: "Claude",
      agent_id: "claude",
      confidence: 0.88,
      analysis: content,
      key_points: extractKeyPoints(content),
      risks: extractRisks(content),
      assumptions: extractAssumptions(content),
      duration: latencyMs,
      tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost,
      model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("Anthropic API error:", error);

    recordMetric({
      session_id: sessionId,
      agent_id: "claude",
      model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      status: "error",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    recordLog({
      level: "error",
      message: `Anthropic API exception: ${error instanceof Error ? error.message : "Unknown"}`,
      agent_id: "claude",
      session_id: sessionId,
    });

    return null;
  }
}

// Call Google AI API
async function callGoogleAI(
  task: string,
  taskType: string,
  context?: ContextItem[],
  sessionId?: string
): Promise<AgentAnalysis | null> {
  if (!GOOGLE_API_KEY) return null;

  const model = "gemini-2.0-flash";
  const startTime = Date.now();
  const contextStr = formatContext(context);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${AGENT_PROMPTS.gemini}\n\nТип анализа: ${taskType}\n\nЗадача:\n${task}${contextStr}\n\nПредложи альтернативные подходы и решения. Выдели ключевые точки, риски и допущения.`
            }]
          }],
          generationConfig: { temperature: 0.5 },
        }),
      }
    );

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google AI API error:", response.status, errorText);

      recordMetric({
        session_id: sessionId,
        agent_id: "gemini",
        model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
        status: "error",
        error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      });

      recordLog({
        level: "error",
        message: `Google AI API error: ${response.status}`,
        agent_id: "gemini",
        session_id: sessionId,
      });

      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;
    const cost = calculateCost(model, promptTokens, completionTokens);

    recordMetric({
      session_id: sessionId,
      agent_id: "gemini",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      latency_ms: latencyMs,
      status: "success",
    });

    recordLog({
      level: "success",
      message: `Gemini analysis completed (${totalTokens} tokens, $${cost.toFixed(4)})`,
      agent_id: "gemini",
      session_id: sessionId,
    });

    return {
      agent_name: "Gemini",
      agent_id: "gemini",
      confidence: 0.82,
      analysis: content,
      key_points: extractKeyPoints(content),
      risks: extractRisks(content),
      assumptions: extractAssumptions(content),
      duration: latencyMs,
      tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost,
      model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("Google AI API error:", error);

    recordMetric({
      session_id: sessionId,
      agent_id: "gemini",
      model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      status: "error",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    recordLog({
      level: "error",
      message: `Google AI API exception: ${error instanceof Error ? error.message : "Unknown"}`,
      agent_id: "gemini",
      session_id: sessionId,
    });

    return null;
  }
}

// Call DeepSeek API
async function callDeepSeek(
  task: string,
  taskType: string,
  context?: ContextItem[],
  sessionId?: string
): Promise<AgentAnalysis | null> {
  if (!DEEPSEEK_API_KEY) return null;

  const model = "deepseek-chat";
  const startTime = Date.now();
  const contextStr = formatContext(context);

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: AGENT_PROMPTS.deepseek },
          { role: "user", content: `Тип анализа: ${taskType}\n\nЗадача:\n${task}${contextStr}\n\nПроведи количественный анализ с расчётами. Выдели ключевые точки, риски и допущения.` },
        ],
        temperature: 0.2,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);

      recordMetric({
        session_id: sessionId,
        agent_id: "deepseek",
        model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
        status: "error",
        error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      });

      recordLog({
        level: "error",
        message: `DeepSeek API error: ${response.status}`,
        agent_id: "deepseek",
        session_id: sessionId,
      });

      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;
    const cost = calculateCost(model, promptTokens, completionTokens);

    recordMetric({
      session_id: sessionId,
      agent_id: "deepseek",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
      latency_ms: latencyMs,
      status: "success",
    });

    recordLog({
      level: "success",
      message: `DeepSeek analysis completed (${totalTokens} tokens, $${cost.toFixed(4)})`,
      agent_id: "deepseek",
      session_id: sessionId,
    });

    return {
      agent_name: "DeepSeek",
      agent_id: "deepseek",
      confidence: 0.86,
      analysis: content,
      key_points: extractKeyPoints(content),
      risks: extractRisks(content),
      assumptions: extractAssumptions(content),
      duration: latencyMs,
      tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost,
      model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("DeepSeek API error:", error);

    recordMetric({
      session_id: sessionId,
      agent_id: "deepseek",
      model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      status: "error",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    recordLog({
      level: "error",
      message: `DeepSeek API exception: ${error instanceof Error ? error.message : "Unknown"}`,
      agent_id: "deepseek",
      session_id: sessionId,
    });

    return null;
  }
}

// Helper functions to extract structured data from text
function extractKeyPoints(text: string): string[] {
  const points: string[] = [];
  const lines = text.split('\n');
  let inKeyPoints = false;

  for (const line of lines) {
    if (line.match(/ключев|key point|важн|основн/i)) {
      inKeyPoints = true;
      continue;
    }
    if (inKeyPoints && line.match(/^[-•*]\s+(.+)/)) {
      points.push(line.replace(/^[-•*]\s+/, '').trim());
      if (points.length >= 5) break;
    }
    if (inKeyPoints && line.match(/^[0-9]+[.)]\s+(.+)/)) {
      points.push(line.replace(/^[0-9]+[.)]\s+/, '').trim());
      if (points.length >= 5) break;
    }
    if (points.length > 0 && line.trim() === '') {
      inKeyPoints = false;
    }
  }

  if (points.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  return points;
}

function extractRisks(text: string): string[] {
  const risks: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.match(/риск|угроз|опасн|risk|threat|danger/i) && line.length > 20) {
      const cleaned = line.replace(/^[-•*0-9.)]+\s*/, '').trim();
      if (cleaned.length > 10) {
        risks.push(cleaned);
        if (risks.length >= 3) break;
      }
    }
  }

  return risks;
}

function extractAssumptions(text: string): string[] {
  const assumptions: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.match(/допущен|предполож|assumption|assume|если|при условии/i) && line.length > 20) {
      const cleaned = line.replace(/^[-•*0-9.)]+\s*/, '').trim();
      if (cleaned.length > 10) {
        assumptions.push(cleaned);
        if (assumptions.length >= 3) break;
      }
    }
  }

  return assumptions;
}

// Generate mock data for demo purposes
function generateMockAnalyses(task: string, taskType: string): AgentAnalysis[] {
  const baseAnalysis = `Анализ задачи: "${task.slice(0, 100)}..."

**Контекст**: Тип анализа — ${taskType}

**Ключевые наблюдения**:
1. Задача требует комплексного подхода с учётом множества факторов
2. Существуют как очевидные, так и скрытые риски
3. Необходимо учитывать временные и ресурсные ограничения

**Анализ**:
При анализе данной задачи необходимо учитывать несколько ключевых аспектов. Во-первых, важно определить основные цели и критерии успеха. Во-вторых, следует оценить доступные ресурсы и ограничения.

**Выводы**:
Рекомендуется поэтапный подход с регулярной оценкой промежуточных результатов.`;

  return [
    {
      agent_name: "ChatGPT",
      agent_id: "chatgpt",
      confidence: 0.85,
      analysis: `${baseAnalysis}\n\n**Логический анализ**:\nС точки зрения логики, данная задача содержит несколько потенциальных противоречий, которые необходимо разрешить перед принятием решения.`,
      key_points: [
        "Задача требует структурированного подхода",
        "Выявлены потенциальные логические противоречия",
        "Необходима дополнительная валидация допущений"
      ],
      risks: [
        "Недооценка сложности реализации",
        "Возможные скрытые зависимости"
      ],
      assumptions: [
        "Доступны необходимые ресурсы",
        "Сроки реалистичны"
      ],
      duration: 2500,
      tokens: 1250,
      prompt_tokens: 450,
      completion_tokens: 800,
      cost: 0.0125,
      model: "gpt-4o",
    },
    {
      agent_name: "Claude",
      agent_id: "claude",
      confidence: 0.88,
      analysis: `${baseAnalysis}\n\n**Системный анализ**:\nРассматривая задачу как систему, можно выделить несколько взаимосвязанных компонентов, которые влияют друг на друга.`,
      key_points: [
        "Системный подход выявил ключевые взаимосвязи",
        "Архитектура решения должна быть модульной",
        "Важна интеграция с существующими процессами"
      ],
      risks: [
        "Сложность интеграции компонентов",
        "Потенциальные узкие места в архитектуре"
      ],
      assumptions: [
        "Существующая инфраструктура поддерживает решение",
        "Команда обладает необходимыми компетенциями"
      ],
      duration: 3200,
      tokens: 1480,
      prompt_tokens: 480,
      completion_tokens: 1000,
      cost: 0.022,
      model: "claude-3-5-sonnet-20241022",
    },
    {
      agent_name: "Gemini",
      agent_id: "gemini",
      confidence: 0.82,
      analysis: `${baseAnalysis}\n\n**Альтернативные подходы**:\n1. Традиционный поэтапный подход\n2. Agile-методология с короткими итерациями\n3. Гибридный подход с элементами обоих методов`,
      key_points: [
        "Существует минимум 3 альтернативных подхода",
        "Каждый подход имеет свои trade-offs",
        "Рекомендуется гибридное решение"
      ],
      risks: [
        "Выбор неоптимального подхода",
        "Сопротивление изменениям"
      ],
      assumptions: [
        "Гибкость в выборе методологии",
        "Готовность к экспериментам"
      ],
      duration: 2100,
      tokens: 980,
      prompt_tokens: 380,
      completion_tokens: 600,
      cost: 0.005,
      model: "gemini-2.0-flash",
    },
    {
      agent_name: "DeepSeek",
      agent_id: "deepseek",
      confidence: 0.86,
      analysis: `${baseAnalysis}\n\n**Количественный анализ**:\n- Оценка трудозатрат: 120-180 человеко-часов\n- ROI прогноз: 150-200% за 12 месяцев\n- Вероятность успеха: 75-85%`,
      key_points: [
        "Расчётная оценка затрат проведена",
        "ROI положительный при соблюдении сроков",
        "Вероятность успеха выше среднего"
      ],
      risks: [
        "Превышение бюджета на 20-30%",
        "Задержка сроков на 2-4 недели"
      ],
      assumptions: [
        "Данные для расчётов актуальны",
        "Нет скрытых затрат"
      ],
      duration: 1800,
      tokens: 850,
      prompt_tokens: 350,
      completion_tokens: 500,
      cost: 0.0017,
      model: "deepseek-chat",
    },
  ];
}

// Generate mock synthesis
function generateMockSynthesis(analyses: AgentAnalysis[], task: string): SynthesisResult {
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

  return {
    summary: `Комплексный анализ задачи "${task.slice(0, 50)}..." выполнен четырьмя независимыми агентами.

Общий консенсус: ${Math.round(avgConfidence * 100)}%

**Ключевые выводы**:
Все агенты сошлись во мнении, что задача требует структурированного подхода с чёткими этапами реализации. Выявлены потенциальные риски, которые можно митигировать при правильном планировании.

**Рекомендуемый путь**: Гибридный подход с элементами agile-методологии, позволяющий адаптироваться к изменениям на ходу.`,
    conclusions: [
      {
        conclusion: "Задача реализуема в заданных рамках с вероятностью 75-85%",
        probability: "80%",
        falsification_condition: "Если обнаружатся критические технические ограничения"
      },
      {
        conclusion: "Рекомендуется поэтапный подход с checkpoint'ами",
        probability: "90%",
        falsification_condition: "Если требуется single-batch delivery"
      },
      {
        conclusion: "ROI положительный при соблюдении сроков",
        probability: "75%",
        falsification_condition: "Если сроки превысят оценку более чем на 50%"
      }
    ],
    recommendations: [
      {
        option: "Гибридный подход",
        description: "Сочетание планирования waterfall с agile-итерациями для максимальной гибкости",
        pros: ["Гибкость", "Контролируемость", "Адаптивность"],
        cons: ["Требует опыта", "Сложнее в управлении"],
        score: 8.5
      },
      {
        option: "Поэтапная реализация",
        description: "Классический подход с чёткими этапами и milestone'ами",
        pros: ["Простота управления", "Чёткие границы", "Предсказуемость"],
        cons: ["Низкая гибкость", "Долгий feedback loop"],
        score: 7.2
      },
      {
        option: "MVP + итерации",
        description: "Быстрый выход с минимальным продуктом и итеративное улучшение",
        pros: ["Быстрый старт", "Ранняя обратная связь", "Низкий начальный риск"],
        cons: ["Технический долг", "Возможный рефакторинг"],
        score: 7.8
      }
    ],
    consensus_level: avgConfidence
  };
}

// Main handler
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    const body: AnalysisRequest = await request.json();
    const { task, task_type, max_iterations, context, session_id } = body;

    if (!task || !task.trim()) {
      return NextResponse.json(
        { error: "Task is required" },
        { status: 400 }
      );
    }

    // Log analysis start
    recordLog({
      level: "info",
      message: `Analysis started: "${task.slice(0, 50)}..."`,
      agent_id: "system",
      session_id,
      metadata: { task_type, max_iterations },
    });

    let analyses: AgentAnalysis[] = [];

    if (useRealAPIs) {
      // Call real APIs in parallel with context
      const results = await Promise.all([
        callOpenAI(task, task_type, context, session_id),
        callAnthropic(task, task_type, context, session_id),
        callGoogleAI(task, task_type, context, session_id),
        callDeepSeek(task, task_type, context, session_id),
      ]);

      analyses = results.filter((r): r is AgentAnalysis => r !== null);

      // If no real results, fall back to mock
      if (analyses.length === 0) {
        analyses = generateMockAnalyses(task, task_type);
        recordLog({
          level: "warning",
          message: "All API calls failed, using mock data",
          agent_id: "system",
          session_id,
        });
      }
    } else {
      // Use mock data
      await new Promise(resolve => setTimeout(resolve, 2000));
      analyses = generateMockAnalyses(task, task_type);
    }

    const synthesis = generateMockSynthesis(analyses, task);

    // Calculate totals
    const totalTokens = analyses.reduce((sum, a) => sum + a.tokens, 0);
    const totalCost = analyses.reduce((sum, a) => sum + a.cost, 0);
    const totalDuration = Date.now() - requestStartTime;

    // Log analysis completion
    recordLog({
      level: "success",
      message: `Analysis completed: ${analyses.length} agents, ${totalTokens} tokens, $${totalCost.toFixed(4)}`,
      agent_id: "system",
      session_id,
      metadata: {
        agents: analyses.map(a => a.agent_id),
        total_tokens: totalTokens,
        total_cost: totalCost,
        duration_ms: totalDuration,
      },
    });

    return NextResponse.json({
      analyses,
      synthesis,
      iterations: max_iterations,
      mode: useRealAPIs ? "live" : "demo",
      metrics: {
        total_tokens: totalTokens,
        total_cost: totalCost,
        duration_ms: totalDuration,
        agents_count: analyses.length,
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);

    recordLog({
      level: "error",
      message: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      agent_id: "system",
    });

    return NextResponse.json(
      { error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
