"use client";

import { createContext, useContext } from "react";
import type { ClientSettings } from "@/lib/api";

export type ClientSettingsContextValue = {
  clientSettings: ClientSettings | null;
  clientId: number | null;
  refreshClientSettings: () => Promise<void>;
};

export const ClientSettingsContext = createContext<ClientSettingsContextValue | undefined>(undefined);

export function useClientSettings() {
  const context = useContext(ClientSettingsContext);
  if (!context) {
    throw new Error("useClientSettings must be used within ClientSettingsContext.Provider");
  }
  return context;
}
