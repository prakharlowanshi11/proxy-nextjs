import { proxyRequest } from "./client";
import { PaginatedResponse } from "./types";
import {
  FeatureDetails,
  FeatureEntity,
  FeatureTypeEntity,
  MethodEntity,
  BillableMetric,
  Tax,
  Plan,
  PaymentCredential,
} from "./contracts";

export type FeatureListParams = Partial<{
  pageNo: number;
  itemsPerPage: number;
  search: string;
}> &
  Record<string, string | number | boolean | undefined>;

export const FeaturesApi = {
  list: (params?: FeatureListParams) =>
    proxyRequest<PaginatedResponse<FeatureEntity[]>>("features", { params }),

  details: (id: string | number) => proxyRequest<FeatureDetails>(`features/${id}`),

  types: () => proxyRequest<FeatureTypeEntity[]>("getFeatures"),

  methodServices: (id: number) => proxyRequest<MethodEntity[]>(`getMethodsService/${id}`),

  create: (body: Partial<FeatureEntity>) => proxyRequest<FeatureEntity>("features", { method: "POST", body }),

  update: (id: string | number, body: Partial<FeatureEntity>) =>
    proxyRequest<FeatureEntity>(`features/${id}`, { method: "PUT", body }),

  createLagoFeature: (body: Record<string, unknown>) =>
    proxyRequest<FeatureEntity>("features", { method: "POST", body }),

  billableMetrics: (refId: string | number) =>
    proxyRequest<BillableMetric[]>(`subscription/${refId}/billableMetrics`),

  createBillableMetric: (refId: string | number, body: Record<string, unknown>) =>
    proxyRequest<BillableMetric>(`subscription/${refId}/billableMetrics`, { method: "POST", body }),

  updateBillableMetric: (refId: string | number, code: string, body: Record<string, unknown>) =>
    proxyRequest<BillableMetric>(`subscription/${refId}/billableMetrics/${code}`, { method: "PUT", body }),

  deleteBillableMetric: (refId: string | number, code: string) =>
    proxyRequest<void>(`subscription/${refId}/billableMetrics/${code}`, { method: "DELETE" }),

  billableMetricForm: () => proxyRequest<Record<string, unknown>>("getBillableMetricForm"),

  plansForm: (refId: string | number) => proxyRequest<Record<string, unknown>>(`subscription/${refId}/plans`),

  taxes: (refId: string | number) => proxyRequest<Tax[]>(`subscription/${refId}/taxes`),

  createTax: (refId: string | number, body: Tax) =>
    proxyRequest<Tax>(`subscription/${refId}/taxes`, { method: "POST", body }),

  deleteTax: (refId: string | number, code: string) =>
    proxyRequest<void>(`subscription/${refId}/taxes/${code}`, { method: "DELETE" }),

  createPlan: (refId: string | number, body: Plan) =>
    proxyRequest<Plan>(`subscription/${refId}/plans`, { method: "POST", body }),

  allPlans: (refId: string | number) => proxyRequest<Plan[]>(`subscription/${refId}/plans`),

  updatePlan: (refId: string | number, code: string, body: Plan) =>
    proxyRequest<Plan>(`subscription/${refId}/plans/${code}`, { method: "PUT", body }),

  deletePlan: (refId: string | number, code: string) =>
    proxyRequest<void>(`subscription/${refId}/plans/${code}`, { method: "DELETE" }),

  paymentDetailsForm: () => proxyRequest<Record<string, unknown>>("paymentCredentialsForm"),

  paymentDetailsById: (refId: string | number) => proxyRequest<PaymentCredential>(`${refId}/paymentForm`),

  updatePaymentDetails: (refId: string | number, body: Record<string, unknown>) =>
    proxyRequest<PaymentCredential>(`subscription/${refId}/updateCredentials`, { method: "POST", body }),
};
