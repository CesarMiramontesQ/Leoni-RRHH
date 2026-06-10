import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5173";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

// Unique test identifier to avoid collisions
const TEST_ID = Date.now().toString().slice(-6);
const CURSO_NAME = `Curso QA Test ${TEST_ID}`;
const CURSO_NAME_EDITED = `Curso QA Editado ${TEST_ID}`;

test.describe.configure({ mode: "serial" });

test.describe("Cursos UI - QA Tests", () => {
  test("Full Cursos workflow: login, CRUD, sessions", async ({ page }) => {
    let createdCursoId: number | null = null;

    // ─── STEP 1: Login ─────────────────────────────────────────────────────
    console.log(">>> Step 1: Login");
    await page.goto(BASE_URL);
    await page.waitForSelector("#login-form", { timeout: 10000 });
    await page.fill("#login-identifier", LOGIN_USER);
    await page.fill("#password", LOGIN_PASS);
    await page.click('button[type="submit"]');

    // Wait for redirect after login - hash changes to #/
    await page.waitForURL(/.*#\/.*/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Verify login succeeded (no login form visible)
    const hasLoginForm = await page.locator("#login-form").count();
    expect(hasLoginForm).toBe(0);
    await page.screenshot({ path: "tests/e2e/cursos-01-after-login.png" });
    console.log("    PASS: Login successful");

    // ─── STEP 2: Navigate to Cursos ────────────────────────────────────────
    console.log(">>> Step 2: Navigate to Cursos");
    await page.goto(`${BASE_URL}/#/cursos`);
    await page.waitForTimeout(2500);

    // Verify cursos page loaded - filter section should be present
    const filterSection = page.locator('section[aria-label="Filtros de cursos"]');
    await expect(filterSection).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/cursos-02-list-page.png" });
    console.log("    PASS: Cursos page loaded with filter section");

    // ─── STEP 3: Verify list loads ─────────────────────────────────────────
    console.log(">>> Step 3: Verify cursos list loads");
    // Check KPIs section
    const totalKpi = page.locator("text=Total catálogo");
    await expect(totalKpi).toBeVisible({ timeout: 5000 });

    // Check table has rows (default is table view)
    const tableRows = await page.locator("table tbody tr").count();
    console.log(`    Table rows found: ${tableRows}`);
    expect(tableRows).toBeGreaterThan(0);
    console.log("    PASS: Table has content");

    // ─── STEP 4: Create a curso ────────────────────────────────────────────
    console.log(">>> Step 4: Create a new curso");
    const createBtn = page.locator('[data-action="open-create-curso"]');
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Wait for modal backdrop
    const modal = page.locator("#curso-modal-backdrop");
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log("    Modal opened");

    // Fill form
    await page.fill('#curso-modal-backdrop input[name="nombre"]', CURSO_NAME);
    await page.selectOption('#curso-modal-backdrop select[name="tipo"]', "interno");
    await page.selectOption('#curso-modal-backdrop select[name="clasificacion"]', "adicional");
    await page.fill('#curso-modal-backdrop input[name="duracion_horas"]', "16");
    await page.selectOption('#curso-modal-backdrop select[name="categoria"]', "tecnico");
    await page.fill('#curso-modal-backdrop input[name="proveedor"]', "Proveedor QA Test");
    await page.fill('#curso-modal-backdrop textarea[name="descripcion"]', "Curso creado por prueba automatizada Playwright");
    await page.check('#curso-modal-backdrop input[name="obligatorio"]');

    await page.screenshot({ path: "tests/e2e/cursos-04-create-modal-filled.png" });

    // Submit the form
    await page.click('#curso-modal-backdrop form[data-action="submit-curso"] button[type="submit"]');

    // Wait for modal to disappear (curso created successfully)
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    console.log("    Modal closed after submit");

    // Wait for list to re-render
    await page.waitForTimeout(1500);

    // Search for our curso to confirm it was created
    const searchInput = page.locator('[data-action="cursos-search"]');
    await searchInput.fill(CURSO_NAME);
    // Wait for debounced search (300ms) + API response + render
    await page.waitForTimeout(2000);

    // Verify it's in the list
    const cursoInList = page.locator(`button[data-action="view-curso"]:has-text("${CURSO_NAME}")`).first();
    await expect(cursoInList).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/cursos-04-created-visible.png" });
    console.log("    PASS: Curso created and visible in list");

    // ─── STEP 5: View curso detail ─────────────────────────────────────────
    console.log(">>> Step 5: View curso detail");
    await cursoInList.click();
    await page.waitForTimeout(2000);

    // Verify detail page sections
    const detailHeader = page.locator("h2").filter({ hasText: CURSO_NAME });
    await expect(detailHeader).toBeVisible({ timeout: 10000 });
    console.log("    Detail header visible");

    const sesionesSection = page.locator("h3:has-text('Sesiones programadas')").first();
    await expect(sesionesSection).toBeVisible({ timeout: 5000 });
    console.log("    Sessions section visible");

    const puestosSection = page.locator("h3:has-text('Puestos asignados')").first();
    await expect(puestosSection).toBeVisible({ timeout: 5000 });
    console.log("    Puestos section visible");

    const empleadosSection = page.locator("h3:has-text('Empleados extra')").first();
    await expect(empleadosSection).toBeVisible({ timeout: 5000 });
    console.log("    Empleados extra section visible");

    // Get the curso ID from the detail view ("ID: X" text)
    const idSpan = page.locator("span:has-text('ID:')").first();
    const idText = await idSpan.textContent().catch(() => null);
    if (idText) {
      const match = idText.match(/ID:\s*(\d+)/);
      if (match) createdCursoId = parseInt(match[1]);
    }
    console.log(`    Curso ID: ${createdCursoId}`);
    await page.screenshot({ path: "tests/e2e/cursos-05-detail-view.png" });
    console.log("    PASS: Detail view loaded with all sections");

    // ─── STEP 6: Edit curso ────────────────────────────────────────────────
    // NOTE: BUG FOUND - Clicking "Editar" from detail view does NOT show the
    // edit modal because renderDetailView() does not include the modal HTML.
    // The modal is only rendered in renderPage(). Workaround: go back to list to edit.
    console.log(">>> Step 6: Edit curso");
    console.log("    BUG: Edit button in detail view does NOT open modal (renderDetailView lacks modal HTML)");

    // Go back to list view
    await page.evaluate(() => {
      window.location.hash = "#/cursos";
    });
    await page.waitForTimeout(1500);

    // Search for our curso in the list
    const searchForEdit = page.locator('[data-action="cursos-search"]');
    await searchForEdit.fill(CURSO_NAME);
    await page.waitForTimeout(2000);

    // Click the edit button in the table/list row
    const editBtnList = page.locator('[data-action="edit-curso"]').first();
    await expect(editBtnList).toBeVisible({ timeout: 5000 });
    await editBtnList.click();
    await page.waitForTimeout(1000);

    // Wait for modal
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log("    Edit modal opened (from list view)");

    // Change name
    const nombreInput = page.locator('#curso-modal-backdrop input[name="nombre"]');
    await nombreInput.clear();
    await nombreInput.fill(CURSO_NAME_EDITED);

    await page.screenshot({ path: "tests/e2e/cursos-06-edit-modal.png" });

    // Submit
    await page.click('#curso-modal-backdrop form[data-action="submit-curso"] button[type="submit"]');
    await page.waitForTimeout(3000);

    // After edit, the page re-renders back to list
    const searchInput2 = page.locator('[data-action="cursos-search"]');
    await searchInput2.fill(CURSO_NAME_EDITED);
    await page.waitForTimeout(2000);
    const editedInList = page.locator(`text=${CURSO_NAME_EDITED}`).first();
    await expect(editedInList).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/cursos-06-after-edit.png" });
    console.log("    PASS: Curso edited successfully");

    // ─── STEP 7: Navigate via URL ──────────────────────────────────────────
    console.log(">>> Step 7: Navigate via URL");
    if (createdCursoId) {
      await page.goto(`${BASE_URL}/#/cursos/${createdCursoId}`);
      await page.waitForTimeout(3000);

      const detailContent = page.locator(`text=${CURSO_NAME_EDITED}`).first();
      await expect(detailContent).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: "tests/e2e/cursos-07-url-navigation.png" });
      console.log("    PASS: Direct URL navigation works");
    } else {
      // If we don't have the ID, just navigate to cursos list and find it
      await page.goto(`${BASE_URL}/#/cursos`);
      await page.waitForTimeout(2000);
      const searchInput3 = page.locator('[data-action="cursos-search"]');
      await searchInput3.fill(CURSO_NAME_EDITED);
      await page.waitForTimeout(2000);
      const cursoBtn = page.locator(`button[data-action="view-curso"]:has-text("${CURSO_NAME_EDITED}")`).first();
      await cursoBtn.click();
      await page.waitForTimeout(2000);
      console.log("    PASS: Navigated to detail via search + click");
    }

    // ─── STEP 8: Sessions section shows empty state or list ────────────────
    console.log(">>> Step 8: Sessions section");
    // Should already be on detail page from step 7
    const sessionHeader = page.locator("h3:has-text('Sesiones programadas')").first();
    await expect(sessionHeader).toBeVisible({ timeout: 5000 });

    const createSesionBtn = page.locator('[data-action="open-create-sesion"]');
    await expect(createSesionBtn).toBeVisible({ timeout: 5000 });

    // Check for empty state message
    const emptyState = page.locator("text=Sin sesiones programadas").first();
    const isEmpty = await emptyState.isVisible().catch(() => false);
    console.log(`    Sessions empty state visible: ${isEmpty}`);
    console.log("    PASS: Session section visible with create button");

    // ─── STEP 9: Create a session ──────────────────────────────────────────
    console.log(">>> Step 9: Create a session");
    await createSesionBtn.click();

    const sesionModal = page.locator('[data-backdrop="create-sesion"]');
    await expect(sesionModal).toBeVisible({ timeout: 5000 });
    console.log("    Session modal opened");

    // Fill session form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    await page.fill('[data-backdrop="create-sesion"] input[name="fecha_inicio"]', dateStr);
    await page.fill('[data-backdrop="create-sesion"] input[name="hora_inicio"]', "09:00");
    await page.fill('[data-backdrop="create-sesion"] input[name="hora_fin"]', "13:00");
    await page.fill('[data-backdrop="create-sesion"] input[name="ubicacion"]', "Aula QA-1");
    await page.fill('[data-backdrop="create-sesion"] input[name="instructor"]', "Instructor QA Test");
    await page.fill('[data-backdrop="create-sesion"] input[name="cupo_max"]', "20");

    await page.screenshot({ path: "tests/e2e/cursos-09-create-session-filled.png" });

    // Submit
    await page.click('[data-backdrop="create-sesion"] form[data-form="create-sesion"] button[type="submit"]');
    await page.waitForTimeout(3000);

    // Verify modal closed
    await expect(sesionModal).not.toBeVisible({ timeout: 10000 });
    console.log("    Session modal closed after submit");

    // Verify session appears in the table
    const sessionUbicacion = page.locator("td:has-text('Aula QA-1')").first();
    await expect(sessionUbicacion).toBeVisible({ timeout: 10000 });

    const sessionInstructor = page.locator("td:has-text('Instructor QA Test')").first();
    await expect(sessionInstructor).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "tests/e2e/cursos-09-session-created.png" });
    console.log("    PASS: Session created and visible in table");

    // ─── CLEANUP: Delete the test curso ────────────────────────────────────
    console.log(">>> Cleanup: Delete test curso");
    // Accept confirm dialogs
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // We're on the detail page - delete from here
    const deleteBtn = page.locator('[data-action="delete-curso"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      console.log("    Cleanup: curso deleted");
    } else {
      // Navigate back to list and delete
      await page.goto(`${BASE_URL}/#/cursos`);
      await page.waitForTimeout(2000);
      const searchInput4 = page.locator('[data-action="cursos-search"]');
      await searchInput4.fill(CURSO_NAME_EDITED);
      await page.waitForTimeout(1500);
      const deleteBtnList = page.locator('[data-action="delete-curso"]').first();
      if (await deleteBtnList.isVisible()) {
        await deleteBtnList.click();
        await page.waitForTimeout(2000);
        console.log("    Cleanup: curso deleted from list");
      }
    }
    await page.screenshot({ path: "tests/e2e/cursos-10-cleanup.png" });
    console.log(">>> ALL STEPS PASSED");
  });
});
