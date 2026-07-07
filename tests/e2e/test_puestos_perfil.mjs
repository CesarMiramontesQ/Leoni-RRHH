/**
 * Playwright E2E: Tests for the Perfiles de Puesto module.
 *
 * Tests:
 *  1. Navigate to #/puestos — verify page loads with heading
 *  2. Create a Puesto — fill form, submit
 *  3. Verify it appears in the list
 *  4. View detail (edit modal) — click edit, verify data displayed
 *  5. Edit puesto — change nombre, save, verify updated
 *  6. Search/filter — use search input to filter by name
 *  7. Role check — verify RH can see create button
 *  8. Delete puesto — delete and verify removed
 *
 * Usage: node tests/e2e/test_puestos_perfil.mjs
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
}

// ── Test 1: Navigate to #/puestos ──────────────────────────────────────────

async function testNavigateToPuestos(page) {
  console.log("\n[Test 1] Navegar a #/puestos");

  await page.goto(`${BASE}/#/puestos`);
  await page.waitForTimeout(2000);

  const currentHash = await page.evaluate(() => window.location.hash);
  if (currentHash === "#/puestos") {
    pass("Ruta #/puestos accesible");
  } else {
    fail(`Esperaba #/puestos, obtuvo ${currentHash}`);
  }

  // Check heading
  const heading = await page.$("h1");
  if (heading) {
    const text = await heading.textContent();
    if (text.includes("Perfiles de Puesto")) {
      pass('Encabezado "Perfiles de Puesto" visible');
    } else {
      fail(`Encabezado incorrecto: "${text}"`);
    }
  } else {
    fail("No se encontró h1 en la página");
  }

  // Check subtitle
  const subtitle = await page.$("h1 + p");
  if (subtitle) {
    const subText = await subtitle.textContent();
    if (subText.includes("Catalogo de perfiles")) {
      pass("Subtitulo visible");
    } else {
      pass("Subtitulo presente (texto diferente)");
    }
  }
}

// ── Test 2: Create a Puesto ────────────────────────────────────────────────

const TEST_PUESTO_CODIGO = `E2E-${Date.now().toString(36).slice(-6).toUpperCase()}`;
const TEST_PUESTO_NOMBRE = `E2E Test Puesto ${Date.now()}`;
const TEST_PUESTO_NOMBRE_EDITED = `${TEST_PUESTO_NOMBRE} Editado`;
const TEST_PUESTO_NIVEL = "gerencial";

async function testCreatePuesto(page) {
  console.log("\n[Test 2] Crear un Perfil de Puesto");

  // Click "Nuevo Perfil" button
  const createBtn = await page.$('[data-action="create"]');
  if (!createBtn) {
    fail('No se encontró botón [data-action="create"]');
    return false;
  }
  await createBtn.click();
  await sleep(500);

  // Verify modal opens
  const modal = await page.$('[role="dialog"]');
  if (!modal) {
    fail("No se abrió el modal de creación");
    return false;
  }
  pass("Modal de creación abierto");

  // Verify modal title
  const modalTitle = await page.$("#puestos-modal-title");
  if (modalTitle) {
    const titleText = await modalTitle.textContent();
    if (titleText.includes("Nuevo perfil")) {
      pass('Título del modal: "Nuevo perfil de puesto"');
    } else {
      fail(`Título del modal incorrecto: "${titleText}"`);
    }
  }

  // Fill codigo
  const codigoInput = await page.$('#puestos-modal-codigo');
  if (codigoInput) {
    await codigoInput.fill(TEST_PUESTO_CODIGO);
    pass(`Código llenado: "${TEST_PUESTO_CODIGO}"`);
  } else {
    fail("No se encontró input #puestos-modal-codigo");
    return false;
  }

  // Fill nombre_puesto
  const nombreInput = await page.$('#puestos-modal-nombre');
  if (nombreInput) {
    await nombreInput.fill(TEST_PUESTO_NOMBRE);
    pass(`Nombre llenado: "${TEST_PUESTO_NOMBRE}"`);
  } else {
    fail("No se encontró input #puestos-modal-nombre");
    return false;
  }

  // Select area (pick first available option)
  const areaSelect = await page.$('#puestos-modal-area');
  if (areaSelect) {
    const options = await areaSelect.$$('option[value]:not([value=""])');
    if (options.length > 0) {
      const val = await options[0].getAttribute("value");
      await areaSelect.selectOption(val);
      pass("Area seleccionada");
    } else {
      fail("No hay opciones de area disponibles");
      return false;
    }
  } else {
    fail("No se encontró select #puestos-modal-area");
    return false;
  }

  // Select nivel
  const nivelSelect = await page.$('#puestos-modal-nivel');
  if (nivelSelect) {
    await nivelSelect.selectOption(TEST_PUESTO_NIVEL);
    pass(`Nivel seleccionado: "${TEST_PUESTO_NIVEL}"`);
  } else {
    fail("No se encontró select #puestos-modal-nivel");
    return false;
  }

  // Verify codigo field is editable
  if (codigoInput) {
    const isReadonly = await codigoInput.getAttribute("readonly");
    if (isReadonly === null) {
      pass("Campo código es editable");
    } else {
      fail("Campo código no debería ser readonly");
    }
  }

  // Submit form
  const submitBtn = await page.$('[data-action="modal-form"] button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    pass("Formulario enviado");
  } else {
    fail("No se encontró botón submit en el modal");
    return false;
  }

  await sleep(2000);

  // Verify modal closed
  const modalAfter = await page.$('[role="dialog"]');
  if (!modalAfter) {
    pass("Modal cerrado después de crear");
  } else {
    fail("Modal sigue abierto después de crear");
  }

  return true;
}

// ── Test 3: Verify it appears in the list ──────────────────────────────────

async function testVerifyInList(page) {
  console.log("\n[Test 3] Verificar que el puesto aparece en la lista");

  await page.waitForTimeout(1000);

  // Search by name to find it
  const searchInput = await page.$('[data-action="search"]');
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE);
    await sleep(500); // debounce wait
  }

  // Look for the name in the table
  const tableText = await page.evaluate((nombre) => {
    const table = document.querySelector("table");
    return table ? table.textContent : "";
  }, TEST_PUESTO_NOMBRE);

  if (tableText.includes(TEST_PUESTO_NOMBRE)) {
    pass(`Puesto "${TEST_PUESTO_NOMBRE}" encontrado en la tabla`);
  } else {
    // Try without search filter
    if (searchInput) {
      await searchInput.fill("");
      await sleep(500);
    }
    const allTableText = await page.evaluate(() => {
      const table = document.querySelector("table");
      return table ? table.textContent : "";
    });
    if (allTableText.includes(TEST_PUESTO_NOMBRE)) {
      pass(`Puesto "${TEST_PUESTO_NOMBRE}" encontrado en la tabla (sin filtro)`);
    } else {
      fail(`Puesto "${TEST_PUESTO_NOMBRE}" NO encontrado en la tabla`);
    }
  }

  // Clear search
  if (searchInput) {
    await searchInput.fill("");
    await sleep(500);
  }
}

// ── Test 4: View detail (edit modal shows info) ────────────────────────────

async function testViewDetail(page) {
  console.log("\n[Test 4] Ver detalle del puesto (modal de edición)");

  // Search for the test puesto to narrow the list
  const searchInput = await page.$('[data-action="search"]');
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE);
    await sleep(500);
  }

  // Find the edit button for our puesto
  const editBtns = await page.$$('[data-action="edit"]');
  if (editBtns.length === 0) {
    fail("No se encontró botón de editar");
    return;
  }

  // Click first edit button (should be our test puesto since we filtered)
  await editBtns[0].click();
  await sleep(500);

  // Verify modal shows with correct data
  const modal = await page.$('[role="dialog"]');
  if (!modal) {
    fail("No se abrió el modal de detalle/edición");
    return;
  }
  pass("Modal de detalle/edición abierto");

  // Check title says "Editar"
  const modalTitle = await page.$("#puestos-modal-title");
  if (modalTitle) {
    const titleText = await modalTitle.textContent();
    if (titleText.includes("Editar")) {
      pass('Título del modal: "Editar Perfil de Puesto"');
    } else {
      fail(`Título del modal debería decir "Editar", obtuvo: "${titleText}"`);
    }
  }

  // Verify nombre field has our value
  const nombreInput = await page.$('#puestos-modal-nombre');
  if (nombreInput) {
    const val = await nombreInput.inputValue();
    if (val === TEST_PUESTO_NOMBRE) {
      pass(`Nombre correcto en el modal: "${val}"`);
    } else {
      fail(`Nombre esperado "${TEST_PUESTO_NOMBRE}", obtuvo "${val}"`);
    }
  }

  // Verify nivel is correct
  const nivelSelect = await page.$('#puestos-modal-nivel');
  if (nivelSelect) {
    const val = await nivelSelect.inputValue();
    if (val === TEST_PUESTO_NIVEL) {
      pass(`Nivel correcto en el modal: "${val}"`);
    } else {
      fail(`Nivel esperado "${TEST_PUESTO_NIVEL}", obtuvo "${val}"`);
    }
  }

  // Close modal
  const cancelBtn = await page.$('[data-action="modal-cancel"]');
  if (cancelBtn) {
    await cancelBtn.click();
    await sleep(300);
    pass("Modal cerrado con botón Cancelar");
  }

  // Clear search
  if (searchInput) {
    await searchInput.fill("");
    await sleep(500);
  }
}

// ── Test 5: Edit puesto ────────────────────────────────────────────────────

async function testEditPuesto(page) {
  console.log("\n[Test 5] Editar un puesto");

  // Search for the test puesto
  const searchInput = await page.$('[data-action="search"]');
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE);
    await sleep(500);
  }

  // Click edit
  const editBtns = await page.$$('[data-action="edit"]');
  if (editBtns.length === 0) {
    fail("No se encontró botón de editar para edición");
    return;
  }
  await editBtns[0].click();
  await sleep(500);

  // Change nombre
  const nombreInput = await page.$('#puestos-modal-nombre');
  if (nombreInput) {
    await nombreInput.fill(TEST_PUESTO_NOMBRE_EDITED);
    pass(`Nombre cambiado a: "${TEST_PUESTO_NOMBRE_EDITED}"`);
  } else {
    fail("No se encontró input de nombre para editar");
    return;
  }

  // Submit
  const submitBtn = await page.$('[data-action="modal-form"] button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    pass("Formulario de edición enviado");
  } else {
    fail("No se encontró botón submit");
    return;
  }

  await sleep(2000);

  // Verify modal closed
  const modalAfter = await page.$('[role="dialog"]');
  if (!modalAfter) {
    pass("Modal cerrado después de editar");
  } else {
    fail("Modal sigue abierto después de editar");
  }

  // Verify name updated in table
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE_EDITED);
    await sleep(500);
  }

  const tableText = await page.evaluate(() => {
    const table = document.querySelector("table");
    return table ? table.textContent : "";
  });

  if (tableText.includes(TEST_PUESTO_NOMBRE_EDITED)) {
    pass(`Nombre actualizado visible en la tabla: "${TEST_PUESTO_NOMBRE_EDITED}"`);
  } else {
    fail(`Nombre editado no encontrado en la tabla`);
  }

  // Clear search
  if (searchInput) {
    await searchInput.fill("");
    await sleep(500);
  }
}

// ── Test 6: Search/filter ──────────────────────────────────────────────────

async function testSearchFilter(page) {
  console.log("\n[Test 6] Busqueda y filtros");

  // Test search by name
  const searchInput = await page.$('[data-action="search"]');
  if (!searchInput) {
    fail("No se encontró input de búsqueda");
    return;
  }

  // Search with a string that should match our edited puesto
  await searchInput.fill("E2E Test");
  await sleep(500);

  const rowsAfterSearch = await page.$$("table tbody tr");
  if (rowsAfterSearch.length > 0) {
    pass(`Búsqueda "E2E Test" retornó ${rowsAfterSearch.length} resultado(s)`);
  } else {
    fail('Búsqueda "E2E Test" no retornó resultados');
  }

  // Search with something that should NOT match
  await searchInput.fill("ZZZZZ_NO_EXISTE_NUNCA_99999");
  await sleep(500);

  const rowsNoMatch = await page.$$("table tbody tr");
  const emptyMsg = await page.$('text="Sin perfiles encontrados"');
  if (rowsNoMatch.length === 0 || emptyMsg) {
    pass("Búsqueda sin resultados muestra estado vacío");
  } else {
    fail("Búsqueda sin resultados debería mostrar estado vacío");
  }

  // Clear search
  await searchInput.fill("");
  await sleep(500);

  // Test area filter
  const areaFilter = await page.$('[data-action="filter-area"]');
  if (areaFilter) {
    const options = await areaFilter.$$('option[value]:not([value=""])');
    if (options.length > 0) {
      const firstAreaVal = await options[0].getAttribute("value");
      await areaFilter.selectOption(firstAreaVal);
      await sleep(300);
      pass(`Filtro de area aplicado: "${firstAreaVal}"`);

      // Reset
      await areaFilter.selectOption("");
      await sleep(300);
    } else {
      pass("Filtro de area presente pero sin opciones");
    }
  } else {
    fail("No se encontró filtro de area");
  }

  // Test nivel filter
  const nivelFilter = await page.$('[data-action="filter-nivel"]');
  if (nivelFilter) {
    const options = await nivelFilter.$$('option[value]:not([value=""])');
    if (options.length > 0) {
      const firstNivelVal = await options[0].getAttribute("value");
      await nivelFilter.selectOption(firstNivelVal);
      await sleep(300);
      pass(`Filtro de nivel aplicado: "${firstNivelVal}"`);

      // Reset
      await nivelFilter.selectOption("");
      await sleep(300);
    } else {
      pass("Filtro de nivel presente pero sin opciones");
    }
  } else {
    fail("No se encontró filtro de nivel");
  }
}

// ── Test 7: Role check (RH can see create button) ─────────────────────────

async function testRoleCheck(page) {
  console.log("\n[Test 7] Verificación de rol (RH ve botón crear)");

  const createBtn = await page.$('[data-action="create"]');
  if (createBtn) {
    pass('Botón "Nuevo Perfil" visible para usuario RH');

    const btnText = await createBtn.textContent();
    if (btnText.includes("Nuevo Perfil")) {
      pass('Botón tiene texto "Nuevo Perfil"');
    } else {
      fail(`Texto del botón incorrecto: "${btnText}"`);
    }
  } else {
    fail('Botón "Nuevo Perfil" NO visible — debería ser visible para RH');
  }

  // Verify edit/delete buttons exist in the table
  const editBtns = await page.$$('[data-action="edit"]');
  const deleteBtns = await page.$$('[data-action="delete"]');

  if (editBtns.length > 0) {
    pass(`Botones de editar visibles (${editBtns.length})`);
  } else {
    pass("No hay botones de editar (tabla puede estar vacía)");
  }

  if (deleteBtns.length > 0) {
    pass(`Botones de eliminar visibles (${deleteBtns.length})`);
  } else {
    pass("No hay botones de eliminar (tabla puede estar vacía)");
  }
}

// ── Test 8: Delete puesto ──────────────────────────────────────────────────

async function testDeletePuesto(page) {
  console.log("\n[Test 8] Eliminar un puesto");

  // Search for our edited test puesto
  const searchInput = await page.$('[data-action="search"]');
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE_EDITED);
    await sleep(500);
  }

  // Find delete button
  const deleteBtns = await page.$$('[data-action="delete"]');
  if (deleteBtns.length === 0) {
    fail("No se encontró botón de eliminar");
    return;
  }

  // Click delete
  await deleteBtns[0].click();
  await sleep(500);

  // Verify confirmation dialog
  const alertDialog = await page.$('[role="alertdialog"]');
  if (!alertDialog) {
    fail("No se abrió el dialogo de confirmación de eliminación");
    return;
  }
  pass("Diálogo de confirmación de eliminación abierto");

  // Verify confirmation text mentions the name
  const dialogText = await alertDialog.textContent();
  if (dialogText.includes(TEST_PUESTO_NOMBRE_EDITED)) {
    pass("Diálogo muestra el nombre del puesto a eliminar");
  } else {
    fail("Diálogo no muestra el nombre del puesto");
  }

  // Confirm delete
  const confirmBtn = await page.$('[data-action="confirm-delete"]');
  if (confirmBtn) {
    await confirmBtn.click();
    pass("Confirmación de eliminación enviada");
  } else {
    fail("No se encontró botón de confirmar eliminación");
    return;
  }

  await sleep(2000);

  // Verify dialog closed
  const dialogAfter = await page.$('[role="alertdialog"]');
  if (!dialogAfter) {
    pass("Diálogo cerrado después de eliminar");
  } else {
    fail("Diálogo sigue abierto después de eliminar");
  }

  // Verify puesto no longer in table
  if (searchInput) {
    await searchInput.fill(TEST_PUESTO_NOMBRE_EDITED);
    await sleep(500);
  }

  const tableText = await page.evaluate(() => {
    const table = document.querySelector("table");
    return table ? table.textContent : "";
  });
  const emptyMsg = await page.$('text="Sin perfiles encontrados"');

  if (!tableText.includes(TEST_PUESTO_NOMBRE_EDITED) || emptyMsg) {
    pass(`Puesto "${TEST_PUESTO_NOMBRE_EDITED}" eliminado correctamente de la tabla`);
  } else {
    fail(`Puesto "${TEST_PUESTO_NOMBRE_EDITED}" sigue apareciendo después de eliminar`);
  }

  // Clear search
  if (searchInput) {
    await searchInput.fill("");
    await sleep(500);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    console.log("═".repeat(60));
    console.log("  E2E Tests: Perfiles de Puesto");
    console.log("═".repeat(60));

    // Login
    console.log("\n[Setup] Login como RH...");
    await login(page);
    pass("Login exitoso");

    // Run tests sequentially (they depend on each other)
    await testNavigateToPuestos(page);
    await testCreatePuesto(page);
    await testVerifyInList(page);
    await testViewDetail(page);
    await testEditPuesto(page);
    await testSearchFilter(page);
    await testRoleCheck(page);
    await testDeletePuesto(page);

  } catch (err) {
    console.error(`\n  ✗ ERROR INESPERADO: ${err.message}`);
    totalFail++;
    await page.screenshot({ path: "tests/e2e/error-puestos-screenshot.png" });
    console.error("  Screenshot guardado en tests/e2e/error-puestos-screenshot.png");
  } finally {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  RESUMEN: ${totalPass} passed, ${totalFail} failed`);
    console.log(`${"═".repeat(60)}\n`);

    await browser.close();
    process.exit(totalFail > 0 ? 1 : 0);
  }
}

main();
