"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { renderMarkdownBlocks } from "@/app/(app)/dashboard/logs";

type ExpandableMarkdownTextProps = {
  value: string | null | undefined;
  title: string;
  limit?: number;
  emptyFallback?: string;
  className?: string;
  buttonClassName?: string;
  dialogMaxWidthClassName?: string;
};

export const getExpandablePreviewText = (
  value: string | null | undefined,
  limit = 180
) => {
  const content = value?.trim() || "";
  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit).trimEnd()}...`;
};

export default function ExpandableMarkdownText({
  value,
  title,
  limit = 180,
  emptyFallback = "-",
  className = "break-words whitespace-normal leading-snug text-[#2b3341]",
  buttonClassName = "text-xs font-semibold text-[#4f49e2] transition hover:text-[#4338ca]",
  dialogMaxWidthClassName = "max-w-3xl",
}: ExpandableMarkdownTextProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = value?.trim() || "";
  const isExpandable = content.length > limit;
  const preview = getExpandablePreviewText(content, limit) || emptyFallback;

  return (
    <>
      <div className="space-y-1">
        <p className={className}>{preview}</p>
        {isExpandable ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={buttonClassName}
          >
            See more
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4 py-8 backdrop-blur-md">
          <div
            className={`w-full overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)] ${dialogMaxWidthClassName}`}
          >
            <div className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4">
              <h4 className="text-lg font-semibold text-[#111827]">{title}</h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475569] transition hover:bg-[#f8fafc]"
                aria-label={`Close ${title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="space-y-4 text-sm text-[#334155]">
                {renderMarkdownBlocks(content)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
