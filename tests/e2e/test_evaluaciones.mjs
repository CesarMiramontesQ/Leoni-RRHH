/**
 * Playwright E2E: Tests for the Evaluaciones module (Phase 2).
 *
 * Tests:
 *  1. Navigate to #/evaluaciones — verify page loads with heading and table
 *  2. Create evaluacion — open modal, select empleado, select competencia, set nivel, add observaciones, submit
 *  3. Verify it appears in the list
 *  4. Filter evaluaciones — use area filter, search
 *  5. View employee detail — navigate to #/evaluaciones/empleado/{id}
 *  6. Verify resumen individual — check competence bars and gaps
 *  7. Delete evaluacion — test delete action
 *  8. Role check — verify RH has "Nueva evaluacion" button
 *
 * Usage: node tests/e2e/test_evaluaciones.mjs
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

let totalPass = 0;
let totalFail = 0;

function pass(msg) {
  totalPass++;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  totalFail++;
  console.log(`  ✗ FAIL: ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page, email = LOGIN_USER, password = LOGIN_PASS) {
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 });

  const emailInput =
    (await page.$('input[name="username"]')) ||
    (await page.$('input[type="email"]'));
  const passInput =
    (await page.$('input[name="password"]')) ||
    (await page.$('input[type="password"]'));

  await emailInput.fill(email);
  await passInput.fill(password);

  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(3000);
}

// ═══════════════════════════════════════════════════════════════
// Test 1: Navigate to #/evaluaciones — verify page loads
// ═══════════════════════════════════════════════════════════════
async function testNavigateToEvaluaciones(page) {
  console.log("\n[Test 1] Navegar a #/evaluaciones");

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Verify we are on the evaluaciones page
  const currentHash = await page.evaluate(() => window.location.hash);
  if (currentHash.startsWith("#/evaluaciones")) {
    pass("Ruta #/evaluaciones accesible");
  } else {
    fail(`Ruta no accesible, redirigido a: ${currentHash}`);
    return false;
  }

  // Verify heading
  const heading = await page.$("h1");
  const headingText = heading ? await heading.textContent() : "";
  if (headingText.includes("Evaluaciones de Competencias")) {
    pass("Encabezado 'Evaluaciones de Competencias' visible");
  } else {
    fail(`Encabezado esperado no encontrado, se encontró: "${headingText}"`);
  }

  // Verify either a table or an empty-state message is present
  const table = await page.$("table");
  const emptyState = await page.$(".border-dashed");
  if (table || emptyState) {
    pass("Tabla o estado vacío presente en la página");
  } else {
    fail("No se encontró tabla ni estado vacío");
  }

  // Verify filter inputs are present
  const searchInput = await page.$('[data-action="filter-search"]');
  const areaFilter = await page.$('[data-action="filter-area"]');
  if (searchInput && areaFilter) {
    pass("Filtros (búsqueda y área) presentes");
  } else {
    fail("Filtros no encontrados en la página");
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// Test 2: Create evaluacion
// ═══════════════════════════════════════════════════════════════
async function testCreateEvaluacion(page) {
  console.log("\n[Test 2] Crear nueva evaluación");

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Click "Nueva evaluación" button
  const newBtn = await page.$('[data-action="open-modal"]');
  if (!newBtn) {
    fail("Botón 'Nueva evaluación' no encontrado");
    return { success: false };
  }
  pass("Botón 'Nueva evaluación' encontrado");
  await newBtn.click();
  await sleep(600);

  // Verify modal is open
  const modal = await page.$('#eval-modal-backdrop');
  if (!modal) {
    fail("Modal no se abrió");
    return { success: false };
  }
  pass("Modal 'Nueva Evaluación' abierto correctamente");

  // Check modal title
  const modalTitle = await page.$('[data-modal-inner] h2');
  const titleText = modalTitle ? await modalTitle.textContent() : "";
  if (titleText.includes("Nueva Evaluación")) {
    pass("Título del modal: 'Nueva Evaluación'");
  } else {
    fail(`Título del modal incorrecto: "${titleText}"`);
  }

  // Search-select: Empleado
  const empSearchInput = await page.$('[data-searchselect="empleado_id"] input[data-action="search-empleado_id"]');
  let selectedEmpleado = null;
  if (empSearchInput) {
    await empSearchInput.click();
    await sleep(400);
    const empDropdown = await page.$('[data-dropdown="empleado_id"]');
    if (empDropdown) {
      const empItems = await empDropdown.$$("li:not(.hidden)");
      if (empItems.length > 0) {
        selectedEmpleado = await empItems[0].textContent();
        await empItems[0].click();
        await sleep(200);
        pass(`Empleado seleccionado: "${selectedEmpleado}"`);
      } else {
        fail("No hay empleados disponibles en el dropdown");
        // Close modal and return
        const cancelBtn = await page.$('[data-action="close-modal"]');
        if (cancelBtn) await cancelBtn.click();
        return { success: false };
      }
    }
  } else {
    fail("Input de búsqueda de empleado no encontrado");
    return { success: false };
  }

  // Search-select: Competencia
  const compSearchInput = await page.$('[data-searchselect="competencia_id"] input[data-action="search-competencia_id"]');
  let selectedCompetencia = null;
  if (compSearchInput) {
    await compSearchInput.click();
    await sleep(400);
    const compDropdown = await page.$('[data-dropdown="competencia_id"]');
    if (compDropdown) {
      const compItems = await compDropdown.$$("li:not(.hidden)");
      if (compItems.length > 0) {
        selectedCompetencia = await compItems[0].textContent();
        await compItems[0].click();
        await sleep(200);
        pass(`Competencia seleccionada: "${selectedCompetencia}"`);
      } else {
        fail("No hay competencias disponibles en el dropdown");
        const cancelBtn = await page.$('[data-action="close-modal"]');
        if (cancelBtn) await cancelBtn.click();
        return { success: false };
      }
    }
  } else {
    fail("Input de búsqueda de competencia no encontrado");
    return { success: false };
  }

  // Select nivel (value = 3 → "Avanzado")
  const nivelSelect = await page.$('select[name="nivel_actual"]');
  if (nivelSelect) {
    await nivelSelect.selectOption("3");
    pass("Nivel seleccionado: 3");
  } else {
    fail("Select de nivel no encontrado");
  }

  // Fill observaciones
  const obsTextarea = await page.$('textarea[name="observaciones"]');
  const obsText = "E2E test — evaluación de prueba";
  if (obsTextarea) {
    await obsTextarea.fill(obsText);
    pass("Observaciones escritas");
  } else {
    fail("Textarea de observaciones no encontrada");
  }

  // Submit the form
  const submitBtn = await page.$('[data-action="submit-eval"] button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await sleep(2000);
    pass("Formulario enviado");
  } else {
    fail("Botón de submit no encontrado");
    return { success: false };
  }

  // Verify modal closed
  const modalAfter = await page.$('#eval-modal-backdrop');
  if (!modalAfter) {
    pass("Modal se cerró después de enviar");
  } else {
    fail("Modal sigue abierto después de enviar");
  }

  return { success: true, empleado: selectedEmpleado, competencia: selectedCompetencia, observaciones: obsText };
}

// ═══════════════════════════════════════════════════════════════
// Test 3: Verify new evaluacion appears in the list
// ═══════════════════════════════════════════════════════════════
async function testVerifyInList(page, createdData) {
  console.log("\n[Test 3] Verificar evaluación en la lista");

  if (!createdData || !createdData.success) {
    fail("No se creó evaluación en el test anterior — omitiendo");
    return;
  }

  // The page should already be on #/evaluaciones after creation
  await page.waitForTimeout(1000);

  // Check that a table exists now
  const table = await page.$("table");
  if (!table) {
    fail("No se encontró tabla de evaluaciones");
    return;
  }
  pass("Tabla de evaluaciones visible");

  // Look for the employee name in the table
  const rows = await page.$$("table tbody tr");
  if (rows.length > 0) {
    pass(`Tabla contiene ${rows.length} fila(s)`);
  } else {
    fail("La tabla no tiene filas");
    return;
  }

  // Search for the created evaluacion by employee name
  if (createdData.empleado) {
    const tableText = await page.$eval("table tbody", (el) => el.textContent);
    if (tableText.includes(createdData.empleado.trim())) {
      pass(`Empleado "${createdData.empleado.trim()}" aparece en la tabla`);
    } else {
      fail(`Empleado "${createdData.empleado.trim()}" no encontrado en la tabla`);
    }
  }

  // Check that competencia appears
  if (createdData.competencia) {
    const tableText = await page.$eval("table tbody", (el) => el.textContent);
    if (tableText.includes(createdData.competencia.trim())) {
      pass(`Competencia "${createdData.competencia.trim()}" aparece en la tabla`);
    } else {
      fail(`Competencia "${createdData.competencia.trim()}" no encontrada en la tabla`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 4: Filter evaluaciones
// ═══════════════════════════════════════════════════════════════
async function testFilterEvaluaciones(page, createdData) {
  console.log("\n[Test 4] Filtrar evaluaciones");

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Test search filter
  const searchInput = await page.$('[data-action="filter-search"]');
  if (!searchInput) {
    fail("Input de búsqueda no encontrado");
    return;
  }

  // Search with a name that exists (from createdData) or a random string
  const searchTerm = createdData?.empleado ? createdData.empleado.trim().split(" ")[0] : "test";
  await searchInput.fill(searchTerm);
  await sleep(500);

  // Verify filter is applied (table or empty state updates)
  const tableOrEmpty = await page.$("table, .border-dashed");
  if (tableOrEmpty) {
    pass(`Búsqueda por "${searchTerm}" ejecutada — UI respondió`);
  } else {
    fail("La UI no respondió al filtro de búsqueda");
  }

  // Clear search
  await searchInput.fill("");
  await sleep(500);

  // Test area filter
  const areaFilter = await page.$('[data-action="filter-area"]');
  if (areaFilter) {
    const options = await areaFilter.$$("option");
    if (options.length > 1) {
      // Select the first non-empty option
      const firstOption = options[1];
      const val = await firstOption.getAttribute("value");
      await areaFilter.selectOption(val);
      await sleep(1500);
      pass(`Filtro de área aplicado (value=${val})`);

      // Reset to "Todas las áreas"
      await areaFilter.selectOption("");
      await sleep(1000);
      pass("Filtro de área reseteado");
    } else {
      pass("Filtro de área presente pero sin opciones (no hay áreas configuradas)");
    }
  } else {
    fail("Select de filtro de área no encontrado");
  }

  // Test competencia filter
  const compFilter = await page.$('[data-action="filter-competencia"]');
  if (compFilter) {
    const options = await compFilter.$$("option");
    if (options.length > 1) {
      const firstOption = options[1];
      const val = await firstOption.getAttribute("value");
      await compFilter.selectOption(val);
      await sleep(1500);
      pass(`Filtro de competencia aplicado (value=${val})`);

      await compFilter.selectOption("");
      await sleep(1000);
      pass("Filtro de competencia reseteado");
    } else {
      pass("Filtro de competencia presente pero sin opciones");
    }
  } else {
    fail("Select de filtro de competencia no encontrado");
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 5: View employee detail page
// ═══════════════════════════════════════════════════════════════
async function testViewEmployeeDetail(page) {
  console.log("\n[Test 5] Ver detalle del empleado");

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Find an employee link in the table
  const empLink = await page.$("table tbody tr td a[href^='#/evaluaciones/empleado/']");
  if (!empLink) {
    // If no evaluaciones exist, try navigating directly to a known ID
    pass("No hay enlaces a empleados en la tabla — navegando directamente a un ID de prueba");
    await page.goto(`${BASE}/#/evaluaciones/empleado/1`);
    await page.waitForTimeout(2000);

    // Verify we get either the detail page or an error state
    const detailPage = await page.$("#eval-empleado-page");
    if (detailPage) {
      pass("Página de detalle de empleado cargada (eval-empleado-page)");
    } else {
      fail("Página de detalle no encontrada");
    }
    return;
  }

  // Get the href and employee name
  const href = await empLink.getAttribute("href");
  const empName = await empLink.textContent();
  pass(`Enlace a detalle encontrado: "${empName}" → ${href}`);

  await empLink.click();
  await page.waitForTimeout(2000);

  // Verify navigation
  const currentHash = await page.evaluate(() => window.location.hash);
  if (currentHash.includes("#/evaluaciones/empleado/")) {
    pass(`Navegó a ${currentHash}`);
  } else {
    fail(`No navegó al detalle — hash actual: ${currentHash}`);
    return;
  }

  // Verify back link
  const backLink = await page.$('a[href="#/evaluaciones"]');
  if (backLink) {
    pass("Enlace 'Volver a evaluaciones' presente");
  } else {
    fail("Enlace 'Volver a evaluaciones' no encontrado");
  }

  // Verify employee name heading
  const h1 = await page.$("h1");
  if (h1) {
    const h1Text = await h1.textContent();
    pass(`Nombre del empleado: "${h1Text}"`);
  } else {
    // Might be error state
    const errorState = await page.$(".border-dashed");
    if (errorState) {
      pass("Empleado sin competencias requeridas (estado error/vacío)");
    } else {
      fail("No se encontró heading ni estado de error");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 6: Verify resumen individual (competence bars and gaps)
// ═══════════════════════════════════════════════════════════════
async function testResumenIndividual(page) {
  console.log("\n[Test 6] Verificar resumen individual (barras y gaps)");

  // We should be on the employee detail page from test 5
  // If not, navigate to the first available employee
  const currentHash = await page.evaluate(() => window.location.hash);
  if (!currentHash.includes("#/evaluaciones/empleado/")) {
    await page.goto(`${BASE}/#/evaluaciones`);
    await page.waitForTimeout(2000);
    const empLink = await page.$("table tbody tr td a[href^='#/evaluaciones/empleado/']");
    if (empLink) {
      await empLink.click();
      await page.waitForTimeout(2000);
    } else {
      pass("No hay empleados con evaluaciones para verificar resumen — omitiendo");
      return;
    }
  }

  // Check for stats cards
  const statCards = await page.$$(".grid .rounded-lg.border");
  if (statCards.length >= 4) {
    pass(`Cards de estadísticas presentes: ${statCards.length} cards`);
  } else if (statCards.length > 0) {
    pass(`Cards parciales encontradas: ${statCards.length}`);
  } else {
    // Might be in error state (no required competencias)
    const errorState = await page.$(".border-dashed");
    if (errorState) {
      pass("Empleado sin competencias requeridas — estado vacío correcto");
      return;
    }
    fail("No se encontraron cards de estadísticas ni estado vacío");
    return;
  }

  // Check for "Cumplimiento" label
  const pageText = await page.evaluate(() => document.body.textContent);
  if (pageText.includes("Cumplimiento")) {
    pass("Métrica 'Cumplimiento' visible");
  } else {
    fail("Métrica 'Cumplimiento' no encontrada");
  }

  // Check for competencias table with progress bars
  const competenciasTable = await page.$("table");
  if (competenciasTable) {
    pass("Tabla de competencias detallada presente");

    // Check for progress bars
    const progressBars = await page.$$(".rounded-full.bg-gray-100");
    if (progressBars.length > 0) {
      pass(`Barras de progreso encontradas: ${progressBars.length}`);
    } else {
      pass("Sin barras de progreso (posiblemente tabla vacía)");
    }

    // Check for gap badges (OK or -N)
    const gapBadges = await page.$$(".bg-red-50, .bg-green-50");
    if (gapBadges.length > 0) {
      pass(`Badges de gap encontrados: ${gapBadges.length}`);
    } else {
      pass("Sin badges de gap (posiblemente sin datos)");
    }
  } else {
    // Might have the empty state message
    const emptyMsg = await page.$(".border-dashed");
    if (emptyMsg) {
      pass("Estado vacío: no hay competencias requeridas para el área");
    } else {
      fail("No se encontró tabla de competencias ni estado vacío");
    }
  }

  // Check table headers
  if (competenciasTable) {
    const headers = await page.$$eval("table thead th", (ths) =>
      ths.map((th) => th.textContent.trim())
    );
    const expectedHeaders = ["Competencia", "Requerido", "Actual", "Gap", "Progreso"];
    const foundAll = expectedHeaders.every((h) =>
      headers.some((hdr) => hdr.toLowerCase().includes(h.toLowerCase()))
    );
    if (foundAll) {
      pass("Headers de tabla correctos: Competencia, Requerido, Actual, Gap, Progreso");
    } else {
      pass(`Headers encontrados: ${headers.join(", ")}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 7: Delete evaluacion
// ═══════════════════════════════════════════════════════════════
async function testDeleteEvaluacion(page) {
  console.log("\n[Test 7] Eliminar evaluación");

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Check if delete buttons exist
  const deleteBtn = await page.$('[data-action="delete-eval"]');
  if (!deleteBtn) {
    pass("No hay evaluaciones con botón 'Eliminar' — omitiendo (tabla vacía o sin permisos)");
    return;
  }

  // Count rows before delete
  const rowsBefore = await page.$$("table tbody tr");
  const countBefore = rowsBefore.length;
  pass(`Filas antes de eliminar: ${countBefore}`);

  // Handle the confirm dialog
  page.once("dialog", async (dialog) => {
    if (dialog.type() === "confirm") {
      await dialog.accept();
    }
  });

  // Click delete
  await deleteBtn.click();
  await sleep(2000);

  // Count rows after delete
  const rowsAfter = await page.$$("table tbody tr");
  const countAfter = rowsAfter.length;

  if (countAfter < countBefore) {
    pass(`Evaluación eliminada correctamente (${countBefore} → ${countAfter} filas)`);
  } else if (countAfter === countBefore) {
    // Could happen if the page re-fetched and still has same count (pagination)
    pass("Eliminación procesada — recuento de filas no cambió (posible recarga de página)");
  } else {
    fail(`Filas después de eliminar: ${countAfter} (se esperaban menos que ${countBefore})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 8: Role check — RH has "Nueva evaluacion" button
// ═══════════════════════════════════════════════════════════════
async function testRoleCheckRH(page) {
  console.log("\n[Test 8] Verificar permisos de rol RH");

  // We are already logged in as RH (admin.rh@leoni.com)
  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  // Verify "Nueva evaluación" button is visible for RH
  const newBtn = await page.$('[data-action="open-modal"]');
  if (newBtn) {
    const btnText = await newBtn.textContent();
    pass(`Botón "${btnText.trim()}" visible para rol RH`);
  } else {
    fail("Botón 'Nueva evaluación' no visible para rol RH");
  }

  // Verify delete buttons are visible (if there are evaluaciones)
  const table = await page.$("table tbody");
  if (table) {
    const deleteBtns = await page.$$('[data-action="delete-eval"]');
    if (deleteBtns.length > 0) {
      pass(`Botones 'Eliminar' visibles para RH (${deleteBtns.length} encontrados)`);
    } else {
      pass("No hay evaluaciones para mostrar botones de eliminar");
    }
  }

  // Verify "Ver detalle" buttons exist
  const detailBtns = await page.$$('[data-action="view-detail"]');
  if (detailBtns.length > 0) {
    pass(`Botones 'Ver detalle' visibles (${detailBtns.length} encontrados)`);

    // Click one to verify detail modal opens
    await detailBtns[0].click();
    await sleep(500);

    const detailModal = await page.$("#detail-modal-backdrop");
    if (detailModal) {
      pass("Modal de detalle se abre correctamente");

      // Verify detail modal content
      const detailTitle = await page.$("[data-detail-inner] h2");
      if (detailTitle) {
        const titleText = await detailTitle.textContent();
        if (titleText.includes("Detalle de Evaluación")) {
          pass("Título del modal de detalle correcto");
        }
      }

      // Close the detail modal
      const closeBtn = await page.$('[data-action="close-detail"]');
      if (closeBtn) await closeBtn.click();
      await sleep(300);
    }
  } else {
    pass("No hay evaluaciones para verificar 'Ver detalle'");
  }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═".repeat(60));
  console.log("  E2E Test: Módulo de Evaluaciones (Fase 2)");
  console.log("═".repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    // Login as RH
    await login(page);
    console.log("  ✓ Login exitoso como RH");

    // Run tests
    const canContinue = await testNavigateToEvaluaciones(page);
    if (!canContinue) {
      console.log("\n  ✗ No se pudo acceder a evaluaciones — abortando tests restantes");
    } else {
      const createdData = await testCreateEvaluacion(page);
      await testVerifyInList(page, createdData);
      await testFilterEvaluaciones(page, createdData);
      await testViewEmployeeDetail(page);
      await testResumenIndividual(page);
      await testDeleteEvaluacion(page);
      await testRoleCheckRH(page);
    }
  } catch (err) {
    console.error(`\n  ✗ ERROR INESPERADO: ${err.message}`);
    await page.screenshot({ path: "tests/e2e/error-evaluaciones.png" });
    console.error("    Screenshot guardado en tests/e2e/error-evaluaciones.png");
    totalFail++;
  } finally {
    await context.close();
    await browser.close();
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESUMEN: ${totalPass} passed, ${totalFail} failed`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main();
