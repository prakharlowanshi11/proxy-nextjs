export type Client = {
  id: string;
  name: string;
};

export type Environment = {
  id: string;
  name: string;
  slug: string;
  url: string;
  projectId: string;
};

export type Project = {
  id: string;
  name: string;
  environments: Environment[];
};

export type LogEntry = {
  id: string;
  createdAt: string;
  projectId: string;
  environmentId: string;
  userIp: string;
  endpoint: string;
  requestType: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  statusCode: number;
  responseTime: number;
  responseSizeKb: number;
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown>;
  headers: Record<string, string>;
};

export type FeatureMethod = {
  name: string;
};

export type FeatureType = {
  name: string;
};

export type Feature = {
  id: string;
  name: string;
  referenceId: string;
  method: FeatureMethod;
  feature: FeatureType;
  status: "active" | "draft";
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  company: string;
  featureId?: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  quota: string;
  price: string;
  features: string[];
};
