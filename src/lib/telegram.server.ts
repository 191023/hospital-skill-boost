import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TelegramChannelTarget = "announcement" | "leaders" | "admin_hr" | "direct";

export type TelegramEventKey =
  | "new_course_published"
  | "session_reminder_24h"
  | "session_reminder_3h"
  | "posttest_reminder"
  | "certificate_issued"
  | "dept_allocation_reminder"
  | "session_checkin_summary";

export type TelegramEventConfig = {
  enabled: boolean;
  target: TelegramChannelTarget;
};

export type TelegramConfig = {
  enabled: boolean;
  bot_token: string;
  bot_username?: string;
  default_chat_id?: string;
  channels: {
    announcement?: string;
    leaders?: string;
    admin_hr?: string;
  };
  events: Record<string, TelegramEventConfig>;
};

export type TelegramInlineButton = {
  text: string;
  url?: string;
  callback_data?: string;
};

/**
 * Low-level Telegram Bot API request wrapper
 */
export async function callTelegramApi(token: string, method: string, payload: Record<string, any> = {}) {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error("Telegram Bot Token is required");
  }

  const url = `https://api.telegram.org/bot${cleanToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { ok: boolean; description?: string; error_code?: number; result?: any };
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error (${data.error_code || res.status})`);
  }
  return data.result;
}

/**
 * Verify bot token and fetch bot identity
 */
export async function getTelegramBotInfo(token: string) {
  const info = await callTelegramApi(token, "getMe");
  return {
    id: info.id,
    isBot: info.is_bot,
    firstName: info.first_name,
    username: info.username as string | undefined,
  };
}

/**
 * Send an HTML-formatted message with optional inline keyboard buttons
 */
export async function sendTelegramMessage(params: {
  token: string;
  chatId: string;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  buttons?: TelegramInlineButton[][];
  disableWebPagePreview?: boolean;
}) {
  const payload: Record<string, any> = {
    chat_id: params.chatId.trim(),
    text: params.text,
    parse_mode: params.parseMode || "HTML",
    disable_web_page_preview: params.disableWebPagePreview ?? false,
  };

  if (params.buttons && params.buttons.length > 0) {
    payload.reply_markup = {
      inline_keyboard: params.buttons,
    };
  }

  const result = await callTelegramApi(params.token, "sendMessage", payload);
  return {
    messageId: result.message_id as number,
  };
}

/**
 * Resolve Telegram configuration from system_settings table
 */
export async function resolveTelegramConfig(sbClient?: any): Promise<TelegramConfig | null> {
  try {
    const sb =
      sbClient ||
      createClient<Database>(
        process.env["SUPABASE_URL"] || "",
        process.env["SUPABASE_PUBLISHABLE_KEY"] || "",
        { auth: { persistSession: false } }
      );

    const { data } = await sb
      .from("system_settings")
      .select("value")
      .eq("key", "telegram_config")
      .maybeSingle();

    if (!data || !data.value || typeof data.value !== "object") {
      return null;
    }

    const cfg = data.value as Record<string, any>;
    return {
      enabled: Boolean(cfg["enabled"]),
      bot_token: String(cfg["bot_token"] || "").trim(),
      bot_username: cfg["bot_username"] ? String(cfg["bot_username"]).trim() : undefined,
      default_chat_id: cfg["default_chat_id"] ? String(cfg["default_chat_id"]).trim() : undefined,
      channels: {
        announcement: cfg["channels"]?.announcement ? String(cfg["channels"].announcement).trim() : undefined,
        leaders: cfg["channels"]?.leaders ? String(cfg["channels"].leaders).trim() : undefined,
        admin_hr: cfg["channels"]?.admin_hr ? String(cfg["channels"].admin_hr).trim() : undefined,
      },
      events: cfg["events"] || {},
    };
  } catch (err) {
    console.warn("Could not read telegram_config from database:", err);
    return null;
  }
}

/**
 * Central Dispatcher: Validates settings, routes to target chat, sends message, and logs audit
 */
export async function dispatchTelegramEvent(
  sbClient: any,
  event: {
    eventType: TelegramEventKey | string;
    title: string;
    body: string;
    targetChatId?: string;
    userId?: string;
    buttons?: TelegramInlineButton[][];
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = await resolveTelegramConfig(sbClient);

  if (!config || !config.enabled) {
    return { success: false, error: "ระบบแจ้งเตือน Telegram ปิดใช้งานอยู่" };
  }

  if (!config.bot_token) {
    return { success: false, error: "ยังไม่ได้ระบุ Telegram Bot Token" };
  }

  // Check event enabled
  const eventConfig = config.events?.[event.eventType];
  if (eventConfig && !eventConfig.enabled) {
    return { success: false, error: `กิจกรรม ${event.eventType} ถูกปิดการแจ้งเตือนไว้` };
  }

  // Resolve Target Chat ID
  let targetChatId = event.targetChatId?.trim();
  if (!targetChatId) {
    const targetType = eventConfig?.target || "announcement";
    if (targetType === "announcement") targetChatId = config.channels.announcement;
    else if (targetType === "leaders") targetChatId = config.channels.leaders;
    else if (targetType === "admin_hr") targetChatId = config.channels.admin_hr;

    targetChatId = targetChatId || config.default_chat_id;
  }

  if (!targetChatId) {
    return { success: false, error: `ไม่พบ Chat ID ปลายทางสำหรับกิจกรรม ${event.eventType}` };
  }

  const fullText = `<b>${event.title}</b>\n\n${event.body}`;

  try {
    const res = await sendTelegramMessage({
      token: config.bot_token,
      chatId: targetChatId,
      text: fullText,
      buttons: event.buttons,
    });

    // Audit log
    await sbClient.from("notification_logs").insert({
      channel: "telegram",
      event_type: event.eventType,
      recipient_chat_id: targetChatId,
      user_id: event.userId || null,
      message_title: event.title,
      message_body: event.body,
      status: "sent",
      metadata: event.metadata || {},
    });

    return { success: true, messageId: res.messageId };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    // Audit failure
    await sbClient.from("notification_logs").insert({
      channel: "telegram",
      event_type: event.eventType,
      recipient_chat_id: targetChatId,
      user_id: event.userId || null,
      message_title: event.title,
      message_body: event.body,
      status: "failed",
      error_message: errMsg,
      metadata: event.metadata || {},
    });

    return { success: false, error: errMsg };
  }
}
