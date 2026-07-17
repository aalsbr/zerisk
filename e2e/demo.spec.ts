import { test, expect } from "@playwright/test";

// Scenario 1 (spec §42): open the app, find the strong-FP demo transaction,
// verify the original decision + optimized recommendation + explainability, then
// walk the Financial Impact and Demo Story pages. Asserts no console errors.
test("ZeRisk demo walkthrough", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");
  await expect(page).toHaveTitle(/ZeRisk/);

  // Live Transactions → search for the fixed demo FP transaction
  await page.goto("/transactions?q=TX-DEMO-FP-001");
  await expect(page.getByText("TX-DEMO-FP-001").first()).toBeVisible({ timeout: 15000 });

  // Open the transaction analysis
  await page.goto("/transactions/TX-DEMO-FP-001");
  await expect(page.getByText(/REJECT|رفض/).first()).toBeVisible();
  // optimized recommendation + explainability present
  await expect(page.getByText(/APPROVE|موافقة/).first()).toBeVisible();

  // Financial impact page renders computed values
  await page.goto("/financial");
  await expect(page.getByText(/SAR|ريال/).first()).toBeVisible({ timeout: 15000 });

  // Demo Story mode steps through
  await page.goto("/demo");
  await expect(page.getByText("TX-DEMO-FP-001").first()).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 4; i++) {
    const next = page.getByRole("button", { name: /Next step|الخطوة التالية/ });
    if (await next.isEnabled()) await next.click();
  }

  expect(errors, `console errors: ${errors.join("\n")}`).toHaveLength(0);
});
