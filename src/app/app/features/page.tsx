"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeatureEntity } from "@/lib/api";
import { FeaturesApi } from "@/lib/api";

const pageSizeOptions = [25, 50, 100];

export default function FeaturesPage() {
  const [search, setSearch] = useState("");
  const [features, setFeatures] = useState<FeatureEntity[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [pageNo, pageSize, search]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#212528]">Blocks</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search blocks"
            className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5] focus:outline-none"
          />
          <Link
            href="/app/features/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#3f51b5] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <span className="text-lg">+</span>
            Add Block
          </Link>
          <button
            className="rounded-full border border-[#d5d9dc] px-3 py-2 text-sm hover:border-[#3f51b5]"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-[#5d6164] max-w-3xl">
        The Blocks space lets you wire authentication, subscription logic, feature toggles, and observability in a
        self-serve manner. Combine OTP, OAuth, rate limits, plans, and more to orchestrate APIs without touching your
        runtime services.
      </p>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#5d6164]">
                    Loading blocks…
                  </td>
                </tr>
              )}
              {!loading && features.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#5d6164]">
                    No blocks found.
                  </td>
                </tr>
              )}
              {!loading &&
                features.map((feature) => (
                  <tr key={feature.id}>
                    <td className="font-semibold text-[#212528]">{feature.name}</td>
                    <td className="font-mono text-xs">
                      {feature.reference_id}
                      <button className="ml-2 text-[#3f51b5] text-xs">Copy</button>
                    </td>
                    <td>{feature.method?.name ?? "—"}</td>
                    <td>{feature.feature?.name ?? "—"}</td>
                    <td>
                      <span className={`status-pill ${statusClass(feature.status)}`}>
                        {feature.status ?? "active"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/app/features/create?featureId=${feature.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#d5d9dc] px-3 py-1 text-sm hover:border-[#3f51b5]"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between border-t border-[#e1e4e8] pt-3 text-sm text-[#5d6164]">
          <div>
            Showing {features.length} of {totalCount} entries
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              Rows
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageNo(1);
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
                disabled={pageNo <= 1 || loading}
                onClick={() => setPageNo((prev) => Math.max(prev - 1, 1))}
              >
                Prev
              </button>
              <span className="text-xs">
                Page {pageNo} of {totalPages}
              </span>
              <button
                className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
                disabled={pageNo >= totalPages || loading}
                onClick={() => setPageNo((prev) => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
