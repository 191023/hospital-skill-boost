import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar, MapPin, Users, AlertCircle, CheckCircle2, Sparkles, Loader2 } from "lucide-react";

export type SessionItem = {
  id: string;
  round_no: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  capacity: number | null;
};

export type CourseWithSessions = {
  id: string;
  title: string;
  category: string | null;
  hours: number | null;
  cover_url: string | null;
  course_sessions: SessionItem[];
};

export type AssignCourseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  members: { user_id: string; full_name: string; division: string; department: string; position?: string }[];
  courses: CourseWithSessions[];
  preselectedCourseId?: string | undefined;
  onSuccess: () => void;
};

export function AssignCourseModal({
  open,
  onOpenChange,
  selectedUserIds,
  members,
  courses,
  preselectedCourseId,
  onSuccess,
}: AssignCourseModalProps) {
  const [courseId, setCourseId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [fetchingSeats, setFetchingSeats] = useState(false);

  useEffect(() => {
    if (open) {
      setCourseId(preselectedCourseId || (courses[0]?.id ?? ""));
      setSessionId(null);
    }
  }, [open, preselectedCourseId, courses]);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const sessions = selectedCourse?.course_sessions ?? [];

  useEffect(() => {
    if (!courseId || sessions.length === 0) return;
    setFetchingSeats(true);
    supabase.rpc("session_seats", { _course: courseId }).then(({ data, error }) => {
      setFetchingSeats(false);
      if (data && !error) {
        const map: Record<string, number> = {};
        for (const row of data) {
          map[row.session_id] = row.taken;
        }
        setSeats(map);
      }
    });
  }, [courseId, sessions.length]);

  const selectedMembers = members.filter((m) => selectedUserIds.includes(m.user_id));

  async function handleAssign() {
    if (!courseId) {
      toast.error("กรุณาเลือกหลักสูตร");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("กรุณาเลือกสมาชิกอย่างน้อย 1 คน");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("manager_assign_course", {
        _course: courseId,
        _session: sessionId,
        _user_ids: selectedUserIds,
      });

      if (error) {
        toast.error("ไม่สามารถมอบหมายได้: " + error.message);
        return;
      }

      const res = data as {
        success: boolean;
        assigned_count: number;
        skipped_attended: number;
        skipped_no_access: number;
      };

      toast.success(
        `ลงทะเบียนสำเร็จ ${res.assigned_count} คน${
          res.skipped_attended > 0 ? ` (ข้าม ${res.skipped_attended} คนที่เช็คชื่อเข้าห้องแล้ว)` : ""
        }`,
        { duration: 5000 }
      );

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Selected session seat calculations
  const chosenSession = sessions.find((s) => s.id === sessionId);
  const chosenCap = chosenSession?.capacity ?? null;
  const chosenTaken = sessionId ? (seats[sessionId] ?? 0) : 0;
  const chosenAvailable = chosenCap != null ? Math.max(0, chosenCap - chosenTaken) : null;
  const isSeatExceeded = chosenAvailable != null && chosenAvailable < selectedUserIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>มอบหมายหลักสูตร & เลือกรอบอบรมให้สมาชิก</span>
          </DialogTitle>
          <DialogDescription>
            จัดการลงทะเบียนอบรมแบบกลุ่มสำหรับสมาชิกใต้การบังคับบัญชา โดยสมาชิกไม่ต้องลงทะเบียนทีละคน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* 1. Selected Members Summary */}
          <div className="rounded-2xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="font-semibold text-foreground">สมาชิกที่เลือก ({selectedMembers.length} คน)</span>
              <span>สังกัดหน่วยงานที่คุณดูแล</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {selectedMembers.map((m) => (
                <span
                  key={m.user_id}
                  className="inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-xs border shadow-2xs font-medium"
                >
                  <span>{m.full_name}</span>
                  <span className="text-[10px] text-muted-foreground">({m.department || m.division})</span>
                </span>
              ))}
            </div>
          </div>

          {/* 2. Choose Course */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">1. เลือกหลักสูตรที่ต้องการอบรม</label>
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSessionId(null);
              }}
              className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {courses.map((c) => {
                const sCount = c.course_sessions?.length ?? 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.hours ? `(${c.hours} ชม.)` : ""} {sCount > 0 ? `· มี ${sCount} รอบอบรม` : "· เรียนออนไลน์"}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Choose Session Round (if classroom course) */}
          {selectedCourse && sessions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">2. เลือกรอบการอบรมที่ต้องการส่งสมาชิกเข้าอบรม</label>
                {fetchingSeats && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> กำลังตรวจสอบที่นั่งว่าง...
                  </span>
                )}
              </div>

              <div className="grid gap-2.5">
                {sessions.map((s) => {
                  const taken = seats[s.id] ?? 0;
                  const cap = s.capacity;
                  const available = cap != null ? Math.max(0, cap - taken) : null;
                  const isFull = available != null && available === 0;
                  const isSelected = sessionId === s.id;
                  const notEnough = isSelected && isSeatExceeded;

                  return (
                    <div
                      key={s.id}
                      onClick={() => !isFull && setSessionId(s.id)}
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : isFull
                          ? "border-border/40 bg-muted/30 opacity-60 cursor-not-allowed"
                          : "border-border/70 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                          {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">รอบที่ {s.round_no}</span>
                            {s.location && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {s.location}
                              </span>
                            )}
                          </div>
                          {s.starts_at && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 text-primary" />
                              <span>
                                {new Date(s.starts_at).toLocaleDateString("th-TH", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <span>
                                · {new Date(s.starts_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} -{" "}
                                {s.ends_at ? new Date(s.ends_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""} น.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        {cap != null ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-muted">
                            <Users className="h-3 w-3" />
                            <span>ว่าง {available} / {cap} ที่นั่ง</span>
                          </div>
                        ) : (
                          <span className="text-xs text-mint font-semibold">ไม่จำกัดที่นั่ง</span>
                        )}
                        {notEnough && (
                          <div className="mt-1 text-[11px] font-semibold text-destructive flex items-center gap-1 sm:justify-end">
                            <AlertCircle className="h-3 w-3" /> ที่นั่งไม่พอ ({selectedUserIds.length} คน)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Option: Enroll without session round */}
                <div
                  onClick={() => setSessionId(null)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition cursor-pointer ${
                    sessionId === null
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                      : "border-border/70 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${sessionId === null ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {sessionId === null && <span className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">ลงทะเบียนเข้าหลักสูตรก่อน (ยังไม่กำหนดรอบ)</div>
                    <div className="text-[11px] text-muted-foreground">สมาชิกจะเห็นหลักสูตรและสามารถเข้ามาเลือกรอบอบรมด้วยตนเองได้ในภายหลัง</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
              <span className="font-semibold text-primary">หลักสูตรออนไลน์:</span> เมื่อกดยืนยัน สมาชิกจะได้รับการลงทะเบียนและสามารถเข้าเรียนบทเรียนออนไลน์ได้ทันที
            </div>
          )}

          {/* Information & Security Note */}
          <div className="rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-mint shrink-0 mt-0.5" />
            <div>
              ระบบจะบันทึกการลงทะเบียนลงในประวัติผู้ใช้งาน และส่งสถานะไปยังหน้า <strong>ทีมของฉัน</strong> และ <strong>หลักสูตรของฉัน</strong> ของผู้เรียนอัตโนมัติ
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted transition"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={loading || isSeatExceeded}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-md transition ${
              isSeatExceeded
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>ยืนยันการลงทะเบียน ({selectedUserIds.length} คน)</span>
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
