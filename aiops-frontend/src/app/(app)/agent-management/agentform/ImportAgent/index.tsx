"use client";

import {
    ModalCard,
    ModalCardBody,
    ModalCardFooter,
    ModalCardHeader,
    ModalCardPanel,
} from "@/components/modalcards";
import { Bot, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExportAgentPayload } from "../../ExportAgent";

export type ImportedAgentPayload = Partial<ExportAgentPayload>;

type ImportAgentProps = {
    onImport: (payload: ImportedAgentPayload) => void;
};

const IMPORT_FIELD_KEYS = [
    "name",
    "description",
    "prompt_role",
    "prompt_objectives",
    "prompt_behavior",
    "prompt_output_format",
    "prompt_constraints",
    "prompt_safety",
    "prompt_tools_instructions",
    "prompt_policy",
    "prompt_examples",
    "prompt_additional_info",
] as const;

const parseAgentJson = (value: string): ImportedAgentPayload | null => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = JSON.parse(trimmed) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }

    const record = parsed as Record<string, unknown>;
    const payload: ImportedAgentPayload = {};

    IMPORT_FIELD_KEYS.forEach((key) => {
        const fieldValue = record[key];
        if (typeof fieldValue === "string") {
            payload[key] = fieldValue;
        }
    });

    return payload;
};

export default function ImportAgent({ onImport }: ImportAgentProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [jsonInput, setJsonInput] = useState("");

    const parsedPayload = useMemo(() => {
        try {
            return parseAgentJson(jsonInput);
        } catch {
            return null;
        }
    }, [jsonInput]);

    const hasInput = jsonInput.trim().length > 0;
    const isInvalidJson = hasInput && !parsedPayload;
    const canPopulate = Boolean(parsedPayload);

    const closeImportModal = () => {
        setIsOpen(false);
        setJsonInput("");
    };

    const handlePopulate = () => {
        if (!parsedPayload) return;

        onImport(parsedPayload);
        closeImportModal();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#cfd8ea] bg-white px-4 py-2 text-sm font-semibold text-[#4f46e5] shadow-sm transition hover:border-[#b8c4ff] hover:bg-[#f4f6ff] active:scale-95"
            >
                <Upload className="h-4 w-4" />
                Import Agent
            </button>

            {isOpen ? (
                <ModalCard
                    zIndexClassName="z-[110]"
                    onBackdropClick={closeImportModal}
                >
                    <ModalCardPanel maxWidthClassName="max-w-2xl">
                        <ModalCardHeader
                            title="Import Agent"
                            subtitle="Paste exported agent content to pre-fill identity and prompt instructions."
                            icon={<Bot className="h-4 w-4" />}
                            onClose={closeImportModal}
                        />

                        <ModalCardBody className="bg-white">
                            

                            {isInvalidJson ? (
                                <p className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-red-600">
                                    Input is not in json Format.
                                </p>
                            ) : null}

                            <textarea
                                value={jsonInput}
                                onChange={(event) => setJsonInput(event.target.value)}
                                placeholder={`{\n  "name": "Customer Support Agent",\n  "description": "Handles customer support requests.",\n  "prompt_role": "You are a helpful support agent."\n}`}
                                className="mt-4 min-h-[240px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                            />
                        </ModalCardBody>

                        <ModalCardFooter className="justify-between bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeImportModal}
                                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePopulate}
                                    disabled={!canPopulate}
                                    className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Populate Agent Fields
                                    <Upload className="h-4 w-4" />
                                </button>
                            </div>
                        </ModalCardFooter>
                    </ModalCardPanel>
                </ModalCard>
            ) : null}
        </>
    );
}
