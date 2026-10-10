import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [
    { title: "เปลี่ยนรหัสผ่าน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "เปลี่ยนรหัสผ่านบัญชีระบบอบรมออนไลน์" },
    { property: "og:title", content: "เปลี่ยนรหัสผ่าน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "เปลี่ยนรหัสผ่านบัญชีระบบอบรมออนไลน์" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Account,
});

const input = "w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Account() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) { toast.error("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email;
    if (!email) { setBusy(false); toast.error("ไม่พบอีเมลของบัญชี"); return; }
    const check = await supabase.auth.signInWithPassword({ email, password: f.current });
    if (check.error) { setBusy(false); toast.error("รหัสผ่านเดิมไม่ถูกต้อง"); return; }
    const { error } = await supabase.auth.updateUser({ password: f.next, current_password: f.current } as never);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("เปลี่ยนรหัสผ่านเรียบร้อย"); setF({ current: "", next: "", confirm: "" }); }
  }

  return (
    <div className="max-w-md">
      <PageHeader eyebrow="บัญชีของฉัน" title="เปลี่ยนรหัสผ่าน" />
      <form onSubmit={submit} className="glass space-y-3 rounded-3xl p-6">
        <input className={input} type="password" placeholder="รหัสผ่านเดิม" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <input className={input} type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" minLength={6} required value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        <input className={input} type="password" placeholder="ยืนยันรหัสผ่านใหม่" minLength={6} required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
        <p className="text-xs text-muted-foreground">ถ้าเข้าระบบด้วย Google และยังไม่เคยตั้งรหัสผ่าน ให้ออกจากระบบแล้วใช้ “ลืมรหัสผ่าน” ในหน้าเข้าสู่ระบบ</p>
      </form>
    </div>
  );
}
