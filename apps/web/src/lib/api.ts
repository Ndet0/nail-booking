import type { ApiErrorBody, ApiSuccess } from "@nailsbychao/types";

const API_BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/v1`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const { auth, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: auth ? "include" : "same-origin",
      headers: { Accept: "application/json", ...rest.headers },
    });
  } catch {
    throw new ApiError(0, "network_error", "We couldn't reach the server. Check your connection.");
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiErrorBody | null;

  if (!response.ok || !body || !("data" in body)) {
    const error = body && "error" in body ? body.error : undefined;
    throw new ApiError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details,
    );
  }
  return body.data;
}
