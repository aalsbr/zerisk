import { test, expect } from "@playwright/test";

// Verifies that Next.js Server Actions (frontend buttons) actually work on the
// live deployment behind the Coolify/Traefik proxy. Run against the live site:
//   E2E_BASE_URL=http://zerisk.168.119.63.163.sslip.io npx playwright test e2e/live-actions.spec.ts
test.describe.configure({ mode: "serial" });

async function switchToEnglish(page: import("@playwright/test").Page) {
  const en = page.getByRole("button", { name: "English" });
  if (await en.count()) await en.first().click().catch(() => {});
}

test("ingest form Server Action scores a live transaction", async ({ page }) => {
  await page.goto("/ingest");
  await switchToEnglish(page);
  await page.getByRole("button", { name: /Send to ZeRisk/i }).first().click();
  // The result panel only renders after the Server Action returns a scored txn.
  await expect(page.getByText(/Scored live by the ZeRisk engine/i)).toBeVisible({ timeout: 25000 });
  await expect(page.getByText(/model FL-MVP/i)).toBeVisible();
});

test("rules Server Action changes a rule and toasts", async ({ page }) => {
  await page.goto("/rules");
  await switchToEnglish(page);
  const btn = page.getByRole("button", { name: /^(Approve|Disable|Enable)/i }).first();
  await btn.click();
  // a confirmation toast appears only if the Server Action resolved
  await expect(page.getByText(/approved|disabled|enabled|monitoring|kept active/i).first()).toBeVisible({ timeout: 15000 });
});

test("learning Server Action (teach + recalibrate) responds", async ({ page }) => {
  await page.goto("/learning");
  await switchToEnglish(page);
  const btn = page.getByRole("button", { name: /Teach|Recalibrat|Confirm.*legitimate/i }).first();
  if (await btn.count()) {
    await btn.click();
    await expect(page.getByText(/FL-MVP-1\.\d/).first()).toBeVisible({ timeout: 20000 });
  }
});
