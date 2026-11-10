import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getTelegramBotInfo,
  sendTelegramMessage,
  dispatchTelegramEvent,
  type TelegramConfig,
} from "./telegram.server";

/**
 * 1. Test Telegram Bot Connection (calls Telegram getMe)
 */
export const testTelegramBotConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        bot_token: z.string().min(1, "กรุณาระบุ Telegram Bot Token"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isStaff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("เฉพาะเจ้าหน้าที่และผู้ดูแลระบบเท่านั้น");

    const botInfo = await getTelegramBotInfo(data.bot_token);
    return {
      success: true,
      bot: botInfo,
    };
  });

/**
 * 2. Send Test Notification to a specific chat / group / channel
 */
export const sendTestTelegramMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        bot_token: z.string().min(1, "กรุณาระบุ Telegram Bot Token"),
        chat_id: z.string().min(1, "กรุณาระบุ Chat ID"),
        channel_name: z.string().default("ทดสอบระบบ"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น");

    const timeStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const text = `🏥 <b>ทดสอบระบบแจ้งเตือน Telegram — Hospital Skill Boost</b>\n\nการเชื่อมต่อระหว่างระบบและห้องแชท/กลุ่ม <code>${data.channel_name}</code> ทำงานถูกต้องสมบูรณ์ พร้อมรับข้อมูลกิจกรรมและประกาศสำคัญเรียบร้อยแล้ว\n\n⏱️ <i>เวลาที่ส่ง: ${timeStr}</i>`;

    const appUrl = process.env["SITE_URL"] || "https://fmstraining.ovbhospital.com";

    const res = await sendTelegramMessage({
      token: data.bot_token,
      chatId: data.chat_id,
      text,
      buttons: [
        [
          {
            text: "🌐 เข้าสู่ระบบ Hospital Skill Boost",
            url: appUrl,
          },
        ],
      ],
    });

    // Audit log
    await sb.from("notification_logs").insert({
      channel: "telegram",
      event_type: "test_message",
      recipient_chat_id: data.chat_id,
      user_id: context.userId,
      message_title: "ทดสอบระบบแจ้งเตือน Telegram",
      message_body: `ทดสอบส่งไปยัง ${data.channel_name}`,
      status: "sent",
      metadata: { channel_name: data.channel_name, message_id: res.messageId },
    });

    return {
      success: true,
      messageId: res.messageId,
    };
  });

/**
 * 3. Save Telegram Settings
 */
export const saveTelegramConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        config: z.object({
          enabled: z.boolean(),
          bot_token: z.string(),
          bot_username: z.string().optional(),
          default_chat_id: z.string().optional(),
          channels: z.object({
            announcement: z.string().optional(),
            leaders: z.string().optional(),
            admin_hr: z.string().optional(),
          }),
          events: z.record(
            z.object({
              enabled: z.boolean(),
              target: z.enum(["announcement", "leaders", "admin_hr", "direct"]),
            })
          ),
        }),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น");

    const { error } = await sb.from("system_settings").upsert({
      key: "telegram_config",
      value: data.config,
    });

    if (error) throw new Error(error.message);

    return { success: true };
  });

/**
 * 4. Get recent notification logs for audit
 */
export const getTelegramNotificationLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ limit: z.number().default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น");

    const { data: logs, error } = await sb
      .from("notification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);
    return { logs: logs || [] };
  });

/**
 * 5. Dispatch Telegram Course Announcement
 */
export const notifyCoursePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        courseId: z.string().uuid(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: course, error } = await sb
      .from("courses")
      .select("id, title, description, category, hours")
      .eq("id", data.courseId)
      .maybeSingle();

    if (error || !course) throw new Error("ไม่พบหลักสูตรที่ระบุ");

    const appUrl = process.env["SITE_URL"] || "https://fmstraining.ovbhospital.com";
    const courseUrl = `${appUrl}/courses/${course.id}`;

    const title = `📢 เปิดหลักสูตรอบรมใหม่: ${course.title}`;
    const body = `📚 <b>หมวดหมู่:</b> ${course.category || "ทั่วไป"}\n⏱️ <b>ระยะเวลา:</b> ${course.hours || 0} ชั่วโมง\n\n${course.description ? course.description.slice(0, 150) + "..." : "เปิดให้บุคลากรเข้าศึกษาและลงทะเบียนแล้ว"}`;

    const result = await dispatchTelegramEvent(sb, {
      eventType: "new_course_published",
      title,
      body,
      metadata: { course_id: course.id },
      buttons: [
        [
          {
            text: "📖 ดูรายละเอียดและเริ่มเรียน",
            url: courseUrl,
          },
        ],
      ],
    });

    return result;
  });

