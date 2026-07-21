import type { ReactNode } from "react";

export function renderMarkdownBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const className =
        level === 1
          ? "text-lg font-semibold text-[#111827]"
          : level === 2
            ? "text-base font-semibold text-[#111827]"
            : "text-sm font-semibold text-[#111827]";

      blocks.push(
        <p key={`md-heading-${index}`} className={className}>
          {content}
        </p>
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol
          key={`md-ordered-${index}`}
          className="list-decimal space-y-2 pl-5 text-sm leading-7 text-[#344054]"
        >
          {items.map((item, itemIndex) => (
            <li key={`md-ordered-item-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul
          key={`md-unordered-${index}`}
          className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#344054]"
        >
          {items.map((item, itemIndex) => (
            <li key={`md-unordered-item-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        /^(#{1,6})\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        /^[-*]\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        <p
          key={`md-paragraph-${index}`}
          className="text-sm leading-7 text-[#344054]"
        >
          {paragraphLines.join(" ")}
        </p>
      );
      continue;
    }

    index += 1;
  }

  return blocks;
}
