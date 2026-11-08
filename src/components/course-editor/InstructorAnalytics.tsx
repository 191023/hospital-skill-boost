import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stat, Bar } from "@/components/AppShell";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  FileSpreadsheet, 
  Layers, 
  Award, 
  Lightbulb, 
  HelpCircle, 
  Filter, 
  Search,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Users,
  Sparkles,
  Bot,
  Copy,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { explainCourseMisconceptions } from "@/lib/ai.functions";
import { toast } from "sonner";

export type QuestionItemStat = {
  id: string;
  position: number;
  question: string;
  options: string[];
  correct_index: number;
  pre_total: number;
  pre_correct: number;
  pre_wrong: number;
  pre_error_rate: number;
  pre_accuracy: number;
  pre_options: Record<string, number>;
  post_total: number;
  post_correct: number;
  post_wrong: number;
  post_error_rate: number;
  post_accuracy: number;
  post_options: Record<string, number>;
  gain_pct: number;
};

type DeptGainStat = {
  division: string;
  department: string;
  enrolled: number;
  preCount: number;
  postCount: number;
  preAvg: number;
  postAvg: number;
  scoreGain: number;
  hakeGain: number; // Normalized gain g = (Post - Pre) / (100 - Pre)
  passCount: number;
  passRate: number;
  kpiStatus: "high" | "standard" | "needs_work";
};

const calcHakeGain = (pre: number, post: number): number => {
  if (post <= pre) return 0;
  if (pre >= 100) return 1;
  const g = (post - pre) / (100 - pre);
  return Math.round(g * 100) / 100;
};

export function InstructorAnalytics({ courseId }: { courseId: string }) {
  const [activeTab, setActiveTab] = useState<"items" | "departments">("items");
  const [itemMode, setItemMode] = useState<"pre" | "post" | "compare">("pre");
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [searchDept, setSearchDept] = useState<string>("");

  // AI Misconception Explainer State
  const explainFn = useServerFn(explainCourseMisconceptions);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleExplainWithAi() {
    setLoadingAi(true);
    setAiModalOpen(true);
    try {
      const res = await explainFn({ data: { courseId } });
      setAiReport(res.report);
    } catch (err) {
      toast.error((err as Error).message);
      setAiModalOpen(false);
    } finally {
      setLoadingAi(false);
    }
  }

  // 1. Fetch Item Analytics from server RPC
  const { data: itemStats = [], isLoading: loadingItems } = useQuery({
    queryKey: ["course-item-analytics", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_item_analytics", { _course: courseId });
      if (error) {
        console.error("Failed to load item analytics:", error);
        return [];
      }
      return (data as unknown as QuestionItemStat[]) || [];
    },
  });

  // 2. Fetch Department & Participant Data
  const { data: rawData, isLoading: loadingDepts } = useQuery({
    queryKey: ["course-analytics-depts", courseId],
    queryFn: async () => {
      const [{ data: enr }, { data: att }, { data: certs }, { data: sess }] = await Promise.all([
        supabase.from("enrollments").select("user_id,created_at,session_id").eq("course_id", courseId),
        supabase.from("test_attempts").select("user_id,kind,percent,passed").eq("course_id", courseId),
        supabase.from("certificates").select("user_id").eq("course_id", courseId),
        supabase.from("course_sessions").select("id,round_no,location").eq("course_id", courseId).order("round_no"),
      ]);

      const userIds = [...new Set((enr ?? []).map((e) => e.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id,full_name,division,department").in("id", userIds)
        : { data: [] };

      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const smap = new Map((sess ?? []).map((s) => [s.id, `รอบที่ ${s.round_no}`]));

      return {
        enrollments: enr ?? [],
        attempts: att ?? [],
        certs: certs ?? [],
        sessions: sess ?? [],
        pmap,
        smap,
      };
    },
  });

  // Department Aggregation
  const { deptStats, divisions, overallStats } = useMemo(() => {
    if (!rawData) {
      return {
        deptStats: [] as DeptGainStat[],
        divisions: [] as string[],
        overallStats: { preAvg: 0, postAvg: 0, overallGain: 0, hakeGain: 0, totalEnrolled: 0, passRate: 0 },
      };
    }

    const { enrollments, attempts, certs, pmap } = rawData;
    const certUsers = new Set(certs.map((c) => c.user_id));

    // Filter enrollments by session/round if selected
    const filteredEnr = enrollments.filter((e) => {
      if (selectedRound === "all") return true;
      return e.session_id === selectedRound;
    });

    const enrolledUserIds = new Set(filteredEnr.map((e) => e.user_id));

    // Group users by division and department
    const deptMap = new Map<string, { division: string; department: string; userIds: Set<string> }>();
    const divSet = new Set<string>();

    for (const e of filteredEnr) {
      const p = pmap.get(e.user_id);
      const div = p?.division || "ไม่ระบุฝ่าย";
      const dep = p?.department || "ไม่ระบุแผนก";
      divSet.add(div);
      const key = `${div}:::${dep}`;
      if (!deptMap.has(key)) {
        deptMap.set(key, { division: div, department: dep, userIds: new Set() });
      }
      deptMap.get(key)!.userIds.add(e.user_id);
    }

    const list: DeptGainStat[] = [];
    let sumPreAll = 0;
    let countPreAll = 0;
    let sumPostAll = 0;
    let countPostAll = 0;
    let passAll = 0;

    for (const { division, department, userIds } of deptMap.values()) {
      const uids = [...userIds];
      let preScores: number[] = [];
      let postScores: number[] = [];
      let passedDept = 0;

      for (const uid of uids) {
        if (certUsers.has(uid)) passedDept++;
        const userAtts = attempts.filter((a) => a.user_id === uid);
        const pre = userAtts.filter((a) => a.kind === "pre").map((a) => Number(a.percent));
        const post = userAtts.filter((a) => a.kind === "post").map((a) => Number(a.percent));
        if (pre.length) preScores.push(pre[0]!);
        if (post.length) postScores.push(Math.max(...post));
      }

      const preAvg = preScores.length ? Math.round((preScores.reduce((a, b) => a + b, 0) / preScores.length) * 10) / 10 : 0;
      const postAvg = postScores.length ? Math.round((postScores.reduce((a, b) => a + b, 0) / postScores.length) * 10) / 10 : 0;
      const scoreGain = Math.round((postAvg - preAvg) * 10) / 10;
      const hakeGain = calcHakeGain(preAvg, postAvg);
      const passRate = uids.length ? Math.round((passedDept / uids.length) * 1000) / 10 : 0;

      // Hospital KPI Benchmark Classification (HA / JCI Quality Standard)
      // High: Normalized Gain >= 0.70 or Post >= 85%
      // Standard: 0.30 <= Normalized Gain < 0.70 or Post >= 80%
      // Needs Work: Gain < 0.30 and Post < 80%
      let kpiStatus: "high" | "standard" | "needs_work" = "needs_work";
      if (hakeGain >= 0.7 || postAvg >= 85) {
        kpiStatus = "high";
      } else if (hakeGain >= 0.3 || postAvg >= 80) {
        kpiStatus = "standard";
      }

      list.push({
        division,
        department,
        enrolled: uids.length,
        preCount: preScores.length,
        postCount: postScores.length,
        preAvg,
        postAvg,
        scoreGain,
        hakeGain,
        passCount: passedDept,
        passRate,
        kpiStatus,
      });

      sumPreAll += preScores.reduce((a, b) => a + b, 0);
      countPreAll += preScores.length;
      sumPostAll += postScores.reduce((a, b) => a + b, 0);
      countPostAll += postScores.length;
      passAll += passedDept;
    }

    // Sort list by score gain descending
    list.sort((a, b) => b.scoreGain - a.scoreGain);

    const overallPreAvg = countPreAll ? Math.round((sumPreAll / countPreAll) * 10) / 10 : 0;
    const overallPostAvg = countPostAll ? Math.round((sumPostAll / countPostAll) * 10) / 10 : 0;
    const overallGain = Math.round((overallPostAvg - overallPreAvg) * 10) / 10;
    const overallHakeGain = calcHakeGain(overallPreAvg, overallPostAvg);
    const overallPassRate = enrolledUserIds.size ? Math.round((passAll / enrolledUserIds.size) * 1000) / 10 : 0;

    return {
      deptStats: list,
      divisions: [...divSet].sort((a, b) => a.localeCompare(b, "th")),
      overallStats: {
        preAvg: overallPreAvg,
        postAvg: overallPostAvg,
        overallGain,
        hakeGain: overallHakeGain,
        totalEnrolled: enrolledUserIds.size,
        passRate: overallPassRate,
      },
    };
  }, [rawData, selectedRound]);

  // Filtered department list by division & search
  const filteredDepts = useMemo(() => {
    return deptStats.filter((d) => {
      const matchDiv = selectedDivision === "all" || d.division === selectedDivision;
      const matchQuery = !searchDept || d.department.toLowerCase().includes(searchDept.toLowerCase());
      return matchDiv && matchQuery;
    });
  }, [deptStats, selectedDivision, searchDept]);

  // Top trickiest questions in Pre-test (error rate >= 40% or top 3)
  const trickyQuestions = useMemo(() => {
    return [...itemStats]
      .filter((q) => q.pre_total > 0)
      .sort((a, b) => b.pre_error_rate - a.pre_error_rate)
      .slice(0, 3);
  }, [itemStats]);

  // CSV Export for HA / JCI Accreditation Report
  const exportKpiCsv = () => {
    if (!filteredDepts.length) {
      toast.error("ไม่มีข้อมูลแผนกสำหรับส่งออก");
      return;
    }
    const headers = [
      "ฝ่าย",
      "แผนก",
      "จำนวนผู้เรียน (คน)",
      "คะแนนก่อนเรียนเฉลี่ย (%)",
      "คะแนนหลังเรียนเฉลี่ย (%)",
      "พัฒนาการความรู้ (Score Gain %)",
      "Normalized Gain (g)",
      "อัตราการผ่านเกณฑ์ (%)",
      "ระดับคุณภาพ KPI (HA/JCI)",
    ];
    const rows = filteredDepts.map((d) => [
      d.division,
      d.department,
      String(d.enrolled),
      String(d.preAvg),
      String(d.postAvg),
      `+${d.scoreGain}%`,
      String(d.hakeGain),
      `${d.passRate}%`,
      d.kpiStatus === "high" ? "ระดับสูง (High Gain)" : d.kpiStatus === "standard" ? "ระดับมาตรฐาน" : "ต้องติดตามพัฒนา",
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hospital-kpi-learning-gain-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("ส่งออกข้อมูล KPI สำเร็จ");
  };

  const choiceChars = "กขคงจฉชซฌญ";

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Highlights */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat 
          label="คะแนนเฉลี่ยก่อนเรียน" 
          value={`${overallStats.preAvg}%`} 
          note="Pre-test Baseline" 
          tone="primary" 
        />
        <Stat 
          label="คะแนนเฉลี่ยหลังเรียน" 
          value={`${overallStats.postAvg}%`} 
          note={`เพิ่มขึ้น +${overallStats.overallGain}%`} 
          tone="mint" 
        />
        <Stat 
          label="Normalized Gain (g)" 
          value={String(overallStats.hakeGain)} 
          note={
            overallStats.hakeGain >= 0.7 
              ? "🌟 ประสิทธิภาพระดับสูง (HA/JCI High)" 
              : overallStats.hakeGain >= 0.3 
                ? "✓ ผ่านเกณฑ์มาตรฐาน" 
                : "ควรปรับปรุงการสอน"
          } 
          tone={overallStats.hakeGain >= 0.7 ? "mint" : overallStats.hakeGain >= 0.3 ? "amber" : "coral"} 
        />
        <Stat 
          label="อัตราผ่านเกณฑ์รวม" 
          value={`${overallStats.passRate}%`} 
          note={`${overallStats.totalEnrolled} บุคลากรลงทะเบียน`} 
          tone="mint" 
        />
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "items"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass hover:bg-card text-foreground/80"
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            <span>วิเคราะห์ข้อสอบรายข้อ (Item Analysis)</span>
            {itemStats.length > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                {itemStats.length} ข้อ
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("departments")}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === "departments"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass hover:bg-card text-foreground/80"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>เปรียบเทียบ Pre vs Post Gain รายแผนก (KPI HA/JCI)</span>
            {deptStats.length > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                {deptStats.length} แผนก
              </span>
            )}
          </button>
        </div>

        {activeTab === "departments" && (
          <button
            onClick={exportKpiCsv}
            className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass px-3.5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>ส่งออกตาราง KPI (Excel / CSV)</span>
          </button>
        )}
      </div>

      {/* TAB 1: QUESTION ITEM ANALYSIS */}
      {activeTab === "items" && (
        <div className="space-y-6">
          {/* Instructor Alert for Top Tricky Questions */}
          {trickyQuestions.length > 0 && (
            <div className="rounded-3xl border border-coral/30 bg-coral/10 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-coral/20 p-2 text-coral">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-coral text-base">
                      จุดอ่อนสำคัญที่คนตอบผิดมากที่สุดก่อนเรียน (Pre-test Error Focus)
                    </h3>
                    <button
                      type="button"
                      onClick={handleExplainWithAi}
                      className="flex items-center gap-1.5 rounded-xl bg-coral px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-all cursor-pointer"
                    >
                      <Sparkles className="size-3.5" />
                      <span>🤖 ให้ AI วิเคราะห์จุดบอดและร่างสคริปต์การสอน</span>
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    วิทยากรควรให้ความสำคัญและเน้นย้ำจุดประเด็นเหล่านี้เป็นพิเศษในชั้นเรียน เพื่อช่วยแก้ไขความเข้าใจผิดของบุคลากร
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {trickyQuestions.map((q, idx) => (
                      <div key={q.id} className="rounded-2xl border border-coral/20 bg-background/80 p-3 shadow-sm">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-coral">อันดับ {idx + 1} (ข้อที่ {q.position})</span>
                          <span className="rounded-full bg-coral/15 px-2 py-0.5 font-bold text-coral">
                            ตอบผิด {q.pre_error_rate}%
                          </span>
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-xs font-medium text-foreground">
                          {q.question}
                        </div>
                        <div className="mt-2 text-[11px] text-mint flex items-center gap-1 font-semibold">
                          <span>คำตอบที่ถูก:</span>
                          <span className="truncate">{choiceChars[q.correct_index]}. {q.options[q.correct_index]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Item Mode Filter Toolbar */}
          <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setItemMode("pre")}
                className={`rounded-xl px-3.5 py-1.5 font-semibold transition-all ${
                  itemMode === "pre" ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-card"
                }`}
              >
                🔴 สถิติก่อนเรียน (Pre-test Error Focus)
              </button>
              <button
                onClick={() => setItemMode("post")}
                className={`rounded-xl px-3.5 py-1.5 font-semibold transition-all ${
                  itemMode === "post" ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-card"
                }`}
              >
                🟢 สถิติหลังเรียน (Post-test Assessment)
              </button>
              <button
                onClick={() => setItemMode("compare")}
                className={`rounded-xl px-3.5 py-1.5 font-semibold transition-all ${
                  itemMode === "compare" ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-card"
                }`}
              >
                📊 พัฒนาการเปรียบเทียบ (Pre vs Post Gain)
              </button>
            </div>
            <div className="text-xs text-muted-foreground pr-2">
              เรียงตามลำดับข้อสอบในระบบ ({itemStats.length} ข้อ)
            </div>
          </div>

          {/* Question Items List */}
          {loadingItems ? (
            <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
              กำลังวิเคราะห์สถิติข้อสอบ...
            </div>
          ) : itemStats.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีข้อมูลข้อสอบหรือยังไม่มีผู้ทำแบบทดสอบในหลักสูตรนี้
            </div>
          ) : (
            <div className="space-y-4">
              {itemStats.map((item, idx) => {
                const isHighPreError = item.pre_error_rate >= 40;
                const isGreatGain = item.gain_pct >= 30;

                return (
                  <div 
                    key={item.id} 
                    className={`glass rounded-3xl p-5 transition-all ${
                      isHighPreError && itemMode === "pre" 
                        ? "border-coral/40 bg-coral/5" 
                        : "border-glass-border"
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                            ข้อที่ {item.position || idx + 1}
                          </span>
                          {isHighPreError && (
                            <span className="flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-0.5 text-xs font-semibold text-coral">
                              <AlertTriangle className="h-3 w-3" />
                              ข้อที่คนตอบผิดสูง ({item.pre_error_rate}%)
                            </span>
                          )}
                          {isGreatGain && (
                            <span className="flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">
                              <TrendingUp className="h-3 w-3" />
                              พัฒนาการดีเยี่ยม (+{item.gain_pct}%)
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-base font-bold text-foreground">
                          {item.question}
                        </h4>
                      </div>

                      {/* Stat Metrics Box */}
                      <div className="flex items-center gap-2 text-right">
                        {itemMode === "pre" && (
                          <div className="rounded-2xl border border-glass-border bg-card/60 p-3">
                            <div className="text-[11px] text-muted-foreground">อัตราตอบผิดก่อนเรียน</div>
                            <div className={`text-xl font-extrabold ${isHighPreError ? "text-coral" : "text-foreground"}`}>
                              {item.pre_error_rate}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              (ผิด {item.pre_wrong} / {item.pre_total} คน)
                            </div>
                          </div>
                        )}

                        {itemMode === "post" && (
                          <div className="rounded-2xl border border-glass-border bg-card/60 p-3">
                            <div className="text-[11px] text-muted-foreground">อัตราตอบถูกหลังเรียน</div>
                            <div className="text-xl font-extrabold text-mint">
                              {item.post_accuracy}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              (ถูก {item.post_correct} / {item.post_total} คน)
                            </div>
                          </div>
                        )}

                        {itemMode === "compare" && (
                          <div className="flex items-center gap-2">
                            <div className="rounded-2xl border border-glass-border bg-card/60 p-2.5 text-center">
                              <div className="text-[10px] text-muted-foreground">ก่อนเรียน</div>
                              <div className="text-base font-bold text-primary">{item.pre_accuracy}%</div>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="rounded-2xl border border-glass-border bg-card/60 p-2.5 text-center">
                              <div className="text-[10px] text-muted-foreground">หลังเรียน</div>
                              <div className="text-base font-bold text-mint">{item.post_accuracy}%</div>
                            </div>
                            <div className="rounded-2xl border border-mint/30 bg-mint/10 p-2.5 text-center">
                              <div className="text-[10px] text-muted-foreground">พัฒนาการ</div>
                              <div className="text-base font-bold text-mint">+{item.gain_pct}%</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Options Distractor Analysis */}
                    <div className="mt-4 border-t border-glass-border/60 pt-4 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                        <span>การกระจายของคำตอบ (Distractor Analysis)</span>
                        <span>{itemMode === "post" ? "ผู้สอบหลังเรียน" : "ผู้สอบก่อนเรียน"} ({itemMode === "post" ? item.post_total : item.pre_total} คน)</span>
                      </div>
                      
                      <div className="space-y-2">
                        {item.options.map((opt, oi) => {
                          const isCorrect = oi === item.correct_index;
                          const count = itemMode === "post" 
                            ? Number(item.post_options?.[oi] ?? 0)
                            : Number(item.pre_options?.[oi] ?? 0);
                          const total = itemMode === "post" ? item.post_total : item.pre_total;
                          const optPct = total > 0 ? Math.round((count / total) * 100) : 0;

                          return (
                            <div 
                              key={oi} 
                              className={`rounded-2xl border p-2.5 text-xs transition-all ${
                                isCorrect 
                                  ? "border-mint/40 bg-mint/10 font-medium" 
                                  : optPct > 20 && !isCorrect
                                    ? "border-amber/40 bg-amber/5 font-medium" 
                                    : "border-glass-border bg-card/40"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                    isCorrect ? "bg-mint text-primary-foreground" : "bg-muted text-muted-foreground"
                                  }`}>
                                    {choiceChars[oi]}
                                  </span>
                                  <span className={isCorrect ? "font-bold text-mint" : "text-foreground"}>
                                    {opt}
                                  </span>
                                  {isCorrect && (
                                    <span className="flex items-center gap-1 rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-bold text-mint">
                                      <CheckCircle2 className="h-3 w-3" /> คำตอบที่ถูกต้อง
                                    </span>
                                  )}
                                  {optPct > 25 && !isCorrect && (
                                    <span className="rounded-full bg-amber/20 px-2 py-0.5 text-[10px] font-semibold text-amber">
                                      ตัวลวงที่คนสับสนบ่อย
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                  <span className="font-bold text-foreground">{optPct}%</span>
                                  <span className="text-muted-foreground text-[10px]">({count} คน)</span>
                                </div>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isCorrect ? "bg-mint" : optPct > 25 ? "bg-amber" : "bg-primary/50"
                                  }`} 
                                  style={{ width: `${optPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRE VS POST TEST GAIN BY DEPARTMENT (HOSPITAL QUALITY KPI HA/JCI) */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          {/* HA / JCI Quality Standard Legend Banner */}
          <div className="glass rounded-3xl p-5 border border-glass-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span>เกณฑ์ชี้วัดมาตรฐานคุณภาพโรงพยาบาล (HA / JCI Quality KPI)</span>
                    <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-[11px] font-bold text-mint">
                      Hake's Normalized Learning Gain
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ประเมินประสิทธิผลของการอบรมด้วยอัตราการเพิ่มพูนความรู้สัมพัทธ์ (Relative Knowledge Gain) ตามข้อกำหนดมาตรฐานการพัฒนาบุคลากร
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 rounded-xl border border-mint/30 bg-mint/10 px-3 py-1.5 text-mint font-semibold">
                  <span className="h-2 w-2 rounded-full bg-mint" />
                  <span>ระดับสูง (High Gain: g ≥ 0.70 หรือ Post ≥ 85%)</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-amber/30 bg-amber/10 px-3 py-1.5 text-amber font-semibold">
                  <span className="h-2 w-2 rounded-full bg-amber" />
                  <span>ระดับมาตรฐาน (Standard: 0.30 ≤ g &lt; 0.70)</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/10 px-3 py-1.5 text-coral font-semibold">
                  <span className="h-2 w-2 rounded-full bg-coral" />
                  <span>ต้องติดตาม (Needs Work: g &lt; 0.30)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Round Filter */}
            {rawData?.sessions && rawData.sessions.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">รอบการอบรม</label>
                <select
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(e.target.value)}
                  className="w-full glass rounded-2xl px-3 py-2 text-sm outline-none border border-glass-border"
                >
                  <option value="all">ทุกรอบอบรม</option>
                  {rawData.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      รอบที่ {s.round_no} {s.location ? `(${s.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Division Filter */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">สายงาน / ฝ่าย</label>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full glass rounded-2xl px-3 py-2 text-sm outline-none border border-glass-border"
              >
                <option value="all">ทุกฝ่ายงาน ({divisions.length} ฝ่าย)</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Department */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">ค้นหาแผนก</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อแผนก..."
                  value={searchDept}
                  onChange={(e) => setSearchDept(e.target.value)}
                  className="w-full glass rounded-2xl pl-9 pr-3 py-2 text-sm outline-none border border-glass-border"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Department Gain List / Cards */}
          {loadingDepts ? (
            <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
              กำลังประมวลผลสถิติรายแผนก...
            </div>
          ) : filteredDepts.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
              ไม่พบข้อมูลแผนกตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDepts.map((dept) => {
                const isHigh = dept.kpiStatus === "high";
                const isStandard = dept.kpiStatus === "standard";

                return (
                  <div
                    key={`${dept.division}-${dept.department}`}
                    className="glass rounded-3xl p-5 border border-glass-border hover:shadow-md transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {dept.division}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isHigh
                                ? "bg-mint/15 text-mint"
                                : isStandard
                                ? "bg-amber/15 text-amber"
                                : "bg-coral/15 text-coral"
                            }`}
                          >
                            {isHigh ? "🌟 บรรลุเกณฑ์ระดับสูง" : isStandard ? "✓ ผ่านเกณฑ์มาตรฐาน" : "⚠️ ต้องติดตามประเมินซ้ำ"}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-base font-bold text-foreground flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{dept.department}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            ({dept.enrolled} คนเข้าอบรม)
                          </span>
                        </h4>
                      </div>

                      {/* Score Metrics summary */}
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-[11px] text-muted-foreground">พัฒนาการ (Gain)</div>
                          <div className="text-lg font-extrabold text-mint">
                            +{dept.scoreGain}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Hake's g = {dept.hakeGain}
                          </div>
                        </div>

                        <div className="border-l border-glass-border pl-3">
                          <div className="text-[11px] text-muted-foreground">ผ่านเกณฑ์</div>
                          <div className="text-lg font-extrabold text-primary">
                            {dept.passRate}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            ({dept.passCount}/{dept.enrolled} คน)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pre vs Post Dual Bar Chart */}
                    <div className="mt-4 border-t border-glass-border/60 pt-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {/* Pre-test score bar */}
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>ก่อนเรียน (Pre-test)</span>
                            <span className="font-bold text-primary">{dept.preAvg}%</span>
                          </div>
                          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted/30">
                            <div 
                              className="h-full rounded-full bg-primary/70 transition-all duration-500" 
                              style={{ width: `${Math.min(dept.preAvg, 100)}%` }} 
                            />
                          </div>
                        </div>

                        {/* Post-test score bar */}
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>หลังเรียน (Post-test)</span>
                            <span className="font-bold text-mint">{dept.postAvg}%</span>
                          </div>
                          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted/30">
                            <div 
                              className="h-full rounded-full bg-mint transition-all duration-500" 
                              style={{ width: `${Math.min(dept.postAvg, 100)}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Department Table for QA Documentation */}
          <div className="glass overflow-x-auto rounded-3xl p-6 border border-glass-border mt-6">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>ตารางสรุปข้อมูลตัวชี้วัดคุณภาพรายแผนก (Hospital QA / JCI Documentation)</span>
            </h4>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-glass-border">
                <tr>
                  <th className="py-2.5 font-semibold">ฝ่าย</th>
                  <th className="font-semibold">แผนก</th>
                  <th className="text-center font-semibold">ผู้เรียน (N)</th>
                  <th className="text-center font-semibold">ก่อนเรียน (Pre)</th>
                  <th className="text-center font-semibold">หลังเรียน (Post)</th>
                  <th className="text-center font-semibold">Gain (Δ)</th>
                  <th className="text-center font-semibold">Hake's g</th>
                  <th className="text-center font-semibold">อัตราผ่าน (%)</th>
                  <th className="text-right font-semibold">สถานะ KPI</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepts.map((d) => (
                  <tr key={`${d.division}-${d.department}`} className="border-b border-glass-border/40 hover:bg-card/40">
                    <td className="py-3 text-xs text-muted-foreground">{d.division}</td>
                    <td className="font-medium text-foreground">{d.department}</td>
                    <td className="text-center text-xs">{d.enrolled}</td>
                    <td className="text-center text-xs font-semibold text-primary">{d.preAvg}%</td>
                    <td className="text-center text-xs font-semibold text-mint">{d.postAvg}%</td>
                    <td className="text-center text-xs font-bold text-mint">+{d.scoreGain}%</td>
                    <td className="text-center text-xs font-mono font-bold">{d.hakeGain}</td>
                    <td className="text-center text-xs font-semibold">{d.passRate}%</td>
                    <td className="text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          d.kpiStatus === "high"
                            ? "bg-mint/15 text-mint"
                            : d.kpiStatus === "standard"
                            ? "bg-amber/15 text-amber"
                            : "bg-coral/15 text-coral"
                        }`}
                      >
                        {d.kpiStatus === "high" ? "ระดับสูง" : d.kpiStatus === "standard" ? "มาตรฐาน" : "ติดตาม"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Misconception Explainer Modal Dialog */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass max-h-[90vh] w-full max-w-3xl flex flex-col rounded-3xl border border-glass-border shadow-2xl overflow-hidden bg-card/95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-glass-border p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-2xl bg-coral/15 text-coral">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">
                    บทวิเคราะห์จุดบอดและสคริปต์การสอน (AI Teaching Copilot)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    วิเคราะห์เจาะลึกสาเหตุที่ผู้เรียนตอบผิดและประเด็นที่วิทยากรควรเน้นย้ำในคลาส
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground transition-all"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 text-sm space-y-4">
              {loadingAi ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <RefreshCw className="size-10 animate-spin text-coral" />
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-base">
                      AI กำลังวิเคราะห์สถิติข้อสอบและร่างแนวทางการสอน...
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      ประมวลผลข้อสอบที่ผู้เรียนตอบผิดมากที่สุด ความถี่ของตัวลวง และสังเคราะห์สคริปต์เปิดประเด็นในห้องเรียน
                    </p>
                  </div>
                </div>
              ) : aiReport ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                  {aiReport}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  ไม่พบข้อมูลบทวิเคราะห์
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {aiReport && !loadingAi && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border p-4 bg-mist/30">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-mint" />
                  <span>วิเคราะห์อ้างอิงจากข้อมูลสถิติจริงของผู้เรียนในหลักสูตรนี้</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (aiReport) {
                        navigator.clipboard.writeText(aiReport);
                        setCopied(true);
                        toast.success("คัดลอกสคริปต์เรียบร้อยแล้ว");
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card/80 transition-all shadow-sm"
                  >
                    {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                    <span>{copied ? "คัดลอกแล้ว" : "คัดลอกสคริปต์"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiModalOpen(false)}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-all"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
