import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:5173/');
await page.waitForTimeout(2000);

const loginForm = await page.$('#login-form');
if (loginForm) {
  await page.fill('input[name="username"]', 'admin.rh@leoni.com');
  await page.fill('input[name="password"]', 'Leoni2026!RH');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(3000);
}

await page.evaluate(() => { window.location.hash = '#/puestos'; });
await page.waitForTimeout(2000);

// AFTER - card view (new default)
await page.screenshot({ path: 'tests/e2e/puestos_after_cards.png', fullPage: false });

// AFTER - table view (toggle)
await page.click('[data-action="view-tabla"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/e2e/puestos_after_tabla.png', fullPage: false });

console.log('After screenshots done');
await browser.close();
