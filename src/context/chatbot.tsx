"use client";

import { createContext } from "react";

export type ChatbotStatus = "idle" | "loading" | "ready" | "error";

export type ChatbotContextValue = {
  status: ChatbotStatus;
  error: string | null;
  visible: boolean;
  retry: () => void;
};

export const ChatbotContext = createContext<ChatbotContextValue>({
  status: "idle",
  error: null,
  visible: false,
  retry: () => undefined,
});
