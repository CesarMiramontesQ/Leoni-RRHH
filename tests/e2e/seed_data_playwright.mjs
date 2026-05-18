/**
 * Playwright E2E script: Creates 10 Perfiles de Puesto + 20 Evaluaciones
 * with random data via the UI (not API).
 *
 * Usage: npx playwright test tests/e2e/seed_data_playwright.mjs
 *   or:  node tests/e2e/seed_data_playwright.mjs  (runs via playwright's test runner)
 *
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

const PUESTO_NAMES = [
  "Operador de Producción N1",
  "Técnico de Mantenimiento",
  "Analista de Calidad",
  "Coordinador de Logística",
  "Especialista en Seguridad Industrial",
  "Ingeniero de Procesos",
  "Líder de Turno",
  "Planeador de Materiales",
  "Auditor Interno",
  "Supervisor de Almacén",
];

const NIVELES = ["operativo", "mando_medio", "gerencial", "directivo"];

const OBSERVACIONES = [
  "Buen desempeño general",
  "Necesita capacitación adicional",
  "Supera expectativas en esta competencia",
  "Área de oportunidad identificada",
  "Evaluado durante auditoría interna",
  "Requiere seguimiento mensual",
  "Desempeño consistente",
  "Mejora notable respecto al periodo anterior",
  "",
  "Evaluación inicial",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('input[name="username"], input[type="email"], #login-email', { timeout: 10000 });

  const emailInput = await page.$('input[name="username"]') ||
    await page.$('input[type="email"]') ||
    await page.$('#login-email');
  const passInput = await page.$('input[name="password"]') ||
    await page.$('input[type="password"]') ||
    await page.$('#login-password');

  await emailInput.fill(LOGIN_USER);
  await passInput.fill(LOGIN_PASS);

  const submitBtn = await page.$('button[type="submit"]') ||
    await page.$('[data-action="login"]');
  await submitBtn.click();

  await page.waitForTimeout(3000);
  console.log("✓ Login exitoso");
}

async function createPerfilesDePuesto(page) {
  console.log("\n=== Creando 10 Perfiles de Puesto ===");
  await page.goto(`${BASE}/#/puestos`);
  await sleep(2000);

  for (let i = 0; i < 10; i++) {
    const nombre = PUESTO_NAMES[i];
    const nivel = randomItem(NIVELES);

    // Click "Nuevo Perfil" button
    const newBtn = await page.$('[data-action="open-modal"], button:has-text("Nuevo"), button:has-text("Crear")');
    if (!newBtn) {
      console.error(`  ✗ No se encontró botón para crear perfil #${i + 1}`);
      continue;
    }
    await newBtn.click();
    await sleep(500);

    // Fill the form
    const nombreInput = await page.$('#puestos-modal-nombre, input[name="nombre_puesto"]');
    if (nombreInput) {
      await nombreInput.fill(nombre);
    }

    // Select area (pick a random one from available options)
    const areaSelect = await page.$('#puestos-modal-area, select[name="area"]');
    if (areaSelect) {
      const options = await areaSelect.$$('option[value]:not([value=""])');
      if (options.length > 0) {
        const opt = options[Math.floor(Math.random() * options.length)];
        const val = await opt.getAttribute("value");
        await areaSelect.selectOption(val);
      }
    }

    // Select nivel
    const nivelSelect = await page.$('#puestos-modal-nivel, select[name="nivel"]');
    if (nivelSelect) {
      await nivelSelect.selectOption(nivel);
    }

    // Submit
    const submitBtn = await page.$('button[type="submit"], [data-action="modal-form"] button:last-of-type');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      // Try form submission via keyboard
      await page.keyboard.press("Enter");
    }

    await sleep(1500);
    console.log(`  ✓ Perfil #${i + 1}: "${nombre}" (${nivel})`);
  }
}

async function createEvaluaciones(page) {
  console.log("\n=== Creando 20 Evaluaciones de Competencia ===");
  await page.goto(`${BASE}/#/evaluaciones`);
  await sleep(2000);

  for (let i = 0; i < 20; i++) {
    // Click "Nueva evaluación" button
    const newBtn = await page.$('[data-action="open-modal"]');
    if (!newBtn) {
      console.error(`  ✗ No se encontró botón para crear evaluación #${i + 1}`);
      break;
    }
    await newBtn.click();
    await sleep(600);

    // Search-select: Empleado
    const empSearchInput = await page.$('[data-searchselect="empleado_id"] input[data-action="search-empleado_id"]');
    if (empSearchInput) {
      await empSearchInput.click();
      await sleep(300);
      // Pick a random employee from the visible list
      const empDropdown = await page.$('[data-dropdown="empleado_id"]');
      if (empDropdown) {
        const empItems = await empDropdown.$$('li:not(.hidden)');
        if (empItems.length > 0) {
          const pick = empItems[Math.floor(Math.random() * Math.min(empItems.length, 50))];
          await pick.click();
          await sleep(200);
        }
      }
    }

    // Search-select: Competencia
    const compSearchInput = await page.$('[data-searchselect="competencia_id"] input[data-action="search-competencia_id"]');
    if (compSearchInput) {
      await compSearchInput.click();
      await sleep(300);
      const compDropdown = await page.$('[data-dropdown="competencia_id"]');
      if (compDropdown) {
        const compItems = await compDropdown.$$('li:not(.hidden)');
        if (compItems.length > 0) {
          const pick = compItems[Math.floor(Math.random() * compItems.length)];
          await pick.click();
          await sleep(200);
        }
      }
    }

    // Select nivel (0-4 random)
    const nivelRandom = Math.floor(Math.random() * 5);
    const nivelSelect = await page.$('select[name="nivel_actual"]');
    if (nivelSelect) {
      await nivelSelect.selectOption(String(nivelRandom));
    }

    // Observaciones (optional, random)
    const obs = randomItem(OBSERVACIONES);
    if (obs) {
      const obsTextarea = await page.$('textarea[name="observaciones"]');
      if (obsTextarea) {
        await obsTextarea.fill(obs);
      }
    }

    // Submit
    const submitBtn = await page.$('[data-action="submit-eval"] button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await sleep(1500);
    console.log(`  ✓ Evaluación #${i + 1}: nivel=${nivelRandom}${obs ? ` — "${obs.substring(0, 30)}..."` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await createPerfilesDePuesto(page);
    await createEvaluaciones(page);

    console.log("\n========================================");
    console.log("✓ Seed completado: 10 perfiles + 20 evaluaciones");
    console.log("========================================");
  } catch (err) {
    console.error("Error:", err.message);
    await page.screenshot({ path: "tests/e2e/error-screenshot.png" });
    console.error("Screenshot guardado en tests/e2e/error-screenshot.png");
  } finally {
    await sleep(3000);
    await browser.close();
  }
}

main();
