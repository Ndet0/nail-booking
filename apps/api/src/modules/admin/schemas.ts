import { z } from "zod";
import { appointmentStatuses } from "../../db/schema";
import { isCalendarDate } from "../../utils/studio-time";
import { normalizeSlug } from "./slug";

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
const calendarDate = z.string().refine(isCalendarDate, "Use a real date in YYYY-MM-DD format.");

export const idParam = z.object({
  id: z.string().trim().min(1).max(80),
});

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(500).optional(),
});

export const bookingListQuery = pageQuery.extend({
  status: z.enum(appointmentStatuses).optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

export const statusBody = z.object({
  status: z.enum(appointmentStatuses),
});

const serviceFields = {
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .transform(normalizeSlug)
    .pipe(
      z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
    ),
  description: z.string().trim().max(500).nullable(),
  category: z.enum(["nails", "makeup"]),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  priceMinor: z.number().int().nonnegative().max(10_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  isActive: z.boolean(),
  displayOrder: z.number().int().min(0).max(10_000),
};

export const serviceCreateBody = z.object({
  ...serviceFields,
  description: serviceFields.description.nullable().default(null),
  currency: serviceFields.currency.default("KES"),
  isActive: serviceFields.isActive.default(true),
  displayOrder: serviceFields.displayOrder.default(0),
});

export const servicePatchBody = z
  .object(serviceFields)
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field to update.",
  });

const staffFields = {
  name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(500).nullable(),
  isActive: z.boolean(),
};

export const staffCreateBody = z.object({
  ...staffFields,
  bio: staffFields.bio.nullable().default(null),
  isActive: staffFields.isActive.default(true),
});

export const staffPatchBody = z
  .object(staffFields)
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field to update.",
  });

export const staffServicesBody = z.object({
  serviceIds: z.array(z.string().trim().min(1).max(80)).max(100),
});

const hoursItem = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: localTime,
    endTime: localTime,
    effectiveFrom: calendarDate,
    effectiveUntil: calendarDate.nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after the start time.",
  })
  .refine((value) => value.effectiveUntil === null || value.effectiveUntil >= value.effectiveFrom, {
    message: "The effective end date must be on or after the start date.",
  });

export const hoursBody = z.object({
  hours: z.array(hoursItem).max(42),
});

export const calendarQuery = z.object({
  staffId: z.string().trim().min(1).max(80),
  from: calendarDate,
  to: calendarDate,
});

export const calendarClosureBody = z.object({
  staffId: z.string().trim().min(1).max(80),
  date: calendarDate,
});

export const calendarClosureQuery = z.object({
  staffId: z.string().trim().min(1).max(80),
  date: calendarDate,
});

export const timeOffListQuery = pageQuery.extend({
  staffId: z.string().trim().min(1).max(80).optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

export const timeOffBody = z
  .object({
    staffId: z.string().trim().min(1).max(80),
    startDate: calendarDate,
    startTime: localTime,
    endDate: calendarDate,
    endTime: localTime,
    reason: z.string().trim().max(200).nullable().default(null),
  })
  .refine(
    (value) =>
      value.endDate > value.startDate ||
      (value.endDate === value.startDate && value.endTime > value.startTime),
    { message: "Time off must end after it starts." },
  );

const galleryText = {
  title: z.string().trim().min(1).max(80).nullable(),
  description: z.string().trim().max(500).nullable(),
  altText: z.string().trim().min(1).max(200),
  displayOrder: z.number().int().min(0).max(10_000),
  isPublished: z.boolean(),
};

export const galleryPatchBody = z
  .object(galleryText)
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field to update.",
  });
