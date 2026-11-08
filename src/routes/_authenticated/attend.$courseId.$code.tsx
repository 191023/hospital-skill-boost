import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckInSuccess3D } from "@/components/CheckInSuccess3D";
import { CelebrationConfetti } from "@/components/CelebrationConfetti";
import { CheckCircle2, BookOpen, AlertCircle, Sparkles, WifiOff, RefreshCw, Check } from "lucide-react";
import { enqueueOfflineCheckin, syncOfflineQueue } from "@/lib/offline-sync";

export const Route = createFileRoute("/_authenticated/attend/$courseId/$code")({
  head: () => ({
    meta: [
      { title: "เช็คชื่อเข้าอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "เช็คชื่อเข้าอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "เช็คชื่อเข้าอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "เช็คชื่อเข้าอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Attend,
});

type Res = {
  title: string;
  checked_at: string;
  new: boolean;
  round: number | null;
};

type ProfileInfo = {
  full_name: string;
  position?: string | undefined;
  department?: string | undefined;
  division?: string | undefined;
};

function Attend() {
  const { courseId, code } = Route.useParams();
  const [res, setRes] = useState<Res | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [err, setErr] = useState("");
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const ran = useRef(false);

  async function trySyncNow() {
    setSyncing(true);
    const { syncedCount } = await syncOfflineQueue();
    setSyncing(false);
    if (syncedCount > 0) {
      const { data, error } = await supabase.rpc("check_in", { _course: courseId, _code: code });
      if (!error && data) {
        setRes(data as unknown as Res);
        setIsOfflineSaved(false);
      }
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    sessionStorage.removeItem("after-auth");

    // Fetch user profile for 3D Staff Badge
    supabase.auth.getUser().then(({ data: authData }) => {
      if (authData.user) {
        supabase
          .from("profiles")
          .select("full_name,position,department,division")
          .eq("id", authData.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            if (p) {
              setProfile({
                full_name: p.full_name,
                position: p.position ?? undefined,
                department: p.department ?? undefined,
                division: p.division ?? undefined,
              });
            }
          });
      }
    });

    // Check offline status first
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineCheckin(courseId, code, {
        userName: profile?.full_name,
      });
      setIsOfflineSaved(true);
      return;
    }

    // Execute check-in
    supabase
      .rpc("check_in", { _course: courseId, _code: code })
      .then(({ data, error }) => {
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) {
            enqueueOfflineCheckin(courseId, code, {
              userName: profile?.full_name,
            });
            setIsOfflineSaved(true);
          } else {
            setErr(error.message);
          }
        } else {
          setRes(data as unknown as Res);
        }
      })
      .catch(() => {
        enqueueOfflineCheckin(courseId, code, {
          userName: profile?.full_name,
        });
        setIsOfflineSaved(true);
      });
  }, [courseId, code, profile?.full_name]);

  return (
    <div className="mx-auto max-w-xl pb-16">
      {/* Celebration Confetti Burst on Success */}
      {res && <CelebrationConfetti autoTrigger={true} />}

      <div className="glass relative overflow-hidden rounded-3xl p-6 text-center shadow-brand backdrop-blur-xl sm:p-8">
        {/* Glow ambient background orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-mint/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/15 blur-3xl" />

        {/* Loading State */}
        {!res && !err && !isOfflineSaved && (
          <div className="py-16">
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-mint border-t-transparent" />
            <div className="mt-4 font-semibold text-foreground">กำลังบันทึกการเข้าอบรม...</div>
            <p className="mt-1 text-xs text-muted-foreground">
              กำลังยืนยันรหัส QR และสิทธิ์การเข้าเรียนของบุคลากร
            </p>
          </div>
        )}

        {/* Offline Cached State (จุดอับสัญญาณ) */}
        {isOfflineSaved && !res && (
          <div className="py-8 space-y-4">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <WifiOff className="size-8" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                <span>📶 บันทึกข้อมูลออฟไลน์สำเร็จ (Offline Cached)</span>
              </span>
              <h2 className="text-xl font-bold text-foreground">บันทึกรหัสเช็คชื่อในอุปกรณ์แล้ว</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                เนื่องจากจุดอบรมนี้มีสัญญาณอินเทอร์เน็ตไม่เสถียร (จุดอับสัญญาณ) ระบบได้บันทึกเวลาและรหัสเช็คชื่อลงในเครื่องเรียบร้อยแล้ว และจะทำการยืนยันขึ้นเซิร์ฟเวอร์อัตโนมัติเมื่ออุปกรณ์เชื่อมต่อสัญญาณได้อีกครั้ง
              </p>
            </div>

            <div className="glass mx-auto max-w-sm rounded-2xl p-4 text-xs space-y-1.5 border border-border/80">
              <div className="flex justify-between text-muted-foreground">
                <span>รหัสเช็คชื่อ:</span>
                <span className="font-mono font-bold text-foreground">{code}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>เวลาบันทึก:</span>
                <span className="font-semibold text-foreground">{new Date().toLocaleTimeString("th-TH")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>สถานะคิว:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">รอซิงค์อัตโนมัติ</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={trySyncNow}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "กำลังตรวจสอบสัญญาณ..." : "ตรวจสอบและซิงค์ทันที"}</span>
              </button>
              <Link
                to="/courses/$courseId"
                params={{ courseId }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-accent"
              >
                <span>กลับไปที่หลักสูตร</span>
              </Link>
            </div>
          </div>
        )}

        {/* Error State */}
        {err && !isOfflineSaved && (
          <div className="py-10">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-destructive/15 text-destructive">
              <AlertCircle className="size-8" />
            </div>
            <div className="mt-4 text-xl font-bold text-destructive">เช็คชื่อไม่สำเร็จ</div>
            <p className="mt-2 text-sm text-muted-foreground">{err}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/courses/$courseId"
                params={{ courseId }}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                กลับไปที่หลักสูตร
              </Link>
            </div>
          </div>
        )}

        {/* Success State: Check-in Success Beacon & 3D Staff Badge */}
        {res && (
          <div className="relative z-10 flex flex-col items-center">
            {/* Status Header Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3.5 py-1 text-xs font-semibold text-mint-deep">
              <Sparkles className="size-3.5 text-mint" />
              <span>{res.new ? "บันทึกเวลาเข้าร่วมสำเร็จ" : "บันทึกการเช็คชื่อไว้แล้ว"}</span>
            </div>

            {/* 3D Check-in Success Beacon & Staff Badge */}
            <CheckInSuccess3D
              fullName={profile?.full_name || "บุคลากรทางการแพทย์"}
              position={profile?.position}
              department={profile?.department}
              courseTitle={res.title}
              round={res.round}
              checkedAt={res.checked_at}
            />

            {/* Success Summary Card */}
            <div className="mt-4 w-full rounded-2xl border border-border/70 bg-card/60 p-4 text-center backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-center gap-2 text-lg font-bold text-foreground">
                <CheckCircle2 className="size-5 text-mint" />
                <span>{res.new ? "เช็คชื่อเข้าอบรมเรียบร้อย" : "คุณได้เช็คชื่อรอบนี้ไว้แล้ว"}</span>
              </div>
              <div className="mt-1 text-base font-semibold text-primary">
                {res.title}
                {res.round ? ` · รอบที่ ${res.round}` : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                เวลาที่บันทึก:{" "}
                {new Date(res.checked_at).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
              <Link
                to="/courses/$courseId"
                params={{ courseId }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-brand hover:bg-primary/90"
              >
                <BookOpen className="size-4" />
                เข้าสู่ห้องเรียน / เริ่มทำแบบทดสอบ
              </Link>
              <Link
                to="/my-courses"
                className="flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium hover:bg-accent"
              >
                ประวัติการอบรม
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
