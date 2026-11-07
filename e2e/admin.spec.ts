import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./admin";
import { createStudioBooking } from "./booking";

test("administrator manages a booking, services, staff, and the calendar", async ({
  page,
  request,
}) => {
  const name = `E2E Admin ${Date.now()}`;
  await createStudioBooking(request, name);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NBC-");
  await page.getByRole("button", { name: "Mark confirmed" }).click();
  await expect(page.getByRole("status")).toHaveText("Status updated.");

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Services" })
    .click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  await expect(page.getByText("Gel Polish (Natural Nails)")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Staff" })
    .click();
  await expect(page.getByRole("heading", { name: "Weekly hours (Nairobi)" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Staff member" })).toContainText("Chao");

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Calendar" })
    .click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText("Sundays stay closed from the weekly hours.")).toBeVisible();
});
