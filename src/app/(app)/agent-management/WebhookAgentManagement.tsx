"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";

type AgentRecord = {
  agent_id: string | null;
  name: string;
};

type WebhookTab = "create" | "list";

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
  const [webhookTab, setWebhookTab] = useState<WebhookTab>("create");
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

  const closeModal = () => {
    onClose();
  };

  useEffect(() => {
    if (webhookTab !== "list") {
      return;
    }

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
  }, [agentManagerBaseUrl, agent.agent_id, webhookTab]);

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
      setWebhookTab("list");
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
        <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.65)]">
          <div className="flex items-start justify-between border-b border-[#eef1f7] px-6 py-5">
            <div>
              <h4 className="text-lg font-semibold text-[#111827]">Webhook</h4>
              <p className="mt-1 text-sm text-[#6b7280]">{agent.name}</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] text-[#475569] transition hover:bg-[#f8fafc]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-[#eef1f7] px-6 pt-4">
            <div className="inline-flex rounded-2xl bg-[#f3f6fb] p-1">
              <button
                type="button"
                onClick={() => setWebhookTab("list")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  webhookTab === "list"
                    ? "bg-white text-[#4f49e2] shadow-[0_8px_20px_-14px_rgba(79,73,226,0.65)]"
                    : "text-[#64748b]"
                }`}
              >
                List of Webhooks
              </button>
              <button
                type="button"
                onClick={() => setWebhookTab("create")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  webhookTab === "create"
                    ? "bg-white text-[#4f49e2] shadow-[0_8px_20px_-14px_rgba(79,73,226,0.65)]"
                    : "text-[#64748b]"
                }`}
              >
                Create Webhook
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {webhookTab === "create" ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">
                    Prompt
                  </label>
                  <textarea
                    value={webhookPrompt}
                    onChange={(event) => setWebhookPrompt(event.target.value)}
                    rows={5}
                    placeholder="Enter webhook prompt"
                    className="w-full rounded-2xl border border-[#dbe3f0] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2]"
                  />
                </div>
                {webhookCreateError ? (
                  <p className="text-sm text-[#dc2626]">{webhookCreateError}</p>
                ) : null}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWebhook}
                    disabled={isCreatingWebhook}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(79,73,226,0.8)] ${
                      isCreatingWebhook
                        ? "cursor-not-allowed bg-[#a5b4fc]"
                        : "bg-[#4f49e2] hover:bg-[#4338ca]"
                    }`}
                  >
                    {isCreatingWebhook ? "Creating..." : "Create Webhook"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {webhooksError ? (
                  <div className="rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                    {webhooksError}
                  </div>
                ) : null}
                <div className="overflow-hidden rounded-2xl border border-[#eef1f7]">
                  <div className="grid grid-cols-[1fr_2fr_0.5fr] bg-[#eaf0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0f172a]">
                    <span>Webhook ID</span>
                    <span>Prompt</span>
                    <span className="text-right">Action</span>
                  </div>
                  {isWebhooksLoading ? (
                    <div className="divide-y divide-[#eef1f7] bg-white">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`webhook-skeleton-${index}`}
                          className="grid animate-pulse grid-cols-[1fr_2fr_0.5fr] px-4 py-4"
                        >
                          <span className="mr-4 h-4 rounded bg-[#edf2f9]" />
                          <span className="h-4 rounded bg-[#edf2f9]" />
                          <span className="ml-auto h-8 w-8 rounded-lg bg-[#edf2f9]" />
                        </div>
                      ))}
                    </div>
                  ) : webhooks.length === 0 ? (
                    <div className="bg-white px-4 py-8 text-sm text-[#6b7280]">
                      No webhooks found.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#eef1f7] bg-white">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.webhook_id}
                          className="grid grid-cols-[1fr_2fr_0.5fr] px-4 py-4 text-sm text-[#2b3341]"
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
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#f3c7c7] text-[#ef4444] transition hover:bg-[#fff1f2]"
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
            )}
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
                className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWebhook}
                disabled={isDeletingWebhook}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(239,68,68,0.8)] ${
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
