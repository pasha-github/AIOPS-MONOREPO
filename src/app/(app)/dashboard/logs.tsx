import type { ReactNode } from "react";

const renderMarkdownInline = (text: string, keyPrefix = ""): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    const token = match[0];
    const start = match.index;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`md-${keyPrefix}-${key++}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`md-${keyPrefix}-${key++}`}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`md-${keyPrefix}-${key++}`}
          className="rounded bg-black/5 px-1 py-0.5 text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      token.startsWith("[") &&
      token.includes("](") &&
      token.endsWith(")")
    ) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`md-${keyPrefix}-${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    cursor = start + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};

export const renderMarkdownBlocks = (text: string): ReactNode[] => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code Block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }

      if (i < lines.length) i++;

      blocks.push(
        <pre
          key={`block-code-${i}`}
          className="overflow-x-auto rounded-xl bg-black text-white px-3 py-2 text-xs"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];

      const Tag = `h${Math.min(level, 3)}` as keyof HTMLElementTagNameMap;

      blocks.push(
        <Tag key={`block-h-${i}`} className="font-semibold">
          {renderMarkdownInline(content, `heading-${i}`)}
        </Tag>
      );

      i++;
      continue;
    }

    //Unordered List
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }

      blocks.push(
        <ul key={`block-ul-${i}`} className="list-disc pl-5 space-y-1">
          {items.map((item, index) => (
            <li key={index}>
              {renderMarkdownInline(item, `ul-${i}-${index}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    //Ordered List
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }

      blocks.push(
        <ol key={`block-ol-${i}`} className="list-decimal pl-5 space-y-1">
          {items.map((item, index) => (
            <li key={index}>
              {renderMarkdownInline(item, `ol-${i}-${index}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    //Paragraph
    const paragraphLines: string[] = [];

    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`block-p-${i}`} className="leading-7">
        {paragraphLines.map((line, index) => (
          <span key={index}>
            {renderMarkdownInline(line, `p-${i}-${index}`)}
            {index < paragraphLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
};