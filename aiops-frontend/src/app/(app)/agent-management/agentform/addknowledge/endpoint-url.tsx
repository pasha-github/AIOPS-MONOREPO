"use client";

import { Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { inputClass, ThemedSingleDropdown } from "../../DynamicConnector";

export type KnowledgeSource = {
  id: string;
  category: string;
  value: string;
};

const KNOWLEDGE_SOURCE_CATEGORIES = [
  "Product Knowledge",
  "Domain Knowledge",
  "SOP",
  "Note",
];

const DEFAULT_KNOWLEDGE_SOURCE_CATEGORY = "Domain Knowledge";

type EndpointUrlKnowledgeProps = {
  sources: KnowledgeSource[];
  onSourcesChange: (sources: KnowledgeSource[]) => void;
};

export default function EndpointUrlKnowledge({
  sources,
  onSourcesChange,
}: EndpointUrlKnowledgeProps) {
  const [sourceCategory, setSourceCategory] = useState(
    DEFAULT_KNOWLEDGE_SOURCE_CATEGORY
  );
  const [sourceValue, setSourceValue] = useState("");
  const [sourceError, setSourceError] = useState("");

  const addSource = () => {
    const value = sourceValue.trim();
    const category = sourceCategory.trim() || DEFAULT_KNOWLEDGE_SOURCE_CATEGORY;

    if (!value) {
      setSourceError("Add an endpoint, repo, SOP, or note.");
      return;
    }

    setSourceError("");
    const alreadyExists = sources.some(
      (source) =>
        source.category.toLowerCase() === category.toLowerCase() &&
        source.value.toLowerCase() === value.toLowerCase()
    );

    if (alreadyExists) {
      setSourceValue("");
      return;
    }

    onSourcesChange([
      ...sources,
      {
        id: `${category}-${value}-${Date.now()}`,
        category,
        value,
      },
    ]);
    setSourceValue("");
  };

  const removeSource = (sourceId: string) => {
    onSourcesChange(sources.filter((source) => source.id !== sourceId));
    setSourceError("");
  };

  return (
    <div className="mt-3 rounded-2xl bg-white p-4">
      <div className="grid gap-2 md:grid-cols-[190px_1fr_auto]">
        <ThemedSingleDropdown
          value={sourceCategory}
          options={KNOWLEDGE_SOURCE_CATEGORIES.map((category) => ({
            value: category,
            label: category,
          }))}
          onChange={setSourceCategory}
          includePlaceholderOption={false}
        />
        <input
          value={sourceValue}
          onChange={(event) => {
            setSourceValue(event.target.value);
            setSourceError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addSource();
            }
          }}
          placeholder="Add URL, repo, SOP, or note"
          className={`${inputClass} h-10 text-sm`}
        />
        <button
          type="button"
          onClick={addSource}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
        >
          <Plus size={15} />
          Add source
        </button>
      </div>
      <p className="mt-2 text-xs leading-snug text-gray-400">
        Add one source at a time. Use URLs, SharePoint/wiki links, repository
        references, SOPs, or short notes.
      </p>

      {sourceError ? (
        <p className="mt-2 text-xs font-medium text-red-600">{sourceError}</p>
      ) : null}

      {sources.length > 0 ? (
        <div className="mt-3 space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-[#f8faff] px-3 py-2 ring-1 ring-indigo-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-indigo-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {source.category} | {source.value}
                  </p>
                  <p className="text-xs text-gray-400">
                    Knowledge endpoint source
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeSource(source.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                aria-label={`Remove ${source.category} source`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">No endpoint sources added.</p>
      )}
    </div>
  );
}
