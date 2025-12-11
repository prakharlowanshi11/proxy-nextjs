import { proxyRequest } from "./client";
import { PaginatedResponse } from "./types";
import { EnvironmentEntity, ProjectEntity, ClientEntity, CreateSourcePayload } from "./contracts";

export type EnvironmentQuery = Partial<{
  pageNo: number;
  itemsPerPage: number;
  search: string;
}>;

export const CreateProjectApi = {
  create: (body: Record<string, unknown>) =>
    proxyRequest<ProjectEntity[]>("projects", { method: "POST", body }),

  update: (id: string | number, body: Record<string, unknown>) =>
    proxyRequest<ProjectEntity[]>(`projects/${id}`, { method: "PUT", body }),

  environments: (params?: EnvironmentQuery) =>
    proxyRequest<PaginatedResponse<EnvironmentEntity[]>>("environments", { params }),

  clients: (params?: EnvironmentQuery) =>
    proxyRequest<PaginatedResponse<ClientEntity[]>>("clients", { params }),

  createSourceDomains: (body: CreateSourcePayload) =>
    proxyRequest("sourceDomains", { method: "POST", body }),
};
