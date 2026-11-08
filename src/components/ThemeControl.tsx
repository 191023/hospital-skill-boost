import { useEffect, useState } from "react";
import { Sun, Moon, Laptop, Palette, Check } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";
export type ColorTheme = "blue" | "emerald" | "teal" | "violet";

export const COLOR_THEMES: {
  key: ColorTheme;
  name: string;
  hint: string;
  bgClass: string;
  dotColor: string;
}[] = [
  {
    key: "blue",
    name: "ครามโอเวอร์บรุ๊ค",
    hint: "น้ำเงินครามทางการแพทย์ (ค่าเริ่มต้น)",
    bgClass: "bg-blue-600",
    dotColor: "#2563eb",
  },
  {
    key: "emerald",
    name: "เขียวการแพทย์",
    hint: "เขียวมรกต สุขอนามัย สบายตา",
    bgClass: "bg-emerald-600",
    dotColor: "#059669",
  },
  {
    key: "teal",
    name: "ฟ้าคลินิก",
    hint: "ฟ้าอมเขียว ทันสมัย สะอาดตา",
    bgClass: "bg-teal-600",
    dotColor: "#0d9488",
  },
  {
    key: "violet",
    name: "ม่วงสุขภาพ",
    hint: "ม่วงอบอุ่น ทันสมัยและผ่อนคลาย",
    bgClass: "bg-violet-600",
    dotColor: "#7c3aed",
  },
];

export function applyTheme(mode: ThemeMode, color: ColorTheme) {
  if (typeof window === "undefined") return;

  // 1. Mode
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  }

  // 2. Color Tone
  document.documentElement.setAttribute("data-color-theme", color);
}

export function ThemeControl({
  className = "",
  compact = false,
  showPalette = false,
}: {
  className?: string;
  compact?: boolean;
  showPalette?: boolean;
}) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [color, setColor] = useState<ColorTheme>("blue");

  useEffect(() => {
    const savedMode = (localStorage.getItem("hospital_theme_mode") as ThemeMode) || "light";
    const savedColor = (localStorage.getItem("hospital_color_theme") as ColorTheme) || "blue";

    setMode(savedMode);
    setColor(savedColor);
    applyTheme(savedMode, savedColor);

    // Listen to system dark mode changes if in "system" mode
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const currentMode = (localStorage.getItem("hospital_theme_mode") as ThemeMode) || "light";
      if (currentMode === "system") {
        applyTheme("system", (localStorage.getItem("hospital_color_theme") as ColorTheme) || "blue");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem("hospital_theme_mode", newMode);
    applyTheme(newMode, color);
  };

  const handleColorChange = (newColor: ColorTheme) => {
    setColor(newColor);
    localStorage.setItem("hospital_color_theme", newColor);
    applyTheme(mode, newColor);
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {/* Compact Mode Toggle */}
        <div className="inline-flex items-center rounded-xl border border-glass-border bg-glass/90 p-0.5 shadow-xs backdrop-blur-md">
          <button
            type="button"
            onClick={() => handleModeChange("light")}
            title="โหมดสว่าง (กลางวัน)"
            className={`rounded-lg p-1.5 transition-all ${
              mode === "light"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("dark")}
            title="โหมดมืด (กลางคืน)"
            className={`rounded-lg p-1.5 transition-all ${
              mode === "dark"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Moon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("system")}
            title="ตามระบบอุปกรณ์"
            className={`rounded-lg p-1.5 transition-all ${
              mode === "system"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Laptop className="size-3.5" />
          </button>
        </div>

        {/* Compact Color Palette Dots */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-glass-border bg-glass/90 p-1 shadow-xs backdrop-blur-md">
          {COLOR_THEMES.map((theme) => {
            const active = color === theme.key;
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => handleColorChange(theme.key)}
                title={theme.name}
                className={`relative size-4 rounded-full transition-transform hover:scale-110 ${theme.bgClass} ${
                  active ? "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background scale-110" : "opacity-80"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Full / Expanded View (for Settings)
  return (
    <div className={`space-y-5 ${className}`}>
      {/* Light / Dark Mode selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">โหมดการแสดงผล (โหมดกลางวัน / กลางคืน)</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange("light")}
            className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
              mode === "light"
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border bg-card/60 text-foreground hover:border-primary/40"
            }`}
          >
            <Sun className="size-4 text-amber-500" />
            <span>โหมดสว่าง (Day)</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("dark")}
            className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
              mode === "dark"
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border bg-card/60 text-foreground hover:border-primary/40"
            }`}
          >
            <Moon className="size-4 text-indigo-400" />
            <span>โหมดมืด (Night)</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("system")}
            className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
              mode === "system"
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border bg-card/60 text-foreground hover:border-primary/40"
            }`}
          >
            <Laptop className="size-4 text-muted-foreground" />
            <span>ตามระบบอุปกรณ์</span>
          </button>
        </div>
      </div>

      {/* Color Tone Palette selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Palette className="size-3.5 text-primary" />
          <span>โทนสีหลักของระบบ (Primary Theme)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLOR_THEMES.map((theme) => {
            const active = color === theme.key;
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => handleColorChange(theme.key)}
                className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border bg-card/60 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`size-5 rounded-full ${theme.bgClass} shadow-xs flex items-center justify-center`}>
                    {active && <Check className="size-3 text-white stroke-[3]" />}
                  </span>
                  {active && <span className="text-[10px] font-bold text-primary">ใช้งานอยู่</span>}
                </div>
                <div className="font-bold text-xs text-foreground mt-1">{theme.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{theme.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

