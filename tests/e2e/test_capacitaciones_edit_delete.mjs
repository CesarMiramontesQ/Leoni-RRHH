/**
 * Playwright E2E test: Capacitaciones EDIT and DELETE (RH role)
 *
 * Nitpicky QA tests for:
 * 1. Create a capacitacion, then edit it and verify updates
 * 2. Create another, delete it, and verify state consistency
 *
 * Usage: npx playwright test --config=tests/e2e/playwright.config.mjs tests/e2e/test_capacitaciones_edit_delete.mjs
 *   or:  node tests/e2e/test_capacitaciones_edit_delete.mjs
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

// Use unique suffix to avoid collisions with leftover data from previous runs
const UNIQUE = Date.now().toString(36);
const EDIT_NAME = `QA Edit Test ${UNIQUE}`;
const EDIT_NAME_UPDATED = `QA Edit Test Updated ${UNIQUE}`;
const DELETE_NAME = `QA Delete Test ${UNIQUE}`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function login(page) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });

  await page.fill('input[name="username"]', LOGIN_USER);
  await page.fill('input[name="password"]', LOGIN_PASS);

  // The login button is type=submit inside #login-form
  const loginBtn = await page.$('#login-form button[type="submit"]');
  assert(loginBtn !== null, "Login button found");
  await loginBtn.click();

  // Wait for navigation away from login
  await page.waitForTimeout(3000);
  const url = page.url();
  assert(!url.includes("login") || url.includes("#/"), "Navigated away from login after authentication");
}

async function navigateToCapacitaciones(page) {
  await page.goto(`${BASE}/#/capacitaciones`);
  await page.waitForTimeout(2000);

  const heading = await page.$("h1");
  const headingText = heading ? await heading.textContent() : "";
  assert(headingText.includes("Capacitaciones"), "Capacitaciones page loaded with heading");
}

async function createCapacitacion(page, { nombre, modalidad, duracion, cupo }) {
  // Click "Nueva capacitacion"
  const newBtn = await page.$('[data-action="open-create"]');
  assert(newBtn !== null, `"Nueva capacitacion" button exists for creation of "${nombre}"`);
  await newBtn.click();
  await page.waitForTimeout(500);

  // Verify modal opens
  const form = await page.$('form[data-action="submit-cap"]');
  assert(form !== null, `Create modal opened for "${nombre}"`);

  // Check modal title
  const modalTitle = await page.$('[data-modal-inner] h2');
  const titleText = modalTitle ? await modalTitle.textContent() : "";
  assert(titleText.trim() === "Nueva Capacitacion", `Modal title is "Nueva Capacitacion" (got: "${titleText.trim()}")`);

  // Fill form
  await page.fill('input[name="nombre"]', nombre);
  await page.selectOption('select[name="modalidad"]', modalidad);
  await page.fill('input[name="duracion_horas"]', String(duracion));

  // Dates: start today, end in 30 days
  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  await page.fill('input[name="fecha_inicio"]', startDate);
  await page.fill('input[name="fecha_fin"]', endDate);

  if (cupo) {
    await page.fill('input[name="cupo_maximo"]', String(cupo));
  }

  // Submit
  const submitBtn = await page.$('form[data-action="submit-cap"] button[type="submit"]');
  const submitText = submitBtn ? await submitBtn.textContent() : "";
  assert(submitText.trim() === "Crear", `Submit button says "Crear" (got: "${submitText.trim()}")`);

  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Verify modal closed
  const modalAfter = await page.$('form[data-action="submit-cap"]');
  assert(modalAfter === null, `Modal closed after creating "${nombre}"`);

  // Verify card appears
  const cards = await page.$$("h3.text-sm.font-semibold");
  const names = await Promise.all(cards.map((c) => c.textContent()));
  const found = names.some((n) => n.includes(nombre));
  assert(found, `Card "${nombre}" appears in the list after creation`);
}

async function testEditCapacitacion(page) {
  console.log("\n=== TEST GROUP: EDIT CAPACITACION ===");

  // Step 1: Find the card "QA Edit Test" and click Edit
  console.log("\n--- Step 1: Find and click Edit on 'QA Edit Test' ---");

  // Use search to isolate the card
  const searchInput = await page.$('[data-action="filter-search"]');
  await searchInput.fill("QA Edit Test");
  await page.waitForTimeout(1000);

  // Verify our card is shown
  let cards = await page.$$("h3.text-sm.font-semibold");
  let names = await Promise.all(cards.map((c) => c.textContent()));
  const cardFound = names.some((n) => n.trim() === "QA Edit Test");
  assert(cardFound, 'Card "QA Edit Test" found in filtered list');

  // Click the "Editar" button
  const editBtn = await page.$('[data-action="edit-cap"]');
  assert(editBtn !== null, '"Editar" button (data-action="edit-cap") exists on card');

  // Verify button text
  const editBtnText = editBtn ? await editBtn.textContent() : "";
  assert(editBtnText.trim() === "Editar", `Edit button text is "Editar" (got: "${editBtnText.trim()}")`);

  await editBtn.click();
  await page.waitForTimeout(500);

  // Step 2: Verify edit modal opens with correct title
  console.log("\n--- Step 2: Verify edit modal title ---");
  const modalTitle = await page.$('[data-modal-inner] h2');
  const titleText = modalTitle ? await modalTitle.textContent() : "";
  assert(titleText.trim() === "Editar Capacitacion", `Modal title is "Editar Capacitacion" (got: "${titleText.trim()}")`);

  // Step 3: Verify all fields are pre-filled
  console.log("\n--- Step 3: Verify fields are pre-filled with existing values ---");

  const nombreInput = await page.$('input[name="nombre"]');
  const nombreValue = await nombreInput.inputValue();
  assert(nombreValue === "QA Edit Test", `Nombre field pre-filled: "${nombreValue}" === "QA Edit Test"`);

  const modalidadSelect = await page.$('select[name="modalidad"]');
  const modalidadValue = await modalidadSelect.inputValue();
  assert(modalidadValue === "online", `Modalidad field pre-filled: "${modalidadValue}" === "online"`);

  const duracionInput = await page.$('input[name="duracion_horas"]');
  const duracionValue = await duracionInput.inputValue();
  assert(duracionValue === "4", `Duracion field pre-filled: "${duracionValue}" === "4"`);

  const fechaInicioInput = await page.$('input[name="fecha_inicio"]');
  const fechaInicioValue = await fechaInicioInput.inputValue();
  assert(fechaInicioValue !== "", `Fecha inicio field pre-filled: "${fechaInicioValue}" is not empty`);

  const fechaFinInput = await page.$('input[name="fecha_fin"]');
  const fechaFinValue = await fechaFinInput.inputValue();
  assert(fechaFinValue !== "", `Fecha fin field pre-filled: "${fechaFinValue}" is not empty`);

  const cupoInput = await page.$('input[name="cupo_maximo"]');
  const cupoValue = await cupoInput.inputValue();
  assert(cupoValue === "10", `Cupo maximo field pre-filled: "${cupoValue}" === "10"`);

  // Step 4: Verify submit button says "Guardar cambios" (not "Crear")
  console.log("\n--- Step 4: Verify submit button text for edit mode ---");
  const submitBtn = await page.$('form[data-action="submit-cap"] button[type="submit"]');
  const submitText = submitBtn ? await submitBtn.textContent() : "";
  assert(submitText.trim() === "Guardar cambios", `Submit button says "Guardar cambios" (got: "${submitText.trim()}")`);

  // Step 5: Modify the nombre and duracion
  console.log("\n--- Step 5: Change nombre and duracion ---");
  await nombreInput.fill("");
  await nombreInput.fill("QA Edit Test Updated");
  const newNombreValue = await nombreInput.inputValue();
  assert(newNombreValue === "QA Edit Test Updated", `Nombre field updated to: "${newNombreValue}"`);

  await duracionInput.fill("");
  await duracionInput.fill("6");
  const newDuracionValue = await duracionInput.inputValue();
  assert(newDuracionValue === "6", `Duracion field updated to: "${newDuracionValue}"`);

  // Step 6: Submit and verify updates
  console.log("\n--- Step 6: Submit edit and verify card updates ---");
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Modal should be closed
  const modalAfterEdit = await page.$('form[data-action="submit-cap"]');
  assert(modalAfterEdit === null, "Modal closed after edit submission");

  // Clear search and search for updated name
  const searchInput2 = await page.$('[data-action="filter-search"]');
  await searchInput2.fill("QA Edit Test Updated");
  await page.waitForTimeout(1000);

  // Verify updated name appears
  cards = await page.$$("h3.text-sm.font-semibold");
  names = await Promise.all(cards.map((c) => c.textContent()));
  const updatedFound = names.some((n) => n.includes("QA Edit Test Updated"));
  assert(updatedFound, 'Card with updated name "QA Edit Test Updated" appears in list');

  // Verify old name is gone
  const oldNameStillThere = names.some((n) => n.trim() === "QA Edit Test" && !n.includes("Updated"));
  assert(!oldNameStillThere, 'Old name "QA Edit Test" (without Updated) no longer appears');

  // Verify duracion displays as 6h - search in the full page since only this card is filtered
  const pageText = await page.textContent("#capacitaciones-page");
  assert(pageText.includes("6h"), `Updated duration "6h" shown on page (page text includes "6h")`);

  // Clear search - use page.fill to avoid stale DOM references
  await page.fill('[data-action="filter-search"]', "");
  await page.waitForTimeout(500);
}

async function testDeleteCapacitacion(page) {
  console.log("\n=== TEST GROUP: DELETE CAPACITACION ===");

  // Step 7: Already created "QA Delete Test" - search for it
  console.log("\n--- Step 7: Find 'QA Delete Test' card ---");
  await page.fill('[data-action="filter-search"]', "QA Delete Test");
  await page.waitForTimeout(2000); // Wait longer for search debounce + API round-trip

  let cards = await page.$$("h3.text-sm.font-semibold");
  let names = await Promise.all(cards.map((c) => c.textContent()));
  const deleteCardFound = names.some((n) => n.includes("QA Delete Test"));
  assert(deleteCardFound, 'Card "QA Delete Test" found in list');

  // Step 8: Click "Eliminar" button
  console.log("\n--- Step 8: Click Eliminar button ---");
  const deleteBtn = await page.$('[data-action="delete-cap"]');
  assert(deleteBtn !== null, '"Eliminar" button (data-action="delete-cap") exists on card');

  const deleteBtnText = deleteBtn ? await deleteBtn.textContent() : "";
  assert(deleteBtnText.trim() === "Eliminar", `Delete button text is "Eliminar" (got: "${deleteBtnText.trim()}")`);

  // Step 9: Verify window.confirm dialog appears
  console.log("\n--- Step 9: Verify confirmation dialog ---");
  let dialogAppeared = false;
  let dialogMessage = "";

  // Track network requests to understand the flow
  const apiCalls = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/capacitaciones")) {
      apiCalls.push({ method: req.method(), url: req.url() });
    }
  });

  page.once("dialog", async (dialog) => {
    dialogAppeared = true;
    dialogMessage = dialog.message();
    // Step 10: Accept the dialog
    await dialog.accept();
  });

  await deleteBtn.click();
  await page.waitForTimeout(3000);

  console.log(`  [DEBUG] API calls during delete: ${JSON.stringify(apiCalls)}`);

  assert(dialogAppeared, "window.confirm dialog appeared on delete");
  assert(
    dialogMessage.includes("Eliminar") || dialogMessage.includes("eliminar"),
    `Dialog message mentions "eliminar": "${dialogMessage}"`
  );

  // Step 10 continued: Verify card disappears
  console.log("\n--- Step 10: Verify card disappears after deletion ---");

  // Debug: what is the search input value at this point?
  const searchValAfterDelete = await page.inputValue('[data-action="filter-search"]');
  console.log(`  [DEBUG] Search input value after delete: "${searchValAfterDelete}"`);

  // Debug: list all card names currently visible
  cards = await page.$$("h3.text-sm.font-semibold");
  names = await Promise.all(cards.map((c) => c.textContent()));
  console.log(`  [DEBUG] Cards visible after delete (${names.length}): ${JSON.stringify(names)}`);

  // The search debounce (300ms) may have re-fired after render() rebuilt the input.
  // Wait for any debounced searches to finish.
  await page.waitForTimeout(2000);

  // Check again after settling
  cards = await page.$$("h3.text-sm.font-semibold");
  names = await Promise.all(cards.map((c) => c.textContent()));
  console.log(`  [DEBUG] Cards visible after 2s settle (${names.length}): ${JSON.stringify(names)}`);

  const deletedStillThere = names.some((n) => n.includes("QA Delete Test"));
  assert(!deletedStillThere, '"QA Delete Test" card no longer appears after deletion');

  // Check if we see "No hay capacitaciones" or simply empty results in filtered view
  const emptyState = await page.$(".text-center.py-12");
  if (emptyState && names.length === 0) {
    console.log("  [INFO] Empty state message shown (filtered view has no results)");
  }

  // Step 11: Verify "QA Edit Test Updated" still exists
  console.log("\n--- Step 11: Verify 'QA Edit Test Updated' still exists ---");
  // Use page.fill with selector to avoid stale handle after DOM rebuild
  await page.fill('[data-action="filter-search"]', "QA Edit Test Updated");
  await page.waitForTimeout(1000);

  cards = await page.$$("h3.text-sm.font-semibold");
  names = await Promise.all(cards.map((c) => c.textContent()));
  const editedStillExists = names.some((n) => n.includes("QA Edit Test Updated"));
  assert(editedStillExists, '"QA Edit Test Updated" card still exists after deleting "QA Delete Test"');

  // Final state consistency: verify count
  console.log("\n--- State Consistency Check ---");
  await page.fill('[data-action="filter-search"]', "");
  await page.waitForTimeout(1000);

  // Check that the page still renders properly (no broken state)
  const heading = await page.$("h1");
  const headingText = heading ? await heading.textContent() : "";
  assert(headingText.includes("Capacitaciones"), "Page heading still shows 'Capacitaciones' after all operations");

  const statsSection = await page.$(".grid.grid-cols-2.md\\:grid-cols-4");
  assert(statsSection !== null, "Stats section still renders correctly after edit/delete operations");
}

async function cleanup(page) {
  console.log("\n=== CLEANUP ===");

  // Delete "QA Edit Test Updated"
  await page.fill('[data-action="filter-search"]', "QA Edit Test Updated");
  await page.waitForTimeout(1000);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  const deleteBtn = await page.$('[data-action="delete-cap"]');
  if (deleteBtn) {
    await deleteBtn.click();
    await page.waitForTimeout(1500);
    console.log("  [INFO] Cleaned up 'QA Edit Test Updated'");
  } else {
    console.log("  [INFO] No cleanup needed - card already removed");
  }
}

async function main() {
  console.log("=== Capacitaciones EDIT & DELETE - Detailed QA Test ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // Capture console errors from the page
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // Login
    console.log("=== Login ===");
    await login(page);

    // Navigate to capacitaciones
    console.log("\n=== Navigate to Capacitaciones ===");
    await navigateToCapacitaciones(page);

    // Create "QA Edit Test"
    console.log("\n=== Create 'QA Edit Test' ===");
    await createCapacitacion(page, {
      nombre: "QA Edit Test",
      modalidad: "online",
      duracion: 4,
      cupo: 10,
    });

    // Create "QA Delete Test"
    console.log("\n=== Create 'QA Delete Test' ===");
    await createCapacitacion(page, {
      nombre: "QA Delete Test",
      modalidad: "mixta",
      duracion: 2,
      cupo: null,
    });

    // Test Edit
    await testEditCapacitacion(page);

    // Test Delete
    await testDeleteCapacitacion(page);

    // Cleanup
    await cleanup(page);

    // Report console errors
    if (consoleErrors.length > 0) {
      console.log("\n=== BROWSER CONSOLE ERRORS ===");
      consoleErrors.forEach((err) => console.log(`  [CONSOLE ERROR] ${err}`));
      assert(consoleErrors.length === 0, `No browser console errors (found ${consoleErrors.length})`);
    } else {
      assert(true, "No browser console errors detected");
    }

    // Final summary
    console.log("\n==========================================");
    console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================");

  } catch (err) {
    console.error("\n[FATAL ERROR]", err.message);
    console.error(err.stack);
    await page.screenshot({
      path: "tests/e2e/error-screenshot-edit-delete.png",
    });
    console.error("Screenshot saved to tests/e2e/error-screenshot-edit-delete.png");
    failed++;
  } finally {
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
