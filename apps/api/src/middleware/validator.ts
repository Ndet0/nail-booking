import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";
import { AppError } from "../utils/errors";

const FIELD_LABELS: Record<string, string> = {
  slug: "Slug",
  name: "Name",
  description: "Description",
  category: "Category",
  durationMinutes: "Duration",
  priceMinor: "Price",
  currency: "Currency",
  isActive: "Active",
  displayOrder: "Display order",
  bio: "Bio",
  serviceIds: "Services",
  hours: "Hours",
  weekday: "Weekday",
  startTime: "Start time",
  endTime: "End time",
  effectiveFrom: "Effective from",
  effectiveUntil: "Effective until",
  staffId: "Staff",
  startDate: "Start date",
  endDate: "End date",
  reason: "Reason",
  title: "Title",
  altText: "Alt text",
  isPublished: "Published",
};

function fieldLabel(path: PropertyKey[]): string | undefined {
  for (const part of path) {
    if (typeof part === "string" && part.length > 0) {
      return (
        FIELD_LABELS[part] ??
        part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase())
      );
    }
  }
  return undefined;
}

function zodErrorMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (!issue) return "The request is invalid.";
  const label = fieldLabel(issue.path);
  return label ? `${label}: ${issue.message}` : issue.message;
}

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
        zodErrorMessage(result.error),
        z.flattenError(result.error),
      );
    }
  });
}
