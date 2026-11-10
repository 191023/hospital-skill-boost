import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserCheck,
  UserX,
  Trash2,
  RotateCcw,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  Loader2,
  Users,
  Monitor,
} from "lucide-react";
import { ClassroomHubModal } from "./ClassroomHubModal";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { thaiDate } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { inp } from "./shared";
import type { Database } from "@/integrations/supabase/types";

type Session = Database["public"]["Tables"]["course_sessions"]["Row"];

type AttendeeRow = {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  division: string;
  department: string;
  position: string;
  enrolledAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  sessionId: string | null;
  roundName: string;
  checkedIn: boolean;
  checkedAt: string | null;
  isDemo: boolean;
  passed: boolean;
  certNo: string | null;
  lessonsDone: number;
  totalLessons: number;
  preScore: number | null;
  postScore: number | null;
};

export function AttendeesManager({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [tabFilter, setTabFilter] = useState<"active" | "checked" | "not_checked" | "passed" | "trash">("active");
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // Manual Add Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedSessionForAdd, setSelectedSessionForAdd] = useState<string>("");
  const [autoCheckInOnAdd, setAutoCheckInOnAdd] = useState(false);
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [classroomHubOpen, setClassroomHubOpen] = useState(false);

  // Realtime live sync for attendees
  useEffect(() => {
    const channel = supabase
      .channel(`attendees-mgr-${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrollments",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [courseId, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-attendees", courseId],
    queryFn: async () => {
      const [
        { data: enr = [] },
        { data: atd = [] },
        { data: sess = [] },
        { data: lessons = [] },
        { data: att = [] },
        { data: certs = [] },
      ] = await Promise.all([
        supabase.from("enrollments").select("*").eq("course_id", courseId),
        supabase.from("attendance").select("*").eq("course_id", courseId),
        supabase.from("course_sessions").select("*").eq("course_id", courseId).order("round_no"),
        supabase.from("lessons").select("id").eq("course_id", courseId).is("deleted_at", null),
        supabase.from("test_attempts").select("user_id,kind,percent").eq("course_id", courseId),
        supabase.from("certificates").select("user_id,cert_no").eq("course_id", courseId),
      ]);

      const userIds = (enr ?? []).map((e) => e.user_id);
      const lessonIds = (lessons ?? []).map((l) => l.id);

      const [{ data: profiles = [] }, { data: prog = [] }] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("id,full_name,email,division,department,position").in("id", userIds)
          : Promise.resolve({ data: [] }),
        lessonIds.length > 0 && userIds.length > 0
          ? supabase.from("lesson_progress").select("user_id,lesson_id").in("lesson_id", lessonIds)
          : Promise.resolve({ data: [] }),
      ]);

      const smap = new Map((sess ?? []).map((s) => [s.id, `รอบที่ ${s.round_no}`]));
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const amap = new Map((atd ?? []).map((a) => [a.user_id, a]));

      const rows: AttendeeRow[] = (enr ?? []).map((e) => {
        const p = pmap.get(e.user_id);
        const a = amap.get(e.user_id);
        const attempts = (att ?? []).filter((x) => x.user_id === e.user_id);
        const pre = attempts.filter((x) => x.kind === "pre").map((x) => Number(x.percent));
        const post = attempts.filter((x) => x.kind === "post").map((x) => Number(x.percent));
        const cert = (certs ?? []).find((c) => c.user_id === e.user_id);
        const doneCount = new Set((prog ?? []).filter((x) => x.user_id === e.user_id).map((x) => x.lesson_id)).size;

        return {
          enrollmentId: e.id,
          userId: e.user_id,
          name: p?.full_name || "ไม่ระบุชื่อ",
          email: p?.email || "",
          division: p?.division || "ไม่ระบุฝ่าย",
          department: p?.department || "ไม่ระบุแผนก",
          position: p?.position || "-",
          enrolledAt: e.created_at,
          deletedAt: e.deleted_at,
          deletedBy: e.deleted_by,
          sessionId: e.session_id,
          roundName: (e.session_id && smap.get(e.session_id)) || "ไม่ระบุรอบ",
          checkedIn: !!a,
          checkedAt: a?.checked_at || null,
          isDemo: a?.is_demo || false,
          passed: !!cert,
          certNo: cert?.cert_no || null,
          lessonsDone: doneCount,
          totalLessons: lessonIds.length,
          preScore: pre.length > 0 ? (pre[0] ?? null) : null,
          postScore: post.length > 0 ? Math.max(...post) : null,
        };
      });

      return {
        rows,
        sessions: (sess as Session[]) ?? [],
        smap,
      };
    },
  });

  // Query for staff user search when adding manual attendee
  const { data: searchPeople = [] } = useQuery({
    queryKey: ["search-staff-for-enroll", userSearch],
    enabled: addModalOpen && userSearch.trim().length >= 2,
    queryFn: async () => {
      const q = userSearch.trim().toLowerCase();
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email,department,division,position")
        .eq("approved", true)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const refresh = () => {
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
    qc.invalidateQueries({ queryKey: ["course-report", courseId] });
  };

  const allRows = data?.rows ?? [];
  const sessions = data?.sessions ?? [];
  const smap = data?.smap ?? new Map();

  // Active (not soft deleted) vs Trash (soft deleted)
  const activeRows = allRows.filter((r) => !r.deletedAt);
  const trashRows = allRows.filter((r) => !!r.deletedAt);

  // Statistics
  const totalActive = activeRows.length;
  const totalChecked = activeRows.filter((r) => r.checkedIn).length;
  const totalNotChecked = totalActive - totalChecked;
  const totalPassed = activeRows.filter((r) => r.passed).length;
  const totalTrash = trashRows.length;

  const divisions = [...new Set(allRows.map((r) => r.division))];

  // Filtering
  const filteredRows = allRows.filter((r) => {
    // Tab filter
    if (tabFilter === "active" && r.deletedAt) return false;
    if (tabFilter === "trash" && !r.deletedAt) return false;
    if (tabFilter === "checked" && (r.deletedAt || !r.checkedIn)) return false;
    if (tabFilter === "not_checked" && (r.deletedAt || r.checkedIn)) return false;
    if (tabFilter === "passed" && (r.deletedAt || !r.passed)) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Session filter
    if (sessionFilter !== "all" && r.sessionId !== sessionFilter) return false;

    // Division filter
    if (divisionFilter !== "all" && r.division !== divisionFilter) return false;

    return true;
  });

  // Action: Single Check-in
  async function handleCheckIn(row: AttendeeRow) {
    setActionLoading(true);
    try {
      const { data: res, error } = await supabase.rpc("staff_check_in", {
        _course: courseId,
        _user: row.userId,
        ...(row.sessionId ? { _session: row.sessionId } : {}),
      });
      if (error) throw error;
      toast.success(`เช็คชื่อคุณ ${row.name} สำเร็จแล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เช็คชื่อไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Undo Check-in
  async function handleRemoveAttendance(row: AttendeeRow) {
    if (!confirm(`ต้องการยกเลิกการเช็คชื่อของคุณ ${row.name} หรือไม่?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("staff_remove_attendance", {
        _course: courseId,
        _user: row.userId,
      });
      if (error) throw error;
      toast.success(`ยกเลิกการเช็คชื่อคุณ ${row.name} แล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Soft Delete
  async function handleSoftDelete(row: AttendeeRow) {
    if (!confirm(`ต้องการลบรายชื่อคุณ ${row.name} ย้ายไปยังถังขยะหรือไม่?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("staff_soft_delete_enrollment", {
        _course: courseId,
        _user: row.userId,
      });
      if (error) throw error;
      toast.success(`ย้ายรายชื่อคุณ ${row.name} ไปยังถังขยะแล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Restore
  async function handleRestore(row: AttendeeRow) {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("staff_restore_enrollment", {
        _course: courseId,
        _user: row.userId,
      });
      if (error) throw error;
      toast.success(`กู้คืนรายชื่อคุณ ${row.name} สำเร็จแล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Hard Delete
  async function handleHardDelete(row: AttendeeRow) {
    if (!confirm(`คำเตือน: คุณต้องการลบรายชื่อคุณ ${row.name} ถาวรใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("enrollments").delete().eq("id", row.enrollmentId);
      if (error) throw error;
      toast.success(`ลบรายชื่อคุณ ${row.name} ถาวรแล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบถาวรไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Change Session
  async function handleChangeSession(row: AttendeeRow, newSessionId: string | null) {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({ session_id: newSessionId || null })
        .eq("id", row.enrollmentId);
      if (error) throw error;

      // Also update attendance if attendee was checked in
      if (row.checkedIn) {
        await supabase
          .from("attendance")
          .update({ session_id: newSessionId || null })
          .eq("course_id", courseId)
          .eq("user_id", row.userId);
      }

      toast.success(`เปลี่ยนรอบอบรมของคุณ ${row.name} แล้ว`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เปลี่ยนรอบไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Manual Enroll User
  async function handleEnrollNewUser(userId: string) {
    setAddingUser(userId);
    try {
      const { error } = await supabase.rpc("staff_enroll_user", {
        _course: courseId,
        _user: userId,
        _session: selectedSessionForAdd || null,
      });
      if (error) throw error;

      if (autoCheckInOnAdd) {
        await supabase.rpc("staff_check_in", {
          _course: courseId,
          _user: userId,
          ...(selectedSessionForAdd ? { _session: selectedSessionForAdd } : {}),
        });
        toast.success("ลงทะเบียนและเช็คชื่อสำเร็จแล้ว");
      } else {
        toast.success("เพิ่มรายชื่อผู้ลงทะเบียนสำเร็จแล้ว");
      }
      refresh();
      setAddModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เพิ่มผู้ลงทะเบียนไม่สำเร็จ");
    } finally {
      setAddingUser(null);
    }
  }

  // Bulk: Check-in selected
  async function handleBulkCheckIn() {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    let success = 0;
    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.userId));
    for (const r of selectedRows) {
      if (r.checkedIn || r.deletedAt) continue;
      try {
        await supabase.rpc("staff_check_in", {
          _course: courseId,
          _user: r.userId,
          ...(r.sessionId ? { _session: r.sessionId } : {}),
        });
        success++;
      } catch {
        // continue
      }
    }
    toast.success(`เช็คชื่อผู้เข้าอบรม ${success} คนเรียบร้อย`);
    setActionLoading(false);
    refresh();
  }

  // Bulk: Soft Delete selected
  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`ต้องการย้ายรายชื่อที่เลือก ${selectedIds.size} คนไปยังถังขยะหรือไม่?`)) return;
    setActionLoading(true);
    let success = 0;
    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.userId));
    for (const r of selectedRows) {
      try {
        await supabase.rpc("staff_soft_delete_enrollment", {
          _course: courseId,
          _user: r.userId,
        });
        success++;
      } catch {
        // continue
      }
    }
    toast.success(`ย้ายรายชื่อ ${success} คนไปยังถังขยะแล้ว`);
    setActionLoading(false);
    refresh();
  }

  // Export Attendees to Excel
  function exportAttendeesExcel() {
    const wb = XLSX.utils.book_new();
    const rows = filteredRows.map((r, i) => [
      i + 1,
      r.name,
      r.email,
      r.position,
      r.division,
      r.department,
      r.roundName,
      r.checkedIn ? "เช็คชื่อแล้ว (On-site)" : "ออนไลน์ / ยังไม่เช็คชื่อ",
      r.checkedAt ? new Date(r.checkedAt).toLocaleString("th-TH") : "-",
      `${r.lessonsDone}/${r.totalLessons}`,
      r.preScore ?? "-",
      r.postScore ?? "-",
      r.passed ? "ผ่าน" : "ไม่ผ่าน",
      r.certNo || "-",
      r.deletedAt ? "ถูกลบชั่วคราว" : "ปกติ",
    ]);

    const header = [
      "ลำดับ",
      "ชื่อ-นามสกุล",
      "อีเมล",
      "ตำแหน่ง",
      "ฝ่าย",
      "แผนก",
      "รอบอบรม",
      "สถานะเช็คชื่อ",
      "เวลาเช็คชื่อ",
      "บทเรียนที่ผ่าน",
      "ก่อนเรียน (%)",
      "หลังเรียน (%)",
      "ผลประเมิน",
      "เลขใบประกาศ",
      "สถานะการลงทะเบียน",
    ];

    const ws = XLSX.utils.aoa_to_sheet([["รายงานรายชื่อผู้ลงทะเบียนอบรม"], [], header, ...rows]);
    ws["!cols"] = [6, 26, 30, 18, 24, 26, 14, 18, 20, 14, 12, 12, 12, 18, 16].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อผู้ลงทะเบียน");
    XLSX.writeFile(wb, `รายชื่อผู้ลงทะเบียน-${courseId}.xlsx`);
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.userId)));
    }
  };

  const toggleSelectOne = (userId: string) => {
    const next = new Set(selectedIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview & KPI Badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-muted-foreground">ลงทะเบียนทั้งหมด</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{totalActive}</div>
          <div className="text-[11px] text-muted-foreground">คนที่มีสิทธิ์เรียน</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-primary">เช็คชื่อแล้ว (On-site)</div>
          <div className="mt-1 text-2xl font-bold text-primary">{totalChecked}</div>
          <div className="text-[11px] text-muted-foreground">
            {totalActive > 0 ? Math.round((totalChecked / totalActive) * 100) : 0}% ของผู้เรียน
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-amber">ยังไม่เช็คชื่อ</div>
          <div className="mt-1 text-2xl font-bold text-amber">{totalNotChecked}</div>
          <div className="text-[11px] text-muted-foreground">เรียนออนไลน์/รอเข้าห้อง</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-mint-deep">สอบผ่านเกณฑ์</div>
          <div className="mt-1 text-2xl font-bold text-mint-deep">{totalPassed}</div>
          <div className="text-[11px] text-muted-foreground">
            {totalActive > 0 ? Math.round((totalPassed / totalActive) * 100) : 0}% ผ่านเกณฑ์
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-coral">ถังขยะ / ถูกลบ</div>
          <div className="mt-1 text-2xl font-bold text-coral">{totalTrash}</div>
          <div className="text-[11px] text-muted-foreground">กู้คืนรายชื่อได้ตลอด</div>
        </div>
      </div>

      {/* 2. Controls & Actions Bar */}
      <div className="glass space-y-4 rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-mist p-1 text-xs">
            <button
              onClick={() => setTabFilter("active")}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${tabFilter === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              รายชื่อทั้งหมด ({totalActive})
            </button>
            <button
              onClick={() => setTabFilter("checked")}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${tabFilter === "checked" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              เช็คชื่อแล้ว ({totalChecked})
            </button>
            <button
              onClick={() => setTabFilter("not_checked")}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${tabFilter === "not_checked" ? "bg-card text-amber shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              ยังไม่เช็คชื่อ ({totalNotChecked})
            </button>
            <button
              onClick={() => setTabFilter("passed")}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${tabFilter === "passed" ? "bg-card text-mint-deep shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              สอบผ่านแล้ว ({totalPassed})
            </button>
            <button
              onClick={() => setTabFilter("trash")}
              className={`rounded-xl px-3 py-1.5 font-medium transition ${tabFilter === "trash" ? "bg-card text-destructive shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              ถังขยะ ({totalTrash})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setClassroomHubOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold hover:from-teal-700 hover:to-emerald-700 shadow-sm cursor-pointer"
            >
              <Monitor className="size-4" />
              ศูนย์หน้าห้องอบรม (Kiosk & Projector)
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)} className="gap-1.5">
              <UserPlus className="size-4" />
              เพิ่มผู้ลงทะเบียน
            </Button>
            <Button size="sm" variant="outline" onClick={exportAttendeesExcel} className="gap-1.5">
              <Download className="size-4" />
              ส่งออก Excel
            </Button>
          </div>
        </div>

        {/* Search & Select Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, อีเมล, แผนก, ตำแหน่ง..."
              className={`${inp} pl-9`}
            />
          </div>

          {sessions.length > 0 && (
            <div className="sm:col-span-3">
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className={inp}
              >
                <option value="all">ทุกรอบอบรม</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    รอบที่ {s.round_no} ({s.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={sessions.length > 0 ? "sm:col-span-3" : "sm:col-span-6"}>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className={inp}
            >
              <option value="all">ทุกฝ่ายงาน</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (when rows are selected) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/10 px-4 py-2.5 text-xs text-primary">
            <div className="font-semibold">
              เลือกแล้ว {selectedIds.size} คน จากทั้งหมด {filteredRows.length} คน
            </div>
            <div className="flex items-center gap-2">
              {tabFilter !== "trash" ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs gap-1"
                    onClick={handleBulkCheckIn}
                    disabled={actionLoading}
                  >
                    <UserCheck className="size-3.5" />
                    เช็คอินคนที่เลือก
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleBulkSoftDelete}
                    disabled={actionLoading}
                  >
                    <Trash2 className="size-3.5" />
                    ย้ายไปถังขยะ
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-mint-deep hover:bg-mint/10"
                  onClick={async () => {
                    setActionLoading(true);
                    for (const id of selectedIds) {
                      await supabase.rpc("staff_restore_enrollment", { _course: courseId, _user: id });
                    }
                    setActionLoading(false);
                    toast.success("กู้คืนรายชื่อที่เลือกแล้ว");
                    refresh();
                  }}
                  disabled={actionLoading}
                >
                  <RotateCcw className="size-3.5" />
                  กู้คืนรายชื่อที่เลือก
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Attendees Table */}
      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-glass-border bg-mist/60 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-glass-border text-primary focus:ring-primary"
                  />
                </th>
                <th className="w-12 px-2 py-3 text-center">ลำดับ</th>
                <th className="px-4 py-3">ผู้เข้ารับการอบรม</th>
                <th className="px-3 py-3">ฝ่าย / แผนก</th>
                {sessions.length > 0 && <th className="px-3 py-3">รอบอบรม</th>}
                <th className="px-3 py-3 text-center">สถานะการเช็คชื่อ</th>
                <th className="px-3 py-3 text-center">การเรียน / ประเมิน</th>
                <th className="px-4 py-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-6 animate-spin text-primary" />
                    กำลังโหลดข้อมูลผู้ลงทะเบียน...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                    <p className="font-medium text-foreground">ไม่พบรายชื่อผู้ลงทะเบียน</p>
                    <p className="mt-1 text-[11px]">
                      {tabFilter === "trash"
                        ? "ไม่มีรายชื่อที่ถูกลบในถังขยะ"
                        : "ลองเปลี่ยนคำค้นหา หรือกดปุ่ม 'เพิ่มผู้ลงทะเบียน' ด้านบน"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={`transition hover:bg-mist/30 ${selectedIds.has(r.userId) ? "bg-primary/5" : ""} ${r.deletedAt ? "opacity-60 bg-coral/5" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.userId)}
                        onChange={() => toggleSelectOne(r.userId)}
                        className="rounded border-glass-border text-primary focus:ring-primary"
                      />
                    </td>

                    {/* Number */}
                    <td className="px-2 py-3 text-center font-medium text-muted-foreground">{i + 1}</td>

                    {/* Trainee Info */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.position}</div>
                      <div className="text-[10px] text-muted-foreground/80">{r.email}</div>
                    </td>

                    {/* Department */}
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{r.division}</div>
                      <div className="text-[11px] text-muted-foreground">{r.department}</div>
                    </td>

                    {/* Training Session Selector */}
                    {sessions.length > 0 && (
                      <td className="px-3 py-3">
                        {!r.deletedAt ? (
                          <select
                            value={r.sessionId || ""}
                            onChange={(e) => handleChangeSession(r, e.target.value || null)}
                            disabled={actionLoading}
                            className="rounded-lg border bg-card px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">ไม่ระบุรอบ</option>
                            {sessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                รอบที่ {s.round_no}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-muted-foreground">{r.roundName}</span>
                        )}
                      </td>
                    )}

                    {/* Check-in Status */}
                    <td className="px-3 py-3 text-center">
                      {r.checkedIn ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 rounded-full border border-mint/40 bg-mint/15 px-2.5 py-0.5 text-[11px] font-semibold text-mint-deep">
                            <CheckCircle2 className="size-3" />
                            {r.isDemo ? "เช็คชื่อ (จำลอง)" : "เช็คชื่อแล้ว"}
                          </span>
                          {r.checkedAt && (
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                              {new Date(r.checkedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                            </span>
                          )}
                          {!r.deletedAt && (
                            <button
                              onClick={() => handleRemoveAttendance(r)}
                              className="mt-1 text-[10px] text-coral hover:underline"
                              disabled={actionLoading}
                            >
                              ยกเลิกการเช็คชื่อ
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-block text-[11px] text-muted-foreground">ยังไม่เช็คชื่อ</span>
                          {!r.deletedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckIn(r)}
                              disabled={actionLoading}
                              className="mt-1 h-6 border-primary/30 px-2 text-[10px] text-primary hover:bg-primary/10"
                            >
                              <UserCheck className="mr-1 size-3" />
                              เช็คอิน
                            </Button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Learning & Scores */}
                    <td className="px-3 py-3 text-center">
                      <div className="font-medium">
                        บทเรียน {r.lessonsDone}/{r.totalLessons}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.preScore != null ? `ก่อน: ${r.preScore}%` : ""}{" "}
                        {r.postScore != null ? `หลัง: ${r.postScore}%` : ""}
                      </div>
                      {r.passed && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-mint-deep">
                          <Award className="size-3" /> ผ่านเกณฑ์
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {!r.deletedAt ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSoftDelete(r)}
                          disabled={actionLoading}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="ลบรายชื่อผู้เรียน (ย้ายไปถังขยะ)"
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          ลบรายชื่อ
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(r)}
                            disabled={actionLoading}
                            className="h-7 border-mint/40 text-xs text-mint-deep hover:bg-mint/10"
                            title="กู้คืนรายชื่อผู้เรียน"
                          >
                            <RotateCcw className="mr-1 size-3.5" />
                            กู้คืน
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleHardDelete(r)}
                            disabled={actionLoading}
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            title="ลบถาวร"
                          >
                            ลบถาวร
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Manual Add Attendee Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UserPlus className="size-5 text-primary" />
              เพิ่มผู้ลงทะเบียนเข้าร่วมอบรม
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                ค้นหาบุคลากรในโรงพยาบาล (พิมพ์ชื่อ หรืออีเมล)
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร เช่น สมชาย, nurse..."
                  className={`${inp} pl-9`}
                  autoFocus
                />
              </div>
            </div>

            {sessions.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">เลือกรอบอบรม</label>
                <select
                  value={selectedSessionForAdd}
                  onChange={(e) => setSelectedSessionForAdd(e.target.value)}
                  className={inp}
                >
                  <option value="">ไม่ระบุรอบ (เรียนออนไลน์/ภาพรวม)</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      รอบที่ {s.round_no} ({s.location})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoCheckIn"
                checked={autoCheckInOnAdd}
                onChange={(e) => setAutoCheckInOnAdd(e.target.checked)}
                className="rounded border-glass-border text-primary focus:ring-primary"
              />
              <label htmlFor="autoCheckIn" className="text-xs font-medium text-foreground cursor-pointer">
                เช็คชื่อเข้าอบรมทันที (สำหรับผู้มาหน้างาน Walk-in)
              </label>
            </div>

            {/* Results List */}
            <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-glass-border divide-y divide-glass-border">
              {userSearch.trim().length < 2 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  กรุณาพิมพ์ชื่อหรืออีเมลเพื่อค้นหาบุคลากร
                </div>
              ) : searchPeople.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  ไม่พบบัญชีผู้ใช้งานที่ตรงกับคำค้นหา
                </div>
              ) : (
                searchPeople.map((p) => {
                  const isAlreadyEnrolled = allRows.some((r) => r.userId === p.id && !r.deletedAt);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 hover:bg-mist/40">
                      <div>
                        <div className="font-medium text-xs text-foreground">{p.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.position || "ไม่ระบุตำแหน่ง"} · {p.department} ({p.division})
                        </div>
                        <div className="text-[10px] text-muted-foreground/80">{p.email}</div>
                      </div>
                      <div>
                        {isAlreadyEnrolled ? (
                          <span className="text-[11px] text-muted-foreground">ลงทะเบียนแล้ว</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleEnrollNewUser(p.id)}
                            disabled={addingUser === p.id}
                            className="h-7 text-xs"
                          >
                            {addingUser === p.id ? <Loader2 className="size-3 animate-spin" /> : "เพิ่มเข้าอบรม"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* On-site Classroom Operations Hub Modal */}
      <ClassroomHubModal
        courseId={courseId}
        courseTitle="ศูนย์ปฏิบัติการอบรม On-site"
        open={classroomHubOpen}
        onClose={() => setClassroomHubOpen(false)}
        initialMode="projector"
      />
    </div>
  );
}
