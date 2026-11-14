import React, { useEffect, useState } from "react";
import { fileUrl } from "@/lib/auth";
import { youtubeEmbed } from "@/lib/data";
import { Maximize2, X, PlayCircle, Info, Lightbulb, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

function LessonMediaImage({ src, alt }: { src: string; alt: string }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    src.startsWith("http") || src.startsWith("/") || src.startsWith("data:") ? src : null
  );
  const [loading, setLoading] = useState(!resolvedUrl);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let active = true;
    if (src.startsWith("http") || src.startsWith("/") || src.startsWith("data:")) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }
    setLoading(true);
    const cleanPath = src.replace(/^storage:\/\//, "");
    fileUrl(cleanPath)
      .then((url) => {
        if (active) {
          setResolvedUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="my-4 flex h-48 w-full animate-pulse items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-xs text-muted-foreground">
        กำลังโหลดรูปภาพประกอบ...
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="my-4 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        ไม่สามารถแสดงรูปภาพได้ ({alt || src})
      </div>
    );
  }

  return (
    <>
      <figure className="my-5 overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        <div
          className="group relative cursor-zoom-in overflow-hidden bg-black/5 dark:bg-black/25"
          onClick={() => setZoomed(true)}
        >
          <img
            src={resolvedUrl}
            alt={alt || "ภาพประกอบบทเรียน"}
            loading="lazy"
            className="mx-auto max-h-[460px] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(true);
            }}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-black/65 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <Maximize2 className="size-3.5" />
            <span>ขยายภาพ</span>
          </button>
        </div>
        {alt && alt !== "image" && (
          <figcaption className="border-t border-border/50 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
            {alt}
          </figcaption>
        )}
      </figure>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-h-[92vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <X className="size-4" />
              <span>ปิดภาพขยาย</span>
            </button>
            <img
              src={resolvedUrl}
              alt={alt || "ภาพประกอบบทเรียน"}
              className="max-h-[85vh] w-auto rounded-2xl object-contain shadow-2xl"
            />
            {alt && alt !== "image" && (
              <div className="mt-2 text-center text-xs font-medium text-white/90">{alt}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LessonYoutubeEmbed({ url, title }: { url: string; title?: string }) {
  const embed = youtubeEmbed(url);
  if (!embed) return null;
  const cleanTitle = title && !/^youtube$/i.test(title.trim()) ? title.replace(/^youtube:\s*/i, "").trim() : "";

  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
      <div className="aspect-video w-full bg-black">
        <iframe
          src={embed}
          title={cleanTitle || "วิดีโอประกอบบทเรียน"}
          className="h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
      {cleanTitle && (
        <div className="flex items-center gap-2 border-t border-border/50 bg-muted/30 px-4 py-2 text-xs font-medium text-foreground/85">
          <PlayCircle className="size-4 text-primary shrink-0" />
          <span>{cleanTitle}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight, safe React Markdown Renderer with Multimedia support.
 * Renders headings, lists, bold/italic, code, quotes, callout alerts, tables, images (with Storage signed URL resolution & lightbox), and inline YouTube videos.
 */
export function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];
  let quoteLines: string[] = [];
  let tableLines: string[] = [];

  const flushList = () => {
    if (!inList) return;
    if (inList === "ul") {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 list-disc list-inside space-y-1 pl-2 text-foreground/90">
          {listItems}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-3 list-decimal list-inside space-y-1 pl-2 text-foreground/90">
          {listItems}
        </ol>
      );
    }
    inList = null;
    listItems = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="my-3 overflow-x-auto rounded-xl bg-mist/60 dark:bg-card/90 p-4 font-mono text-xs text-foreground border border-border/80"
      >
        <code>{codeBlockContent.join("\n")}</code>
      </pre>
    );
    inCodeBlock = false;
    codeBlockContent = [];
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    const first = quoteLines[0].trim();
    const alertMatch = first.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);

    if (alertMatch) {
      const kind = alertMatch[1].toUpperCase();
      const customTitle = alertMatch[2]?.trim();
      const bodyLines = quoteLines.slice(1);

      const meta: Record<
        string,
        { label: string; cls: string; badgeCls: string; icon: React.ReactNode }
      > = {
        NOTE: {
          label: customTitle || "ข้อมูลเพิ่มเติม (Note)",
          cls: "border-primary/40 bg-primary/5 text-foreground",
          badgeCls: "text-primary",
          icon: <Info className="size-4 text-primary shrink-0" />,
        },
        TIP: {
          label: customTitle || "เทคนิคการปฏิบัติ (Best Practice)",
          cls: "border-emerald-500/40 bg-emerald-500/10 text-foreground",
          badgeCls: "text-emerald-600 dark:text-emerald-400",
          icon: <Lightbulb className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        },
        IMPORTANT: {
          label: customTitle || "จุดเน้นสำคัญ (Key Point)",
          cls: "border-indigo-500/40 bg-indigo-500/10 text-foreground",
          badgeCls: "text-indigo-600 dark:text-indigo-400",
          icon: <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
        },
        WARNING: {
          label: customTitle || "ข้อควรระวังความปลอดภัย (Warning)",
          cls: "border-amber-500/50 bg-amber-500/10 text-foreground",
          badgeCls: "text-amber-700 dark:text-amber-400",
          icon: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />,
        },
        CAUTION: {
          label: customTitle || "อันตราย / ห้ามปฏิบัติเด็ดขาด (Caution)",
          cls: "border-destructive/50 bg-destructive/10 text-foreground",
          badgeCls: "text-destructive",
          icon: <ShieldAlert className="size-4 text-destructive shrink-0" />,
        },
      };

      const cfg = meta[kind] || meta.NOTE;
      elements.push(
        <div
          key={`alert-${elements.length}`}
          className={`my-4 rounded-2xl border-l-4 border p-4 shadow-xs ${cfg.cls}`}
        >
          <div className={`flex items-center gap-2 text-xs font-bold ${cfg.badgeCls}`}>
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>
          {bodyLines.length > 0 && (
            <div className="mt-1.5 space-y-1 text-sm leading-relaxed text-foreground/90">
              {bodyLines.map((bl, bi) => (
                <p key={bi}>{renderInlineMarkdown(bl)}</p>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-3 border-l-4 border-primary bg-primary/5 py-2.5 px-4 rounded-r-xl text-sm italic text-foreground/85 space-y-1"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi}>{renderInlineMarkdown(ql)}</p>
          ))}
        </blockquote>
      );
    }
    quoteLines = [];
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const parseRow = (row: string) =>
      row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const rows = tableLines.map(parseRow);
    const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));

    let header: string[] | null = null;
    let bodyRows: string[][] = rows;

    if (rows.length >= 2 && isSeparator(rows[1])) {
      header = rows[0];
      bodyRows = rows.slice(2);
    } else if (rows.length >= 1) {
      header = rows[0];
      bodyRows = rows.slice(1).filter((r) => !isSeparator(r));
    }

    elements.push(
      <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-2xl border border-border/80 bg-card/50 shadow-xs">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          {header && (
            <thead>
              <tr className="border-b border-border bg-muted/60 text-foreground">
                {header.map((cell, ci) => (
                  <th key={ci} className="px-3.5 py-2.5 font-bold">
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border/50">
            {bodyRows.map((r, ri) => (
              <tr key={ri} className="hover:bg-muted/25 transition-colors">
                {r.map((cell, ci) => (
                  <td key={ci} className="px-3.5 py-2.5 text-foreground/90">
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code blocks (```)
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        flushQuote();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // 2. Table rows (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
      flushList();
      flushQuote();
      tableLines.push(trimmed);
      continue;
    } else if (tableLines.length > 0) {
      flushTable();
    }

    // 3. Blockquote or Callout (> ...)
    if (trimmed.startsWith(">")) {
      flushList();
      quoteLines.push(trimmed.replace(/^>\s?/, ""));
      continue;
    } else if (quoteLines.length > 0) {
      flushQuote();
    }

    // 4. Empty line -> flush list
    if (!trimmed) {
      flushList();
      continue;
    }

    // 5. Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${elements.length}`} className="my-6 border-border/60" />);
      continue;
    }

    // 6. Standalone YouTube Embed or Markdown Image / YouTube syntax:
    //    - @[youtube](url) or ![youtube:title](url) or [youtube](url)
    //    - Standalone YouTube URL on a line
    //    - ![alt](image_url_or_storage_path)
    const ytDirectiveMatch = trimmed.match(/^(?:@\[youtube\]|!\[youtube(?::([^\]]*))?\]|\[youtube\])\(([^)\s]+)\)$/i);
    if (ytDirectiveMatch) {
      flushList();
      elements.push(
        <LessonYoutubeEmbed
          key={`yt-${elements.length}`}
          title={ytDirectiveMatch[1]}
          url={ytDirectiveMatch[2]}
        />
      );
      continue;
    }

    if (/^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]+/i.test(trimmed)) {
      flushList();
      elements.push(<LessonYoutubeEmbed key={`yt-raw-${elements.length}`} url={trimmed} />);
      continue;
    }

    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushList();
      const altText = imgMatch[1].trim();
      const rawTarget = imgMatch[2].trim();
      if (youtubeEmbed(rawTarget) || /^youtube(?::|$)/i.test(altText)) {
        elements.push(<LessonYoutubeEmbed key={`yt-img-${elements.length}`} title={altText} url={rawTarget} />);
      } else {
        elements.push(<LessonMediaImage key={`img-${elements.length}`} alt={altText} src={rawTarget} />);
      }
      continue;
    }

    // 7. Headings
    if (trimmed.startsWith("#")) {
      flushList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = renderInlineMarkdown(match[2]);
        if (level === 1) {
          elements.push(
            <h1 key={`h1-${elements.length}`} className="mt-6 mb-3 text-2xl font-bold tracking-tight text-foreground border-b border-border/40 pb-2">
              {text}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={`h2-${elements.length}`} className="mt-5 mb-2.5 text-xl font-bold text-foreground">
              {text}
            </h2>
          );
        } else if (level === 3) {
          elements.push(
            <h3 key={`h3-${elements.length}`} className="mt-4 mb-2 text-lg font-bold text-foreground">
              {text}
            </h3>
          );
        } else {
          elements.push(
            <h4 key={`h4-${elements.length}`} className="mt-3 mb-1.5 text-base font-bold text-foreground">
              {text}
            </h4>
          );
        }
        continue;
      }
    }

    // 8. Unordered List (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inList !== "ul") {
        flushList();
        inList = "ul";
      }
      listItems.push(
        <li key={`li-${listItems.length}`} className="leading-relaxed">
          {renderInlineMarkdown(ulMatch[1])}
        </li>
      );
      continue;
    }

    // 9. Ordered List (1. 2.)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== "ol") {
        flushList();
        inList = "ol";
      }
      listItems.push(
        <li key={`li-${listItems.length}`} className="leading-relaxed">
          {renderInlineMarkdown(olMatch[2])}
        </li>
      );
      continue;
    }

    // 10. Normal Paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="my-2.5 leading-relaxed text-foreground/90 text-sm">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();
  flushQuote();
  flushTable();
  flushCodeBlock();

  return <div className={`markdown-body space-y-1 ${className}`}>{elements}</div>;
}

/**
 * Parses inline formatting: ![img](url), [link](url), **bold**, *italic*, `code`
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const regex = /(!\[[^\]]*\]\([^)]+\)|\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Inline Image: ![alt](src)
    const inlineImgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (inlineImgMatch) {
      return <LessonMediaImage key={idx} alt={inlineImgMatch[1].trim()} src={inlineImgMatch[2].trim()} />;
    }

    // Link: [title](url)
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Bold: **text** or __text__
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline Code: `code`
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded-md bg-mist/80 dark:bg-card px-1.5 py-0.5 font-mono text-xs text-primary border border-border/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Italic: *text* or _text_
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}
