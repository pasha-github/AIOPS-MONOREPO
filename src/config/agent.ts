export const AGENT_ORG_KEY = "ORG-00001-KEY";
export const AGENT_API_BASE_URL = "http://192.168.18.20:8000/";
export const AGENT_HOST = "http://192.168.18.20";
export const AGENT_WS_HOST = "ws://192.168.18.20";
export const AGENT_CONNECTORS_BASE_URL = "http://192.168.18.20:9001";

export type RuntimeConfig = {
  llmManagerApiBaseUrl: string;
  agentAdkBaseUrl: string;
};

export const getServerRuntimeConfig = (): RuntimeConfig => ({
  llmManagerApiBaseUrl: process.env.NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL ?? "",
  agentAdkBaseUrl: process.env.NEXT_PUBLIC_AGENT_ADK_BASE_URL ?? "",
});

export const trimTrailingSlash = (value: string) =>
  value.endsWith("/") ? value.slice(0, -1) : value;

export const LLM_PROVIDER_MODELS = {
  google: [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ],
  openai: [
    "gpt-5.4",
    "gpt-5.3",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5-mini",
    "gpt-5-nano"
  ],
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-6",
  ],
  groq: [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "moonshotai/kimi-k2-instruct-0905",
  ],
  bedrock: [
    "global.anthropic.claude-haiku-4-5-v1:0",
    "global.anthropic.claude-sonnet-4-6",
    "global.amazon.nova-2-lite-v1:0",
  ],
  azure_ai: [
    "claude-sonnet-4-6",
    "claude-opus-4-8",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.3-codex",
    "claude-haiku-4-5",
    "grok-4-1-fast-reasoning",
  ],
} as const;

export type LlmProviderKey = keyof typeof LLM_PROVIDER_MODELS;

export const formatLlmProviderLabel = (provider: string) => {
  if (provider === "azure_ai") {
    return "Azure AI Foundry";
  }

  return provider.length > 0
    ? provider[0].toUpperCase() + provider.slice(1)
    : provider;
};

export const getProviderIconPath = (provider: string) =>
  `/img/${provider}.webp`;
