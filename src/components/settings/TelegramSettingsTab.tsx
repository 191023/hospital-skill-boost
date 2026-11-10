import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Bot,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Bell,
  GraduationCap,
  Calendar,
  Users,
  FileCheck,
  ExternalLink,
  History,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  testTelegramBotConnection,
  sendTestTelegramMessage,
  getTelegramNotificationLogs,
} from "@/lib/telegram.functions";
import type { TelegramConfig, TelegramEventKey, TelegramChannelTarget } from "@/lib/telegram.server";

interface TelegramSettingsTabProps {
  initialConfig?: Partial<TelegramConfig>;
  onSave: (config: TelegramConfig) => Promise<void>;
  isSaving: boolean;
}

const DEFAULT_EVENTS: Record<TelegramEventKey, { title: string; desc: string; defaultTarget: TelegramChannelTarget; icon: any }> = {
  new_course_published: {
    title: "📢 เปิดหลักสูตรอบรมใหม่",
    desc: "แจ้งเตือนทันทีเมื่อ Admin เผยแพร่หลักสูตรอบรมใหม่ลงระบบ",
    defaultTarget: "announcement",
    icon: GraduationCap,
  },
  session_reminder_24h: {
    title: "⏰ แจ้งเตือนก่อนเริ่มอบรม 24 ชม.",
    desc: "เตือนบุคลากรที่มีชื่อในรอบอบรม On-site ล่วงหน้า 1 วัน พร้อมระบุห้องและเวลา",
    defaultTarget: "direct",
    icon: Calendar,
  },
  session_reminder_3h: {
    title: "⏳ แจ้งเตือนก่อนเริ่มอบรม 3 ชม.",
    desc: "เตือนความพร้อมก่อนเริ่มคลาสเรียน On-site ในวันอบรมจริง",
    defaultTarget: "direct",
    icon: Calendar,
  },
  posttest_reminder: {
    title: "✍️ เตือนค้างทำแบบทดสอบหลังเรียน",
    desc: "เตือนบุคลากรที่เช็คชื่อเข้าเรียนแล้ว แต่ยังค้างทำ Post-test เกิน 48 ชม.",
    defaultTarget: "direct",
    icon: FileCheck,
  },
  certificate_issued: {
    title: "🎓 แจ้งเมื่อได้รับใบประกาศนียบัตร",
    desc: "ส่งข้อความแสดงความยินดีพร้อมแนบปุ่มเปิดดู Certificate เมื่อผ่านเกณฑ์",
    defaultTarget: "direct",
    icon: GraduationCap,
  },
  dept_allocation_reminder: {
    title: "👥 เตือนหัวหน้างาน: สมาชิกยังไม่จัดรอบ",
    desc: "เตือนหัวหน้าฝ่าย/แผนกเมื่อใกล้ปิดรับแต่ยังมีลูกทีมตกค้างไม่ได้จัดรอบ",
    defaultTarget: "leaders",
    icon: Users,
  },
  session_checkin_summary: {
    title: "📊 สรุปยอดเช็คชื่อเข้าห้องอบรม",
    desc: "สรุปจำนวนคนมาเรียน/คนขาดเข้ากลุ่มวิทยากรและ HR หลังเริ่มคลาส 15 นาที",
    defaultTarget: "admin_hr",
    icon: ShieldCheck,
  },
};

export function TelegramSettingsTab({ initialConfig, onSave, isSaving }: TelegramSettingsTabProps) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [botToken, setBotToken] = useState(initialConfig?.bot_token ?? "");
  const [botUsername, setBotUsername] = useState(initialConfig?.bot_username ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [botVerified, setBotVerified] = useState(!!initialConfig?.bot_username);

  // Channels
  const [channels, setChannels] = useState({
    announcement: initialConfig?.channels?.announcement ?? "",
    leaders: initialConfig?.channels?.leaders ?? "",
    admin_hr: initialConfig?.channels?.admin_hr ?? "",
  });

  // Events configuration
  const [events, setEvents] = useState<Record<string, { enabled: boolean; target: TelegramChannelTarget }>>(() => {
    const evts: Record<string, { enabled: boolean; target: TelegramChannelTarget }> = {};
    (Object.keys(DEFAULT_EVENTS) as TelegramEventKey[]).forEach((k) => {
      evts[k] = {
        enabled: initialConfig?.events?.[k]?.enabled ?? true,
        target: initialConfig?.events?.[k]?.target ?? DEFAULT_EVENTS[k].defaultTarget,
      };
    });
    return evts;
  });

  // Sending test states
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  // Logs state
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Server functions
  const testBotFn = useServerFn(testTelegramBotConnection);
  const sendTestFn = useServerFn(sendTestTelegramMessage);
  const getLogsFn = useServerFn(getTelegramNotificationLogs);

  useEffect(() => {
    if (initialConfig) {
      setEnabled(initialConfig.enabled ?? false);
      setBotToken(initialConfig.bot_token ?? "");
      setBotUsername(initialConfig.bot_username ?? "");
      setChannels({
        announcement: initialConfig.channels?.announcement ?? "",
        leaders: initialConfig.channels?.leaders ?? "",
        admin_hr: initialConfig.channels?.admin_hr ?? "",
      });
      if (initialConfig.events) {
        setEvents((prev) => ({
          ...prev,
          ...initialConfig.events,
        }));
      }
      setBotVerified(!!initialConfig.bot_username);
    }
  }, [initialConfig]);

  // Handler: Test Bot Connection (getMe)
  async function handleTestBot() {
    if (!botToken.trim()) {
      toast.error("กรุณาระบุ Telegram Bot Token ก่อนทดสอบ");
      return;
    }

    setTestingBot(true);
    try {
      const res = await testBotFn({ data: { bot_token: botToken.trim() } });
      if (res.success && res.bot) {
        setBotVerified(true);
        if (res.bot.username) {
          setBotUsername(res.bot.username);
        }
        toast.success(`เชื่อมต่อบอทสำเร็จ! บอทชื่อ: ${res.bot.firstName || ""} (@${res.bot.username || "บอท"})`);
      }
    } catch (err: any) {
      setBotVerified(false);
      toast.error(`เชื่อมต่อบอทไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setTestingBot(false);
    }
  }

  // Handler: Send Test Notification to a specific channel
  async function handleSendTest(channelKey: "announcement" | "leaders" | "admin_hr", label: string) {
    const chatId = channels[channelKey]?.trim();
    if (!botToken.trim()) {
      toast.error("กรุณาระบุ Bot Token ก่อนทดสอบส่งข้อความ");
      return;
    }
    if (!chatId) {
      toast.error(`กรุณาระบุ Chat ID ของ ${label} ก่อนกดส่ง`);
      return;
    }

    setSendingTest(channelKey);
    try {
      await sendTestFn({
        data: {
          bot_token: botToken.trim(),
          chat_id: chatId,
          channel_name: label,
        },
      });
      toast.success(`ส่งข้อความทดสอบไปยัง ${label} สำเร็จแล้ว! ตรวจสอบที่ Telegram ได้ทันที ✈️`);
    } catch (err: any) {
      toast.error(`ส่งข้อความไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setSendingTest(null);
    }
  }

  // Handler: Load Notification Logs
  async function handleLoadLogs() {
    setLoadingLogs(true);
    try {
      const res = await getLogsFn({ data: { limit: 30 } });
      setLogs(res.logs || []);
      setShowLogs(true);
    } catch (err: any) {
      toast.error(`โหลดประวัติไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setLoadingLogs(false);
    }
  }

  // Handler: Save
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: TelegramConfig = {
      enabled,
      bot_token: botToken.trim(),
      bot_username: botUsername.trim(),
      channels: {
        announcement: channels.announcement.trim(),
        leaders: channels.leaders.trim(),
        admin_hr: channels.admin_hr.trim(),
      },
      events,
    };
    await onSave(config);
  }

  return (
    <div className="glass space-y-8 rounded-3xl p-6 shadow-sm sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-500">
              ✈️
            </span>
            <span>ระบบแจ้งเตือนผ่าน Telegram (Telegram Notification Bot)</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            แจ้งเตือนกิจกรรมการอบรม, รอบเรียน On-site, ผลประเมิน และใบประกาศนียบัตรแบบเรียลไทม์
          </p>
        </div>

        {/* Master Switch Pill */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 px-4 py-2">
          <span className="text-xs font-semibold text-foreground">สถานะระบบ:</span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']"></div>
          </label>
          <span
            className={`text-xs font-bold ${
              enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {enabled ? "เปิดใช้งาน (Active)" : "ปิดการส่ง (Disabled)"}
          </span>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-8">
        {/* SECTION 1: Telegram Bot Credentials */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Bot className="size-4 text-sky-500" />
              <span>1. ข้อมูลการเชื่อมต่อบอท (Telegram Bot Credentials)</span>
            </h3>
            {botVerified && botUsername && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="size-3.5" />
                <span>@{botUsername} เชื่อมต่อแล้ว</span>
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Telegram Bot API Token <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? "text" : "password"}
                    placeholder="เช่น 7123456789:AAHxxxxxx_your_telegram_bot_token"
                    value={botToken}
                    onChange={(e) => {
                      setBotToken(e.target.value);
                      setBotVerified(false);
                    }}
                    className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 pr-10 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <Button
                  type="button"
                  onClick={handleTestBot}
                  disabled={testingBot || !botToken.trim()}
                  variant="outline"
                  className="rounded-xl border-sky-300/80 dark:border-sky-700 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 text-xs font-semibold"
                >
                  <RefreshCw className={`mr-1.5 size-3.5 ${testingBot ? "animate-spin" : ""}`} />
                  {testingBot ? "กำลังทดสอบ..." : "ทดสอบบอท"}
                </Button>
              </div>
            </div>

            {/* Bot Helper Callout */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">💡 วิธีสร้างและรับ Bot Token ฟรี (1 นาที):</span>
              <ol className="mt-1.5 list-decimal list-inside space-y-0.5">
                <li>เปิด Telegram ค้นหาบอท <strong>@BotFather</strong> แล้วกด Start</li>
                <li>พิมพ์คำสั่ง <code>/newbot</code> แล้วตั้งชื่อและ username บอทตามขั้นตอน</li>
                <li>คัดลอกข้อความ <code>Use this token to access the HTTP API: ...</code> นำมาวางในช่องด้านบน</li>
              </ol>
            </div>
          </div>
        </div>

        {/* SECTION 2: Target Channels & Group Chat IDs */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Send className="size-4 text-primary" />
            <span>2. ปลายทางกลุ่มและแชนเนล (Target Chat IDs)</span>
          </h3>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Announcement Channel */}
            <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <span>📢 ข่าวสารหลัก รพ.</span>
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Announcement
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ส่งประกาศเปิดหลักสูตรใหม่ และข่าวสารการพัฒนาศักยภาพทั่วไป
              </p>
              <input
                type="text"
                placeholder="เช่น -1002345678901"
                value={channels.announcement}
                onChange={(e) => setChannels({ ...channels, announcement: e.target.value })}
                className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button
                type="button"
                onClick={() => handleSendTest("announcement", "กลุ่มข่าวสารหลัก รพ.")}
                disabled={sendingTest === "announcement" || !channels.announcement.trim()}
                variant="outline"
                className="w-full rounded-xl text-xs"
              >
                {sendingTest === "announcement" ? "กำลังส่ง..." : "📨 ส่งข้อความทดสอบ"}
              </Button>
            </div>

            {/* Leaders Channel */}
            <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <span>👥 หัวหน้าฝ่าย / Incharges</span>
                </span>
                <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  Leaders
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                เตือนจัดสรรที่นั่งลูกทีม, สรุป % ผ่านเกณฑ์ความปลอดภัย HA
              </p>
              <input
                type="text"
                placeholder="เช่น -1002345678902"
                value={channels.leaders}
                onChange={(e) => setChannels({ ...channels, leaders: e.target.value })}
                className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button
                type="button"
                onClick={() => handleSendTest("leaders", "กลุ่มหัวหน้าฝ่าย / Incharges")}
                disabled={sendingTest === "leaders" || !channels.leaders.trim()}
                variant="outline"
                className="w-full rounded-xl text-xs"
              >
                {sendingTest === "leaders" ? "กำลังส่ง..." : "📨 ส่งข้อความทดสอบ"}
              </Button>
            </div>

            {/* Admin & HR Channel */}
            <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <span>🛡️ ผู้จัดอบรม / HR / Admin</span>
                </span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  HR & Admin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                สรุปยอดเช็คชื่อเข้าห้องเรียน, รายงานปัญหาการสแกน QR
              </p>
              <input
                type="text"
                placeholder="เช่น -1002345678903"
                value={channels.admin_hr}
                onChange={(e) => setChannels({ ...channels, admin_hr: e.target.value })}
                className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button
                type="button"
                onClick={() => handleSendTest("admin_hr", "กลุ่มผู้จัดอบรม / HR")}
                disabled={sendingTest === "admin_hr" || !channels.admin_hr.trim()}
                variant="outline"
                className="w-full rounded-xl text-xs"
              >
                {sendingTest === "admin_hr" ? "กำลังส่ง..." : "📨 ส่งข้อความทดสอบ"}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            * วิธีหา Chat ID ของกลุ่ม: ดึงบอทเข้ากลุ่ม แล้วส่งข้อความ 1 ข้อความ หรือใช้บอท <code>@RawDataBot</code> ใน Telegram (ID กลุ่มจะมีเครื่องหมายลบนำหน้า เช่น <code>-100xxxxxxxxx</code>)
          </p>
        </div>

        {/* SECTION 3: Event Triggers Matrix */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Bell className="size-4 text-amber-500" />
              <span>3. การตั้งค่าการแจ้งเตือนแยกตามกิจกรรม (Event Triggers Matrix)</span>
            </h3>
            <span className="text-xs text-muted-foreground">กำหนดการเปิด/ปิด และช่องทางปลายทางของแต่ละเหตุการณ์</span>
          </div>

          <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-card/60">
            {(Object.keys(DEFAULT_EVENTS) as TelegramEventKey[]).map((eventKey) => {
              const item = DEFAULT_EVENTS[eventKey];
              const Icon = item.icon;
              const currentEvent = events[eventKey] || { enabled: true, target: item.defaultTarget };

              return (
                <div key={eventKey} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-card/90 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Target Route Selector */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">ส่งเข้า:</span>
                      <select
                        value={currentEvent.target}
                        onChange={(e) =>
                          setEvents({
                            ...events,
                            [eventKey]: {
                              ...currentEvent,
                              target: e.target.value as TelegramChannelTarget,
                            },
                          })
                        }
                        className="rounded-lg border border-input bg-background/80 px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="announcement">📢 กลุ่มข่าวสารหลัก</option>
                        <option value="leaders">👥 กลุ่มหัวหน้าฝ่าย</option>
                        <option value="admin_hr">🛡️ กลุ่ม HR / Admin</option>
                        <option value="direct">💬 แชทส่วนตัว (Direct)</option>
                      </select>
                    </div>

                    {/* Enable Switch */}
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={currentEvent.enabled}
                        onChange={(e) =>
                          setEvents({
                            ...events,
                            [eventKey]: {
                              ...currentEvent,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: Audit Logs Drawer / Viewer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="size-4 text-mint" />
              <span>4. ตรวจสอบประวัติการส่งแจ้งเตือน (Audit Logs)</span>
            </h3>
            <Button
              type="button"
              onClick={handleLoadLogs}
              disabled={loadingLogs}
              variant="outline"
              className="rounded-xl text-xs"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
              {loadingLogs ? "กำลังโหลด..." : showLogs ? "รีเฟรชประวัติ" : "ดูประวัติการส่งล่าสุด"}
            </Button>
          </div>

          {showLogs && (
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-border/80 bg-background/50 p-3">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">ยังไม่มีประวัติการส่งข้อความ</div>
              ) : (
                <div className="divide-y divide-border/40 text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 px-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              log.status === "sent"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {log.status === "sent" ? "สำเร็จ ✓" : "ล้มเหลว ✗"}
                          </span>
                          <span className="font-semibold text-foreground">{log.message_title || log.event_type}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          ปลายทาง: <code>{log.recipient_chat_id}</code> | กิจกรรม: <code>{log.event_type}</code>
                          {log.error_message && <span className="ml-2 text-destructive">({log.error_message})</span>}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("th-TH")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between border-t border-border/70 pt-5">
          <p className="text-xs text-muted-foreground">
            บันทึกการตั้งค่าแล้วระบบจะมีผลทันทีต่อรอบการอบรมและกิจกรรมในระบบ
          </p>
          <Button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-primary px-8 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
          >
            <Save className="mr-2 size-4" />
            {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า Telegram"}
          </Button>
        </div>
      </form>
    </div>
  );
}

