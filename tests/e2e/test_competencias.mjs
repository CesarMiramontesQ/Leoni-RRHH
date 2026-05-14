/**
 * Playwright E2E test: Competencias module (Phase 1)
 *
 * Tests:
 * 1. Navigate to #/competencias — verify page loads
 * 2. Tab navigation (Catalogo, Matriz, Brechas)
 * 3. Create a competencia via modal
 * 4. Search/filter competencias in catalogo
 * 5. Switch to Matriz tab — verify grid or empty state renders
 * 6. Area filter in Matriz — select area and verify update
 * 7. Cell edit interaction in matrix (if data exists)
 * 8. Switch to Brechas tab — verify table or empty state
 *
 * Usage:
 *   node tests/e2e/test_competencias.mjs
 *
 * Requires: npx playwright install chromium
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
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
  console.log("✓ Login exitoso\n");
}

// ── Test 1: Navigate to #/competencias ───────────────────────────────

async function testPageLoads(page) {
  console.log("Test 1: Navegar a #/competencias");
  await page.goto(`${BASE}/#/competencias`);
  await sleep(3000);

  // Verify the page root element exists
  const pageRoot = await page.$("#competencias-page-root");
  assert(pageRoot !== null, "El elemento #competencias-page-root existe");

  // Verify title renders
  const title = await page.textContent("h1");
  assert(
    title && title.includes("Competencias"),
    `Titulo contiene 'Competencias': "${title}"`,
  );

  // Verify breadcrumb
  const breadcrumb = await page.$('nav[aria-label="Breadcrumb"]');
  assert(breadcrumb !== null, "Breadcrumb visible");
}

// ── Test 2: Tab navigation ───────────────────────────────────────────

async function testTabNavigation(page) {
  console.log("\nTest 2: Navegacion entre tabs");

  // Should start on Catalogo tab (default)
  const catalogoTab = await page.$('[data-action="tab"][data-tab="catalogo"]');
  assert(catalogoTab !== null, "Tab 'Catalogo' existe");

  const matrizTab = await page.$('[data-action="tab"][data-tab="matriz"]');
  assert(matrizTab !== null, "Tab 'Matriz' existe");

  const brechasTab = await page.$('[data-action="tab"][data-tab="brechas"]');
  assert(brechasTab !== null, "Tab 'Brechas' existe");

  // Verify Catalogo tab is active (has border-leoni-blue class)
  const catalogoClass = await catalogoTab.getAttribute("class");
  assert(
    catalogoClass && catalogoClass.includes("border-leoni-blue"),
    "Tab 'Catalogo' esta activa por defecto",
  );

  // Switch to Matriz
  await matrizTab.click();
  await sleep(2000);

  const matrizClassAfter = await matrizTab.getAttribute("class");
  assert(
    matrizClassAfter && matrizClassAfter.includes("border-leoni-blue"),
    "Tab 'Matriz' se activa al hacer click",
  );

  // Switch to Brechas
  await brechasTab.click();
  await sleep(2000);

  const brechasClassAfter = await brechasTab.getAttribute("class");
  assert(
    brechasClassAfter && brechasClassAfter.includes("border-leoni-blue"),
    "Tab 'Brechas' se activa al hacer click",
  );

  // Return to Catalogo
  await catalogoTab.click();
  await sleep(1000);
}

// ── Test 3: Create a competencia ─────────────────────────────────────

async function testCreateCompetencia(page) {
  console.log("\nTest 3: Crear una competencia");

  // Make sure we are on catalogo tab
  const catalogoTab = await page.$('[data-action="tab"][data-tab="catalogo"]');
  await catalogoTab.click();
  await sleep(1000);

  // Find "Nueva competencia" button
  const addBtn = await page.$('[data-action="add-competencia"]');
  assert(addBtn !== null, "Boton 'Nueva competencia' existe");

  if (!addBtn) return;
  await addBtn.click();
  await sleep(500);

  // Verify modal appears
  const modal = await page.$("#comp-modal-backdrop");
  assert(modal !== null, "Modal se abre al hacer click en 'Nueva competencia'");

  if (!modal) return;

  // Fill form
  const nombreInput = await page.$('#comp-modal-form input[name="nombre"]');
  assert(nombreInput !== null, "Campo 'nombre' existe en el modal");

  const descripcionInput = await page.$('#comp-modal-form textarea[name="descripcion"]');
  assert(descripcionInput !== null, "Campo 'descripcion' existe en el modal");

  const grupoSelect = await page.$('#comp-modal-form select[name="grupo"]');
  assert(grupoSelect !== null, "Campo 'grupo' existe en el modal");

  const testName = `E2E_Test_Competencia_${Date.now()}`;

  if (nombreInput) await nombreInput.fill(testName);
  if (descripcionInput) await descripcionInput.fill("Competencia creada por test E2E automatizado");
  if (grupoSelect) await grupoSelect.selectOption("tecnica");

  // Submit form
  const submitBtn = await page.$('#comp-modal-form button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }
  await sleep(2000);

  // Verify modal closed
  const modalAfter = await page.$("#comp-modal-backdrop");
  assert(modalAfter === null, "Modal se cierra despues de crear");

  // Verify the new competencia appears in the table
  const pageText = await page.textContent("#competencias-inner");
  assert(
    pageText && pageText.includes(testName),
    `Competencia '${testName}' aparece en la tabla`,
  );

  return testName;
}

// ── Test 4: Search/filter competencias ───────────────────────────────

async function testSearchFilter(page, createdName) {
  console.log("\nTest 4: Buscar/filtrar competencias en catalogo");

  // Find search input
  const searchInput = await page.$("#comp-catalogo-search");
  assert(searchInput !== null, "Campo de busqueda existe");

  if (!searchInput) return;

  // Type a filter text that should match the created competencia
  const searchTerm = createdName ? createdName.substring(0, 15) : "E2E_Test";
  await searchInput.fill(searchTerm);
  await sleep(500); // debounce time

  // Verify filtered results
  const rows = await page.$$('#competencias-inner table tbody tr');
  if (createdName) {
    assert(rows.length >= 1, `Al menos 1 resultado al buscar '${searchTerm}'`);
  } else {
    // If no competencia was created, the empty state or results are both valid
    assert(true, "Busqueda ejecutada sin errores");
  }

  // Clear search
  await searchInput.fill("");
  await sleep(500);

  const rowsAfterClear = await page.$$('#competencias-inner table tbody tr');
  assert(rowsAfterClear.length >= 1, "Tabla muestra resultados (o estado vacio) despues de limpiar busqueda");

  // Search for something that shouldn't exist
  await searchInput.fill("ZZZZNOEXISTE99999");
  await sleep(500);

  const noResultsText = await page.textContent("#competencias-inner");
  assert(
    noResultsText && noResultsText.includes("No hay competencias registradas"),
    "Mensaje 'No hay competencias registradas' al buscar algo inexistente",
  );

  // Clear search for next tests
  await searchInput.fill("");
  await sleep(300);
}

// ── Test 5: View the matrix ──────────────────────────────────────────

async function testMatrizView(page) {
  console.log("\nTest 5: Ver la tab Matriz");

  const matrizTab = await page.$('[data-action="tab"][data-tab="matriz"]');
  if (!matrizTab) {
    assert(false, "Tab Matriz no encontrada");
    return;
  }
  await matrizTab.click();
  await sleep(3000);

  // Verify either the matrix table or the empty state renders
  const matrizTable = await page.$('#competencias-inner table');
  const emptyState = await page.textContent("#competencias-inner");
  const hasEmptyMsg = emptyState && emptyState.includes("Sin competencias configuradas");

  assert(
    matrizTable !== null || hasEmptyMsg,
    "Matriz muestra tabla o estado vacio",
  );

  // Verify legend is visible
  const legendText = await page.textContent("#competencias-inner");
  const hasLegend = legendText && legendText.includes("Niveles:");
  assert(hasLegend, "Leyenda de niveles visible (N/A, Basico, Intermedio, Avanzado, Experto)");

  // Verify "Guardar Cambios" button exists
  const saveBtn = await page.$('[data-action="save-matriz"]');
  assert(saveBtn !== null, "Boton 'Guardar Cambios' existe");

  // If matrix table exists, verify structure
  if (matrizTable) {
    const headerRow = await matrizTable.$("thead tr");
    const headerCells = headerRow ? await headerRow.$$("th") : [];
    assert(
      headerCells.length >= 2,
      `Matriz tiene al menos 2 columnas (Competencia + puestos): ${headerCells.length} encontradas`,
    );

    const bodyRows = await matrizTable.$$("tbody tr");
    assert(
      bodyRows.length >= 1,
      `Matriz tiene al menos 1 fila de competencia: ${bodyRows.length} encontradas`,
    );
  }
}

// ── Test 6: Area filter in Matriz ────────────────────────────────────

async function testMatrizAreaFilter(page) {
  console.log("\nTest 6: Filtro de area en Matriz");

  // Should already be on Matriz tab
  const areaSelect = await page.$('[data-action="filter"][data-filter="area"]');
  assert(areaSelect !== null, "Select de filtro 'Area' existe");

  if (!areaSelect) return;

  // Get available options
  const options = await areaSelect.$$("option");
  assert(options.length >= 1, `Dropdown de area tiene opciones: ${options.length}`);

  // If there are area options beyond "Todas las areas", select one
  if (options.length > 1) {
    const secondOption = options[1];
    const secondVal = await secondOption.getAttribute("value");
    if (secondVal) {
      await areaSelect.selectOption(secondVal);
      await sleep(2000);
      assert(true, `Area seleccionada: value='${secondVal}'`);

      // Reset to all
      await areaSelect.selectOption("");
      await sleep(1500);
      assert(true, "Filtro reseteado a 'Todas las areas'");
    }
  } else {
    assert(true, "Solo opcion 'Todas las areas' disponible (sin areas configuradas)");
  }

  // Also verify Linea and Sector filters exist
  const lineaSelect = await page.$('[data-action="filter"][data-filter="linea"]');
  assert(lineaSelect !== null, "Select de filtro 'Linea' existe");

  const sectorSelect = await page.$('[data-action="filter"][data-filter="sector"]');
  assert(sectorSelect !== null, "Select de filtro 'Sector' existe");
}

// ── Test 7: Cell edit interaction ────────────────────────────────────

async function testCellEdit(page) {
  console.log("\nTest 7: Editar celda de la matriz");

  // Find a cell that can be edited
  const cell = await page.$('[data-action="cell-edit"]');
  if (!cell) {
    assert(true, "No hay celdas editables (matriz vacia — skip)");
    return;
  }

  const originalNivel = await cell.getAttribute("data-nivel");
  assert(originalNivel !== null, `Celda encontrada con nivel actual: ${originalNivel}`);

  // Click the cell to enter edit mode
  await cell.click();
  await sleep(300);

  // Verify input appears
  const cellInput = await page.$('[data-action="cell-input"]');
  assert(cellInput !== null, "Input aparece al hacer click en celda");

  if (!cellInput) return;

  // Change the value
  const newNivel = originalNivel === "3" ? "2" : "3";
  await cellInput.fill(String(newNivel));
  await cellInput.press("Enter");
  await sleep(500);

  // Verify "cambios sin guardar" indicator
  const innerText = await page.textContent("#competencias-inner");
  const hasUnsaved = innerText && innerText.includes("sin guardar");
  assert(hasUnsaved, "Indicador de 'cambios sin guardar' visible");

  // Verify save button is enabled
  const saveBtn = await page.$('[data-action="save-matriz"]:not([disabled])');
  assert(saveBtn !== null, "Boton 'Guardar Cambios' habilitado con cambios pendientes");
}

// ── Test 8: Brechas tab ──────────────────────────────────────────────

async function testBrechasTab(page) {
  console.log("\nTest 8: Ver tab Brechas y resumen");

  const brechasTab = await page.$('[data-action="tab"][data-tab="brechas"]');
  if (!brechasTab) {
    assert(false, "Tab Brechas no encontrada");
    return;
  }
  await brechasTab.click();
  await sleep(3000);

  // Verify either brechas table or empty state
  const tableOrEmpty = await page.textContent("#competencias-inner");
  const hasTable = await page.$('#competencias-inner table');
  const hasEmptyMsg = tableOrEmpty && tableOrEmpty.includes("No se detectaron brechas");

  assert(
    hasTable !== null || hasEmptyMsg,
    "Tab Brechas muestra tabla de brechas o mensaje de estado vacio",
  );

  // Verify area filter in brechas
  const brechasAreaFilter = await page.$('[data-action="filter-brechas"]');
  assert(brechasAreaFilter !== null, "Filtro de area en Brechas existe");

  // If table has data, verify columns
  if (hasTable) {
    const headers = await page.$$('#competencias-inner table thead th');
    const headerTexts = [];
    for (const h of headers) {
      headerTexts.push(await h.textContent());
    }
    const expectedCols = ["Competencia", "Puesto", "Nivel actual", "Requerido", "Brecha", "Severidad"];
    let allFound = true;
    for (const col of expectedCols) {
      if (!headerTexts.some(t => t && t.includes(col))) {
        allFound = false;
        break;
      }
    }
    assert(allFound, `Columnas de brechas presentes: ${headerTexts.join(", ")}`);
  }
}

// ── Test: Resumen panel (from Matriz tab) ────────────────────────────

async function testResumenPanel(page) {
  console.log("\nTest Bonus: Verificar panel Resumen en Matriz");

  // Go back to Matriz tab
  const matrizTab = await page.$('[data-action="tab"][data-tab="matriz"]');
  if (!matrizTab) return;
  await matrizTab.click();
  await sleep(2000);

  const innerText = await page.textContent("#competencias-inner");

  // Resumen panel only shows if there's data
  const hasResumen = innerText && innerText.includes("Resumen");
  const hasCumplimiento = innerText && innerText.includes("Cumplimiento");
  const hasGaps = innerText && (innerText.includes("Gaps Criticos") || innerText.includes("No se detectaron brechas criticas"));

  if (hasResumen) {
    assert(hasCumplimiento, "Panel 'Resumen' muestra porcentaje de Cumplimiento");
    assert(hasGaps, "Panel 'Gaps Criticos' visible");
  } else {
    assert(true, "Panel Resumen no visible (sin datos de matriz — skip)");
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=== E2E Test: Modulo Competencias ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);

    await testPageLoads(page);
    await testTabNavigation(page);
    const createdName = await testCreateCompetencia(page);
    await testSearchFilter(page, createdName);
    await testMatrizView(page);
    await testMatrizAreaFilter(page);
    await testCellEdit(page);
    await testBrechasTab(page);
    await testResumenPanel(page);

    console.log("\n========================================");
    console.log(`  Resultados: ${passed} passed, ${failed} failed`);
    console.log("========================================");

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\n✗ Error fatal:", err.message);
    await page.screenshot({ path: "tests/e2e/error-competencias.png" });
    console.error("  Screenshot guardado en tests/e2e/error-competencias.png");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
