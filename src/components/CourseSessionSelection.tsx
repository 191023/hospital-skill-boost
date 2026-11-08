import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessions, useSessionRoster, sessionLabel, type Session } from "@/components/Sessions";
import { Users, Calendar, MapPin, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CourseSessionSelection({
  courseId,
  currentSessionId,
  isEnrolled,
  isLocked,
  onEnrolled,
}: {
  courseId: string;
  currentSessionId: string | null;
  isEnrolled: boolean;
  isLocked: boolean;
  onEnrolled?: (sessionId: string) => void;
}) {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading } = useSessions(courseId);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground animate-pulse">
        กำลังโหลดรอบการอบรม...
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  async function handleSelect(sessionId: string, roundNo: number) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("choose_session", { _session: sessionId });
      if (error) {
        const msg = !error.message || error.message.includes("???")
          ? "ไม่สามารถลงทะเบียนรอบนี้ได้ กรุณาตรวจสอบสิทธิ์การเข้าอบรมหรือจำนวนที่นั่งว่าง"
          : error.message;
        toast.error(msg);
        return;
      }
      toast.success(isEnrolled ? `เปลี่ยนเป็นรอบที่ ${roundNo} เรียบร้อยแล้ว` : `ลงทะเบียนรอบที่ ${roundNo} สำเร็จ 🎉`);
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["sessions", courseId] });
      onEnrolled?.(sessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="size-4" />
            </span>
            <h2 className="text-xl font-bold">เลือกรอบการอบรม</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLocked
              ? "คุณเช็คชื่อเข้าอบรมแล้ว ไม่สามารถเปลี่ยนรอบได้"
              : isEnrolled
                ? "คุณสามารถเปลี่ยนรอบการอบรมที่สะดวกได้จนกว่าจะถึงเวลาเช็คชื่อ"
                : "กรุณาเลือกรอบการอบรมที่ท่านสะดวกเพื่อลงทะเบียนเข้าร่วม"}
          </p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          ทั้งหมด {sessions.length} รอบ
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {sessions.map((s) => {
          const isMine = currentSessionId === s.id;
          const isFull = s.capacity != null && s.taken >= s.capacity && !isMine;
          const seatsLeft = s.capacity != null ? Math.max(0, s.capacity - s.taken) : null;
          const percentTaken = s.capacity != null && s.capacity > 0 ? Math.min(100, Math.round((s.taken / s.capacity) * 100)) : null;
          const isExpanded = expandedSessionId === s.id;

          return (
            <div
              key={s.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isMine
                  ? "border-primary bg-primary/5 shadow-brand ring-1 ring-primary/30"
                  : isFull
                    ? "border-border/60 bg-muted/20 opacity-75"
                    : "border-border bg-card/60 hover:border-primary/40 hover:bg-card"
              }`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        รอบที่ {s.round_no}
                      </span>
                      {isMine && (
                        <span className="flex items-center gap-1 rounded-full bg-mint/20 px-2.5 py-0.5 text-xs font-semibold text-mint">
                          <CheckCircle2 className="size-3.5" />
                          รอบของคุณ
                        </span>
                      )}
                      {isFull && !isMine && (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                          <AlertCircle className="size-3.5" />
                          ที่นั่งเต็ม
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="size-4 text-primary shrink-0" />
                        <span>{s.starts_at ? new Date(s.starts_at).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" }) : "ยังไม่กำหนดวัน"}</span>
                        {s.ends_at && (
                          <span className="text-muted-foreground">
                            – {new Date(s.ends_at).toLocaleTimeString("th-TH", { timeStyle: "short" })} น.
                          </span>
                        )}
                      </div>
                      {s.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="size-4 text-muted-foreground shrink-0" />
                          <span>{s.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seat capacity badge */}
                  <div className="text-right sm:self-center">
                    <div className="text-sm font-semibold">
                      ลงทะเบียนแล้ว <span className="font-bold text-primary">{s.taken}</span>
                      {s.capacity != null ? ` / ${s.capacity}` : ""} คน
                    </div>
                    {seatsLeft != null && (
                      <div className={`mt-0.5 text-xs font-medium ${isFull ? "text-destructive" : seatsLeft <= 5 ? "text-amber" : "text-mint"}`}>
                        {isFull ? "ไม่มีที่นั่งว่าง" : `ว่าง ${seatsLeft} ที่นั่ง`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar for capacity */}
                {percentTaken != null && (
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isFull
                            ? "bg-destructive"
                            : percentTaken >= 80
                              ? "bg-amber"
                              : "bg-primary"
                        }`}
                        style={{ width: `${percentTaken}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
                  {/* View attendees toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Users className="size-3.5" />
                    <span>{isExpanded ? "ซ่อนรายชื่อผู้ลงทะเบียน" : `ดูรายชื่อผู้ลงทะเบียนรอบนี้ (${s.taken} คน)`}</span>
                    {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {/* Enrollment Button */}
                  <div>
                    {isMine ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-mint/15 px-4 py-2 text-xs font-bold text-mint">
                        <CheckCircle2 className="size-4" />
                        ลงทะเบียนรอบนี้แล้ว
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isLocked || isFull || submitting}
                        onClick={() => handleSelect(s.id, s.round_no)}
                        variant={isEnrolled ? "outline" : "default"}
                        className={isEnrolled ? "font-semibold" : "font-semibold shadow-brand"}
                      >
                        {isFull ? (
                          "ที่นั่งเต็ม"
                        ) : isEnrolled ? (
                          "เปลี่ยนมารอบนี้"
                        ) : (
                          <>
                            <Sparkles className="size-3.5" />
                            ลงทะเบียนรอบนี้
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible attendee roster */}
              {isExpanded && <SessionAttendeeList sessionId={s.id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionAttendeeList({ sessionId }: { sessionId: string }) {
  const { data: attendees = [], isLoading } = useSessionRoster(sessionId);
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const divisions = useMemo(() => {
    return [...new Set(attendees.map((a) => a.division).filter(Boolean))].sort();
  }, [attendees]);

  const departments = useMemo(() => {
    const pool = selectedDivision === "all" ? attendees : attendees.filter((a) => a.division === selectedDivision);
    return [...new Set(pool.map((a) => a.department).filter(Boolean))].sort();
  }, [attendees, selectedDivision]);

  const onDivisionChange = (div: string) => {
    setSelectedDivision(div);
    setSelectedDepartment("all");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendees.filter((person) => {
      if (q && !person.full_name.toLowerCase().includes(q)) return false;
      if (selectedDivision !== "all" && person.division !== selectedDivision) return false;
      if (selectedDepartment !== "all" && person.department !== selectedDepartment) return false;
      return true;
    });
  }, [attendees, search, selectedDivision, selectedDepartment]);

  const isFiltering = search.trim() !== "" || selectedDivision !== "all" || selectedDepartment !== "all";

  const clearFilters = () => {
    setSearch("");
    setSelectedDivision("all");
    setSelectedDepartment("all");
  };

  if (isLoading) {
    return (
      <div className="border-t border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground animate-pulse">
        กำลังโหลดรายชื่อผู้ลงทะเบียน...
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="border-t border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        ยังไม่มีผู้ลงทะเบียนในรอบนี้ — เป็นคนแรกที่เลือกรอบนี้ได้เลย!
      </div>
    );
  }

  return (
    <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ - นามสกุล..."
            className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-7 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {divisions.length > 0 && (
          <div className="min-w-[130px]">
            <select
              value={selectedDivision}
              onChange={(e) => onDivisionChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="all">ทุกฝ่าย ({divisions.length})</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {departments.length > 0 && (
          <div className="min-w-[130px]">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="all">ทุกแผนก ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {isFiltering && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
        <span>
          แสดง {filtered.length} คน {isFiltering && `(จากทั้งหมด ${attendees.length} คน)`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-card">
          <div>ไม่พบรายชื่อที่ตรงกับเงื่อนไขการค้นหา</div>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 font-semibold text-primary hover:underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-xl border border-border/60 bg-card">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 text-left text-muted-foreground backdrop-blur-sm">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">ชื่อ - นามสกุล</th>
                <th className="px-3 py-2 font-semibold">ฝ่าย / แผนก</th>
                <th className="px-3 py-2 font-semibold text-right">เวลาที่ลงทะเบียน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((person, idx) => (
                <tr key={person.user_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{person.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[person.division, person.department].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {person.enrolled_at ? new Date(person.enrolled_at).toLocaleDateString("th-TH", { dateStyle: "short" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
