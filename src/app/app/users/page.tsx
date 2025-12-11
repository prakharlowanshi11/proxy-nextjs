"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { ClientPermission, ClientRole, FeatureDetails, FeatureEntity, UserEntity } from "@/lib/api";
import { FeaturesApi, UsersApi } from "@/lib/api";

const dateRanges = [
  { id: "currentMonth", label: "Current Month" },
  { id: "previousMonth", label: "Previous Month" },
  { id: "quarter", label: "Last 90 Days" },
];

const formatDateForUi = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

const formatTimeForUi = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const formatDateForApi = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;

const getDateRangeForApi = (rangeId: string) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (rangeId) {
    case "previousMonth": {
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = firstDayPrevMonth;
      end = new Date(firstDayPrevMonth.getFullYear(), firstDayPrevMonth.getMonth() + 1, 0);
      break;
    }
    case "quarter":
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      break;
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

const DEFAULT_PAGE_META = { pageNumber: 1, totalPages: 1, totalItems: 0 };

type RoleRecord = ClientRole & {
  c_permissions?: Array<{ id: number; name: string }>;
  feature_configuration_id?: number | null;
  is_default?: boolean;
};

type PermissionRecord = ClientPermission & {
  is_default?: boolean;
};

type RoleFormState = {
  id: number | null;
  name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
};

type PermissionFormState = {
  id: number | null;
  name: string;
};

type ManagementTab = "roles" | "permissions" | "settings";

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<"users" | "management">("users");
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [dateRange, setDateRange] = useState(dateRanges[0].id);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [users, setUsers] = useState<UserEntity[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userPagination, setUserPagination] = useState({ pageNumber: 1, totalPages: 1, totalItems: 0 });

  const [features, setFeatures] = useState<FeatureEntity[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  const [managementFeatureRef, setManagementFeatureRef] = useState("");
  const [managementFeatureId, setManagementFeatureId] = useState<number | null>(null);
  const [managementTab, setManagementTab] = useState<ManagementTab>("roles");

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSearch, setRolesSearch] = useState("");
  const [rolesPageMeta, setRolesPageMeta] = useState(DEFAULT_PAGE_META);
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(25);
  const [roleActionId, setRoleActionId] = useState<number | null>(null);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [permissionsSearch, setPermissionsSearch] = useState("");
  const [permissionsPageMeta, setPermissionsPageMeta] = useState(DEFAULT_PAGE_META);
  const [permissionsPage, setPermissionsPage] = useState(1);
  const [permissionsPageSize, setPermissionsPageSize] = useState(25);
  const [permissionActionId, setPermissionActionId] = useState<number | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [permissionOptions, setPermissionOptions] = useState<PermissionRecord[]>([]);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"create" | "edit">("create");
  const [roleFormState, setRoleFormState] = useState<RoleFormState>({
    id: null,
    name: "",
    description: "",
    permissions: [],
    is_default: false,
  });
  const [roleModalError, setRoleModalError] = useState<string | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionModalMode, setPermissionModalMode] = useState<"create" | "edit">("create");
  const [permissionFormState, setPermissionFormState] = useState<PermissionFormState>({ id: null, name: "" });
  const [permissionModalError, setPermissionModalError] = useState<string | null>(null);
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);

  const [featureDetails, setFeatureDetails] = useState<FeatureDetails | null>(null);
  const [defaultRoles, setDefaultRoles] = useState({ creator: "", member: "" });
  const [defaultRolesSaving, setDefaultRolesSaving] = useState(false);
  const [defaultRolesMessage, setDefaultRolesMessage] = useState<string | null>(null);
  const [defaultRolesError, setDefaultRolesError] = useState<string | null>(null);

  const managementFeatures = useMemo(
    () => features.filter((feature) => Number(feature.feature_id) === 1 && Boolean(feature.reference_id)),
    [features]
  );

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await UsersApi.list({
        pageNo: pageIndex + 1,
        itemsPerPage: pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(company.trim() ? { company_name: company.trim() } : {}),
        ...(featureFilter !== "all" ? { feature_id: featureFilter } : {}),
        ...getDateRangeForApi(dateRange),
      });
      const payload = response.data;
      setUsers(payload.data ?? []);
      setUserPagination({
        pageNumber: payload.pageNumber ?? pageIndex + 1,
        totalPages: payload.totalPageCount ?? 1,
        totalItems: payload.totalEntityCount ?? payload.data.length,
      });
      setPageIndex((prev) => {
        const next = Math.max((payload.pageNumber ?? 1) - 1, 0);
        return prev === next ? prev : next;
      });
    } catch (error) {
      console.error("Failed to fetch users", error);
      setUsersError(error instanceof Error ? error.message : "Unable to fetch users");
      setUsers([]);
      setUserPagination({ pageNumber: 1, totalPages: 1, totalItems: 0 });
    } finally {
      setUsersLoading(false);
    }
  }, [company, dateRange, featureFilter, pageIndex, pageSize, search]);

  const fetchFeatures = useCallback(async () => {
    setFeaturesLoading(true);
    try {
      const response = await FeaturesApi.list({ pageNo: 1, itemsPerPage: 500 });
      const payload = response.data?.data ?? [];
      setFeatures(payload);
    } catch (error) {
      console.error("Failed to fetch features", error);
      setFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    if (!managementFeatureRef) {
      setRoles([]);
      setRolesPageMeta(DEFAULT_PAGE_META);
      return;
    }
    setRolesLoading(true);
    setRolesError(null);
    try {
      const response = await UsersApi.roles(managementFeatureRef, {
        pageNo: rolesPage,
        itemsPerPage: rolesPageSize,
        ...(rolesSearch.trim() ? { search: rolesSearch.trim() } : {}),
      });
      const payload = response.data;
      setRoles((payload.data as RoleRecord[]) ?? []);
      setRolesPageMeta({
        pageNumber: payload.pageNumber ?? rolesPage,
        totalPages: payload.totalPageCount ?? 1,
        totalItems: payload.totalEntityCount ?? payload.data.length ?? 0,
      });
      setRolesPage((prev) => {
        const next = payload.pageNumber ?? rolesPage;
        return prev === next ? prev : next;
      });
    } catch (error) {
      console.error("Failed to fetch roles", error);
      setRolesError(error instanceof Error ? error.message : "Unable to load roles");
      setRoles([]);
      setRolesPageMeta(DEFAULT_PAGE_META);
    } finally {
      setRolesLoading(false);
    }
  }, [managementFeatureRef, rolesPage, rolesPageSize, rolesSearch]);

  const loadPermissions = useCallback(async () => {
    if (!managementFeatureRef) {
      setPermissions([]);
      setPermissionsPageMeta(DEFAULT_PAGE_META);
      return;
    }
    setPermissionsLoading(true);
    setPermissionsError(null);
    try {
      const response = await UsersApi.permissions(managementFeatureRef, {
        pageNo: permissionsPage,
        itemsPerPage: permissionsPageSize,
        ...(permissionsSearch.trim() ? { search: permissionsSearch.trim() } : {}),
      });
      const payload = response.data;
      setPermissions((payload.data as PermissionRecord[]) ?? []);
      setPermissionsPageMeta({
        pageNumber: payload.pageNumber ?? permissionsPage,
        totalPages: payload.totalPageCount ?? 1,
        totalItems: payload.totalEntityCount ?? payload.data.length ?? 0,
      });
      setPermissionsPage((prev) => {
        const next = payload.pageNumber ?? permissionsPage;
        return prev === next ? prev : next;
      });
    } catch (error) {
      console.error("Failed to fetch permissions", error);
      setPermissionsError(error instanceof Error ? error.message : "Unable to load permissions");
      setPermissions([]);
      setPermissionsPageMeta(DEFAULT_PAGE_META);
    } finally {
      setPermissionsLoading(false);
    }
  }, [managementFeatureRef, permissionsPage, permissionsPageSize, permissionsSearch]);

  const refreshPermissionOptions = useCallback(async () => {
    if (!managementFeatureRef) {
      setPermissionOptions([]);
      return;
    }
    try {
      const response = await UsersApi.permissions(managementFeatureRef, { pageNo: 1, itemsPerPage: 1000 });
      setPermissionOptions((response.data?.data as PermissionRecord[]) ?? []);
    } catch (error) {
      console.error("Failed to fetch permission options", error);
    }
  }, [managementFeatureRef]);

  const refreshFeatureDetails = useCallback(async () => {
    if (!managementFeatureId) {
      setFeatureDetails(null);
      setDefaultRoles({ creator: "", member: "" });
      return;
    }
    try {
      const response = await FeaturesApi.details(managementFeatureId);
      setFeatureDetails(response.data ?? null);
      const cRoles = (response.data?.extra_configurations as Record<string, unknown>)?.c_roles ?? {};
      setDefaultRoles({
        creator: cRoles?.default_creator_role ? String(cRoles.default_creator_role) : "",
        member: cRoles?.default_member_role ? String(cRoles.default_member_role) : "",
      });
    } catch (error) {
      console.error("Failed to fetch block details", error);
      setFeatureDetails(null);
      setDefaultRoles({ creator: "", member: "" });
    }
  }, [managementFeatureId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  useEffect(() => {
    if (!managementFeatures.length) {
      setManagementFeatureRef("");
      setManagementFeatureId(null);
      return;
    }
    if (!managementFeatureRef) {
      const next = managementFeatures[0];
      setManagementFeatureRef(next.reference_id);
      setManagementFeatureId(next.id ?? null);
      return;
    }
    const selected = managementFeatures.find((feature) => feature.reference_id === managementFeatureRef);
    if (!selected) {
      const fallback = managementFeatures[0];
      setManagementFeatureRef(fallback.reference_id);
      setManagementFeatureId(fallback.id ?? null);
      return;
    }
    if ((selected.id ?? null) !== managementFeatureId) {
      setManagementFeatureId(selected.id ?? null);
    }
  }, [managementFeatures, managementFeatureId, managementFeatureRef]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    refreshPermissionOptions();
  }, [refreshPermissionOptions]);

  useEffect(() => {
    refreshFeatureDetails();
  }, [refreshFeatureDetails]);

  const handleSelectManagementFeature = (referenceId: string) => {
    setManagementFeatureRef(referenceId);
    const selected = managementFeatures.find((feature) => feature.reference_id === referenceId);
    setManagementFeatureId(selected?.id ?? null);
    setRolesPage(1);
    setPermissionsPage(1);
    setRolesSearch("");
    setPermissionsSearch("");
    setRoleMessage(null);
    setPermissionMessage(null);
  };

  const openCreateRoleModal = () => {
    setRoleModalMode("create");
    setRoleFormState({ id: null, name: "", description: "", permissions: [], is_default: false });
    setRoleModalError(null);
    setRoleModalOpen(true);
  };

  const openEditRoleModal = (role: RoleRecord) => {
    setRoleModalMode("edit");
    setRoleFormState({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: role.c_permissions?.map((item) => item.name) ?? [],
      is_default: Boolean(role.is_default),
    });
    setRoleModalError(null);
    setRoleModalOpen(true);
  };

  const submitRoleForm = async () => {
    if (!managementFeatureRef) {
      setRoleModalError("Select a block before managing roles.");
      return;
    }
    if (!roleFormState.name.trim()) {
      setRoleModalError("Role name is required.");
      return;
    }
    setRoleSubmitting(true);
    try {
      const payload = {
        name: roleFormState.name.trim(),
        permissions: roleFormState.permissions,
        description: roleFormState.description.trim(),
        is_default: roleFormState.is_default,
      };
      if (roleModalMode === "create") {
        await UsersApi.createRole(managementFeatureRef, payload);
        setRoleMessage(`Role "${payload.name}" created.`);
      } else if (roleFormState.id !== null) {
        await UsersApi.updateRole(managementFeatureRef, roleFormState.id, payload);
        setRoleMessage(`Role "${payload.name}" updated.`);
      }
      setRoleModalOpen(false);
      setRoleFormState({ id: null, name: "", description: "", permissions: [], is_default: false });
      await loadRoles();
      await refreshFeatureDetails();
    } catch (error) {
      console.error("Failed to save role", error);
      setRoleModalError(error instanceof Error ? error.message : "Unable to save role");
    } finally {
      setRoleSubmitting(false);
    }
  };

  const deleteRole = async (role: RoleRecord) => {
    if (!managementFeatureRef || !role.feature_configuration_id) {
      return;
    }
    const confirmed = window.confirm(`Delete role "${role.name}"?`);
    if (!confirmed) {
      return;
    }
    setRoleActionId(role.id);
    try {
      await UsersApi.deleteRole(managementFeatureRef, role.id);
      setRoleMessage(`Role "${role.name}" deleted.`);
      await loadRoles();
      await refreshFeatureDetails();
    } catch (error) {
      console.error("Failed to delete role", error);
      setRolesError(error instanceof Error ? error.message : "Unable to delete role");
    } finally {
      setRoleActionId(null);
    }
  };

  const openCreatePermissionModal = () => {
    setPermissionModalMode("create");
    setPermissionFormState({ id: null, name: "" });
    setPermissionModalError(null);
    setPermissionModalOpen(true);
  };

  const openEditPermissionModal = (permission: PermissionRecord) => {
    setPermissionModalMode("edit");
    setPermissionFormState({ id: permission.id, name: permission.name });
    setPermissionModalError(null);
    setPermissionModalOpen(true);
  };

  const submitPermissionForm = async () => {
    if (!managementFeatureRef) {
      setPermissionModalError("Select a block before managing permissions.");
      return;
    }
    if (!permissionFormState.name.trim()) {
      setPermissionModalError("Permission name is required.");
      return;
    }
    setPermissionSubmitting(true);
    try {
      const payload = { name: permissionFormState.name.trim() };
      if (permissionModalMode === "create") {
        await UsersApi.createPermission(managementFeatureRef, payload);
        setPermissionMessage(`Permission "${payload.name}" created.`);
      } else if (permissionFormState.id !== null) {
        await UsersApi.updatePermission(managementFeatureRef, permissionFormState.id, payload);
        setPermissionMessage(`Permission "${payload.name}" updated.`);
      }
      setPermissionModalOpen(false);
      setPermissionFormState({ id: null, name: "" });
      await loadPermissions();
      await refreshPermissionOptions();
    } catch (error) {
      console.error("Failed to save permission", error);
      setPermissionModalError(error instanceof Error ? error.message : "Unable to save permission");
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const deletePermission = async (permission: PermissionRecord) => {
    if (!managementFeatureRef || permission.is_default) {
      return;
    }
    const confirmed = window.confirm(`Delete permission "${permission.name}"?`);
    if (!confirmed) {
      return;
    }
    setPermissionActionId(permission.id);
    try {
      await UsersApi.deletePermission(managementFeatureRef, permission.id);
      setPermissionMessage(`Permission "${permission.name}" deleted.`);
      await loadPermissions();
      await refreshPermissionOptions();
    } catch (error) {
      console.error("Failed to delete permission", error);
      setPermissionsError(error instanceof Error ? error.message : "Unable to delete permission");
    } finally {
      setPermissionActionId(null);
    }
  };

  const saveDefaultRoles = async () => {
    if (!managementFeatureId) {
      setDefaultRolesError("Unable to resolve block identifier.");
      return;
    }
    if (!defaultRoles.creator || !defaultRoles.member) {
      setDefaultRolesError("Select default roles for creator and member.");
      return;
    }
    setDefaultRolesSaving(true);
    setDefaultRolesError(null);
    try {
      const existingExtra = (featureDetails?.extra_configurations as Record<string, unknown>) ?? {};
      const payload = {
        extra_configurations: {
          ...existingExtra,
          c_roles: {
            ...(existingExtra.c_roles ?? {}),
            default_creator_role: Number(defaultRoles.creator),
            default_member_role: Number(defaultRoles.member),
          },
          default_role: existingExtra.default_role ?? { name: "Owner", value: 1 },
        },
      };
      await FeaturesApi.update(managementFeatureId, payload);
      setDefaultRolesMessage("Default roles updated.");
      await refreshFeatureDetails();
    } catch (error) {
      console.error("Failed to save default roles", error);
      setDefaultRolesError(error instanceof Error ? error.message : "Unable to save default roles");
    } finally {
      setDefaultRolesSaving(false);
    }
  };

  const renderTabs = () => (
    <div className="flex gap-2 border-b border-[#e1e4e8]">
      {(["users", "management"] as const).map((tab) => (
        <button
          key={tab}
          className={`px-4 py-2 text-sm font-semibold ${
            activeTab === tab ? "border-b-2 border-[#3f51b5] text-[#3f51b5]" : "text-[#5d6164] hover:text-[#3f51b5]"
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab === "users" ? "Users" : "Management"}
        </button>
      ))}
    </div>
  );

  const renderUsersTable = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={dateRange}
          onChange={(event) => {
            setDateRange(event.target.value);
            setPageIndex(0);
          }}
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
        >
          {dateRanges.map((range) => (
            <option key={range.id} value={range.id}>
              {range.label}
            </option>
          ))}
        </select>
        <button
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
          onClick={() => {
            setCompany("");
            setFeatureFilter("all");
            setSearch("");
            setDateRange(dateRanges[0].id);
            setPageIndex(0);
          }}
        >
          Clear filters
        </button>
      </div>

      <div className="app-card p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <FilterField label="Company">
            <input
              type="text"
              value={company}
              onChange={(event) => {
                setCompany(event.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
              placeholder="Search by company"
            />
          </FilterField>
          <FilterField label="Block">
            <select
              value={featureFilter}
              onChange={(event) => {
                setFeatureFilter(event.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
            >
              <option value="all">All blocks</option>
              {featuresLoading && (
                <option value="loading" disabled>
                  Loading…
                </option>
              )}
              {features.map((feature) => (
                <option key={feature.reference_id} value={feature.reference_id}>
                  {feature.name} ({feature.reference_id})
                </option>
              ))}
            </select>
          </FilterField>
        </div>

        <div className="table-scroll">
          <table className="default-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Created</th>
                <th>Company</th>
                <th>Block</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#5d6164]">
                    Loading users…
                  </td>
                </tr>
              )}
              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#5d6164]">
                    {usersError ?? "No users found."}
                  </td>
                </tr>
              )}
              {!usersLoading &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-semibold text-[#212528]">{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.mobile ?? "—"}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-[#212528]">{formatDateForUi(user.created_at)}</span>
                        <span className="text-xs text-[#5d6164]">{formatTimeForUi(user.created_at)}</span>
                      </div>
                    </td>
                    <td>{user.company_name ?? "—"}</td>
                    <td>
                      {user.feature_id ? (
                        <span className="chip">{user.feature_id}</span>
                      ) : (
                        <span className="text-xs text-[#8f9396]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between border-t border-[#e1e4e8] pt-3 text-sm text-[#5d6164]">
          <div>
            Showing {users.length} of {userPagination.totalItems}
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
                {[10, 25, 50].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-flex gap-2">
              <button
                className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
                disabled={pageIndex === 0 || usersLoading}
                onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              >
                Prev
              </button>
              <button
                className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
                disabled={usersLoading || userPagination.pageNumber >= userPagination.totalPages}
                onClick={() =>
                  setPageIndex((prev) =>
                    Math.min(prev + 1, Math.max(userPagination.totalPages - 1, 0))
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRolesTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={rolesSearch}
          onChange={(event) => {
            setRolesSearch(event.target.value);
            setRolesPage(1);
          }}
          placeholder="Search roles"
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
        />
        <button
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
          onClick={() => {
            setRolesSearch("");
            setRolesPage(1);
          }}
        >
          Clear
        </button>
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-full border border-[#3f51b5] px-4 py-2 text-sm font-semibold text-[#3f51b5]"
            onClick={openCreateRoleModal}
          >
            Add Role
          </button>
        </div>
      </div>
      {roleMessage && <p className="text-xs text-[#0f9d58]">{roleMessage}</p>}
      {rolesError && <p className="text-xs text-[#b91c1c]">{rolesError}</p>}
      <div className="table-scroll">
        <table className="default-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rolesLoading && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-[#5d6164]">
                  Loading roles…
                </td>
              </tr>
            )}
            {!rolesLoading && roles.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-[#5d6164]">
                  No roles found.
                </td>
              </tr>
            )}
            {!rolesLoading &&
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <p className="font-semibold text-[#212528]">{role.name}</p>
                    {role.description && <p className="text-xs text-[#5d6164]">{role.description}</p>}
                  </td>
                  <td>
                    {role.c_permissions?.length ? (
                      <ul className="text-xs text-[#3f4346] space-y-1">
                        {role.c_permissions.map((permission) => (
                          <li key={permission.id}>{permission.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-[#8f9396]">No permissions</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        className="rounded-full border border-[#d5d9dc] px-3 py-1 text-xs font-semibold text-[#3f51b5] disabled:opacity-50"
                        onClick={() => openEditRoleModal(role)}
                        disabled={!role.feature_configuration_id || roleActionId === role.id}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-full border border-[#d5d9dc] px-3 py-1 text-xs font-semibold text-[#b91c1c] disabled:opacity-50"
                        onClick={() => deleteRole(role)}
                        disabled={!role.feature_configuration_id || roleActionId === role.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between border-t border-[#e1e4e8] pt-3 text-sm text-[#5d6164]">
        <div>
          Showing {roles.length} of {rolesPageMeta.totalItems}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            Rows
            <select
              value={rolesPageSize}
              onChange={(event) => {
                setRolesPageSize(Number(event.target.value));
                setRolesPage(1);
              }}
              className="rounded-lg border border-[#d5d9dc] px-2 py-1"
            >
              {[25, 50, 100, 1000].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex gap-2">
            <button
              className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
              disabled={rolesPage <= 1 || rolesLoading}
              onClick={() => setRolesPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </button>
            <button
              className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
              disabled={rolesLoading || rolesPageMeta.pageNumber >= rolesPageMeta.totalPages}
              onClick={() =>
                setRolesPage((prev) =>
                  Math.min(prev + 1, Math.max(rolesPageMeta.totalPages, 1))
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPermissionsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={permissionsSearch}
          onChange={(event) => {
            setPermissionsSearch(event.target.value);
            setPermissionsPage(1);
          }}
          placeholder="Search permissions"
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
        />
        <button
          className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
          onClick={() => {
            setPermissionsSearch("");
            setPermissionsPage(1);
          }}
        >
          Clear
        </button>
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-full border border-[#3f51b5] px-4 py-2 text-sm font-semibold text-[#3f51b5]"
            onClick={openCreatePermissionModal}
          >
            Add Permission
          </button>
        </div>
      </div>
      {permissionMessage && <p className="text-xs text-[#0f9d58]">{permissionMessage}</p>}
      {permissionsError && <p className="text-xs text-[#b91c1c]">{permissionsError}</p>}
      <div className="table-scroll">
        <table className="default-table">
          <thead>
            <tr>
              <th>Permission</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {permissionsLoading && (
              <tr>
                <td colSpan={2} className="py-10 text-center text-sm text-[#5d6164]">
                  Loading permissions…
                </td>
              </tr>
            )}
            {!permissionsLoading && permissions.length === 0 && (
              <tr>
                <td colSpan={2} className="py-10 text-center text-sm text-[#5d6164]">
                  No permissions found.
                </td>
              </tr>
            )}
            {!permissionsLoading &&
              permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="font-semibold text-[#212528]">{permission.name}</td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="rounded-full border border-[#d5d9dc] px-3 py-1 text-xs font-semibold text-[#3f51b5] disabled:opacity-50"
                        onClick={() => openEditPermissionModal(permission)}
                        disabled={permission.is_default || permissionActionId === permission.id}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-full border border-[#d5d9dc] px-3 py-1 text-xs font-semibold text-[#b91c1c] disabled:opacity-50"
                        onClick={() => deletePermission(permission)}
                        disabled={permission.is_default || permissionActionId === permission.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between border-t border-[#e1e4e8] pt-3 text-sm text-[#5d6164]">
        <div>
          Showing {permissions.length} of {permissionsPageMeta.totalItems}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            Rows
            <select
              value={permissionsPageSize}
              onChange={(event) => {
                setPermissionsPageSize(Number(event.target.value));
                setPermissionsPage(1);
              }}
              className="rounded-lg border border-[#d5d9dc] px-2 py-1"
            >
              {[25, 50, 100, 1000].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex gap-2">
            <button
              className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
              disabled={permissionsPage <= 1 || permissionsLoading}
              onClick={() => setPermissionsPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </button>
            <button
              className="rounded-full border border-[#d5d9dc] px-3 py-1 disabled:opacity-50"
              disabled={permissionsLoading || permissionsPageMeta.pageNumber >= permissionsPageMeta.totalPages}
              onClick={() =>
                setPermissionsPage((prev) =>
                  Math.min(prev + 1, Math.max(permissionsPageMeta.totalPages, 1))
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-[#5d6164]">
        Choose the default roles that creators and members receive automatically.
      </p>
      {defaultRolesMessage && <p className="text-xs text-[#0f9d58]">{defaultRolesMessage}</p>}
      {defaultRolesError && <p className="text-xs text-[#b91c1c]">{defaultRolesError}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5d6164]">Default role for creator</label>
          <select
            value={defaultRoles.creator}
            onChange={(event) => setDefaultRoles((prev) => ({ ...prev, creator: event.target.value }))}
            className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#5d6164]">Default role for member</label>
          <select
            value={defaultRoles.member}
            onChange={(event) => setDefaultRoles((prev) => ({ ...prev, member: event.target.value }))}
            className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-full bg-[#3f51b5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={saveDefaultRoles}
          disabled={defaultRolesSaving}
        >
          Save
        </button>
        <button
          className="rounded-full border border-[#d5d9dc] px-6 py-2 text-sm"
          onClick={() => {
            const cRoles = (featureDetails?.extra_configurations as Record<string, unknown>)?.c_roles ?? {};
            setDefaultRoles({
              creator: cRoles?.default_creator_role ? String(cRoles.default_creator_role) : "",
              member: cRoles?.default_member_role ? String(cRoles.default_member_role) : "",
            });
            setDefaultRolesMessage(null);
            setDefaultRolesError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderManagement = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#5d6164]">Select Block</label>
        <select
          value={managementFeatureRef}
          onChange={(event) => handleSelectManagementFeature(event.target.value)}
          className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
        >
          <option value="">Choose block</option>
          {managementFeatures.map((feature) => (
            <option key={feature.reference_id} value={feature.reference_id}>
              {feature.name}
            </option>
          ))}
        </select>
      </div>
      {!managementFeatures.length && (
        <div className="rounded-2xl border border-[#e1e4e8] bg-white p-4 text-sm text-[#5d6164]">
          No blocks available for management yet.
        </div>
      )}
      {managementFeatureRef && (
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-[#e1e4e8]">
            {(["roles", "permissions", "settings"] as const).map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-semibold ${
                  managementTab === tab
                    ? "border-b-2 border-[#3f51b5] text-[#3f51b5]"
                    : "text-[#5d6164] hover:text-[#3f51b5]"
                }`}
                onClick={() => setManagementTab(tab)}
              >
                {tab === "roles" ? "Roles" : tab === "permissions" ? "Permissions" : "Settings"}
              </button>
            ))}
          </div>
          <div className="app-card p-5">
            {managementTab === "roles" && renderRolesTab()}
            {managementTab === "permissions" && renderPermissionsTab()}
            {managementTab === "settings" && renderSettingsTab()}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#212528]">Users</h1>
        <p className="text-sm text-[#5d6164]">Audit access, manage blocks, and update permissions.</p>
      </div>
      {renderTabs()}
      {activeTab === "users" ? renderUsersTable() : renderManagement()}

      <Modal
        open={roleModalOpen}
        title={roleModalMode === "create" ? "Add Role" : "Edit Role"}
        onClose={() => setRoleModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
              onClick={() => setRoleModalOpen(false)}
              disabled={roleSubmitting}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-[#3f51b5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={submitRoleForm}
              disabled={roleSubmitting}
            >
              {roleSubmitting ? "Saving…" : roleModalMode === "create" ? "Add Role" : "Save"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {roleModalError && <p className="text-xs text-[#b91c1c]">{roleModalError}</p>}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#5d6164]">Role name</label>
            <input
              type="text"
              value={roleFormState.name}
              onChange={(event) => setRoleFormState((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
              placeholder="Enter role name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#5d6164]">Permissions</label>
            <select
              multiple
              value={roleFormState.permissions}
              onChange={(event) =>
                setRoleFormState((prev) => ({
                  ...prev,
                  permissions: Array.from(event.target.selectedOptions).map((option) => option.value),
                }))
              }
              className="h-32 w-full rounded-2xl border border-[#d5d9dc] px-2 py-2 text-sm focus:border-[#3f51b5]"
            >
              {permissionOptions.map((permission) => (
                <option key={permission.id} value={permission.name}>
                  {permission.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8f9396]">Hold Cmd/Ctrl to select multiple permissions.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#5d6164]">Description</label>
            <textarea
              value={roleFormState.description}
              onChange={(event) => setRoleFormState((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
              placeholder="Optional description"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-[#5d6164]">
            <input
              type="checkbox"
              checked={roleFormState.is_default}
              onChange={(event) => setRoleFormState((prev) => ({ ...prev, is_default: event.target.checked }))}
              className="h-4 w-4 rounded border-[#d5d9dc]"
            />
            Set as default role
          </label>
        </div>
      </Modal>

      <Modal
        open={permissionModalOpen}
        title={permissionModalMode === "create" ? "Add Permission" : "Edit Permission"}
        onClose={() => setPermissionModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded-full border border-[#d5d9dc] px-4 py-2 text-sm"
              onClick={() => setPermissionModalOpen(false)}
              disabled={permissionSubmitting}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-[#3f51b5] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={submitPermissionForm}
              disabled={permissionSubmitting}
            >
              {permissionSubmitting ? "Saving…" : permissionModalMode === "create" ? "Add Permission" : "Save"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {permissionModalError && <p className="text-xs text-[#b91c1c]">{permissionModalError}</p>}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#5d6164]">Permission name</label>
            <input
              type="text"
              value={permissionFormState.name}
              onChange={(event) => setPermissionFormState((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-2xl border border-[#d5d9dc] px-4 py-2 text-sm focus:border-[#3f51b5]"
              placeholder="Enter permission name"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold text-[#5d6164]">
      {label}
      {children}
    </label>
  );
}

function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e1e4e8] px-5 py-3">
          <p className="text-sm font-semibold text-[#212528]">{title}</p>
          <button className="text-[#5d6164]" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="border-t border-[#e1e4e8] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
