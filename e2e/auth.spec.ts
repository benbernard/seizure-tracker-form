import { expect, test } from "@playwright/test";

test("sign-in page renders", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("Sign in").first()).toBeVisible();
});

test("settings redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForURL(/\/sign-in/);
  expect(page.url()).toContain("/sign-in");
});
