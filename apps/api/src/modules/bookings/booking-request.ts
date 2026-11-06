import type { AppointmentLocation } from "@nailsbychao/types";
import { z } from "zod";
import { appointmentLocations } from "../../db/schema";
import { AppError } from "../../utils/errors";

const SLOT_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|15|30|45):00\.000Z$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/** `07…` / `01…`, with or without a `+254` country code. Spaces and dashes are ignored. */
export function normalizeKenyanPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  const match = /^(?:\+254|254|0)([17]\d{8})$/.exec(compact);
  return match ? `+254${match[1]}` : null;
}

export function isCanonicalSlotInstant(value: string): boolean {
  return SLOT_INSTANT.test(value) && new Date(value).toISOString() === value;
}

const optionalText = (max: number, tooLong: string) =>
  z.union([z.literal(""), z.string().trim().max(max, tooLong)]).optional();

const bookingBody = z
  .object({
    serviceId: z.string().trim().min(1, "Choose a service.").max(64),
    startAt: z.string().refine(isCanonicalSlotInstant, "Choose a time on a 15-minute mark."),
    location: z.enum(appointmentLocations),
    customerName: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
    customerPhone: z.string().trim().min(1, "Enter your phone number."),
    customerEmail: optionalText(254, "Email is too long."),
    address: optionalText(200, "Address is too long."),
    customerNotes: optionalText(500, "Notes are too long."),
  })
  .superRefine((value, ctx) => {
    if (normalizeKenyanPhone(value.customerPhone) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "Use a Kenyan phone number, like 0712 345 678.",
      });
    }
    const email = value.customerEmail ?? "";
    if (email && !z.email().safeParse(email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["customerEmail"],
        message: "Use a valid email address.",
      });
    }
    if (value.location === "house_call" && !value.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Enter the address for the house call.",
      });
    }
  });

export type NewBooking = {
  serviceId: string;
  startAt: string;
  location: AppointmentLocation;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: string | null;
  customerNotes: string | null;
  idempotencyKey: string;
};

export function parseCreateBooking(body: unknown, idempotencyKey: string | undefined): NewBooking {
  const key = idempotencyKey?.trim() ?? "";
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new AppError(
      400,
      "validation_error",
      "Send an Idempotency-Key header of 16 to 128 letters, numbers, hyphens, or underscores.",
    );
  }

  const parsed = bookingBody.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "validation_error",
      parsed.error.issues[0]?.message ?? "The request is invalid.",
      z.flattenError(parsed.error),
    );
  }

  const phone = normalizeKenyanPhone(parsed.data.customerPhone);
  if (!phone) {
    throw new AppError(400, "validation_error", "Use a Kenyan phone number, like 0712 345 678.");
  }

  const address = parsed.data.location === "house_call" ? (parsed.data.address ?? "") : null;
  if (parsed.data.location === "house_call" && !address) {
    throw new AppError(400, "validation_error", "Enter the address for the house call.");
  }

  const email = parsed.data.customerEmail ? parsed.data.customerEmail.toLowerCase() : null;

  return {
    serviceId: parsed.data.serviceId,
    startAt: parsed.data.startAt,
    location: parsed.data.location,
    customerName: parsed.data.customerName,
    customerPhone: phone,
    customerEmail: email,
    address,
    customerNotes: parsed.data.customerNotes || null,
    idempotencyKey: key,
  };
}
