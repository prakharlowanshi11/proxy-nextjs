import { proxyRequest } from "./client";
import { PaginatedResponse } from "./types";
import { EnvironmentEntity, LogDetail, LogListEntry, ProjectEntity } from "./contracts";

export type LogsQuery = Partial<{
  pageNo: number;
  itemsPerPage: number;
  sortBy: string;
  order: "asc" | "desc";
  slug: string;
  url_unique_id: string;
  range: string;
  from: number;
  to: number;
  user_ip: string;
  endpoint: string;
  startDate: string;
  endDate: string;
  search: string;
  project_id: number;
  environment_id: number;
  request_type: string;
}>;

export type EntityQuery = Partial<{
  pageNo: number;
  itemsPerPage: number;
  search: string;
}>;

export const LogsApi = {
  list: (params?: LogsQuery) => proxyRequest<PaginatedResponse<LogListEntry[]>>("proxyLogs", { params }),

  byId: (id: string) => proxyRequest<LogDetail>(`proxyLogs/${id}`),

  projects: (params?: EntityQuery) =>
    proxyRequest<PaginatedResponse<ProjectEntity[]>>("projects", { params }),

  environments: (params?: EntityQuery) =>
    proxyRequest<PaginatedResponse<EnvironmentEntity[]>>("environments", { params }),
};
