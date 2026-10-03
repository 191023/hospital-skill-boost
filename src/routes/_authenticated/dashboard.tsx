import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/lib/auth";
import { useMyCourses } from "@/lib/data";
import { PageHeader, Stat, Bar } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ด — ระบบอบรมออนไลน์" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data: courses = [] } = useMyCourses(me?.id);
  const inProgress = courses.filter((c) => !c.passed);
  const certs = courses.filter((c) => c.passed).length;
  const withBoth = courses.filter((c) => c.pre !== undefined && c.post !== undefined).slice(0, 2);
  const totalHours = courses.filter((c) => c.passed).reduce((s, c) => s + Number(c.hours ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="ระบบอบรมออนไลน์"
        title={`สวัสดี ${me?.full_name ?? ""}`}
        right={
          <Link to="/courses" className="glass rounded-full px-4 py-2 text-sm text-foreground/70">
            🔍 ค้นหาหลักสูตร...
          </Link>
        }
      />
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="หลักสูตรที่ลงทะเบียน" value={courses.length} note="ทั้งหมด" tone="primary" />
        <Stat label="กำลังเรียน" value={inProgress.length} note="ยังไม่ได้ใบประกาศ" tone="amber" />
        <Stat label="ใบประกาศที่ได้รับ" value={certs} note="ผ่านเกณฑ์แล้ว" tone="mint" />
        <Stat label="ชั่วโมงอบรมสะสม" value={totalHours} note="จากหลักสูตรที่ผ่าน" tone="coral" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">หลักสูตรของฉัน</h2>
              <p className="text-sm text-muted-foreground">เรียนต่อจากที่ค้างไว้</p>
            </div>
            <Link to="/courses" className="text-xs font-semibold text-primary">ดูทั้งหมด →</Link>
          </div>
          <div className="mt-5 grid gap-4">
            {courses.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                ยังไม่ได้ลงทะเบียนหลักสูตร <Link to="/courses" className="font-semibold text-primary">เลือกหลักสูตร</Link>
              </div>
            )}
            {courses.slice(0, 4).map((c) => (
              <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="glass flex gap-4 rounded-2xl p-3 shadow-none transition hover:-translate-y-0.5">
                <img src={coverFor(c.id, c.cover_url)} alt="" loading="lazy" className="h-24 w-40 shrink-0 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className={`text-[11px] font-semibold ${toneFor(c.id)}`}>{c.category || "ทั่วไป"} · {c.hours} ชั่วโมง</div>
                  <div className="text-base font-bold">{c.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.done}/{c.lessonCount} บทเรียน {c.passed ? "· ได้รับใบประกาศแล้ว ✓" : ""}
                  </div>
                  <div className="mt-3"><Bar value={c.pct} tone={c.passed ? "mint" : "primary"} /></div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-bold">การเปรียบเทียบผล</h2>
          <p className="text-sm text-muted-foreground">ก่อนเรียน vs หลังเรียน</p>
          {withBoth.length === 0 ? (
            <div className="mt-6 text-sm text-muted-foreground">ทำแบบทดสอบก่อนและหลังเรียนเพื่อดูพัฒนาการ</div>
          ) : (
            <>
              <div className="mt-6 flex h-44 items-end justify-around gap-3">
                {withBoth.flatMap((c, i) => [
                  <Col key={c.id + "pre"} h={c.pre!} label="ก่อน" cls="bg-mist/80 border border-glass-border" />,
                  <Col key={c.id + "post"} h={c.post!} label="หลัง" cls={i === 0 ? "bg-brand-gradient shadow-brand" : "bg-mint"} strong />,
                ])}
              </div>
              <div className="glass mt-6 rounded-2xl p-4 shadow-none">
                {withBoth.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="truncate text-muted-foreground">{c.title}</span>
                    <span className="font-bold text-primary">{c.post! - c.pre! >= 0 ? "+" : ""}{(c.post! - c.pre!).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function Col({ h, label, cls, strong }: { h: number; label: string; cls: string; strong?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-2">
      <div className="text-[11px] font-semibold">{h}%</div>
      <div className={`w-full rounded-t-xl ${cls}`} style={{ height: `${Math.max(4, h * 0.8)}%` }} />
      <div className={`text-[11px] font-semibold ${strong ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
    </div>
  );
}
