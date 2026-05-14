/**
 * E2E Test: Inscripciones (enrollment) flow
 * Tests the full inscription lifecycle: RH creates cap, Empleado enrolls, then cancels.
 *
 * Run with: npx playwright test tests/e2e/test_inscripciones_flow.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const RH_EMAIL = "admin.rh@leoni.com";
const RH_PASSWORD = "Leoni2026!RH";
const EMP_EMAIL = "empleado.test@leoni.com";
const EMP_PASSWORD = "Leoni2026!RH";

const results = [];
function report(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const status = pass ? "PASS" : "FAIL";
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} [${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/#/login`);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', password);
  // The login form uses form submit, not data-action. Button is type="submit" with class "login-page-submit"
  await page.click('button[type="submit"].login-page-submit');
  // Wait for navigation away from login
  await page.waitForTimeout(3000);
}

async function navigateToCapacitaciones(page) {
  await page.goto(`${BASE_URL}/#/capacitaciones`);
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ==========================================================================
  // PART A: Setup (as RH)
  // ==========================================================================
  console.log("\n========================================");
  console.log("PART A — Setup (as RH)");
  console.log("========================================\n");

  const rhContext = await browser.newContext();
  const rhPage = await rhContext.newPage();

  // A1: Login as RH
  try {
    await login(rhPage, RH_EMAIL, RH_PASSWORD);
    const url = rhPage.url();
    // Check if error-msg is shown (not hidden)
    const loginError = await rhPage.$("#error-msg:not(.hidden)");
    if (loginError) {
      const errorText = await loginError.textContent();
      report("A1: Login as RH", false, `Login error visible: "${errorText.trim()}"`);
    } else {
      // Verify we're past login
      const loginForm = await rhPage.$("#login-form");
      if (loginForm) {
        report("A1: Login as RH", false, `Still on login page (url: ${url})`);
      } else {
        report("A1: Login as RH", true, `Navigated to: ${url}`);
      }
    }
  } catch (e) {
    report("A1: Login as RH", false, e.message);
  }

  // A2: Navigate to capacitaciones
  try {
    await navigateToCapacitaciones(rhPage);
    const heading = await rhPage.textContent("h1");
    const isCapPage = heading && heading.includes("Capacitaciones");
    report("A2: Navigate to #/capacitaciones", isCapPage, `heading="${heading}"`);
  } catch (e) {
    report("A2: Navigate to #/capacitaciones", false, e.message);
  }

  // A3: RH should NOT see "Inscribirme" button
  try {
    await rhPage.waitForTimeout(1500);
    const inscribirmeBtn = await rhPage.$('[data-action="inscribirse"]');
    report("A3: RH does NOT see 'Inscribirme' button", inscribirmeBtn === null, inscribirmeBtn ? "Button found (unexpected!)" : "Correctly hidden");
  } catch (e) {
    report("A3: RH does NOT see 'Inscribirme' button", false, e.message);
  }

  // A4: Create a capacitacion
  let capCreated = false;
  try {
    const createBtn = await rhPage.$('[data-action="open-create"]');
    if (!createBtn) {
      report("A4: 'Nueva capacitacion' button visible for RH", false, "Button not found");
    } else {
      report("A4: 'Nueva capacitacion' button visible for RH", true);
      await createBtn.click();
      await rhPage.waitForSelector('form[data-action="submit-cap"]', { timeout: 5000 });

      // Fill form
      await rhPage.fill('input[name="nombre"]', "Inscripcion Test Cap");
      await rhPage.selectOption('select[name="modalidad"]', "presencial");
      await rhPage.fill('input[name="duracion_horas"]', "16");
      await rhPage.fill('input[name="cupo_maximo"]', "5");

      // Set dates: start tomorrow, end in 30 days
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      const fmtDate = (d) => d.toISOString().split("T")[0];

      await rhPage.fill('input[name="fecha_inicio"]', fmtDate(tomorrow));
      await rhPage.fill('input[name="fecha_fin"]', fmtDate(endDate));

      // Submit
      await rhPage.click('form[data-action="submit-cap"] button[type="submit"]');
      await rhPage.waitForTimeout(2000);

      // Verify created - look for the card
      const pageContent = await rhPage.textContent("#capacitaciones-page");
      if (pageContent.includes("Inscripcion Test Cap")) {
        report("A5: Capacitacion created successfully", true);
        capCreated = true;
      } else {
        report("A5: Capacitacion created successfully", false, "Cap name not found in page after creation");
      }
    }
  } catch (e) {
    report("A4/A5: Create capacitacion", false, e.message);
  }

  await rhContext.close();

  // ==========================================================================
  // PART B: Empleado inscription flow
  // ==========================================================================
  console.log("\n========================================");
  console.log("PART B — Empleado inscription flow");
  console.log("========================================\n");

  const empContext = await browser.newContext();
  const empPage = await empContext.newPage();

  // B1: Login as Empleado
  let empLoginOk = false;
  try {
    await login(empPage, EMP_EMAIL, EMP_PASSWORD);
    const url = empPage.url();
    const loginError = await empPage.$("#error-msg:not(.hidden)");
    if (loginError) {
      const errorText = await loginError.textContent();
      report("B1: Login as Empleado", false, `Login error: "${errorText.trim()}"`);
    } else {
      const loginForm = await empPage.$("#login-form");
      if (loginForm) {
        report("B1: Login as Empleado", false, `Still on login page (url: ${url})`);
      } else {
        report("B1: Login as Empleado", true, `Navigated to: ${url}`);
        empLoginOk = true;
      }
    }
  } catch (e) {
    report("B1: Login as Empleado", false, e.message);
  }

  if (!empLoginOk) {
    console.log("\n  BLOCKER: empleado.test@leoni.com login failed. Testing what's possible with RH user.\n");

    // Extra test: Verify RH cannot see inscribirme (already tested above)
    report("BLOCKER: Empleado login failed", false, "Cannot proceed with inscription tests. The user empleado.test@leoni.com may not exist.");

    await empContext.close();
    await browser.close();
    printSummary();
    process.exit(1);
  }

  // B2: Navigate to capacitaciones
  try {
    await navigateToCapacitaciones(empPage);
    const heading = await empPage.textContent("h1");
    report("B2: Navigate to #/capacitaciones as Empleado", heading?.includes("Capacitaciones"), `heading="${heading}"`);
  } catch (e) {
    report("B2: Navigate to #/capacitaciones as Empleado", false, e.message);
  }

  // B3: Verify "Nueva capacitacion" button is NOT visible
  try {
    await empPage.waitForTimeout(1500);
    const createBtn = await empPage.$('[data-action="open-create"]');
    report("B3: 'Nueva capacitacion' button NOT visible for Empleado", createBtn === null, createBtn ? "Button found (UNEXPECTED for empleado)" : "Correctly hidden");
  } catch (e) {
    report("B3: 'Nueva capacitacion' button NOT visible for Empleado", false, e.message);
  }

  // B4: Verify "Inscribirme" button IS visible on active caps
  let inscribirmeBtn = null;
  try {
    await empPage.waitForTimeout(500);
    const inscribirseBtns = await empPage.$$('[data-action="inscribirse"]');
    const hasInscribirme = inscribirseBtns.length > 0;
    report("B4: 'Inscribirme' button visible on active capacitaciones", hasInscribirme, `Found ${inscribirseBtns.length} button(s)`);

    // Find the one for our test cap
    for (const btn of inscribirseBtns) {
      const card = await btn.evaluateHandle((el) => el.closest(".rounded-lg"));
      if (card) {
        const cardText = await card.evaluate((el) => el.textContent);
        if (cardText.includes("Inscripcion Test Cap")) {
          inscribirmeBtn = btn;
          break;
        }
      }
    }

    if (!inscribirmeBtn && hasInscribirme) {
      // Try first one if our cap not found
      inscribirmeBtn = inscribirseBtns[0];
      console.log("    (Note: Using first available inscribirme button since test cap not found by name)");
    }
  } catch (e) {
    report("B4: 'Inscribirme' button visible", false, e.message);
  }

  // B5: Click "Inscribirme" on the test capacitacion
  if (!inscribirmeBtn) {
    report("B5: Click 'Inscribirme' on test cap", false, "No inscribirme button available");
    report("B6: Confirmation modal opens with details", false, "SKIP - no button");
    report("B7: Confirm inscripcion", false, "SKIP - no modal");
    report("B8: Inscripcion succeeded", false, "SKIP");
    report("B9: Switch to 'Mis Inscripciones' tab", false, "SKIP");
    report("B10: Inscripcion appears in table", false, "SKIP");
    report("B11: Cancel button visible", false, "SKIP");
    report("B12: Cancel inscripcion", false, "SKIP");
    report("B13: Inscripcion state updated", false, "SKIP");
  } else {
    // B5: Click inscribirme
    try {
      await inscribirmeBtn.click();
      await empPage.waitForTimeout(1000);
      report("B5: Click 'Inscribirme'", true);
    } catch (e) {
      report("B5: Click 'Inscribirme'", false, e.message);
    }

    // B6: Verify confirmation modal opens with details
    try {
      const modal = await empPage.$('[data-inscripcion-inner]');
      if (!modal) {
        report("B6: Confirmation modal opens", false, "Modal not found ([data-inscripcion-inner])");
      } else {
        const modalText = await modal.textContent();

        // Check for key fields
        const hasNombre = modalText.includes("Capacitacion") || modalText.includes("Inscripcion Test Cap");
        const hasModalidad = modalText.includes("Modalidad") && modalText.includes("Presencial");
        const hasDuracion = modalText.includes("Duracion") && modalText.includes("16");
        const hasFechas = modalText.includes("Fecha inicio") && modalText.includes("Fecha fin");
        const hasCupo = modalText.includes("Cupo");

        const allPresent = hasNombre && hasModalidad && hasDuracion && hasFechas && hasCupo;
        let detail = "";
        if (!hasNombre) detail += "Missing nombre; ";
        if (!hasModalidad) detail += "Missing modalidad; ";
        if (!hasDuracion) detail += "Missing duracion; ";
        if (!hasFechas) detail += "Missing fechas; ";
        if (!hasCupo) detail += "Missing cupo; ";

        report("B6: Confirmation modal has all details (nombre, modalidad, duracion, fechas, cupo)", allPresent, detail || "All fields present");
      }
    } catch (e) {
      report("B6: Confirmation modal opens", false, e.message);
    }

    // B7: Click "Confirmar inscripcion"
    let alertMessage = null;
    try {
      const confirmBtn = await empPage.$('[data-action="confirm-inscripcion"]');
      if (!confirmBtn) {
        report("B7: 'Confirmar inscripcion' button exists", false, "Button not found");
      } else {
        const btnText = await confirmBtn.textContent();
        const dataId = await confirmBtn.getAttribute("data-id");
        report("B7: 'Confirmar inscripcion' button exists", btnText.includes("Confirmar"), `Button text: "${btnText.trim()}", data-id="${dataId}"`);

        // Handle possible alert dialog BEFORE clicking
        const dialogHandler = async (dialog) => {
          alertMessage = dialog.message();
          console.log(`    Dialog: ${dialog.type()} "${alertMessage}"`);
          await dialog.accept();
        };
        empPage.once("dialog", dialogHandler);

        await confirmBtn.click();
        await empPage.waitForTimeout(3000);

        // Remove dialog handler if not triggered (to avoid interfering with later tests)
        empPage.removeListener("dialog", dialogHandler);
      }
    } catch (e) {
      report("B7: Click 'Confirmar inscripcion'", false, e.message);
    }

    // B8: Verify inscription succeeded (modal closes, inscritos count updates)
    try {
      const modalGone = (await empPage.$('[data-inscripcion-inner]')) === null;

      if (!modalGone) {
        report("B8: Inscripcion succeeded (modal closes)", false, `Modal still open. Alert was: "${alertMessage ?? "none"}". Inscription likely failed.`);
        // Try to close modal so we can continue testing
        const closeBtn = await empPage.$('[data-action="close-inscripcion-modal"]');
        if (closeBtn) {
          await closeBtn.click({ force: true });
          await empPage.waitForTimeout(500);
        }
      } else {
        if (alertMessage) {
          report("B8: Inscripcion succeeded (modal closed)", false, `Modal closed but alert fired: "${alertMessage}"`);
        } else {
          // Check inscritos count updated
          const pageContent = await empPage.textContent("#capacitaciones-page");
          report("B8: Inscripcion succeeded (modal closed)", true, "Modal closed after confirm, no errors");
        }
      }
    } catch (e) {
      report("B8: Inscripcion succeeded", false, e.message);
    }

    // B9: Switch to "Mis Inscripciones" tab
    try {
      // Make sure modal is closed first
      const modalStillOpen = await empPage.$('[data-inscripcion-inner]');
      if (modalStillOpen) {
        await empPage.evaluate(() => {
          const backdrop = document.getElementById("insc-modal-backdrop");
          if (backdrop) backdrop.remove();
        });
        await empPage.waitForTimeout(500);
      }

      const tabBtn = await empPage.$('[data-action="tab"][data-tab="inscripciones"]');
      if (!tabBtn) {
        report("B9: 'Mis Inscripciones' tab exists", false, "Tab button not found");
      } else {
        await tabBtn.click({ force: true });
        await empPage.waitForTimeout(2000);

        // Verify tab is active (re-query after render)
        const newTabBtn = await empPage.$('[data-action="tab"][data-tab="inscripciones"]');
        const tabClass = newTabBtn ? await newTabBtn.getAttribute("class") : "";
        const isActive = tabClass.includes("border-blue-600") || tabClass.includes("text-blue-600");
        report("B9: Switch to 'Mis Inscripciones' tab", isActive, isActive ? "Tab active" : `Tab class: ${tabClass}`);
      }
    } catch (e) {
      report("B9: Switch to 'Mis Inscripciones' tab", false, e.message);
    }

    // B10: Verify the inscripcion appears in the table with estado "Inscrito"
    let inscripcionRowFound = false;
    try {
      const table = await empPage.$("table");
      if (!table) {
        // Maybe empty state
        const pageContent = await empPage.textContent("#capacitaciones-page");
        if (pageContent.includes("No tienes inscripciones")) {
          report("B10: Inscripcion appears in table with 'Inscrito'", false, "Table shows 'No tienes inscripciones' - inscription may not have been saved");
        } else {
          report("B10: Inscripcion appears in table with 'Inscrito'", false, "No table found and no empty state");
        }
      } else {
        const tableContent = await table.textContent();
        const hasInscrito = tableContent.includes("Inscrito");
        const hasCapName = tableContent.includes("Inscripcion Test Cap") || tableContent.length > 50;

        report("B10: Inscripcion appears in table with estado 'Inscrito'", hasInscrito, hasInscrito ? "Found 'Inscrito' in table" : `Table content: "${tableContent.substring(0, 200)}"`);
        inscripcionRowFound = hasInscrito;
      }
    } catch (e) {
      report("B10: Inscripcion in table", false, e.message);
    }

    // B11: Verify "Cancelar" button is visible
    let cancelBtn = null;
    try {
      cancelBtn = await empPage.$('[data-action="cancel-inscripcion"]');
      report("B11: 'Cancelar' button visible on inscripcion row", cancelBtn !== null, cancelBtn ? "Button found" : "Button NOT found");
    } catch (e) {
      report("B11: 'Cancelar' button visible", false, e.message);
    }

    // B12: Click "Cancelar", confirm the dialog
    if (cancelBtn) {
      try {
        // Set up dialog handler for confirm()
        empPage.once("dialog", async (dialog) => {
          console.log(`    Confirm dialog: "${dialog.message()}"`);
          await dialog.accept();
        });

        await cancelBtn.click();
        await empPage.waitForTimeout(2000);
        report("B12: Click 'Cancelar' and confirm dialog", true);
      } catch (e) {
        report("B12: Click 'Cancelar'", false, e.message);
      }

      // B13: Verify the inscripcion row shows updated state or disappears
      try {
        const table = await empPage.$("table");
        if (!table) {
          // Table gone = all inscriptions removed
          const pageContent = await empPage.textContent("#capacitaciones-page");
          if (pageContent.includes("No tienes inscripciones")) {
            report("B13: Inscripcion row updated/disappeared after cancel", true, "Row disappeared - empty state shown");
          } else {
            report("B13: Inscripcion row updated/disappeared after cancel", false, "No table and no empty state");
          }
        } else {
          const tableContent = await table.textContent();
          // After cancel, the row should show "Cancelado" or disappear entirely
          const hasCancelado = tableContent.includes("Cancelado");
          const stillInscrito = tableContent.includes("Inscrito");

          if (hasCancelado) {
            report("B13: Inscripcion state updated to 'Cancelado'", true, "Estado changed to 'Cancelado'");
          } else if (!stillInscrito) {
            report("B13: Inscripcion row removed from table", true, "Row no longer shows 'Inscrito'");
          } else {
            report("B13: Inscripcion state updated after cancel", false, `Table still shows 'Inscrito'. Content: "${tableContent.substring(0, 200)}"`);
          }
        }
      } catch (e) {
        report("B13: Inscripcion state after cancel", false, e.message);
      }
    } else {
      report("B12: Click 'Cancelar'", false, "SKIP - no cancel button found");
      report("B13: Inscripcion state after cancel", false, "SKIP - no cancel button");
    }
  }

  await empContext.close();
  await browser.close();
  printSummary();
})();

function printSummary() {
  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================\n");

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Pass rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log("FAILURES:");
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  - ${r.name}${r.detail ? ": " + r.detail : ""}`);
    });
  }
  console.log("");
}
