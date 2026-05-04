"use client";

import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ListTree,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { McpAuthType } from "./CreateMcpModal";
import {
  formatDateTime,
  getMcpErrorMessage,
  normalizeMcpServer,
  type McpServer,
} from "./mcpHelpers";

type UpdateMcpModalProps = {
  mcpServerId: string | null;
  mcpApiBase: string;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

type EditableField =
  | "name"
  | "server_url"
  | "description"
  | "auth_type"
  | "auth_username"
  | "auth_secret";

type McpFormState = {
  name: string;
  server_url: string;
  description: string;
  auth_type: McpAuthType;
  auth_username: string;
  auth_secret: string;
  has_auth_secret: boolean;
};

type SelectOption = {
  value: McpAuthType;
  label: string;
};

const AUTH_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "bearer", label: "Bearer" },
  { value: "basic", label: "Basic" },
];

const toEditableValue = (value: string) => (value === "-" ? "" : value);

const toAuthType = (value: string): McpAuthType => {
  if (value === "basic" || value === "bearer" || value === "none") {
    return value;
  }
  return "none";
};

const buildFormState = (server: McpServer): McpFormState => ({
  name: toEditableValue(server.name),
  server_url: toEditableValue(server.server_url),
  description: toEditableValue(server.description),
  auth_type: toAuthType(toEditableValue(server.auth_type).toLowerCase()),
  auth_username: toEditableValue(server.auth_username),
  auth_secret: "",
  has_auth_secret: server.has_auth_secret,
});

const getRowLabel = (field: EditableField) => {
  switch (field) {
    case "name":
      return "NAME";
    case "server_url":
      return "SERVER URL";
    case "description":
      return "DESCRIPTION";
    case "auth_type":
      return "AUTH TYPE";
    case "auth_username":
      return "AUTH USERNAME";
    case "auth_secret":
      return "AUTH SECRET";
  }
};

const getDisplayValue = (field: EditableField, form: McpFormState) => {
  switch (field) {
    case "auth_secret":
      return form.has_auth_secret ? "••••••••••••••••" : "-";
    default:
      return toEditableValue(form[field]) || "-";
  }
};

const isFieldVisible = (field: EditableField, authType: McpAuthType) => {
  if (field === "auth_username") {
    return authType === "basic";
  }
  if (field === "auth_secret") {
    return authType === "basic" || authType === "bearer";
  }
  return true;
};

function AuthTypeSelect({
  value,
  onChange,
}: {
  value: McpAuthType;
  onChange: (nextValue: McpAuthType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const selectedOption = AUTH_OPTIONS.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const estimatedMenuHeight = AUTH_OPTIONS.length * 40 + 12;
      const openUp = window.innerHeight - rect.bottom < estimatedMenuHeight + 16;
      const desiredTop = openUp ? rect.top - estimatedMenuHeight - 8 : rect.bottom + 8;
      const top = Math.max(
        12,
        Math.min(desiredTop, window.innerHeight - estimatedMenuHeight - 12)
      );
      const width = rect.width;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

      setMenuStyle({ top, left, width });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    updatePosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-left text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
      >
        <span>{selectedOption?.label ?? "None"}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
              className="z-[1000] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]"
            >
              {AUTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    option.value === value
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#111827] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function UpdateMcpModal({
  mcpServerId,
  mcpApiBase,
  onClose,
  onUpdated,
}: UpdateMcpModalProps) {
  const [server, setServer] = useState<McpServer | null>(null);
  const [form, setForm] = useState<McpFormState | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftForm, setDraftForm] = useState<McpFormState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingField, setSavingField] = useState<EditableField | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState(false);

  const isOpen = Boolean(mcpServerId);

  useEffect(() => {
    if (!isOpen || !mcpServerId) {
      setServer(null);
      setForm(null);
      setDraftForm(null);
      setEditingField(null);
      setLoadError("");
      setSaveError("");
      setIsSecretVisible(false);
      return;
    }

    const controller = new AbortController();

    const loadServer = async () => {
      setIsLoading(true);
      setLoadError("");
      setSaveError("");
      setEditingField(null);

      try {
        const response = await fetch(
          `${mcpApiBase}/mcp/${encodeURIComponent(mcpServerId)}`,
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
          throw new Error(getMcpErrorMessage(payload, "Unable to load MCP server."));
        }

        const normalized = normalizeMcpServer(payload);
        if (!normalized) {
          throw new Error("Unable to load MCP server.");
        }

        setServer(normalized);
        const nextForm = buildFormState(normalized);
        setForm(nextForm);
        setDraftForm(nextForm);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : "Unable to load MCP server."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadServer();
    return () => controller.abort();
  }, [isOpen, mcpApiBase, mcpServerId]);

  const visibleFields = useMemo(() => {
    if (!form) {
      return [] as EditableField[];
    }

    return (
      [
        "name",
        "server_url",
        "description",
        "auth_type",
        "auth_username",
        "auth_secret",
      ] as EditableField[]
    ).filter((field) => isFieldVisible(field, form.auth_type));
  }, [form]);

  if (!isOpen || !mcpServerId) {
    return null;
  }

  const startEditing = (field: EditableField) => {
    if (!form) {
      return;
    }
    setDraftForm({ ...form });
    setEditingField(field);
    setSaveError("");
    if (field === "auth_secret") {
      setIsSecretVisible(false);
    }
  };

  const cancelEditing = () => {
    if (!form) {
      return;
    }
    setDraftForm({ ...form });
    setEditingField(null);
    setSaveError("");
    setIsSecretVisible(false);
  };

  const updateDraft = (patch: Partial<McpFormState>) => {
    setDraftForm((current) => {
      if (!current) {
        return current;
      }

      const nextValue = { ...current, ...patch };
      if (patch.auth_type) {
        if (patch.auth_type === "none") {
          nextValue.auth_username = "";
          nextValue.auth_secret = "";
          nextValue.has_auth_secret = false;
        } else if (patch.auth_type === "bearer") {
          nextValue.auth_username = "";
        }
      }

      return nextValue;
    });
  };

  const validateField = (field: EditableField, currentDraft: McpFormState) => {
    switch (field) {
      case "name":
        return currentDraft.name.trim().length > 0
          ? ""
          : "Name is required.";
      case "server_url":
        return currentDraft.server_url.trim().length > 0
          ? ""
          : "Server URL is required.";
      case "description":
        return currentDraft.description.trim().length > 0
          ? ""
          : "Description is required.";
      case "auth_type":
        if (currentDraft.auth_type === "basic") {
          if (!currentDraft.auth_username.trim()) {
            return "Auth username is required for basic authentication.";
          }
          if (!currentDraft.auth_secret.trim() && !form?.has_auth_secret) {
            return "Auth secret is required for basic authentication.";
          }
        }
        if (
          currentDraft.auth_type === "bearer" &&
          !currentDraft.auth_secret.trim() &&
          !form?.has_auth_secret
        ) {
          return "Auth secret is required for bearer authentication.";
        }
        return "";
      case "auth_username":
        return currentDraft.auth_username.trim().length > 0
          ? ""
          : "Auth username is required.";
      case "auth_secret":
        return currentDraft.auth_secret.trim().length > 0
          ? ""
          : "Auth secret is required.";
    }
  };

  const buildPatchPayload = (field: EditableField, currentDraft: McpFormState) => {
    switch (field) {
      case "name":
        return { name: currentDraft.name.trim() };
      case "server_url":
        return { server_url: currentDraft.server_url.trim() };
      case "description":
        return { description: currentDraft.description.trim() };
      case "auth_username":
        return {
          auth_type: currentDraft.auth_type,
          auth_username: currentDraft.auth_username.trim(),
        };
      case "auth_secret":
        return {
          auth_type: currentDraft.auth_type,
          auth_secret: currentDraft.auth_secret.trim(),
          ...(currentDraft.auth_type === "basic"
            ? { auth_username: currentDraft.auth_username.trim() }
            : {}),
        };
      case "auth_type":
        return {
          auth_type: currentDraft.auth_type,
          auth_username:
            currentDraft.auth_type === "basic"
              ? currentDraft.auth_username.trim()
              : "",
          auth_secret:
            currentDraft.auth_type === "none"
              ? ""
              : currentDraft.auth_secret.trim(),
        };
    }
  };

  const saveField = async (field: EditableField) => {
    if (!draftForm || !form) {
      return;
    }

    const error = validateField(field, draftForm);
    if (error) {
      setSaveError(error);
      return;
    }

    setSavingField(field);
    setSaveError("");

    try {
      const payload = buildPatchPayload(field, draftForm);
      const response = await fetch(
        `${mcpApiBase}/mcp/${encodeURIComponent(mcpServerId)}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      let responsePayload: unknown = null;
      try {
        responsePayload = await response.json();
      } catch {
        responsePayload = null;
      }

      if (!response.ok) {
        throw new Error(
          getMcpErrorMessage(responsePayload, "Unable to update MCP server.")
        );
      }

      const normalized = normalizeMcpServer(responsePayload);
      const nextServer = normalized ?? {
        ...server!,
        name: draftForm.name.trim() || "-",
        server_url: draftForm.server_url.trim() || "-",
        description: draftForm.description.trim() || "-",
        auth_type: draftForm.auth_type || "none",
        auth_username:
          draftForm.auth_type === "basic"
            ? draftForm.auth_username.trim() || "-"
            : "-",
        has_auth_secret:
          draftForm.auth_type === "none"
            ? false
            : draftForm.auth_secret.trim().length > 0 || form.has_auth_secret,
      };

      setServer(nextServer);
      const nextForm = buildFormState(nextServer);
      setForm(nextForm);
      setDraftForm(nextForm);
      setEditingField(null);
      setIsSecretVisible(false);
      await onUpdated();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to update MCP server."
      );
    } finally {
      setSavingField(null);
    }
  };

  const renderEditor = (field: EditableField) => {
    if (!draftForm) {
      return null;
    }

    switch (field) {
      case "description":
        return (
          <textarea
            value={draftForm.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
            rows={3}
            className="min-w-0 flex-1 rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          />
        );
      case "auth_type":
        return (
          <div className="flex-1 space-y-3">
            <AuthTypeSelect
              value={draftForm.auth_type}
              onChange={(nextValue) => updateDraft({ auth_type: nextValue })}
            />
            {draftForm.auth_type === "basic" ? (
              <input
                type="text"
                value={draftForm.auth_username}
                onChange={(event) =>
                  updateDraft({ auth_username: event.target.value })
                }
                placeholder="Auth username"
                className="w-full rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
              />
            ) : null}
            {draftForm.auth_type === "basic" || draftForm.auth_type === "bearer" ? (
              <input
                type="password"
                value={draftForm.auth_secret}
                onChange={(event) =>
                  updateDraft({ auth_secret: event.target.value })
                }
                placeholder={
                  form?.has_auth_secret
                    ? "Enter new secret to replace the current one"
                    : "Auth secret"
                }
                className="w-full rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
              />
            ) : null}
          </div>
        );
      case "auth_secret":
        return (
          <input
            type={isSecretVisible ? "text" : "password"}
            value={draftForm.auth_secret}
            onChange={(event) => updateDraft({ auth_secret: event.target.value })}
            placeholder={
              form?.has_auth_secret
                ? "Enter new secret to replace the current one"
                : "Auth secret"
            }
            className="min-w-0 flex-1 rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          />
        );
      default:
        return (
          <input
            type="text"
            value={draftForm[field]}
            onChange={(event) =>
              updateDraft({ [field]: event.target.value } as Partial<McpFormState>)
            }
            className="min-w-0 flex-1 rounded-xl border border-[#cbd2ff] bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#4f49e2] focus:ring-2 focus:ring-[#4f49e2]/20"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
        <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <ListTree className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-semibold">Update MCP Server</p>
              <p className="text-xs text-white/80">{server?.name ?? mcpServerId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`mcp-update-skeleton-${index}`}
                  className="animate-pulse rounded-xl border border-[#eef1f7] bg-white p-4"
                >
                  <div className="h-4 w-40 rounded bg-[#edf2f9]" />
                  <div className="mt-3 h-4 w-full rounded bg-[#edf2f9]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
              {loadError}
            </div>
          ) : form && server ? (
            <div className="overflow-hidden rounded-xl border border-[#e7ecf7] bg-white">
              <div className="border-b border-[#eef1f7] bg-[#f8faff] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{server.name}</p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      MCP ID: {server.mcp_server_id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#64748b]">
                    <p>Created: {formatDateTime(server.created_at)}</p>
                    <p className="mt-1">Updated: {formatDateTime(server.updated_at)}</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#eef1f7] px-4">
                {visibleFields.map((field) => {
                  const isEditing = editingField === field;
                  const isSaving = savingField === field;
                  const isSecretField = field === "auth_secret";

                  return (
                    <div
                      key={field}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                          {getRowLabel(field)}
                        </p>

                        {isEditing ? (
                          <div className="mt-2 flex items-start gap-2">
                            {renderEditor(field)}
                            {field === "auth_secret" ? (
                              <button
                                type="button"
                                onClick={() => setIsSecretVisible((current) => !current)}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                                aria-label={
                                  isSecretVisible ? "Hide auth secret" : "Show auth secret"
                                }
                              >
                                {isSecretVisible ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void saveField(field)}
                              disabled={isSaving}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#bbf7d0] text-[#16a34a] transition hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Save ${getRowLabel(field)}`}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSaving}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Cancel editing ${getRowLabel(field)}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <p className="mt-1 break-all text-sm text-[#111827]">
                            {getDisplayValue(field, form)}
                          </p>
                        )}
                      </div>

                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(field)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                            aria-label={`Edit ${getRowLabel(field)}`}
                            title={`Edit ${getRowLabel(field)}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {isSecretField ? (
                            <button
                              type="button"
                              onClick={() => setIsSecretVisible((current) => !current)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd2ff] text-[#4f49e2] transition hover:bg-[#eef2ff]"
                              aria-label={
                                isSecretVisible ? "Hide auth secret" : "Show auth secret"
                              }
                              title={
                                isSecretVisible ? "Hide auth secret" : "Show auth secret"
                              }
                            >
                              {isSecretVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {saveError ? (
                <div className="border-t border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                  {saveError}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
