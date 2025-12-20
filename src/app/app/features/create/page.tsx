"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FeatureDetails,
  FeatureTypeEntity,
  MethodEntity,
  MethodService,
  MethodServiceConfiguration,
} from "@/lib/api";
import { FeaturesApi } from "@/lib/api";
import type { FieldConfig, FieldState, FieldGroupState, ServiceFormState, FieldGroupKey, EditTab } from "@/types";
import { useToast } from "@/context/toast";
import {
  STEP_LABELS,
  NAME_REGEX,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  THEME_OPTIONS,
  EDIT_TABS,
  FEATURE_SERVICE_IDS,
  DEFAULT_PROXY_SCRIPT_BASE_URL,
  PROXY_AUTH_SCRIPT_ATTR,
  REDIRECT_FIELD_PATTERNS,
  getProxyAuthScriptSrc,
  buildProxyAuthScript,
  buildDemoDivSnippet,
} from "@/constants";

const formatMethodType = (method?: MethodEntity, featureId?: number | null) => {
  // If feature_id is 1, always use "authorization"
  if (featureId === 1) {
    return "authorization";
  }
  return (method?.service_use || method?.name || "authorization").toLowerCase().replace(/\s+/g, "-");
};

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

const readStoredFieldValue = (entry: unknown): unknown => {
  if (entry === undefined || entry === null) {
    return undefined;
  }
  // If it's a primitive, return as is
  if (typeof entry !== "object") {
    return entry;
  }
  const obj = entry as Record<string, unknown>;
  // If it has a 'value' property, extract it
  if ("value" in obj) {
    return obj.value;
  }
  // If it's an array, return as is (for chip lists)
  if (Array.isArray(entry)) {
    return entry;
  }
  // Otherwise return the object itself
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
    // Get default value from config if no stored value
    const defaultValue = formatFieldValue(config?.value);
    
    if (config.type === "chipList") {
      const delimiter = config.delimiter ?? " ";
      let chips: string[] = [];
      
      if (Array.isArray(raw)) {
        // Handle array of values
        chips = raw.map((item) => String(item)).filter(Boolean);
      } else if (typeof raw === "string" && raw.trim()) {
        // Handle string with delimiter
        chips = sanitizeStringArray(raw, delimiter);
      } else if (raw !== undefined && raw !== null && raw !== "") {
        // Handle single value
        chips = [String(raw)];
      } else if (defaultValue) {
        // Fall back to default value from config
        chips = sanitizeStringArray(defaultValue, delimiter);
      }
      
      acc[key] = {
        value: "",
        chips,
        touched: false,
        error: null,
      };
    } else if (config.type === "readFile") {
      acc[key] = {
        value: raw ? String(raw) : defaultValue,
        chips: [],
        file: null,
        touched: false,
        error: null,
      };
    } else {
      // Use stored value if available, otherwise fall back to config default
      acc[key] = {
        value: raw !== undefined && raw !== null ? String(raw) : defaultValue,
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
  const router = useRouter();
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
  const hasHydratedFromDetailsRef = useRef(false);

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
  const [blockNameTouched, setBlockNameTouched] = useState(false);
  const [serviceState, setServiceState] = useState<Record<number, ServiceFormState>>({});
  const [authorizationKey, setAuthorizationKey] = useState("");
  const [sessionTime, setSessionTime] = useState("3600");
  const [theme, setTheme] = useState(THEME_OPTIONS[0].value);
  const [allowRegistrations, setAllowRegistrations] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<EditTab>("service");
  const [previewLayout, setPreviewLayout] = useState<"top" | "bottom">("top");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFeedback, setPreviewFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const previewScriptLoadRef = useRef<Promise<void> | null>(null);
  const previewFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { success: showToastSuccess, error: showToastError } = useToast();

  const isServiceEnabled = useCallback(
    (service: MethodService) => {
      const formState = serviceState[service.service_id];
      return formState?.isEnabled ?? service.is_enable ?? false;
    },
    [serviceState]
  );

  const enabledServices = useMemo(
    () => (selectedMethod?.method_services ?? []).filter((service) => isServiceEnabled(service)),
    [isServiceEnabled, selectedMethod?.method_services]
  );

  const passwordServicesEnabled = useMemo(
    () => enabledServices.some((service) => service.service_id === FEATURE_SERVICE_IDS.PasswordAuthentication),
    [enabledServices]
  );

  const alternativeServices = useMemo(
    () => enabledServices.filter((service) => service.service_id !== FEATURE_SERVICE_IDS.PasswordAuthentication),
    [enabledServices]
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [createdFeatureData, setCreatedFeatureData] = useState<{ id: number; reference_id: string } | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);

  const effectiveReferenceId = createdFeatureData?.reference_id ?? featureDetails?.reference_id ?? null;

  // Set default selected service when services are loaded
  useEffect(() => {
    const services = selectedMethod?.method_services ?? [];
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].service_id);
    }
  }, [selectedMethod?.method_services, selectedServiceId]);
  
  const scriptSnippet = useMemo(
    () => buildProxyAuthScript(effectiveReferenceId ?? (blockName.trim().toLowerCase().replace(/\s+/g, "_") || null), formatMethodType(selectedMethod, selectedFeatureId ?? featureDetails?.feature_id)),
    [effectiveReferenceId, blockName, selectedMethod, selectedFeatureId, featureDetails?.feature_id]
  );

  const demoDivSnippet = useMemo(() => buildDemoDivSnippet(effectiveReferenceId ?? (blockName.trim().toLowerCase().replace(/\s+/g, "_") || null)), [effectiveReferenceId, blockName]);
  const currentReferenceId = effectiveReferenceId;
  const featureMethod = featureDetails?.method;

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
    // In edit mode, let the hydration effect handle the state
    // This effect only sets defaults for new block creation
    if (isEditMode && featureDetails) {
      // Only set authorization key if not already set
      setAuthorizationKey((prev) => prev || selectedMethod.authorization_format?.key || "");
      return;
    }
    setServiceState((previous) => {
      const next: Record<number, ServiceFormState> = {};
      selectedMethod.method_services?.forEach((service) => {
        const prior = previous[service.service_id];
        next[service.service_id] = {
          isEnabled: prior?.isEnabled ?? service.is_enable ?? false,
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
  }, [selectedMethod, isEditMode, featureDetails]);

  useEffect(() => {
    hasHydratedFromDetailsRef.current = false;
  }, [editingFeatureId]);

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
        if (details && !hasHydratedFromDetailsRef.current) {
          setBlockName(details.name ?? "");
          setSelectedFeatureId(details.feature_id ?? null);
          setSelectedMethodId(details.method_id ?? null);
          setAuthorizationKey(details.authorization_format?.key ?? "");
          setSessionTime(String(details.session_time ?? 3600));
          const extra = (details.extra_configurations ?? {}) as Record<string, unknown>;
          setTheme(typeof extra.theme === "string" ? extra.theme : THEME_OPTIONS[0].value);
          const allowFlag =
            typeof extra.allowNewUserRegistration === "boolean"
              ? extra.allowNewUserRegistration
              : typeof extra.create_account_link === "boolean"
              ? extra.create_account_link
              : false;
          setAllowRegistrations(allowFlag);
          hasHydratedFromDetailsRef.current = true;
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
  }, [editingFeatureId, isEditMode]);

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
        configurations?: { fields?: Record<string, unknown> } | Record<string, unknown>;
      }>)
        .filter((entry) => typeof entry?.service_id === "number")
        .map((entry) => [entry.service_id, entry])
    );
    setServiceState(() => {
      const next: Record<number, ServiceFormState> = {};
      selectedMethod.method_services?.forEach((service) => {
        const stored = storedConfigs.get(service.service_id);
        
        // Handle stored requirements - might have different structures
        const storedRequirements = stored?.requirements as Record<string, unknown> | undefined;
        
        // Handle stored configurations - might be in `fields` or directly in configurations
        const storedConfigurations = stored?.configurations as Record<string, unknown> | undefined;
        let storedConfigFields: Record<string, unknown> | undefined;
        
        if (storedConfigurations) {
          // Check if fields exist as a property
          if (storedConfigurations.fields && typeof storedConfigurations.fields === "object") {
            storedConfigFields = storedConfigurations.fields as Record<string, unknown>;
          } else {
            // Use configurations directly (might have field values at root level)
            storedConfigFields = storedConfigurations;
          }
        }
        
        next[service.service_id] = {
          isEnabled: stored?.is_enable ?? service.is_enable ?? false,
          requirements: hydrateGroupState(
            service.requirements as Record<string, FieldConfig>,
            storedRequirements
          ),
          configurations: hydrateGroupState(
            (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>,
            storedConfigFields
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

      // For edit mode, validate only ENABLED services
      if (isEditMode) {
        const enabledServicesToValidate = services.filter(
          (service) => serviceState[service.service_id]?.isEnabled
        );
        // If no services are enabled, validation passes
        if (!enabledServicesToValidate.length) {
          return true;
        }
        return enabledServicesToValidate.every((service) => 
          evaluateServiceFields(service.service_id, { markTouched })
        );
      }

      // For add mode (authorization block creation), no validation required
      return true;
    },
    [evaluateServiceFields, isEditMode, selectedMethod?.method_services, serviceState]
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
        type: formatMethodType(selectedMethod ?? featureMethod, selectedFeatureId ?? featureDetails?.feature_id),
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
    if (step === 4) {
      return true; // Design & Code step - always can proceed (block already created)
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
    // Mark block name as touched when trying to proceed from step 1
    if (step === 1) {
      setBlockNameTouched(true);
    }
    if (step === 2 && !validateServices(true)) {
      return;
    }
    if (step !== 2 && !canProceedFromStep()) {
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
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
      // Helper to check if a service has a redirect URI filled
      const serviceHasRedirectUri = (service: MethodService) => {
        const formState = serviceState[service.service_id];
        
        // Check requirements
        const requirements = service.requirements as Record<string, FieldConfig> | undefined;
        if (requirements) {
          for (const [key] of Object.entries(requirements)) {
            const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
            if (REDIRECT_FIELD_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
              const fieldState = formState?.requirements?.[key];
              if (fieldState?.value?.trim()) {
                return true;
              }
            }
          }
        }

        // Check configurations
        const configurationFields = (service.configurations as MethodServiceConfiguration | undefined)?.fields as
          | Record<string, FieldConfig>
          | undefined;
        if (configurationFields) {
          for (const [key] of Object.entries(configurationFields)) {
            const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
            if (REDIRECT_FIELD_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
              const fieldState = formState?.configurations?.[key];
              if (fieldState?.value?.trim()) {
                return true;
              }
            }
          }
        }
        return false;
      };

      // For both creation and edit mode, only include services that have a redirect URI filled
      const servicesToInclude = (selectedMethod.method_services ?? []).filter((service) => {
        return serviceHasRedirectUri(service);
      });

      const servicesPayload = await Promise.all(
        servicesToInclude.map(async (service) => {
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
            is_enable: formState?.isEnabled ?? false,
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
          create_account_link: allowRegistrations,
        },
        services: servicesPayload,
      };
      if (isEditMode && editingFeatureId) {
        await FeaturesApi.update(editingFeatureId, payload);
        setSubmitSuccess("Block updated successfully.");
        showToastSuccess("Block updated", `"${trimmedName}" saved successfully.`);
      } else {
        const response = await FeaturesApi.create(payload);
        const createdData = response?.data;
        setSubmitSuccess("Block created successfully.");
        showToastSuccess("Block created", `"${trimmedName || "Block"}" saved successfully.`);
        // Store created feature data and move to Design & Code step
        if (createdData?.id) {
          setCreatedFeatureData({
            id: createdData.id,
            reference_id: createdData.reference_id ?? "",
          });
          setStep(4); // Move to Design & Code step
          return;
        }
      }
      setSubmitError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save block. Please try again.";
      setSubmitError(message);
      showToastError("Failed to save block", message);
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
    if (!config) {
      return null;
    }

    // Also check is_hidden property first
    if (config.is_hidden) {
      return null;
    }

    // Check filter_conditions to determine if field should be shown/hidden
    if (config.filter_conditions && Array.isArray(config.filter_conditions)) {
      for (const condition of config.filter_conditions) {
        if (condition.when?.field) {
          const dependentFieldKey = condition.when.field;
          const expectedValue = condition.when.equals;
          // Check in both requirements and configurations
          const formState = serviceState[serviceId];
          const reqValue = formState?.requirements?.[dependentFieldKey]?.value;
          const configValue = formState?.configurations?.[dependentFieldKey]?.value;
          const currentValue = reqValue ?? configValue ?? "";
          
          const conditionMet = currentValue === expectedValue;
          
          // If hide is true, hide when condition is met
          // If hide is false/undefined, this might mean show ONLY when condition is met
          if (condition.hide === true && conditionMet) {
            return null; // Hide the field when condition is met
          }
          if (condition.hide === false && !conditionMet) {
            return null; // Show only when condition is met (hide when not met)
          }
        }
      }
    }
    const label = config.label ?? fieldKey;
    const id = `${serviceId}-${group}-${fieldKey}`;
    const options = config.type === "select" ? getSelectOptions(config) : [];
    const isDisabled = Boolean(config.is_disable);
    
    // Check if service is enabled - only validate when enabled in edit mode
    const serviceEnabled = serviceState[serviceId]?.isEnabled ?? false;
    const shouldValidate = !isEditMode || serviceEnabled;

    const disabledClass = isDisabled ? "bg-[#f4f5f7] text-[#8f9396] cursor-not-allowed" : "";

    const commonInput =
      config.type === "textarea" ? (
        <textarea
          id={id}
          className={`w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none ${disabledClass}`}
          placeholder={config.placeholder ? String(config.placeholder) : `Enter ${label}`}
          value={fieldState.value}
          disabled={isDisabled}
          onChange={(event) =>
            updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
          }
          onBlur={() =>
            updateFieldState(serviceId, group, fieldKey, {
              touched: true,
              error: shouldValidate ? validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]) : null,
            })
          }
          rows={3}
        />
      ) : (
        <input
          id={id}
          type="text"
          className={`w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none ${disabledClass}`}
          placeholder={config.placeholder ? String(config.placeholder) : `Enter ${label}`}
          value={fieldState.value}
          disabled={isDisabled}
          onChange={(event) =>
            updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
          }
          onBlur={() =>
            updateFieldState(serviceId, group, fieldKey, {
              touched: true,
              error: shouldValidate ? validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]) : null,
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
            className={`w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none ${disabledClass}`}
            value={fieldState.value}
            disabled={isDisabled}
            onChange={(event) =>
              updateFieldState(serviceId, group, fieldKey, { value: event.target.value, touched: true, error: null })
            }
            onBlur={() =>
              updateFieldState(serviceId, group, fieldKey, {
                touched: true,
                error: shouldValidate ? validateField(config, serviceState[serviceId]?.[group]?.[fieldKey]) : null,
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
          <div
            className={`flex flex-wrap items-center gap-2 rounded-2xl border border-[#d5d9dc] px-3 py-2 min-h-[42px] ${
              isDisabled ? "bg-[#f4f5f7] cursor-not-allowed" : "focus-within:border-[#3f51b5]"
            }`}
          >
            {fieldState.chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-full bg-[#3f51b5]/10 px-2.5 py-0.5 text-xs text-[#3f51b5]"
              >
                {chip}
                {!isDisabled && (
                  <button
                    type="button"
                    className="text-[#3f51b5] hover:text-[#303f9f] ml-0.5"
                    onClick={() => {
                      const next = fieldState.chips.filter((entry) => entry !== chip);
                      updateFieldState(serviceId, group, fieldKey, {
                        chips: next,
                        touched: true,
                        error: shouldValidate ? validateField(config, { ...fieldState, chips: next }) : null,
                      });
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            <input
              type="text"
              className={`flex-1 min-w-[120px] border-none bg-transparent text-sm focus:outline-none ${
                isDisabled ? "cursor-not-allowed text-[#8f9396]" : ""
              }`}
              placeholder={fieldState.chips.length === 0 ? (config.placeholder ? String(config.placeholder) : `Add ${label}`) : ""}
              value={fieldState.value}
              disabled={isDisabled}
              onChange={(event) => updateFieldState(serviceId, group, fieldKey, { value: event.target.value })}
              onKeyDown={(event) => {
                if (isDisabled) return;
                if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
                  event.preventDefault();
                  const value = fieldState.value.trim();
                  if (value && !fieldState.chips.includes(value)) {
                    const updated = [...fieldState.chips, value];
                    updateFieldState(serviceId, group, fieldKey, {
                      chips: updated,
                      value: "",
                      touched: true,
                      error: shouldValidate ? validateField(config, { ...fieldState, chips: updated, value: "" }) : null,
                    });
                  } else {
                    updateFieldState(serviceId, group, fieldKey, { value: "" });
                  }
                }
                if (event.key === "Backspace" && !fieldState.value && fieldState.chips.length > 0) {
                  const next = fieldState.chips.slice(0, -1);
                  updateFieldState(serviceId, group, fieldKey, {
                    chips: next,
                    touched: true,
                    error: shouldValidate ? validateField(config, { ...fieldState, chips: next }) : null,
                  });
                }
              }}
            />
          </div>
        ) : config.type === "readFile" ? (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept={config.allowed_types ? String(config.allowed_types) : undefined}
              disabled={isDisabled}
              className={isDisabled ? "cursor-not-allowed opacity-50" : ""}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  updateFieldState(serviceId, group, fieldKey, {
                    file: null,
                    value: "",
                    touched: true,
                    error: shouldValidate ? validateField(config, { ...fieldState, file: null, value: "" }) : null,
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
        {shouldValidate && fieldState.error && fieldState.touched && (
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
            <p className="text-base font-bold text-[#212528]">{service.name}</p>
          </div>
          {isEditMode && (
            <button
              type="button"
              role="switch"
              aria-checked={formState?.isEnabled ?? false}
              onClick={() =>
                setServiceState((prev) => ({
                  ...prev,
                  [service.service_id]: {
                    ...prev[service.service_id],
                    isEnabled: !(prev[service.service_id]?.isEnabled ?? false),
                    requirements: prev[service.service_id]?.requirements ?? {},
                    configurations: prev[service.service_id]?.configurations ?? {},
                  },
                }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3f51b5] focus-visible:ring-offset-2 ${
                formState?.isEnabled ?? false ? "bg-[#3f51b5]" : "bg-[#d5d9dc]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  formState?.isEnabled ?? false ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>
        {requirements && Object.keys(requirements).length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#212528]">Requirements</p>
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
            <p className="text-sm font-bold text-[#212528]">Configurations</p>
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
        {isEditMode && featureDetails?.callback_url && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5d6164]">
                Callback URL
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 pr-12 text-sm bg-[#f4f5f7] text-[#5d6164] cursor-not-allowed focus:outline-none"
                  value={featureDetails.callback_url}
                  disabled
                  readOnly
                />
                <button
                  type="button"
                  className="absolute right-3 p-1.5 rounded-lg hover:bg-[#e1e4e8] transition-colors"
                  onClick={() => {
                    if (featureDetails.callback_url) {
                      navigator.clipboard.writeText(featureDetails.callback_url);
                      handleCopySnippet(`callback-${service.service_id}`, featureDetails.callback_url);
                    }
                  }}
                  title="Copy callback URL"
                >
                  {copiedSnippet === `callback-${service.service_id}` ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6164" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
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
          onBlur={() => setBlockNameTouched(true)}
          placeholder="E.g. OTP Verification"
          className="mt-1 w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
        />
        {blockNameTouched && nameError && <p className="text-xs text-[#b91c1c] mt-1">{nameError}</p>}
      </div>
      {methodsError && <p className="text-sm text-[#b91c1c]">{methodsError}</p>}
      {methodsLoading && <p className="text-sm text-[#5d6164]">Loading available services…</p>}
   
    </div>
  );

  const resetServiceFields = useCallback((serviceId: number) => {
    const service = selectedMethod?.method_services?.find((s) => s.service_id === serviceId);
    if (!service) return;
    
    setServiceState((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        isEnabled: prev[serviceId]?.isEnabled ?? service.is_enable ?? false,
        requirements: buildFieldGroupState(service.requirements as Record<string, FieldConfig>),
        configurations: buildFieldGroupState(
          (service.configurations as MethodServiceConfiguration | undefined)?.fields as Record<string, FieldConfig>
        ),
      },
    }));
  }, [selectedMethod?.method_services]);

  const renderServiceFieldsPanel = (service: MethodService) => {
    const formState = serviceState[service.service_id];
    const requirements = service.requirements as Record<string, FieldConfig> | undefined;
    const configurationFields = (service.configurations as MethodServiceConfiguration | undefined)?.fields as
      | Record<string, FieldConfig>
      | undefined;

    const hasRequirements = requirements && Object.keys(requirements).length > 0;
    const hasConfigurations = configurationFields && Object.keys(configurationFields).length > 0;
    const isEnabled = formState?.isEnabled ?? false;

    return (
      <div className="space-y-6">
        {/* Enable/Disable toggle - only in edit mode */}
        {isEditMode && (
          <div className="flex items-center justify-between rounded-2xl border border-[#e1e4e8] bg-[#f8f9fb] px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#212528]">{service.name}</p>
              <p className="text-xs text-[#5d6164]">
                {isEnabled ? "This service is enabled" : "Enable this service to use it"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() =>
                setServiceState((prev) => ({
                  ...prev,
                  [service.service_id]: {
                    ...prev[service.service_id],
                    isEnabled: !isEnabled,
                    requirements: prev[service.service_id]?.requirements ?? {},
                    configurations: prev[service.service_id]?.configurations ?? {},
                  },
                }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3f51b5] focus-visible:ring-offset-2 ${
                isEnabled ? "bg-[#3f51b5]" : "bg-[#d5d9dc]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {hasRequirements && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#212528]">Credentials</p>
            <div className="space-y-4">
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
        {hasConfigurations && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#212528]">Configurations</p>
            <div className="space-y-4">
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
        {!hasRequirements && !hasConfigurations && (
          <p className="text-sm text-[#5d6164]">No configuration fields available for this service.</p>
        )}
        <button
          type="button"
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm text-[#5d6164] hover:bg-[#f4f5f7]"
          onClick={() => resetServiceFields(service.service_id)}
        >
          Reset
        </button>
      </div>
    );
  };

  const renderServiceConfigurationSection = () => {
    const services = selectedMethod?.method_services ?? [];
    const currentService = services.find((s) => s.service_id === selectedServiceId) ?? services[0];

    if (!services.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-[#5d6164]">No services available for the selected method.</p>
        </div>
      );
    }

    return (
      <div className="flex gap-6">
        {/* Left sidebar - Services list */}
        <div className="w-56 shrink-0 space-y-1">
          <p className="text-sm font-semibold text-[#212528] mb-3">Services</p>
          {services.map((service) => {
            const isActive = service.service_id === (selectedServiceId ?? services[0]?.service_id);
            return (
              <button
                key={service.service_id}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[#3f51b5]/10 text-[#3f51b5] font-medium"
                    : "text-[#5d6164] hover:bg-[#f4f5f7]"
                }`}
                onClick={() => setSelectedServiceId(service.service_id)}
              >
                <span>{service.name}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isActive ? "text-[#3f51b5]" : "text-[#c1c5c8]"}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Right panel - Service configuration */}
        <div className="flex-1 border-l border-[#e1e4e8] pl-6">
          {currentService && renderServiceFieldsPanel(currentService)}
        </div>
      </div>
    );
  };

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
      <div className={`grid gap-8 ${includePreview ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}>
        <div className="space-y-6">
          {/* Authorization Settings */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#212528]">Authorization Settings</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#5d6164]">Authorization Key</label>
                <input
                  type="text"
                  value={authorizationKey}
                  onChange={(event) => setAuthorizationKey(event.target.value)}
                  placeholder="Enter authorization key"
                  className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2.5 text-sm focus:border-[#3f51b5] focus:outline-none"
                />
                {!authorizationKey.trim() && <p className="text-xs text-[#b91c1c]">Key is required.</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#5d6164]">Session Time (seconds)</label>
                <input
                  type="number"
                  min={60}
                  value={sessionTime}
                  onChange={(event) => setSessionTime(event.target.value)}
                  className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2.5 text-sm focus:border-[#3f51b5] focus:outline-none"
                />
                {Number(sessionTime) < 60 && (
                  <p className="text-xs text-[#b91c1c]">Minimum session time is 60 seconds.</p>
                )}
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#212528]">Appearance</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#5d6164]">Theme</label>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2.5 text-sm focus:border-[#3f51b5] focus:outline-none"
                >
                  {THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[#d5d9dc] px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#212528]">Allow end-users to self-register</p>
                  <p className="text-xs text-[#5d6164]">Enable user self-registration on the login form</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowRegistrations}
                  onClick={() => setAllowRegistrations(!allowRegistrations)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3f51b5] focus-visible:ring-offset-2 ${
                    allowRegistrations ? "bg-[#3f51b5]" : "bg-[#d5d9dc]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      allowRegistrations ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Response Format */}
          {authorizationFormat && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#212528]">Response Format</p>
                <p className="text-xs text-[#5d6164]">
                  The JSON below represents the payload you will receive after a successful login.
                </p>
              </div>
              <div className="relative rounded-2xl border border-[#e1e4e8] bg-[#0b1120] p-4 text-xs text-white">
                <pre className="overflow-auto whitespace-pre-wrap max-h-48">{JSON.stringify(authorizationFormat, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        {/* {includePreview && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#212528]">Preview</p>
            {isEditMode && (
              <div className="flex items-center justify-center gap-1 rounded-full bg-[#f4f5f7] p-1 text-xs font-semibold">
                <button
                  type="button"
                  className={`flex-1 rounded-full px-4 py-2 transition-all ${previewLayout === "top" ? "bg-white shadow-sm" : "text-[#5d6164] hover:text-[#212528]"}`}
                  onClick={() => setPreviewLayout("top")}
                >
                  Input on Top
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full px-4 py-2 transition-all ${
                    previewLayout === "bottom" ? "bg-white shadow-sm" : "text-[#5d6164] hover:text-[#212528]"
                  }`}
                  onClick={() => setPreviewLayout("bottom")}
                >
                  Input on Bottom
                </button>
              </div>
            )}
            {renderAuthorizationPreview()}
          </div>
        )} */}
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
              {EDIT_TABS.map((tab) => (
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
                  <div className="flex justify-between">
                    <div />
                    <div className="flex gap-3">
                      <button
                        className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={handleSubmit}
                        disabled={submitting}
                      >
                        {submitting ? "Saving…" : "Update Services"}
                      </button>
                      <button
                        className="rounded-full border border-[#3f51b5] px-6 py-2 text-sm font-semibold text-[#3f51b5] hover:bg-[#3f51b5]/5"
                        onClick={() => setActiveEditTab("settings")}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
              {activeEditTab === "settings" && (
                <>
                  <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                    {renderAuthorizationSettingsSection({ includePreview: true })}
                  </div>
                  <div className="flex justify-between">
                    <button
                      className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm text-[#5d6164] hover:bg-[#f4f5f7]"
                      onClick={() => setActiveEditTab("service")}
                    >
                      Back
                    </button>
                    <div className="flex gap-3">
                      <button
                        className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={handleSubmit}
                        disabled={submitting}
                      >
                        {submitting ? "Saving…" : "Save Settings"}
                      </button>
                      <button
                        className="rounded-full border border-[#3f51b5] px-6 py-2 text-sm font-semibold text-[#3f51b5] hover:bg-[#3f51b5]/5"
                        onClick={() => setActiveEditTab("design")}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
              {activeEditTab === "design" && (
                <>
                  <div className="space-y-4 rounded-2xl border border-[#e1e4e8] p-4">
                    {renderDesignAndCodeSection()}
                  </div>
                  <div className="flex justify-between">
                    <button
                      className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm text-[#5d6164] hover:bg-[#f4f5f7]"
                      onClick={() => setActiveEditTab("settings")}
                    >
                      Back
                    </button>
                    <div />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {STEP_LABELS.map((label, index) => (
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
                  {index < STEP_LABELS.length - 1 && <span className="text-[#d5d9dc]">—</span>}
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
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <p className="font-medium">Block created successfully!</p>
                  <p>Your block is ready. Use the code snippets below to integrate it into your application.</p>
                </div>
                {renderDesignAndCodeSection()}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex gap-2">
                {step > 0 && step < 4 && (
                  <button
                    className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm text-[#5d6164]"
                    onClick={goToPreviousStep}
                  >
                    Back
                  </button>
                )}
                {step < 3 && (
                  <button
                    className="rounded-full bg-[#3f51b5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={goToNextStep}
                    disabled={!canProceedFromStep()}
                  >
                    Next
                  </button>
                )}
              </div>
              {step === 3 && (
                <button
                  className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={submitting || !canProceedFromStep()}
                >
                  {submitting ? "Creating…" : "Create Block"}
                </button>
              )}
              {step === 4 && createdFeatureData && (
                <div className="flex gap-3">
                  <Link
                    href="/app/features"
                    className="rounded-full border border-[#d5d9dc] px-5 py-2 text-sm !text-[#5d6164] hover:bg-[#f4f5f7]"
                  >
                    Back to Blocks
                  </Link>
                  <Link
                    href={`/app/features/create?featureId=${createdFeatureData.id}`}
                    className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold !text-white hover:bg-[#303f9f]"
                  >
                    Manage Block
                  </Link>
                </div>
              )}
            </div>
          </>
        )}

        {/* {submitError && <p className="text-sm text-[#b91c1c]">{submitError}</p>} */}
        {/* {submitSuccess && <p className="text-sm text-[#0f9d58]">{submitSuccess}</p>} */}
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
