import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";
import { AppError } from "../utils/errors";

/** zValidator that responds with the standard error envelope. */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError(
        400,
        "validation_error",
        "The request is invalid.",
        z.flattenError(result.error),
      );
    }
  });
}
