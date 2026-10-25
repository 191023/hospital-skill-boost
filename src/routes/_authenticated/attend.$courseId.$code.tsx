import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckInSuccess3D } from "@/components/CheckInSuccess3D";
import { CelebrationConfetti } from "@/components/CelebrationConfetti";
import { CheckCircle2, BookOpen, AlertCircle, Sparkles } from "lucide-react";

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
  const ran = useRef(false);

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

    // Execute check-in
    supabase
      .rpc("check_in", { _course: courseId, _code: code })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRes(data as unknown as Res);
      });
  }, [courseId, code]);

  return (
    <div className="mx-auto max-w-xl pb-16">
      {/* Celebration Confetti Burst on Success */}
      {res && <CelebrationConfetti autoTrigger={true} />}

      <div className="glass relative overflow-hidden rounded-3xl p-6 text-center shadow-brand backdrop-blur-xl sm:p-8">
        {/* Glow ambient background orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-mint/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/15 blur-3xl" />

        {/* Loading State */}
        {!res && !err && (
          <div className="py-16">
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-mint border-t-transparent" />
            <div className="mt-4 font-semibold text-foreground">กำลังบันทึกการเข้าอบรม...</div>
            <p className="mt-1 text-xs text-muted-foreground">
              กำลังยืนยันรหัส QR และสิทธิ์การเข้าเรียนของบุคลากร
            </p>
          </div>
        )}

        {/* Error State */}
        {err && (
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
