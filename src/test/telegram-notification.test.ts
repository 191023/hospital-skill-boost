import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  callTelegramApi,
  sendTelegramMessage,
  getTelegramBotInfo,
  dispatchTelegramEvent,
  resolveTelegramConfig,
  type TelegramConfig,
} from "@/lib/telegram.server";

describe("Telegram Notification Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws error when Bot Token is empty in callTelegramApi", async () => {
    await expect(callTelegramApi("", "getMe")).rejects.toThrow("Telegram Bot Token is required");
  });

  it("calls Telegram getMe endpoint and formats bot info", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: {
          id: 12345678,
          is_bot: true,
          first_name: "OVB Training Bot",
          username: "ovb_training_bot",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const info = await getTelegramBotInfo("dummy-token");
    expect(info.username).toBe("ovb_training_bot");
    expect(info.firstName).toBe("OVB Training Bot");
    expect(info.isBot).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botdummy-token/getMe",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends message with HTML formatting and inline keyboard buttons", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: { message_id: 9988 },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await sendTelegramMessage({
      token: "valid-token",
      chatId: "-10012345678",
      text: "<b>หัวข้อ</b>\nข้อความทดสอบ",
      buttons: [
        [
          { text: "กดที่นี่", url: "https://example.com" },
        ],
      ],
    });

    expect(res.messageId).toBe(9988);
    const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(bodySent.chat_id).toBe("-10012345678");
    expect(bodySent.parse_mode).toBe("HTML");
    expect(bodySent.reply_markup.inline_keyboard[0][0].text).toBe("กดที่นี่");
  });

  it("dispatchTelegramEvent skips when master switch is disabled", async () => {
    const mockSb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                value: {
                  enabled: false,
                  bot_token: "token",
                },
              },
            }),
          }),
        }),
      }),
    };

    const res = await dispatchTelegramEvent(mockSb, {
      eventType: "new_course_published",
      title: "ประกาศวิชาใหม่",
      body: "รายละเอียด",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("ปิดใช้งานอยู่");
  });

  it("dispatchTelegramEvent routes to correct channel and logs audit", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "system_settings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    value: {
                      enabled: true,
                      bot_token: "bot-token-123",
                      channels: {
                        announcement: "-10099999",
                      },
                      events: {
                        new_course_published: { enabled: true, target: "announcement" },
                      },
                    },
                  },
                }),
              }),
            }),
          };
        }
        if (table === "notification_logs") {
          return { insert: mockInsert };
        }
        return {};
      }),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: { message_id: 101 },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchTelegramEvent(mockSb, {
      eventType: "new_course_published",
      title: "เปิดหลักสูตรใหม่",
      body: "รายละเอียดหลักสูตร",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe(101);

    // Verify sent to announcement channel
    const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(bodySent.chat_id).toBe("-10099999");

    // Verify audit log inserted
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        event_type: "new_course_published",
        recipient_chat_id: "-10099999",
        status: "sent",
      })
    );
  });
});

