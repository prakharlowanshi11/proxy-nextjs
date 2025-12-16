"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientSettingsContext } from "@/context/client-settings";
import { ChatbotContext, ChatbotStatus } from "@/context/chatbot";
import type { ClientEntity, ClientSettings } from "@/lib/api";
import { RootApi } from "@/lib/api";
import { AuthApi } from "@/lib/api/auth";
import { ProxyApiError } from "@/lib/api/types";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { logoutFromFirebase } from "@/lib/auth/firebase";
import { getFirebase } from "@/lib/firebase/loadFirebase";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const CHATBOT_SCRIPT_URL =
  process.env.NEXT_PUBLIC_CHATBOT_SCRIPT_URL ?? "https://chatbot-embed.viasocket.com/chatbot-prod.js";
const CHATBOT_SCRIPT_ID = "chatbot-main-script";

const navItems: NavItem[] = [
  {
    label: "Logs",
    href: "/app/logs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" role="presentation">
        <path
          d="M6 5h12M6 12h12M6 19h12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Blocks",
    href: "/app/features",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" role="presentation">
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/app/users",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" role="presentation">
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 1.53-6 3.42V20h12v-2.58C18 15.53 15.33 14 12 14Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "Ask AI",
    href: "/app/chatbot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" role="presentation">
        <path
          d="M12 3a9 9 0 0 0-9 9 8.86 8.86 0 0 0 3.41 6.95V21l3.1-1.48A9.93 9.93 0 0 0 12 21a9 9 0 0 0 0-18Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="12" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const clientMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [clientSettings, setClientSettings] = useState<ClientSettings | null>(null);
  const [refreshingSettings, setRefreshingSettings] = useState(false);
  const [clientsList, setClientsList] = useState<ClientEntity[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [switchingClientId, setSwitchingClientId] = useState<number | null>(null);
  const [clientsPageMeta, setClientsPageMeta] = useState<{ pageNumber: number; totalPageCount: number }>({
    pageNumber: 1,
    totalPageCount: 1,
  });
  const clientsFetchLock = useRef(false);
  const hasLoadedInitialData = useRef(false);
  const showChatbot = pathname.startsWith("/app/chatbot");
  const [chatbotStatus, setChatbotStatus] = useState<ChatbotStatus>("idle");
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [chatbotBootstrapKey, setChatbotBootstrapKey] = useState(0);
  const [firebaseIdentity, setFirebaseIdentity] = useState<{
    name: string | null;
    email: string | null;
    photoURL?: string | null;
  } | null>(null);

  const redirectToLogin = useCallback(() => {
    clearAuthToken();
    setClientSettings(null);
    setClientId(null);
    setClientsList([]);
    setClientsError(null);
    setClientsPageMeta({ pageNumber: 1, totalPageCount: 1 });
    router.replace("/login");
  }, [router]);

  const refreshClientSettings = useCallback(async () => {
    setRefreshingSettings(true);
    try {
      const response = await RootApi.clientSettings();
      setClientSettings(response.data);
      setClientId(response.data?.client?.id ?? null);
    } catch (error) {
      if (error instanceof ProxyApiError && error.status === 401) {
        redirectToLogin();
      } else {
        console.error("Failed to fetch client settings", error);
      }
    } finally {
      setRefreshingSettings(false);
    }
  }, [redirectToLogin]);

  const loadClients = useCallback(
    async (pageNo = 1) => {
      if (clientsFetchLock.current) {
        return;
      }
      clientsFetchLock.current = true;
      setClientsLoading(true);
      setClientsError(null);
      try {
        const response = await RootApi.clients({ pageNo, itemsPerPage: 50 });
        const payload = response.data;
        setClientsList((prev) => (pageNo === 1 ? payload.data : [...prev, ...payload.data]));
        setClientsPageMeta({ pageNumber: payload.pageNumber, totalPageCount: payload.totalPageCount });
      } catch (error) {
        if (error instanceof ProxyApiError && error.status === 401) {
          redirectToLogin();
        } else {
          console.error("Failed to fetch clients", error);
          setClientsError(error instanceof Error ? error.message : "Unable to fetch clients");
        }
      } finally {
        clientsFetchLock.current = false;
        setClientsLoading(false);
      }
    },
    [redirectToLogin]
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (clientMenuOpen && clientMenuRef.current && !clientMenuRef.current.contains(target)) {
        setClientMenuOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [clientMenuOpen, userMenuOpen]);

  useEffect(() => {
    if (hasLoadedInitialData.current) {
      return;
    }
    hasLoadedInitialData.current = true;

    if (!getAuthToken()) {
      redirectToLogin();
      return;
    }
    refreshClientSettings();
    loadClients();
  }, [loadClients, redirectToLogin, refreshClientSettings]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const applyIdentity = (user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null) => {
      if (!isMounted) {
        return;
      }
      if (!user) {
        setFirebaseIdentity(null);
        return;
      }
      setFirebaseIdentity({
        name: user.displayName ?? user.email ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
      });
    };

    const bootstrap = async () => {
      try {
        const firebase = await getFirebase();
        const auth = firebase.auth();
        applyIdentity(auth.currentUser ?? null);
        unsubscribe = auth.onAuthStateChanged((user) => {
          applyIdentity(user);
        });
      } catch (error) {
        console.error("Failed to resolve Firebase identity", error);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const chatbotSessionEmail = clientSettings?.client?.email ?? "user";
  const chatbotThreadId = `${chatbotSessionEmail}${clientSettings?.client?.id ?? ""}`;

  useEffect(() => {
    if (!clientSettings) {
      return;
    }

    let cancelled = false;
    const bootstrap = async () => {
      const existingScript = document.getElementById(CHATBOT_SCRIPT_ID);
      if (existingScript) {
        setChatbotStatus("ready");
        return;
      }
      setChatbotStatus("loading");
      setChatbotError(null);
      try {
        const response = await RootApi.generateToken({ source: "chatbot" });
        if (cancelled) {
          return;
        }
        const jwt = response.data?.jwt;
        if (!jwt) {
          throw new Error("Chatbot token missing in response");
        }
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = CHATBOT_SCRIPT_URL;
        script.id = CHATBOT_SCRIPT_ID;
        script.setAttribute("embedToken", jwt);
        script.setAttribute("parentId", "ChatbotContainer");
        script.setAttribute("fullScreen", "true");
        script.setAttribute("hideIcon", "true");
        script.setAttribute("hideCloseButton", "true");
        script.onload = () => {
          if (cancelled) {
            return;
          }
          const payload = {
            variables: {
              variables: JSON.stringify({
                session: getAuthToken() ?? "",
              }),
            },
            threadId: chatbotThreadId,
            bridgeName: "root",
            parentId: "ChatbotContainer",
            fullScreen: true,
          };
          const w = window as typeof window & {
            SendDataToChatbot?: (params: unknown) => void;
            openChatbot?: () => void;
          };
          try {
            if (typeof w.SendDataToChatbot === "function") {
              w.SendDataToChatbot(payload);
            }
            if (typeof w.openChatbot === "function") {
              w.openChatbot();
            }
            setChatbotStatus("ready");
          } catch (error) {
            console.error("Failed to initialize chatbot bridge", error);
            setChatbotStatus("error");
            setChatbotError("Unable to establish chatbot session.");
          }
        };
        script.onerror = () => {
          if (cancelled) {
            return;
          }
          script.remove();
          setChatbotStatus("error");
          setChatbotError("Unable to load chatbot interface.");
        };
        document.body.appendChild(script);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to bootstrap chatbot", error);
        setChatbotStatus("error");
        setChatbotError(error instanceof Error ? error.message : "Unable to bootstrap chatbot.");
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSettings, chatbotBootstrapKey]);

  const retryChatbot = useCallback(() => {
    const script = document.getElementById(CHATBOT_SCRIPT_ID);
    if (script) {
      script.remove();
    }
    setChatbotError(null);
    setChatbotStatus("idle");
    setChatbotBootstrapKey((key) => key + 1);
  }, []);

  const activeClient = useMemo(() => {
    return clientsList.find((client) => client.id === clientId) ?? clientSettings?.client ?? clientsList[0] ?? null;
  }, [clientId, clientSettings, clientsList]);

  const hasMoreClients = clientsPageMeta.pageNumber < clientsPageMeta.totalPageCount;

  const fallbackName = clientSettings?.client?.name ?? "Team Member";
  const fallbackEmail = clientSettings?.client?.email ?? "team@example.com";
  const currentUserName = firebaseIdentity?.name ?? fallbackName;
  const currentUserEmail = firebaseIdentity?.email ?? fallbackEmail;

  const handleClientSwitch = async (client: ClientEntity) => {
    if (client.id === clientId || switchingClientId !== null) {
      setClientMenuOpen(false);
      return;
    }
    setSwitchingClientId(client.id);
    try {
      await RootApi.switchClient(client.id);
      setClientId(client.id);
      await refreshClientSettings();
      // Redirect to features page after switching client
      router.push("/app/features");
    } catch (error) {
      if (error instanceof ProxyApiError && error.status === 401) {
        redirectToLogin();
      } else {
        console.error("Failed to switch client", error);
      }
    } finally {
      setSwitchingClientId(null);
      setClientMenuOpen(false);
    }
  };

  const handleLogout = useCallback(async () => {
    setUserMenuOpen(false);
    try {
      await AuthApi.logout();
    } catch (error) {
      console.error("Failed to logout from API", error);
    } finally {
      try {
        await logoutFromFirebase();
      } catch (error) {
        console.error("Failed to terminate Firebase session", error);
      }
      redirectToLogin();
    }
  }, [redirectToLogin]);

  return (
    <ClientSettingsContext.Provider value={{ clientSettings, clientId, refreshClientSettings }}>
      <ChatbotContext.Provider value={{ status: chatbotStatus, error: chatbotError, visible: showChatbot, retry: retryChatbot }}>
        <div className="flex min-h-screen bg-app-surface text-[#3f4346]">
        <aside
          className={`hidden md:flex flex-col h-screen sticky top-0 bg-white border-r border-[#e1e4e8] shadow-sm transition-all duration-200 ${
            isCollapsed ? "w-[76px]" : "w-[264px]"
          }`}
        >
          {/* <div className="flex items-center gap-2 px-5 py-4 border-b border-[#e1e4e8]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(63,81,181,0.12)] text-[#3f51b5] font-semibold">
              SA
            </span>
            {!isCollapsed && (
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-[#212528]">SAAR Console</p>
                <p className="text-xs text-[#5d6164]">Proxy Management</p>
              </div>
            )}
          </div> */}
          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#3f51b5] text-white shadow-sm"
                      : "text-[#5d6164] hover:bg-[rgba(63,81,181,0.08)] hover:text-[#3f51b5]"
                  }`}
                  title={item.label}
                >
                  <span className="text-current">{item.icon}</span>
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="relative shrink-0 px-2 py-4 border-t border-[#e1e4e8]" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[rgba(63,81,181,0.08)] ${
                isCollapsed ? "justify-center" : ""
              }`}
              disabled={refreshingSettings && !clientSettings}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3f51b5] text-white font-semibold text-sm">
                {currentUserName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              {!isCollapsed && (
                <div className="flex flex-1 flex-col text-left overflow-hidden">
                  <span className="text-sm font-semibold text-[#212528] truncate">{currentUserName}</span>
                  <span className="text-xs text-[#5d6164] truncate">{refreshingSettings ? "Syncing…" : currentUserEmail}</span>
                </div>
              )}
              {!isCollapsed && (
                <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 text-[#5d6164]">
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              )}
            </button>
            {userMenuOpen && (
              <div className={`absolute ${isCollapsed ? "left-full ml-2" : "left-2 right-2"} bottom-full mb-2 z-20 rounded-2xl border border-[#e1e4e8] bg-white p-2 shadow-lg`}>
                <p className="px-3 py-2 text-xs text-[#5d6164]">Signed in as {currentUserEmail}</p>
                <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[rgba(63,81,181,0.08)]">
                  View profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#b91c1c] hover:bg-[rgba(239,68,68,0.12)]"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="flex flex-wrap items-center gap-4 border-b border-[#e1e4e8] bg-white px-6 py-4">
            <button
              className="md:hidden inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] px-3 py-2 text-sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
            >
              Menu
              <svg width="14" height="14" viewBox="0 0 24 24" className="text-[#3f51b5]">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="hidden md:block">
              <button
                className="inline-flex items-center justify-center rounded-full border border-[#d5d9dc] p-2 text-[#3f51b5] hover:border-[#3f51b5]"
                onClick={() => setIsCollapsed((prev) => !prev)}
              >
                {isCollapsed ? (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="m8 6 6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="m16 6-6 6 6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
            <div className="relative" ref={clientMenuRef}>
              <button
                onClick={() => setClientMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] px-4 py-2 text-sm font-medium hover:border-[#3f51b5]"
                disabled={clientsLoading && clientsList.length === 0}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(63,81,181,0.12)] text-[#3f51b5] font-semibold">
                  {(activeClient?.name ?? "S")[0]}
                </span>
                <span className="text-[#212528]">
                  {activeClient?.name ?? (clientsLoading ? "Loading clients..." : "Clients")}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
              {clientMenuOpen && (
                <div className="absolute z-20 mt-2 max-h-80 w-64 overflow-auto rounded-2xl border border-[#e1e4e8] bg-white p-2 shadow-lg space-y-2">
                  {clientsError && (
                    <p className="px-3 py-2 text-xs text-red-600 bg-red-50 rounded-xl">{clientsError}</p>
                  )}
                  {clientsList.map((client) => (
                    <button
                      key={client.id}
                      className={`flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm ${
                        client.id === activeClient?.id
                          ? "bg-[rgba(63,81,181,0.12)] text-[#3f51b5]"
                          : "hover:bg-[rgba(63,81,181,0.05)]"
                      }`}
                      onClick={() => handleClientSwitch(client)}
                      disabled={switchingClientId === client.id}
                    >
                      <span>{client.name}</span>
                      {client.id === activeClient?.id && <span className="text-xs font-semibold">Active</span>}
                      {switchingClientId === client.id && (
                        <span className="text-xs text-[#5d6164]">Switching...</span>
                      )}
                    </button>
                  ))}
                  {hasMoreClients && (
                    <button
                      className="w-full rounded-xl border border-dashed border-[#d5d9dc] px-3 py-2 text-sm text-[#3f51b5]"
                      onClick={() => loadClients(clientsPageMeta.pageNumber + 1)}
                      disabled={clientsLoading}
                    >
                      {clientsLoading ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden md:block text-xs text-[#5d6164]">
                {new Date().toLocaleString("en-IN", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-app-surface p-4 md:p-6">
            <div key={clientId ?? "no-client"} className={showChatbot ? "hidden" : "min-h-full"}>{children}</div>
            <div id="ChatbotContainer" className={showChatbot ? "min-h-[60vh]" : "hidden"} />
          </main>
        </div>
        </div>
      </ChatbotContext.Provider>
    </ClientSettingsContext.Provider>
  );
}
