import type { ApiSuccess, AvailabilityDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { STUDIO } from "../../config/studio";
import { createDb } from "../../db/client";
import { appointmentLocations } from "../../db/schema";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { addDays, isCalendarDate, localToUtc } from "../../utils/studio-time";
import { getActiveServiceById } from "../services/services.repository";
import { bookingWindow, computeSlots, unionSlots } from "./availability.engine";
import {
  getReservedSlots,
  getTimeOff,
  getWorkingPeriods,
  listEligibleStaffIds,
} from "./availability.repository";

const availabilityQuery = z.object({
  serviceId: z.string().trim().min(1).max(64),
  date: z.string().refine(isCalendarDate, "Use a real date in YYYY-MM-DD format."),
  location: z.enum(appointmentLocations).default("studio"),
});

export const availabilityRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", availabilityQuery),
  async (c) => {
    const { serviceId, date, location } = c.req.valid("query");
    const now = new Date();

    const { firstDate, lastDate } = bookingWindow(now);
    if (date < firstDate || date > lastDate) {
      throw new AppError(
        400,
        "date_out_of_range",
        `Choose a date between ${firstDate} and ${lastDate}.`,
      );
    }

    const db = createDb(c.env.DB);
    const service = await getActiveServiceById(db, serviceId);
    if (!service) {
      throw new AppError(404, "service_not_found", "This service is not available.");
    }

    const dayStart = localToUtc(date, "00:00", STUDIO.timezone);
    const dayEnd = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone);
    const staffIds = await listEligibleStaffIds(db, serviceId);

    const perStaff = await Promise.all(
      staffIds.map(async (staffId) => {
        const [workingPeriods, timeOff, reservedSlots] = await Promise.all([
          getWorkingPeriods(db, staffId, date),
          getTimeOff(db, staffId, dayStart, dayEnd),
          getReservedSlots(db, staffId, dayStart, dayEnd),
        ]);
        return computeSlots({
          date,
          durationMinutes: service.durationMinutes,
          location,
          workingPeriods,
          timeOff,
          reservedSlots,
          now,
        });
      }),
    );

    const data: AvailabilityDto = {
      serviceId,
      date,
      location,
      timezone: STUDIO.timezone,
      lastBookableDate: lastDate,
      slots: unionSlots(perStaff),
    };
    return c.json({ data } satisfies ApiSuccess<AvailabilityDto>);
  },
);
