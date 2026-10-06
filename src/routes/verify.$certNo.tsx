import { createFileRoute, Link } from "@tanstack/react-router";
import { verifyCert } from "@/lib/verify.functions";
import { thaiDate } from "@/lib/data";

export const Route = createFileRoute("/verify/$certNo")({
  loader: ({ params }) => verifyCert({ data: { certNo: params.certNo } }),
  head: () => ({
    meta: [
      { title: "ตรวจสอบใบประกาศ — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "ตรวจสอบความถูกต้องของใบประกาศนียบัตรการอบรม โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "ตรวจสอบใบประกาศ — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "ตรวจสอบความถูกต้องของใบประกาศนียบัตรการอบรม" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <div className="p-10 text-center">ตรวจสอบไม่สำเร็จ กรุณาลองใหม่</div>,
  notFoundComponent: () => <div className="p-10 text-center">ไม่พบหน้า</div>,
  component: Verify,
});

function Verify() {
  const c = Route.useLoaderData();
  const { certNo } = Route.useParams();
  return (
    <div className="grid min-h-screen place-items-center bg-page p-4">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-gradient text-xl font-bold text-primary-foreground">อ</div>
        <div className="mt-2 text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค</div>
        {c ? (
          <>
            <div className="mt-5 inline-block rounded-full bg-mint/20 px-4 py-1 text-sm font-bold text-primary-deep">✓ ใบประกาศถูกต้อง</div>
            <div className="mt-5 text-2xl font-bold">{c.full_name}</div>
            <div className="text-sm text-muted-foreground">{[c.department, c.division].filter(Boolean).join(" · ")}</div>
            <div className="mt-4 text-sm text-muted-foreground">ผ่านการอบรมหลักสูตร</div>
            <div className="text-lg font-bold text-primary">{c.course_title}</div>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-left text-sm">
              <dt className="text-muted-foreground">เลขที่</dt><dd className="font-semibold">{c.cert_no}</dd>
              <dt className="text-muted-foreground">ปีที่อบรม</dt><dd>{c.training_year}</dd>
              <dt className="text-muted-foreground">จำนวนชั่วโมง</dt><dd>{c.hours}</dd>
              <dt className="text-muted-foreground">คะแนนหลังเรียน</dt><dd>{c.score}%</dd>
              <dt className="text-muted-foreground">วันที่ออก</dt><dd>{thaiDate(c.issued_at)}</dd>
            </dl>
          </>
        ) : (
          <div className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">ไม่พบใบประกาศเลขที่ {certNo} ในระบบ</div>
        )}
        <Link to="/auth" className="mt-6 inline-block text-sm text-primary">เข้าสู่ระบบอบรม →</Link>
      </div>
    </div>
  );
}
