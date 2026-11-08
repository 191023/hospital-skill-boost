import { useEffect, useState } from "react";

export type FontSize = "normal" | "large" | "xlarge";

const OPTIONS: { key: FontSize; label: string; title: string; hint: string }[] = [
  { key: "normal", label: "ก", title: "ขนาดปกติ (17.5px)", hint: "ปกติ" },
  { key: "large", label: "ก+", title: "ขนาดใหญ่ (19px)", hint: "ใหญ่" },
  { key: "xlarge", label: "ก++", title: "ขนาดใหญ่พิเศษ (21px)", hint: "ใหญ่มาก" },
];

export function FontSizeControl({
  className = "",
  compact = false,
  showHint = false,
}: {
  className?: string;
  compact?: boolean;
  showHint?: boolean;
}) {
  const [current, setCurrent] = useState<FontSize>("normal");

  useEffect(() => {
    const saved = (localStorage.getItem("hospital_font_size") as FontSize) || "normal";
    if (["normal", "large", "xlarge"].includes(saved)) {
      setCurrent(saved);
      document.documentElement.setAttribute("data-font-size", saved);
    }
  }, []);

  const handleChange = (size: FontSize) => {
    setCurrent(size);
    document.documentElement.setAttribute("data-font-size", size);
    localStorage.setItem("hospital_font_size", size);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border border-glass-border bg-glass/90 p-1 shadow-xs backdrop-blur-md transition-all ${className}`}
      role="group"
      aria-label="ปรับขนาดตัวอักษร"
    >
      {!compact && (
        <span className="px-2 text-xs font-semibold text-muted-foreground select-none">
          ขนาดอักษร:
        </span>
      )}
      <div className="flex items-center gap-1">
        {OPTIONS.map((opt) => {
          const isActive = current === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              title={opt.title}
              onClick={() => handleChange(opt.key)}
              className={`flex h-7 min-w-[28px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-foreground/70 hover:bg-card hover:text-foreground"
              }`}
            >
              <span>{opt.label}</span>
              {showHint && <span className="text-[10px] opacity-80">({opt.hint})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
