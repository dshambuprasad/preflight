// M0 "done when" (10): docker compose up → seed → demo steps 1–2 (01 §5) work in the browser.
// Runs against the compose stack (web on :8080 proxying /v1 to the api). The full demo script lands in M1.
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.PREFLIGHT_SEED_PASSWORD ?? 'demo-pass-1234';

test('demo steps 1–2: operator runs the collections sample and sees 2 blockers · 2 warnings · 1 info', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('ops@demo.preflight');
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/campaigns/);

  await page.getByRole('link', { name: /new check/i }).first().click();
  await expect(page).toHaveURL(/\/campaigns\/new/);
  await page.getByRole('button', { name: /load sample/i }).click();
  await page.getByRole('button', { name: /run pre-flight/i }).click();
  await expect(page).toHaveURL(/\/versions\//, { timeout: 30_000 });

  await expect(page.getByText(/^evaluated$/i).first()).toBeVisible({ timeout: 60_000 });
  const body = page.locator('body');
  await expect(body).toContainText('2 blockers');
  await expect(body).toContainText('2 warnings');
  await expect(body).toContainText('1 info');
  await expect(body).toContainText(
    'Checked 9 of 12 applicable rules. 3 could not be evaluated — history.contactEvents, campaign.template.externalId, platform.templates, platform.messagingLimit.',
  );
  await expect(body).toContainText('A-RBI-001');
  await expect(body).toContainText('20:15 IST');
  await expect(body).toContainText('A-WA-003');
  await expect(body).toContainText('A-RBI-003');
  await expect(body).not.toContainText(/compliant/i);
  await page.screenshot({ path: '__screens__/m0-compose-version-detail.png', fullPage: true });
});
