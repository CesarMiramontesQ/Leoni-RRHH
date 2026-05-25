import { chromium } from 'playwright';

const label = process.argv[2] || 'screenshot';
const outputPath = `tests/e2e/${label}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

// Login as RH
const loginForm = await page.$('#login-form');
if (loginForm) {
  await page.fill('input[name="username"]', 'admin.rh@leoni.com');
  await page.fill('input[name="password"]', 'Leoni2026!RH');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(3000);
}

// Scroll sidebar to bottom to show all items
await page.evaluate(() => {
  const sidebar = document.querySelector('.lg\\:fixed.lg\\:inset-y-0 > div');
  if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
});
await page.waitForTimeout(500);

// Take screenshot of just the sidebar
const sidebar = await page.$('.lg\\:fixed.lg\\:inset-y-0');
if (sidebar) {
  await sidebar.screenshot({ path: outputPath });
} else {
  await page.screenshot({ path: outputPath, fullPage: false });
}
console.log(`Screenshot saved: ${outputPath}`);

await browser.close();
