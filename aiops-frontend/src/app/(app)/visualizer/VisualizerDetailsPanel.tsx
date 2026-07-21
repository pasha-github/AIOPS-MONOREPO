"use client";

import { ChevronDown, X } from "lucide-react";
import type { GraphNodeData } from "./shared";
import { renderMarkdownBlocks } from "./visualizerMarkdown";

type VisualizerDetailsPanelProps = {
  node: GraphNodeData | null;
  onClose: () => void;
};

export default function VisualizerDetailsPanel({
  node,
  onClose,
}: VisualizerDetailsPanelProps) {
  if (!node) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close details"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-[#e6eaf2] bg-white shadow-[-24px_0_60px_-38px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between border-b border-[#eef1f7] px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b94a7]">
              {node.role}
            </p>
            <h3 className="mt-2 truncate text-xl font-semibold text-[#111827]" title={node.name}>
              {node.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5b6476]">{node.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475467] transition hover:bg-[#f8fafc]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="border-b border-[#eef1f7] pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
              Description
            </p>
            <p className="mt-3 text-sm leading-7 text-[#344054]">
              {node.description || "No description available."}
            </p>
          </section>

          {node.kind === "agent" ? (
            <section className="border-b border-[#eef1f7] pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                LLM
              </p>
              <p className="mt-3 break-words text-sm font-semibold text-[#111827]">
                {node.llm}
              </p>
            </section>
          ) : null}

          {node.detailItems.length > 0 ? (
            <section className="border-b border-[#eef1f7] pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                Details
              </p>
              <div className="mt-4 divide-y divide-[#eef1f7]">
                {node.detailItems.map((item) => (
                  <div
                    key={`${node.id}-${item.label}`}
                    className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                      {item.label}
                    </p>
                    <p className="break-words text-sm font-medium text-[#111827]">
                      {item.value || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {node.kind === "agent" && node.modelDetails?.length ? (
            <section className="border-b border-[#eef1f7] pb-6">
              <details className="group" open>
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                    <span className="inline-flex items-center gap-2">
                        Model Details
                      <ChevronDown className="h-4 w-4 text-[#667085] transition group-open:rotate-180" />
                    </span>
                </summary>
                <div className="mt-4 divide-y divide-[#eef1f7]">
                  {node.modelDetails.map((item) => (
                    <div
                      key={`${node.id}-model-${item.label}`}
                      className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                        {item.label}
                      </p>
                      <p className="break-words text-sm font-medium text-[#111827]">
                        {item.value || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          ) : null}

          {node.expandableDetails?.length
            ? node.expandableDetails.map((section) => (
                <section
                  key={`${node.id}-${section.title}`}
                  className="border-b border-[#eef1f7] pb-6"
                >
                  <details className="group" open>
                    <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                      <span className="inline-flex items-center gap-2">
                        {section.title}
                        <ChevronDown className="h-4 w-4 text-[#667085] transition group-open:rotate-180" />
                      </span>
                    </summary>
                    {section.items.length > 0 ? (
                      <div className="mt-4 space-y-5">
                        {section.items.map((detailGroup, index) => (
                          <div
                            key={`${node.id}-${section.title}-${index}`}
                            className="border-b border-[#eef1f7] pb-4 last:border-b-0"
                          >
                            <p className="mb-3 text-sm font-semibold text-[#111827]">
                              {section.title.slice(0, -1)} {index + 1}
                            </p>
                            <div className="divide-y divide-[#eef1f7]">
                              {detailGroup.map((item) => (
                                <div
                                  key={`${node.id}-${section.title}-${index}-${item.label}`}
                                  className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3"
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b94a7]">
                                    {item.label}
                                  </p>
                                  <p className="break-words text-sm font-medium text-[#111827]">
                                    {item.value || "-"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[#667085]">
                        {section.emptyText ?? "No data available"}
                      </p>
                    )}
                  </details>
                </section>
              ))
            : null}

          {node.longText ? (
            <section className="border-b border-[#eef1f7] pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                {node.kind === "agent" || node.kind === "skill" ? "Instruction" : "Overview"}
              </p>
              <div className="mt-4 space-y-4 break-words">{renderMarkdownBlocks(node.longText)}</div>
            </section>
          ) : null}

          {node.sections?.length ? (
            <section className="pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b94a7]">
                Linked Items
              </p>
              <div className="mt-4 space-y-4">
                {node.sections.map((section) => (
                  <div
                    key={`${node.id}-${section.title}`}
                    className="border-b border-[#eef1f7] pb-4 last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-[#111827]">{section.title}</p>
                    <div className="mt-3 space-y-2">
                      {section.items.map((item, index) => (
                        <p
                          key={`${node.id}-${section.title}-${index}`}
                          className="break-words text-sm leading-6 text-[#344054]"
                          title={item}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}
