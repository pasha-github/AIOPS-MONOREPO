"use client";

import { trimTrailingSlash } from "@/config/agent";
import { useRuntimeConfig } from "@/config/runtime-config";
import { CloudCog, Eye, Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";
import ProviderNavbar from "./ProviderNavbar";
import { providers } from "./providers";
import SetAWSconfig from "./SetAWSconfig";
import SetConfig from "./SetConfig";
import type { ConfigTab, ProviderKey } from "./types";
import ViewAWSconfig from "./ViewAWSconfig";
import ViewConfig from "./ViewConfig";

type SettingModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SettingModal({ isOpen, onClose }: SettingModalProps) {
  const { llmManagerApiBaseUrl } = useRuntimeConfig();
  const baseUrl = useMemo(() => trimTrailingSlash(llmManagerApiBaseUrl), [llmManagerApiBaseUrl]);

  const [provider, setProvider] = useState<ProviderKey>("vertex");
  const [tab, setTab] = useState<ConfigTab>("set");

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)]">
        <div className="flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <CloudCog className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-semibold">Provider Settings</p>
              <p className="text-xs text-white/80">Configure Providers</p>
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProviderNavbar
            providers={providers}
            provider={provider}
            onSelect={(nextProvider) => {
              setProvider(nextProvider);
              setTab("set");
            }}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-6  from-[#f8faff] via-[#f6f8ff] to-[#f9fbff] p-2 shadow-[0_14px_35px_-28px_rgba(79,73,226,0.45)]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab("set")}
                  className={`group relative overflow-hidden rounded-xl px-4 py-3 text-left transition ${
                    tab === "set"
                      ? "bg-white text-[#3228cb] shadow-[0_10px_25px_-18px_rgba(79,73,226,0.9)]"
                      : "text-[#64748b] hover:bg-white/70"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 transition ${
                      tab === "set" ? "bg-[#4f49e2]" : "bg-transparent group-hover:bg-[#c7cdfc]"
                    }`}
                  />
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${
                        tab === "set" ? "bg-[#eef2ff] text-[#4f49e2]" : "bg-[#eef2f7] text-[#64748b]"
                      }`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </span>
                    Set Config
                  </span>
                  <p className="mt-1 text-xs text-[#7b87a1]">Create or update provider credentials</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("view")}
                  className={`group relative overflow-hidden rounded-xl px-4 py-3 text-left transition ${
                    tab === "view"
                      ? "bg-white text-[#3228cb] shadow-[0_10px_25px_-18px_rgba(79,73,226,0.9)]"
                      : "text-[#64748b] hover:bg-white/70"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 transition ${
                      tab === "view" ? "bg-[#4f49e2]" : "bg-transparent group-hover:bg-[#c7cdfc]"
                    }`}
                  />
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${
                        tab === "view" ? "bg-[#eef2ff] text-[#4f49e2]" : "bg-[#eef2f7] text-[#64748b]"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                    View Config
                  </span>
                  <p className="mt-1 text-xs text-[#7b87a1]">Inspect saved configuration and status</p>
                </button>
              </div>
            </div>

            {tab === "set" ? (
              provider === "aws" ? (
                <SetAWSconfig baseUrl={baseUrl} onCreated={() => setTab("view")} />
              ) : (
                <SetConfig provider={provider} baseUrl={baseUrl} onCreated={() => setTab("view")} />
              )
            ) : provider === "aws" ? (
              <ViewAWSconfig isOpen={isOpen} baseUrl={baseUrl} />
            ) : (
              <ViewConfig isOpen={isOpen} provider={provider} baseUrl={baseUrl} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
