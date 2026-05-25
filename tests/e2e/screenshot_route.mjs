import { chromium } from 'playwright';

const route = process.argv[2] || '#/capacidades';
const label = process.argv[3] || 'route';
const outputPath = `tests/e2e/${label}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`http://localhost:5173/${route}`);
await page.waitForTimeout(2000);

// Login as RH
const loginForm = await page.$('#login-form');
if (loginForm) {
  await page.fill('input[name="username"]', 'admin.rh@leoni.com');
  await page.fill('input[name="password"]', 'Leoni2026!RH');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(3000);
  // After login, navigate to target
  await page.evaluate((r) => { window.location.hash = r; }, route);
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: outputPath, fullPage: false });
console.log(`Screenshot saved: ${outputPath}`);

await browser.close();
