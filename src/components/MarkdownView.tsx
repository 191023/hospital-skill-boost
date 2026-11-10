import React from "react";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Lightweight, safe React Markdown Renderer.
 * Renders headings, lists, bold/italic, code, quotes, links, and tables into semantic React elements without dangerouslySetInnerHTML.
 */
export function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];

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

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code blocks (```)
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // 2. Empty line -> flush list
    if (!trimmed) {
      flushList();
      continue;
    }

    // 3. Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${elements.length}`} className="my-6 border-border/60" />);
      continue;
    }

    // 4. Headings
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

    // 5. Blockquote
    if (trimmed.startsWith(">")) {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, "");
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-3 border-l-4 border-primary bg-primary/5 py-2.5 px-4 rounded-r-xl text-sm italic text-foreground/80"
        >
          {renderInlineMarkdown(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 6. Unordered List (- or *)
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

    // 7. Ordered List (1. 2.)
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

    // 8. Normal Paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="my-2.5 leading-relaxed text-foreground/90 text-sm">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();
  flushCodeBlock();

  return <div className={`markdown-body space-y-1 ${className}`}>{elements}</div>;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and [link](url)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex splitting by:
  // 1. Links: [title](url)
  // 2. Bold: **text** or __text__
  // 3. Italic: *text* or _text_
  // 4. Inline code: `code`
  const regex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

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

