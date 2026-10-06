import { QRImg } from "@/components/QR";

export type CertificateDesignProps = {
  recipientName: string;
  recipientDetail?: string;
  courseTitle: string;
  trainingYear?: number | null;
  hours?: number | null;
  score?: number | null;
  certificateNumber: string;
  issuedDate: string;
  hospitalLogoUrl?: string | null;
  courseLogoUrl?: string | null;
  signatureUrl?: string | null;
  instructorName?: string | null;
  instructorTitle?: string | null;
  backgroundUrl?: string | null;
  verifyUrl?: string;
  preview?: boolean;
};

export function CertificateDesign({
  recipientName,
  recipientDetail,
  courseTitle,
  trainingYear,
  hours,
  score,
  certificateNumber,
  issuedDate,
  hospitalLogoUrl,
  courseLogoUrl,
  signatureUrl,
  instructorName,
  instructorTitle,
  backgroundUrl,
  verifyUrl,
  preview = false,
}: CertificateDesignProps) {
  return (
    <div className="certificate-sheet relative aspect-[1.414/1] w-full overflow-hidden border-[10px] border-primary/20 bg-card text-center shadow-brand">
      {backgroundUrl && (
        <>
          <img src={backgroundUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-card/35" />
        </>
      )}
      <div className="pointer-events-none absolute inset-4 z-10 border-2 border-mint/60" />
      <div className="pointer-events-none absolute inset-7 z-10 border border-primary/30" />

      <div className="absolute left-[7%] top-[8%] z-20 flex size-[11%] min-h-14 min-w-14 items-center justify-center">
        {hospitalLogoUrl ? (
          <img src={hospitalLogoUrl} alt="โลโก้โรงพยาบาลโอเวอร์บรุ๊ค" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="grid size-full min-h-14 min-w-14 place-items-center rounded-2xl bg-brand-gradient text-2xl font-bold text-primary-foreground">อ</div>
        )}
      </div>

      {courseLogoUrl && (
        <div className="absolute right-[7%] top-[8%] z-20 flex size-[11%] min-h-14 min-w-14 items-center justify-center">
          <img src={courseLogoUrl} alt={`โลโก้หลักสูตร ${courseTitle}`} className="max-h-full max-w-full object-contain" />
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col items-center px-[14%] pb-[7%] pt-[6%]">
        <div className="text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค</div>
        <div className="text-[10px] text-muted-foreground sm:text-xs">ศูนย์พัฒนาศักยภาพบุคลากร</div>
        <h1 className="mt-[3%] text-2xl font-bold text-primary sm:text-4xl">ประกาศนียบัตร</h1>
        <div className="mt-1 text-[9px] uppercase text-muted-foreground sm:text-xs">Certificate of Completion</div>
        <p className="mt-[3%] text-[10px] text-muted-foreground sm:text-sm">ขอมอบให้ไว้เพื่อแสดงว่า</p>
        <div className="mt-1 max-w-full text-xl font-bold sm:text-3xl">{recipientName}</div>
        {recipientDetail && <div className="text-[9px] text-muted-foreground sm:text-sm">{recipientDetail}</div>}
        <p className="mt-[3%] text-[10px] text-muted-foreground sm:text-sm">ได้ผ่านการอบรมหลักสูตร</p>
        <div className="mt-1 max-w-full text-base font-bold text-primary-deep sm:text-xl">{courseTitle}</div>
        <div className="mt-1 text-[9px] text-muted-foreground sm:mt-2 sm:text-sm">
          {trainingYear ? `ปีการอบรม ${trainingYear} · ` : ""}จำนวน {hours ?? 0} ชั่วโมง{score == null ? "" : ` · คะแนนหลังเรียน ${score}%`}
        </div>

        <div className="mt-auto min-h-[16%] text-center">
          {signatureUrl && <img src={signatureUrl} alt="ลายเซ็นวิทยากร" className="mx-auto h-10 max-w-36 object-contain sm:h-16 sm:max-w-52" />}
          {(instructorName || instructorTitle) && (
            <div className={signatureUrl ? "-mt-1" : "pt-5"}>
              {instructorName && <div className="text-[10px] font-semibold sm:text-sm">({instructorName})</div>}
              {instructorTitle && <div className="text-[8px] text-muted-foreground sm:text-xs">{instructorTitle}</div>}
            </div>
          )}
        </div>

        <div className="absolute bottom-[7%] left-[7%] text-left text-[8px] text-muted-foreground sm:text-xs">
          <div>เลขที่ {certificateNumber}</div>
          <div>ให้ไว้ ณ วันที่ {issuedDate}</div>
        </div>
        {verifyUrl && (
          <div className="absolute bottom-[5%] right-[7%] text-center text-[8px] text-muted-foreground sm:text-[9px]">
            <QRImg value={verifyUrl} size={preview ? 54 : 72} />
            สแกนตรวจสอบ
          </div>
        )}
      </div>
    </div>
  );
}