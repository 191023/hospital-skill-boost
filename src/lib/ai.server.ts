import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AiProvider = "gemini" | "openai" | "lovable";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model?: string | undefined;
  enabled?: boolean | undefined;
};

const RUN = "X-Lovable-AIG-Run-ID";

/**
 * Resolves AI configuration by checking:
 * 1. Database `system_settings` table (key: `ai_config`)
 * 2. Environment variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `LOVABLE_API_KEY`)
 */
export async function resolveAiConfig(sbClient?: any): Promise<AiConfig> {
  // 1. Try reading from database system_settings
  try {
    const sb = sbClient || createClient<Database>(
      process.env["SUPABASE_URL"] || "",
      process.env["SUPABASE_PUBLISHABLE_KEY"] || "",
      { auth: { persistSession: false } }
    );
    const { data } = await sb
      .from("system_settings")
      .select("value")
      .eq("key", "ai_config")
      .maybeSingle();

    const val = data?.value as Record<string, any> | undefined;
    if (val && typeof val["api_key"] === "string" && val["api_key"].trim().length > 0) {
      return {
        provider: (val["provider"] as AiProvider) || "gemini",
        apiKey: val["api_key"].trim(),
        model: val["model"] || (val["provider"] === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash"),
        enabled: val["enabled"] ?? true,
      };
    }
  } catch (err) {
    console.warn("Could not read ai_config from database, falling back to env:", err);
  }

  // 2. Fallback to environment variables
  const geminiEnv = process.env["GEMINI_API_KEY"]?.trim();
  if (geminiEnv) {
    return {
      provider: "gemini",
      apiKey: geminiEnv,
      model: process.env["GEMINI_MODEL"]?.trim() || "gemini-2.5-flash",
      enabled: true,
    };
  }

  const openaiEnv = process.env["OPENAI_API_KEY"]?.trim();
  if (openaiEnv) {
    return {
      provider: "openai",
      apiKey: openaiEnv,
      model: process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini",
      enabled: true,
    };
  }

  const lovableEnv = process.env["LOVABLE_API_KEY"]?.trim();
  if (lovableEnv) {
    return {
      provider: "lovable",
      apiKey: lovableEnv,
      model: "openai/gpt-4o-mini",
      enabled: true,
    };
  }

  throw new Error(
    "ยังไม่ได้ตั้งค่า AI Key ในระบบ กรุณาเข้าสู่เมนู 'ศูนย์การตั้งค่าระบบ' (Settings) -> แท็บ 'ระบบปัญญาประดิษฐ์' เพื่อระบุ Google Gemini API Key (ใช้งานฟรี) หรือใส่ GEMINI_API_KEY ใน .env"
  );
}

function sanitizeGeminiModel(m?: string): string {
  if (!m) return "gemini-2.5-flash";
  const trimmed = m.trim().toLowerCase();
  if (trimmed === "gemini-1.5-pro" || trimmed === "gemini-2.0-pro") {
    return "gemini-2.5-pro";
  }
  // Map non-existent or retired 1.5 aliases to the official Google Gemini 2.5 Flash model
  if (
    trimmed === "gemini-flash" ||
    trimmed === "gemini-1.5-flash" ||
    trimmed === "gemini-3.5-flash" ||
    trimmed === "gemini-3.8-flash"
  ) {
    return "gemini-2.5-flash";
  }
  if (trimmed === "gemini-3.5-flash-lite") {
    return "gemini-2.5-flash-lite";
  }
  return trimmed.startsWith("gemini-") ? trimmed : "gemini-2.5-flash";
}

/**
 * Executes a text generation call through the configured AI provider.
 * Supports Google Gemini (Free Tier), OpenAI, and Lovable Gateway.
 */
export async function gatewayText(
  system: string,
  prompt: string,
  overrideConfig?: Partial<AiConfig>,
  sbClient?: any
): Promise<string> {
  const activeConfig = overrideConfig?.apiKey
    ? {
        provider: overrideConfig.provider || "gemini",
        apiKey: overrideConfig.apiKey,
        model: overrideConfig.model || (overrideConfig.provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash"),
      }
    : await resolveAiConfig(sbClient);

  const { provider, apiKey, model } = activeConfig;

  // 1. Google Gemini (Free Tier / OpenAI compatible chat endpoint)
  if (provider === "gemini") {
    const openaiCompat = createOpenAI({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey,
    });

    const targetModel = sanitizeGeminiModel(model);
    try {
      const result = await generateText({
        model: openaiCompat.chat(targetModel),
        system,
        prompt,
        maxRetries: 0,
      });
      return result.text;
    } catch (err: any) {
      const errStr = String(err?.message || "") + " " + String(err?.responseBody || "");
      const isUnavailableOrNotFound =
        err?.statusCode === 503 ||
        err?.statusCode === 404 ||
        errStr.includes("503") ||
        errStr.includes("Service Unavailable") ||
        errStr.includes("high demand") ||
        errStr.includes("not found");

      // Auto-fallback retry with official Google Gemini models on 503 overload or 404
      if (isUnavailableOrNotFound) {
        const fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"].filter((fb) => fb !== targetModel);
        for (const fbModel of fallbacks) {
          try {
            const fallbackResult = await generateText({
              model: openaiCompat.chat(fbModel),
              system,
              prompt,
              maxRetries: 0,
            });
            return fallbackResult.text;
          } catch {
            // try next fallback
          }
        }
      }

      const body = String(err?.responseBody || err?.message || "");
      if (body.toLowerCase().includes("leaked")) {
        throw new Error(
          "Google ได้ระงับ API Key นี้แล้ว เนื่องจากตรวจพบว่าคีย์รั่วไหลสู่สาธารณะ (Leaked API Key) — กรุณาไปที่เมนู 'ศูนย์การตั้งค่าระบบ' -> แท็บ 'ระบบปัญญาประดิษฐ์' แล้วคลิกสร้าง API Key ชุดใหม่จาก Google AI Studio มาแทนที่ครับ"
        );
      }
      if (
        body.includes("Please pass a valid API key") ||
        body.includes("API_KEY_INVALID") ||
        err?.statusCode === 400
      ) {
        throw new Error("Google Gemini API Key ไม่ถูกต้อง (กรุณาตรวจสอบว่าคัดลอกคีย์มาครบถ้วนและสร้างจาก Google AI Studio)");
      }
      if (err?.statusCode === 403 || err?.statusCode === 401) {
        throw new Error("Google Gemini API Key ถูกระงับหรือไม่มีสิทธิ์ใช้งาน กรุณาสร้าง API Key ใหม่ใน Google AI Studio");
      }
      if (err?.statusCode === 404) {
        throw new Error(`ไม่พบโมเดล ${targetModel} ใน Google Gemini`);
      }
      if (err?.statusCode === 429) {
        throw new Error("เกินขีดจำกัดการใช้งานฟรีชั่วคราว (15 ครั้ง/นาที) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
      }
      if (err?.statusCode === 503 || errStr.includes("high demand") || errStr.includes("Service Unavailable")) {
        throw new Error("โมเดล Google Gemini มีผู้ใช้งานหนาแน่นชั่วคราว (High Demand) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
      }
      throw err;
    }
  }

  // 2. OpenAI Standard API
  if (provider === "openai") {
    const openai = createOpenAI({
      apiKey,
    });
    const targetModel = model || "gpt-4o-mini";
    const result = await generateText({
      model: openai.chat(targetModel),
      system,
      prompt,
      maxRetries: 1,
    });
    return result.text;
  }

  // 3. Lovable AI Gateway
  if (provider === "lovable") {
    let runId: string | undefined;
    const lovableProvider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        if (runId) headers.set(RUN, runId);
        const res = await fetch(input, { ...init, headers });
        runId ??= res.headers.get(RUN) ?? undefined;
        if (res.status === 402) throw new Error("เครดิต AI ไม่เพียงพอ กรุณาเติมเครดิตของพื้นที่ทำงาน");
        if (res.status === 429) throw new Error("มีการใช้งาน AI มากเกินไป กรุณาลองใหม่ภายหลัง");
        if (res.status === 403) throw new Error("ไม่ได้รับอนุญาตให้ใช้ AI ในขณะนี้");
        return res;
      },
    });

    const targetModel = (model || "openai/gpt-4o-mini") as any;
    const result = streamText({
      model: lovableProvider.responses(targetModel),
      system,
      prompt,
      maxRetries: 0,
    });
    return await result.text;
  }

  throw new Error(`ไม่รองรับ AI Provider: ${provider}`);
}
