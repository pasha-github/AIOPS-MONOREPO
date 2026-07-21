"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { getErrorDetail } from "./utils";

type DeleteConfigButtonProps = {
  baseUrl: string;
  disabled: boolean;
  onDeleted: () => void;
  onErrorChange: (value: string) => void;
  iconOnly?: boolean;
  requestPath?: string;
  fallbackErrorMessage?: string;
  label?: string;
};

export default function DeleteConfigButton({
  baseUrl,
  disabled,
  onDeleted,
  onErrorChange,
  iconOnly = false,
  requestPath = "/vertex/config/",
  fallbackErrorMessage = "Unable to delete config.",
  label = "Delete Config",
}: DeleteConfigButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!baseUrl || isDeleting || disabled) {
      return;
    }

    setIsDeleting(true);
    onErrorChange("");

    try {
      const response = await fetch(`${baseUrl}${requestPath}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; detail?: string }
          | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(getErrorDetail(payload, fallbackErrorMessage));
      }

      onDeleted();
    } catch (error) {
      onErrorChange(error instanceof Error ? error.message : fallbackErrorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={isDeleting || disabled}
      className={`inline-flex items-center justify-center rounded-xl text-sm font-semibold text-white ${
        iconOnly ? "h-8 w-8 p-0" : "gap-2 px-5 py-2"
      } ${
        isDeleting || disabled
          ? "cursor-not-allowed bg-[#fca5a5]"
          : "bg-[#ef4444] hover:bg-[#dc2626]"
      }`}
      aria-label="Delete config"
      title={label}
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {iconOnly ? null : label}
    </button>
  );
}
