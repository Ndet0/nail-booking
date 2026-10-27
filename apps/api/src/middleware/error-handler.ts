import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { AppError, errorBody } from "../utils/errors";

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  if (err instanceof HTTPException) {
    return c.json(errorBody("http_error", err.message || "Request failed"), err.status);
  }
  // Unexpected: log server-side with the request id, never leak internals to the client.
  console.error("Unhandled error", { requestId: c.get("requestId"), error: err });
  return c.json(errorBody("internal_error", "Something went wrong. Please try again."), 500);
};

export const notFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorBody("not_found", "The requested resource was not found."), 404);
