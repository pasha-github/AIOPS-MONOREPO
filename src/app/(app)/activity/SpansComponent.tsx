"use client";

import { trimTrailingSlash } from "@/config/agent";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers3,
  type LucideIcon,
  MessageSquareText,
  Network,
  Sparkles,
  TimerReset,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RawSpanPayload = {
  name?: unknown;
  span_id?: unknown;
  trace_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  attributes?: unknown;
  parent_span_id?: unknown;
};

type SpanRecord = {
  id: string;
  parentId: string | null;
  name: string;
  traceId: string;
  startTimeNs: number;
  endTimeNs: number;
  durationNs: number;
  attributes: Record<string, unknown>;
};

type SpanNode = SpanRecord & {
  children: SpanNode[];
};

type SpansComponentProps = {
  baseUrl: string;
  agentId: string | null;
  sessionId: string | null;
};

const spanIcons: Record<"tool" | "llm" | "agent" | "invocation" | "default", LucideIcon> = {
  tool: Wrench,
  llm: MessageSquareText,
  agent: Bot,
  invocation: Sparkles,
  default: Network,
};

const formatLatency = (durationNs: number) => {
  if (!Number.isFinite(durationNs) || durationNs <= 0) {
    return "0ms";
  }

  if (durationNs >= 1_000_000_000) {
    return `${(durationNs / 1_000_000_000).toFixed(2)}s`;
  }

  if (durationNs >= 1_000_000) {
    return `${(durationNs / 1_000_000).toFixed(2)}ms`;
  }

  if (durationNs >= 1_000) {
    return `${(durationNs / 1_000).toFixed(2)}us`;
  }

  return `${Math.round(durationNs)}ns`;
};

const formatSpanTimestamp = (valueNs: number) => {
  if (!Number.isFinite(valueNs) || valueNs <= 0) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(valueNs / 1_000_000));
};

const normalizeIdentifier = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }

  return "";
};

const normalizeTimeValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeAttributes = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};

const normalizeSpans = (payload: unknown) => {
  if (!Array.isArray(payload)) {
    return [] as SpanRecord[];
  }

  return payload
    .map((item) => {
      const span = item as RawSpanPayload;
      const id = normalizeIdentifier(span.span_id);
      if (!id) {
        return null;
      }

      const startTimeNs = normalizeTimeValue(span.start_time);
      const endTimeNs = normalizeTimeValue(span.end_time);
      const durationNs = Math.max(0, endTimeNs - startTimeNs);

      return {
        id,
        parentId: normalizeIdentifier(span.parent_span_id) || null,
        name:
          (typeof span.name === "string" && span.name.trim()) || "Unnamed span",
        traceId: normalizeIdentifier(span.trace_id),
        startTimeNs,
        endTimeNs,
        durationNs,
        attributes: normalizeAttributes(span.attributes),
      } satisfies SpanRecord;
    })
    .filter((item): item is SpanRecord => item !== null)
    .sort((left, right) => left.startTimeNs - right.startTimeNs);
};

const buildSpanTree = (spans: SpanRecord[]) => {
  const nodeMap = new Map<string, SpanNode>();

  spans.forEach((span) => {
    nodeMap.set(span.id, { ...span, children: [] });
  });

  const roots: SpanNode[] = [];

  spans.forEach((span) => {
    const node = nodeMap.get(span.id);
    if (!node) {
      return;
    }

    if (span.parentId && nodeMap.has(span.parentId)) {
      nodeMap.get(span.parentId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  const sortChildren = (nodes: SpanNode[]) => {
    nodes.sort((left, right) => left.startTimeNs - right.startTimeNs);
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);
  return roots;
};

const getSpanIconKey = (name: string): keyof typeof spanIcons => {
  const normalized = name.trim().toLowerCase();

  if (normalized.includes("execute_tool") || normalized.includes("tool")) {
    return "tool";
  }

  if (normalized.includes("call_llm") || normalized.includes("generate_content")) {
    return "llm";
  }

  if (normalized.includes("invoke_agent")) {
    return "agent";
  }

  if (normalized.includes("invocation")) {
    return "invocation";
  }

  return "default";
};

function SpansSkeleton() {
  return (
    <div className="rounded-[28px] border border-[#e8edf7] bg-white p-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-full bg-[#e8edf7]" />
          <div className="h-6 w-64 animate-pulse rounded-full bg-[#e8edf7]" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-2xl bg-[#eef2ff]" />
      </div>

      <div className="mt-6 space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`span-skeleton-${index}`} className="flex items-center gap-4">
            <div className="h-9 w-9 animate-pulse rounded-2xl bg-[#eef2ff]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-44 animate-pulse rounded-full bg-[#e8edf7]" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-[#f0f3f8]" />
            </div>
            <div className="h-8 w-[38%] animate-pulse rounded-xl bg-[#dfe8ff]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptySpansState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex min-h-[210px] items-center justify-center overflow-hidden rounded-2xl bg-white px-6 py-10 text-center">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <Network className="h-48 w-48 text-[#4f49e2]/[0.06]" strokeWidth={1.2} />
      </div>
      <div className="relative z-10 mx-auto max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#eef2ff] text-[#4f49e2] shadow-[0_18px_35px_-24px_rgba(79,73,226,0.7)]">
          <Layers3 className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#111827]">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#5f677a]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SpanRow({
  node,
  depth,
  traceStartNs,
  traceDurationNs,
}: {
  node: SpanNode;
  depth: number;
  traceStartNs: number;
  traceDurationNs: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = spanIcons[getSpanIconKey(node.name)];
  const hasChildren = node.children.length > 0;
  const safeTraceDurationNs = traceDurationNs > 0 ? traceDurationNs : 1;
  const leftPercent = Math.max(
    0,
    ((node.startTimeNs - traceStartNs) / safeTraceDurationNs) * 100
  );
  const widthPercent = Math.max(
    1.5,
    (node.durationNs / safeTraceDurationNs) * 100
  );
  const boundedLeftPercent = Math.min(leftPercent, 100);
  const boundedWidthPercent = Math.min(widthPercent, 100 - boundedLeftPercent);
  const agentName =
    typeof node.attributes["gen_ai.agent.name"] === "string"
      ? String(node.attributes["gen_ai.agent.name"])
      : "";
  const toolName =
    typeof node.attributes["gen_ai.tool.name"] === "string"
      ? String(node.attributes["gen_ai.tool.name"])
      : "";
  const modelName =
    typeof node.attributes["gen_ai.request.model"] === "string"
      ? String(node.attributes["gen_ai.request.model"])
      : "";
  const secondaryLabel = toolName || agentName || modelName;

  return (
    <div className="space-y-1.5">
      <div
        className="grid items-center gap-3 rounded-2xl px-2.5 py-2 transition hover:bg-[#f8faff]"
        style={{
          gridTemplateColumns: "minmax(0,1fr) minmax(180px,50%)",
          paddingLeft: `${10 + depth * 22}px`,
        }}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#6b7a90] transition hover:bg-[#eaf0ff] hover:text-[#4f49e2]"
                aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                title={isExpanded ? "Collapse children" : "Expand children"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="h-6 w-6 shrink-0" aria-hidden="true" />
            )}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2] shadow-[0_10px_24px_-20px_rgba(79,73,226,0.8)]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">
                {node.name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#748096]">
                <span>{formatLatency(node.durationNs)}</span>
                {secondaryLabel ? (
                  <>
                    <span className="text-[#c0c7d6]">|</span>
                    <span className="truncate">{secondaryLabel}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative h-6 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded-xl bg-[linear-gradient(135deg,#a78bfa_0%,#5b4cf0_100%)] shadow-[0_16px_28px_-20px_rgba(91,76,240,0.7)]"
              style={{
                left: `${boundedLeftPercent}%`,
                width: `${boundedWidthPercent}%`,
              }}
            />
          </div>
          <span className="min-w-[60px] text-right text-xs font-semibold text-[#556277]">
            {formatLatency(node.durationNs)}
          </span>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <SpanRow
              key={child.id}
              node={child}
              depth={depth + 1}
              traceStartNs={traceStartNs}
              traceDurationNs={traceDurationNs}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SpansComponent({
  baseUrl,
  agentId,
  sessionId,
}: SpansComponentProps) {
  const [spans, setSpans] = useState<SpanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!baseUrl || !agentId || !sessionId) {
      setSpans([]);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadSpans = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${trimTrailingSlash(baseUrl)}/observability/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            headers: { accept: "application/json" },
            signal: controller.signal,
          }
        );

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error("Unable to load observability spans.");
        }

        setSpans(normalizeSpans(payload));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setSpans([]);
        setError("Unable to load observability spans right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadSpans();
    return () => controller.abort();
  }, [agentId, baseUrl, sessionId]);

  const spanTree = useMemo(() => buildSpanTree(spans), [spans]);
  const totalLatencyNs = useMemo(() => {
    if (spans.length === 0) {
      return 0;
    }

    const minStart = Math.min(...spans.map((span) => span.startTimeNs));
    const maxEnd = Math.max(...spans.map((span) => span.endTimeNs));
    return Math.max(0, maxEnd - minStart);
  }, [spans]);
  const traceStartNs = useMemo(() => {
    if (spans.length === 0) {
      return 0;
    }

    return Math.min(...spans.map((span) => span.startTimeNs));
  }, [spans]);
  const startedAt = traceStartNs;
  const stoppedAt =
    spans.length > 0 ? Math.max(...spans.map((span) => span.endTimeNs)) : 0;

  return (
    <section className="rounded-[28px] border border-[#e8edf7] bg-white p-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#5b4cf0]" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8498]">
                Observability
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-[#4f49e2]" />
              <h2 className="text-2xl font-semibold text-[#111827]">
                Span timeline
              </h2>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex items-start gap-3 rounded-2xl border-[#e6ebf5] px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#4f8fe8]">
              <TimerReset className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                Total latency
              </p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">
                {formatLatency(totalLatencyNs)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border-[#e6ebf5] px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#635bff]">
              <Layers3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                Total spans
              </p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">
                {spans.length || "-"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border-[#e6ebf5] px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eefcf3] text-[#16a34a]">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                Started
              </p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">
                {startedAt ? formatSpanTimestamp(startedAt) : "--"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border-[#e6ebf5] px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff4ec] text-[#f97316]">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8498]">
                Stopped
              </p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">
                {stoppedAt ? formatSpanTimestamp(stoppedAt) : "--"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl p-5">
        

        <div className="mt-5">
          {!agentId || !sessionId ? (
            <EmptySpansState
              title="No Session Selected"
              description="Select both an agent and a session to load span timing, trace hierarchy, and tool execution details."
            />
          ) : isLoading ? (
            <SpansSkeleton />
          ) : error ? (
            <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-4 text-sm text-[#b42318]">
              {error}
            </div>
          ) : spanTree.length === 0 ? (
            <EmptySpansState
              title="No Spans Available"
              description="This session completed without recorded observability spans. New traces will appear here when instrumentation returns span data."
            />
          ) : (
            <div className="space-y-2">
              {spanTree.map((node) => (
                <SpanRow
                  key={node.id}
                  node={node}
                  depth={0}
                  traceStartNs={traceStartNs}
                  traceDurationNs={totalLatencyNs}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
