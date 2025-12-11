export type Id = string | number;

export type AuditUser = {
  id: number;
  name: string;
  email: string;
};

export type FeatureTypeEntity = {
  id: number;
  name: string;
  icon?: string;
};

export type MethodServiceConfiguration = {
  fields: Record<string, unknown>;
  mappings: unknown[];
};

export type MethodServiceRequirement = Record<string, unknown>;

export type MethodService = {
  name: string;
  method_id: number;
  service_id: number;
  is_enable?: boolean;
  configurations: MethodServiceConfiguration;
  requirements: MethodServiceRequirement;
};

export type AuthorizationFormat = {
  format: Record<string, unknown>;
  encode_type: string;
  key: string;
};

export type MethodEntity = {
  id: number;
  name: string;
  service_use: string;
  icon?: string;
  authorization_format?: AuthorizationFormat;
  method_services?: MethodService[];
};

export type FeatureEntity = {
  id: number;
  feature_id: number;
  method_id?: number;
  name: string;
  reference_id: string;
  feature?: FeatureTypeEntity;
  method?: MethodEntity;
  session_time?: number;
  created_by?: AuditUser;
  updated_by?: AuditUser;
  status?: "active" | "draft" | "inactive";
  extra_configurations?: Record<string, unknown>;
};

export type FeatureDetails = FeatureEntity & {
  projects?: string[];
  callback_url?: string;
  authorization_format?: AuthorizationFormat;
  service_configurations?: Array<{
    service_id: number;
    is_enable?: boolean;
    feature_configuration_id: number;
    configurations: MethodServiceConfiguration;
    requirements: MethodServiceRequirement;
  }>;
};

export type BillableMetric = {
  code: string;
  name: string;
  aggregation_type: string;
  expression?: string;
};

export type Tax = {
  code: string;
  name: string;
  value: number;
};

export type Plan = {
  code: string;
  name: string;
  amount_cents: number;
  amount_currency: string;
  interval: string;
};

export type PaymentCredential = {
  provider: string;
  configuration: Record<string, unknown>;
};

export type LogListEntry = {
  _id: string;
  id?: number;
  status_code: number;
  user_ip: string;
  created_at: string;
  updated_at?: string;
  slug?: string;
  endpoint: string;
  request_type: string;
  project_name: string;
  environment_name: string;
  response_time?: string;
  response_time_in_ms?: string;
};

export type LogDetail = {
  id: string;
  request_body: unknown;
  headers: Record<string, unknown> | string;
  response: unknown;
};

export type ProjectEntity = {
  id: number;
  name: string;
  client_id: number;
  created_at: string;
  updated_at: string;
  environments_with_slug?: EnvironmentEntity[];
};

export type EnvironmentEntity = {
  id: number;
  name: string;
  client_id: number;
  created_at: string;
  updated_at: string;
  project_slug?: string;
  projects?: ProjectEntity;
};

export type ClientEntity = {
  id: number;
  name: string;
  mobile: string;
  email: string;
  url_unique_id: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  stage: string;
  settings?: Record<string, unknown>;
};

export type ClientSettings = {
  client: ClientEntity;
  [key: string]: unknown;
};

export type UserEntity = {
  id: number;
  name: string;
  mobile?: string | null;
  email: string;
  client_id?: number;
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  company_name?: string;
  feature_id?: string;
};

export type ClientRole = {
  id: number;
  name: string;
  description?: string;
  c_permissions?: Array<{ id: number; name: string }>;
  feature_configuration_id?: number | null;
  is_default?: boolean;
};

export type ClientPermission = {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
};

export type CreateSourcePayload = {
  data: Array<{ source: string }>;
};
