"use client";

import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
} from "@/components/modalcards";
import { ChevronDown, FileArchive, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import FileUploadKnowledge from "../../agent-management/agentform/addknowledge/file-upload";
type SkillsTopbarProps = {
  apiBase: string;
  totalSkills: number;
  totalTools: number;
  totalConnectors: number;
  totalMcpInUse: number;
  isLoading?: boolean;
  onCreate: () => void;
  onSkillUploaded: () => Promise<void> | void;
};

export default function SkillsTopbar({
  apiBase,
  totalSkills,
  totalTools,
  totalConnectors,
  totalMcpInUse,
  isLoading = false,
  onCreate,
  onSkillUploaded,
}: SkillsTopbarProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isZipUploadOpen, setIsZipUploadOpen] = useState(false);
  const [zipFiles, setZipFiles] = useState<File[]>([]);
  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const summaryItems = [
    { label: "Total skills", value: totalSkills },
    { label: "Total tools", value: totalTools },
    { label: "Connectors in use", value: totalConnectors },
    { label: "MCP in use", value: totalMcpInUse },
  ];

  useEffect(() => {
    if (!isActionMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isActionMenuOpen]);

  useEffect(() => {
    if (!isToastVisible) return;
    const timer = window.setTimeout(() => setIsToastVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [isToastVisible]);

  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastTone(tone);
    setIsToastVisible(true);
  };

  const handleUploadSkillZip = async () => {
    const file = zipFiles[0];
    if (!file) {
      showToast("Please select a ZIP file first.", "error");
      return;
    }

    setIsUploadingZip(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBase}/skill/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "message" in payload &&
          typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Unable to upload skill ZIP.";
        throw new Error(message);
      }

      showToast("Skill configured successfully.");
      setZipFiles([]);
      setIsZipUploadOpen(false);
      await onSkillUploaded();
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Unable to upload skill ZIP.",
        "error"
      );
    } finally {
      setIsUploadingZip(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white px-8 py-7 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl space-y-4">
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#111827]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#efeefe] text-[#4f49e2]">
              <Sparkles className="h-5 w-5" />
            </span>
            Skills
          </h2>
          <p className="text-sm leading-6 text-[#5b6476]">
            Create and manage reusable skills with front matter, instructions,
            dependencies, tools, and references.
          </p>
        </div>

        <div className="flex items-start gap-6">
          <div className="flex flex-wrap">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="min-w-[120px] border-r border-[#e8edf7] px-5 last:border-r-0"
              >
                <p className="text-xs font-medium text-[#8b95ad]">{item.label}</p>
                <div className="mt-1 min-h-[40px]">
                  {isLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-[#4f49e2]" />
                  ) : (
                    <p className="text-3xl font-semibold tracking-tight text-[#111827]">
                      {item.value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div ref={actionMenuRef} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setIsActionMenuOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4f49e2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)] transition hover:bg-[#3f39d6] active:scale-95"
              aria-expanded={isActionMenuOpen}
              aria-haspopup="menu"
            >
              <span className="h-4 w-4"><SlidersHorizontal className="h-4 w-4" /></span>
              Configure Skill
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isActionMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isActionMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-[#dbe3f3] bg-white py-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onCreate();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[#344054] transition hover:bg-[#f4f6ff] hover:text-[#4f49e2]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f49e2]">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  Configure Manually
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    setIsZipUploadOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[#344054] transition hover:bg-[#f4f6ff] hover:text-[#4f49e2]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f49e2]">
                    <FileArchive className="h-4 w-4" />
                  </span>
                  Upload Zip File
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isZipUploadOpen ? (
        <ModalCard zIndexClassName="z-[95]" onBackdropClick={() => setIsZipUploadOpen(false)}>
          <ModalCardPanel maxWidthClassName="max-w-2xl" className="max-h-[90vh]">
            <ModalCardHeader
              title="Upload Skill Zip File"
              subtitle="Attach a ZIP package for skill import."
              icon={<FileArchive className="h-4 w-4" />}
              onClose={() => setIsZipUploadOpen(false)}
            />
            <ModalCardBody className="overflow-y-auto bg-[#fbfcff]">
              <div className="rounded-2xl border border-indigo-100 bg-white p-3">
                <FileUploadKnowledge
                  files={zipFiles}
                  onFilesChange={setZipFiles}
                  accept=".zip,application/zip,application/x-zip-compressed"
                  allowedExtensions={["zip"]}
                  allowedFileTypesLabel="ZIP"
                  emptyMessage="No ZIP file selected."
                  uploadTitle="Upload or drag and drop ZIP file"
                  multiple={false}
                />
              </div>
            </ModalCardBody>
            <ModalCardFooter className="justify-between bg-slate-50">
              <p className="text-xs font-medium text-[#8a94a6]">
                Upload a valid skill package containing a skill.md file.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsZipUploadOpen(false)}
                  disabled={isUploadingZip}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleUploadSkillZip}
                  disabled={!zipFiles.length || isUploadingZip}
                  className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-lg bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploadingZip ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SlidersHorizontal className="h-4 w-4" />
                  )}
                  {isUploadingZip ? "Uploading..." : "Configure Skill"}
                </button>
              </div>
            </ModalCardFooter>
          </ModalCardPanel>
        </ModalCard>
      ) : null}

      {isToastVisible ? (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`toast-fade relative rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(79,73,226,0.8)] ${
              toastTone === "success" ? "bg-green-600" : "bg-red-500"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="toast-dot-fill absolute inset-0 rounded-full bg-white" />
              </span>
              <span>{toastMessage}</span>
            </div>
            <span className="toast-progress-bar mt-2 block h-0.5 w-full bg-white/70" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
