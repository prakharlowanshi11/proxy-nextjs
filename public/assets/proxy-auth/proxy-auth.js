/**
 * Proxy Auth Main Script
 * ----------------------
 * Acts as the router for all proxy embeds. Based on the config `type`, the
 * script loads the relevant embed bundle and asks it to render into a shadow DOM.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const DEFAULT_CONTAINER_ID = "proxyContainer";
  const DEFAULT_EMBED_TYPE = "user-details";
  const EMBED_SCRIPT_MAP = {
    "user-details": "embeds/user-details.js",
    "company-directory": "embeds/company-directory.js",
    "member-summary": "embeds/member-summary.js",
    "user-management": "embeds/user-management.js",
  };

  const runtime = (window.ProxyAuthRuntime = window.ProxyAuthRuntime || {
    embeds: {},
    registerEmbed(type, renderer) {
      this.embeds[type] = renderer;
    },
  });

  runtime.DEFAULT_CONTAINER_ID = DEFAULT_CONTAINER_ID;
  runtime.getStaticData = getProxyAuthStaticData;
  runtime.createSurface = createSurface;
  runtime.injectStyles = injectStyles;
  runtime.invokeCallback = invokeCallback;
  runtime.resolveHost = resolveHost;
  runtime.formatJoinedDate = formatJoinedDate;
  runtime.getInitials = getInitials;

  window.getProxyAuthStaticData = getProxyAuthStaticData;
  window.initVerification = initVerification;

  const embedLoaders = {};
  let scriptBaseUrl = null;

  function initVerification(config) {
    const runtimeConfig = config || {};
    const start = () => {
      renderProxyAuth(runtimeConfig).catch((error) => {
        console.error("Proxy auth render failed", error);
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  function renderProxyAuth(config) {
    const host = resolveHost(config);
    if (!host) {
      const error = new Error("Proxy auth: Target container not found.");
      invokeCallback(config && config.failure, error);
      return Promise.reject(error);
    }

    const type = (config && config.type) || DEFAULT_EMBED_TYPE;
    const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
    const data = getProxyAuthStaticData();

    return ensureEmbedLoaded(type)
      .then(() => {
        const renderer = runtime.embeds[type];
        if (typeof renderer !== "function") {
          throw new Error("Embed renderer not registered for type: " + type);
        }
        renderer({ shadowRoot, data, config: config || {}, runtime });
      })
      .catch((error) => {
        invokeCallback(config && config.failure, error);
        throw error;
      });
  }

  function ensureEmbedLoaded(type) {
    if (runtime.embeds[type]) {
      return Promise.resolve();
    }
    const scriptPath = EMBED_SCRIPT_MAP[type];
    if (!scriptPath) {
      return Promise.reject(new Error("Unknown embed type: " + type));
    }
    if (!embedLoaders[type]) {
      embedLoaders[type] = loadScript(resolveEmbedUrl(scriptPath));
    }
    return embedLoaders[type];
  }

  function resolveEmbedUrl(path) {
    if (!scriptBaseUrl) {
      scriptBaseUrl = inferBaseUrl();
    }
    return scriptBaseUrl + path.replace(/^\//, "");
  }

  function inferBaseUrl() {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      return stripFile(currentScript.src);
    }
    const scripts = document.querySelectorAll("script[src]");
    for (let index = 0; index < scripts.length; index += 1) {
      const src = scripts[index].src;
      if (src && src.indexOf("proxy-auth.js") >= 0) {
        return stripFile(src);
      }
    }
    return "";
  }

  function stripFile(src) {
    return src.replace(/proxy-auth\.js(?:\?.*)?$/, "");
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load embed script: " + url));
      (document.body || document.head || document.documentElement).appendChild(script);
    });
  }

  function getProxyAuthStaticData() {
    return {
      client: {
        name: "harsh@whozzat.com",
        mobile: "--Not Provided--",
        email: "harsh@whozzat.com",
      },
      companies: [
        { id: 1, name: "Viasocket", isCurrent: false },
        { id: 2, name: "harsh_testing", isCurrent: false },
        { id: 3, name: "ProxyUI", isCurrent: true },
        { id: 4, name: "Techdoc", isCurrent: false },
        { id: 5, name: "Msg91", isCurrent: false },
        { id: 6, name: "Tanish Jain", isCurrent: false },
        { id: 7, name: "Prince Kumar", isCurrent: false },
        { id: 8, name: "testing1", isCurrent: false },
        { id: 9, name: "Karma Xtended", isCurrent: false },
      ],
      teamMembers: [
        { id: "u1", name: "harsh@whozzat.com", email: "harsh@whozzat.com", role: "Owner" },
        { id: "u2", name: "Harsh Sahu", email: "harshksahu1@gmail.com", role: "Owner" },
        { id: "u3", name: "husainbw123@gmail.com", email: "husainbw123@gmail.com", role: "Owner" },
        { id: "u4", name: "Parakh Jain", email: "parakhjain2301@gmail.com", role: "Owner" },
        { id: "u5", name: "Yogesh Patel", email: "ygurjar932@gmail.com", role: "Owner" },
        { id: "u6", name: "Natwar Rathor", email: "natwarrathor961@gmail.com", role: "Owner" },
        { id: "u7", name: "Aadityaraj Singh Mandloi", email: "aadityarajsinghmandloi04@gmail.com", role: "Owner" },
        { id: "u8", name: "embLCFyAmjigmHlsv", email: "5673YOURUSERLID@gtwy.ai", role: "User" },
      ],
    };
  }

  function resolveHost(config) {
    if (config && config.target instanceof HTMLElement) {
      return config.target;
    }
    if (config && typeof config.target === "string") {
      return document.querySelector(config.target);
    }
    const fallbackId =
      (config && (config.referenceId || config.containerId)) || DEFAULT_CONTAINER_ID;
    return document.getElementById(fallbackId);
  }

  function injectStyles(shadowRoot) {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: #1f2933;
      }
      *, *::before, *::after { box-sizing: border-box; }
      .proxy-surface {
        width: 100%;
        min-height: 100%;
        padding: 32px;
        background: #f7f7fb;
      }
      .proxy-surface--dark {
        background: #050609;
        color: #f7f8fc;
        min-height: 100vh;
        padding: 40px 32px 60px;
      }
      h2 {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 18px;
        color: #464b53;
      }
      h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 16px;
        color: #5d6168;
      }
      .proxy-surface--dark h2,
      .proxy-surface--dark h3 {
        color: #f8fafc;
      }
      .panel {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 15px 35px rgba(50, 50, 93, 0.1), 0 5px 15px rgba(0, 0, 0, 0.07);
        padding: 28px;
      }
      .panel + .panel { margin-top: 28px; }
      .client-form { display: grid; gap: 18px; max-width: 360px; }
      label { font-size: 12px; font-weight: 600; color: #9da3af; display: flex; flex-direction: column; gap: 6px; }
      input {
        height: 40px;
        border-radius: 6px;
        border: 1px solid #e4e7ec;
        padding: 0 12px;
        font-size: 14px;
        color: #16192c;
      }
      input:focus {
        border-color: #4b6bed;
        outline: none;
        box-shadow: 0 0 0 2px rgba(75, 107, 237, 0.15);
      }
      .primary-btn {
        margin-top: 10px;
        width: 110px;
        height: 38px;
        border: none;
        border-radius: 6px;
        background: #4255ff;
        color: #ffffff;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .primary-btn:hover { background: #2f3bda; }
      .table-shell { border-radius: 12px; overflow: hidden; border: 1px solid #edf0f7; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      thead { background: #f5f6fb; }
      th, td { padding: 14px 18px; text-align: left; }
      th {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #9ca3af;
      }
      tbody tr:nth-child(even) { background: #fbfbfe; }
      tbody tr:hover { background: #f1f5ff; }
      .leave-btn {
        background: transparent;
        border: none;
        color: #f04438;
        font-weight: 600;
        cursor: pointer;
      }
      .leave-btn:hover { text-decoration: underline; }
      .current-pill { color: #17803d; font-style: italic; font-weight: 600; }
      .company-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      .company-card {
        background: #ffffff;
        border: 1px solid #eceff5;
        border-radius: 10px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 6px 20px rgba(79, 86, 107, 0.08);
      }
      .company-card.current {
        border-color: #86efac;
        box-shadow: 0 8px 24px rgba(22, 163, 74, 0.12);
      }
      .company-rank {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #eef2ff;
        color: #4c51bf;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }
      .company-name { font-size: 16px; font-weight: 600; color: #101828; }
      .company-meta { font-size: 12px; color: #6b7280; }
      .summary-card {
        background: linear-gradient(135deg, #eef2ff, #ffffff);
        border-radius: 16px;
        padding: 26px;
        box-shadow: 0 25px 50px rgba(15, 23, 42, 0.08);
        max-width: 560px;
      }
      .summary-header { font-size: 22px; font-weight: 700; color: #1d1f2c; margin-bottom: 10px; }
      .summary-meta { font-size: 15px; color: #4b5563; margin-bottom: 24px; }
      .summary-stat-group { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
      .summary-stat { flex: 1; min-width: 120px; }
      .summary-stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
      .summary-stat-value { font-size: 24px; font-weight: 700; color: #111827; }
      .summary-primary {
        border: none;
        background: #111827;
        color: #fff;
        padding: 10px 18px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
      }
      .summary-primary:hover { background: #000000; }
      .summary-secondary {
        background: transparent;
        border: none;
        margin-left: 10px;
        color: #1d4ed8;
        font-weight: 600;
        cursor: pointer;
      }
      .summary-secondary:hover { text-decoration: underline; }
      .um-panel {
        background: #0d1117;
        border-radius: 16px;
        padding: 32px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 35px 50px rgba(0, 0, 0, 0.35);
      }
      .um-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 28px;
      }
      .um-title { font-size: 26px; font-weight: 600; margin: 0; color: #f5f5f7; }
      .um-subtitle { color: #9ca3af; font-size: 15px; margin-top: 6px; }
      .um-controls { display: flex; gap: 12px; flex-wrap: wrap; }
      .um-search {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 10px 14px;
        color: #f8fafc;
        min-width: 220px;
      }
      .um-search::placeholder { color: #7b8191; }
      .um-add-btn {
        border-radius: 10px;
        padding: 10px 18px;
        background: #f5f5f5;
        color: #111827;
        border: 1px solid transparent;
        cursor: pointer;
        font-weight: 600;
      }
      .um-add-btn:hover { background: #ffffff; }
      .um-member-list { margin-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
      .um-member {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 18px;
        align-items: center;
        padding: 18px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .um-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #161b22;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .um-user-primary { font-size: 16px; font-weight: 600; color: #f7f8fc; }
      .um-user-secondary { font-size: 14px; color: #9ea6ba; }
      .um-role { color: #f87171; font-weight: 600; margin-right: 12px; }
      .um-actions { display: flex; gap: 12px; }
      .um-icon-btn {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: transparent;
        color: #f8fafc;
        cursor: pointer;
      }
      .um-icon-btn:hover { border-color: rgba(255, 255, 255, 0.3); }
      @media (max-width: 640px) {
        .proxy-surface { padding: 18px; }
        .panel { padding: 20px; }
        table, thead, tbody, th, td, tr { display: block; }
        thead { display: none; }
        tbody tr { margin-bottom: 12px; }
        td {
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #eef1f9;
        }
        td::before {
          content: attr(data-label);
          font-weight: 600;
          color: #9da3af;
        }
      }
    `;
    shadowRoot.appendChild(style);
  }

  function createSurface(shadowRoot, variantClass) {
    shadowRoot.innerHTML = "";
    injectStyles(shadowRoot);
    const surface = document.createElement("div");
    surface.className = "proxy-surface" + (variantClass ? " " + variantClass : "");
    shadowRoot.appendChild(surface);
    return surface;
  }

  function invokeCallback(callback, payload) {
    if (typeof callback === "function") {
      try {
        callback(payload);
      } catch (error) {
        console.error("Proxy auth callback error:", error);
      }
    }
  }

  function formatJoinedDate(index) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[index % months.length];
    const year = 2019 + (index % 5);
    return month + " " + year;
  }

  function getInitials(value) {
    return value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("") || "?";
  }
})();
