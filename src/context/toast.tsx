"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastIntent = "success" | "error" | "info" | "warning";

export type ToastPayload = {
  title: string;
  intent?: ToastIntent;
  description?: string;
  duration?: number;
};

type ToastRecord = Required<Pick<ToastPayload, "title">> &
  Pick<ToastPayload, "description"> & {
    id: string;
    intent: ToastIntent;
  };

type ToastContextValue = {
  push: (payload: ToastPayload) => void;
  success: (title: string, description?: string, duration?: number) => void;
  error: (title: string, description?: string, duration?: number) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const randomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timerId = timersRef.current[id];
    if (timerId) {
      window.clearTimeout(timerId);
      delete timersRef.current[id];
    }
  }, []);

  const push = useCallback(
    (payload: ToastPayload) => {
      const id = randomId();
      const toast: ToastRecord = {
        id,
        title: payload.title,
        description: payload.description,
        intent: payload.intent ?? "info",
      };
      setToasts((prev) => [...prev, toast]);
      const duration = payload.duration ?? 4500;
      if (duration > 0) {
        timersRef.current[id] = window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = {};
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description, duration) =>
        push({ title, description, duration, intent: "success" }),
      error: (title, description, duration) => push({ title, description, duration, intent: "error" }),
      dismiss,
    }),
    [dismiss, push]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.intent}`}>
            <div className="toast-body">
              <strong className="toast-title">{toast.title}</strong>
              {toast.description && <p className="toast-description">{toast.description}</p>}
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
