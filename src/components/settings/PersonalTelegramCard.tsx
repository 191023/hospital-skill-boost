import React, { useState } from "react";
import { Send, CheckCircle2, AlertCircle, HelpCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/lib/auth";

interface PersonalTelegramCardProps {
  me: Me;
}

export function PersonalTelegramCard({ me }: PersonalTelegramCardProps) {
  const qc = useQueryClient();
  const [telegramChatId, setTelegramChatId] = useState(me.telegram_chat_id || "");
  const [telegramUsername, setTelegramUsername] = useState(me.telegram_username || "");
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isConnected = !!telegramChatId.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          telegram_chat_id: telegramChatId.trim() || null,
          telegram_username: telegramUsername.trim() || null,
          telegram_verified_at: telegramChatId.trim() ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", me.id);

      if (error) throw error;

      toast.success(
        telegramChatId.trim()
          ? "ผูกบัญชี Telegram สำหรับรับการแจ้งเตือนส่วนบุคคลเรียบร้อยแล้ว ✈️"
          : "ยกเลิกการผูกบัญชี Telegram เรียบร้อย"
      );
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      toast.error(`บันทึกไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-4 rounded-3xl p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-500 text-sm">
            ✈️
          </span>
          <span>การแจ้งเตือนส่วนบุคคลผ่าน Telegram</span>
        </h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isConnected
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isConnected ? (
            <>
              <CheckCircle2 className="size-3.5" />
              <span>ผูกบัญชีแล้ว</span>
            </>
          ) : (
            <span>ยังไม่ผูกบัญชี</span>
          )}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        รับข้อความแจ้งเตือนเมื่อมีหลักสูตรบังคับใหม่, แจ้งเตือนรอบอบรม On-site ล่วงหน้า 24 ชม.,
        เตือนค้างทำแบบทดสอบหลังเรียน และรับลิงก์ใบประกาศนียบัตรเข้ามือถือโดยตรง
      </p>

      <form onSubmit={handleSave} className="space-y-4 pt-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Telegram Chat ID (ตัวเลขรหัสแชท)
            </label>
            <input
              type="text"
              placeholder="เช่น 123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Telegram Username (ไม่บังคับ)
            </label>
            <input
              type="text"
              placeholder="เช่น my_username (ไม่ต้องใส่ @)"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ""))}
              className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* How to find Chat ID guide toggle */}
        <div className="rounded-2xl border border-border/80 bg-background/50 p-3.5">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center justify-between w-full text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="size-3.5" />
              <span>วิธีดู Telegram Chat ID ของตนเอง (ทำง่ายใน 30 วินาที)</span>
            </span>
            <span>{showGuide ? "▲ ปิดคำแนะนำ" : "▼ ดูวิธีหา"}</span>
          </button>

          {showGuide && (
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p>1. เปิดแอป Telegram บนมือถือหรือคอมพิวเตอร์</p>
              <p>
                2. ค้นหาบอททางการชื่อ <strong>@userinfobot</strong> ในช่องค้นหาของ Telegram
              </p>
              <p>3. กดปุ่ม Start หรือส่งข้อความอะไรก็ได้ 1 ข้อความ</p>
              <p>
                4. บอทจะตอบกลับข้อมูล เช่น <code>Id: 987654321</code> ให้นำตัวเลขดังกล่าวมาวางในช่อง <strong>Telegram Chat ID</strong> ด้านบน
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90 text-xs"
          >
            <Save className="mr-2 size-3.5" />
            {saving ? "กำลังบันทึก..." : "บันทึกการผูกบัญชี Telegram"}
          </Button>
        </div>
      </form>
    </div>
  );
}
