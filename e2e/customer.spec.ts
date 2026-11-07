import { expect, test } from "@playwright/test";
import { chooseStudioTime } from "./booking";

test("customer books, looks up, moves, and cancels", async ({ page }) => {
  const name = "E2E Customer";
  const phone = "0712 345 678";

  await page.goto("/");
  await page.getByRole("link", { name: "Book an appointment" }).click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  await expect(page.getByText("Gel Polish (Natural Nails)")).toBeVisible();
  await page.getByRole("link", { name: "Book Removal" }).click();

  await expect(page.getByRole("heading", { name: "Removal" })).toBeVisible();
  await chooseStudioTime(page);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Phone").fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: "Request booking" }).click();

  await expect(page.getByRole("heading", { name: "Booking requested" })).toBeVisible();
  const reference = (await page.locator("dd").first().textContent())?.trim() ?? "";
  expect(reference).toMatch(/^NBC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);

  await page.goto("/manage");
  await page.getByLabel("Booking reference").fill(reference);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Find booking" }).first().click();
  await expect(page.getByRole("heading", { name: reference })).toBeVisible();

  const when = page.locator("dd").filter({ hasText: "Nairobi time" });
  const before = (await when.textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "Move this booking" }).click();
  const moveTimes = page.getByRole("group", { name: "Choose a time" }).getByRole("button");
  await expect(moveTimes.first()).toBeVisible();
  await moveTimes.first().click();
  await page.getByRole("button", { name: /^Move to / }).click();
  await expect(page.getByText("This booking has already been moved once.")).toBeVisible();
  await expect(when).not.toHaveText(before);

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByText("Cancelled. This time is free for someone else.")).toBeVisible();
});
