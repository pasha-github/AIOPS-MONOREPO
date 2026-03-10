"use client";

import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AGENT_API_BASE_URL, AGENT_ORG_KEY, AGENT_WS_HOST } from "@/config/agent";

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  displayedDetail: string;
  tag: "success" | "warning" | "running" | "info";
  timestamp: number;
  timeLabel: string;
};

type ActiveMuleAgent = {
  agentId: number;
  name: string;
  port: number | null;
};

type MuleAgentSelectProps = {
  agents: ActiveMuleAgent[];
  selectedId: number | null;
  onSelect: (agentId: number) => void;
};

function MuleAgentSelect({
  agents,
  selectedId,
  onSelect,
}: MuleAgentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedId) ?? agents[0],
    [agents, selectedId]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  if (!selectedAgent) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.35)] transition focus:border-[#4f49e2] focus:outline-none focus:ring-2 focus:ring-[#4f49e2]/20"
      >
        <span>{selectedAgent.name}</span>
        <ChevronDown className="h-4 w-4 text-[#9aa3b2]" />
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
          {agents.map((agent) => (
            <button
              key={agent.agentId}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSelect(agent.agentId);
              }}
              className={`flex w-full items-center px-4 py-2 text-left text-sm ${
                agent.agentId === selectedAgent.agentId
                  ? "bg-[#eef2ff] text-[#4f49e2]"
                  : "text-[#111827] hover:bg-[#f3f4f6]"
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const activityTagStyles: Record<ActivityEntry["tag"], string> = {
  success: "bg-[#e6f9ee] text-[#16a34a]",
  warning: "bg-[#fff1e7] text-[#f97316]",
  running: "bg-[#e8f0ff] text-[#2563eb]",
  info: "bg-[#eef2ff] text-[#4338ca]",
};

const LOG_SOCKET_HOST = AGENT_WS_HOST;
const MAX_LOG_ENTRIES = 200;
const MESSAGE_DELAY_MS = 250;
const TYPE_SPEED_MS = 12;
const TYPE_CHUNK_SIZE = 3;

const getSocketBase = () => LOG_SOCKET_HOST;

const stripHtml = (value: string) => {
  const withBreaks = value.replace(/<br\s*\/?>/gi, "\n");
  if (typeof window !== "undefined" && "DOMParser" in window) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(withBreaks, "text/html");
    return (doc.body.textContent ?? withBreaks).trim();
  }
  return withBreaks.replace(/<[^>]*>/g, "").trim();
};

const normalizeMessage = (value: string) =>
  stripHtml(value).replace(/\s+\n/g, "\n").trim();

const formatLogPayload = (
  raw: string
): { message: string; time: string; level: string } => {
  try {
    const parsed = JSON.parse(raw) as {
      message?: unknown;
      time?: unknown;
      level?: unknown;
    };
    const messageRaw =
      typeof parsed.message === "string"
        ? parsed.message
        : parsed.message !== undefined
          ? JSON.stringify(parsed.message)
          : raw;
    const message = normalizeMessage(messageRaw || raw) || normalizeMessage(raw);
    const time =
      typeof parsed.time === "string"
        ? parsed.time
        : new Date().toLocaleTimeString();
    const level =
      typeof parsed.level === "string" ? parsed.level.toUpperCase() : "INFO";
    return { message, time, level };
  } catch (error) {
    return {
      message: normalizeMessage(raw),
      time: new Date().toLocaleTimeString(),
      level: "INFO",
    };
  }
};

const getTagFromLevel = (level: string): ActivityEntry["tag"] => {
  const normalized = level.toUpperCase();
  if (normalized === "SUCCESS") {
    return "success";
  }
  if (normalized === "WARN" || normalized === "WARNING" || normalized === "ERROR") {
    return "warning";
  }
  return "running";
};

const parseIncomingLog = (payload: string): ActivityEntry => {
  const { message, time, level } = formatLogPayload(payload);
  const tag = getTagFromLevel(level);
  const title = level === "ERROR" ? "Agent Error" : "Agent Log";

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    detail: message,
    displayedDetail: "",
    tag,
    timestamp: Date.now(),
    timeLabel: time,
  };
};

export default function AgentActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [activeAgent, setActiveAgent] = useState<ActiveMuleAgent | null>(null);
  const [muleAgents, setMuleAgents] = useState<ActiveMuleAgent[]>([]);
  const [selectedMuleId, setSelectedMuleId] = useState<number | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<ActivityEntry[]>([]);
  const typingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const typingIntervalRef = useRef<number | null>(null);

  const handleRefresh = () => {
    setEntries([]);
    queueRef.current = [];
    typingRef.current = false;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typingIntervalRef.current) {
      window.clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnecting(false);
    if (!activeAgent?.port) {
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    const socketUrl = `${getSocketBase()}:${activeAgent.port}/ws/agent?agent_id=${activeAgent.agentId}`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnecting(false);
    };

    socket.onmessage = (event) => {
      console.log("WebSocket log:", event.data);
      const incoming = parseIncomingLog(String(event.data ?? ""));
      queueRef.current.push(incoming);
      if (!typingRef.current) {
        flushQueue();
      }
    };

    socket.onerror = () => {
      setIsConnecting(false);
    };

    socket.onclose = () => {
      setIsConnecting(false);
    };
  };

  const resetSocket = () => {
    setEntries([]);
    queueRef.current = [];
    typingRef.current = false;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typingIntervalRef.current) {
      window.clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnecting(false);
  };

  const flushQueue = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (queueRef.current.length === 0) {
      typingRef.current = false;
      return;
    }
    typingRef.current = true;
    const next = queueRef.current.shift();
    if (!next) {
      typingRef.current = false;
      return;
    }

    const entry: ActivityEntry = { ...next, displayedDetail: "" };

    setEntries((prev) => {
      const updated = [entry, ...prev];
      return updated.length > MAX_LOG_ENTRIES
        ? updated.slice(0, MAX_LOG_ENTRIES)
        : updated;
    });

    let index = 0;
    if (typingIntervalRef.current) {
      window.clearInterval(typingIntervalRef.current);
    }
    typingIntervalRef.current = window.setInterval(() => {
      index = Math.min(entry.detail.length, index + TYPE_CHUNK_SIZE);
      const slice = entry.detail.slice(0, index);
      setEntries((prev) =>
        prev.map((log) =>
          log.id === entry.id ? { ...log, displayedDetail: slice } : log
        )
      );
      if (index >= entry.detail.length) {
        if (typingIntervalRef.current) {
          window.clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        timeoutRef.current = window.setTimeout(() => {
          typingRef.current = false;
          flushQueue();
        }, MESSAGE_DELAY_MS);
      }
    }, TYPE_SPEED_MS);
  };

  useEffect(() => {
    let isMounted = true;

    const loadAgents = async () => {
      setIsLoadingAgents(true);

      try {
        const response = await fetch(
          `${AGENT_API_BASE_URL}aiops/agent/list?orgKey=${AGENT_ORG_KEY}`
        );
        const data = await response.json();
        const agents = Array.isArray(data?.agents) ? data.agents : [];

        const muleList = agents
          .filter((agent: any) => {
            const enterprise = String(agent?.enterprise ?? "").toLowerCase();
            return enterprise === "mule";
          })
          .map((agent: any) => ({
            agentId: Number(agent.agentId),
            name: String(agent.name ?? "Mule Agent"),
            port:
              agent.port === null || agent.port === undefined
                ? null
                : Number(agent.port),
          }));

        if (!isMounted) {
          return;
        }

        setMuleAgents(muleList);

        const preferred =
          muleList.find((agent) => agent.port !== null) ?? muleList[0] ?? null;
        const selected =
          muleList.find((agent) => agent.agentId === selectedMuleId) ??
          preferred;

        if (selected) {
          setSelectedMuleId(selected.agentId);
          setActiveAgent(selected);
        } else {
          setSelectedMuleId(null);
          setActiveAgent(null);
          resetSocket();
        }
      } catch (error) {
        if (isMounted) {
          setActiveAgent(null);
          setMuleAgents([]);
          setSelectedMuleId(null);
          setEntries([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingAgents(false);
        }
      }
    };

    loadAgents();

    const handleFocus = () => {
      loadAgents();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [selectedMuleId]);

  useEffect(() => {
    if (!activeAgent) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnecting(false);
      queueRef.current = [];
      typingRef.current = false;
      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    if (!activeAgent.port) {
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);

    let shouldCloseOnOpen = false;
    const socketUrl = `${getSocketBase()}:${activeAgent.port}/ws/agent?agent_id=${activeAgent.agentId}`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (shouldCloseOnOpen) {
        socket.close();
        return;
      }
      setIsConnecting(false);
    };

    socket.onmessage = (event) => {
      if (shouldCloseOnOpen) {
        return;
      }
      console.log("WebSocket log:", event.data);
      const incoming = parseIncomingLog(String(event.data ?? ""));
      queueRef.current.push(incoming);
      if (!typingRef.current) {
        flushQueue();
      }
    };

    socket.onerror = () => {
      if (!shouldCloseOnOpen) {
        setIsConnecting(false);
      }
    };

    socket.onclose = () => {
      if (shouldCloseOnOpen) {
        return;
      }
      setIsConnecting(false);
    };

    return () => {
      shouldCloseOnOpen = true;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CLOSING ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      typingRef.current = false;
    };
  }, [activeAgent]);

  const headerText = activeAgent
    ? activeAgent.port
      ? `Streaming from ${activeAgent.name} (running at ${activeAgent.port})`
      : `${activeAgent.name} is not running`
    : "Waiting for a Mule agent";

  const renderLogBody = () => (
    <div className="soft-scrollbar mt-6 max-h-[520px] space-y-6 overflow-y-auto pr-2">
      {entries.length === 0 && !activeAgent ? (
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="mt-2 h-full w-px bg-[#e6eaf3]" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  Waiting for Mule logs
                </p>
                <p className="mt-1 text-sm text-[#5f677a]">
                  Start a Mule agent to begin streaming activity logs.
                </p>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center rounded-lg bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-[#4338ca]">
              info
            </span>
          </div>
        </div>
      ) : null}

      {entries.length === 0 && activeAgent ? (
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="mt-2 h-full w-px bg-[#e6eaf3]" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  Listening for logs
                </p>
                <p className="mt-1 text-sm text-[#5f677a]">
                  {isConnecting
                    ? "Connecting to live Mule logs..."
                    : "No new activity yet."}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#8a94a6]">
                <Bell className="h-3.5 w-3.5" />
                {isConnecting ? "Connecting" : "Just now"}
              </div>
            </div>
            <span className="mt-3 inline-flex items-center rounded-lg bg-[#e8f0ff] px-2.5 py-1 text-xs font-semibold text-[#2563eb]">
              running
            </span>
          </div>
        </div>
      ) : null}

      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="mt-2 h-full w-px bg-[#e6eaf3]" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  <span className="inline-flex items-center gap-2">
                    <Bot className="h-6 w-8 text-[#5b4cf0]" />
                  </span>
                </p>
                <p className="mt-1 text-sm text-[#5f677a]">
                  {entry.displayedDetail || entry.detail}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#8a94a6]">
                <Bell className="h-3.5 w-3.5" />
                {entry.timeLabel}
              </div>
            </div>
            <span
              className={`mt-3 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                activityTagStyles[entry.tag]
              }`}
            >
              {entry.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f9ee] text-[#16a34a]">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">
              {activeAgent?.name ?? "MuleSoft Agent"}
            </h3>
            <p className="mt-1 text-sm text-[#5b6476]">
              {isLoadingAgents ? "Checking for Mule agent..." : headerText}
            </p>
          </div>
        </div>
        <div className="mt-1 inline-flex items-center gap-2">
          {muleAgents.length > 0 ? (
            <MuleAgentSelect
              agents={muleAgents}
              selectedId={selectedMuleId}
              onSelect={(nextId) => {
                resetSocket();
                setSelectedMuleId(nextId);
                const nextAgent =
                  muleAgents.find((agent) => agent.agentId === nextId) ?? null;
                setActiveAgent(nextAgent);
              }}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setIsMaximized(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)] transition hover:text-[#4f49e2]"
            aria-label="Maximize logs"
            title="Maximize logs"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)] transition hover:text-[#4f49e2]"
            aria-label="Refresh logs"
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {renderLogBody()}

      {isMaximized ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
          <div className="flex h-[80vh] w-[80vw] flex-col rounded-3xl bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f9ee] text-[#16a34a]">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#111827]">
                    {activeAgent?.name ?? "MuleSoft Agent"}
                  </h3>
                  <p className="mt-1 text-sm text-[#5b6476]">
                    {isLoadingAgents ? "Checking for Mule agent..." : headerText}
                  </p>
                </div>
              </div>
              <div className="mt-1 inline-flex items-center gap-2">
                {muleAgents.length > 0 ? (
                  <MuleAgentSelect
                    agents={muleAgents}
                    selectedId={selectedMuleId}
                    onSelect={(nextId) => {
                      resetSocket();
                      setSelectedMuleId(nextId);
                      const nextAgent =
                        muleAgents.find((agent) => agent.agentId === nextId) ??
                        null;
                      setActiveAgent(nextAgent);
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsMaximized(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e7f2] bg-white text-[#6b7280] shadow-[0_8px_16px_-14px_rgba(16,24,40,0.4)] transition hover:text-[#4f49e2]"
                  aria-label="Minimize logs"
                  title="Minimize logs"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="soft-scrollbar h-full overflow-y-auto pr-2">
                <div className="h-0" />
                {renderLogBody()}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
