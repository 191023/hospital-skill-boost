export type ParsedDocumentResult = {
  text: string;
  filename: string;
  fileType: "pdf" | "docx" | "pptx" | "xlsx" | "text";
  charCount: number;
  itemCountDesc?: string; // e.g. "12 สไลด์" or "5 หน้า"
};

async function getFileArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file as ArrayBuffer"));
    reader.readAsArrayBuffer(file);
  });
}

async function getFileText(file: File | Blob): Promise<string> {
  if (typeof file.text === "function") {
    return await file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file as text"));
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Parses uploaded training files (PDF, Word DOCX, PowerPoint PPTX, Excel XLSX, TXT, MD, CSV)
 * and extracts structured plain text ready for AI exam question generation.
 */
export async function parseTrainingDocument(file: File): Promise<ParsedDocumentResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // 1. Word Document (.docx)
  if (ext === "docx") {
    const arrayBuffer = await getFileArrayBuffer(file);
    const mammothMod = await import("mammoth");
    const mammoth = mammothMod.default || mammothMod;
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();
    if (!text) {
      throw new Error("ไม่พบข้อความในไฟล์ Word (.docx) กรุณาตรวจสอบว่ามีเนื้อหาตัวอักษรอยู่ภายในเอกสาร");
    }
    return {
      text,
      filename: file.name,
      fileType: "docx",
      charCount: text.length,
      itemCountDesc: "เอกสาร Word",
    };
  }

  // 2. PowerPoint Slides (.pptx)
  if (ext === "pptx") {
    const arrayBuffer = await getFileArrayBuffer(file);
    const JSZipMod = await import("jszip");
    const JSZip = JSZipMod.default || JSZipMod;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Locate slide XML files: ppt/slides/slide1.xml, slide2.xml ...
    const slideEntries: { num: number; path: string }[] = [];
    zip.forEach((relativePath) => {
      const match = relativePath.match(/^ppt\/slides\/slide([0-9]+)\.xml$/i);
      if (match && match[1]) {
        slideEntries.push({ num: parseInt(match[1], 10), path: relativePath });
      }
    });

    if (slideEntries.length === 0) {
      throw new Error("ไม่พบข้อมูลสไลด์ในไฟล์ PowerPoint (.pptx)");
    }

    // Sort slides in natural order (1, 2, 3...)
    slideEntries.sort((a, b) => a.num - b.num);

    const slideTexts: string[] = [];
    for (const entry of slideEntries) {
      const xml = await zip.file(entry.path)?.async("text");
      if (!xml) continue;

      // Extract text paragraphs
      const paragraphs = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/gi) || [];
      const lines: string[] = [];

      for (const p of paragraphs) {
        const matches = [...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)];
        const lineText = matches.map((m) => m[1]).join("").trim();
        if (lineText) {
          lines.push(lineText);
        }
      }

      if (lines.length > 0) {
        slideTexts.push(`--- [สไลด์ที่ ${entry.num}] ---\n` + lines.join("\n"));
      }
    }

    const combinedText = slideTexts.join("\n\n").trim();
    if (!combinedText) {
      throw new Error("ไม่พบข้อความตัวอักษรในสไลด์ PowerPoint (อาจเป็นสไลด์รูปภาพล้วน)");
    }

    return {
      text: combinedText,
      filename: file.name,
      fileType: "pptx",
      charCount: combinedText.length,
      itemCountDesc: `${slideEntries.length} สไลด์`,
    };
  }

  // 3. PDF Document (.pdf)
  if (ext === "pdf") {
    const arrayBuffer = await getFileArrayBuffer(file);
    const { extractText: extractPdfText } = await import("unpdf");
    const pdfData = await extractPdfText(new Uint8Array(arrayBuffer));
    
    let combinedText = "";
    const totalPages = pdfData.totalPages || 0;

    if (Array.isArray(pdfData.text)) {
      const pageSections = pdfData.text
        .map((pageText, idx) => {
          const clean = pageText.trim();
          return clean ? `--- [หน้า ${idx + 1}] ---\n${clean}` : "";
        })
        .filter(Boolean);
      combinedText = pageSections.join("\n\n").trim();
    } else if (typeof (pdfData as any).text === "string") {
      combinedText = String((pdfData as any).text).trim();
    }

    if (!combinedText) {
      throw new Error(
        "ไม่พบข้อความในไฟล์ PDF (หากเป็นเอกสารที่สแกนเป็นรูปภาพล้วน กรุณาคัดลอกข้อความมาวางในช่องโดยตรง)"
      );
    }

    return {
      text: combinedText,
      filename: file.name,
      fileType: "pdf",
      charCount: combinedText.length,
      itemCountDesc: totalPages > 0 ? `${totalPages} หน้า` : "เอกสาร PDF",
    };
  }

  // 4. Excel (.xlsx, .xls)
  if (ext === "xlsx" || ext === "xls") {
    const arrayBuffer = await getFileArrayBuffer(file);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    let combined = "";

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (sheet) {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          combined += `\n--- [แผ่นงาน: ${sheetName}] ---\n` + csv;
        }
      }
    }

    const text = combined.trim();
    if (!text) {
      throw new Error("ไม่พบข้อความในไฟล์ Excel");
    }

    return {
      text,
      filename: file.name,
      fileType: "xlsx",
      charCount: text.length,
      itemCountDesc: `${wb.SheetNames.length} แผ่นงาน`,
    };
  }

  // 5. Plain text, Markdown, CSV, JSON (.txt, .md, .csv, .json)
  const text = (await getFileText(file)).trim();
  if (!text) {
    throw new Error("ไฟล์ไม่มีข้อความ");
  }

  return {
    text,
    filename: file.name,
    fileType: "text",
    charCount: text.length,
    itemCountDesc: "เอกสารข้อความ",
  };
}
