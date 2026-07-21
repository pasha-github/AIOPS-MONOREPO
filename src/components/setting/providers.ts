import type { ProviderOption } from "./types";

export const providers: ProviderOption[] = [
  { key: "vertex", label: "Vertex", logoKey: "google", available: true, disable: false },
  { key: "azure", label: "Azure", available: false, disable: true },
  { key: "aws", label: "AWS", available: true, disable: false },
];
