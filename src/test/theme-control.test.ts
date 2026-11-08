import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, COLOR_THEMES } from "@/components/ThemeControl";

describe("ThemeControl & applyTheme", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-color-theme");
  });

  it("applies dark mode and sets data-theme to dark", () => {
    applyTheme("dark", "blue");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-color-theme")).toBe("blue");
  });

  it("applies light mode and removes dark class", () => {
    document.documentElement.classList.add("dark");
    applyTheme("light", "emerald");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-color-theme")).toBe("emerald");
  });

  it("applies custom color tones (teal, violet)", () => {
    applyTheme("light", "teal");
    expect(document.documentElement.getAttribute("data-color-theme")).toBe("teal");

    applyTheme("dark", "violet");
    expect(document.documentElement.getAttribute("data-color-theme")).toBe("violet");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defines the 4 required hospital color themes", () => {
    const keys = COLOR_THEMES.map((t) => t.key);
    expect(keys).toContain("blue");
    expect(keys).toContain("emerald");
    expect(keys).toContain("teal");
    expect(keys).toContain("violet");
  });
});

