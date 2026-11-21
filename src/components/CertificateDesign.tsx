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
  organizationName?: string | null;
  departmentSubtitle?: string | null;
  signatureUrl?: string | null;
  instructorName?: string | null;
  instructorTitle?: string | null;
  directorSignatureUrl?: string | null;
  directorName?: string | null;
  directorTitle?: string | null;
  showInstructorSignature?: boolean;
  showDirectorSignature?: boolean;
  backgroundUrl?: string | null;
  verifyUrl?: string;
  preview?: boolean;
};

type SignerBlockProps = {
  signatureUrl?: string | null;
  name?: string | null;
  title?: string | null;
  compact?: boolean;
};

function SignerBlock({ signatureUrl, name, title, compact }: SignerBlockProps) {
  return (
    <div className="flex flex-col items-center text-center leading-snug">
      <div
        className="flex items-end justify-center"
        style={{
          height: compact ? "5.2cqw" : "5.8cqw",
        }}
      >
        {signatureUrl && (
          <img
            src={signatureUrl}
            crossOrigin="anonymous"
            alt={`ลายเซ็น ${name || ""}`}
            className="h-full w-auto object-contain"
            style={{
              maxHeight: compact ? "5.2cqw" : "5.8cqw",
              maxWidth: compact ? "18cqw" : "22cqw",
            }}
          />
        )}
      </div>
      {(name || title) && (
        <div style={{ marginTop: "0.35cqw" }}>
          {name && (
            <div
              className="font-semibold text-foreground"
              style={{
                fontSize: compact ? "1.15cqw" : "1.28cqw",
              }}
            >
              ({name})
            </div>
          )}
          {title && (
            <div
              className="text-muted-foreground"
              style={{
                fontSize: compact ? "0.98cqw" : "1.08cqw",
              }}
            >
              {title}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  organizationName,
  departmentSubtitle,
  signatureUrl,
  instructorName,
  instructorTitle,
  directorSignatureUrl,
  directorName,
  directorTitle,
  showInstructorSignature,
  showDirectorSignature,
  backgroundUrl,
  verifyUrl,
  preview = false,
}: CertificateDesignProps) {
  const isTwoLogos = Boolean(hospitalLogoUrl && courseLogoUrl);
  const singleLogoUrl = hospitalLogoUrl || courseLogoUrl;

  const hasInstructorData = Boolean(signatureUrl || instructorName || instructorTitle);
  const hasDirectorData = Boolean(directorSignatureUrl || directorName || directorTitle);

  const showInstructor =
    showInstructorSignature !== undefined ? showInstructorSignature && hasInstructorData : hasInstructorData;
  const showDirector =
    showDirectorSignature !== undefined ? showDirectorSignature && hasDirectorData : false;

  const activeSigners: { signatureUrl?: string | null; name?: string | null; title?: string | null }[] = [];
  if (showInstructor) {
    activeSigners.push({
      signatureUrl,
      name: instructorName,
      title: instructorTitle,
    });
  }
  if (showDirector) {
    activeSigners.push({
      signatureUrl: directorSignatureUrl,
      name: directorName,
      title: directorTitle,
    });
  }

  // Adaptive font sizing for extra-long names or course titles so lines never wrap and push content out
  const nameLen = (recipientName || "").length;
  const recipientFontSize = nameLen > 36 ? "2.05cqw" : nameLen > 26 ? "2.35cqw" : "2.75cqw";

  const detailLen = (recipientDetail || "").length;
  const detailFontSize = detailLen > 55 ? "0.98cqw" : detailLen > 40 ? "1.1cqw" : "1.22cqw";

  const titleLen = (courseTitle || "").length;
  const courseTitleFontSize = titleLen > 55 ? "1.45cqw" : titleLen > 38 ? "1.7cqw" : "1.95cqw";

  const orgText =
    organizationName && !organizationName.includes("???")
      ? organizationName
      : "โรงพยาบาลโอเวอร์บรุ๊ค";
  const deptText =
    departmentSubtitle && !departmentSubtitle.includes("???")
      ? departmentSubtitle
      : "ศูนย์พัฒนาศักยภาพบุคลากร";

  return (
    <div
      className="certificate-sheet relative aspect-[1.414/1] w-full overflow-hidden border-[6px] sm:border-[10px] border-primary/20 bg-card text-center shadow-brand"
      style={{ containerType: "inline-size" }}
    >
      {backgroundUrl && (
        <>
          <img
            src={backgroundUrl}
            crossOrigin="anonymous"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-card/35" />
        </>
      )}
      <div className="pointer-events-none absolute inset-[1.6%] z-10 border-2 border-mint/60" />
      <div className="pointer-events-none absolute inset-[2.6%] z-10 border border-primary/30" />

      {/* 2 Logos: Left and Right sides */}
      {isTwoLogos && (
        <>
          <div
            className="absolute left-[6%] top-[5.5%] z-20 flex items-center justify-center"
            style={{ width: "11cqw", height: "9.5cqw" }}
          >
            <img
              src={hospitalLogoUrl!}
              crossOrigin="anonymous"
              alt="โลโก้โรงพยาบาลโอเวอร์บรุ๊ค"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div
            className="absolute right-[6%] top-[5.5%] z-20 flex items-center justify-center"
            style={{ width: "11cqw", height: "9.5cqw" }}
          >
            <img
              src={courseLogoUrl!}
              crossOrigin="anonymous"
              alt={`โลโก้หลักสูตร ${courseTitle}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </>
      )}

      {/* Main 3-Zone Flex Container */}
      <div
        className={`relative z-10 flex h-full flex-col items-center justify-between px-[11%] pb-[5.2%] ${
          isTwoLogos ? "pt-[5.5%]" : "pt-[4.2%]"
        }`}
      >
        {/* ZONE 1: Top Branding & Certificate Heading */}
        <div className="flex w-full flex-col items-center">
          {!isTwoLogos && (
            <div
              className="flex items-center justify-center"
              style={{
                height: "8.6cqw",
                maxWidth: "24%",
                marginBottom: "0.7cqw",
              }}
            >
              {singleLogoUrl ? (
                <img
                  src={singleLogoUrl}
                  crossOrigin="anonymous"
                  alt="โลโก้"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div
                  className="grid place-items-center rounded-2xl bg-brand-gradient font-bold text-primary-foreground"
                  style={{ width: "6.5cqw", height: "6.5cqw", fontSize: "2.8cqw" }}
                >
                  อ
                </div>
              )}
            </div>
          )}

          <div
            className="font-semibold text-primary-deep leading-snug"
            style={{ fontSize: "1.45cqw" }}
          >
            {orgText}
          </div>
          <div
            className="text-muted-foreground leading-snug"
            style={{ fontSize: "1.12cqw" }}
          >
            {deptText}
          </div>
          <h1
            className="font-bold text-primary leading-tight"
            style={{
              marginTop: isTwoLogos ? "1.6cqw" : "0.9cqw",
              fontSize: "3.35cqw",
            }}
          >
            ประกาศนียบัตร
          </h1>
          <div
            className="uppercase tracking-wider text-muted-foreground leading-tight"
            style={{ marginTop: "0.25cqw", fontSize: "0.98cqw" }}
          >
            Certificate of Completion
          </div>
        </div>

        {/* ZONE 2: Middle Recipient & Course Achievement */}
        <div className="flex w-full flex-col items-center">
          <p
            className="text-muted-foreground leading-snug"
            style={{ fontSize: "1.22cqw" }}
          >
            ขอมอบให้ไว้เพื่อแสดงว่า
          </p>
          <div
            className="max-w-full font-bold text-foreground leading-tight"
            style={{ marginTop: "0.35cqw", fontSize: recipientFontSize }}
          >
            {recipientName}
          </div>
          {recipientDetail && (
            <div
              className="max-w-full text-muted-foreground leading-snug"
              style={{ marginTop: "0.2cqw", fontSize: detailFontSize }}
            >
              {recipientDetail}
            </div>
          )}

          <p
            className="text-muted-foreground leading-snug"
            style={{ marginTop: "1.35cqw", fontSize: "1.22cqw" }}
          >
            ได้ผ่านการอบรมหลักสูตร
          </p>
          <div
            className="max-w-full font-bold text-primary-deep leading-snug"
            style={{ marginTop: "0.3cqw", fontSize: courseTitleFontSize }}
          >
            {courseTitle}
          </div>
          <div
            className="text-muted-foreground leading-snug"
            style={{ marginTop: "0.45cqw", fontSize: "1.18cqw" }}
          >
            {trainingYear ? `ปีการอบรม ${trainingYear} · ` : ""}จำนวน {hours ?? 0} ชั่วโมง
            {score == null ? "" : ` · คะแนนหลังเรียน ${score}%`}
          </div>
        </div>

        {/* ZONE 3: Bottom Signer Block (Centered between Cert No. on left and QR on right) */}
        <div
          className="flex w-full items-end justify-center"
          style={{
            maxWidth: activeSigners.length === 2 ? "56%" : "46%",
            minHeight: "8.2cqw",
          }}
        >
          {activeSigners.length === 2 ? (
            <div className="grid w-full grid-cols-2 items-end" style={{ gap: "2.2cqw" }}>
              <SignerBlock {...activeSigners[0]} compact />
              <SignerBlock {...activeSigners[1]} compact />
            </div>
          ) : activeSigners.length === 1 ? (
            <SignerBlock {...activeSigners[0]} />
          ) : null}
        </div>

        {/* Bottom-Left: Certificate Number & Issue Date */}
        <div
          className="absolute bottom-[5.2%] left-[5.5%] max-w-[23%] text-left text-muted-foreground leading-snug"
          style={{ fontSize: "0.96cqw" }}
        >
          <div className="truncate">เลขที่ {certificateNumber}</div>
          <div className="truncate">ให้ไว้ ณ วันที่ {issuedDate}</div>
        </div>

        {/* Bottom-Right: Verification QR Code */}
        {verifyUrl && (
          <div
            className="absolute bottom-[4.8%] right-[5.5%] flex flex-col items-center text-center text-muted-foreground"
            style={{ fontSize: "0.84cqw" }}
          >
            <div
              className="flex items-center justify-center [&>img]:size-full [&>svg]:size-full"
              style={{ width: preview ? "5.2cqw" : "6.0cqw", height: preview ? "5.2cqw" : "6.0cqw" }}
            >
              <QRImg value={verifyUrl} size={preview ? 54 : 72} />
            </div>
            <span style={{ marginTop: "0.2cqw" }}>สแกนตรวจสอบ</span>
          </div>
        )}
      </div>
    </div>
  );
}
