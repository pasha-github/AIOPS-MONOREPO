import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { buildSpinnerLabel } from "@/Spinnerverb";
import {
    AdkSsePayload,
    StreamStep,
    AdkPart,
    AdkFunctionCall,
    AdkFunctionResponse,
    ChatMessage,
    AdkEvent,
    AdkSession,
} from "./types";

export const DEFAULT_USER_ID = "user";

// ─── URL helpers ──────────────────────────────────────────────────────────────

export const getSessionsUrl = (
  baseUrl: string,
  appName: string,
  userId: string
) => {
  return `${baseUrl}/apps/${appName}/users/${userId}/sessions`;
};

export const getSessionUrl = (
    adkBaseUrl: string,
    appName: string,
    userId: string,
    sessionId: string
) => `${getSessionsUrl(adkBaseUrl, appName, userId)}/${encodeURIComponent(sessionId)}`;

export const getRunSseUrl = (adkBaseUrl: string) => `${adkBaseUrl}/run_sse`;

// ─── Markdown line helpers ─────────────────────────────────────────────────────

export const isHeadingLine = (line: string) => /^(#{1,6})\s+.+$/.test(line.trim());
export const isUnorderedListLine = (line: string) => /^[-*]\s+.+$/.test(line.trim());
export const isOrderedListLine = (line: string) => /^\d+\.\s+.+$/.test(line.trim());
export const isHrLine = (line: string) => /^(\*\*\*|---|___)\s*$/.test(line.trim());
export const isCodeFenceLine = (line: string) => line.trim().startsWith("```");

// ─── Utility helpers ──────────────────────────────────────────────────────────

export const formatMilestoneDetails = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

export const mergeStreamingText = (currentText: string, incomingText: string): string => {
    if (!incomingText) return currentText;
    if (!currentText) return incomingText;
    if (incomingText.startsWith(currentText)) return incomingText;
    if (currentText.endsWith(incomingText)) return currentText;
    return `${currentText}${incomingText}`;
};

export const parseSsePayload = (rawData: string): AdkSsePayload | null => {
    try {
        return JSON.parse(rawData) as AdkSsePayload;
    } catch {
        return null;
    }
};

export const normalizeToolName = (value: string) =>
    value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export const extractVisibleTextFromParts = (parts: AdkPart[]) =>
    parts
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text ?? "")
        .join("");

export const extractFunctionCalls = (parts: AdkPart[]) =>
    parts
        .map((part) => part.functionCall)
        .filter((call): call is AdkFunctionCall => Boolean(call?.name));

export const extractFunctionResponses = (parts: AdkPart[]) =>
    parts
        .map((part) => part.functionResponse)
        .filter((response): response is AdkFunctionResponse => Boolean(response?.name));

export const summarizeStreamError = (errorText: string): string => {
    const compact = errorText.replace(/\s+/g, " ").trim();
    if (compact.toLowerCase().includes("reasoning_content")) {
        return "Model rejected reasoning content from a prior step. Start a new session and try again.";
    }
    if (compact.length <= 180) return compact;
    return "Agent failed while generating a response.";
};

export const formatTime = (timestamp?: number | null): string => {
    if (!timestamp || Number.isNaN(timestamp)) {
        return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const value = timestamp > 9999999999 ? timestamp : timestamp * 1000;
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const normalizeRole = (event: AdkEvent): ChatMessage["role"] | null => {
    const contentRole = String(event.content?.role ?? "").toLowerCase();
    if (contentRole === "user") return "user";
    if (contentRole === "model") return "agent";
    const author = String(event.author ?? "").toLowerCase();
    if (author.includes("user")) return "user";
    if (author) return "agent";
    return null;
};

export const sortSessions = (sessions: AdkSession[]) =>
    [...sessions].sort((a, b) => {
        const aTime = Number(a.lastUpdateTime ?? 0);
        const bTime = Number(b.lastUpdateTime ?? 0);
        return bTime - aTime;
    });

export const mapEventsToMessages = (events: AdkEvent[] | null | undefined) => {
    const source = Array.isArray(events) ? events : [];
    const messages: ChatMessage[] = [];
    const milestonesByMessageId: Record<string, StreamStep[]> = {};
    let pendingMilestones: StreamStep[] = [];
    let stepCounter = 0;

    const addPendingMilestone = (label: string, details?: unknown) => {
        const cleanLabel = label.trim();
        if (!cleanLabel) return;
        stepCounter += 1;
        pendingMilestones.push({
            id: `history-step-${stepCounter}`,
            label: cleanLabel,
            status: "done",
            details: formatMilestoneDetails(details),
        });
    };

    source.forEach((event, index) => {
        const parts = Array.isArray(event.content?.parts) ? event.content.parts : [];
        const functionCalls = extractFunctionCalls(parts);
        const functionResponses = extractFunctionResponses(parts);

        functionCalls.forEach((toolCall) => {
            const toolName = String(toolCall.name ?? "");
            addPendingMilestone(
                buildSpinnerLabel({
                    kind: "running",
                    subject: normalizeToolName(toolName),
                    sequence: stepCounter,
                }),
                {
                tool: toolName,
                args: toolCall.args ?? {},
                }
            );
        });

        functionResponses.forEach((toolResponse) => {
            const toolName = String(toolResponse.name ?? "");
            addPendingMilestone(
                buildSpinnerLabel({
                    kind: "received",
                    subject: normalizeToolName(toolName),
                    suffix: "results",
                    sequence: stepCounter,
                }),
                {
                tool: toolName,
                response: toolResponse.response ?? {},
                }
            );
        });

        const text = extractVisibleTextFromParts(parts).trim();
        const role = normalizeRole(event);
        if (!text || !role) return;

        const messageId = String(event.id ?? `${role}-${index}`);
        messages.push({
            id: messageId,
            role,
            text,
            timeLabel: formatTime(event.timestamp),
        });

        if (role === "agent" && pendingMilestones.length > 0) {
            milestonesByMessageId[messageId] = pendingMilestones.map((step) => ({
                ...step,
                id: `${messageId}-${step.id}`,
            }));
            pendingMilestones = [];
        }
    });

    return { messages, milestonesByMessageId };
};

// ─── Markdown renderers ───────────────────────────────────────────────────────

export const renderMarkdownInline = (text: string, keyPrefix = ""): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = pattern.exec(text)) !== null) {
        const token = match[0];
        const start = match.index;
        if (start > cursor) nodes.push(text.slice(cursor, start));

        if (token.startsWith("**") && token.endsWith("**")) {
            nodes.push(<strong key={`md-${keyPrefix}-${key++}`}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("*") && token.endsWith("*")) {
            nodes.push(<em key={`md-${keyPrefix}-${key++}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith("`") && token.endsWith("`")) {
            nodes.push(
                <code
                    key={`md-${keyPrefix}-${key++}`}
                    className="rounded bg-black/5 px-1 py-0.5 text-[0.95em]"
                >
                    {token.slice(1, -1)}
                </code>
            );
        } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
            const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (linkMatch) {
                nodes.push(
                    <a
                        key={`md-${keyPrefix}-${key++}`}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#3b5bdb] underline"
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

    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
};

export const renderInlineWithLineBreaks = (lines: string[], keyPrefix: string): ReactNode[] =>
    lines.flatMap((line, index) => {
        const nodes = renderMarkdownInline(line, `${keyPrefix}-line-${index}`);
        if (index < lines.length - 1) return [...nodes, <br key={`${keyPrefix}-br-${index}`} />];
        return nodes;
    });

export const parseTableRow = (line: string): string[] =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

export const isTableSeparatorLine = (line: string): boolean => {
    const cells = parseTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

export const renderMarkdownBlocks = (text: string): ReactNode[] => {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { i += 1; continue; }

        if (isCodeFenceLine(trimmed)) {
            const codeLines: string[] = [];
            i += 1;
            while (i < lines.length && !isCodeFenceLine(lines[i])) {
                codeLines.push(lines[i]);
                i += 1;
            }
            if (i < lines.length && isCodeFenceLine(lines[i])) i += 1;
            blocks.push(
                <pre
                    key={`block-code-${i}`}
                    className="overflow-x-auto rounded-xl bg-black/90 px-3 py-2 text-xs text-white"
                >
                    <code>{codeLines.join("\n")}</code>
                </pre>
            );
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const hashes = headingMatch[1].length;
            const headingText = headingMatch[2];
            const content = renderMarkdownInline(headingText, `heading-${i}`);
            if (hashes === 1) {
                blocks.push(
                    <h1 key={`block-h1-${i}`} className="text-xl font-bold leading-8">{content}</h1>
                );
            } else if (hashes === 2) {
                blocks.push(
                    <h2 key={`block-h2-${i}`} className="text-lg font-bold leading-7">{content}</h2>
                );
            } else {
                blocks.push(
                    <h3 key={`block-hx-${i}`} className="text-base font-semibold leading-6">{content}</h3>
                );
            }
            i += 1;
            continue;
        }

        if (line.includes("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
            const headers = parseTableRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length) {
                const rowLine = lines[i];
                if (!rowLine.trim() || !rowLine.includes("|")) break;
                rows.push(parseTableRow(rowLine));
                i += 1;
            }
            blocks.push(
                <div key={`block-table-${i}`} className="overflow-x-auto rounded-xl border border-[#dbe2f0] bg-white/70">
                    <table className="min-w-full border-collapse text-left text-xs">
                        <thead className="bg-[#eef2ff] text-[#1f2937]">
                            <tr>
                                {headers.map((header, headerIndex) => (
                                    <th
                                        key={`table-head-${i}-${headerIndex}`}
                                        className="border-b border-[#dbe2f0] px-3 py-2 font-semibold"
                                    >
                                        {renderMarkdownInline(header, `table-head-${i}-${headerIndex}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr key={`table-row-${i}-${rowIndex}`} className="border-b border-[#e8edf7]">
                                    {headers.map((_, colIndex) => (
                                        <td
                                            key={`table-col-${i}-${rowIndex}-${colIndex}`}
                                            className="px-3 py-2 align-top"
                                        >
                                            {renderMarkdownInline(
                                                row[colIndex] ?? "",
                                                `table-cell-${i}-${rowIndex}-${colIndex}`
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        if (isUnorderedListLine(line)) {
            const listItems: string[] = [];
            while (i < lines.length && isUnorderedListLine(lines[i])) {
                listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
                i += 1;
            }
            blocks.push(
                <ul key={`block-ul-${i}`} className="list-disc space-y-1 pl-5">
                    {listItems.map((item, itemIndex) => (
                        <li key={`ul-item-${i}-${itemIndex}`}>
                            {renderMarkdownInline(item, `ul-${i}-${itemIndex}`)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        if (isOrderedListLine(line)) {
            const listItems: string[] = [];
            while (i < lines.length && isOrderedListLine(lines[i])) {
                listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
                i += 1;
            }
            blocks.push(
                <ol key={`block-ol-${i}`} className="list-decimal space-y-1 pl-5">
                    {listItems.map((item, itemIndex) => (
                        <li key={`ol-item-${i}-${itemIndex}`}>
                            {renderMarkdownInline(item, `ol-${i}-${itemIndex}`)}
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        if (isHrLine(line)) {
            blocks.push(<hr key={`block-hr-${i}`} className="border-[#dbe2f0]" />);
            i += 1;
            continue;
        }

        const paragraphLines: string[] = [];
        while (i < lines.length) {
            const current = lines[i];
            const currentTrim = current.trim();
            const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
            if (
                !currentTrim ||
                isHeadingLine(current) ||
                isUnorderedListLine(current) ||
                isOrderedListLine(current) ||
                isHrLine(current) ||
                isCodeFenceLine(current) ||
                (current.includes("|") && isTableSeparatorLine(nextLine))
            ) break;
            paragraphLines.push(current);
            i += 1;
        }

        if (paragraphLines.length > 0) {
            blocks.push(
                <p key={`block-p-${i}`} className="leading-7">
                    {renderInlineWithLineBreaks(paragraphLines, `p-${i}`)}
                </p>
            );
            continue;
        }

        i += 1;
    }

    return blocks;
};

// ─── Milestone renderer ───────────────────────────────────────────────────────

export const renderMilestones = (
    steps: StreamStep[],
    expandedState: Record<string, boolean>,
    onToggle: (stepId: string) => void
) => (
    <div className="mb-3 rounded-xl border border-[#d4dcf6] bg-white/60 px-3 py-2">
        <div className="space-y-2">
            {steps.map((step, index) => (
                <div key={step.id} className="flex gap-2">
                    <div className="flex w-4 shrink-0 flex-col items-center">
                        <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                                step.status === "done"
                                    ? "bg-[#dcfce7] text-[#16a34a]"
                                    : "bg-[#e0e7ff] text-[#4f49e2]"
                            }`}
                        >
                            {step.status === "done" ? (
                                <Check className="h-2.5 w-2.5" />
                            ) : (
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                            )}
                        </span>
                        {index < steps.length - 1 ? (
                            <span className="mt-1 h-4 w-px bg-[#c5d0f5]" />
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => onToggle(step.id)}
                            disabled={!step.details}
                            className={`flex w-full items-center justify-between gap-2 text-left ${
                                step.details ? "cursor-pointer" : "cursor-default"
                            }`}
                        >
                            <span
                                className={`text-xs ${
                                    step.status === "done"
                                        ? "text-[#374151]"
                                        : "font-semibold text-[#1f2937]"
                                }`}
                            >
                                {step.label}
                            </span>
                            {step.details ? (
                                expandedState[step.id] ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748b]" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#64748b]" />
                                )
                            ) : null}
                        </button>
                        {step.details && expandedState[step.id] ? (
                            <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-[#dbe2f0] bg-white/80 p-2 text-[11px] leading-5 text-[#334155]">
                                {step.details}
                            </pre>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
