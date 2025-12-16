"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { EnvironmentEntity, LogDetail, LogListEntry, ProjectEntity } from "@/lib/api";
import { LogsApi } from "@/lib/api";
import { useClientSettings } from "@/context/client-settings";

const requestTypes = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const pageSizeOptions = [25, 50, 100];

const dateRanges = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 Days" },
  { id: "currentMonth", label: "Current Month" },
  { id: "previousMonth", label: "Previous Month" },
];

type RangeField = "" | "response_time" | "status_code";

type NumericRange = {
  from: string;
  to: string;
};

const formatDateForUi = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

const formatTimeForUi = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const formatDateForApi = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;

const getDateRangeForApi = (rangeId: string) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (rangeId) {
    case "today":
      start = new Date(now);
      end = new Date(now);
      break;
    case "last7":
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      break;
    case "previousMonth": {
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = firstDayPrevMonth;
      end = new Date(firstDayPrevMonth.getFullYear(), firstDayPrevMonth.getMonth() + 1, 0);
      break;
    }
    default: {
      const firstDayCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
      start = firstDayCurrent;
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
  }

  return {
    startDate: formatDateForApi(start),
    endDate: formatDateForApi(end),
  };
};

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
};

export default function LogsPage() {
  const { clientId } = useClientSettings();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<string>("all");
  const [environmentId, setEnvironmentId] = useState<string>("all");
  const [rangeField, setRangeField] = useState<RangeField>("status_code");
  const [range, setRange] = useState<NumericRange>({ from: "", to: "" });
  const [selectedTypes, setSelectedTypes] = useState<string[]>(requestTypes);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dateRange, setDateRange] = useState(dateRanges[2].id);
  const [selectedLog, setSelectedLog] = useState<LogListEntry | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [logs, setLogs] = useState<LogListEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ pageNumber: 1, totalPages: 1, totalItems: 0 });

  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentEntity[]>([]);
  const [environmentsLoading, setEnvironmentsLoading] = useState(false);

  const [logDetail, setLogDetail] = useState<LogDetail | null>(null);
  const [logDetailLoading, setLogDetailLoading] = useState(false);
  const [logDetailError, setLogDetailError] = useState<string | null>(null);

  const visibleEnvironments = useMemo(() => {
    if (projectId === "all") {
      return environments;
    }
    const project = projects.find((item) => String(item.id) === projectId);
    if (project?.environments_with_slug?.length) {
      return project.environments_with_slug;
    }
    return environments.filter((env) => String(env.projects?.id ?? "") === projectId);
  }, [projectId, projects, environments]);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const response = await LogsApi.projects({ itemsPerPage: 200, pageNo: 1 });
      setProjects(response.data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setProjectsLoading(false);
    }
  }, [clientId]);

  const fetchEnvironments = useCallback(async () => {
    setEnvironmentsLoading(true);
    try {
      const response = await LogsApi.environments({ itemsPerPage: 200, pageNo: 1 });
      setEnvironments(response.data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch environments", error);
    } finally {
      setEnvironmentsLoading(false);
    }
  }, [clientId]);

const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const response = await LogsApi.list({
        pageNo: pageIndex + 1,
        itemsPerPage: pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(projectId !== "all" ? { project_id: Number(projectId) } : {}),
        ...(environmentId !== "all" ? { environment_id: Number(environmentId) } : {}),
        ...(rangeField ? { range: rangeField } : {}),
        ...(range.from ? { from: Number(range.from) } : {}),
        ...(range.to ? { to: Number(range.to) } : {}),
        ...(selectedTypes.length && selectedTypes.length !== requestTypes.length
          ? { request_type: selectedTypes.join(",") }
          : {}),
        ...getDateRangeForApi(dateRange),
      });
      const payload = response.data;
      setLogs(payload.data ?? []);
      setPagination({
        pageNumber: payload.pageNumber ?? pageIndex + 1,
        totalPages: payload.totalPageCount ?? 1,
        totalItems: payload.totalEntityCount ?? payload.data.length,
      });
      setPageIndex((prev) => {
        const next = Math.max((payload.pageNumber ?? 1) - 1, 0);
        return prev === next ? prev : next;
      });
    } catch (error) {
      console.error("Failed to fetch logs", error);
      setLogsError(error instanceof Error ? error.message : "Unable to fetch logs");
      setLogs([]);
      setPagination({ pageNumber: 1, totalPages: 1, totalItems: 0 });
    } finally {
      setLogsLoading(false);
    }
  }, [dateRange, environmentId, pageIndex, pageSize, projectId, range, rangeField, search, selectedTypes, clientId]);

  const fetchLogDetail = useCallback(async (logId: string) => {
    setLogDetailLoading(true);
    setLogDetailError(null);
    try {
      const response = await LogsApi.byId(logId);
      setLogDetail(response.data ?? null);
    } catch (error) {
      console.error("Failed to fetch log detail", error);
      setLogDetailError(error instanceof Error ? error.message : "Unable to fetch log detail");
      setLogDetail(null);
    } finally {
      setLogDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchEnvironments();
  }, [fetchProjects, fetchEnvironments]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRequestType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type].sort()
    );
    setPageIndex(0);
  };

  const toggleAllRequestTypes = () => {
    if (selectedTypes.length === requestTypes.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(requestTypes);
    }
    setPageIndex(0);
  };

  const resetFilters = () => {
    setProjectId("all");
    setEnvironmentId("all");
    setRangeField("status_code");
    setRange({ from: "", to: "" });
    setSelectedTypes(requestTypes);
    setSearch("");
    setDateRange(dateRanges[2].id);
    setFiltersOpen(false);
    setPageIndex(0);
  };

  const handleSelectLog = (entry: LogListEntry) => {
    setSelectedLog(entry);
    setLogDetail(null);
    if (entry._id) {
      fetchLogDetail(entry._id);
    }
  };

  const closeLogPanel = () => {
    setSelectedLog(null);
    setLogDetail(null);
    setLogDetailError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-wrap flex-1 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#5d6164]">Project</label>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setEnvironmentId("all");
                setPageIndex(0);
              }}
              className="min-w-[200px] rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projectsLoading && (
                <option value="loading" disabled>
                  Loading…
                </option>
              )}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#5d6164]">Environment</label>
            <select
              value={environmentId}
              onChange={(event) => {
                setEnvironmentId(event.target.value);
                setPageIndex(0);
              }}
              className="min-w-[200px] rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
            >
              <option value="all">All Environments</option>
              {environmentsLoading && (
                <option value="loading" disabled>
                  Loading…
                </option>
              )}
              {visibleEnvironments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-[#5d6164]">Search logs</label>
            <input
              type="search"
              placeholder="endpoint, request body, headers"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#5d6164]">Date range</label>
            <select
              value={dateRange}
              onChange={(event) => {
                setDateRange(event.target.value);
                setPageIndex(0);
              }}
              className="rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
            >
              {dateRanges.map((rangeOption) => (
                <option key={rangeOption.id} value={rangeOption.id}>
                  {rangeOption.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] px-4 py-2 text-sm font-medium hover:border-[#3f51b5]"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Filters
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="rounded-2xl border border-[#e1e4e8] bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#5d6164] mb-2">Request Type</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[#d5d9dc] px-3 py-1 text-xs font-medium hover:border-[#3f51b5]"
                  onClick={toggleAllRequestTypes}
                >
                  {selectedTypes.length === requestTypes.length ? "Clear all" : "Select all"}
                </button>
                {requestTypes.map((type) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active
                          ? "border-[#3f51b5] bg-[rgba(63,81,181,0.12)] text-[#3f51b5]"
                          : "border-[#d5d9dc] text-[#5d6164]"
                      }`}
                      onClick={() => toggleRequestType(type)}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#5d6164] mb-2">Range</p>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={rangeField}
                  onChange={(event) => {
                    setRangeField(event.target.value as RangeField);
                    setRange({ from: "", to: "" });
                    setPageIndex(0);
                  }}
                  className="rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
                >
                  <option value="">None</option>
                  <option value="response_time">Response Time</option>
                  <option value="status_code">Status Code</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={range.from}
                    onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
                    placeholder="From"
                    disabled={!rangeField}
                    className="flex-1 rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none disabled:bg-[#f4f5f7]"
                  />
                  <input
                    type="number"
                    value={range.to}
                    onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
                    placeholder="To"
                    disabled={!rangeField}
                    className="flex-1 rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none disabled:bg-[#f4f5f7]"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm" onClick={resetFilters}>
              Reset
            </button>
            <button
              className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setFiltersOpen(false);
                setPageIndex(0);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="app-card p-0">
        <div className="table-scroll">
          <table className="default-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Project</th>
                <th>User IP</th>
                <th>Endpoint</th>
                <th>Request</th>
                <th>Status</th>
                <th>Response Time</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#5d6164]">
                    Loading logs…
                  </td>
                </tr>
              )}
              {!logsLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#5d6164]">
                    {logsError ?? "No logs found"}
                  </td>
                </tr>
              )}
              {!logsLoading &&
                logs.map((log) => (
                  <tr key={log._id ?? log.id} className="cursor-pointer" onClick={() => handleSelectLog(log)}>
                    <td>
                      <div className="flex flex-col">
                        <span>{formatDateForUi(log.created_at)}</span>
                        <span className="text-xs text-[#5d6164]">{formatTimeForUi(log.created_at)}</span>
                      </div>
                    </td>
                    <td>
                      {log.project_name}
                      <span className="text-xs text-[#8f9396] block">{log.environment_name}</span>
                    </td>
                    <td>{log.user_ip}</td>
                    <td className="font-mono text-xs text-[#3f4346]">{log.endpoint}</td>
                    <td>
                      <span className="chip chip-muted">{log.request_type}</span>
                    </td>
                    <td>
                      <span className="status-pill success">{log.status_code}</span>
                    </td>
                    <td>{log.response_time ?? `${log.response_time_in_ms ?? "—"} ms`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between border-t border-[#e1e4e8] px-4 py-3 text-sm text-[#5d6164]">
          <div>
            Showing {logs.length} of {pagination.totalItems} requests
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              Rows
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
                className="rounded-lg border border-[#d5d9dc] px-2 py-1"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-flex items-center gap-2">
              <button
                className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
                disabled={pageIndex <= 0 || logsLoading}
                onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              >
                Prev
              </button>
              <span className="text-xs">
                Page {pagination.pageNumber} of {pagination.totalPages}
              </span>
              <button
                className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
                disabled={logsLoading || pagination.pageNumber >= pagination.totalPages}
                onClick={() =>
                  setPageIndex((prev) =>
                    Math.min(prev + 1, Math.max(pagination.totalPages - 1, 0))
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={closeLogPanel} />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-[#e1e4e8] z-30 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e1e4e8] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#212528]">Request #{selectedLog._id ?? selectedLog.id}</p>
                <p className="text-xs text-[#5d6164]">
                  {formatDateForUi(selectedLog.created_at)} • {formatTimeForUi(selectedLog.created_at)}
                </p>
              </div>
              <button className="rounded-full border border-[#d5d9dc] p-2 text-sm" onClick={closeLogPanel}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              <section>
                <p className="text-xs font-semibold text-[#5d6164] mb-2">Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryItem label="Project">{selectedLog.project_name}</SummaryItem>
                  <SummaryItem label="Environment">{selectedLog.environment_name}</SummaryItem>
                  <SummaryItem label="IP">{selectedLog.user_ip}</SummaryItem>
                  <SummaryItem label="Method">{selectedLog.request_type}</SummaryItem>
                  <SummaryItem label="Status">
                    <span className="status-pill success">{selectedLog.status_code}</span>
                  </SummaryItem>
                  <SummaryItem label="Response time">{selectedLog.response_time ?? selectedLog.response_time_in_ms}</SummaryItem>
                </div>
              </section>
              <section>
                <Panel label="Endpoint">{selectedLog.endpoint}</Panel>
              </section>
              <section>
                {logDetailLoading && <Panel label="Details">Loading log details…</Panel>}
                {logDetailError && <Panel label="Details">{logDetailError}</Panel>}
                {logDetail && (
                  <div className="space-y-4">
                    <Panel label="Request Body">
                      <pre className="whitespace-pre-wrap rounded-2xl bg-[#f6f6f8] p-3 text-xs">
                        {formatJson(logDetail.request_body)}
                      </pre>
                    </Panel>
                    <Panel label="Response">
                      <pre className="whitespace-pre-wrap rounded-2xl bg-[#f6f6f8] p-3 text-xs">
                        {formatJson(logDetail.response)}
                      </pre>
                    </Panel>
                    <Panel label="Headers">
                      <pre className="whitespace-pre-wrap rounded-2xl bg-[#f6f6f8] p-3 text-xs">
                        {formatJson(logDetail.headers)}
                      </pre>
                    </Panel>
                  </div>
                )}
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#8f9396]">{label}</p>
      <p className="font-medium text-[#212528]">{children}</p>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#5d6164] uppercase">{label}</p>
      <div className="rounded-2xl border border-[#e1e4e8] p-3">{children}</div>
    </div>
  );
}
