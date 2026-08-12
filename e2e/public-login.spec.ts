import { expect, test } from "@playwright/test";

test("unauthenticated visitors reach the Google-only login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Your deadlines, personally organised." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByText("Gmail access is optional")).toBeVisible();
});
