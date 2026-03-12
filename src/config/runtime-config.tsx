"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { RuntimeConfig } from "./agent";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

type RuntimeConfigProviderProps = {
  config: RuntimeConfig;
  children: ReactNode;
};

export function RuntimeConfigProvider({
  config,
  children,
}: RuntimeConfigProviderProps) {
  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export const useRuntimeConfig = () => {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error("Runtime config is not available.");
  }
  return config;
};
