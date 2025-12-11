import { proxyRequest } from "./client";
import { PaginatedResponse } from "./types";
import { ClientPermission, ClientRole, UserEntity } from "./contracts";

export type UsersQuery = Partial<{
  pageNo: number;
  itemsPerPage: number;
  search: string;
  startDate: string;
  endDate: string;
  company_name: string;
  feature_id: string;
}>;

const pathWithReference = (template: string, referenceId: string | number, id?: string | number) => {
  let path = template.replace(":referenceId", String(referenceId));
  if (id !== undefined) {
    path = path.replace(":id", String(id));
  }
  return path;
};

export const UsersApi = {
  list: (params?: UsersQuery) => proxyRequest<PaginatedResponse<UserEntity[]>>("clientUsers", { params }),

  roles: (referenceId: string, params?: Record<string, string | number>) =>
    proxyRequest<PaginatedResponse<ClientRole[]>>(pathWithReference(":referenceId/cRoles", referenceId), {
      params,
    }),

  createRole: (referenceId: string, body: Record<string, unknown>) =>
    proxyRequest<ClientRole>(pathWithReference(":referenceId/cRoles", referenceId), { method: "POST", body }),

  updateRole: (referenceId: string, id: string | number, body: Record<string, unknown>) =>
    proxyRequest<ClientRole>(pathWithReference(":referenceId/cRoles/:id", referenceId, id), {
      method: "PUT",
      body,
    }),

  deleteRole: (referenceId: string, id: string | number) =>
    proxyRequest<void>(pathWithReference(":referenceId/cRoles/:id", referenceId, id), { method: "DELETE" }),

  permissions: (referenceId: string, params?: Record<string, string | number>) =>
    proxyRequest<PaginatedResponse<ClientPermission[]>>(pathWithReference(":referenceId/cPermission", referenceId), {
      params,
    }),

  createPermission: (referenceId: string, body: Record<string, unknown>) =>
    proxyRequest<ClientPermission>(pathWithReference(":referenceId/cPermission", referenceId), {
      method: "POST",
      body,
    }),

  updatePermission: (referenceId: string, id: string | number, body: Record<string, unknown>) =>
    proxyRequest<ClientPermission>(pathWithReference(":referenceId/cPermission/:id", referenceId, id), {
      method: "PUT",
      body,
    }),

  deletePermission: (referenceId: string, id: string | number) =>
    proxyRequest<void>(pathWithReference(":referenceId/cPermission/:id", referenceId, id), {
      method: "DELETE",
    }),

  register: (body: Record<string, unknown>) =>
    proxyRequest("register", { method: "POST", body, json: true }),
};
