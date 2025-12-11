export type ApiErrorPayload = string | string[] | Record<string, string[]> | Record<string, unknown>;

export type ApiResponse<T, TRequest = unknown> = {
  data: T;
  status: "success" | "fail";
  hasError: boolean;
  errors?: ApiErrorPayload;
  request?: TRequest;
  queryString?: unknown;
};

export type PaginatedResponse<T> = {
  data: T;
  itemsPerPage: number;
  pageNumber: number;
  pageNo?: number;
  totalEntityCount: number;
  totalEntityCountWithoutFilter?: number;
  totalPageCount: number;
};

export class ProxyApiError<T = unknown> extends Error {
  public readonly payload?: ApiResponse<T>;
  public readonly status?: number;

  constructor(message: string, payload?: ApiResponse<T>, status?: number) {
    super(message);
    this.name = "ProxyApiError";
    this.payload = payload;
    this.status = status;
  }
}

export function resolveApiErrors(errors?: ApiErrorPayload): string[] {
  if (!errors) {
    return [];
  }

  if (typeof errors === "string") {
    return [errors];
  }

  if (Array.isArray(errors)) {
    return errors.map((message) => String(message));
  }

  if (typeof errors === "object") {
    const messages: string[] = [];
    Object.values(errors).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => messages.push(String(entry)));
      } else if (typeof value === "string") {
        messages.push(value);
      }
    });
    return messages.length ? messages : ["Something went wrong."];
  }

  return ["Something went wrong."];
}
