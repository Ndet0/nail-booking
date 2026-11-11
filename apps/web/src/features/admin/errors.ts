import { ApiError } from "@/lib/api";

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
};

function fieldLabel(field: string): string {
  return (
    FIELD_LABELS[field] ??
    field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase())
  );
}

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const { fieldErrors, formErrors } = details as {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  const parts: string[] = [];
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) parts.push(`${fieldLabel(field)}: ${message}`);
    }
  }
  if (formErrors) {
    for (const message of formErrors) {
      if (message) parts.push(message);
    }
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Prefer the API's field-level validation text over the generic envelope message. */
export function adminFormError(caught: unknown, fallback: string): string {
  if (!(caught instanceof ApiError)) return fallback;
  return formatValidationDetails(caught.details) ?? caught.message;
}
