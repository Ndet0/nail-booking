import { type APIRequestContext, expect, type Page } from "@playwright/test";

const SERVICE_ID = "svc_removal";

export async function createStudioBooking(
  request: APIRequestContext,
  customerName: string,
): Promise<void> {
  const date = await firstDateWithSlots(request);
  const availability = await request.get("/api/v1/availability", {
    params: { serviceId: SERVICE_ID, date, location: "studio" },
  });
  expect(availability.ok()).toBeTruthy();
  const body = (await availability.json()) as { data: { slots: { startAt: string }[] } };
  const startAt = body.data.slots[0]?.startAt;
  expect(startAt).toBeTruthy();

  const created = await request.post("/api/v1/bookings", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      serviceId: SERVICE_ID,
      startAt,
      location: "studio",
      customerName,
      customerPhone: "0712 345 678",
    },
  });
  expect(created.status()).toBe(201);
}

async function firstDateWithSlots(request: APIRequestContext): Promise<string> {
  let date = nairobiToday();
  for (let offset = 0; offset < 21; offset += 1) {
    const availability = await request.get("/api/v1/availability", {
      params: { serviceId: SERVICE_ID, date, location: "studio" },
    });
    if (availability.ok()) {
      const body = (await availability.json()) as { data: { slots: unknown[] } };
      if (body.data.slots.length > 0) return date;
    }
    date = addDays(date, 1);
  }
  throw new Error("No studio slot for Removal in the next 21 days.");
}

function nairobiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10);
}

/** Picks the studio location and the first open time, moving to a later day if needed. */
export async function chooseStudioTime(page: Page): Promise<void> {
  // The radios are visually hidden. Click the visible label text.
  await page.getByText("House call", { exact: true }).click();
  await page.getByText("At the studio", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /^At the studio/ })).toBeChecked();

  // A later month keeps the appointment outside the 24-hour change window.
  await page.getByRole("button", { name: "Next month" }).click();
  await page
    .getByRole("group", { name: "Choose a day" })
    .locator("button:not([disabled])")
    .first()
    .click();
  await expect(page.getByRole("list", { name: "Loading times" })).toBeHidden();

  const time = page.getByRole("group", { name: "Choose a time" }).getByRole("button").first();
  await time.click();
  await expect(time).toHaveAttribute("aria-pressed", "true");
}
