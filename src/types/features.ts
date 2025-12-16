export type FieldConfig = Record<string, unknown> & {
  type?: string;
  label?: string;
  placeholder?: string;
  is_required?: boolean;
  is_disable?: boolean;
  is_hidden?: boolean;
  regex?: string;
  hint?: string;
  info?: string;
  value?: string;
  delimiter?: string;
  allowed_types?: string;
  source?: string[];
  sourceFieldLabel?: string[];
  sourceFieldValue?: string[];
  filter_conditions?: Array<{
    when?: { field?: string; equals?: string };
    allowed_values?: string[];
    hide?: boolean;
  }>;
};

export type FieldState = {
  value: string;
  chips: string[];
  file?: File | null;
  touched: boolean;
  error: string | null;
};

export type FieldGroupState = Record<string, FieldState>;

export type ServiceFormState = {
  isEnabled: boolean;
  requirements: FieldGroupState;
  configurations: FieldGroupState;
};

export type FieldGroupKey = "requirements" | "configurations";

export type EditTab = "service" | "settings" | "design";

