import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownView } from "@/components/MarkdownView";

describe("MarkdownView Multimedia Rendering", () => {
  it("renders inline images with captions", () => {
    const md = `
# ขั้นตอนการใช้ถังดับเพลิง
![แผนผังขั้นตอน P.A.S.S.](https://example.com/pass-diagram.png)
`;
    render(<MarkdownView content={md} />);
    expect(screen.getByText("ขั้นตอนการใช้ถังดับเพลิง")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "แผนผังขั้นตอน P.A.S.S." });
    expect(img).toHaveAttribute("src", "https://example.com/pass-diagram.png");
    expect(screen.getByText("แผนผังขั้นตอน P.A.S.S.")).toBeInTheDocument();
  });

  it("renders inline YouTube video embeds with captions", () => {
    const md = `
![youtube:วิดีโอสาธิตการฉีดถังดับเพลิง](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
`;
    render(<MarkdownView content={md} />);
    const iframe = screen.getByTitle("วิดีโอสาธิตการฉีดถังดับเพลิง");
    expect(iframe).toHaveAttribute("src", "https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(screen.getByText("วิดีโอสาธิตการฉีดถังดับเพลิง")).toBeInTheDocument();
  });

  it("renders Markdown tables and callout boxes", () => {
    const md = `
| ชนิดถัง | ประเภทเพลิง |
| --- | --- |
| CO2 | เพลิงไฟฟ้า (Class C) |

> [!WARNING] ข้อควรระวังในการจับหัวฉีด
> ห้ามจับปลายกระบอกฉีดถัง CO2 ด้วยมือเปล่าเนื่องจากมีความเย็นจัด
`;
    render(<MarkdownView content={md} />);
    expect(screen.getByText("ชนิดถัง")).toBeInTheDocument();
    expect(screen.getByText("เพลิงไฟฟ้า (Class C)")).toBeInTheDocument();
    expect(screen.getByText("ข้อควรระวังในการจับหัวฉีด")).toBeInTheDocument();
    expect(screen.getByText(/ห้ามจับปลายกระบอกฉีดถัง CO2/)).toBeInTheDocument();
  });
});
