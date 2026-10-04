import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN = "X-Lovable-AIG-Run-ID";

export async function gatewayText(system: string, prompt: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า AI");
  let runId: string | undefined;
  const provider = createOpenAI({
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
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    prompt,
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}
