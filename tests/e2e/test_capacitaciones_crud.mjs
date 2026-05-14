/**
 * Playwright E2E test: Capacitaciones CRUD (RH role)
 *
 * Tests: page load, create, edit, delete, and filters.
 *
 * Usage: node tests/e2e/test_capacitaciones_crud.mjs
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector(
    'input[name="username"], input[type="email"], #login-email',
    { timeout: 10000 }
  );

  const emailInput =
    (await page.$('input[name="username"]')) ||
    (await page.$('input[type="email"]')) ||
    (await page.$("#login-email"));
  const passInput =
    (await page.$('input[name="password"]')) ||
    (await page.$('input[type="password"]')) ||
    (await page.$("#login-password"));

  await emailInput.fill(LOGIN_USER);
  await passInput.fill(LOGIN_PASS);

  const submitBtn =
    (await page.$('button[type="submit"]')) ||
    (await page.$('[data-action="login"]'));
  await submitBtn.click();

  await page.waitForTimeout(3000);
  console.log("  ✓ Login exitoso");
}

async function testPageLoad(page) {
  console.log("\n=== Test: Carga de pagina ===");
  await page.goto(`${BASE}/#/capacitaciones`);
  await page.waitForTimeout(2000);

  // Check heading
  const heading = await page.$("h1");
  const headingText = heading ? await heading.textContent() : "";
  assert(
    headingText.includes("Capacitaciones"),
    'Heading "Capacitaciones" visible'
  );

  // Check "Nueva capacitacion" button
  const newBtn = await page.$('[data-action="open-create"]');
  assert(newBtn !== null, 'Boton "Nueva capacitacion" visible');
}

async function testCreateCapacitacion(page) {
  console.log("\n=== Test: Crear capacitacion ===");

  // Click "Nueva capacitacion"
  const newBtn = await page.$('[data-action="open-create"]');
  assert(newBtn !== null, "Boton crear encontrado");
  await newBtn.click();
  await page.waitForTimeout(500);

  // Verify modal opened
  const form = await page.$('form[data-action="submit-cap"]');
  assert(form !== null, "Modal de creacion abierto");

  // Fill form
  await page.fill('input[name="nombre"]', "Seguridad Industrial E2E");
  await page.fill('textarea[name="descripcion"]', "Test E2E");
  await page.selectOption('select[name="modalidad"]', "presencial");
  await page.fill('input[name="duracion_horas"]', "16");
  await page.fill('input[name="instructor"]', "Juan Perez");
  await page.fill('input[name="cupo_maximo"]', "25");

  // Fill required date fields
  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  await page.fill('input[name="fecha_inicio"]', startDate);
  await page.fill('input[name="fecha_fin"]', endDate);

  // Submit
  const submitBtn = await page.$(
    'form[data-action="submit-cap"] button[type="submit"]'
  );
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Verify it appears in the list
  const cards = await page.$$("h3.text-sm.font-semibold");
  const names = await Promise.all(cards.map((c) => c.textContent()));
  const found = names.some((n) => n.includes("Seguridad Industrial E2E"));
  assert(found, 'Capacitacion "Seguridad Industrial E2E" aparece en la lista');
}

async function testSearchCapacitacion(page) {
  console.log("\n=== Test: Buscar capacitacion ===");

  // Use search filter
  const searchInput = await page.$('[data-action="filter-search"]');
  assert(searchInput !== null, "Campo de busqueda encontrado");
  await searchInput.fill("Seguridad Industrial E2E");
  await page.waitForTimeout(1000); // debounce

  const cards = await page.$$("h3.text-sm.font-semibold");
  const names = await Promise.all(cards.map((c) => c.textContent()));
  const found = names.some((n) => n.includes("Seguridad Industrial E2E"));
  assert(found, "Busqueda encuentra la capacitacion creada");

  // Clear search
  await searchInput.fill("");
  await page.waitForTimeout(1000);
}

async function testEditCapacitacion(page) {
  console.log("\n=== Test: Editar capacitacion ===");

  // First search for our capacitacion to isolate it
  const searchInput = await page.$('[data-action="filter-search"]');
  await searchInput.fill("Seguridad Industrial E2E");
  await page.waitForTimeout(1000);

  // Click edit button
  const editBtn = await page.$('[data-action="edit-cap"]');
  assert(editBtn !== null, "Boton editar encontrado");
  await editBtn.click();
  await page.waitForTimeout(500);

  // Verify modal opened with current data
  const nombreInput = await page.$('input[name="nombre"]');
  const currentValue = await nombreInput.inputValue();
  assert(
    currentValue === "Seguridad Industrial E2E",
    "Modal muestra nombre actual"
  );

  // Change name
  await nombreInput.fill("");
  await nombreInput.fill("Seguridad Industrial Avanzada");

  // Submit
  const submitBtn = await page.$(
    'form[data-action="submit-cap"] button[type="submit"]'
  );
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Clear search and search for updated name
  const searchInput2 = await page.$('[data-action="filter-search"]');
  await searchInput2.fill("Seguridad Industrial Avanzada");
  await page.waitForTimeout(1000);

  // Verify updated name appears
  const cards = await page.$$("h3.text-sm.font-semibold");
  const names = await Promise.all(cards.map((c) => c.textContent()));
  const found = names.some((n) => n.includes("Seguridad Industrial Avanzada"));
  assert(found, 'Nombre actualizado a "Seguridad Industrial Avanzada"');

  // Clear search
  await searchInput2.fill("");
  await page.waitForTimeout(1000);
}

async function testDeleteCapacitacion(page) {
  console.log("\n=== Test: Eliminar capacitacion ===");

  // Search for our capacitacion
  const searchInput = await page.$('[data-action="filter-search"]');
  await searchInput.fill("Seguridad Industrial Avanzada");
  await page.waitForTimeout(1000);

  // Set up dialog handler to accept confirm
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  // Click delete button
  const deleteBtn = await page.$('[data-action="delete-cap"]');
  assert(deleteBtn !== null, "Boton eliminar encontrado");
  await deleteBtn.click();
  await page.waitForTimeout(2000);

  // Verify it no longer appears
  const cards = await page.$$("h3.text-sm.font-semibold");
  const names = await Promise.all(cards.map((c) => c.textContent()));
  const found = names.some((n) =>
    n.includes("Seguridad Industrial Avanzada")
  );
  assert(!found, "Capacitacion eliminada ya no aparece en la lista");

  // Clear search
  await searchInput.fill("");
  await page.waitForTimeout(1000);
}

async function testFilters(page) {
  console.log("\n=== Test: Filtros por modalidad ===");

  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Create capacitacion presencial
  const newBtn1 = await page.$('[data-action="open-create"]');
  await newBtn1.click();
  await page.waitForTimeout(500);

  await page.fill('input[name="nombre"]', "Cap Presencial E2E Filter");
  await page.fill('textarea[name="descripcion"]', "Test filtro presencial");
  await page.selectOption('select[name="modalidad"]', "presencial");
  await page.fill('input[name="duracion_horas"]', "8");
  await page.fill('input[name="fecha_inicio"]', startDate);
  await page.fill('input[name="fecha_fin"]', endDate);

  const submit1 = await page.$(
    'form[data-action="submit-cap"] button[type="submit"]'
  );
  await submit1.click();
  await page.waitForTimeout(2000);

  // Create capacitacion online
  const newBtn2 = await page.$('[data-action="open-create"]');
  await newBtn2.click();
  await page.waitForTimeout(500);

  await page.fill('input[name="nombre"]', "Cap Online E2E Filter");
  await page.fill('textarea[name="descripcion"]', "Test filtro online");
  await page.selectOption('select[name="modalidad"]', "online");
  await page.fill('input[name="duracion_horas"]', "4");
  await page.fill('input[name="fecha_inicio"]', startDate);
  await page.fill('input[name="fecha_fin"]', endDate);

  const submit2 = await page.$(
    'form[data-action="submit-cap"] button[type="submit"]'
  );
  await submit2.click();
  await page.waitForTimeout(2000);

  // Filter by presencial
  const modalidadFilter = await page.$('[data-action="filter-modalidad"]');
  assert(modalidadFilter !== null, "Filtro de modalidad encontrado");
  await modalidadFilter.selectOption("presencial");
  await page.waitForTimeout(1500);

  let cards = await page.$$("h3.text-sm.font-semibold");
  let names = await Promise.all(cards.map((c) => c.textContent()));
  const hasPresencial = names.some((n) =>
    n.includes("Cap Presencial E2E Filter")
  );
  const hasOnlineWhenPresencial = names.some((n) =>
    n.includes("Cap Online E2E Filter")
  );
  assert(
    hasPresencial,
    "Filtro presencial muestra capacitacion presencial"
  );
  assert(
    !hasOnlineWhenPresencial,
    "Filtro presencial oculta capacitacion online"
  );

  // Filter by online
  await modalidadFilter.selectOption("online");
  await page.waitForTimeout(1500);

  cards = await page.$$("h3.text-sm.font-semibold");
  names = await Promise.all(cards.map((c) => c.textContent()));
  const hasOnline = names.some((n) => n.includes("Cap Online E2E Filter"));
  const hasPresencialWhenOnline = names.some((n) =>
    n.includes("Cap Presencial E2E Filter")
  );
  assert(hasOnline, "Filtro online muestra capacitacion online");
  assert(
    !hasPresencialWhenOnline,
    "Filtro online oculta capacitacion presencial"
  );

  // Reset filter
  await modalidadFilter.selectOption("");
  await page.waitForTimeout(1500);

  // Cleanup: delete both test capacitaciones
  console.log("\n=== Cleanup: Eliminar capacitaciones de filtro ===");

  // Delete presencial
  const searchInput = await page.$('[data-action="filter-search"]');
  await searchInput.fill("Cap Presencial E2E Filter");
  await page.waitForTimeout(1000);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const delBtn1 = await page.$('[data-action="delete-cap"]');
  if (delBtn1) {
    await delBtn1.click();
    await page.waitForTimeout(1500);
  }

  // Delete online
  await searchInput.fill("Cap Online E2E Filter");
  await page.waitForTimeout(1000);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const delBtn2 = await page.$('[data-action="delete-cap"]');
  if (delBtn2) {
    await delBtn2.click();
    await page.waitForTimeout(1500);
  }

  // Clear search
  await searchInput.fill("");
  await page.waitForTimeout(500);

  console.log("  ✓ Cleanup completado");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log("=== Test: Login ===");
    await login(page);

    await testPageLoad(page);
    await testCreateCapacitacion(page);
    await testSearchCapacitacion(page);
    await testEditCapacitacion(page);
    await testDeleteCapacitacion(page);
    await testFilters(page);

    console.log("\n========================================");
    console.log(`${passed} passed, ${failed} failed`);
    console.log("========================================");
  } catch (err) {
    console.error("Error:", err.message);
    await page.screenshot({
      path: "tests/e2e/error-screenshot-cap-crud.png",
    });
    console.error(
      "Screenshot guardado en tests/e2e/error-screenshot-cap-crud.png"
    );
  } finally {
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
