import { useCallback } from "react";
import {
  getSessionsUrl,
  getSessionUrl,
  sortSessions,
  mapEventsToMessages,
} from "./help.chat";

import type { AdkSession, ChatMessage } from "../dashboard.types";

type UseSessionsProps = {
  adkBaseUrl: string;
  appName: string;
  userId: string;

  // setters
  setSessions: (data: AdkSession[]) => void;
  setSelectedSessionId: (id: string | null) => void;
  setIsDraftSession: (val: boolean) => void;

  setMessages: (data: ChatMessage[]) => void;
  setMessageMilestones: (data: Record<string, any>) => void;
  setExpandedMilestones: (data: Record<string, boolean>) => void;

  setSessionsError: (err: string) => void;
  setMessagesError: (err: string) => void;

  setIsLoadingSessions: (val: boolean) => void;
  setIsLoadingMessages: (val: boolean) => void;

  selectedSessionIdRef: React.MutableRefObject<string | null>;
};

export const useSessions = ({
  adkBaseUrl,
  appName,
  userId,
  setSessions,
  setSelectedSessionId,
  setIsDraftSession,
  setMessages,
  setMessageMilestones,
  setExpandedMilestones,
  setSessionsError,
  setMessagesError,
  setIsLoadingSessions,
  setIsLoadingMessages,
  selectedSessionIdRef,
}: UseSessionsProps) => {
  
  // 1. loadSessionMessages (moved)
  const loadSessionMessages = useCallback(
    async (sessionId: string, options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);

      if (!silent) {
        setIsLoadingMessages(true);
      }

      setMessagesError("");

      try {
        const response = await fetch(
          getSessionUrl(adkBaseUrl, appName, userId, sessionId),
          {
            headers: { accept: "application/json" },
          }
        );

        const payload = (await response.json()) as AdkSession;

        if (!response.ok) {
          if (!silent) {
            setMessages([]);
            setMessageMilestones({});
            setExpandedMilestones({});
          }

          setMessagesError("Unable to load session messages.");
          return [] as ChatMessage[];
        }

        const mapped = mapEventsToMessages(payload.events);

        setMessages(mapped.messages);
        setMessageMilestones(mapped.milestonesByMessageId);
        setExpandedMilestones({});

        return mapped.messages;
      } catch {
        if (!silent) {
          setMessages([]);
          setMessageMilestones({});
          setExpandedMilestones({});
        }

        setMessagesError("Unable to load session messages.");
        return [] as ChatMessage[];
      } finally {
        if (!silent) {
          setIsLoadingMessages(false);
        }
      }
    },
    [adkBaseUrl, appName, userId]
  );

  // 2. loadSessions (updated to use above)
  const loadSessions = useCallback(
    async (options?: { preferredSessionId?: string | null; silent?: boolean }) => {
      const silent = Boolean(options?.silent);

      if (!silent) {
        setIsLoadingSessions(true);
      }

      setSessionsError("");

      try {
        const response = await fetch(
          getSessionsUrl(adkBaseUrl, appName, userId),
          {
            headers: { accept: "application/json" },
          }
        );

        const payload = (await response.json()) as AdkSession[];

        if (!response.ok || !Array.isArray(payload)) {
          if (!silent) {
            setSessions([]);
            setSelectedSessionId(null);
            setIsDraftSession(true);
            setMessages([]);
            setMessageMilestones({});
            setExpandedMilestones({});
          }

          setSessionsError("Unable to load sessions.");
          return [] as ChatMessage[];
        }

        const sorted = sortSessions(payload);
        setSessions(sorted);

        const selectedIdToKeep =
          options?.preferredSessionId ?? selectedSessionIdRef.current;

        const nextSessionId =
          sorted.find((item) => item.id === selectedIdToKeep)?.id ?? null;

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
          return [] as ChatMessage[];
        }
      } catch {
        if (!silent) {
          setSessions([]);
          setSelectedSessionId(null);
          setIsDraftSession(true);
          setMessages([]);
          setMessageMilestones({});
          setExpandedMilestones({});
        }

        setSessionsError("Unable to load sessions.");
        return [] as ChatMessage[];
      } finally {
        if (!silent) {
          setIsLoadingSessions(false);
        }
      }
    },
    [
      adkBaseUrl,
      appName,
      userId,
      loadSessionMessages,
      setSessions,
      setSelectedSessionId,
      setIsDraftSession,
      setMessages,
      setMessageMilestones,
      setExpandedMilestones,
      setSessionsError,
      setIsLoadingSessions,
      selectedSessionIdRef,
    ]
  );

  return {
    loadSessions,
    loadSessionMessages,
  };
};