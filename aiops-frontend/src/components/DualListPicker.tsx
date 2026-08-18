"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type DualListPickerItem = {
  id: string;
  name: string;
  secondary?: string;
};

type DualListPickerProps = {
  availableTitle: string;
  selectedTitle: string;
  items: DualListPickerItem[];
  selectedIds: string[];
  disabled?: boolean;
  emptyAvailableMessage: string;
  emptySelectedMessage: string;
  onChange: (selectedIds: string[]) => void;
  renderAvailableItem?: (item: DualListPickerItem) => ReactNode;
  renderSelectedItem?: (item: DualListPickerItem) => ReactNode;
};

export default function DualListPicker({
  availableTitle,
  selectedTitle,
  items,
  selectedIds,
  disabled = false,
  emptyAvailableMessage,
  emptySelectedMessage,
  onChange,
  renderAvailableItem,
  renderSelectedItem,
}: DualListPickerProps) {
  const [activeAvailableId, setActiveAvailableId] = useState("");
  const [activeSelectedId, setActiveSelectedId] = useState("");

  const availableItems = useMemo(
    () => items.filter((item) => !selectedIds.includes(item.id)),
    [items, selectedIds]
  );
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is DualListPickerItem => Boolean(item)),
    [items, selectedIds]
  );

  return (
    <div className="space-y-2">
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
              {availableTitle}
            </p>
            <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-indigo-600">
              {availableItems.length}
            </span>
          </div>
          <div className="mt-2 h-[200px] overflow-y-auto pr-1">
            {availableItems.length === 0 ? (
              <p className="px-2 py-2 text-sm text-[#8a94a6]">{emptyAvailableMessage}</p>
            ) : (
              availableItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (disabled) {
                      return;
                    }
                    setActiveAvailableId(item.id);
                  }}
                  className={`mb-1 flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeAvailableId === item.id
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#44506a] hover:bg-[#f4f7ff]"
                  } ${disabled ? "cursor-default" : ""}`}
                >
                  {renderAvailableItem ? (
                    renderAvailableItem(item)
                  ) : (
                    <div className="min-w-0">
                      <div className="break-words font-medium">{item.name}</div>
                      {item.secondary ? (
                        <div className="mt-1 text-xs text-[#7a8498]">{item.secondary}</div>
                      ) : null}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (disabled || !activeAvailableId) {
                return;
              }
              onChange([...selectedIds, activeAvailableId]);
              setActiveAvailableId("");
            }}
            disabled={disabled || !activeAvailableId}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-[#eef2ff] text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
            title="Select item"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (disabled || !activeSelectedId) {
                return;
              }
              onChange(selectedIds.filter((id) => id !== activeSelectedId));
              setActiveSelectedId("");
            }}
            disabled={disabled || !activeSelectedId}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d5dbeb] bg-white text-[#4f49e2] disabled:cursor-not-allowed disabled:opacity-40"
            title="Unselect item"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[260px] rounded-2xl border border-[#dce3f0] bg-[#fcfdff] p-3">
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8498]">
              {selectedTitle}
            </p>
            <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-indigo-600">
              {selectedItems.length}
            </span>
          </div>
          <div className="mt-2 h-[200px] overflow-y-auto pr-1">
            {selectedItems.length === 0 ? (
              <p className="px-2 py-2 text-sm text-[#8a94a6]">{emptySelectedMessage}</p>
            ) : (
              selectedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (disabled) {
                      return;
                    }
                    setActiveSelectedId(item.id);
                  }}
                  className={`mb-1 flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeSelectedId === item.id
                      ? "bg-[#eef2ff] text-[#4f49e2]"
                      : "text-[#44506a] hover:bg-[#f4f7ff]"
                  } ${disabled ? "cursor-default" : ""}`}
                >
                  {renderSelectedItem ? (
                    renderSelectedItem(item)
                  ) : (
                    <div className="min-w-0">
                      <div className="break-words font-medium">{item.name}</div>
                      {item.secondary ? (
                        <div className="mt-1 text-xs text-[#7a8498]">{item.secondary}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
