"use client";

import {
  ModalCard,
  ModalCardBody,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardPanel,
  ModalCardRequiredNote,
} from "@/components/modalcards";
import TabUserinterface from "@/components/Tab-Userinterface";
import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  ListTree,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PromptAgent from "../../agent-management/agentform/promptAgent";
import { normalizeMcpServer } from "../../mcp/mcpHelpers";
import {
  buildSkillPatchPayload,
  formatSkillDate,
  getSkillErrorMessage,
  normalizeSkillDetail,
  skillTabs,
  type ConnectorConfigLookupOption,
  type McpLookupOption,
  type SkillDetail,
} from "../skillHelpers";

type SkillModalMode = "create" | "view" | "update";

type SkillModalProps = {
  isOpen: boolean;
  mode: SkillModalMode;
  skillId?: string | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type ConnectorListItem = {
  id: string;
  name: string;
};

type ConnectorDetailsPayload = {
  tools?: Array<{ name?: string }>;
};

type ConnectorConfigPayload = {
  connector_config_id?: string;
  name?: string;
};

type EditingSection =
  | "frontmatter"
  | "instructions"
  | "dependencies"
  | "tools"
  | "references";

type ReferenceRow = {
  id: string;
  reference: string;
  text: string;
};

type DropdownOption = {
  value: string;
  label: string;
  secondary?: string;
};

type ToolSource = {
  kind: "MCP" | "Connector";
  label: string;
};

const emptySkillDetail = (): SkillDetail => ({
  id: "",
  name: "",
  description: "",
  instructions: "",
  tools: [],
  connectorConfigIds: [""],
  mcpServerIds: [""],
  references: {},
  createdAt: null,
  updatedAt: null,
});

const sectionByTabIndex: EditingSection[] = [
  "frontmatter",
  "instructions",
  "dependencies",
  "tools",
  "references",
];

const SKILL_DRAFT_GENERATION_STEPS = [
  "Understanding skill purpose",
  "Drafting frontmatter fields",
  "Preparing skill instructions",
  "Mapping tools and integrations",
];

const toUniqueValues = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
};

const createToolSourceKey = (tool: string, kind: ToolSource["kind"], label: string) =>
  `${tool}::${kind}::${label}`;

const buildToolSourceMap = (
  mcpServerIds: string[],
  connectorConfigIds: string[],
  mcpOptions: McpLookupOption[],
  connectorOptions: ConnectorConfigLookupOption[]
) => {
  const sourceMap = new Map<string, ToolSource[]>();

  mcpServerIds.forEach((id) => {
    const match = mcpOptions.find((option) => option.id === id);
    if (!match) {
      return;
    }

    const label = match.name || match.serverUrl;
    match.tools.forEach((tool) => {
      const nextSource = { kind: "MCP" as const, label };
      const current = sourceMap.get(tool) ?? [];
      if (!current.some((item) => createToolSourceKey(tool, item.kind, item.label) === createToolSourceKey(tool, nextSource.kind, nextSource.label))) {
        sourceMap.set(tool, [...current, nextSource]);
      }
    });
  });

  connectorConfigIds.forEach((id) => {
    const match = connectorOptions.find((option) => option.connectorConfigId === id);
    if (!match) {
      return;
    }

    const label = match.configName || match.connectorName;
    match.tools.forEach((tool) => {
      const nextSource = { kind: "Connector" as const, label };
      const current = sourceMap.get(tool) ?? [];
      if (!current.some((item) => createToolSourceKey(tool, item.kind, item.label) === createToolSourceKey(tool, nextSource.kind, nextSource.label))) {
        sourceMap.set(tool, [...current, nextSource]);
      }
    });
  });

  return sourceMap;
};

let referenceRowCounter = 0;
const createReferenceRow = (reference = "", text = ""): ReferenceRow => {
  referenceRowCounter += 1;
  return {
    id: `reference-row-${referenceRowCounter}`,
    reference,
    text,
  };
};

const normalizeReferenceRows = (detail: SkillDetail) => {
  const entries = Object.entries(detail.references);
  if (entries.length === 0) {
    return [createReferenceRow()];
  }

  return entries.map(([key, value]) => createReferenceRow(key, value));
};

const buildReferenceRecord = (rows: ReferenceRow[]) =>
  rows.reduce<Record<string, string>>((result, row) => {
    const key = row.reference.trim();
    if (!key) {
      return result;
    }

    result[key] = row.text;
    return result;
  }, {});

const getDraftText = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : undefined;
};

const getDraftStringArray = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeDraftIdRows = (values: string[] | undefined, current: string[]) => {
  if (values === undefined) {
    return current;
  }

  return values.length ? values : [""];
};

const buildSkillDraftConfig = (detail: SkillDetail) => ({
  name: detail.name.trim(),
  description: detail.description.trim(),
  instructions: detail.instructions.trim(),
  tools: toUniqueValues(detail.tools),
  connector_config_ids: toUniqueValues(detail.connectorConfigIds),
  mcp_server_ids: toUniqueValues(detail.mcpServerIds),
});

const mergeSkillDraftResponse = (
  current: SkillDetail,
  payload: Record<string, unknown>
): SkillDetail => {
  const nextConnectorConfigIds = getDraftStringArray(payload, "connector_config_ids");
  const nextMcpServerIds = getDraftStringArray(payload, "mcp_server_ids");

  return {
    ...current,
    name: getDraftText(payload, "name") ?? current.name,
    description: getDraftText(payload, "description") ?? current.description,
    instructions: getDraftText(payload, "instructions") ?? current.instructions,
    tools: getDraftStringArray(payload, "tools") ?? current.tools,
    connectorConfigIds: normalizeDraftIdRows(
      nextConnectorConfigIds,
      current.connectorConfigIds
    ),
    mcpServerIds: normalizeDraftIdRows(nextMcpServerIds, current.mcpServerIds),
  };
};

const getModalTitle = (mode: SkillModalMode) => {
  if (mode === "view") {
    return "View Skill";
  }

  if (mode === "update") {
    return "Update Skill";
  }

  return "Configure Skill";
};

const isEditable = (mode: SkillModalMode, editingSection: EditingSection | null, section: EditingSection) => {
  if (mode === "create") {
    return true;
  }

  if (mode === "view") {
    return false;
  }

  return editingSection === section;
};

function ThemedDropdown({
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
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
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const estimatedMenuHeight = 240;
      const viewportPadding = 12;
      const openUp =
        window.innerHeight - rect.bottom < estimatedMenuHeight + viewportPadding;
      const desiredTop = openUp ? rect.top - estimatedMenuHeight - 8 : rect.bottom + 8;
      const top = Math.max(
        viewportPadding,
        Math.min(desiredTop, window.innerHeight - estimatedMenuHeight - viewportPadding)
      );
      const width = rect.width;
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding)
      );

      setMenuStyle({ top, left, width });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      if (containerRef.current?.contains(targetNode)) {
        return;
      }
      if (menuRef.current?.contains(targetNode)) {
        return;
      }

      if (!containerRef.current?.contains(targetNode)) {
        setIsOpen(false);
      }
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
    <div ref={containerRef} className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        disabled={disabled}
        className="flex w-full items-start justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-indigo-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
      >
        <span className="min-w-0">
          <span className={`block truncate ${selectedOption ? "text-gray-900" : "text-gray-400"}`}>
            {selectedOption?.label ?? placeholder}
          </span>
          {selectedOption?.secondary ? (
            <span className="mt-0.5 block truncate text-xs text-gray-500">
              {selectedOption.secondary}
            </span>
          ) : null}
        </span>
        <ChevronDown size={16} className="mt-1 shrink-0 text-gray-500" />
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
              className="z-[1000] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
              >
                {placeholder}
              </button>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  {option.secondary ? (
                    <div className="mt-0.5 break-all text-xs text-gray-500">{option.secondary}</div>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function SkillModal({
  isOpen,
  mode,
  skillId = null,
  onClose,
  onSaved,
}: SkillModalProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const apiBase = trimTrailingSlash(llmManagerApiBaseUrl);
  const isUpdateMode = mode === "update";

  const [activeTab, setActiveTab] = useState(0);
  const [detail, setDetail] = useState<SkillDetail>(emptySkillDetail());
  const [draft, setDraft] = useState<SkillDetail>(emptySkillDetail());
  const [referenceRows, setReferenceRows] = useState<ReferenceRow[]>([
    createReferenceRow(),
  ]);
  const [mcpOptions, setMcpOptions] = useState<McpLookupOption[]>([]);
  const [connectorOptions, setConnectorOptions] = useState<ConnectorConfigLookupOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editingSection, setEditingSection] = useState<EditingSection | null>(null);
  const [activeAvailableTool, setActiveAvailableTool] = useState("");
  const [activeSelectedTool, setActiveSelectedTool] = useState("");
  const [isPromptSkillOpen, setIsPromptSkillOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveTab(0);
    setEditingSection(null);
    setSaveError("");
    setLoadError("");
    setActiveAvailableTool("");
    setActiveSelectedTool("");
    setIsPromptSkillOpen(false);

    if (mode === "create") {
      const initial = emptySkillDetail();
      setDetail(initial);
      setDraft(initial);
      setReferenceRows([createReferenceRow()]);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();

    const loadLookupData = async () => {
      const mcpResponse = await fetch(`${apiBase}/mcp/`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const mcpPayload = await mcpResponse.json().catch(() => null);

      if (!mcpResponse.ok || !Array.isArray(mcpPayload)) {
        throw new Error("Unable to load MCP servers.");
      }

      const nextMcpOptions = mcpPayload
        .map(normalizeMcpServer)
        .filter((item): item is NonNullable<ReturnType<typeof normalizeMcpServer>> => item !== null)
        .map((item) => ({
          id: item.mcp_server_id,
          name: item.name,
          serverUrl: item.server_url,
          label: `${item.name} Enterprise`,
          tools: item.tools.map((tool) => tool.name).filter(Boolean),
        }));

      const connectorsResponse = await fetch(`${apiBase}/connectors/`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const connectorsPayload = await connectorsResponse.json().catch(() => null);

      if (!connectorsResponse.ok || !Array.isArray(connectorsPayload)) {
        throw new Error("Unable to load connectors.");
      }

      const connectorList = connectorsPayload
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const record = item as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id.trim() : "";
          const name = typeof record.name === "string" ? record.name.trim() : "";
          if (!id || !name) {
            return null;
          }

          return { id, name } satisfies ConnectorListItem;
        })
        .filter((item): item is ConnectorListItem => item !== null);

      const connectorDetailResponses = await Promise.all(
        connectorList.map(async (connector) => {
          const [detailResponse, configResponse] = await Promise.all([
            fetch(`${apiBase}/connectors/${encodeURIComponent(connector.id)}`, {
              headers: { accept: "application/json" },
              signal: controller.signal,
            }),
            fetch(`${apiBase}/connectors/${encodeURIComponent(connector.id)}/config`, {
              headers: { accept: "application/json" },
              signal: controller.signal,
            }),
          ]);

          const detailPayload = (await detailResponse.json().catch(() => null)) as ConnectorDetailsPayload | null;
          const configPayload = (await configResponse.json().catch(() => null)) as ConnectorConfigPayload[] | null;

          return {
            connector,
            detailPayload,
            configPayload,
            configOk: configResponse.ok,
          };
        })
      );

      const nextConnectorOptions = connectorDetailResponses.flatMap((item) => {
        if (!item.configOk || !Array.isArray(item.configPayload)) {
          return [];
        }

        const connectorTools = Array.isArray(item.detailPayload?.tools)
          ? item.detailPayload.tools
              .map((tool) => (typeof tool?.name === "string" ? tool.name.trim() : ""))
              .filter(Boolean)
          : [];

        return item.configPayload.flatMap((configItem) => {
          const connectorConfigId =
            typeof configItem?.connector_config_id === "string"
              ? configItem.connector_config_id.trim()
              : "";
          if (!connectorConfigId) {
            return [];
          }

          const configName =
            typeof configItem?.name === "string" && configItem.name.trim()
              ? configItem.name.trim()
              : item.connector.name;

          return [
            {
              connectorId: item.connector.id,
              connectorName: item.connector.name,
              connectorConfigId,
              configName,
              label: `${item.connector.name} Enterprise | ${configName}`,
              tools: connectorTools,
            } satisfies ConnectorConfigLookupOption,
          ];
        });
      });

      setMcpOptions(nextMcpOptions);
      setConnectorOptions(nextConnectorOptions);
    };

    const loadSkill = async () => {
      if (mode === "create" || !skillId) {
        return;
      }

      const response = await fetch(`${apiBase}/skill/${encodeURIComponent(skillId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getSkillErrorMessage(payload, "Unable to load skill."));
      }

      const normalized = normalizeSkillDetail(payload);
      if (!normalized) {
        throw new Error("Unable to load skill.");
      }

      const nextDetail = {
        ...normalized,
        mcpServerIds:
          normalized.mcpServerIds.length > 0 ? normalized.mcpServerIds : [""],
        connectorConfigIds:
          normalized.connectorConfigIds.length > 0
            ? normalized.connectorConfigIds
            : [""],
      };

      setDetail(nextDetail);
      setDraft(nextDetail);
      setReferenceRows(normalizeReferenceRows(nextDetail));
    };

    const load = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        await Promise.all([loadLookupData(), loadSkill()]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Unable to load skill.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [apiBase, isOpen, mode, skillId]);

  if (!isOpen) {
    return null;
  }

  const currentSection = sectionByTabIndex[activeTab];
  const canEditCurrentSection = isEditable(mode, editingSection, currentSection);
  const mcpDropdownOptions: DropdownOption[] = mcpOptions.map((option) => ({
    value: option.id,
    label: option.name || option.serverUrl,
    secondary: option.serverUrl,
  }));
  const connectorDropdownOptions: DropdownOption[] = connectorOptions.map((option) => ({
    value: option.connectorConfigId,
    label: option.configName,
    secondary: `${option.connectorName} Enterprise`,
  }));

  const resolvedMcpTools = draft.mcpServerIds.flatMap((id) => {
    const match = mcpOptions.find((option) => option.id === id);
    return match?.tools ?? [];
  });
  const resolvedConnectorTools = draft.connectorConfigIds.flatMap((id) => {
    const match = connectorOptions.find((option) => option.connectorConfigId === id);
    return match?.tools ?? [];
  });
  const toolUniverse = toUniqueValues([...resolvedMcpTools, ...resolvedConnectorTools]);
  const availableTools = toolUniverse.filter((tool) => !draft.tools.includes(tool));
  const toolSourceMap = buildToolSourceMap(
    draft.mcpServerIds,
    draft.connectorConfigIds,
    mcpOptions,
    connectorOptions
  );

  const updateDraft = (patch: Partial<SkillDetail>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const setMcpRowValue = (index: number, value: string) => {
    const nextValues = [...draft.mcpServerIds];
    nextValues[index] = value;
    updateDraft({ mcpServerIds: nextValues });
  };

  const setConnectorRowValue = (index: number, value: string) => {
    const nextValues = [...draft.connectorConfigIds];
    nextValues[index] = value;
    updateDraft({ connectorConfigIds: nextValues });
  };

  const updateReferenceRow = (
    rowId: string,
    patch: Partial<Pick<ReferenceRow, "reference" | "text">>
  ) => {
    setReferenceRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const handleGenerateSkillDraft = async (prompt: string) => {
    const requestBody =
      mode === "update"
        ? {
            prompt,
            current_config: buildSkillDraftConfig(draft),
          }
        : { prompt };

    const response = await fetch(`${apiBase}/skill/orchestrate`, {
      method: mode === "update" ? "PATCH" : "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(getSkillErrorMessage(payload, "Unable to generate skill draft."));
    }

    const record = payload as Record<string, unknown>;
    setDraft((current) => mergeSkillDraftResponse(current, record));
    setActiveTab(0);
    if (mode === "update") {
      setEditingSection("frontmatter");
    }
    setIsPromptSkillOpen(false);
  };

  const startEditing = () => {
    if (!isUpdateMode) {
      return;
    }

    setDraft(detail);
    setReferenceRows(normalizeReferenceRows(detail));
    setEditingSection(currentSection);
    setSaveError("");
  };

  const cancelEditing = () => {
    setDraft(detail);
    setReferenceRows(normalizeReferenceRows(detail));
    setEditingSection(null);
    setSaveError("");
    setActiveAvailableTool("");
    setActiveSelectedTool("");
  };

  const validateDraft = () => {
    if (!draft.name.trim()) {
      return "Name is required.";
    }

    if (!draft.description.trim()) {
      return "Description is required.";
    }

    if (!draft.instructions.trim()) {
      return "Instructions are required.";
    }

    return "";
  };

  const isCreateValid =
    draft.name.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    draft.instructions.trim().length > 0;

  const saveCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch(`${apiBase}/skill/`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildSkillPatchPayload({
            ...draft,
            tools: toUniqueValues(draft.tools),
            mcpServerIds: toUniqueValues(draft.mcpServerIds),
            connectorConfigIds: toUniqueValues(draft.connectorConfigIds),
            references: buildReferenceRecord(referenceRows),
          })
        ),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getSkillErrorMessage(payload, "Unable to Configure skill."));
      }

      await onSaved?.();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to Configure skill.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveUpdate = async () => {
    if (!skillId) {
      return;
    }

    const validationError = validateDraft();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch(`${apiBase}/skill/${encodeURIComponent(skillId)}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildSkillPatchPayload({
            ...draft,
            tools: toUniqueValues(draft.tools),
            mcpServerIds: toUniqueValues(draft.mcpServerIds),
            connectorConfigIds: toUniqueValues(draft.connectorConfigIds),
            references: buildReferenceRecord(referenceRows),
          })
        ),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getSkillErrorMessage(payload, "Unable to update skill."));
      }

      const normalized = normalizeSkillDetail(payload) ?? {
        ...draft,
        id: skillId,
        mcpServerIds: toUniqueValues(draft.mcpServerIds),
        connectorConfigIds: toUniqueValues(draft.connectorConfigIds),
        tools: toUniqueValues(draft.tools),
        references: buildReferenceRecord(referenceRows),
      };

      const nextDetail = {
        ...normalized,
        mcpServerIds: normalized.mcpServerIds.length > 0 ? normalized.mcpServerIds : [""],
        connectorConfigIds:
          normalized.connectorConfigIds.length > 0
            ? normalized.connectorConfigIds
            : [""],
      };

      setDetail(nextDetail);
      setDraft(nextDetail);
      setReferenceRows(normalizeReferenceRows(nextDetail));
      setEditingSection(null);
      await onSaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update skill.");
    } finally {
      setIsSaving(false);
    }
  };

  const headerName = detail.name || draft.name || skillId || "Skill";

  return (
    <ModalCard
      zIndexClassName="z-[100]"
      onBackdropClick={isPromptSkillOpen ? () => setIsPromptSkillOpen(false) : onClose}
    >
      <ModalCardPanel
        maxWidthClassName="max-w-5xl"
        className={isPromptSkillOpen ? "hidden" : "max-h-[92vh]"}
      >
        <ModalCardHeader
          title={getModalTitle(mode)}
          subtitle={headerName}
          icon={mode === "view" ? <Eye className="h-4 w-4" /> : <ListTree className="h-4 w-4" />}
          actions={
            mode === "create" || mode === "update" ? (
              <button
                type="button"
                onClick={() => setIsPromptSkillOpen(true)}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Draft with AI
              </button>
            ) : null
          }
          onClose={onClose}
        />

        <div className="px-6 py-3">
          <TabUserinterface
            tabs={skillTabs}
            activeIndex={activeTab}
            onChange={setActiveTab}
            gridClassName="grid-cols-5"
          />
        </div>

        <ModalCardBody className="soft-scrollbar flex-1 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skill-modal-skeleton-${index}`}
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
          ) : (
            <div className="space-y-4">
              {(mode === "view" || mode === "update") && skillId ? (
                <div className="rounded-xl px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{headerName}</p>
                    </div>
                    <div className="text-right text-xs text-[#64748b]">
                      <p>Created: {formatSkillDate(detail.createdAt)}</p>
                      <p className="mt-1">Updated: {formatSkillDate(detail.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {isUpdateMode ? (
                <div className="flex items-center justify-end gap-2">
                  {editingSection === currentSection ? (
                    <>
                      <button
                        type="button"
                        onClick={saveUpdate}
                        disabled={isSaving}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-50"
                        title="Save changes"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-50"
                        title="Cancel changes"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#475569] transition hover:bg-[#eef2ff] hover:text-[#4f49e2]"
                      title="Edit section"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : null}

              {saveError ? (
                <div className="rounded-xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
                  {saveError}
                </div>
              ) : null}

              {activeTab === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#111827]">
                      Name
                      {mode === "create" ? <span className="ml-1 text-red-500">*</span> : null}
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      placeholder="e.g. Incident Resolution Skill"
                      disabled={!canEditCurrentSection}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#111827]">
                      Description
                      {mode === "create" ? <span className="ml-1 text-red-500">*</span> : null}
                    </label>
                    <textarea
                      rows={6}
                      value={draft.description}
                      onChange={(event) => updateDraft({ description: event.target.value })}
                      placeholder="Short description of this skill"
                      disabled={!canEditCurrentSection}
                      className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === 1 ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#111827]">
                    Instruction
                    {mode === "create" ? <span className="ml-1 text-red-500">*</span> : null}
                  </label>
                  <textarea
                    rows={10}
                    value={draft.instructions}
                    onChange={(event) => updateDraft({ instructions: event.target.value })}
                    placeholder="Write detailed behavior and guidance for this skill..."
                    disabled={!canEditCurrentSection}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
                  />
                </div>
              ) : null}

              {activeTab === 2 ? (
                <div
                  className={
                    Math.max(draft.mcpServerIds.length, draft.connectorConfigIds.length) >= 4 &&
                    Math.abs(draft.mcpServerIds.length - draft.connectorConfigIds.length) >= 2
                      ? "space-y-6"
                      : "grid gap-6 md:grid-cols-2"
                  }
                >
                  <div className="space-y-3 rounded-2xl p-4">
                    <label className="text-sm font-semibold text-[#111827]">MCP</label>
                    {draft.mcpServerIds.map((row, index) => (
                      <div key={`mcp-row-${index}`} className="flex items-center gap-2">
                        <ThemedDropdown
                          value={row}
                          options={mcpDropdownOptions}
                          placeholder="Select MCP"
                          disabled={!canEditCurrentSection}
                          onChange={(value) => setMcpRowValue(index, value)}
                        />

                        {canEditCurrentSection && draft.mcpServerIds.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                mcpServerIds:
                                  draft.mcpServerIds.filter((_, itemIndex) => itemIndex !== index)
                                    .length > 0
                                    ? draft.mcpServerIds.filter((_, itemIndex) => itemIndex !== index)
                                    : [""],
                              })
                            }
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#e11d48]"
                            title="Remove MCP"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}

                        {canEditCurrentSection && index === draft.mcpServerIds.length - 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({ mcpServerIds: [...draft.mcpServerIds, ""] })
                            }
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2]"
                            title="Add MCP"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl p-4">
                    <label className="text-sm font-semibold text-[#111827]">Connectors</label>
                    {draft.connectorConfigIds.map((row, index) => (
                      <div key={`connector-row-${index}`} className="flex items-center gap-2">
                        <ThemedDropdown
                          value={row}
                          options={connectorDropdownOptions}
                          placeholder="Select connector"
                          disabled={!canEditCurrentSection}
                          onChange={(value) => setConnectorRowValue(index, value)}
                        />

                        {canEditCurrentSection && draft.connectorConfigIds.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                connectorConfigIds:
                                  draft.connectorConfigIds.filter(
                                    (_, itemIndex) => itemIndex !== index
                                  ).length > 0
                                    ? draft.connectorConfigIds.filter(
                                        (_, itemIndex) => itemIndex !== index
                                      )
                                    : [""],
                              })
                            }
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#e11d48]"
                            title="Remove connector"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}

                        {canEditCurrentSection && index === draft.connectorConfigIds.length - 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                connectorConfigIds: [...draft.connectorConfigIds, ""],
                              })
                            }
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2]"
                            title="Add connector"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 3 ? (
                <div className="space-y-4">
                  <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                    <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
                      <div className="flex items-center gap-2 px-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                          Available tools
                        </p>
                        <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-indigo-600">
                          {availableTools.length}
                        </span>
                      </div>
                      <div className="mt-2 h-[200px] overflow-y-auto pr-1">
                        {availableTools.length === 0 ? (
                          <p className="px-2 py-2 text-sm text-[#8a94a6]">No tools available</p>
                        ) : (
                          availableTools.map((tool) => (
                            <button
                              key={tool}
                              type="button"
                              onClick={() => {
                                if (!canEditCurrentSection) {
                                  return;
                                }
                                setActiveAvailableTool(tool);
                              }}
                              className={`mb-1 flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                                activeAvailableTool === tool
                                  ? "bg-[#eef2ff] text-[#4f49e2]"
                                  : "text-[#44506a] hover:bg-[#f4f7ff]"
                              } ${!canEditCurrentSection ? "cursor-default" : ""}`}
                            >
                              <div className="min-w-0">
                                <div className="break-words font-medium">{tool}</div>
                                {toolSourceMap.get(tool)?.length ? (
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {toolSourceMap.get(tool)?.map((source) => (
                                      <span
                                        key={`${tool}-${source.kind}-${source.label}`}
                                        className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[#60708b]"
                                      >
                                        {source.kind}: {source.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canEditCurrentSection || !activeAvailableTool) {
                            return;
                          }

                          updateDraft({
                            tools: [...draft.tools, activeAvailableTool],
                          });
                          setActiveAvailableTool("");
                        }}
                        disabled={!canEditCurrentSection || !activeAvailableTool}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
                        title="Select tool"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!canEditCurrentSection || !activeSelectedTool) {
                            return;
                          }

                          updateDraft({
                            tools: draft.tools.filter((tool) => tool !== activeSelectedTool),
                          });
                          setActiveSelectedTool("");
                        }}
                        disabled={!canEditCurrentSection || !activeSelectedTool}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-white text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
                        title="Unselect tool"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
                      <div className="flex items-center gap-2 px-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
                          Selected tools
                        </p>
                        <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-indigo-600">
                          {draft.tools.length}
                        </span>
                      </div>
                      <div className="mt-2 h-[200px] overflow-y-auto pr-1">
                        {draft.tools.length === 0 ? (
                          <p className="px-2 py-2 text-sm text-[#8a94a6]">No tools selected</p>
                        ) : (
                          draft.tools.map((tool) => (
                            <button
                              key={tool}
                              type="button"
                              onClick={() => {
                                if (!canEditCurrentSection) {
                                  return;
                                }
                                setActiveSelectedTool(tool);
                              }}
                              className={`mb-1 flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                                activeSelectedTool === tool
                                  ? "bg-[#eef2ff] text-[#4f49e2]"
                                  : "text-[#44506a] hover:bg-[#f4f7ff]"
                              } ${!canEditCurrentSection ? "cursor-default" : ""}`}
                            >
                              <div className="min-w-0">
                                <div className="break-words font-medium">{tool}</div>
                                {toolSourceMap.get(tool)?.length ? (
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {toolSourceMap.get(tool)?.map((source) => (
                                      <span
                                        key={`${tool}-${source.kind}-${source.label}`}
                                        className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[#60708b]"
                                      >
                                        {source.kind}: {source.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 4 ? (
                <div className="space-y-3 p-4">
                  
                  {referenceRows.map((row, index) => (
                    <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#111827]">Reference</label>
                        <input
                          type="text"
                          value={row.reference}
                          onChange={(event) =>
                            updateReferenceRow(row.id, { reference: event.target.value })
                          }
                          placeholder="e.g. guideme.md"
                          disabled={!canEditCurrentSection}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#111827]">Text</label>
                        <input
                          type="text"
                          value={row.text}
                          onChange={(event) =>
                            updateReferenceRow(row.id, { text: event.target.value })
                          }
                          placeholder="Text"
                          disabled={!canEditCurrentSection}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-80"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        {canEditCurrentSection && referenceRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReferenceRows((current) =>
                                current.filter((item) => item.id !== row.id)
                              )
                            }
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-white text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#e11d48]"
                            title="Remove reference"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canEditCurrentSection && index === referenceRows.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => setReferenceRows((current) => [...current, createReferenceRow()])}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2]"
                            title="Add reference"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </ModalCardBody>

        <ModalCardFooter className="justify-between">
          <ModalCardRequiredNote visible={mode === "create" || mode === "update"} />
          {mode === "create" ? (
            <button
              type="button"
              onClick={() => {
                void saveCreate();
              }}
              disabled={!isCreateValid || isSaving}
              className="inline-flex items-center rounded-xl bg-[#4f49e2] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgba(79,73,226,0.8)] transition hover:bg-[#3f39d6] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#4f49e2]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className={isSaving ? "ml-2" : ""}>Configure Skill</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-xl border border-[#d8e1f0] bg-white px-5 py-2.5 text-sm font-semibold text-[#475569] transition hover:bg-[#f8faff]"
            >
              Close
            </button>
          )}
        </ModalCardFooter>
      </ModalCardPanel>
      {isPromptSkillOpen ? (
        <PromptAgent
          title="Draft Skill with AI"
          subtitle="Configure skill from prompt"
          description="Describe the Skill you want to configure."
          buttonLabel="Generate Skill Draft"
          loadingLabel="Generating Skill Draft..."
          helperText="You can review and edit generated skill fields before configuring the skill."
          promptLabel="Skill prompt"
          placeholder="Create a reusable incident resolution skill that explains troubleshooting steps, required tools, references, and expected response format."
          generationSteps={SKILL_DRAFT_GENERATION_STEPS}
          onClose={() => setIsPromptSkillOpen(false)}
          onGenerate={handleGenerateSkillDraft}
        />
      ) : null}
    </ModalCard>
  );
}
