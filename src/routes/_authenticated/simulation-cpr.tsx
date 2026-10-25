import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CprWorkflowSimulation } from "@/components/simulation/CprWorkflowSimulation";
import { ArrowLeft, BookOpen, HeartPulse, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/simulation-cpr")({
  head: () => ({
    meta: [
      { title: "3D CPR & AED Workflow Simulator — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "แบบจำลอง 3 มิติลำดับขั้นตอนการช่วยฟื้นคืนชีพ CPR และการใช้เครื่อง AED" },
    ],
  }),
  component: CprSimulationPage,
});

export function CprSimulationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <Link to="/courses/$courseId" params={{ courseId: "b1000000-0000-4000-8000-000000000001" }}>
            <ArrowLeft className="h-3.5 w-3.5" />
            กลับสู่หลักสูตร CPR & AED
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="3D Medical Simulation & Clinical Workflow"
        title="แบบจำลอง 3 มิติ: ลำดับขั้นตอนการช่วยชีวิต CPR & การใช้เครื่อง AED"
        right={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Interactive 360° View
            </span>
          </div>
        }
      />

      {/* 3D Simulation Canvas & Interactive Timeline */}
      <CprWorkflowSimulation />

      {/* Clinical Reference & Standard Guide Cards */}
      <div className="grid gap-4 md:grid-cols-3 pt-2">
        <div className="glass rounded-3xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
            <HeartPulse className="h-4 w-4" />
            เกณฑ์คุณภาพการกดหน้าอก
          </div>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• <strong>ตำแหน่ง:</strong> ครึ่งล่างของกระดูกหน้าอก (Lower sternum)</li>
            <li>• <strong>ความลึก:</strong> 5 - 6 เซนติเมตร (ไม่เกิน 6 ซม.)</li>
            <li>• <strong>ความเร็ว:</strong> 100 - 120 ครั้ง/นาที (มีเสียง Metronome กำกับ)</li>
            <li>• <strong>การคืนตัว:</strong> ปล่อยให้อกคืนตัวเต็มที่ ไม่ทิ้งน้ำหนักกดค้าง</li>
          </ul>
        </div>

        <div className="glass rounded-3xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            ข้อกำหนดความปลอดภัยเครื่อง AED
          </div>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• แผ่นที่ 1: ใต้กระดูกไหปลาร้าด้านขวา (ขั้วบวก)</li>
            <li>• แผ่นที่ 2: ใต้ราวนมด้านซ้าย แนวรักแร้ (ขั้วลบ)</li>
            <li>• <strong>คำเตือน:</strong> ห้ามแตะตัวผู้ป่วยเด็ดขาดขณะวิเคราะห์และกดช็อก</li>
            <li>• ทำ CPR ต่อเนื่องทันทีหลังช็อกครบ 2 นาที</li>
          </ul>
        </div>

        <div className="glass rounded-3xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <BookOpen className="h-4 w-4" />
            อ้างอิงมาตรฐานสากล
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            อ้างอิงตามแนวทางเวชปฏิบัติการกู้ชีพขั้นพื้นฐาน (BLS) สมาคมแพทย์โรคหัวใจแห่งสหรัฐอเมริกา (AHA Guidelines) และสถาบันการแพทย์ฉุกเฉินแห่งชาติ (สพฉ.)
          </p>
        </div>
      </div>
    </div>
  );
}
