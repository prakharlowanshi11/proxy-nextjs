"use client";

import { useContext } from "react";
import { ChatbotContext } from "@/context/chatbot";

export default function ChatbotPage() {
  const { status, error, retry } = useContext(ChatbotContext);

  if (status === "ready") {
    return null;
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Animated AI Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#3f51b5] to-[#7986cb] shadow-lg">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={status === "loading" ? "animate-pulse" : ""}
          >
            <path d="M12 3a9 9 0 0 0-9 9 8.86 8.86 0 0 0 3.41 6.95V21l3.1-1.48A9.93 9.93 0 0 0 12 21a9 9 0 0 0 0-18Z" />
            <circle cx="9" cy="11" r="1" fill="white" stroke="none" />
            <circle cx="12" cy="11" r="1" fill="white" stroke="none" />
            <circle cx="15" cy="11" r="1" fill="white" stroke="none" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#212528]">
            {status === "loading" ? "Starting AI Assistant..." : status === "error" ? "Connection Failed" : "Initializing..."}
          </h2>
          <p className="text-sm text-[#5d6164]">
            {status === "error"
              ? "We couldn't connect to the AI assistant. Please try again."
              : "Setting up a secure connection to your AI assistant."}
          </p>
        </div>

        {(status === "loading" || status === "idle") && (
          <div className="flex justify-center gap-1.5">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3f51b5]" style={{ animationDelay: "0ms" }} />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3f51b5]" style={{ animationDelay: "150ms" }} />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3f51b5]" style={{ animationDelay: "300ms" }} />
          </div>
        )}

        {status === "error" && (
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-full bg-[#3f51b5] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#303f9f] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Try Again
          </button>
        )}

        <p className="text-xs text-[#8f9396]">
          The assistant helps you explore logs, manage features, and understand your data.
        </p>
      </div>
    </div>
  );
}
