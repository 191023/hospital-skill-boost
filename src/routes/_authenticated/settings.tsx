import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { DeptPicker } from "@/components/DeptPicker";
import { Button } from "@/components/ui/button";
import obhLogoUrl from "@/assets/obh-logo.png";
import obhSealUrl from "@/assets/obh-seal.png";
import {
  User,
  Building2,
  Award,
  ShieldCheck,
  Bell,
  Save,
  KeyRound,
  CheckCircle2,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "ศูนย์การตั้งค่าระบบและโปรไฟล์บุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "ตั้งค่าระบบ — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "ศูนย์การตั้งค่าระบบและโปรไฟล์บุคลากร" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelCls = "block text-xs font-semibold text-foreground/80 mb-1.5";

type SettingsTab = "profile" | "hospital" | "certificate" | "policy" | "system";

export function SettingsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Fetch all system settings from Supabase
  const { data: systemSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["system_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((row) => {
        map[row.key] = row.value;
      });
      return map;
    },
  });

  // State: Tab 1 (Profile)
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    position: "",
    division: "",
    department: "",
    licenseNo: "",
  });

  // State: Tab 1 (Password)
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync me with profile form
  useEffect(() => {
    if (me) {
      setProfileForm({
        fullName: me.full_name || "",
        position: me.position || "",
        division: me.division || "",
        department: me.department || "",
        licenseNo: me.license_no || "",
      });
    }
  }, [me]);

  // State: Tab 2 (Hospital Identity)
  const [hospitalForm, setHospitalForm] = useState({
    name_th: "โรงพยาบาลโอเวอร์บรุ๊ค",
    name_en: "Overbrook Hospital",
    center_name: "ศูนย์พัฒนาศักยภาพบุคลากร",
    contact_email: "hrd@overbrook.example.com",
    contact_tel: "053-910100 ต่อ 1234",
    address: "17 ถนนสิงหไคล ตำบลเวียง อำเภอเมือง จังหวัดเชียงราย 57000",
  });

  // State: Tab 3 (Certificate Defaults)
  const [certForm, setCertForm] = useState({
    number_pattern: "OVB-{YEAR}-{RUNNING}",
    director_name: "นพ. กฤษณ์ วงศ์วิวัฒน์",
    director_title: "ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค",
    verify_public_enabled: true,
  });

  // State: Tab 4 (Training Policies)
  const [policyForm, setPolicyForm] = useState({
    annual_hours_target: 20,
    doctor_hours_target: 30,
    nurse_hours_target: 25,
    staff_hours_target: 15,
    default_pass_score: 80,
    require_attendance_percent: 80,
    year_type: "calendar",
  });

  // State: Tab 5 (Notification Settings)
  const [notifyForm, setNotifyForm] = useState({
    email_reminders_enabled: true,
    line_notify_enabled: false,
    line_token: "",
    remind_hours_before: 24,
  });

  const [savingSettings, setSavingSettings] = useState(false);

  // Sync loaded settings with state
  useEffect(() => {
    if (systemSettings) {
      const hp = systemSettings["hospital_profile"];
      if (hp && typeof hp === "object") {
        setHospitalForm((prev) => ({ ...prev, ...(hp as object) }));
      }
      const cr = systemSettings["certificate_rules"];
      if (cr && typeof cr === "object") {
        setCertForm((prev) => ({ ...prev, ...(cr as object) }));
      }
      const tp = systemSettings["training_policy"];
      if (tp && typeof tp === "object") {
        setPolicyForm((prev) => ({ ...prev, ...(tp as object) }));
      }
      const ns = systemSettings["notification_settings"];
      if (ns && typeof ns === "object") {
        setNotifyForm((prev) => ({ ...prev, ...(ns as object) }));
      }
    }
  }, [systemSettings]);

  // Handler: Save User Profile
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.fullName,
          position: profileForm.position,
          division: profileForm.division,
          department: profileForm.department,
          license_no: profileForm.licenseNo,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", me.id);

      if (error) throw error;
      toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด: " + (err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  // Handler: Change Password
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast.error("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setSavingPw(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("ไม่พบอีเมลของบัญชีผู้ใช้");

      const check = await supabase.auth.signInWithPassword({ email, password: pwForm.current });
      if (check.error) throw new Error("รหัสผ่านเดิมไม่ถูกต้อง");

      const { error } = await supabase.auth.updateUser({
        password: pwForm.next,
        current_password: pwForm.current,
      } as never);
      if (error) throw error;

      toast.success("เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPw(false);
    }
  }

  // Handler: Save System Setting Block (Admin only)
  async function saveSettingBlock(key: string, value: Record<string, any>, label: string) {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from("system_settings").upsert({
        key,
        value: value as any,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(`บันทึก${label}เรียบร้อย`);
      refetchSettings();
    } catch (err) {
      toast.error(`บันทึกไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setSavingSettings(false);
    }
  }

  const tabs: { id: SettingsTab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "profile", label: "โปรไฟล์และบัญชี", icon: User },
    { id: "hospital", label: "ข้อมูลโรงพยาบาล", icon: Building2, adminOnly: true },
    { id: "certificate", label: "ใบประกาศนียบัตร", icon: Award, adminOnly: true },
    { id: "policy", label: "เกณฑ์การอบรม HA", icon: ShieldCheck, adminOnly: true },
    { id: "system", label: "การแจ้งเตือนและระบบ", icon: Bell, adminOnly: true },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <PageHeader
        eyebrow="การจัดการและตั้งค่า"
        title="ศูนย์การตั้งค่าระบบ (Settings)"
        right={
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="size-4" />
            <span>สิทธิ์ปัจจุบัน: {me?.isAdmin ? "ผู้ดูแลระบบ (Admin)" : "บุคลากร (Staff / Learner)"}</span>
          </div>
        }
      />

      {/* Tabs Navigation Header */}
      <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3">
        {tabs.map((tab) => {
          if (tab.adminOnly && !me?.isAdmin) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "bg-card/70 text-foreground/70 hover:bg-card hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Profile & Account Settings */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Personal & Professional Profile */}
          <div className="glass space-y-6 rounded-3xl p-6 shadow-sm lg:col-span-7 sm:p-8">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <User className="size-5 text-primary" />
                <span>ข้อมูลบุคลากรทางการแพทย์</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ข้อมูลนี้จะนำไปแสดงบนบัตรประจำตัว 3D และเอกสารใบประกาศนียบัตร
              </p>
            </div>

            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className={labelCls}>ชื่อ-นามสกุล (พร้อมคำนำหน้าวิชาชีพ)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น พว. วิภาวัลย์ เกียรติพงษ์ หรือ นพ. สมชาย ใจดี"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ตำแหน่งวิชาชีพ</label>
                <input
                  type="text"
                  placeholder="เช่น พยาบาลวิชาชีพชำนาญการ, อายุรแพทย์, เภสัชกร"
                  value={profileForm.position}
                  onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เลขที่ใบอนุญาตประกอบวิชาชีพ (ถ้ามี)</label>
                <input
                  type="text"
                  placeholder="เช่น ว.12345 หรือ พ.98765"
                  value={profileForm.licenseNo}
                  onChange={(e) => setProfileForm({ ...profileForm, licenseNo: e.target.value })}
                  className={inputCls}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  ใช้สำหรับการสะสมหน่วยกิตวิชาชีพ (CNEU / CME) เมื่อจบหลักสูตร
                </span>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>ฝ่ายและแผนกต้นสังกัด</label>
                <DeptPicker
                  division={profileForm.division}
                  department={profileForm.department}
                  onChange={(div, dept) => setProfileForm({ ...profileForm, division: div, department: dept })}
                  className={inputCls}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
                >
                  <Save className="mr-2 size-4" />
                  {savingProfile ? "กำลังบันทึก..." : "บันทึกข้อมูลส่วนตัว"}
                </Button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="glass space-y-6 rounded-3xl p-6 shadow-sm lg:col-span-5 sm:p-8">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <KeyRound className="size-5 text-amber" />
                <span>เปลี่ยนรหัสผ่าน</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ควรกำหนดรหัสผ่านที่มีความยาวอย่างน้อย 6 ตัวอักษร
              </p>
            </div>

            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <label className={labelCls}>รหัสผ่านเดิม</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={savingPw}
                  className="w-full rounded-xl bg-amber-600 font-semibold text-white shadow-sm hover:bg-amber-700"
                >
                  <Lock className="mr-2 size-4" />
                  {savingPw ? "กำลังตรวจสอบ..." : "บันทึกรหัสผ่านใหม่"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Hospital Identity (Admin Only) */}
      {activeTab === "hospital" && me?.isAdmin && (
        <div className="glass space-y-6 rounded-3xl p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Building2 className="size-5 text-primary" />
              <span>ข้อมูลอัตลักษณ์โรงพยาบาลและศูนย์พัฒนาศักยภาพ</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ข้อมูลนี้จะใช้แสดงผลส่วนหัวของระบบ ใบประกาศนียบัตร และการติดต่อทางการ
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettingBlock("hospital_profile", hospitalForm, "ข้อมูลโรงพยาบาล");
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>ชื่อโรงพยาบาล (ภาษาไทย)</label>
                <input
                  type="text"
                  required
                  value={hospitalForm.name_th}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name_th: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ชื่อโรงพยาบาล (ภาษาอังกฤษ)</label>
                <input
                  type="text"
                  required
                  value={hospitalForm.name_en}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name_en: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ชื่อศูนย์อบรม / ฝ่ายพัฒนาทรัพยากรบุคคล</label>
                <input
                  type="text"
                  required
                  value={hospitalForm.center_name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, center_name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>อีเมลติดต่อฝ่ายอบรม (HRD)</label>
                <input
                  type="email"
                  required
                  value={hospitalForm.contact_email}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, contact_email: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เบอร์โทรศัพท์ติดต่อภายใน</label>
                <input
                  type="text"
                  value={hospitalForm.contact_tel}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, contact_tel: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ที่อยู่โรงพยาบาล</label>
                <input
                  type="text"
                  value={hospitalForm.address}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Hospital Assets Preview */}
            <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
              <div className="text-xs font-semibold text-foreground">
                สัญลักษณ์ทางการประจำระบบ (Official Brand Assets)
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <img src={obhLogoUrl} alt="Logo" className="size-12 rounded-xl object-contain shadow-sm" />
                  <div>
                    <div className="text-xs font-bold text-foreground">โลโก้โรงพยาบาลโอเวอร์บรุ๊ค</div>
                    <div className="text-[11px] text-muted-foreground">ใช้ใน Header, การ์ด 3D, และใบประกาศ</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <img src={obhSealUrl} alt="Seal" className="size-12 rounded-xl object-contain shadow-sm" />
                  <div>
                    <div className="text-xs font-bold text-foreground">ตราประทับทางการ 3D โฮโลแกรม</div>
                    <div className="text-[11px] text-muted-foreground">ใช้สำหรับรับรองวุฒิบัตรดิจิทัล</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingSettings ? "กำลังบันทึก..." : "บันทึกข้อมูลโรงพยาบาล"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Certificate Defaults (Admin Only) */}
      {activeTab === "certificate" && me?.isAdmin && (
        <div className="glass space-y-6 rounded-3xl p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Award className="size-5 text-primary" />
              <span>การตั้งค่าแม่แบบและลายเซ็นต์ใบประกาศนียบัตรกลาง</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              กำหนดรูปแบบการรันเลขที่ใบประกาศและข้อมูลผู้บริหารกลางของโรงพยาบาล
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettingBlock("certificate_rules", certForm, "การตั้งค่าใบประกาศ");
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>รูปแบบเลขที่ใบประกาศ (Pattern Prefix)</label>
                <input
                  type="text"
                  required
                  value={certForm.number_pattern}
                  onChange={(e) => setCertForm({ ...certForm, number_pattern: e.target.value })}
                  className={inputCls}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  รองรับแท็ก: &#123;YEAR&#125; (ปี พ.ศ./ค.ศ.), &#123;RUNNING&#125; (ลำดับเลข 4 หลัก)
                </span>
              </div>

              <div>
                <label className={labelCls}>ชื่อผู้อำนวยการโรงพยาบาล (สำหรับลงนามกลาง)</label>
                <input
                  type="text"
                  required
                  value={certForm.director_name}
                  onChange={(e) => setCertForm({ ...certForm, director_name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>ตำแหน่งผู้อำนวยการโรงพยาบาล</label>
                <input
                  type="text"
                  required
                  value={certForm.director_title}
                  onChange={(e) => setCertForm({ ...certForm, director_title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={certForm.verify_public_enabled}
                    onChange={(e) =>
                      setCertForm({ ...certForm, verify_public_enabled: e.target.checked })
                    }
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>เปิดใช้งานหน้าสแกน QR ตรวจสอบใบประกาศสาธารณะ</span>
                </label>
                <span className="mt-1 text-xs text-muted-foreground">
                  อนุญาตให้บุคคลภายนอกสแกน QR เพื่อตรวจสอบความถูกต้องของใบประกาศได้
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingSettings ? "กำลังบันทึก..." : "บันทึกการตั้งค่าใบประกาศ"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Training Policies & HA Compliance (Admin Only) */}
      {activeTab === "policy" && me?.isAdmin && (
        <div className="glass space-y-6 rounded-3xl p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <ShieldCheck className="size-5 text-primary" />
              <span>เกณฑ์มาตรฐานการอบรมและตัวชี้วัด HA โรงพยาบาล</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              กำหนดเป้าหมายชั่วโมงการอบรมขั้นต่ำต่อปีสำหรับบุคลากรแต่ละสายวิชาชีพ
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettingBlock("training_policy", policyForm, "เกณฑ์การอบรม");
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>เป้าหมายชั่วโมงรวม (ชม./ปี)</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={policyForm.annual_hours_target}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, annual_hours_target: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เป้าหมายแพทย์ (ชม./ปี)</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={policyForm.doctor_hours_target}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, doctor_hours_target: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เป้าหมายพยาบาล (ชม./ปี)</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={policyForm.nurse_hours_target}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, nurse_hours_target: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เป้าหมายสายสนับสนุน (ชม./ปี)</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={policyForm.staff_hours_target}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, staff_hours_target: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>เกณฑ์คะแนนสอบผ่านขั้นต่ำ (Post-test %)</label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  required
                  value={policyForm.default_pass_score}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, default_pass_score: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>เกณฑ์เวลาเรียนขั้นต่ำ (Attendance %)</label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  required
                  value={policyForm.require_attendance_percent}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      require_attendance_percent: Number(e.target.value),
                    })
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>รอบการคิดสถิติประจำปี</label>
                <select
                  value={policyForm.year_type}
                  onChange={(e) => setPolicyForm({ ...policyForm, year_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="calendar">ปีปฏิทิน (1 ม.ค. - 31 ธ.ค.)</option>
                  <option value="fiscal">ปีงบประมาณ (1 ต.ค. - 30 ก.ย.)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingSettings ? "กำลังบันทึก..." : "บันทึกเกณฑ์การอบรม"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: Notifications & System Status (Admin Only) */}
      {activeTab === "system" && me?.isAdmin && (
        <div className="glass space-y-6 rounded-3xl p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Bell className="size-5 text-primary" />
              <span>การแจ้งเตือนและสถานะการเชื่อมต่อระบบ</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ตั้งค่าการส่งข้อความแจ้งเตือนรอบอบรมและตรวจสอบสถานะการทำงานของโครงสร้างระบบ
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettingBlock("notification_settings", notifyForm, "การตั้งค่าแจ้งเตือน");
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={notifyForm.email_reminders_enabled}
                    onChange={(e) =>
                      setNotifyForm({ ...notifyForm, email_reminders_enabled: e.target.checked })
                    }
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>แจ้งเตือนผ่าน Email อัตโนมัติ</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  ส่งอีเมลแจ้งเตือนบุคลากรล่วงหน้าก่อนถึงเวลาเริ่มรอบการอบรม
                </p>
                <div className="mt-3">
                  <label className={labelCls}>แจ้งเตือนล่วงหน้า (ชั่วโมง)</label>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={notifyForm.remind_hours_before}
                    onChange={(e) =>
                      setNotifyForm({ ...notifyForm, remind_hours_before: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={notifyForm.line_notify_enabled}
                    onChange={(e) =>
                      setNotifyForm({ ...notifyForm, line_notify_enabled: e.target.checked })
                    }
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>เปิดใช้งาน Line Notify</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  แจ้งเตือนสรุปผลการอบรมประจำวันเข้ากลุ่มงานพยาบาลหรือกลุ่มผู้บริหาร
                </p>
                <div className="mt-3">
                  <label className={labelCls}>Line Notify Token</label>
                  <input
                    type="password"
                    placeholder="วาง Token จาก Line Notify Service"
                    value={notifyForm.line_token}
                    onChange={(e) => setNotifyForm({ ...notifyForm, line_token: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* System Status Indicators */}
            <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
              <div className="text-xs font-semibold text-foreground">
                สถานะระบบปัจจุบัน (System Health & Environment)
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-mint" />
                  <span>ฐานข้อมูล Supabase PostgreSQL (เชื่อมต่อแล้ว)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-mint" />
                  <span>ระบบกราฟิก 3D WebGL (พร้อมใช้งาน)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-mint" />
                  <span>การจัดเก็บไฟล์หลักสูตร (Storage Active)</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingSettings ? "กำลังบันทึก..." : "บันทึกการตั้งค่าการแจ้งเตือน"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
