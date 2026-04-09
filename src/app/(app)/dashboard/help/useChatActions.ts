"use client";

import { useCallback } from "react";
import {
  getSessionsUrl,
  getSessionUrl,
  mapEventsToMessages,
  sortSessions,
  formatTime,
} from "./help.chat";
import type { AdkSession, ChatMessage } from "../dashboard.types";

export function useChatActions({
  adkBaseUrl,
  appName,
  userId,

  // state setters
  sessions,
  setSessions,
  selectedSessionId,
  setSelectedSessionId,
  setIsDraftSession,
  setMessages,
  setMessageMilestones,
  setExpandedMilestones,
  setSessionsError,
  setDeletingSessionId,
  setOpenMenuSessionId,
  setPendingUserMessage,
  setSendError,
  setIsSending,
  setIsStreamingReply,
  setStreamSteps,

  // external functions
  loadSessionMessages,
  loadSessions,
  runPromptSse,
  startStreamingState,
  resetStreamingText,
}: any) {

  // ✅ CREATE SESSION
  const createSession = useCallback(async () => {
    setSessionsError("");

    try {
      const res = await fetch(getSessionsUrl(adkBaseUrl, appName, userId), {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await res.json()) as AdkSession;

      if (!res.ok || !payload?.id) {
        setSessionsError("Unable to create session.");
        return null;
      }

      setSessions((prev: AdkSession[]) =>
        sortSessions([payload, ...prev.filter((s) => s.id !== payload.id)])
      );

      setSelectedSessionId(payload.id);
      setIsDraftSession(false);

      const mapped = mapEventsToMessages(payload.events);
      setMessages(mapped.messages);
      setMessageMilestones(mapped.milestonesByMessageId);
      setExpandedMilestones({});

      return payload.id;
    } catch {
      setSessionsError("Unable to create session.");
      return null;
    }
  }, [adkBaseUrl, appName, userId]);

  // ✅ DELETE SESSION
  const deleteSession = useCallback(
    async (sessionId: string) => {
      setDeletingSessionId(sessionId);
      setSessionsError("");

      try {
        const res = await fetch(
          getSessionUrl(adkBaseUrl, appName, userId, sessionId),
          {
            method: "DELETE",
            headers: { accept: "application/json" },
          }
        );

        if (!res.ok) {
          setSessionsError("Unable to delete session.");
          return;
        }

        const nextSessions = sessions.filter((s: AdkSession) => s.id !== sessionId);
        setSessions(nextSessions);
        setOpenMenuSessionId(null);

        if (selectedSessionId === sessionId) {
          const nextId = nextSessions[0]?.id ?? null;

          setSelectedSessionId(nextId);
          setIsDraftSession(false);

          if (nextId) {
            await loadSessionMessages(nextId);
          } else {
            setMessages([]);
            setMessageMilestones({});
          }
        }
      } catch {
        setSessionsError("Unable to delete session.");
      } finally {
        setDeletingSessionId(null);
      }
    },
    [sessions, selectedSessionId, adkBaseUrl, appName, userId]
  );

  // ✅ SEND PROMPT
  const sendPrompt = useCallback(
    async (prompt: string, options?: { optimisticUser?: boolean }) => {
      const text = prompt.trim();
      if (!text) return false;

      if (options?.optimisticUser) {
        setPendingUserMessage({
          id: `pending-${Date.now()}`,
          role: "user",
          text,
          timeLabel: formatTime(),
        } as ChatMessage);
      }

      setSendError("");
      setIsSending(true);
      startStreamingState();

      try {
        let sessionId = selectedSessionId;

        if (!sessionId) {
          sessionId = await createSession();
        }

        if (!sessionId) {
          setSendError("No session available.");
          setPendingUserMessage(null);
          return false;
        }

        const streamed = await runPromptSse(sessionId, text);

        if (!streamed) {
          setSendError("Streaming failed.");
          setPendingUserMessage(null);
          return false;
        }

        await loadSessions({ preferredSessionId: sessionId, silent: true });

        setPendingUserMessage(null);
        return true;
      } catch {
        setSendError("Unable to send message.");
        setPendingUserMessage(null);
        return false;
      } finally {
        setIsSending(false);
        setIsStreamingReply(false);
        resetStreamingText();
        setStreamSteps([]);
      }
    },
    [
      selectedSessionId,
      createSession,
      runPromptSse,
      loadSessions,
      startStreamingState,
    ]
  );

  return {
    createSession,
    deleteSession,
    sendPrompt,
  };
}