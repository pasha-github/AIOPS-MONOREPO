"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";

type TestMcpProps = {
  mcpApiBase: string;
  payload: {
    server_url: string;
    auth_type: "none" | "bearer" | "basic";
    auth_username: string;
    auth_secret: string;
    name: string;
    description: string;
  };
  disabled: boolean;
  onTestSuccess: (response: unknown) => void;
};

export default function TestMcp({
  mcpApiBase,
  payload,
  disabled,
  onTestSuccess,
}: TestMcpProps) {
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    if (disabled || isTesting) {
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch(`${mcpApiBase}/mcp/test/`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        console.error("MCP test failed:", {
          status: response.status,
          response: data,
        });
        return;
      }
      onTestSuccess(data);
    } catch (error) {
      console.error("MCP test request failed:", error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleTest()}
      disabled={disabled || isTesting}
      className={`inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white ${
        disabled || isTesting
          ? "cursor-not-allowed bg-[#c7c4f7]"
          : "bg-[#4f49e2] shadow-[0_10px_24px_-18px_rgba(79,73,226,0.9)] hover:bg-[#3f39d6]"
      }`}
    >
      {isTesting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FlaskConical className="h-4 w-4" />
      )}
      {isTesting ? "Testing..." : "Test MCP"}
    </button>
  );
}
