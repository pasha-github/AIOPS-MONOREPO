"use client";

import { useRuntimeConfig } from "@/config/runtime-config";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentSessionDetail,
  AgentSessionSummary,
  AutomationAgentOption,
} from "../dashboard/logs";
import {
  deleteAgentSession,
  fetchAutomationAgents,
  fetchAgentSessionDetail,
  fetchAgentSessions,
  resolveAgentManagerApiBase,
  resolveLogsApiBase,
} from "../dashboard/logs";
import AgentLogDetails from "./AgentLogDetails";
import TopBar from "./TopBar";
import UserActivityTable from "./UserActivityTable";

export default function ActivityExplorer() {
  const { agentAdkBaseUrl, llmManagerApiBaseUrl } = useRuntimeConfig();
  const logsApiBaseUrl = resolveLogsApiBase(agentAdkBaseUrl);
  const agentManagerApiBaseUrl = resolveAgentManagerApiBase(llmManagerApiBaseUrl);
  const [agents, setAgents] = useState<AutomationAgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, AgentSessionDetail>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const sessionDetailsRef = useRef<Record<string, AgentSessionDetail>>({});
  const selectedSessionIdRef = useRef<string | null>(null);
  const selectedAgentIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionDetailsRef.current = sessionDetails;
  }, [sessionDetails]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  const loadSessionDetail = useCallback(
    async (sessionId: string, options?: { force?: boolean; signal?: AbortSignal }) => {
      if (!options?.force && sessionDetailsRef.current[sessionId]) {
        return sessionDetailsRef.current[sessionId];
      }

      setLoadingSessionId(sessionId);
      try {
        const detail = await fetchAgentSessionDetail(
          sessionId,
          options?.signal,
          logsApiBaseUrl,
          selectedAgentIdRef.current ?? undefined
        );
        setSessionDetails((current) => {
          const next = { ...current, [sessionId]: detail };
          sessionDetailsRef.current = next;
          return next;
        });
        return detail;
      } finally {
        setLoadingSessionId((current) => (current === sessionId ? null : current));
      }
    },
    [logsApiBaseUrl]
  );

  const loadSessions = useCallback(
    async (refresh = false, signal?: AbortSignal) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError("");

      try {
        const appName = selectedAgentIdRef.current ?? undefined;
        const nextSessions = await fetchAgentSessions(signal, logsApiBaseUrl, appName);
        const nextSelectedSessionId =
          (selectedSessionIdRef.current &&
          nextSessions.some((session) => session.id === selectedSessionIdRef.current)
            ? selectedSessionIdRef.current
            : nextSessions[0]?.id) ?? null;

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelectedSessionId);
          if (refresh) {
            sessionDetailsRef.current = {};
            setSessionDetails({});
          }
        });

        if (nextSelectedSessionId) {
          const detail = await loadSessionDetail(nextSelectedSessionId, {
            force: refresh,
            signal,
          });
          startTransition(() => {
            setSelectedEntryId(detail?.entries[0]?.id ?? null);
          });
        } else {
          setSelectedEntryId(null);
        }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load automation activity right now.");
          setSessions([]);
          setSelectedSessionId(null);
          setSelectedEntryId(null);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadSessionDetail, logsApiBaseUrl]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadAgents = async () => {
      setIsAgentsLoading(true);
      try {
        const nextAgents = await fetchAutomationAgents(
          controller.signal,
          agentManagerApiBaseUrl
        );
        setAgents(nextAgents);
        setSelectedAgentId((current) => {
          if (current && nextAgents.some((agent) => agent.id === current)) {
            return current;
          }
          return nextAgents[0]?.id ?? null;
        });
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setAgents([]);
          setSelectedAgentId(null);
          setError("Unable to load automation agents right now.");
        }
      } finally {
        setIsAgentsLoading(false);
      }
    };

    void loadAgents();
    return () => controller.abort();
  }, [agentManagerApiBaseUrl]);

  useEffect(() => {
    if (isAgentsLoading) {
      return;
    }

    if (!selectedAgentId) {
      setSessions([]);
      setSelectedSessionId(null);
      setSelectedEntryId(null);
      setSessionDetails({});
      sessionDetailsRef.current = {};
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    void loadSessions(false, controller.signal);
    return () => controller.abort();
  }, [isAgentsLoading, loadSessions, selectedAgentId]);

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    void loadSessions(true, controller.signal);
  }, [loadSessions]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      setDeletingSessionId(sessionId);
      setError("");

      try {
        await deleteAgentSession(
          sessionId,
          undefined,
          logsApiBaseUrl,
          selectedAgentIdRef.current ?? undefined
        );
        setSessionDetails((current) => {
          const next = { ...current };
          delete next[sessionId];
          sessionDetailsRef.current = next;
          return next;
        });
        await loadSessions(true);
      } catch {
        setError("Unable to delete the selected session right now.");
      } finally {
        setDeletingSessionId((current) => (current === sessionId ? null : current));
      }
    },
    [loadSessions, logsApiBaseUrl]
  );

  const handleSessionChange = useCallback(
    async (sessionId: string) => {
      setSelectedSessionId(sessionId);
      setSelectedEntryId(null);
      try {
        const detail = await loadSessionDetail(sessionId);
        setSelectedEntryId(detail?.entries[0]?.id ?? null);
      } catch {
        setError("Unable to load the selected automation activity.");
      }
    },
    [loadSessionDetail]
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const selectedDetail = selectedSessionId ? sessionDetails[selectedSessionId] : null;

  const selectedEntry = useMemo(
    () => selectedDetail?.entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [selectedDetail, selectedEntryId]
  );

  useEffect(() => {
    if (!selectedDetail) {
      return;
    }

    if (selectedDetail.entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (!selectedDetail.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(selectedDetail.entries[0]?.id ?? null);
    }
  }, [selectedDetail, selectedEntryId]);

  const timelineEntries = selectedDetail?.entries ?? [];

  return (
    <div className="space-y-8">
      <TopBar
        agents={agents}
        selectedAgentId={selectedAgentId}
        sessions={sessions}
        selectedSession={selectedSession}
        isAgentsLoading={isAgentsLoading}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        deletingSessionId={deletingSessionId}
        onRefresh={handleRefresh}
        onAgentChange={(agentId) => {
          setSelectedAgentId(agentId);
          setSelectedSessionId(null);
          setSelectedEntryId(null);
          setSessionDetails({});
          sessionDetailsRef.current = {};
          setError("");
        }}
        onSessionChange={(sessionId) => void handleSessionChange(sessionId)}
        onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
      />

      {error ? (
        <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-6 py-4 text-sm text-[#b42318]">
          {error}
        </div>
      ) : null}

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_64px_minmax(380px,0.84fr)]">
        <UserActivityTable
          key={selectedSessionId ?? "no-session"}
          isLoading={isLoading}
          loadingSessionId={loadingSessionId}
          selectedSessionId={selectedSessionId}
          selectedSession={selectedSession}
          entries={timelineEntries}
          selectedEntryId={selectedEntryId}
          onSelectEntry={setSelectedEntryId}
        />
        <AgentLogDetails
          isLoading={isLoading}
          loadingSessionId={loadingSessionId}
          selectedSessionId={selectedSessionId}
          selectedSessionSummary={selectedSession?.summary}
          selectedDetail={selectedDetail}
          selectedEntry={selectedEntry}
        />
      </section>
    </div>
  );
}
