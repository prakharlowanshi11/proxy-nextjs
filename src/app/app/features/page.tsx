"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeatureEntity } from "@/lib/api";
import { FeaturesApi } from "@/lib/api";
import { useClientSettings } from "@/context/client-settings";

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const pageSizeOptions = [25, 50, 100];

export default function FeaturesPage() {
  const { clientId } = useClientSettings();
  const [search, setSearch] = useState("");
  const [features, setFeatures] = useState<FeatureEntity[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (referenceId: string) => {
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopiedId(referenceId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await FeaturesApi.list({
        pageNo,
        itemsPerPage: pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const payload = response.data;
      setFeatures(payload.data);
      setTotalPages(payload.totalPageCount || 1);
      setTotalCount(payload.totalEntityCount || payload.data.length);
    } catch (err) {
      console.error("Failed to fetch features", err);
      setError(err instanceof Error ? err.message : "Unable to load blocks");
      setFeatures([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [pageNo, pageSize, search, clientId]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPageNo(1);
  };

  const handleRefresh = () => {
    loadFeatures();
  };

  const statusClass = useCallback((status?: string) => {
    const normalized = (status ?? "active").toLowerCase();
    if (normalized === "draft") {
      return "warning";
    }
    if (normalized === "inactive") {
      return "danger";
    }
    return "success";
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-[#212528]">Blocks</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search blocks..."
              className="w-64 rounded-full border border-[#d5d9dc] bg-white px-4 py-2.5 text-sm focus:border-[#3f51b5] focus:outline-none focus:ring-2 focus:ring-[#3f51b5]/20"
            />
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] bg-white px-4 py-2.5 text-sm font-medium text-[#5d6164] hover:border-[#3f51b5] hover:text-[#3f51b5] transition-colors disabled:opacity-50"
              onClick={handleRefresh}
              disabled={loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Refresh
            </button>
            <Link
              href="/app/features/create"
              className="inline-flex items-center gap-2 rounded-full bg-[#3f51b5] px-5 py-2.5 text-sm font-semibold !text-white shadow-sm hover:bg-[#303f9f] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Block
            </Link>
          </div>
        </div>
        <p className="text-sm text-[#5d6164] max-w-3xl leading-relaxed">
          The Blocks space lets you wire authentication, subscription logic, feature toggles, and observability in a
          self-serve manner. Combine OTP, OAuth, rate limits, plans, and more to orchestrate APIs without touching your
          runtime services.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table Card */}
      <div className="app-card overflow-hidden">
        <div className="table-scroll">
          <table className="default-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Reference ID</th>
                <th>Method</th>
                <th>Type</th>
                <th>Status</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#5d6164]">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-6 w-6 text-[#3f51b5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading blocks…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && features.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#5d6164]">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#d5d9dc]">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      No blocks found.
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                features.map((feature) => (
                  <tr key={feature.id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="font-semibold text-[#212528]">{feature.name}</td>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <code className="font-mono text-xs text-[#5d6164] bg-[#f4f5f7] px-2 py-1 rounded">
                          {feature.reference_id}
                        </code>
                        <button
                          className="p-1 text-[#3f51b5] hover:text-[#303f9f] hover:bg-[#3f51b5]/10 rounded transition-colors"
                          onClick={() => handleCopy(feature.reference_id)}
                          title="Copy reference ID"
                        >
                          {copiedId === feature.reference_id ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </td>
                    <td className="text-[#5d6164]">{feature.method?.name ?? "—"}</td>
                    <td className="text-[#5d6164]">{feature.feature?.name ?? "—"}</td>
                    <td>
                      <span className={`status-pill ${statusClass(feature.status)}`}>
                        {feature.status ?? "active"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/app/features/create?featureId=${feature.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9dc] px-3.5 py-1.5 text-sm font-medium text-[#3f51b5] hover:border-[#3f51b5] hover:bg-[#3f51b5]/5 transition-colors"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e1e4e8] px-4 py-4 bg-[#fafbfc]">
          <p className="text-sm text-[#5d6164]">
            Showing <span className="font-medium text-[#212528]">{features.length}</span> of{" "}
            <span className="font-medium text-[#212528]">{totalCount}</span> entries
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[#5d6164]">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageNo(1);
                }}
                className="rounded-lg border border-[#d5d9dc] bg-white px-3 py-1.5 text-sm focus:border-[#3f51b5] focus:outline-none"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#d5d9dc] bg-white text-sm hover:border-[#3f51b5] hover:text-[#3f51b5] disabled:opacity-50 disabled:hover:border-[#d5d9dc] disabled:hover:text-inherit transition-colors"
                disabled={pageNo <= 1 || loading}
                onClick={() => setPageNo((prev) => Math.max(prev - 1, 1))}
                title="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="px-3 text-sm text-[#5d6164]">
                <span className="font-medium text-[#212528]">{pageNo}</span> / {totalPages}
              </span>
              <button
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#d5d9dc] bg-white text-sm hover:border-[#3f51b5] hover:text-[#3f51b5] disabled:opacity-50 disabled:hover:border-[#d5d9dc] disabled:hover:text-inherit transition-colors"
                disabled={pageNo >= totalPages || loading}
                onClick={() => setPageNo((prev) => Math.min(prev + 1, totalPages))}
                title="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
