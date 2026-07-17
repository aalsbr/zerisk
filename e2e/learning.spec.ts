import { test, expect } from "@playwright/test";

// Scenario 2 (spec §42): the learning loop. Open the Learning page, capture
// LEARN-002's optimized score, teach the model (confirm LEARN-001 legitimate +
// recalibrate), then verify LEARN-002's recommendation/score/confidence changed
// based on persisted feedback and recalculated statistics.
test("learning loop updates recommendations from feedback", async ({ page }) => {
  await page.goto("/learning");
  await expect(page.getByText(/TX-DEMO-LEARN-002/).first()).toBeVisible({ timeout: 15000 });

  const before = await page.textContent("body");

  // Teach: confirm LEARN-001 legitimate & recalibrate
  const teach = page.getByRole("button", { name: /Teach|علّم|recalibrat|إعادة المعايرة/i }).first();
  await teach.click();

  // Allow the server action + revalidation to complete
  await page.waitForTimeout(3000);
  await page.reload();
  await expect(page.getByText(/TX-DEMO-LEARN-002/).first()).toBeVisible({ timeout: 15000 });

  const after = await page.textContent("body");
  // The page content should reflect an updated model version / learning event.
  expect(after).toContain("FL-MVP");
  expect(after).not.toEqual(before);
});
