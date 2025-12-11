import { proxyRequest } from "./client";
import { PaginatedResponse } from "./types";
import { ClientEntity, ClientSettings, ProjectEntity } from "./contracts";

export type ClientsQuery = Partial<{
  pageNo: number;
  itemsPerPage: number;
  search: string;
}>;

export const RootApi = {
  clientSettings: () => proxyRequest<ClientSettings>("getClientSettings"),

  clients: (params?: ClientsQuery) => proxyRequest<PaginatedResponse<ClientEntity[]>>("clients", { params }),

  switchClient: (clientId: number) =>
    proxyRequest<{ message: string }>("switchclient", { method: "POST", body: { client_id: clientId } }),

  generateToken: (params?: Record<string, string | number>) =>
    proxyRequest<{ jwt: string }>("generateToken", { params }),

  projects: () => proxyRequest<ProjectEntity>("projects"),
};
