import type { ApiErrorBody } from "@nailsbychao/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** An error that is safe to show to API clients. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}
