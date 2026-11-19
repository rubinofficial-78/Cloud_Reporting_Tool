export type ApiStatus = "success" | "error";

export interface ApiResponse<T> {
  meta: {
    status: ApiStatus;
    message: string;
  };
  data: T;
}

export function successResponse<T>(
  data: T,
  message = "Request successful",
): ApiResponse<T> {
  return {
    meta: { status: "success", message },
    data,
  };
}

export function paginatedResponse<T>(
  data: T[],
  message = "Request successful",
): ApiResponse<T[]> {
  return successResponse(data, message);
}

export function failureResponse(
  message: string,
): ApiResponse<Record<string, never>> {
  return {
    meta: { status: "error", message },
    data: {},
  };
}
