"use client";

import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
  ModalCardRequiredNote,
} from "@/components/modalcards";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import McpDetailsDrawer from "./McpDetailsDrawer";
import {
  normalizeTestMcpServer,
  type McpServer,
} from "./mcpHelpers";
import TestMcp from "./testmcp";

export type McpAuthType = "none" | "bearer" | "basic";

export type CreateMcpPayload = {
  server_url: string;
  auth_type: McpAuthType;
  auth_username: string;
  auth_secret: string;
  name: string;
  description: string;
};

export type McpActionResult = {
  ok: boolean;
  error?: string;
};

type CreateMcpModalProps = {
  mcpApiBase: string;
  onClose: () => void;
  onCreate: (payload: CreateMcpPayload) => Promise<McpActionResult>;
  onCreateSuccess: () => void;
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

function RoundedSelect({
  value,
  options,
  onChange,
}: {
  value: McpAuthType;
  options: SelectOption[];
  onChange: (value: McpAuthType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-xl border border-[#e0e5f0] bg-white px-4 py-2.5 text-left text-sm text-[#111827] outline-none transition focus-within:border-[#4f49e2] focus-within:ring-2 focus-within:ring-[#4f49e2]/20"
      >
        <span>{selectedOption?.label ?? "None"}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
          {options.map((option) => (
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
        </div>
      ) : null}
    </div>
  );
}

export default function CreateMcpModal({
  mcpApiBase,
  onClose,
  onCreate,
  onCreateSuccess,
}: CreateMcpModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [description, setDescription] = useState("");
  const [authType, setAuthType] = useState<McpAuthType>("none");
  const [authUsername, setAuthUsername] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const [testedServer, setTestedServer] = useState<McpServer | null>(null);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) {
      return;
    }

    const selector =
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const getFocusable = () =>
      Array.from(modalElement.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1
      );

    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const trimmedName = name.trim();
  const trimmedServerUrl = serverUrl.trim();
  const trimmedDescription = description.trim();
  const trimmedAuthUsername = authUsername.trim();
  const trimmedAuthSecret = authSecret.trim();

  const needsAuthSecret = authType === "bearer" || authType === "basic";
  const needsAuthUsername = authType === "basic";

  const isFormValid =
    trimmedName.length > 0 &&
    trimmedServerUrl.length > 0 &&
    trimmedDescription.length > 0 &&
    (!needsAuthUsername || trimmedAuthUsername.length > 0) &&
    (!needsAuthSecret || trimmedAuthSecret.length > 0);

  const isTestFormValid =
    trimmedServerUrl.length > 0 &&
    (!needsAuthUsername || trimmedAuthUsername.length > 0) &&
    (!needsAuthSecret || trimmedAuthSecret.length > 0);

  const shouldShowError = (valid: boolean) => isSubmitAttempted && !valid;

  const handleSubmit = async () => {
    setIsSubmitAttempted(true);
    setSubmitError("");

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);

    const result = await onCreate({
      name: trimmedName,
      server_url: trimmedServerUrl,
      description: trimmedDescription,
      auth_type: authType,
      auth_username: needsAuthUsername ? trimmedAuthUsername : "",
      auth_secret: needsAuthSecret ? trimmedAuthSecret : "",
    });

    if (!result.ok) {
      setSubmitError(result.error || "Unable to create MCP server.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onClose();
    window.setTimeout(() => {
      onCreateSuccess();
    }, 0);
  };

  const currentPayload: CreateMcpPayload = {
    name: trimmedName,
    server_url: trimmedServerUrl,
    description: trimmedDescription,
    auth_type: authType,
    auth_username: needsAuthUsername ? trimmedAuthUsername : "",
    auth_secret: needsAuthSecret ? trimmedAuthSecret : "",
  };

  return (
    <ModalCard zIndexClassName="z-[95]">
      <ModalCardPanel
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-mcp-title"
        maxWidthClassName="max-w-xl"
      >
        <ModalCardHeader
          title="Register MCP Server"
          subtitle="Register a new Model Context Protocol Server."
          onClose={() => {
            if (!isSubmitting) {
              onClose();
            }
          }}
        />

        <ModalCardBody className="flex-1 overflow-y-auto">
          <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              Name <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Service Desk MCP"
              className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                shouldShowError(trimmedName.length > 0)
                  ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                  : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
              }`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              Server URL <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://example.com/mcp"
              className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                shouldShowError(trimmedServerUrl.length > 0)
                  ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                  : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
              }`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              Auth Type <span className="text-[#ef4444]">*</span>
            </label>
            <RoundedSelect
              value={authType}
              options={AUTH_OPTIONS}
              onChange={(nextValue) => {
                setAuthType(nextValue);
                if (nextValue !== "basic") {
                  setAuthUsername("");
                }
                if (nextValue === "none") {
                  setAuthSecret("");
                }
              }}
            />
          </div>

          {needsAuthUsername ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#111827]">
                Auth Username <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder="Enter username"
                className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                  shouldShowError(trimmedAuthUsername.length > 0)
                    ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                    : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
                }`}
              />
            </div>
          ) : null}

          {needsAuthSecret ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#111827]">
                Auth Secret <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="password"
                value={authSecret}
                onChange={(event) => setAuthSecret(event.target.value)}
                placeholder="Enter secret"
                autoComplete="new-password"
                className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                  shouldShowError(trimmedAuthSecret.length > 0)
                    ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                    : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
                }`}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111827]">
              Description <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the MCP server usage..."
              rows={3}
              className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 ${
                shouldShowError(trimmedDescription.length > 0)
                  ? "border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20"
                  : "border-[#e0e5f0] focus:border-[#4f49e2] focus:ring-[#4f49e2]/20"
              }`}
            />
          </div>

          {submitError ? (
            <p className="text-sm font-medium text-[#dc2626]">{submitError}</p>
          ) : null}
          </div>
        </ModalCardBody>

        <ModalCardFooter className="justify-between">
          <ModalCardRequiredNote />
          <TestMcp
            mcpApiBase={mcpApiBase}
            payload={currentPayload}
            disabled={!isTestFormValid || isSubmitting}
            onTestSuccess={(response) => {
              const normalized = normalizeTestMcpServer(response, currentPayload);
              if (normalized) {
                setTestedServer(normalized);
              }
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  onClose();
                }
              }}
              className="rounded-xl border border-[#e5e7eb] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white ${
                !isFormValid || isSubmitting
                  ? "cursor-not-allowed bg-[#c7c4f7]"
                  : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] hover:bg-[#3f39d6]"
              }`}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Registering..." : "Register Server"}
            </button>
          </div>
        </ModalCardFooter>
      </ModalCardPanel>

      <McpDetailsDrawer
        server={testedServer}
        onClose={() => setTestedServer(null)}
      />
    </ModalCard>
  );
}
