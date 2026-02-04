// Pricing per 1K tokens (approximate, as of 2024)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },

  // Anthropic
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },

  // Google
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-pro": { input: 0.0005, output: 0.0015 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },

  // DeepSeek
  "deepseek-chat": { input: 0.00014, output: 0.00028 },
  "deepseek-coder": { input: 0.00014, output: 0.00028 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
  const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  return Math.round(cost * 1000000) / 1000000; // Round to 6 decimal places
}

export interface MetricData {
  user_id?: string;
  session_id?: string;
  agent_id: string;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  status: "success" | "error" | "timeout";
  error_message?: string;
}

export interface LogData {
  user_id?: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  agent_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}

// Record metric to API (fire and forget)
export async function recordMetric(data: MetricData): Promise<void> {
  try {
    fetch("/api/studio/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {
      // Ignore errors - metrics are best effort
    });
  } catch {
    // Ignore errors
  }
}

// Record log to API (fire and forget)
export async function recordLog(data: LogData): Promise<void> {
  try {
    fetch("/api/studio/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {
      // Ignore errors - logs are best effort
    });
  } catch {
    // Ignore errors
  }
}

// Server-side versions that use absolute URLs
export async function recordMetricServer(
  baseUrl: string,
  data: MetricData
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/studio/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error("Failed to record metric:", error);
  }
}

export async function recordLogServer(
  baseUrl: string,
  data: LogData
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/studio/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error("Failed to record log:", error);
  }
}
