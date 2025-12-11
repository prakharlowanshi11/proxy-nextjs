"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FeatureDetails,
  FeatureTypeEntity,
  MethodEntity,
  MethodService,
  MethodServiceConfiguration,
} from "@/lib/api";
import { FeaturesApi } from "@/lib/api";

type FieldConfig = Record<string, unknown> & {
  type?: string;
  label?: string;
  placeholder?: string;
  is_required?: boolean;
  regex?: string;
  hint?: string;
  info?: string;
  value?: string;
  delimiter?: string;
  allowed_types?: string;
  source?: string[];
  sourceFieldLabel?: string[];
  sourceFieldValue?: string[];
  filter_conditions?: Array<{
    when?: { field?: string; equals?: string };
    allowed_values?: string[];
    hide?: boolean;
  }>;
};

type FieldState = {
  value: string;
  chips: string[];
  file?: File | null;
  touched: boolean;
  error: string | null;
};

type FieldGroupState = Record<string, FieldState>;

type ServiceFormState = {
  isEnabled: boolean;
  requirements: FieldGroupState;
  configurations: FieldGroupState;
};

type FieldGroupKey = "requirements" | "configurations";

const stepLabels = ["Select Block", "Name Block", "Configure Services", "Authorization"];
const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_\s]+$/;
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 60;

const themeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const editTabs = [
  { id: "service", label: "Service" },
  { id: "settings", label: "Settings" },
  { id: "design", label: "Design & Code" },
] as const;

type EditTab = (typeof editTabs)[number]["id"];

const FeatureServiceIds = {
  Msg91OtpService: 6,
  GoogleAuthentication: 7,
  PasswordAuthentication: 9,
} as const;

const DEFAULT_PROXY_SCRIPT_BASE_URL =
  process.env.NEXT_PUBLIC_PROXY_SCRIPT_BASE_URL ?? process.env.NEXT_PUBLIC_PROXY_SERVER ?? "https://test.proxy.msg91.com";

const PROXY_AUTH_SCRIPT_ATTR = "data-proxy-auth-script";

const getProxyAuthScriptSrc = (timestamp?: number) =>
  `${DEFAULT_PROXY_SCRIPT_BASE_URL.replace(/\/$/, "")}/assets/proxy-auth/proxy-auth.js${timestamp ? `?time=${timestamp}` : ""}`;

const buildProxyAuthScript = (referenceId?: string | null, type?: string | null) => {
  const sanitizedReference = referenceId?.trim() || "<reference_id>";
  const normalizedType = (type?.trim() || "authorization").replace(/\s+/g, "-").toLowerCase();
  const scriptUrl = getProxyAuthScriptSrc();
  return `<script type="text/javascript">
    var configuration = {
        referenceId: '${sanitizedReference}',
        type: '${normalizedType}',
        success: (data) => {
            console.log('success response', data);
        },
        failure: (error) => {
            console.log('failure reason', error);
        },
    };
</script>
<script
    type="text/javascript"
    onload="initVerification(configuration)"
    src="${scriptUrl}"
></script>`;
};

const buildDemoDivSnippet = (referenceId?: string | null) => `<div id="${referenceId?.trim() || "proxy-auth-button"}"></div>`;

const formatMethodType = (method?: MethodEntity) => (method?.service_use || method?.name || "authorization").toLowerCase().replace(/\s+/g, "-");

const sanitizeStringArray = (value?: string, delimiter = ",") => {
  if (!value) {
    return [];
  }
  return value
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toClonedConfig = (config: FieldConfig) => JSON.parse(JSON.stringify(config ?? {}));

const readStoredFieldValue = (entry: unknown) => {
  if (!entry) {
    return undefined;
  }
  if (typeof entry === "object" && "value" in (entry as Record<string, unknown>)) {
    return (entry as Record<string, unknown>).value;
  }
  return entry;
};

const hydrateGroupState = (
  definitions?: Record<string, FieldConfig>,
  stored?: Record<string, unknown>
): FieldGroupState => {
  if (!definitions) {
    return {};
  }
  return Object.entries(definitions).reduce<FieldGroupState>((acc, [key, config]) => {
    const raw = stored ? readStoredFieldValue(stored[key]) : undefined;
    if (config.type === "chipList") {
      const delimiter = config.delimiter ?? " ";
      const chips = Array.isArray(raw)
        ? (raw as unknown[]).map((item) => String(item)).filter(Boolean)
        : typeof raw === "string"
        ? sanitizeStringArray(raw, delimiter)
        : raw !== undefined && raw !== null
        ? [String(raw)]
        : [];
      acc[key] = {
        value: "",
        chips,
        touched: false,
        error: null,
      };
    } else if (config.type === "readFile") {
      acc[key] = {
        value: raw ? String(raw) : "",
        chips: [],
        file: null,
        touched: false,
        error: null,
      };
    } else {
      acc[key] = {
        value: raw !== undefined && raw !== null ? String(raw) : "",
        chips: [],
        touched: false,
        error: null,
      };
    }
    return acc;
  }, {});
};

const getSelectOptions = (config: FieldConfig) => {
  if (!config) {
    return [];
  }
  if (Array.isArray(config.source)) {
    return config.source.map((entry) => ({ label: entry, value: entry }));
  }
  if (Array.isArray(config.sourceFieldLabel) && Array.isArray(config.sourceFieldValue)) {
    return config.sourceFieldLabel.map((label, index) => ({
      label,
      value: config.sourceFieldValue?.[index] ?? label,
    }));
  }
  if (config.regex) {
    const patternMatch = config.regex.match(/\^\(([^)]+)\)\$/);
    if (patternMatch?.[1]) {
      return patternMatch[1].split("|").map((entry) => ({
        label: entry.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        value: entry,
      }));
    }
  }
  return [];
};

const formatFieldValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "object" && "toString" in (value as { toString?: () => string | null })) {
    const toStringFn = (value as { toString?: () => string | null }).toString;
    if (typeof toStringFn === "function") {
      return toStringFn.call(value) ?? "";
    }
  }
  return "";
};

const buildFieldGroupState = (group?: Record<string, FieldConfig>, previous?: FieldGroupState): FieldGroupState => {
  if (!group) {
    return {};
  }
  return Object.entries(group).reduce<FieldGroupState>((acc, [key, config]) => {
    const prior = previous?.[key];
    if (config?.type === "chipList") {
      const defaultChips = prior?.chips?.length
        ? prior.chips
        : sanitizeStringArray((config.value as string) ?? "", config.delimiter ?? ",");
      acc[key] = {
        value: "",
        chips: defaultChips,
        file: null,
        touched: false,
        error: null,
      };
    } else {
      acc[key] = {
        value: prior?.value ?? formatFieldValue(config?.value),
        chips: [],
        file: config?.type === "readFile" ? null : undefined,
        touched: false,
        error: null,
      };
    }
    return acc;
  }, {});
};

const validateField = (config: FieldConfig, state?: FieldState) => {
  if (!config || !state) {
    return null;
  }
  const label = config.label ?? "This field";
  if (config.is_required) {
    if (config.type === "chipList" && !state.chips.length) {
      return `${label} is required.`;
    }
    if ((!state.value || !state.value.trim()) && config.type !== "chipList") {
      return `${label} is required.`;
    }
    if (config.type === "readFile" && !state.file && !state.value) {
      return `${label} is required.`;
    }
  }
  if (config.regex && state.value) {
    try {
      const regexMatch = config.regex.match(/^\/(.+)\/([gimsuy]*)$/);
      const expression = regexMatch ? new RegExp(regexMatch[1], regexMatch[2]) : new RegExp(config.regex);
      if (!expression.test(state.value)) {
        return `Enter a valid ${label.toLowerCase()}.`;
      }
    } catch {
      // ignore malformed regex
    }
  }
  return null;
};

async function mapFieldGroupPayload(
  group?: Record<string, FieldConfig>,
  state?: FieldGroupState
): Promise<Record<string, FieldConfig>> {
  if (!group) {
    return {};
  }
  const entries = await Promise.all(
    Object.entries(group).map(async ([key, config]) => {
      const cloned = toClonedConfig(config);
      const fieldState = state?.[key];
      if (!fieldState) {
        return [key, cloned] as const;
      }
      if (config.type === "chipList") {
        cloned.value = fieldState.chips.join(config.delimiter ?? " ");
      } else if (config.type === "readFile") {
        if (fieldState.file) {
          cloned.value = await fieldState.file.text();
          cloned.fileName = fieldState.file.name;
        } else {
          cloned.value = fieldState.value;
        }
      } else {
        cloned.value = fieldState.value;
      }
      return [key, cloned] as const;
    })
  );
  return Object.fromEntries(entries);
}

function CreateBlockPageContent() {
  const searchParams = useSearchParams();
  const editingFeatureIdParam = searchParams.get("featureId");
  const editingFeatureId: string | null = editingFeatureIdParam?.trim() || null;
  const isEditMode = Boolean(editingFeatureId);

  const [step, setStep] = useState(0);
  const [types, setTypes] = useState<FeatureTypeEntity[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);

  const [featureDetails, setFeatureDetails] = useState<FeatureDetails | null>(null);
  const [featureDetailsLoading, setFeatureDetailsLoading] = useState(false);
  const [featureDetailsError, setFeatureDetailsError] = useState<string | null>(null);
  const [hasHydratedFromDetails, setHasHydratedFromDetails] = useState(false);

  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
  const [methods, setMethods] = useState<MethodEntity[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === selectedMethodId) ?? methods[0],
    [methods, selectedMethodId]
  );

  const [blockName, setBlockName] = useState("");
  const [serviceState, setServiceState] = useState<Record<number, ServiceFormState>>({});
  const [authorizationKey, setAuthorizationKey] = useState("");
  const [sessionTime, setSessionTime] = useState("3600");
  const [theme, setTheme] = useState(themeOptions[0].value);
  const [allowRegistrations, setAllowRegistrations] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<EditTab>("service");
  const [previewLayout, setPreviewLayout] = useState<"top" | "bottom">("top");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFeedback, setPreviewFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const previewScriptLoadRef = useRef<Promise<void> | null>(null);
  const previewFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isServiceEnabled = useCallback(
    (service: MethodService) => {
      const formState = serviceState[service.service_id];
      return formState?.isEnabled ?? service.is_enable ?? true;
    },
    [serviceState]
  );

  const enabledServices = useMemo(
    () => (selectedMethod?.method_services ?? []).filter((service) => isServiceEnabled(service)),
    [isServiceEnabled, selectedMethod?.method_services]
  );

  const passwordServicesEnabled = useMemo(
    () => enabledServices.some((service) => service.service_id === FeatureServiceIds.PasswordAuthentication),
    [enabledServices]
  );

  const alternativeServices = useMemo(
    () => enabledServices.filter((service) => service.service_id !== FeatureServiceIds.PasswordAuthentication),
    [enabledServices]
  );

  const scriptSnippet = useMemo(
    () => buildProxyAuthScript(featureDetails?.reference_id, formatMethodType(selectedMethod)),
    [featureDetails?.reference_id, selectedMethod]
  );

  const demoDivSnippet = useMemo(() => buildDemoDivSnippet(featureDetails?.reference_id), [featureDetails?.reference_id]);
  const currentReferenceId = featureDetails?.reference_id ?? null;
  const featureMethod = featureDetails?.method;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHasHydratedFromDetails(false);
  }, [editingFeatureId]);

  useEffect(() => {
    setActiveEditTab("service");
    setPreviewLayout("top");
  }, [editingFeatureId, isEditMode]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewFeedbackTimeoutRef.current) {
        clearTimeout(previewFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const nameError = useMemo(() => {
    const value = blockName.trim();
    if (!value) {
      return "Block name is required.";
    }
    if (value.length < NAME_MIN_LENGTH) {
      return `Block name must be at least ${NAME_MIN_LENGTH} characters.`;
    }
    if (value.length > NAME_MAX_LENGTH) {
      return `Block name cannot exceed ${NAME_MAX_LENGTH} characters.`;
    }
    if (!NAME_REGEX.test(value)) {
      return "Only letters, numbers, spaces, and underscores are allowed.";
    }
    return null;
  }, [blockName]);

  useEffect(() => {
    let isMounted = true;
    const loadTypes = async () => {
      setTypesLoading(true);
      setTypesError(null);
      try {
        const response = await FeaturesApi.types();
        if (!isMounted) return;
        setTypes(response.data ?? []);
      } catch (error) {
        if (isMounted) {
          setTypesError(error instanceof Error ? error.message : "Unable to load block types.");
        }
      } finally {
        if (isMounted) {
          setTypesLoading(false);
        }
      }
    };
    loadTypes();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFeatureId) {
      setMethods([]);
      setSelectedMethodId(null);
      return;
    }
    let active = true;
    const loadMethods = async () => {
      setMethodsLoading(true);
      setMethodsError(null);
      try {
        const response = await FeaturesApi.methodServices(selectedFeatureId);
        if (!active) return;
        setMethods(response.data ?? []);
        const defaultMethodId = (() => {
          if (isEditMode && featureDetails?.feature_id === selectedFeatureId && featureDetails?.method_id) {
            return featureDetails.method_id;
          }
          return response.data?.[0]?.id ?? null;
        })();
        setSelectedMethodId(defaultMethodId);
      } catch (error) {
        if (active) {
          setMethodsError(error instanceof Error ? error.message : "Unable to load services for this block.");
          setMethods([]);
        }
      } finally {
        if (active) {
          setMethodsLoading(false);
        }
      }
    };
    loadMethods();
    return () => {
      active = false;
    };
  }, [featureDetails, isEditMode, selectedFeatureId]);

  useEffect(() => {
    if (!selectedMethod) {
      setServiceState({});
      return;
    }
    setServiceState((previous) => {
      const next: Record<number, ServiceFormState> = {};
      selectedMethod.method_services?.forEach((service) => {
        const prior = previous[service.service_id];
        next[service.service_id] = {
          isEnabled: prior?.isEnabled ?? service.is_enable ?? true,
          requirements: buildFieldGroupState(service.requirements as Record<string, FieldConfig>, prior?.requirements),
          configurations: buildFieldGroupState(
            (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>,
            prior?.configurations
          ),
        };
      });
      return next;
    });
    setAuthorizationKey((prev) => prev || selectedMethod.authorization_format?.key || "");
  }, [selectedMethod]);

  useEffect(() => {
    if (!isEditMode || !editingFeatureId) {
      setFeatureDetails(null);
      setFeatureDetailsError(null);
      setFeatureDetailsLoading(false);
      return;
    }
    let active = true;
    setFeatureDetailsLoading(true);
    setFeatureDetailsError(null);
    const loadDetails = async () => {
      try {
        const response = await FeaturesApi.details(editingFeatureId);
        if (!active) {
          return;
        }
        const details = response.data ?? null;
        setFeatureDetails(details);
        if (details && !hasHydratedFromDetails) {
          setBlockName(details.name ?? "");
          setSelectedFeatureId(details.feature_id ?? null);
          setSelectedMethodId(details.method_id ?? null);
          setAuthorizationKey(details.authorization_format?.key ?? "");
          setSessionTime(String(details.session_time ?? 3600));
          const extra = (details.extra_configurations ?? {}) as Record<string, unknown>;
          setTheme(typeof extra.theme === "string" ? extra.theme : themeOptions[0].value);
          const allowFlag =
            typeof extra.allowNewUserRegistration === "boolean"
              ? extra.allowNewUserRegistration
              : typeof extra.create_account_link === "boolean"
              ? extra.create_account_link
              : false;
          setAllowRegistrations(allowFlag);
          setHasHydratedFromDetails(true);
        }
      } catch (error) {
        if (active) {
          setFeatureDetailsError(error instanceof Error ? error.message : "Unable to load block details.");
          setFeatureDetails(null);
        }
      } finally {
        if (active) {
          setFeatureDetailsLoading(false);
        }
      }
    };
    loadDetails();
    return () => {
      active = false;
    };
  }, [editingFeatureId, hasHydratedFromDetails, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !featureDetails || !selectedMethod?.method_services?.length) {
      return;
    }
    const details = featureDetails;
    const rawConfigs = (details?.service_configurations ?? []) as unknown;
    const normalizedConfigs = Array.isArray(rawConfigs)
      ? rawConfigs
      : Object.values((rawConfigs as Record<string, unknown>) ?? {});
    const storedConfigs = new Map(
      (normalizedConfigs as Array<{
        service_id: number;
        is_enable?: boolean;
        requirements?: Record<string, unknown>;
        configurations?: { fields?: Record<string, unknown> };
      }>)
        .filter((entry) => typeof entry?.service_id === "number")
        .map((entry) => [entry.service_id, entry])
    );
    setServiceState(() => {
      const next: Record<number, ServiceFormState> = {};
      selectedMethod.method_services?.forEach((service) => {
        const stored = storedConfigs.get(service.service_id);
        next[service.service_id] = {
          isEnabled: stored?.is_enable ?? service.is_enable ?? true,
          requirements: hydrateGroupState(
            service.requirements as Record<string, FieldConfig>,
            stored?.requirements as Record<string, unknown>
          ),
          configurations: hydrateGroupState(
            (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>,
            (stored?.configurations as { fields?: Record<string, unknown> })?.fields
          ),
        };
      });
      return next;
    });
  }, [featureDetails, isEditMode, selectedMethod]);

  const updateFieldState = useCallback(
    (serviceId: number, group: FieldGroupKey, key: string, updater: Partial<FieldState>) => {
      setServiceState((prev) => {
        const service = prev[serviceId];
        if (!service) {
          return prev;
        }
        const targetGroup = service[group] as FieldGroupState;
        const currentField = targetGroup?.[key];
        if (!currentField) {
          return prev;
        }
        return {
          ...prev,
          [serviceId]: {
            ...service,
            [group]: {
              ...targetGroup,
              [key]: {
                ...currentField,
                ...updater,
              },
            },
          },
        };
      });
    },
    []
  );

  const evaluateServiceFields = useCallback(
    (serviceId: number, options: { markTouched?: boolean } = {}) => {
      const { markTouched = false } = options;
      const service = selectedMethod?.method_services?.find((entry) => entry.service_id === serviceId);
      if (!service) {
        return true;
      }
      let valid = true;
      const checkGroup = (group?: Record<string, FieldConfig>, stateGroup?: FieldGroupState, groupKey?: FieldGroupKey) => {
        if (!group || !stateGroup || !groupKey) {
          return;
        }
        Object.entries(group).forEach(([key, config]) => {
          const fieldState = stateGroup[key];
          const error = validateField(config, fieldState);
          if (error) {
            valid = false;
          }
          if (markTouched) {
            updateFieldState(serviceId, groupKey, key, {
              error,
              touched: true,
            });
          }
        });
      };
      checkGroup(service.requirements as Record<string, FieldConfig>, serviceState[serviceId]?.requirements, "requirements");
      checkGroup(
        (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>,
        serviceState[serviceId]?.configurations,
        "configurations"
      );
      return valid;
    },
    [selectedMethod?.method_services, serviceState, updateFieldState]
  );

  const validateServices = useCallback(
    (markTouched: boolean) => {
      const services = selectedMethod?.method_services ?? [];
      if (!services.length) {
        return true;
      }
      return services.every((service) => evaluateServiceFields(service.service_id, { markTouched }));
    },
    [evaluateServiceFields, selectedMethod?.method_services]
  );

  const handleCopySnippet = useCallback(
    async (id: string, value: string | null | undefined) => {
      if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        setCopiedSnippet(id);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedSnippet((current) => (current === id ? null : current));
        }, 2000);
      } catch (error) {
        console.error("Unable to copy snippet", error);
      }
    },
    []
  );

  const schedulePreviewFeedbackClear = useCallback(() => {
    if (previewFeedbackTimeoutRef.current) {
      clearTimeout(previewFeedbackTimeoutRef.current);
    }
    previewFeedbackTimeoutRef.current = setTimeout(() => {
      setPreviewFeedback(null);
    }, 5000);
  }, []);

  const ensureProxyAuthScript = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return Promise.reject(new Error("Preview is only available in the browser."));
    }
    if (previewScriptLoadRef.current) {
      return previewScriptLoadRef.current;
    }
    const existing = document.querySelector(`script[${PROXY_AUTH_SCRIPT_ATTR}]`);
    if (existing) {
      previewScriptLoadRef.current = Promise.resolve();
      return previewScriptLoadRef.current;
    }
    previewScriptLoadRef.current = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.defer = true;
      script.src = getProxyAuthScriptSrc(Date.now());
      script.setAttribute(PROXY_AUTH_SCRIPT_ATTR, "true");
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        script.remove();
        previewScriptLoadRef.current = null;
        reject(new Error("Unable to load proxy auth script."));
      };
      document.body.appendChild(script);
    });
    return previewScriptLoadRef.current;
  }, []);

  const handlePreviewLaunch = useCallback(async () => {
    if (!currentReferenceId) {
      setPreviewFeedback({
        type: "error",
        message: "Save the block to generate a reference ID before launching a preview.",
      });
      schedulePreviewFeedbackClear();
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    setPreviewFeedback(null);
    setPreviewLoading(true);
    try {
      await ensureProxyAuthScript();
      const configuration = {
        referenceId: currentReferenceId,
        type: formatMethodType(selectedMethod ?? featureMethod),
        isPreview: true,
        target: "_blank",
        success: () => {
          setPreviewFeedback({ type: "success", message: "Authorization completed successfully." });
          schedulePreviewFeedbackClear();
        },
        failure: (error: { message?: string }) => {
          setPreviewFeedback({
            type: "error",
            message: error?.message || "Authorization failed. Please review your configuration.",
          });
          schedulePreviewFeedbackClear();
        },
      };
      const runtime = window as typeof window & {
        initVerification?: (config: typeof configuration) => void;
      };
      if (typeof runtime.initVerification !== "function") {
        throw new Error("Proxy auth script is not ready yet. Please try again.");
      }
      runtime.initVerification(configuration);
    } catch (error) {
      console.error("Failed to launch proxy auth preview", error);
      setPreviewFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to launch preview.",
      });
      schedulePreviewFeedbackClear();
    } finally {
      setPreviewLoading(false);
    }
  }, [currentReferenceId, ensureProxyAuthScript, featureMethod, schedulePreviewFeedbackClear, selectedMethod]);

  const canProceedFromStep = useCallback(() => {
    if (step === 0) {
      return Boolean(selectedFeatureId);
    }
    if (step === 1) {
      if (methodsLoading || methodsError) {
        return false;
      }
      return !nameError && Boolean(selectedMethod);
    }
    if (step === 2) {
      return validateServices(false);
    }
    if (step === 3) {
      return Boolean(authorizationKey.trim()) && Number(sessionTime) >= 60;
    }
    return true;
  }, [
    authorizationKey,
    methodsError,
    methodsLoading,
    nameError,
    selectedFeatureId,
    selectedMethod,
    sessionTime,
    step,
    validateServices,
  ]);

  const goToNextStep = () => {
    if (step === 2 && !validateServices(true)) {
      return;
    }
    if (step !== 2 && !canProceedFromStep()) {
      return;
    }
    setStep((prev) => Math.min(prev + 1, stepLabels.length - 1));
  };

  const goToPreviousStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const focusBasicsSection = () => {
    if (isEditMode) {
      setActiveEditTab("service");
    } else {
      setStep(1);
    }
  };

  const focusServiceConfiguration = () => {
    if (isEditMode) {
      setActiveEditTab("service");
    } else {
      setStep(2);
    }
  };

  const focusAuthorizationSettings = () => {
    if (isEditMode) {
      setActiveEditTab("settings");
    } else {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!selectedFeatureId) {
      setSubmitError("Select a block to continue.");
      if (!isEditMode) {
        setStep(0);
      }
      return;
    }
    if (!selectedMethod) {
      setSubmitError("Select an integration method to continue.");
      focusBasicsSection();
      return;
    }
    if (nameError) {
      setSubmitError(nameError);
      focusBasicsSection();
      return;
    }
    if (!validateServices(true)) {
      setSubmitError("Please resolve the highlighted validation errors.");
      focusServiceConfiguration();
      return;
    }
    const trimmedAuthorizationKey = authorizationKey.trim();
    const sessionTimeValue = Number(sessionTime);
    if (!trimmedAuthorizationKey || Number.isNaN(sessionTimeValue) || sessionTimeValue < 60) {
      setSubmitError("Authorization settings must include a key and a session time of at least 60 seconds.");
      focusAuthorizationSettings();
      return;
    }
    setSubmitting(true);
    try {
      const servicesPayload = await Promise.all(
        (selectedMethod.method_services ?? []).map(async (service) => {
          const formState = serviceState[service.service_id];
          const requirements = await mapFieldGroupPayload(
            service.requirements as Record<string, FieldConfig>,
            formState?.requirements
          );
          const configurationFields = await mapFieldGroupPayload(
            (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>,
            formState?.configurations
          );
          return {
            ...service,
            is_enable: formState?.isEnabled ?? true,
            requirements,
            configurations: {
              ...(service.configurations as MethodServiceConfiguration),
              fields: configurationFields,
            },
          };
        })
      );

      const trimmedName = blockName.trim();
      const payload = {
        name: trimmedName,
        feature_id: selectedFeatureId,
        method_id: selectedMethod.id,
        authorization_format: {
          ...selectedMethod.authorization_format,
          key: trimmedAuthorizationKey,
        },
        session_time: sessionTimeValue || 3600,
        extra_configurations: {
          theme,
          allowNewUserRegistration: allowRegistrations,
        },
        services: servicesPayload,
      };
      if (isEditMode && editingFeatureId) {
        await FeaturesApi.update(editingFeatureId, payload);
        setSubmitSuccess("Block updated successfully.");
      } else {
        await FeaturesApi.create(payload);
        setSubmitSuccess("Block created successfully.");
      }
      setSubmitError(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save block. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (
    serviceId: number,
    group: FieldGroupKey,
    fieldKey: string,
    config: FieldConfig,
    fieldState: FieldState
  ) => {
    if (!config || config.is_hidden) {
      return null;
    }
    const label = config.label ?? fieldKey;
    const id = `${serviceId}-${group}-${fieldKey}`;
    const options = config.type === "select" ? getSelectOptions(config) : [];

    const commonInput =
      config.type === "textarea" ? (
        <textarea
          id={id}
          className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
          placeholder={config.placeholder ? String(config.placeholder) : `Enter ${label}`}
          value={fieldState.value}
          onChange={(event) =>
            updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
          }
          onBlur={() =>
            updateFieldState(serviceId, group, fieldKey, {
              touched: true,
              error: validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]),
            })
          }
          rows={3}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
          placeholder={config.placeholder ? String(config.placeholder) : `Enter ${label}`}
          value={fieldState.value}
          onChange={(event) =>
            updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
          }
          onBlur={() =>
            updateFieldState(serviceId, group, fieldKey, {
              touched: true,
              error: validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]),
            })
          }
        />
      );

    return (
      <div key={id} className="space-y-1">
        <label htmlFor={id} className="text-xs font-semibold text-[#5d6164]">
          {label}
          {config.is_required && <span className="text-[#d92d20]"> *</span>}
        </label>
        {config.type === "select" ? (
          <select
            id={id}
            className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
            value={fieldState.value}
            onChange={(event) =>
              updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
            }
            onBlur={() =>
              updateFieldState(serviceId, group, fieldKey, {
                touched: true,
                error: validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]),
              })
            }
          >
            <option value="">Select {label}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : config.type === "chipList" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {fieldState.chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-full bg-[#3f51b5]/10 px-3 py-1 text-xs text-[#3f51b5]"
                >
                  {chip}
                  <button
                    type="button"
                    className="text-[#3f51b5]"
                    onClick={() => {
                      const next = fieldState.chips.filter((entry) => entry !== chip);
                      updateFieldState(serviceId, group, fieldKey, {
                        chips: next,
                        touched: true,
                        error: validateField(config, { ...fieldState, chips: next }),
                      });
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="w-full rounded-2xl border border-dashed border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
              placeholder={config.placeholder ? String(config.placeholder) : `Add ${label}`}
              value={fieldState.value}
              onChange={(event) => updateFieldState(serviceId, group, fieldKey, { value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
                  event.preventDefault();
                  const value = fieldState.value.trim();
                  if (value && !fieldState.chips.includes(value)) {
                    const updated = [...fieldState.chips, value];
                    updateFieldState(serviceId, group, fieldKey, {
                      chips: updated,
                      value: "",
                      touched: true,
                      error: validateField(config, { ...fieldState, chips: updated, value: "" }),
                    });
                  } else {
                    updateFieldState(serviceId, group, fieldKey, { value: "" });
                  }
                }
              }}
            />
          </div>
        ) : config.type === "readFile" ? (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept={config.allowed_types ? String(config.allowed_types) : undefined}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  updateFieldState(serviceId, group, fieldKey, {
                    file: null,
                    value: "",
                    touched: true,
                    error: validateField(config, { ...fieldState, file: null, value: "" }),
                  });
                  return;
                }
                updateFieldState(serviceId, group, fieldKey, {
                  file,
                  value: file.name,
                  touched: true,
                  error: null,
                });
              }}
            />
            {fieldState.value && <span className="text-xs text-[#5d6164]">{fieldState.value}</span>}
          </div>
        ) : (
          commonInput
        )}
        {config.hint && <p className="text-xs text-[#8f9396]">{String(config.hint)}</p>}
        {config.info && <p className="text-xs text-[#8f9396]">{String(config.info)}</p>}
        {fieldState.error && fieldState.touched && (
          <p className="text-xs text-[#b91c1c]">{fieldState.error}</p>
        )}
      </div>
    );
  };

  const renderServiceCard = (service: MethodService) => {
    const formState = serviceState[service.service_id];
    const requirements = service.requirements as Record<string, FieldConfig> | undefined;
    const configurationFields = (service.configurations as MethodServiceConfiguration | undefined)?.fields as
      | Record<string, FieldConfig>
      | undefined;

    return (
      <div key={service.service_id} className="rounded-2xl border border-[#e1e4e8] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#212528]">{service.name}</p>
            <p className="text-xs text-[#5d6164]">Service ID • {service.service_id}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-[#5d6164]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#d5d9dc]"
              checked={formState?.isEnabled ?? true}
              onChange={(event) =>
                setServiceState((prev) => ({
                  ...prev,
                  [service.service_id]: {
                    ...prev[service.service_id],
                    isEnabled: event.target.checked,
                    requirements: prev[service.service_id]?.requirements ?? {},
                    configurations: prev[service.service_id]?.configurations ?? {},
                  },
                }))
              }
            />
            Enable
          </label>
        </div>
        {requirements && Object.keys(requirements).length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#5d6164] uppercase">Requirements</p>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(requirements).map(([key, config]) =>
                renderField(service.service_id, "requirements", key, config, formState?.requirements?.[key] ?? {
                  value: "",
                  chips: [],
                  touched: false,
                  error: null,
                })
              )}
            </div>
          </div>
        )}
        {configurationFields && Object.keys(configurationFields).length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#5d6164] uppercase">Configurations</p>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(configurationFields).map(([key, config]) =>
                renderField(service.service_id, "configurations", key, config, formState?.configurations?.[key] ?? {
                  value: "",
                  chips: [],
                  touched: false,
                  error: null,
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBlockBasicsSection = () => (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-[#5d6164]">Block Name</label>
        <input
          type="text"
          value={blockName}
          onChange={(event) => setBlockName(event.target.value)}
          placeholder="E.g. OTP Verification"
          className="mt-1 w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
        />
        {nameError && <p className="text-xs text-[#b91c1c] mt-1">{nameError}</p>}
      </div>
      {methodsError && <p className="text-sm text-[#b91c1c]">{methodsError}</p>}
      {methodsLoading && <p className="text-sm text-[#5d6164]">Loading available services…</p>}
      {!methodsLoading && methods.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5d6164]">Integration Method</label>
          <select
            value={selectedMethod?.id ?? ""}
            onChange={(event) => setSelectedMethodId(Number(event.target.value))}
            className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
          >
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderServiceConfigurationSection = () => (
    <div className="space-y-4">
      <p className="text-sm text-[#5d6164]">
        Configure the inputs and credentials required for the services bundled with this block.
      </p>
      {(selectedMethod?.method_services ?? []).map((service) => renderServiceCard(service))}
      {!selectedMethod?.method_services?.length && (
        <p className="text-sm text-[#5d6164]">No services available for the selected method.</p>
      )}
    </div>
  );

  const renderPreviewInputFields = () => (
    <div className="space-y-3">
      <input
        type="text"
        readOnly
        placeholder="Email or phone"
        className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none ${
          theme === "dark"
            ? "border-white/20 bg-white/5 text-white placeholder:text-white/60"
            : "border-[#d5d9dc] bg-white text-[#212528]"
        }`}
      />
      <input
        type="password"
        readOnly
        placeholder="Password"
        className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none ${
          theme === "dark"
            ? "border-white/20 bg-white/5 text-white placeholder:text-white/60"
            : "border-[#d5d9dc] bg-white text-[#212528]"
        }`}
      />
      <button
        type="button"
        className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
          theme === "dark" ? "bg-white text-[#0f172a]" : "bg-[#3f51b5] text-white"
        }`}
      >
        Sign in
      </button>
    </div>
  );

  const renderPreviewButtons = () => (
    <div className="space-y-3">
      {alternativeServices.map((service) => (
        <button
          key={service.service_id}
          type="button"
          className={`w-full rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            theme === "dark"
              ? "border-white/30 text-white hover:border-white"
              : "border-[#d5d9dc] text-[#212528] hover:border-[#3f51b5]"
          }`}
        >
          Continue with {service.name}
        </button>
      ))}
    </div>
  );

  const renderPreviewDivider = () => {
    const lineClass = theme === "dark" ? "bg-white/20" : "bg-[#d5d9dc]";
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className={`h-px flex-1 ${lineClass}`} />
        <span className={theme === "dark" ? "text-white/70" : "text-[#5d6164]"}>Or continue with</span>
        <span className={`h-px flex-1 ${lineClass}`} />
      </div>
    );
  };

  const renderAuthorizationPreview = () => (
    <div
      className={`space-y-4 rounded-2xl border p-4 ${
        theme === "dark"
          ? "border-white/20 bg-[#111828] text-white"
          : "border-[#e1e4e8] bg-white"
      }`}
    >
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Sign in to your account</p>
        <p className={`text-xs ${theme === "dark" ? "text-white/70" : "text-[#5d6164]"}`}>
          Use any enabled service to authenticate
        </p>
      </div>
      {passwordServicesEnabled && previewLayout === "top" && renderPreviewInputFields()}
      {passwordServicesEnabled && alternativeServices.length > 0 && previewLayout === "top" && renderPreviewDivider()}
      {alternativeServices.length > 0 && renderPreviewButtons()}
      {passwordServicesEnabled && alternativeServices.length > 0 && previewLayout === "bottom" && renderPreviewDivider()}
      {passwordServicesEnabled && previewLayout === "bottom" && renderPreviewInputFields()}
      {allowRegistrations && (
        <p className={`text-center text-xs ${theme === "dark" ? "text-white/70" : "text-[#5d6164]"}`}>
          Are you a new user? <span className="text-[#3f51b5]">Create an account</span>
        </p>
      )}
    </div>
  );

  const renderAuthorizationSettingsSection = (options?: { includePreview?: boolean }) => {
    const includePreview = options?.includePreview ?? isEditMode;
    const authorizationFormat = featureDetails?.authorization_format?.format ?? selectedMethod?.authorization_format?.format;
    return (
      <div className={`grid gap-6 ${includePreview ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5d6164]">Authorization Key</label>
              <input
                type="text"
                value={authorizationKey}
                onChange={(event) => setAuthorizationKey(event.target.value)}
                placeholder="Enter authorization key"
                className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
              />
              {!authorizationKey.trim() && <p className="text-xs text-[#b91c1c]">Key is required.</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5d6164]">Session Time (seconds)</label>
              <input
                type="number"
                min={60}
                value={sessionTime}
                onChange={(event) => setSessionTime(event.target.value)}
                className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
              />
              {Number(sessionTime) < 60 && (
                <p className="text-xs text-[#b91c1c]">Minimum session time is 60 seconds.</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5d6164]">Theme</label>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#5d6164]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[#d5d9dc]"
                checked={allowRegistrations}
                onChange={(event) => setAllowRegistrations(event.target.checked)}
              />
              Allow end-users to self-register
            </label>
          </div>
          <p className="text-xs text-[#5d6164]">
            The JSON below represents the payload you will receive after a successful login. Use this to wire
            verification inside your platform.
          </p>
          {authorizationFormat && (
            <div className="relative rounded-2xl border border-[#e1e4e8] bg-[#0b1120] p-4 text-xs text-white">
              <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(authorizationFormat, null, 2)}</pre>
            </div>
          )}
        </div>
        {includePreview && (
          <div className="space-y-3">
            {isEditMode && (
              <div className="flex items-center justify-center gap-2 rounded-full bg-[#f4f5f7] p-1 text-xs font-semibold">
                <button
                  type="button"
                  className={`flex-1 rounded-full px-3 py-1 ${previewLayout === "top" ? "bg-white shadow" : "text-[#5d6164]"}`}
                  onClick={() => setPreviewLayout("top")}
                >
                  Input on Top
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full px-3 py-1 ${
                    previewLayout === "bottom" ? "bg-white shadow" : "text-[#5d6164]"
                  }`}
                  onClick={() => setPreviewLayout("bottom")}
                >
                  Input on Bottom
                </button>
              </div>
            )}
            {renderAuthorizationPreview()}
          </div>
        )}
      </div>
    );
  };

  const renderDesignAndCodeSection = () => {
    const canPreviewFeature = Boolean(currentReferenceId && currentReferenceId.trim());
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#212528]">Embed script</p>
          <div className="relative rounded-2xl border border-[#e1e4e8] bg-[#0b1120] p-4 text-xs text-white">
            <pre className="overflow-auto whitespace-pre-wrap">{scriptSnippet}</pre>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border border-white/40 px-3 py-1 text-xs"
              onClick={() => handleCopySnippet("script", scriptSnippet)}
            >
              {copiedSnippet === "script" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <p className="text-sm text-[#5d6164]">
          The social login button renders inside a modal by default. To inline the UI, add a container with your
          reference ID and mount the widget programmatically.
        </p>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#212528]">Inline container</p>
          <div className="relative rounded-2xl border border-[#e1e4e8] bg-[#0b1120] p-4 text-xs text-white">
            <pre className="overflow-auto whitespace-pre-wrap">{demoDivSnippet}</pre>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border border-white/40 px-3 py-1 text-xs"
              onClick={() => handleCopySnippet("container", demoDivSnippet)}
            >
              {copiedSnippet === "container" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-[#d5d9dc] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 text-sm text-[#5d6164]">
              <p className="text-sm font-semibold text-[#212528]">Preview experience</p>
              <p>
                {canPreviewFeature
                  ? "Launch the widget in a new tab to validate your current configuration."
                  : "Save the block to generate a reference ID before launching a preview."}
              </p>
              {previewFeedback && (
                <p
                  className={`mt-2 text-xs ${
                    previewFeedback.type === "success" ? "text-[#0f9d58]" : "text-[#b91c1c]"
                  }`}
                >
                  {previewFeedback.message}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded-full bg-[#3f51b5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={handlePreviewLaunch}
              disabled={!canPreviewFeature || previewLoading}
            >
              {previewLoading ? "Opening…" : "Preview"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const pageTitle = isEditMode ? "Manage Block" : "Add Block";
  const pageSubtitle = isEditMode
    ? "Update your block configuration, service credentials, plans, and authorization settings."
    : "Turn requirements into deployable proxies. Draft everything and plug your API to publish it.";
  const submitLabel = isEditMode ? "Update Block" : "Create Block";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/app/features" className="text-[#5d6164] hover:text-[#3f51b5]">
          Blocks
        </Link>
        <span className="text-[#c1c5c8]">/</span>
        <span className="text-[#212528] font-semibold">{pageTitle}</span>
      </div>
      <div className="app-card space-y-6 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-[#212528]">{pageTitle}</h2>
          <p className="text-sm text-[#5d6164]">{pageSubtitle}</p>
        </div>
        {featureDetailsError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {featureDetailsError}
          </div>
        )}
        {isEditMode && featureDetailsLoading && !featureDetails && (
          <div className="rounded-2xl border border-dashed border-[#d5d9dc] bg-[#f8f9fb] px-4 py-3 text-sm text-[#5d6164]">
            Loading block details…
          </div>
        )}
        {isEditMode ? (
          <>
            <div className="flex flex-wrap gap-3">
              {editTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    activeEditTab === tab.id
                      ? "bg-[#3f51b5] text-white"
                      : "bg-[#f1f2f4] text-[#5d6164] hover:bg-[#e7e9ec]"
                  }`}
                  onClick={() => setActiveEditTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="space-y-6">
              {activeEditTab === "service" && (
                <>
                  <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                    <p className="text-sm font-semibold text-[#212528]">Basics</p>
                    {renderBlockBasicsSection()}
                  </div>
                  <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                    {renderServiceConfigurationSection()}
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Update Services"}
                    </button>
                  </div>
                </>
              )}
              {activeEditTab === "settings" && (
                <>
                  <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                    {renderAuthorizationSettingsSection({ includePreview: true })}
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Save Settings"}
                    </button>
                  </div>
                </>
              )}
              {activeEditTab === "design" && (
                <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                  {renderDesignAndCodeSection()}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {stepLabels.map((label, index) => (
                <Fragment key={label}>
                  <button
                    className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold ${
                      index === step
                        ? "bg-[#3f51b5] text-white"
                        : index < step
                        ? "bg-[#3f51b5]/10 text-[#3f51b5]"
                        : "bg-[#f1f2f4] text-[#5d6164]"
                    }`}
                    onClick={() => {
                      if (index <= step && (index < step || canProceedFromStep())) {
                        setStep(index);
                      }
                    }}
                  >
                    {label}
                  </button>
                  {index < stepLabels.length - 1 && <span className="text-[#d5d9dc]">—</span>}
                </Fragment>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-[#5d6164]">Choose the block you want to configure.</p>
                {typesError && <p className="text-sm text-[#b91c1c]">{typesError}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  {typesLoading &&
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 animate-pulse rounded-2xl bg-[#f4f5f7]" />
                    ))}
                  {!typesLoading &&
                    types.map((type) => {
                      const isActive = selectedFeatureId === type.id;
                      return (
                        <button
                          key={type.id}
                          className={`rounded-2xl border px-4 py-5 text-left transition-colors ${
                            isActive
                              ? "border-[#3f51b5] bg-[#3f51b5]/5 text-[#3f51b5]"
                              : "border-[#e1e4e8] hover:border-[#3f51b5]"
                          }`}
                          onClick={() => {
                            setSelectedFeatureId(type.id);
                            setStep(1);
                          }}
                        >
                          <p className="text-base font-semibold">{type.name}</p>
                          <p className="text-xs text-[#5d6164] mt-1">ID • {type.id}</p>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {step === 1 && renderBlockBasicsSection()}
            {step === 2 && renderServiceConfigurationSection()}
            {step === 3 && renderAuthorizationSettingsSection({ includePreview: false })}

            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm text-[#5d6164]"
                    onClick={goToPreviousStep}
                  >
                    Back
                  </button>
                )}
                {step < stepLabels.length - 1 && (
                  <button
                    className="rounded-full bg-[#3f51b5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={goToNextStep}
                    disabled={!canProceedFromStep()}
                  >
                    Next
                  </button>
                )}
              </div>
              {step === stepLabels.length - 1 && (
                <button
                  className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={submitting || !canProceedFromStep()}
                >
                  {submitting ? "Saving…" : submitLabel}
                </button>
              )}
            </div>
          </>
        )}

        {submitError && <p className="text-sm text-[#b91c1c]">{submitError}</p>}
        {submitSuccess && <p className="text-sm text-[#0f9d58]">{submitSuccess}</p>}
      </div>
    </div>
  );
}

export default function CreateBlockPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CreateBlockPageContent />
    </Suspense>
  );
}
