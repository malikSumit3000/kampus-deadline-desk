import { expect, test } from "@playwright/test";

const authStorage = process.env.KAMPUS_E2E_AUTH_STORAGE;
test.use({ storageState: authStorage });
test.skip(!authStorage, "Set KAMPUS_E2E_AUTH_STORAGE to a disposable authenticated student session.");

test("student creates, categorizes, progresses, and deletes a private task without navigation", async ({ page }) => {
  const title = `E2E private ${Date.now()}`;
  await page.goto("/");
  const startingUrl = page.url();

  await page.getByRole("button", { name: /add a private deadline/i }).click();
  const form = page.getByRole("button", { name: "Add private deadline" }).locator("xpath=ancestor::form");
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Deadline").fill("2026-08-30T15:30");
  await form.getByLabel("Note").fill("Disposable Playwright verification");
  await form.getByRole("button", { name: "Add private deadline" }).click();
  await expect(page.getByText(title)).toBeVisible();
  expect(page.url()).toBe(startingUrl);

  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByText("Manage task").click();
  await page.getByLabel(/progress for personal deadline/i).selectOption("in progress");
  await expect(page.getByRole("status")).toContainText("Progress saved");
  await page.getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  expect(page.url()).toBe(startingUrl);
});
