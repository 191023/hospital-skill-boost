import { describe, it, expect } from "vitest";
import { parseTrainingDocument } from "../lib/document-parser";
import { jsPDF } from "jspdf";

describe("Document Parser (PDF, DOCX, PPTX, TXT)", () => {
  it("extracts plain text file correctly", async () => {
    const content = "แผนป้องกันอัคคีภัย รพ.โอเวอร์บรุ๊ค 2026\n1. กฎความปลอดภัย";
    const file = new File([content], "test-safety.txt", { type: "text/plain" });

    const result = await parseTrainingDocument(file);
    expect(result.fileType).toBe("text");
    expect(result.filename).toBe("test-safety.txt");
    expect(result.text).toContain("แผนป้องกันอัคคีภัย");
    expect(result.charCount).toBeGreaterThan(20);
  });

  it("extracts PDF document text and reports page count", async () => {
    const doc = new jsPDF();
    doc.text("Infection Control Protocol", 10, 10);
    doc.text("Standard Precautions in Hospital", 10, 20);
    const pdfBuf = doc.output("arraybuffer");

    const file = new File([pdfBuf], "ic-protocol.pdf", { type: "application/pdf" });
    const result = await parseTrainingDocument(file);

    expect(result.fileType).toBe("pdf");
    expect(result.filename).toBe("ic-protocol.pdf");
    expect(result.text).toContain("Infection Control Protocol");
    expect(result.itemCountDesc).toBe("1 หน้า");
  });

  it("throws error when file is empty", async () => {
    const file = new File(["   "], "empty.txt", { type: "text/plain" });
    await expect(parseTrainingDocument(file)).rejects.toThrow("ไฟล์ไม่มีข้อความ");
  });
});
