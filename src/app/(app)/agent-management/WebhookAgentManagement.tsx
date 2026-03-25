"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";

type AgentRecord = {
  agent_id: string | null;
  name: string;
};

type WebhookRecord = {
  webhook_id: string;
  prompt: string;
};

type WebhookDeleteTarget = {
  agentId: string;
  webhookId: string;
};

type WebhookAgentManagementProps = {
  agent: AgentRecord;
  onClose: () => void;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return String((payload as { message: string }).message);
  }
  return fallback;
};

export default function WebhookAgentManagement({
  agent,
  onClose,
}: WebhookAgentManagementProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const agentManagerBaseUrl = trimTrailingSlash(llmManagerApiBaseUrl);
  const [webhookPrompt, setWebhookPrompt] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [isWebhooksLoading, setIsWebhooksLoading] = useState(false);
  const [webhooksError, setWebhooksError] = useState("");
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookCreateError, setWebhookCreateError] = useState("");
  const [webhookDeleteTarget, setWebhookDeleteTarget] =
    useState<WebhookDeleteTarget | null>(null);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);
  const [webhookDeleteError, setWebhookDeleteError] = useState("");

  const agentId = agent.agent_id?.trim() ?? "";

  useEffect(() => {
    const controller = new AbortController();
    const loadWebhooks = async () => {
      const agentId = agent.agent_id?.trim();
      if (!agentId) {
        setWebhooksError("Agent ID is missing. Unable to load webhooks.");
        return;
      }

      setIsWebhooksLoading(true);
      setWebhooksError("");

      try {
        const response = await fetch(
          `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}/webhook`,
          {
            headers: { accept: "application/json" },
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          setWebhooksError(getErrorMessage(data, "Unable to load webhooks."));
          return;
        }
        setWebhooks(
          data
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null;
              }
              const record = item as Record<string, unknown>;
              const webhookId =
                typeof record.webhook_id === "string" ? record.webhook_id.trim() : "";
              const prompt =
                typeof record.prompt === "string" ? record.prompt.trim() : "";
              if (!webhookId) {
                return null;
              }
              return { webhook_id: webhookId, prompt };
            })
            .filter((item): item is WebhookRecord => item !== null)
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setWebhooksError("Unable to load webhooks.");
      } finally {
        setIsWebhooksLoading(false);
      }
    };

    void loadWebhooks();
    return () => controller.abort();
  }, [agentManagerBaseUrl, agent.agent_id]);

  const handleCreateWebhook = async () => {
    if (isCreatingWebhook) {
      return;
    }

    const agentId = agent.agent_id?.trim();
    if (!agentId) {
      setWebhookCreateError("Agent ID is missing. Unable to create webhook.");
      return;
    }

    const prompt = webhookPrompt.trim();
    if (!prompt) {
      setWebhookCreateError("Prompt is required.");
      return;
    }

    setIsCreatingWebhook(true);
    setWebhookCreateError("");

    try {
      const response = await fetch(
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}/webhooks?agent_id=${encodeURIComponent(agentId)}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        }
      );

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setWebhookCreateError(getErrorMessage(data, "Unable to create webhook."));
        return;
      }

      setWebhookPrompt("");
      void (async () => {
        setIsWebhooksLoading(true);
        setWebhooksError("");
        try {
          const response = await fetch(
            `${agentManagerBaseUrl}/agent/${encodeURIComponent(agentId)}/webhook`,
            { headers: { accept: "application/json" } }
          );
          const data = await response.json();
          if (response.ok && Array.isArray(data)) {
            setWebhooks(
              data
                .map((item) => {
                  if (!item || typeof item !== "object" || Array.isArray(item)) {
                    return null;
                  }
                  const record = item as Record<string, unknown>;
                  const webhookId =
                    typeof record.webhook_id === "string" ? record.webhook_id.trim() : "";
                  const prompt =
                    typeof record.prompt === "string" ? record.prompt.trim() : "";
                  if (!webhookId) {
                    return null;
                  }
                  return { webhook_id: webhookId, prompt };
                })
                .filter((item): item is WebhookRecord => item !== null)
            );
          }
        } finally {
          setIsWebhooksLoading(false);
        }
      })();
    } catch {
      setWebhookCreateError("Unable to create webhook.");
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!webhookDeleteTarget || isDeletingWebhook) {
      return;
    }

    setIsDeletingWebhook(true);
    setWebhookDeleteError("");

    try {
      const response = await fetch(
        `${agentManagerBaseUrl}/agent/${encodeURIComponent(webhookDeleteTarget.agentId)}/webhook/${encodeURIComponent(webhookDeleteTarget.webhookId)}`,
        {
          method: "DELETE",
          headers: { accept: "application/json" },
        }
      );

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setWebhookDeleteError(getErrorMessage(data, "Unable to delete webhook."));
        return;
      }

      setWebhookDeleteTarget(null);
      setWebhooks((previous) =>
        previous.filter((item) => item.webhook_id !== webhookDeleteTarget.webhookId)
      );
    } catch {
      setWebhookDeleteError("Unable to delete webhook.");
    } finally {
      setIsDeletingWebhook(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-md">
        <div className="w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)]">
          <div className="flex items-start justify-between border-b border-[#eef1f7] px-6 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-semibold text-[#111827]">Webhook</h4>
                <span className="rounded-full border border-[#dbe3f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  Agent tools
                </span>
              </div>
              <p className="text-sm text-[#6b7280]">{agent.name}</p>
              {agentId ? (
                <p className="text-xs text-[#94a3b8]">
                  Agent ID: <span className="font-medium text-[#64748b]">{agentId}</span>
                </p>
              ) : null}
            </div>
              <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475569] transition hover:bg-[#f8fafc]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-[#111827]">Webhooks</h5>
                    <p className="text-xs text-[#64748b]">Create and review webhooks for this agent.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void 0}
                    className="rounded-xl border border-[#e5e7eb] px-3 py-2 text-xs font-semibold text-[#374151]"
                  >
                    List of Webhooks
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#eef1f7]">
                  <div className="grid grid-cols-[1.1fr_2fr_0.65fr] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a]">
                    <span>Webhook ID</span>
                    <span>Prompt</span>
                    <span className="text-right">Action</span>
                  </div>
                  {isWebhooksLoading ? (
                    <div className="divide-y divide-[#eef1f7] bg-white">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`webhook-skeleton-${index}`}
                          className="grid animate-pulse grid-cols-[1.1fr_2fr_0.65fr] px-4 py-4"
                        >
                          <span className="mr-4 h-4 rounded bg-[#edf2f9]" />
                          <span className="h-4 rounded bg-[#edf2f9]" />
                          <span className="ml-auto h-8 w-8 rounded-xl bg-[#edf2f9]" />
                        </div>
                      ))}
                    </div>
                  ) : webhooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 bg-white px-4 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f49e2]">
                        <Trash2 className="h-5 w-5 rotate-45" />
                      </div>
                      <p className="text-sm font-semibold text-[#111827]">
                        No webhooks found
                      </p>
                      <p className="max-w-sm text-sm text-[#6b7280]">
                        Create the first webhook to start capturing prompts for this agent.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#eef1f7] bg-white">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.webhook_id}
                          className="grid grid-cols-[1.1fr_2fr_0.65fr] px-4 py-4 text-sm text-[#2b3341]"
                        >
                          <div className="font-semibold text-[#0f172a]">
                            {webhook.webhook_id}
                          </div>
                          <div className="break-words whitespace-normal leading-snug text-[#334155]">
                            {webhook.prompt}
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setWebhookDeleteTarget({
                                  agentId: agent.agent_id?.trim() ?? "",
                                  webhookId: webhook.webhook_id,
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#f3c7c7] text-[#ef4444] transition hover:bg-[#fff1f2] hover:shadow-[0_10px_18px_-14px_rgba(239,68,68,0.45)]"
                              aria-label={`Delete webhook ${webhook.webhook_id}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#eef1f7] bg-[#fbfcfe] p-5">
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-[#111827]">Create Webhook</h5>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Submit a prompt to create a new webhook for this agent.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">
                    Prompt
                  </label>
                  <p className="mb-2 text-xs text-[#64748b]">
                    This prompt will be sent in the webhook payload body.
                  </p>
                  <textarea
                    value={webhookPrompt}
                    onChange={(event) => setWebhookPrompt(event.target.value)}
                    rows={5}
                    placeholder="Enter webhook prompt"
                    className="min-h-[180px] w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#4f49e2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,73,226,0.08)]"
                  />
                </div>
                {webhookCreateError ? (
                  <p className="text-sm text-[#dc2626]">{webhookCreateError}</p>
                ) : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWebhook}
                    disabled={isCreatingWebhook}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.8)] transition ${
                      isCreatingWebhook
                        ? "cursor-not-allowed bg-[#a5b4fc]"
                        : "bg-[#4f49e2] hover:bg-[#4338ca]"
                    }`}
                  >
                    {isCreatingWebhook ? "Creating..." : "Create Webhook"}
                  </button>
                </div>
              </div>
              {webhooksError ? (
                <div className="mt-4 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                  {webhooksError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {webhookDeleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-[#fee2e2] bg-[#fff5f5] px-6 py-4">
              <div className="flex items-center gap-2 text-[#b91c1c]">
                <Trash2 className="h-5 w-5" />
                <h4 className="text-lg font-semibold">Delete Webhook</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWebhookDeleteTarget(null);
                  setWebhookDeleteError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#b91c1c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#374151]">
                Are you sure you want to delete this webhook?
              </p>
              <p className="mt-3 text-sm text-[#374151]">
                <span className="font-semibold text-[#0f172a]">Webhook ID:</span>{" "}
                <span className="rounded-md bg-[#fee2e2] px-2 py-0.5 font-semibold text-[#b91c1c]">
                  {webhookDeleteTarget.webhookId}
                </span>
              </p>
              <p className="mt-3 text-xs text-[#9b1c1c]">
                This action can&apos;t be undone.
              </p>
              {webhookDeleteError ? (
                <p className="mt-3 text-sm text-[#dc2626]">{webhookDeleteError}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setWebhookDeleteTarget(null);
                  setWebhookDeleteError("");
                }}
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWebhook}
                disabled={isDeletingWebhook}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] transition ${
                  isDeletingWebhook
                    ? "cursor-not-allowed bg-[#fca5a5]"
                    : "bg-[#ef4444] hover:bg-[#dc2626]"
                }`}
              >
                {isDeletingWebhook ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
