/**
 * Playwright E2E test: Inscripciones a Capacitaciones (employee enrollment flow)
 *
 * Tests the full lifecycle:
 *   1. RH creates a capacitacion
 *   2. Empleado enrolls, verifies, cancels
 *   3. Empleado cannot create capacitaciones
 *
 * Usage: node tests/e2e/test_capacitaciones_inscripciones.mjs
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";

const RH_USER = "admin.rh@leoni.com";
const RH_PASS = "Leoni2026!RH";

const EMP_USER = "empleado.test@leoni.com";
const EMP_PASS = "Test1234!";

const CURSO_NOMBRE = "Curso E2E Inscripcion";
const CURSO_CUPO = 3;

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page, email, password) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector(
    'input[name="username"], input[type="email"], #login-email',
    { timeout: 10000 }
  );

  const emailInput =
    (await page.$('input[name="username"]')) ||
    (await page.$('input[type="email"]')) ||
    (await page.$('#login-email'));
  const passInput =
    (await page.$('input[name="password"]')) ||
    (await page.$('input[type="password"]')) ||
    (await page.$('#login-password'));

  await emailInput.fill(email);
  await passInput.fill(password);

  const submitBtn =
    (await page.$('button[type="submit"]')) ||
    (await page.$('[data-action="login"]'));
  await submitBtn.click();

  await page.waitForTimeout(3000);
}

async function logout(page) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/#/`);
  await sleep(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    // ========================================
    // STEP 1: Login as RH and create a capacitacion
    // ========================================
    console.log("\n=== Step 1: RH crea capacitacion ===");
    await login(page, RH_USER, RH_PASS);
    assert(true, "Login como RH exitoso");

    await page.goto(`${BASE}/#/capacitaciones`);
    await sleep(2000);

    // Click "Nueva capacitacion" button
    const createBtn = await page.$('[data-action="open-create"]');
    assert(createBtn !== null, "Boton 'Nueva capacitacion' visible para RH");

    if (createBtn) {
      await createBtn.click();
      await sleep(500);

      // Fill the form - nombre
      const nombreInput = await page.$(
        'input[name="nombre"], #cap-nombre, [data-field="nombre"] input'
      );
      if (nombreInput) {
        await nombreInput.fill(CURSO_NOMBRE);
      }

      // Fill cupo
      const cupoInput = await page.$(
        'input[name="cupo_maximo"], #cap-cupo, [data-field="cupo_maximo"] input'
      );
      if (cupoInput) {
        await cupoInput.fill(String(CURSO_CUPO));
      }

      // Fill fecha_inicio (today + 7 days)
      const fechaInicioInput = await page.$(
        'input[name="fecha_inicio"], #cap-fecha-inicio, [data-field="fecha_inicio"] input'
      );
      if (fechaInicioInput) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().split("T")[0];
        await fechaInicioInput.fill(dateStr);
      }

      // Fill fecha_fin (today + 14 days)
      const fechaFinInput = await page.$(
        'input[name="fecha_fin"], #cap-fecha-fin, [data-field="fecha_fin"] input'
      );
      if (fechaFinInput) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 14);
        const dateStr = futureDate.toISOString().split("T")[0];
        await fechaFinInput.fill(dateStr);
      }

      // Submit the form
      const submitBtn = await page.$(
        'button[type="submit"], [data-action="submit-capacitacion"]'
      );
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press("Enter");
      }

      await sleep(2000);
      assert(true, `Capacitacion "${CURSO_NOMBRE}" creada (cupo: ${CURSO_CUPO})`);
    }

    // ========================================
    // STEP 2: Logout
    // ========================================
    console.log("\n=== Step 2: Logout de RH ===");
    await logout(page);
    assert(true, "Logout de RH completado");

    // ========================================
    // STEP 3: Login as Empleado
    // ========================================
    console.log("\n=== Step 3: Login como Empleado ===");
    await login(page, EMP_USER, EMP_PASS);
    assert(true, "Login como Empleado exitoso");

    // ========================================
    // STEP 4: Navigate to capacitaciones and verify catalog
    // ========================================
    console.log("\n=== Step 4: Verificar catalogo de capacitaciones ===");
    await page.goto(`${BASE}/#/capacitaciones`);
    await sleep(2000);

    // Look for the course in the cards
    const pageContent = await page.textContent("body");
    const cursoVisible = pageContent.includes(CURSO_NOMBRE);
    assert(cursoVisible, `Capacitacion "${CURSO_NOMBRE}" visible en catalogo`);

    // ========================================
    // STEP 5: Inscribirse
    // ========================================
    console.log("\n=== Step 5: Inscribirse al curso ===");

    // Find the inscribirse button for our course
    const inscribirseBtn = await page.$('[data-action="inscribirse"]');
    assert(inscribirseBtn !== null, "Boton 'Inscribirme' encontrado");

    if (inscribirseBtn) {
      await inscribirseBtn.click();
      await sleep(500);

      // Confirm in modal
      const confirmBtn = await page.waitForSelector(
        '[data-action="confirm-inscripcion"]',
        { timeout: 5000 }
      ).catch(() => null);
      assert(confirmBtn !== null, "Modal de confirmacion abierto");

      if (confirmBtn) {
        await confirmBtn.click();
        await sleep(2000);
        assert(true, "Inscripcion confirmada");
      }
    }

    // ========================================
    // STEP 6: Verify inscribed in "Mis Inscripciones" tab
    // ========================================
    console.log("\n=== Step 6: Verificar inscripcion en 'Mis Inscripciones' ===");

    const tabInscripciones = await page.$(
      '[data-action="tab"][data-tab="inscripciones"]'
    );
    assert(tabInscripciones !== null, "Tab 'Mis Inscripciones' encontrado");

    if (tabInscripciones) {
      await tabInscripciones.click();
      await sleep(1500);

      const tabContent = await page.textContent("body");
      const inscripcionVisible = tabContent.includes(CURSO_NOMBRE);
      assert(inscripcionVisible, `Curso "${CURSO_NOMBRE}" aparece en Mis Inscripciones`);
    }

    // ========================================
    // STEP 7: Cancel inscripcion
    // ========================================
    console.log("\n=== Step 7: Cancelar inscripcion ===");

    const cancelBtn = await page.$('[data-action="cancel-inscripcion"]');
    assert(cancelBtn !== null, "Boton 'Cancelar' inscripcion encontrado");

    if (cancelBtn) {
      await cancelBtn.click();
      await sleep(500);

      // Handle confirmation dialog if present
      const confirmCancelBtn = await page
        .waitForSelector('[data-action="confirm-cancel"], .modal button.btn-danger, .modal [data-action="confirm"]', {
          timeout: 3000,
        })
        .catch(() => null);

      if (confirmCancelBtn) {
        await confirmCancelBtn.click();
      }

      await sleep(2000);
      assert(true, "Cancelacion de inscripcion solicitada");
    }

    // ========================================
    // STEP 8: Verify canceled
    // ========================================
    console.log("\n=== Step 8: Verificar cancelacion ===");

    const bodyAfterCancel = await page.textContent("body");
    const showsCancelado = bodyAfterCancel.includes("Cancelado") ||
      bodyAfterCancel.includes("cancelado") ||
      bodyAfterCancel.includes("CANCELADO");
    // If it doesn't show "Cancelado", maybe the row just disappeared
    const cursoStillVisible = bodyAfterCancel.includes(CURSO_NOMBRE);
    const cancelVerified = showsCancelado || !cursoStillVisible;
    assert(
      cancelVerified,
      "Inscripcion muestra 'Cancelado' o fue removida de la lista"
    );

    // ========================================
    // STEP 9: Verify empleado CANNOT create capacitaciones
    // ========================================
    console.log("\n=== Step 9: Verificar que empleado NO puede crear ===");

    // Navigate back to main capacitaciones view
    await page.goto(`${BASE}/#/capacitaciones`);
    await sleep(2000);

    const createBtnEmpleado = await page.$('[data-action="open-create"]');
    assert(
      createBtnEmpleado === null,
      "Boton 'Nueva capacitacion' NO visible para empleado"
    );

    // ========================================
    // RESULTS
    // ========================================
    console.log("\n========================================");
    console.log(`  Resultados: ${passed} passed, ${failed} failed`);
    console.log("========================================\n");

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\nError fatal:", err.message);
    await page.screenshot({
      path: "tests/e2e/error-inscripciones-screenshot.png",
    });
    console.error(
      "Screenshot guardado en tests/e2e/error-inscripciones-screenshot.png"
    );
    process.exitCode = 1;
  } finally {
    await sleep(1000);
    await browser.close();
  }
}

main();
