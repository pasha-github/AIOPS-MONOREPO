"use client";

import { ClipboardCopy } from "lucide-react";

export type ExportAgentPayload = {
    name: string;
    description: string;
    prompt_role: string;
    prompt_objectives: string;
    prompt_behavior: string;
    prompt_output_format: string;
    prompt_constraints: string;
    prompt_safety: string;
    prompt_tools_instructions: string;
    prompt_policy: string;
    prompt_examples: string;
    prompt_additional_info: string;
};

type ExportAgentProps = {
    payload: ExportAgentPayload;
    fileName?: string | null;
    onExport?: (message: string, tone?: "success" | "error") => void;
};

const copyTextFallback = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
        throw new Error("Clipboard copy failed.");
    }
};

const copyTextToClipboard = async (value: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    copyTextFallback(value);
};

export default function ExportAgent({ payload, onExport }: ExportAgentProps) {
    const handleExport = async () => {
        try {
            await copyTextToClipboard(JSON.stringify(payload, null, 2));
            onExport?.("Agent Content has been Copied.");
        } catch {
            onExport?.("Unable to copy agent content.", "error");
        }
    };

    return (
        <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#cfd8ea] bg-white px-4 py-2 text-sm font-semibold text-[#4f46e5] shadow-sm transition hover:border-[#b8c4ff] hover:bg-[#f4f6ff] active:scale-95"
        >
            <ClipboardCopy className="h-4 w-4" />
            Export Agent
        </button>
    );
}
