"use client";

import { buildSpinnerLabel } from "@/Spinnerverb";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    AgentChatWorkspaceProps,
    AdkSession,
    ChatMessage,
    StreamStep,
    AppItem,
} from "./types";
import {
    DEFAULT_USER_ID,
    extractFunctionCalls,
    extractFunctionResponses,
    extractVisibleTextFromParts,
    formatMilestoneDetails,
    formatTime,
    getRunSseUrl,
    getSessionsUrl,
    getSessionUrl,
    mapEventsToMessages,
    mergeStreamingText,
    normalizeToolName,
    parseSsePayload,
    renderMilestones,
    sortSessions,
    summarizeStreamError,
} from "./chat_helpers";

import ChatSidebar from "./components/ChatSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import AgentSidebar from "./components/AgentSidebar";

export default function chatOps({
    agent,
    onClose,
}: AgentChatWorkspaceProps) {
    const { llmManagerApiBaseUrl, agentAdkBaseUrl } = useRuntimeConfig();
    const adkBaseUrl = trimTrailingSlash(agentAdkBaseUrl);
    const adkBaseUrl1 = trimTrailingSlash(llmManagerApiBaseUrl);
    const userId = DEFAULT_USER_ID;

    // ============ STATE ============

    // Session state
    const [sessions, setSessions] = useState<AdkSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [isDraftSession, setIsDraftSession] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");

    // Loading state
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isStreamingReply, setIsStreamingReply] = useState(false);

    // Streaming state
    const [streamingText, setStreamingText] = useState("");
    const [streamSteps, setStreamSteps] = useState<StreamStep[]>([]);
    const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessage | null>(null);
    const [messageMilestones, setMessageMilestones] = useState<Record<string, StreamStep[]>>({});
    const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

    // UI state
    const [sessionsError, setSessionsError] = useState("");
    const [messagesError, setMessagesError] = useState("");
    const [sendError, setSendError] = useState("");
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    // App state
    const [apps, setApps] = useState<AppItem[]>([]);
    const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

    // ============ REFS ============

    const messageListRef = useRef<HTMLDivElement | null>(null);
    const selectedSessionIdRef = useRef<string | null>(null);
    const copyResetTimerRef = useRef<number | null>(null);
    const streamStepCounterRef = useRef(0);
    const streamStepsRef = useRef<StreamStep[]>([]);
    const streamTargetTextRef = useRef("");
    const streamRenderedTextRef = useRef("");
    const streamAnimationFrameRef = useRef<number | null>(null);

    // ============ COMPUTED VALUES ============

    const safeAgent = agent || { agentId: "", name: "" };
    const appName = selectedApp?.agent_id || safeAgent.agentId || "supervisor";
    const assistantDisplayName =
        selectedApp?.name ||
        (safeAgent.name ?? "").trim() ||
        appName ||
        "Agent";

    // ============ EFFECTS ============

    // Fetch available apps on mount
    useEffect(() => {
        const fetchApps = async () => {
            try {
                const response = await fetch(`${adkBaseUrl1}/agent/`, {
                    headers: { accept: "application/json" },
                });

                if (!response.ok) return;

                const data: AppItem[] = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    const visibleApps = data.filter(
                        (app) =>
                            String(app.type ?? "").trim().toLowerCase() !== "automation"
                    );

                    setApps(visibleApps);

                    const defaultApp =
                        visibleApps.find((a) => a.agent_id === "supervisor") || visibleApps[0] || null;

                    setSelectedApp(defaultApp);
                }
            } catch (error) {
                console.error("Error fetching apps:", error);
            }
        };

        fetchApps();
    }, [adkBaseUrl1]);

    // Sync selectedSessionId to ref
    useEffect(() => {
        selectedSessionIdRef.current = selectedSessionId;
    }, [selectedSessionId]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleOutside = (event: MouseEvent) => {
            if ((event.target as HTMLElement)?.closest("[data-session-menu='true']")) return;
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTo({
                top: messageListRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages, pendingUserMessage, streamingText, isSending]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
            if (streamAnimationFrameRef.current) window.cancelAnimationFrame(streamAnimationFrameRef.current);
        };
    }, []);

    // Load sessions when app changes
    useEffect(() => {
        if (!selectedApp) return;
        setSelectedSessionId(null);
        setIsDraftSession(true);
        setMessages([]);
        setMessageMilestones({});
        setExpandedMilestones({});

        loadSessions();
    }, [selectedApp]);

    // ============ CORE FUNCTIONS ============
    const loadSessionMessages = useCallback(
        async (sessionId: string, options?: { silent?: boolean }) => {
            const silent = Boolean(options?.silent);
            if (!silent) setIsLoadingMessages(true);
            setMessagesError("");

            try {
                const url = getSessionUrl(adkBaseUrl, appName, userId, sessionId);
                // console.log("Loading messages from:", url);

                const response = await fetch(url, {
                    headers: { accept: "application/json" },
                });

                if (!response.ok) {
                    throw new Error(`Failed to load messages: ${response.status}`);
                }

                const payload = (await response.json()) as AdkSession;
                const mapped = mapEventsToMessages(payload.events);

                setMessages(mapped.messages);
                setMessageMilestones(mapped.milestonesByMessageId);
                setExpandedMilestones({});

                return mapped.messages;
            } catch (error) {
                console.error("Error loading messages:", error);
                if (!silent) {
                    setMessages([]);
                    setMessageMilestones({});
                    setExpandedMilestones({});
                    setMessagesError("Unable to load session messages.");
                }
                return [];
            } finally {
                if (!silent) setIsLoadingMessages(false);
            }
        },
        [adkBaseUrl, appName, userId]
    );

    const loadSessions = useCallback(
        async (options?: { preferredSessionId?: string | null; silent?: boolean }) => {
            const silent = Boolean(options?.silent);
            if (!silent) setIsLoadingSessions(true);
            setSessionsError("");

            try {
                const url = getSessionsUrl(adkBaseUrl, appName, userId);
                 console.log("Loading sessions from:", url);

                const response = await fetch(url, {
                    headers: { accept: "application/json" },
                });

                if (!response.ok) {
                    throw new Error(`Failed to load sessions: ${response.status}`);
                }

                const payload = await response.json();
                //console.log("Raw sessions payload:", payload);
                if (!Array.isArray(payload)) {
                    throw new Error("Invalid session response - expected array");
                }

                const sorted = sortSessions(payload);
                setSessions(sorted);

                const selectedIdToKeep =
                    options?.preferredSessionId ?? selectedSessionIdRef.current;

                const nextSessionId = sorted.find((item) => item.id === selectedIdToKeep)?.id ?? null;

                setSelectedSessionId(nextSessionId);
                setIsDraftSession(!nextSessionId);

                if (nextSessionId) {
                    return await loadSessionMessages(nextSessionId, { silent });
                } else {
                    if (!silent) {
                        setMessages([]);
                        setMessageMilestones({});
                        setExpandedMilestones({});
                    }
                    return [];
                }
            } catch (error) {
                console.error("Error loading sessions:", error);

                if (!silent) {
                    setSessions([]);
                    setSelectedSessionId(null);
                    setIsDraftSession(true);
                    setMessages([]);
                    setMessageMilestones({});
                    setExpandedMilestones({});
                    setSessionsError("Unable to load sessions.");
                }
                return [];
            } finally {
                if (!silent) setIsLoadingSessions(false);
            }
        },
        [adkBaseUrl, appName, userId, loadSessionMessages]
    );

    // ============ STREAMING FUNCTIONS ============

    const resetStreamingText = useCallback(() => {
        if (streamAnimationFrameRef.current) {
            window.cancelAnimationFrame(streamAnimationFrameRef.current);
        }
        streamTargetTextRef.current = "";
        streamRenderedTextRef.current = "";
        setStreamingText("");
    }, []);

    const animateStreamingText = useCallback(() => {
        if (streamAnimationFrameRef.current) return;

        const tick = () => {
            const target = streamTargetTextRef.current;
            const current = streamRenderedTextRef.current;

            if (current === target) {
                streamAnimationFrameRef.current = null;
                return;
            }

            const remaining = Math.max(0, target.length - current.length);
            const step = Math.max(
                12,
                Math.min(220, Math.ceil(Math.max(target.length, remaining) / 35))
            );
            const next = target.slice(0, current.length + step);
            streamRenderedTextRef.current = next;
            setStreamingText(next);

            if (next === target) {
                streamAnimationFrameRef.current = null;
            } else {
                streamAnimationFrameRef.current = window.requestAnimationFrame(tick);
            }
        };

        streamAnimationFrameRef.current = window.requestAnimationFrame(tick);
    }, []);

    const updateStreamingTargetText = useCallback(
        (nextText: string, options?: { immediate?: boolean }) => {
            streamTargetTextRef.current = nextText;

            if (options?.immediate) {
                if (streamAnimationFrameRef.current) {
                    window.cancelAnimationFrame(streamAnimationFrameRef.current);
                }
                streamRenderedTextRef.current = nextText;
                setStreamingText(nextText);
                return;
            }

            animateStreamingText();
        },
        [animateStreamingText]
    );

    const startStreamingState = useCallback(() => {
        streamStepCounterRef.current = 0;
        resetStreamingText();
        setStreamSteps([]);
        streamStepsRef.current = [];
        setIsStreamingReply(true);
    }, [resetStreamingText]);

    const addRunningStep = useCallback((label: string, details?: unknown) => {
        const cleanLabel = label.trim();
        if (!cleanLabel) return;
        const formattedDetails = formatMilestoneDetails(details);

        setStreamSteps((prev) => {
            if (prev.length === 0) {
                streamStepCounterRef.current += 1;
                const created = [
                    {
                        id: `stream-step-${streamStepCounterRef.current}`,
                        label: cleanLabel,
                        status: "running" as const,
                        details: formattedDetails,
                    },
                ];
                streamStepsRef.current = created;
                return created;
            }

            const next = [...prev];
            const lastIndex = next.length - 1;
            const lastStep = next[lastIndex];

            if (lastStep.label === cleanLabel) {
                const mergedStep =
                    formattedDetails && !lastStep.details
                        ? { ...lastStep, details: formattedDetails }
                        : lastStep;
                next[lastIndex] = mergedStep;
                return next;
            }

            if (lastStep.status === "running") {
                next[lastIndex] = { ...lastStep, status: "done" };
            }

            streamStepCounterRef.current += 1;
            next.push({
                id: `stream-step-${streamStepCounterRef.current}`,
                label: cleanLabel,
                status: "running",
                details: formattedDetails,
            });
            streamStepsRef.current = next;
            return next;
        });
    }, []);

    const completeLastRunningStep = useCallback(() => {
        setStreamSteps((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (next[lastIndex].status === "running") {
                next[lastIndex] = { ...next[lastIndex], status: "done" };
            }
            streamStepsRef.current = next;
            return next;
        });
    }, []);

    const toggleMilestoneExpansion = useCallback((stepId: string) => {
        setExpandedMilestones((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
    }, []);

    const processSseFrame = useCallback(
        (frame: string): boolean => {
            const lines = frame.split("\n");
            const dataLines: string[] = [];

            lines.forEach((line) => {
                if (line.startsWith("data:")) {
                    dataLines.push(line.slice(5).trimStart());
                }
            });

            const rawData = dataLines.join("\n").trim();
            if (!rawData) return true;

            if (rawData === "[DONE]") {
                completeLastRunningStep();
                return true;
            }

            const payload = parseSsePayload(rawData);
            if (!payload) return true;

            if (payload.error) {
                addRunningStep("Request failed", { error: payload.error });
                completeLastRunningStep();
                setSendError(summarizeStreamError(payload.error));
                return false;
            }

            const parts = Array.isArray(payload.content?.parts) ? payload.content.parts : [];
            const visibleText = extractVisibleTextFromParts(parts);
            const functionCalls = extractFunctionCalls(parts);
            const functionResponses = extractFunctionResponses(parts);

            functionCalls.forEach((toolCall) => {
                const toolName = String(toolCall.name ?? "");
                addRunningStep(
                    buildSpinnerLabel({
                        kind: "running",
                        subject: normalizeToolName(toolName),
                        sequence: streamStepCounterRef.current,
                    }),
                    {
                    tool: toolName,
                    args: toolCall.args ?? {},
                    }
                );
            });

            const confirmations = payload.actions?.requestedToolConfirmations;
            if (
                confirmations &&
                Object.keys(confirmations).length > 0 &&
                functionCalls.length === 0
            ) {
                addRunningStep("Awaiting tool confirmation");
            }

            functionResponses.forEach((toolResponse) => {
                const toolName = String(toolResponse.name ?? "");
                addRunningStep(
                    buildSpinnerLabel({
                        kind: "received",
                        subject: normalizeToolName(toolName),
                        suffix: "results",
                        sequence: streamStepCounterRef.current,
                    }),
                    {
                    tool: toolName,
                    response: toolResponse.response ?? {},
                    }
                );
            });

            if (visibleText) {
                const mergedText = mergeStreamingText(streamTargetTextRef.current, visibleText);
                if (payload.partial === false) {
                    updateStreamingTargetText(mergedText);
                    completeLastRunningStep();
                } else {
                    updateStreamingTargetText(mergedText);
                }
            } else if (payload.partial === false && functionCalls.length === 0) {
                completeLastRunningStep();
            }

            return true;
        },
        [addRunningStep, completeLastRunningStep, updateStreamingTargetText]
    );

    const runPromptSse = useCallback(
        async (sessionId: string, prompt: string) => {
            const url = getRunSseUrl(adkBaseUrl);
            console.log("Sending prompt to:", url);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    accept: "text/event-stream",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    appName,
                    userId,
                    sessionId,
                    streaming: true,
                    newMessage: { role: "user", parts: [{ text: prompt }] },
                }),
            });

            if (!response.ok || !response.body) {
                console.error("Failed to get SSE response:", response.status);
                return false;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let streamOk = true;
            let shouldStop = false;

            while (!shouldStop) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
                let separatorIndex = buffer.indexOf("\n\n");

                while (separatorIndex !== -1) {
                    const frame = buffer.slice(0, separatorIndex).trim();
                    buffer = buffer.slice(separatorIndex + 2);

                    if (frame) {
                        const frameOk = processSseFrame(frame);
                        if (!frameOk) {
                            streamOk = false;
                            shouldStop = true;
                            break;
                        }
                    }

                    separatorIndex = buffer.indexOf("\n\n");
                }
            }

            if (shouldStop) {
                try {
                    await reader.cancel();
                } catch {
                    // ignore
                }
            } else {
                const tail = buffer.trim();
                if (tail) {
                    const tailOk = processSseFrame(tail);
                    if (!tailOk) streamOk = false;
                }
            }

            completeLastRunningStep();
            return streamOk;
        },
        [adkBaseUrl, appName, userId, processSseFrame, completeLastRunningStep]
    );

    // ============ SESSION FUNCTIONS ============

    const createSession = useCallback(async () => {
        setSessionsError("");

        try {
            const url = getSessionsUrl(adkBaseUrl, appName, userId);
            // console.log("Creating session at:", url);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });

            const payload = (await response.json()) as AdkSession;

            if (!response.ok || !payload?.id) {
                throw new Error("Failed to create session");
            }

            setSessions((prev) =>
                sortSessions([payload, ...prev.filter((item) => item.id !== payload.id)])
            );
            setSelectedSessionId(payload.id);
            setIsDraftSession(false);

            const mapped = mapEventsToMessages(payload.events);
            setMessages(mapped.messages);
            setMessageMilestones(mapped.milestonesByMessageId);
            setExpandedMilestones({});

            return payload.id;
        } catch (error) {
            console.error("Error creating session:", error);
            setSessionsError("Unable to create session.");
            return null;
        }
    }, [adkBaseUrl, appName, userId]);

    const deleteSession = useCallback(
        async (sessionId: string) => {
            setSessionsError("");

            try {
                const url = getSessionUrl(adkBaseUrl, appName, userId, sessionId);
                // console.log("Deleting session at:", url);

                const response = await fetch(url, {
                    method: "DELETE",
                    headers: { accept: "application/json" },
                });

                if (!response.ok) {
                    throw new Error("Failed to delete session");
                }

                const nextSessions = sessions.filter((item) => item.id !== sessionId);
                setSessions(nextSessions);

                if (selectedSessionId === sessionId) {
                    const nextId = nextSessions[0]?.id ?? null;
                    setSelectedSessionId(nextId);
                    setIsDraftSession(!nextId);

                    if (nextId) {
                        await loadSessionMessages(nextId);
                    } else {
                        setMessages([]);
                        setMessageMilestones({});
                    }
                }
            } catch (error) {
                console.error("Error deleting session:", error);
                setSessionsError("Unable to delete session.");
            }
        },
        [adkBaseUrl, appName, userId, sessions, selectedSessionId, loadSessionMessages]
    );

    const startNewChat = useCallback(() => {
        setSelectedSessionId(null);
        setIsDraftSession(true);
        setMessages([]);
        setMessageMilestones({});
        setExpandedMilestones({});
        setPendingUserMessage(null);
        setIsStreamingReply(false);
        resetStreamingText();
        streamStepsRef.current = [];
        setStreamSteps([]);
        setMessagesError("");
        setSendError("");
        setDraft("");
    }, [resetStreamingText]);

    // ============ MESSAGE FUNCTIONS ============

    const sendPrompt = useCallback(
        async (prompt: string, options?: { optimisticUser?: boolean }) => {
            const text = prompt.trim();
            if (!text || isSending) return false;

            if (options?.optimisticUser) {
                setPendingUserMessage({
                    id: `pending-user-${Date.now()}`,
                    role: "user",
                    text,
                    timeLabel: formatTime(),
                });
            }

            setSendError("");
            setIsSending(true);
            startStreamingState();

            try {
                let sessionId = selectedSessionId;

                if (!sessionId) {
                    // console.log("No session, creating new one...");
                    sessionId = await createSession();
                }

                if (!sessionId) {
                    throw new Error("Could not create or get session");
                }

                // console.log("Sending message to session:", sessionId);
                const streamed = await runPromptSse(sessionId, text);

                if (!streamed) {
                    setSendError((prev) => prev || "Unable to send message.");
                    setPendingUserMessage(null);
                    return false;
                }

                await loadSessions({ preferredSessionId: sessionId, silent: true });
                setPendingUserMessage(null);
                return true;
            } catch (error) {
                console.error("Error sending prompt:", error);
                setSendError("Unable to send message.");
                setPendingUserMessage(null);
                return false;
            } finally {
                setIsSending(false);
                setIsStreamingReply(false);
                resetStreamingText();
                streamStepsRef.current = [];
                setStreamSteps([]);
            }
        },
        [
            selectedSessionId,
            isSending,
            createSession,
            runPromptSse,
            loadSessions,
            resetStreamingText,
            startStreamingState,
        ]
    );

    const sendMessage = useCallback(async () => {
        setSendError("");
        const prompt = draft.trim();

        if (!prompt || isSending) return;

        setDraft("");
        const sent = await sendPrompt(prompt, { optimisticUser: true });

        if (!sent) {
            setDraft(prompt);
        }
    }, [draft, isSending, sendPrompt]);

    const lastUserPrompt = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") return messages[i].text;
        }
        return "";
    }, [messages]);

    const retryLastPrompt = useCallback(async () => {
        if (!lastUserPrompt || isSending) return;
        await sendPrompt(lastUserPrompt);
    }, [isSending, lastUserPrompt, sendPrompt]);

    const copyMessage = async (messageId: string, text: string) => {
        if (!navigator?.clipboard) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);

            if (copyResetTimerRef.current) {
                window.clearTimeout(copyResetTimerRef.current);
            }

            copyResetTimerRef.current = window.setTimeout(() => {
                setCopiedMessageId((prev) => (prev === messageId ? null : prev));
            }, 1400);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    // ============ COMPUTED VALUES ============

    const selectedSessionLabel = useMemo(
        () =>
            selectedSessionId
                ? selectedSessionId
                : isDraftSession
                    ? "New chat"
                    : "No session selected",
        [selectedSessionId, isDraftSession]
    );

    const visibleMessages = useMemo(() => {
        if (!pendingUserMessage) return messages;

        const last = messages[messages.length - 1];

        if (last?.role === "user" && last.text === pendingUserMessage.text)
            return messages;

        return [...messages, pendingUserMessage];
    }, [messages, pendingUserMessage]);

    const isInitialSessionView =
        !isLoadingMessages && !isStreamingReply && visibleMessages.length === 0;

    // ============ RENDER ============

    return (
        <div className="-m-10 flex h-[calc(100vh-73px)] min-h-0 overflow-hidden bg-white">
            {/* Left Sidebar - Sessions */}
            <ChatSidebar
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                isLoadingSessions={isLoadingSessions}
                sessionsError={sessionsError}
                isSending={isSending}
                onNewChat={startNewChat}
                onSelectSession={(id) => {
                    setSelectedSessionId(id);
                    setIsDraftSession(false);
                    void loadSessionMessages(id);
                }}
                onDeleteSession={deleteSession}
            />

            {/* Center - Chat Area */}
            <section className="flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden">
                <ChatHeader
                    assistantDisplayName={assistantDisplayName}
                    appName={appName}
                    selectedSessionLabel={selectedSessionLabel}
                    onClose={onClose}
                />

                <ChatMessages
                    ref={messageListRef}
                    isLoadingMessages={isLoadingMessages}
                    isInitialSessionView={isInitialSessionView}
                    visibleMessages={visibleMessages}
                    isStreamingReply={isStreamingReply}
                    streamingText={streamingText}
                    streamSteps={streamSteps}
                    messageMilestones={messageMilestones}
                    expandedMilestones={expandedMilestones}
                    assistantDisplayName={assistantDisplayName}
                    copiedMessageId={copiedMessageId}
                    lastUserPrompt={lastUserPrompt}
                    isSending={isSending}
                    sendError={sendError}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={() => void sendMessage()}
                    onToggleMilestone={toggleMilestoneExpansion}
                    onCopyMessage={copyMessage}
                    onRetry={retryLastPrompt}
                />

                {!isInitialSessionView && (
                    <ChatInput
                        draft={draft}
                        isSending={isSending}
                        messagesError={messagesError}
                        sendError={sendError}
                        onDraftChange={setDraft}
                        onSend={sendMessage}
                    />
                )}
            </section>

            {/* Right Sidebar - Apps */}
            <AgentSidebar
                assistantDisplayName={assistantDisplayName}
                appName={appName}
                apps={apps}
                selectedApp={selectedApp}
                onSelectApp={setSelectedApp}
            />
        </div>
    );
}
