import { expect, test } from "@playwright/test";

test("landing page shows sign-in call to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Seizure Tracker")).toBeVisible();
  await expect(page.getByText("Sign in")).toBeVisible();
});

test("public patient page returns 404 for unknown patient", async ({
  page,
}) => {
  await page.goto("/p/unknown-patient");
  await expect(page.getByText("404")).toBeVisible();
});
