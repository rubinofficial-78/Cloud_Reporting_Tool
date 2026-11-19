export interface AppConfig {
  apiBaseUrl?: string;
  defaultFacilityId?: string;
}

declare global {
  interface Window {
    __CLOUD_REPORTING_CONFIG__?: AppConfig;
  }
}

const apiBaseUrl = (
  window.__CLOUD_REPORTING_CONFIG__?.apiBaseUrl ??
  "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

export interface ApiOptions extends Omit<RequestInit, "body"> {
  token?: string;
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorResponse(
  value: unknown,
): value is { meta?: { message?: string; status?: string } } {
  return typeof value === "object" && value !== null;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<{ data: T; response: Response }> {
  const { token, body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (
    response.status === 401 &&
    token &&
    token === sessionStorage.getItem("cloud-reporting.access-token")
  ) {
    window.dispatchEvent(new Event("staff-session-expired"));
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (
    !response.ok ||
    !isApiErrorResponse(payload) ||
    payload.meta?.status === "error"
  ) {
    const message = isApiErrorResponse(payload)
      ? payload.meta?.message
      : undefined;
    throw new ApiError(
      message || `Request failed (${response.status})`,
      response.status,
    );
  }
  return {
    data: (payload as { data: T }).data,
    response,
  };
}

export async function apiData<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}

export async function apiBlob(
  path: string,
  token: string,
): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (
    response.status === 401 &&
    token === sessionStorage.getItem("cloud-reporting.access-token")
  ) {
    window.dispatchEvent(new Event("staff-session-expired"));
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const message = isApiErrorResponse(payload)
      ? payload.meta?.message
      : undefined;
    throw new ApiError(message || `Unable to load PDF (${response.status})`, response.status);
  }
  return response.blob();
}

export const defaultFacilityId =
  window.__CLOUD_REPORTING_CONFIG__?.defaultFacilityId ?? "";
