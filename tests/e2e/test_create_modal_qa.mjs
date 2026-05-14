/**
 * Playwright E2E QA Test: Create Capacitacion Modal — exhaustive UI checks
 *
 * Usage: node tests/e2e/test_create_modal_qa.mjs
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push({ status: "PASS", message });
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    results.push({ status: "FAIL", message });
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function login(page) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', LOGIN_USER);
  await page.fill('input[name="password"]', LOGIN_PASS);
  // Submit login form - button is type=submit inside #login-form
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(3000);
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function nextWeek() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // ── Login & Navigate ───────────────────────────────────────────────────
    console.log("\n=== LOGIN & NAVIGATE ===");
    await login(page);
    await page.goto(`${BASE}/#/capacitaciones`);
    await page.waitForTimeout(2000);

    // ── CHECK 1: Modal opens when clicking "Nueva capacitacion" ────────────
    console.log("\n=== CHECK 1: Modal opens on button click ===");
    const openBtn = await page.$('[data-action="open-create"]');
    assert(openBtn !== null, "1. 'Nueva capacitacion' button exists (data-action=open-create)");

    await openBtn.click();
    await page.waitForTimeout(500);

    const backdrop = await page.$("#cap-modal-backdrop");
    assert(backdrop !== null, "1. Modal opens after clicking 'Nueva capacitacion'");

    // ── CHECK 2: Modal has backdrop with bg-black/40 ───────────────────────
    console.log("\n=== CHECK 2: Backdrop styling ===");
    if (backdrop) {
      const classes = await backdrop.getAttribute("class");
      assert(
        classes && classes.includes("bg-black/40"),
        "2. Backdrop has 'bg-black/40' class"
      );
      assert(
        classes && classes.includes("fixed"),
        "2. Backdrop has 'fixed' positioning"
      );
      assert(
        classes && classes.includes("inset-0"),
        "2. Backdrop covers full viewport (inset-0)"
      );
      assert(
        classes && classes.includes("z-50"),
        "2. Backdrop has z-50 z-index"
      );
    } else {
      assert(false, "2. Backdrop exists for further checks");
    }

    // ── CHECK 3: Modal title is "Nueva Capacitacion" ───────────────────────
    console.log("\n=== CHECK 3: Modal title ===");
    const modalInner = await page.$("[data-modal-inner]");
    const titleEl = modalInner ? await modalInner.$("h2") : null;
    const titleText = titleEl ? await titleEl.textContent() : "";
    assert(
      titleText.trim() === "Nueva Capacitacion",
      `3. Modal title is "Nueva Capacitacion" (got: "${titleText.trim()}")`
    );

    // ── CHECK 4: Form fields present with correct attributes ───────────────
    console.log("\n=== CHECK 4: Form fields validation ===");

    // nombre (required, text)
    const nombre = await page.$('[data-modal-inner] input[name="nombre"]');
    assert(nombre !== null, "4a. Field 'nombre' exists (input)");
    if (nombre) {
      const required = await nombre.getAttribute("required");
      assert(required !== null, "4a. Field 'nombre' is required");
      const type = await nombre.getAttribute("type");
      assert(type === "text", `4a. Field 'nombre' type is text (got: ${type})`);
    }

    // descripcion (textarea, not required)
    const descripcion = await page.$('[data-modal-inner] textarea[name="descripcion"]');
    assert(descripcion !== null, "4b. Field 'descripcion' exists (textarea)");
    if (descripcion) {
      const required = await descripcion.getAttribute("required");
      assert(required === null, "4b. Field 'descripcion' is NOT required");
    }

    // modalidad (select, required)
    const modalidad = await page.$('[data-modal-inner] select[name="modalidad"]');
    assert(modalidad !== null, "4c. Field 'modalidad' exists (select)");
    if (modalidad) {
      const required = await modalidad.getAttribute("required");
      assert(required !== null, "4c. Field 'modalidad' is required");
      // Check options
      const options = await modalidad.$$eval("option", (opts) =>
        opts.map((o) => o.value)
      );
      assert(
        options.includes("presencial") && options.includes("online") && options.includes("mixta"),
        `4c. Modalidad has options presencial/online/mixta (got: ${options.join(", ")})`
      );
    }

    // duracion_horas (number, required)
    const duracion = await page.$('[data-modal-inner] input[name="duracion_horas"]');
    assert(duracion !== null, "4d. Field 'duracion_horas' exists (input)");
    if (duracion) {
      const required = await duracion.getAttribute("required");
      assert(required !== null, "4d. Field 'duracion_horas' is required");
      const type = await duracion.getAttribute("type");
      assert(type === "number", `4d. Field 'duracion_horas' type is number (got: ${type})`);
    }

    // instructor (text, not required)
    const instructor = await page.$('[data-modal-inner] input[name="instructor"]');
    assert(instructor !== null, "4e. Field 'instructor' exists (input)");
    if (instructor) {
      const required = await instructor.getAttribute("required");
      assert(required === null, "4e. Field 'instructor' is NOT required");
    }

    // area (select, not required)
    const area = await page.$('[data-modal-inner] select[name="area_id"]');
    assert(area !== null, "4f. Field 'area' (area_id) exists (select)");
    if (area) {
      const required = await area.getAttribute("required");
      assert(required === null, "4f. Field 'area' is NOT required");
    }

    // fecha_inicio (date, required)
    const fechaInicio = await page.$('[data-modal-inner] input[name="fecha_inicio"]');
    assert(fechaInicio !== null, "4g. Field 'fecha_inicio' exists (input)");
    if (fechaInicio) {
      const required = await fechaInicio.getAttribute("required");
      assert(required !== null, "4g. Field 'fecha_inicio' is required");
      const type = await fechaInicio.getAttribute("type");
      assert(type === "date", `4g. Field 'fecha_inicio' type is date (got: ${type})`);
    }

    // fecha_fin (date, required)
    const fechaFin = await page.$('[data-modal-inner] input[name="fecha_fin"]');
    assert(fechaFin !== null, "4h. Field 'fecha_fin' exists (input)");
    if (fechaFin) {
      const required = await fechaFin.getAttribute("required");
      assert(required !== null, "4h. Field 'fecha_fin' is required");
      const type = await fechaFin.getAttribute("type");
      assert(type === "date", `4h. Field 'fecha_fin' type is date (got: ${type})`);
    }

    // cupo_maximo (number, not required)
    const cupo = await page.$('[data-modal-inner] input[name="cupo_maximo"]');
    assert(cupo !== null, "4i. Field 'cupo_maximo' exists (input)");
    if (cupo) {
      const required = await cupo.getAttribute("required");
      assert(required === null, "4i. Field 'cupo_maximo' is NOT required");
      const type = await cupo.getAttribute("type");
      assert(type === "number", `4i. Field 'cupo_maximo' type is number (got: ${type})`);
    }

    // ── CHECK 5: Cancel button closes modal ────────────────────────────────
    console.log("\n=== CHECK 5: Cancel button closes modal ===");
    const cancelBtn = await page.$('[data-modal-inner] button[data-action="close-modal"]');
    assert(cancelBtn !== null, "5. Cancel button exists inside modal");
    if (cancelBtn) {
      const cancelText = await cancelBtn.textContent();
      assert(cancelText.trim() === "Cancelar", `5. Cancel button text is "Cancelar" (got: "${cancelText.trim()}")`);
      await cancelBtn.click();
      await page.waitForTimeout(300);
      const modalAfterCancel = await page.$("#cap-modal-backdrop");
      assert(modalAfterCancel === null, "5. Modal closes after clicking Cancel");
    }

    // ── CHECK 6: Escape key closes modal ───────────────────────────────────
    console.log("\n=== CHECK 6: Escape key closes modal ===");
    // Reopen modal
    await page.click('[data-action="open-create"]');
    await page.waitForTimeout(500);
    let modalCheck = await page.$("#cap-modal-backdrop");
    assert(modalCheck !== null, "6. Modal reopened for Escape test");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const modalAfterEsc = await page.$("#cap-modal-backdrop");
    assert(modalAfterEsc === null, "6. Modal closes after pressing Escape");

    // ── CHECK 7: Backdrop click closes, inner click does NOT ────────────────
    console.log("\n=== CHECK 7: Backdrop vs inner click ===");
    // Reopen modal
    await page.click('[data-action="open-create"]');
    await page.waitForTimeout(500);

    // Click inside modal inner — should NOT close
    const innerBox = await page.$("[data-modal-inner]");
    if (innerBox) {
      await innerBox.click();
      await page.waitForTimeout(300);
      const modalAfterInner = await page.$("#cap-modal-backdrop");
      assert(modalAfterInner !== null, "7. Clicking inside modal does NOT close it");
    } else {
      assert(false, "7. Could not find modal inner for click test");
    }

    // Click on backdrop (outside the inner modal) — should close
    // We click at position that is outside the inner modal (top-left corner of backdrop)
    const backdropEl = await page.$("#cap-modal-backdrop");
    if (backdropEl) {
      const box = await backdropEl.boundingBox();
      // Click at 10,10 — far top-left, definitely outside the centered modal
      await page.mouse.click(box.x + 10, box.y + 10);
      await page.waitForTimeout(300);
      const modalAfterBackdrop = await page.$("#cap-modal-backdrop");
      assert(modalAfterBackdrop === null, "7. Clicking backdrop (outside modal) closes it");
    } else {
      assert(false, "7. Could not find backdrop for click test");
    }

    // ── CHECK 8: Form validation — empty nombre should not submit ──────────
    console.log("\n=== CHECK 8: Form validation (empty nombre) ===");
    await page.click('[data-action="open-create"]');
    await page.waitForTimeout(500);

    // Fill only duracion and dates but leave nombre empty
    await page.fill('[data-modal-inner] input[name="duracion_horas"]', "4");
    await page.fill('[data-modal-inner] input[name="fecha_inicio"]', tomorrow());
    await page.fill('[data-modal-inner] input[name="fecha_fin"]', nextWeek());

    // Try to submit by clicking the submit button
    const submitBtn = await page.$('[data-modal-inner] button[type="submit"]');
    assert(submitBtn !== null, "8. Submit button exists");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      // Modal should still be open because nombre is empty and required
      const modalStillOpen = await page.$("#cap-modal-backdrop");
      assert(modalStillOpen !== null, "8. Form NOT submitted with empty nombre (modal stays open)");
    }

    // Close modal to prepare for next test
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // ── CHECK 9: Create capacitacion with valid data ────────────────────────
    console.log("\n=== CHECK 9: Create capacitacion with valid data ===");
    await page.click('[data-action="open-create"]');
    await page.waitForTimeout(500);

    const testName = "Playwright Test Cap";
    await page.fill('[data-modal-inner] input[name="nombre"]', testName);
    await page.selectOption('[data-modal-inner] select[name="modalidad"]', "presencial");
    await page.fill('[data-modal-inner] input[name="duracion_horas"]', "8");
    await page.fill('[data-modal-inner] input[name="fecha_inicio"]', tomorrow());
    await page.fill('[data-modal-inner] input[name="fecha_fin"]', nextWeek());
    await page.fill('[data-modal-inner] input[name="cupo_maximo"]', "20");

    // Submit and wait for network response + re-render
    await page.click('[data-modal-inner] button[type="submit"]');
    // Wait for modal to disappear (API call + re-render)
    await page.waitForSelector("#cap-modal-backdrop", { state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ── CHECK 10: Modal closes and card appears ─────────────────────────────
    console.log("\n=== CHECK 10: Modal closes and card appears in list ===");
    const modalAfterCreate = await page.$("#cap-modal-backdrop");
    assert(modalAfterCreate === null, "10. Modal closes after successful creation");

    // Look for the created card in the list — search in page text
    const pageText = await page.evaluate(() => document.body.innerText);
    assert(pageText.includes(testName), `10. Card with name "${testName}" appears in the list`);

    // ── CHECK 11: Card shows correct badges (modalidad, estado) ─────────────
    console.log("\n=== CHECK 11: Card badges ===");
    // Find the card containing our test name
    const allCards = await page.$$(".rounded-lg.border.border-gray-200.bg-white.p-4");
    let targetCard = null;
    for (const card of allCards) {
      const text = await card.textContent();
      if (text.includes(testName)) {
        targetCard = card;
        break;
      }
    }

    if (targetCard) {
      const cardHtml = await targetCard.innerHTML();
      // Check modalidad badge — should show "Presencial"
      const modalidadBadge = await targetCard.$(".text-blue-800");
      const modalidadText = modalidadBadge ? await modalidadBadge.textContent() : "";
      assert(
        modalidadText.trim() === "Presencial",
        `11. Modalidad badge shows "Presencial" (got: "${modalidadText.trim()}")`
      );

      // Check estado badge — should show "Activa"
      const estadoBadge = await targetCard.$(".text-emerald-900");
      const estadoText = estadoBadge ? await estadoBadge.textContent() : "";
      assert(
        estadoText.trim() === "Activa",
        `11. Estado badge shows "Activa" (got: "${estadoText.trim()}")`
      );
    } else {
      assert(false, "11. Could not find target card for badge check");
      assert(false, "11. (skipped estado badge check)");
    }

    // ── CHECK 12: RH-only buttons (Editar, Eliminar) appear on card ─────────
    console.log("\n=== CHECK 12: RH-only buttons on card ===");
    if (targetCard) {
      const editBtn = await targetCard.$('[data-action="edit-cap"]');
      assert(editBtn !== null, "12. 'Editar' button exists on card (RH role)");
      if (editBtn) {
        const editText = await editBtn.textContent();
        assert(editText.trim() === "Editar", `12. Edit button text is "Editar" (got: "${editText.trim()}")`);
      }

      const deleteBtn = await targetCard.$('[data-action="delete-cap"]');
      assert(deleteBtn !== null, "12. 'Eliminar' button exists on card (RH role)");
      if (deleteBtn) {
        const deleteText = await deleteBtn.textContent();
        assert(deleteText.trim() === "Eliminar", `12. Delete button text is "Eliminar" (got: "${deleteText.trim()}")`);
      }
    } else {
      assert(false, "12. Could not find target card for RH button check");
      assert(false, "12. (skipped Eliminar check)");
    }

    // ── CLEANUP: Delete the test capacitacion ───────────────────────────────
    console.log("\n=== CLEANUP ===");
    if (targetCard) {
      const delBtn = await targetCard.$('[data-action="delete-cap"]');
      if (delBtn) {
        page.once("dialog", (d) => d.accept());
        await delBtn.click();
        await page.waitForTimeout(2000);
        console.log("  Cleaned up test capacitacion.");
      }
    }

  } catch (err) {
    console.error("\n  FATAL ERROR:", err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED (total: ${passed + failed})`);
  console.log("=".repeat(60));
  console.log("\nDetailed results:");
  for (const r of results) {
    console.log(`  [${r.status}] ${r.message}`);
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
})();
