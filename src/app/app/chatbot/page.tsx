"use client";

import { useContext } from "react";
import { ChatbotContext } from "@/context/chatbot";

export default function ChatbotPage() {
  const { status, error, retry } = useContext(ChatbotContext);

  if (status === "ready") {
    return null;
  }

  return (
    <div className="app-card space-y-4 p-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-[#5d6164]">Ask AI</p>
        <h2 className="text-2xl font-semibold text-[#212528]">Launching assistant</h2>
        <p className="text-sm text-[#5d6164]">
          The SAAR assistant mirrors the Angular experience. We open the embedded bridge inside the same container so
          you can chat with contextual data about logs, features, and onboarding flows.
        </p>
      </div>
      {status === "loading" && (
        <div className="rounded-2xl border border-dashed border-[#d5d9dc] bg-[#f8f9fb] px-4 py-3 text-sm text-[#5d6164]">
          Preparing a secure session…
        </div>
      )}
      {status === "idle" && (
        <div className="rounded-2xl border border-dashed border-[#d5d9dc] bg-[#f8f9fb] px-4 py-3 text-sm text-[#5d6164]">
          Sit tight while we finalise authentication for the assistant.
        </div>
      )}
      {status === "error" && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#b91c1c]">
          <p>{error ?? "Unable to load the assistant."}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-full border border-[#b91c1c] px-4 py-2 text-xs font-semibold text-[#b91c1c] hover:bg-[#b91c1c]/5"
          >
            Retry
          </button>
        </div>
      )}
      <p className="text-xs text-[#8f9396]">
        Once the bridge finishes loading, the assistant appears in the dedicated panel, matching the Angular console
        flow.
      </p>
    </div>
  );
}
