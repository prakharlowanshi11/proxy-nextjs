"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { CreateProjectApi } from "@/lib/api";

const defaultEnvironmentOptions = ["Test", "Stage", "Prod"];

export default function CreateProjectPage() {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [hits, setHits] = useState("");
  const [seconds, setSeconds] = useState("");
  const [useSameGateway, setUseSameGateway] = useState(true);
  const [singleGatewayUrl, setSingleGatewayUrl] = useState("");
  const [gatewayUrls, setGatewayUrls] = useState<Record<string, string>>({});
  const [destinationUrls, setDestinationUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>(defaultEnvironmentOptions);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const environmentChoices = useMemo(
    () => (availableEnvironments.length ? availableEnvironments : defaultEnvironmentOptions),
    [availableEnvironments]
  );

  const orderedEnvironments = useMemo(
    () => environmentChoices.filter((env) => selectedEnvironments.includes(env)),
    [environmentChoices, selectedEnvironments]
  );

  useEffect(() => {
    setSelectedEnvironments((prev) => prev.filter((env) => environmentChoices.includes(env)));
  }, [environmentChoices]);

  useEffect(() => {
    let isMounted = true;
    const loadEnvironments = async () => {
      setEnvLoading(true);
      setEnvError(null);
      try {
        const response = await CreateProjectApi.environments({ pageNo: 1, itemsPerPage: 100 });
        if (!isMounted) return;
        const names =
          response.data?.data
            ?.map((environment) => environment.name)
            .filter((name): name is string => Boolean(name)) ?? [];
        if (names.length) {
          setAvailableEnvironments(Array.from(new Set(names)));
        }
      } catch (error) {
        if (isMounted) {
          setEnvError(error instanceof Error ? error.message : "Unable to load environments");
        }
      } finally {
        if (isMounted) {
          setEnvLoading(false);
        }
      }
    };
    loadEnvironments();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleEnvironmentToggle = (environment: string) => {
    setSelectedEnvironments((prev) => {
      if (prev.includes(environment)) {
        const next = prev.filter((item) => item !== environment);
        setGatewayUrls((urls) => {
          const next = { ...urls };
          delete next[environment];
          return next;
        });
        setDestinationUrls((urls) => {
          const next = { ...urls };
          delete next[environment];
          return next;
        });
        return next;
      }
      return [...prev, environment];
    });
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!projectName.trim()) {
        setStatus({ type: "error", message: "Project name is required." });
        return false;
      }
      if (!selectedEnvironments.length) {
        setStatus({ type: "error", message: "Select at least one environment." });
        return false;
      }
      if (!hits || Number(hits) <= 0 || !seconds || Number(seconds) <= 0) {
        setStatus({ type: "error", message: "Rate limit hits and seconds must be positive numbers." });
        return false;
      }
    }
    if (currentStep === 2) {
      if (useSameGateway) {
        if (!singleGatewayUrl.trim()) {
          setStatus({ type: "error", message: "Provide the gateway URL that should be shared across environments." });
          return false;
        }
      } else {
        for (const env of orderedEnvironments) {
          if (!gatewayUrls[env]?.trim()) {
            setStatus({ type: "error", message: `Gateway URL missing for ${env}.` });
            return false;
          }
        }
      }
    }
    if (currentStep === 3) {
      for (const env of orderedEnvironments) {
        if (!destinationUrls[env]?.trim()) {
          setStatus({ type: "error", message: `Destination URL missing for ${env}.` });
          return false;
        }
      }
    }
    setStatus(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      return;
    }
    const limiterHits = Math.max(Number(hits), 1);
    const limiterSeconds = Math.max(Number(seconds), 1);
    const environmentsPayload = orderedEnvironments.reduce((acc, env) => {
      const envConfig: Record<string, string> = {
        rate_limiter: `${limiterSeconds}:${limiterHits}`,
      };
      const gatewayValue = useSameGateway ? singleGatewayUrl : gatewayUrls[env];
      if (gatewayValue?.trim()) {
        envConfig.gateway_url = gatewayValue.trim();
      }
      const destinationValue = destinationUrls[env];
      if (destinationValue?.trim()) {
        envConfig.destination_url = destinationValue.trim();
      }
      acc[env] = envConfig;
      return acc;
    }, {} as Record<string, Record<string, string>>);

    setSubmitting(true);
    try {
      await CreateProjectApi.create({
        name: projectName.trim(),
        environments: environmentsPayload,
      });
      setStatus({ type: "success", message: "Project created successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create project. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase text-[#5d6164] tracking-[0.2em]">SAAR</p>
          <h1 className="text-3xl font-semibold text-[#212528]">Create Project</h1>
          <p className="text-sm text-[#5d6164]">
            Turn requirements into deployable proxies. Draft everything and plug your API to publish it.
          </p>
        </div>

        <div className="app-card p-6 space-y-6">
          <StepIndicator currentStep={step} />
          {status && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                status.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {status.message}
            </div>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <p className="text-sm text-[#5d6164]">
                Give your project a memorable identity and define the rate limits that protect your upstreams.
              </p>
              <Field label="Project name">
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="My Proxy Project"
                  className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5] focus:outline-none"
                />
              </Field>
              <Field label="Environments">
                <div className="flex flex-col gap-2">
                  {envLoading && <p className="text-xs text-[#8f9396]">Loading available environments…</p>}
                  {envError && <p className="text-xs text-red-600">{envError}</p>}
                  <div className="flex flex-wrap gap-2">
                    {environmentChoices.map((environment) => {
                    const checked = selectedEnvironments.includes(environment);
                    return (
                      <button
                        key={environment}
                        className={`rounded-full border px-4 py-2 text-sm ${
                          checked
                            ? "border-[#3f51b5] bg-[rgba(63,81,181,0.12)] text-[#3f51b5]"
                            : "border-[#d5d9dc] text-[#5d6164]"
                        }`}
                        onClick={() => handleEnvironmentToggle(environment)}
                        type="button"
                      >
                        {environment}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </Field>
              <Field label="Rate limit">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    value={hits}
                    onChange={(event) => setHits(event.target.value)}
                    placeholder="Hits"
                    className="w-36 rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5]"
                  />
                  <span className="text-sm text-[#5d6164]">hits per</span>
                  <input
                    type="number"
                    value={seconds}
                    onChange={(event) => setSeconds(event.target.value)}
                    placeholder="Seconds"
                    className="w-36 rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5]"
                  />
                  <span className="text-sm text-[#5d6164]">seconds</span>
                </div>
              </Field>
              <WizardActions onBack={null} onNext={handleNext} nextLabel="Next" />
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <header className="space-y-2">
                <h2 className="text-xl font-semibold text-[#212528]">Add Gateway URL</h2>
                <p className="text-sm text-[#5d6164]">
                  Gateways receive incoming traffic. Use SAAR managed domains or stitch your own.
                </p>
              </header>
              <label className="flex items-center gap-2 text-sm text-[#3f4346]">
                <input
                  type="checkbox"
                  checked={useSameGateway}
                  onChange={(event) => setUseSameGateway(event.target.checked)}
                />
                Use the same URL for all environments
              </label>
              {useSameGateway ? (
                <Field label="Gateway URL">
                  <input
                    value={singleGatewayUrl}
                    onChange={(event) => setSingleGatewayUrl(event.target.value)}
                    placeholder="https://gateway.example.com"
                    className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5]"
                  />
                </Field>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {orderedEnvironments.map((environment) => (
                    <Field key={environment} label={`${environment} gateway`}>
                      <input
                        value={gatewayUrls[environment] ?? ""}
                        onChange={(event) =>
                          setGatewayUrls((prev) => ({
                            ...prev,
                            [environment]: event.target.value,
                          }))
                        }
                        placeholder={`https://${environment.toLowerCase()}.example.com`}
                        className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5]"
                      />
                    </Field>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border border-dashed border-[#d5d9dc] p-4 text-sm text-[#5d6164]">
                <p className="font-semibold text-[#212528]">Need a managed domain?</p>
                <p>SAAR ships with ready-to-use domains. Replace them later with your brand.</p>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {orderedEnvironments.map((environment) => (
                    <li key={environment}>
                      {environment} • https://{environment.toLowerCase()}.proxy.saar.dev
                    </li>
                  ))}
                </ul>
              </div>
              <WizardActions onBack={handleBack} onNext={handleNext} nextLabel="Next" />
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <header className="space-y-2">
                <h2 className="text-xl font-semibold text-[#212528]">Destination URLs</h2>
                <p className="text-sm text-[#5d6164]">
                  SAAR forwards sanitized traffic to these upstreams. Make sure TLS is configured.
                </p>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                {orderedEnvironments.map((environment) => (
                  <Field key={environment} label={`${environment} destination`}>
                    <input
                      value={destinationUrls[environment] ?? ""}
                      onChange={(event) =>
                        setDestinationUrls((prev) => ({
                          ...prev,
                          [environment]: event.target.value,
                        }))
                      }
                      placeholder={`https://api.${environment.toLowerCase()}.company.com`}
                      className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-3 text-sm focus:border-[#3f51b5]"
                    />
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[#5d6164]">
                <span className="font-semibold text-[#212528]">Heads-up:</span>
                This form now posts directly to the Proxy API. Adjust the payload mapping if your backend expects more
                fields.
              </div>
              <WizardActions
                onBack={handleBack}
                onNext={handleSubmit}
                nextLabel={submitting ? "Creating…" : "Submit"}
                isProcessing={submitting}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: "Project Details" },
    { id: 2, label: "Gateway URL" },
    { id: 3, label: "Destination URL" },
  ];
  return (
    <ol className="flex items-center gap-3 text-xs text-[#5d6164]">
      {steps.map((step) => {
        const active = step.id === currentStep;
        const completed = step.id < currentStep;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                active
                  ? "border-[#3f51b5] bg-[rgba(63,81,181,0.12)] text-[#3f51b5]"
                  : completed
                  ? "border-[#3f51b5] bg-[#3f51b5] text-white"
                  : "border-[#d5d9dc]"
              }`}
            >
              {step.id}
            </span>
            <span className={active ? "text-[#3f51b5] font-semibold" : ""}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[#5d6164]">
      {label}
      {children}
    </label>
  );
}

function WizardActions({
  onBack,
  onNext,
  nextLabel,
  isProcessing = false,
}: {
  onBack: (() => void) | null;
  onNext: () => void;
  nextLabel: string;
  isProcessing?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
        >
          ← Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={isProcessing}
        className="inline-flex items-center gap-2 rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {nextLabel}
        {!isProcessing && <span aria-hidden>→</span>}
      </button>
    </div>
  );
}
