"use client";

import { AGENT_API_BASE_URL, AGENT_HOST, AGENT_ORG_KEY } from "@/config/agent";
import {
  Bot,
  Eye,
  Filter,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Plus,
  Send,
  User,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AgentRecord = {
  agentId: number;
  name: string;
  port: number | null;
  status: string;
  enterprise: string;
  start_time: string | null;
  stop_time: string | null;
};

type ChatMessage = {
  id: string;
  role: "agent" | "user";
  text: string;
  time: string;
};

export default function AgentManagementSection() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    agent: AgentRecord;
    action: "start" | "stop";
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [agentFilter, setAgentFilter] = useState<
    "all" | "running" | "stopped"
  >("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [activeChatAgent, setActiveChatAgent] = useState<AgentRecord | null>(
    null
  );
  const [activeChatKey, setActiveChatKey] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [sendingChatKey, setSendingChatKey] = useState<number | null>(null);
  const [chatThreads, setChatThreads] = useState<
    Record<number, ChatMessage[]>
  >({});
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [openCopyId, setOpenCopyId] = useState<string | null>(null);
  const agentsRef = useRef<AgentRecord[]>([]);
  const requestIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const agentApiBase = AGENT_API_BASE_URL.endsWith("/")
    ? AGENT_API_BASE_URL.slice(0, -1)
    : AGENT_API_BASE_URL;

  const totalAgents = agents.length;

  const filteredAgents = useMemo(() => {
    if (agentFilter === "all") {
      return agents;
    }
    const isRunning = agentFilter === "running";
    return agents.filter((agent) =>
      isRunning
        ? agent.status?.toUpperCase() === "STARTED"
        : agent.status?.toUpperCase() !== "STARTED"
    );
  }, [agents, agentFilter]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const loadAgents = useCallback(
    async (options?: { signal?: AbortSignal; refresh?: boolean }) => {
      const requestId = ++requestIdRef.current;
      const hasData = agentsRef.current.length > 0;
      const shouldRefresh = Boolean(options?.refresh && hasData);

      if (!shouldRefresh) {
        setIsAgentsLoading(true);
        setAgentsError("");
      }

      try {
        const url = `${agentApiBase}/aiops/agent/list?orgKey=${encodeURIComponent(
          AGENT_ORG_KEY
        )}`;
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: options?.signal,
        });
        const data = await response.json();
        console.log("Dashboard agent list response:", {
          ok: response.ok,
          status: response.status,
          data,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (response.ok && Array.isArray(data?.agents)) {
          setAgents(data.agents);
          setAgentsError("");
        } else if (!shouldRefresh) {
          setAgentsError(data?.message || "Unable to load agents.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!shouldRefresh) {
          setAgentsError("Unable to load agents.");
        }
      } finally {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!shouldRefresh) {
          setIsAgentsLoading(false);
        }
      }
    },
    [agentApiBase]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAgents({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAgents]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadAgents({ refresh: true });
      }
    };

    const handleFocus = () => loadAgents({ refresh: true });
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadAgents]);

  const handleConfirmToggle = async () => {
    if (!pendingAction || isUpdating) {
      return;
    }

    const { agent, action } = pendingAction;
    setIsUpdating(true);
    setUpdateError("");

    try {
      const url = `${agentApiBase}/aiops/agent/${action}?agentId=${encodeURIComponent(
        agent.agentId
      )}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const data = await response.json();
      console.log(`Agent ${action} response:`, {
        ok: response.ok,
        status: response.status,
        data,
      });

      if (!response.ok) {
        setUpdateError(
          data?.message || `Unable to ${action} ${agent.name}.`
        );
        return;
      }

      const updatedAgent = {
        ...agent,
        status: action === "start" ? "STARTED" : "STOPPED",
        port:
          action === "start"
            ? typeof data?.port === "number"
              ? data.port
              : agent.port
            : null,
      };

      setAgents((prev) =>
        prev.map((item) => {
          if (item.agentId !== agent.agentId) {
            return item;
          }
          return updatedAgent;
        })
      );
      window.dispatchEvent(
        new CustomEvent("agents:statusChanged", {
          detail: {
            agentId: updatedAgent.agentId,
            enterprise: updatedAgent.enterprise,
            status: updatedAgent.status,
            port: updatedAgent.port,
            action,
          },
        })
      );
      setPendingAction(null);
    } catch (error) {
      setUpdateError(`Unable to ${action} ${agent.name}.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const closeSeeAll = () => {
    setIsSeeAllOpen(false);
    setIsFilterOpen(false);
  };

  const formatTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const openChat = (agent: AgentRecord) => {
    const chatKey = agent.port ?? null;
    setActiveChatAgent(agent);
    setActiveChatKey(chatKey);
    setChatError("");
    setChatInput("");
    if (chatKey === null) {
      setChatError("Agent is not running.");
      return;
    }
    setChatThreads((prev) => {
      if (prev[chatKey]) {
        return prev;
      }
      return {
        ...prev,
        [chatKey]: [
          {
            id: `${chatKey}-welcome`,
            role: "agent",
            text: "I am Agent and I'm ready to help.",
            time: formatTime(),
          },
        ],
      };
    });
  };

  const closeChat = () => {
    setChatThreads({});
    setActiveChatAgent(null);
    setActiveChatKey(null);
    setChatInput("");
    setChatError("");
    setSendingChatKey(null);
  };

  const resolveChatEndpoint = (agent: AgentRecord) => {
    const enterprise = (agent.enterprise ?? "").toLowerCase();
    if (enterprise.includes("servicenow")) {
      return "serviceNow";
    }
    if (enterprise.includes("mq")) {
      return "mq";
    }
    return "mule";
  };

  const appendMessage = (chatKey: number, message: ChatMessage) => {
    setChatThreads((prev) => ({
      ...prev,
      [chatKey]: [...(prev[chatKey] ?? []), message],
    }));
  };

  const sendMessage = async (overrideMessage?: string) => {
    if (!activeChatAgent) {
      return;
    }
    if (activeChatKey === null) {
      setChatError("Agent is not running.");
      return;
    }
    const trimmed = (overrideMessage ?? chatInput).trim();
    if (!trimmed) {
      return;
    }
    if (!activeChatAgent.port) {
      setChatError("Agent is not running.");
      return;
    }

    const agentId = activeChatAgent.agentId;
    const chatKey = activeChatKey;
    const endpoint = resolveChatEndpoint(activeChatAgent);
    const url = `${AGENT_HOST}:${activeChatAgent.port}/agent/${endpoint}/chat`;

    const userMessage: ChatMessage = {
      id: `${chatKey}-user-${Date.now()}`,
      role: "user",
      text: trimmed,
      time: formatTime(),
    };
    appendMessage(chatKey, userMessage);
    setChatInput("");
    setSendingChatKey(chatKey);
    setChatError("");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          agent_id: String(agentId),
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();
      let data: unknown = rawText;
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      }
      console.log("Agent chat response:", {
        ok: response.ok,
        status: response.status,
        data,
      });

      const replyText =
        typeof data === "string"
          ? data
          : typeof data === "object" && data !== null && "response" in data
            ? String((data as { response?: string }).response ?? "")
            : typeof data === "object" && data !== null && "message" in data
              ? String((data as { message?: string }).message ?? "")
              : typeof data === "object"
                ? JSON.stringify(data)
                : String(data);

      appendMessage(chatKey, {
        id: `${chatKey}-agent-${Date.now()}`,
        role: "agent",
        text: replyText || "Agent responded.",
        time: formatTime(),
      });
    } catch (error) {
      appendMessage(chatKey, {
        id: `${chatKey}-agent-error-${Date.now()}`,
        role: "agent",
        text: "Unable to reach agent right now. Please check the agent connection.",
        time: formatTime(),
      });
    } finally {
      setSendingChatKey((prev) => (prev === chatKey ? null : prev));
    }
  };

  const handleSendMessage = () => {
    void sendMessage();
  };

  useEffect(() => {
    if (!activeChatAgent || !chatScrollRef.current) {
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [activeChatAgent, chatThreads, sendingChatKey]);

  const activeMessages =
    activeChatKey !== null ? chatThreads[activeChatKey] ?? [] : [];
  const lastActivityTime =
    activeMessages.length > 0
      ? activeMessages[activeMessages.length - 1].time
      : "--";
  const showSuggestions = activeMessages.length <= 1;
  const isServiceNowAgent = (activeChatAgent?.enterprise ?? "")
    .toLowerCase()
    .includes("servicenow");
  const quickSuggestions = isServiceNowAgent
    ? ["Show today incidents", "Show all incidents"]
    : ["Show stopped apps", "List critical alerts", "Summarize recent activity"];
  const MAX_MESSAGE_PREVIEW = 260;
  const handleQuickSuggestion = (suggestion: string) => {
    void sendMessage(suggestion);
  };
  const renderMessageText = (text: string) => {
    const segments: React.ReactNode[] = [];
    let buffer = "";
    let bold = false;
    let keyIndex = 0;

    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "*" && text[i + 1] === "*") {
        if (buffer) {
          segments.push(
            bold ? (
              <strong key={`b-${keyIndex++}`}>{buffer}</strong>
            ) : (
              buffer
            )
          );
          buffer = "";
        }
        bold = !bold;
        i += 1;
        continue;
      }
      buffer += text[i];
    }

    if (buffer) {
      segments.push(
        bold ? <strong key={`b-${keyIndex++}`}>{buffer}</strong> : buffer
      );
    }

    return segments;
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-38px_rgba(16,24,40,0.5)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Bot className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold text-[#111827]">
              Agent management
            </h3>
            <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
              {totalAgents}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#5b6476]">
            Start/stop live actions and inspect recent activity.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] px-3 py-2 text-sm font-medium text-[#111827] shadow-[0_6px_14px_-12px_rgba(16,24,40,0.3)]"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          {isFilterOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.3)]">
              {[
                { label: "All", value: "all" },
                { label: "Running", value: "running" },
                { label: "Stopped", value: "stopped" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAgentFilter(option.value as "all" | "running" | "stopped");
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    agentFilter === option.value
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#111827] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {agentFilter !== "all" ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
          {agentFilter === "running" ? "Running" : "Stopped"}
          <button
            type="button"
            onClick={() => setAgentFilter("all")}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="mt-6 max-h-[430px] space-y-4 overflow-y-auto pr-2 no-scrollbar">
        {isAgentsLoading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
              <Bot className="h-4 w-4" />
            </span>
            Loading agents...
          </div>
        ) : agentsError ? (
          <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-6 text-sm text-[#b91c1c] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
            {agentsError}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
            No agents yet.
          </div>
        ) : (
          filteredAgents.map((agent) => {
            const isRunning = agent.status?.toUpperCase() === "STARTED";
            const isMule =
              (agent.enterprise ?? "").trim().toLowerCase() === "mule";
            const runningAt = agent.port
              ? agent.port.toString()
              : "Agent Not Started";
            return (
              <div
                key={agent.agentId}
                className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {agent.name}
                      </p>
                      <p className="text-xs text-[#647087]">
                        Running at: {runningAt} 
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#647087]">
                    <span>{isRunning ? "Running" : "Stopped"}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({
                          agent,
                          action: isRunning ? "stop" : "start",
                        })
                      }
                      disabled={isUpdating}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                        isRunning ? "bg-[#5b4cf0]" : "bg-[#e3e6ee]"
                      } ${isUpdating ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <span
                        className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                          isRunning ? "left-5" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openChat(agent)}
                    disabled={!isRunning}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                      isRunning
                        ? "bg-[#cfefff] text-[#0b7ed9]"
                        : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat with agent
                  </button>
                  <button
                    type="button"
                    disabled={!isMule}
                    className={`flex items-center justify-center gap-2 rounded-xl border border-[#e1e5ef] px-4 py-2 text-sm font-medium text-[#3a4355] ${
                      isMule
                        ? "bg-white hover:bg-[#f3f4f6]"
                        : "bg-[#f9fafb] opacity-60 cursor-not-allowed"
                    }`}
                  >
                    View Logs
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsSeeAllOpen(true);
          setIsFilterOpen(false);
        }}
        className="mt-5 w-full rounded-xl bg-[#4f49e2] py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(79,73,226,0.6)]"
      >
        See All
      </button>

      {isSeeAllOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)] max-h-[92vh]">
            <div className="flex items-start justify-between border-b border-[#eef1f7] px-8 py-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-[#111827]">
                    Agent management
                  </h3>
                  <span className="rounded-md border border-[#cbd2ff] px-2 py-0.5 text-xs font-semibold text-[#5b4cf0]">
                    {totalAgents}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#5b6476]">
                  Start/stop live actions and inspect recent activity.
                </p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-[#e3e7f2] px-3 py-2 text-sm font-medium text-[#111827] shadow-[0_6px_14px_-12px_rgba(16,24,40,0.3)]"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
                {isFilterOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.3)]">
                    {[
                      { label: "All", value: "all" },
                      { label: "Running", value: "running" },
                      { label: "Stopped", value: "stopped" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setAgentFilter(option.value as "all" | "running" | "stopped");
                          setIsFilterOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm ${
                          agentFilter === option.value
                            ? "bg-[#eef2ff] text-[#4f49e2]"
                            : "text-[#111827] hover:bg-[#f3f4f6]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 max-h-[620px]">
              {agentFilter !== "all" ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5f0] bg-white px-3 py-1 text-xs font-semibold text-[#4f49e2]">
                  {agentFilter === "running" ? "Running" : "Stopped"}
                  <button
                    type="button"
                    onClick={() => setAgentFilter("all")}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f49e2]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              {isAgentsLoading ? (
                <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
                  Loading agents...
                </div>
              ) : agentsError ? (
                <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-5 py-6 text-sm text-[#b91c1c] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
                  {agentsError}
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-6 text-sm text-[#647087] shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]">
                  No agents yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredAgents.map((agent) => {
                    const isRunning = agent.status?.toUpperCase() === "STARTED";
                    const isMule =
                      (agent.enterprise ?? "").trim().toLowerCase() === "mule";
                    const runningAt = agent.port
                      ? agent.port.toString()
                      : "Agent Not Started";
                    return (
                      <div
                        key={`modal-${agent.agentId}`}
                        className="rounded-2xl border border-[#eef1f7] bg-white px-5 py-4 shadow-[0_10px_30px_-28px_rgba(16,24,40,0.4)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecebff] text-[#5b4cf0]">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#111827]">
                                {agent.name}
                              </p>
                              <p className="text-xs text-[#647087]">
                                Running at: {runningAt} - v1.0.0
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#647087]">
                            <span>{isRunning ? "Running" : "Stopped"}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingAction({
                                  agent,
                                  action: isRunning ? "stop" : "start",
                                })
                              }
                              disabled={isUpdating}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                                isRunning ? "bg-[#5b4cf0]" : "bg-[#e3e6ee]"
                              } ${
                                isUpdating ? "cursor-not-allowed opacity-70" : ""
                              }`}
                            >
                              <span
                                className={`absolute h-4 w-4 rounded-full bg-white shadow transition ${
                                  isRunning ? "left-5" : "left-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => openChat(agent)}
                            disabled={!isRunning}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                              isRunning
                                ? "bg-[#cfefff] text-[#0b7ed9]"
                                : "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]"
                            }`}
                          >
                            <MessageCircle className="h-4 w-4" />
                            Chat with agent
                          </button>
                          <button
                            type="button"
                            disabled={!isMule}
                            className={`flex items-center justify-center gap-2 rounded-xl border border-[#e1e5ef] px-4 py-2 text-sm font-medium text-[#3a4355] ${
                              isMule
                                ? "bg-white hover:bg-[#f3f4f6]"
                                : "bg-[#f9fafb] opacity-60 cursor-not-allowed"
                            }`}
                          >
                            View Logs
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-center border-t border-[#eef1f7] px-8 py-4">
              <button
                type="button"
                onClick={closeSeeAll}
                className="text-sm font-semibold text-[#4f49e2] hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#eef1f7] px-6 py-4">
              <h4 className="text-lg font-semibold text-[#111827]">
                {pendingAction.action === "start" ? "Start Agent" : "Stop Agent"}
              </h4>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to{" "}
                {pendingAction.action === "start" ? "start" : "stop"}{" "}
                <span className="font-semibold text-[#111827]">
                  {pendingAction.agent.name}
                </span>
                ?
              </p>
              {updateError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{updateError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={isUpdating}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white ${
                  isUpdating
                    ? "cursor-not-allowed bg-[#c7c4f7]"
                    : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] hover:bg-[#433ccf]"
                }`}
              >
                {isUpdating
                  ? pendingAction.action === "start"
                    ? "Starting..."
                    : "Stopping..."
                  : pendingAction.action === "start"
                    ? "Start"
                    : "Stop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeChatAgent ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-6 py-8">
          <div className="flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.7)]">
            <div className="flex items-center justify-between border-b border-[#eef1f7] px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-[#111827]">
                    {activeChatAgent.name}
                  </h4>
                  <p className="text-sm text-[#6b7280]">Agent chat</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#6b7280]">
                    <span className="h-3 w-3 rounded-full bg-[#16a34a]" />
                    <span>Online</span>
                    <span className="text-[#cbd5e1]">&middot;</span>
                    <span>
                      Running at: {activeChatAgent.port ?? "Agent Not Started"}
                    </span>
                    <span className="text-[#cbd5e1]">&middot;</span>
                    <span>Last activity: {lastActivityTime}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChat}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 px-8 pb-6 pt-4">
              <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-[#e6eaf3] bg-[#f7f8fc]">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Bot className="h-56 w-56 text-[#d9def0] opacity-20" />
                </div>
                <div
                  ref={chatScrollRef}
                  className="soft-scrollbar relative z-10 h-full min-h-0 overflow-y-auto overflow-x-hidden p-5"
                >
                  {activeMessages.map((message, index) => {
                    const isUser = message.role === "user";
                    const isGrouped =
                      index > 0 &&
                      activeMessages[index - 1].role === message.role;
                    const showAvatar = !isGrouped;
                    const isError = message.id.includes("agent-error");
                    const isExpanded = Boolean(expandedMessages[message.id]);
                    const isLong = message.text.length > MAX_MESSAGE_PREVIEW;
                    const displayText =
                      isLong && !isExpanded
                        ? `${message.text.slice(0, MAX_MESSAGE_PREVIEW)}...`
                        : message.text;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isUser ? "justify-end" : "justify-start"
                        } ${showAvatar ? "mb-6" : "mb-4"}`}
                      >
                        {isUser ? (
                          <div
                            className={`flex min-w-0 max-w-[72%] items-start gap-3 ${
                              showAvatar ? "" : "pr-12"
                            }`}
                          >
                            <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] shadow-sm">
                              {showAvatar ? (
                                <div className="mb-1 flex items-center justify-end gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a94a6]">
                                  <span className="normal-case text-[#9aa3b2]">
                                    {message.time}
                                  </span>
                                  <span>You</span>
                                </div>
                              ) : null}
                              <p className="whitespace-pre-wrap break-all text-right">
                                {displayText}
                              </p>
                              {isLong ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMessages((prev) => ({
                                      ...prev,
                                      [message.id]: !prev[message.id],
                                    }))
                                  }
                                  className="mt-2 text-xs font-semibold text-[#4f49e2]"
                                >
                                  {isExpanded ? "Show less" : "Show more"}
                                </button>
                              ) : null}
                            </div>
                          {showAvatar ? (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-[#111827]">
                              <User className="h-5 w-5" />
                            </div>
                          ) : null}
                          </div>
                        ) : (
                          <div
                            className={`flex min-w-0 max-w-[72%] items-start gap-3 ${
                              showAvatar ? "" : "pl-12"
                            }`}
                          >
                            {showAvatar ? (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                                <Bot className="h-5 w-5" />
                              </div>
                            ) : null}
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                isError
                                  ? "border border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
                                  : "bg-[#edf1f8] text-[#1f2937]"
                              }`}
                            >
                              {showAvatar ? (
                                <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a94a6]">
                                  <span>{activeChatAgent?.name ?? "Agent"}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="normal-case text-[#9aa3b2]">
                                      {message.time}
                                    </span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenCopyId((prev) =>
                                            prev === message.id ? null : message.id
                                          )
                                        }
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-[#6b7280] transition hover:text-[#4f49e2]"
                                        aria-label="More actions"
                                        title="More actions"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                      {openCopyId === message.id ? (
                                        <div className="absolute right-0 z-20 mt-2 overflow-hidden rounded-md border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (navigator?.clipboard) {
                                                void navigator.clipboard.writeText(
                                                  message.text
                                                );
                                              }
                                              setOpenCopyId(null);
                                            }}
                                            className="w-full px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-[#374151] hover:bg-[#f3f4f6]"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              <p className="whitespace-pre-wrap break-all">
                                {renderMessageText(displayText)}
                              </p>
                              {isLong ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMessages((prev) => ({
                                      ...prev,
                                      [message.id]: !prev[message.id],
                                    }))
                                  }
                                  className={`mt-2 text-xs font-semibold ${
                                    isError
                                      ? "text-[#b91c1c]"
                                      : "text-[#4f49e2]"
                                  }`}
                                >
                                  {isExpanded ? "Show less" : "Show more"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-[#eef1f7] px-8 py-4">
              {showSuggestions ? (
                <div className="mb-3 flex flex-nowrap justify-center gap-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleQuickSuggestion(suggestion)}
                      className="rounded-full border border-[#dbe2f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#4f49e2] shadow-sm transition hover:border-[#bfc7e8]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              {sendingChatKey === activeChatKey && activeChatKey !== null ? (
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#8a94a6]">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#a5b4fc]" />
                  <span>
                    Agent is typing
                    <span className="typing-dots">....</span>
                  </span>
                </div>
              ) : null}
              {chatError ? (
                <div className="mb-3 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-2 text-xs font-semibold text-[#b91c1c]">
                  {chatError}
                </div>
              ) : null}
              <div className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f7f8fc] px-4 py-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e1e5ef] bg-white text-[#4f49e2] shadow-sm"
                  aria-label="Add"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask something..."
                  className="flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9ca3af]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Voice"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e5ef] bg-white text-[#4f49e2] shadow-sm"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={
                      sendingChatKey === activeChatKey && activeChatKey !== null
                    }
                    className="flex items-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(79,73,226,0.9)] transition hover:bg-[#433ccf] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
