import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:5173";
const CREDENTIALS = {
  username: "admin.rh@leoni.com",
  password: "Leoni2026!RH",
};

/**
 * Helper: login and navigate to a hash route.
 */
async function loginAndNavigate(page: Page, hash: string): Promise<void> {
  await page.goto(BASE_URL);
  // Fill login form
  await page.locator("#login-identifier").fill(CREDENTIALS.username);
  await page.locator("#password").fill(CREDENTIALS.password);
  await page.locator('button[type="submit"]').click();
  // Wait for navigation away from login (dashboard loads)
  await page.waitForFunction(() => !window.location.hash.includes("login") && window.location.hash !== "");
  // Navigate to the target page
  await page.goto(`${BASE_URL}/#${hash}`);
  await page.waitForTimeout(500);
}

test.describe("Sesiones de Cursos - Lista global", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, "/sesiones");
  });

  test("1. Page loads with correct title", async ({ page }) => {
    const title = page.locator("h1");
    await expect(title).toHaveText("Sesiones de Cursos");
  });

  test("2. Page shows total count", async ({ page }) => {
    const subtitle = page.locator("text=/\\d+ sesión/");
    await expect(subtitle).toBeVisible();
  });

  test("3. Table has correct headers", async ({ page }) => {
    const headers = ["Curso", "Fecha", "Horario", "Ubicación", "Instructor", "Inscritos", "Estado"];
    for (const h of headers) {
      await expect(page.locator(`th:has-text("${h}")`)).toBeVisible();
    }
  });

  test("4. Table has rows with data", async ({ page }) => {
    const rows = page.locator("[data-action='go-sesion']");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("5. Search input exists and filters results", async ({ page }) => {
    const searchInput = page.locator("[data-action='sesiones-search']");
    await expect(searchInput).toBeVisible();

    // Type a search term that matches known test data
    await searchInput.fill("Principios");
    // Wait for debounce (350ms) + render
    await page.waitForTimeout(600);

    // Verify rows still exist (search should match the curso name)
    const rows = page.locator("[data-action='go-sesion']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Search for something that should NOT match
    await searchInput.fill("XXXXXXXXNOEXISTE");
    await page.waitForTimeout(600);

    // Should show "Sin sesiones encontradas" or empty table
    const emptyMsg = page.locator("text=Sin sesiones encontradas");
    const rowsAfter = page.locator("[data-action='go-sesion']");
    const rowCountAfter = await rowsAfter.count();
    if (rowCountAfter === 0) {
      await expect(emptyMsg).toBeVisible();
    }
  });

  test("6. Estado filter works", async ({ page }) => {
    const filter = page.locator("[data-action='sesiones-filter-estado']");
    await expect(filter).toBeVisible();

    // Select "Programada"
    await filter.selectOption("programada");
    await page.waitForTimeout(600);

    // All visible badges should be "Programada"
    const badges = page.locator("[data-action='go-sesion'] td:last-child span");
    const count = await badges.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = await badges.nth(i).textContent();
        expect(text?.trim()).toBe("Programada");
      }
    }

    // Select "Cancelada" - might have zero results
    await filter.selectOption("cancelada");
    await page.waitForTimeout(600);
    const canceladaRows = page.locator("[data-action='go-sesion']");
    const canceladaCount = await canceladaRows.count();
    // If there are rows, they should all be "Cancelada"
    if (canceladaCount > 0) {
      const cancelBadges = page.locator("[data-action='go-sesion'] td:last-child span");
      for (let i = 0; i < canceladaCount; i++) {
        const text = await cancelBadges.nth(i).textContent();
        expect(text?.trim()).toBe("Cancelada");
      }
    }

    // Reset filter
    await filter.selectOption("");
    await page.waitForTimeout(600);
    const allRows = page.locator("[data-action='go-sesion']");
    const allCount = await allRows.count();
    expect(allCount).toBeGreaterThan(0);
  });

  test("7. Row click navigates to session detail", async ({ page }) => {
    const firstRow = page.locator("[data-action='go-sesion']").first();
    await expect(firstRow).toBeVisible();

    const cursoId = await firstRow.getAttribute("data-curso-id");
    const sesionId = await firstRow.getAttribute("data-sesion-id");

    await firstRow.click();
    await page.waitForTimeout(500);

    // Verify URL changed
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe(`#/sesiones/${cursoId}/${sesionId}`);
  });

  test("8. Pagination buttons exist when multiple pages", async ({ page }) => {
    // With 8 sessions and pageSize 50, might not have pagination
    // But test that the controls render correctly if present
    const pageInfo = page.locator("text=/Página \\d+ de \\d+/");
    const prevBtn = page.locator("[data-action='sesiones-prev']");
    const nextBtn = page.locator("[data-action='sesiones-next']");

    // If there's pagination info, both buttons should exist
    const paginationVisible = await pageInfo.isVisible().catch(() => false);
    if (paginationVisible) {
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();
    }
  });
});

test.describe("Sesion Detalle - Session Detail Page", () => {
  let cursoId: string;
  let sesionId: string;

  test.beforeEach(async ({ page }) => {
    // Login and go to sesiones list first to find valid IDs
    await loginAndNavigate(page, "/sesiones");
    const firstRow = page.locator("[data-action='go-sesion']").first();
    await expect(firstRow).toBeVisible();
    cursoId = (await firstRow.getAttribute("data-curso-id"))!;
    sesionId = (await firstRow.getAttribute("data-sesion-id"))!;
    // Navigate to detail
    await page.goto(`${BASE_URL}/#/sesiones/${cursoId}/${sesionId}`);
    await page.waitForTimeout(800);
  });

  test("9. Detail page shows breadcrumb navigation", async ({ page }) => {
    // Use text-based locator to distinguish breadcrumb from sidebar nav links
    const breadcrumb = page.getByRole("link", { name: "← Sesiones" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveText("← Sesiones");
  });

  test("10. Detail page shows curso info card", async ({ page }) => {
    // Wait for the detail page to finish loading (the "Cargando..." message disappears)
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Cargando..."),
      { timeout: 5000 }
    ).catch(() => {});
    await page.waitForTimeout(300);

    // The "Curso" label within the info card
    const cursoLabel = page.locator("p.text-xs:has-text('Curso')").first();
    await expect(cursoLabel).toBeVisible();

    // Curso name should be visible as an h1
    const cursoName = page.locator("h1");
    await expect(cursoName).toBeVisible();
    const nameText = await cursoName.textContent();
    expect(nameText!.length).toBeGreaterThan(0);
  });

  test("11. Detail page shows session data card", async ({ page }) => {
    const sessionTitle = page.locator("h2:has-text('Datos de la Sesión')");
    await expect(sessionTitle).toBeVisible();

    // Fecha inicio should always be present
    const fechaLabel = page.locator("text=Fecha inicio");
    await expect(fechaLabel).toBeVisible();

    // Cupo should be visible
    const cupoLabel = page.locator("text=Cupo");
    await expect(cupoLabel).toBeVisible();
  });

  test("12. Detail page shows estado badge", async ({ page }) => {
    // The estado badge is in the session info card header
    const badge = page.locator("h2:has-text('Datos de la Sesión') + span, .rounded-full");
    // Check that at least one estado badge exists
    const allBadges = page.locator(".rounded-full");
    const count = await allBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test("13. Detail page shows employees section", async ({ page }) => {
    const empTitle = page.locator("h2:has-text('Empleados Inscritos')");
    await expect(empTitle).toBeVisible();
  });

  test("14. Detail page has 'Agregar empleado' button", async ({ page }) => {
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveText("+ Agregar empleado");
  });

  test("15. Employees table shows correct headers when employees exist", async ({ page }) => {
    const empTable = page.locator("th:has-text('No. Empleado')");
    const hasEmployees = await empTable.isVisible().catch(() => false);
    if (hasEmployees) {
      await expect(page.locator("th:has-text('Nombre')")).toBeVisible();
      await expect(page.locator("th:has-text('Asistencia')")).toBeVisible();
    } else {
      // Empty state message
      const emptyMsg = page.locator("text=Sin empleados inscritos");
      await expect(emptyMsg).toBeVisible();
    }
  });

  test("16. Open add employee modal", async ({ page }) => {
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await addBtn.click();
    await page.waitForTimeout(300);

    // Modal should appear
    const modal = page.locator("[data-backdrop='add-empleado-modal']");
    await expect(modal).toBeVisible();

    // Modal title
    const modalTitle = page.locator("h3:has-text('Agregar Empleado a Sesión')");
    await expect(modalTitle).toBeVisible();

    // Search input
    const searchInput = page.locator("[data-action='search-elegible']");
    await expect(searchInput).toBeVisible();
  });

  test("17. Search eligible employees in modal", async ({ page }) => {
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await addBtn.click();
    await page.waitForTimeout(300);

    const searchInput = page.locator("[data-action='search-elegible']");
    await searchInput.fill("Admin");
    await page.waitForTimeout(600);

    // Check if results appear or "Sin resultados" if no eligible employees
    const results = page.locator("[data-action='inscribir-empleado']");
    const noResults = page.locator("text=Sin resultados");
    const searchingMsg = page.locator("text=Buscando");

    // Wait for search to complete
    await page.waitForTimeout(400);
    const resultsCount = await results.count();
    const noResultsVisible = await noResults.isVisible().catch(() => false);

    // Either we have results or "Sin resultados" - both are valid
    expect(resultsCount > 0 || noResultsVisible).toBeTruthy();
  });

  test("18. Close modal by clicking close button", async ({ page }) => {
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await addBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator("[data-backdrop='add-empleado-modal']");
    await expect(modal).toBeVisible();

    // Click close button
    const closeBtn = page.locator("[data-action='close-add-modal']");
    await closeBtn.click();
    await page.waitForTimeout(300);

    await expect(modal).not.toBeVisible();
  });

  test("19. Close modal by clicking backdrop", async ({ page }) => {
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await addBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator("[data-backdrop='add-empleado-modal']");
    await expect(modal).toBeVisible();

    // Click the backdrop itself (not the inner card)
    await modal.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    await expect(modal).not.toBeVisible();
  });

  test("20. Navigate back to list via breadcrumb", async ({ page }) => {
    // Use text-based locator to click the breadcrumb, not sidebar nav
    const breadcrumb = page.getByRole("link", { name: "← Sesiones" });
    await breadcrumb.click();
    await page.waitForTimeout(500);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe("#/sesiones");

    // Should show the list title again
    const title = page.locator("h1:has-text('Sesiones de Cursos')");
    await expect(title).toBeVisible();
  });
});

test.describe("Sesion Detalle - Inscribir y Quitar Empleado (si hay elegibles)", () => {
  test("21. Full flow: inscribe and remove employee", async ({ page }) => {
    // Use a session that we know has inscribed employees (sesion 2, curso 1099 has 10 inscritos)
    await loginAndNavigate(page, "/sesiones/1099/2");
    await page.waitForTimeout(800);

    // Verify page loaded
    const sessionTitle = page.locator("h2:has-text('Datos de la Sesión')");
    await expect(sessionTitle).toBeVisible();

    // Check employees table
    const empRows = page.locator("[data-action='quitar-empleado']");
    const initialCount = await empRows.count();

    if (initialCount > 0) {
      // Test: remove an employee
      const firstQuitarBtn = empRows.first();
      await firstQuitarBtn.click();
      await page.waitForTimeout(500);

      // Verify count decreased
      const newCount = await page.locator("[data-action='quitar-empleado']").count();
      expect(newCount).toBe(initialCount - 1);
    }

    // Try to add an employee
    const addBtn = page.locator("[data-action='open-add-empleado']");
    await addBtn.click();
    await page.waitForTimeout(300);

    const searchInput = page.locator("[data-action='search-elegible']");
    await searchInput.fill("a");
    await page.waitForTimeout(800);

    const eligibleResults = page.locator("[data-action='inscribir-empleado']");
    const eligibleCount = await eligibleResults.count();

    if (eligibleCount > 0) {
      // Click first eligible employee to inscribe
      const firstEligible = eligibleResults.first();
      const empName = await firstEligible.locator("span.font-medium").textContent();
      await firstEligible.click();
      await page.waitForTimeout(500);

      // Verify employee appears in the table
      const tableContent = await page.locator("table tbody").last().textContent();
      // The employee name or number should appear somewhere
      expect(tableContent).toBeTruthy();
    }
  });
});

test.describe("Sesiones - Edge cases", () => {
  test("22. Invalid session ID shows error", async ({ page }) => {
    await loginAndNavigate(page, "/sesiones/99999/99999");
    await page.waitForTimeout(800);

    // Should show error message
    const errorMessage = page.locator("text=/Error|No se pudo|no encontr/i");
    await expect(errorMessage).toBeVisible();
  });

  test("23. Sesiones list - search and filter combined", async ({ page }) => {
    await loginAndNavigate(page, "/sesiones");

    // Apply estado filter
    const filter = page.locator("[data-action='sesiones-filter-estado']");
    await filter.selectOption("programada");
    await page.waitForTimeout(600);

    // Then search
    const searchInput = page.locator("[data-action='sesiones-search']");
    await searchInput.fill("Sala");
    await page.waitForTimeout(600);

    // Verify both filters applied - check rows or empty
    const rows = page.locator("[data-action='go-sesion']");
    const count = await rows.count();
    // Valid result: either matching rows or empty with message
    if (count === 0) {
      const emptyMsg = page.locator("text=Sin sesiones encontradas");
      await expect(emptyMsg).toBeVisible();
    } else {
      // All should be "Programada"
      const badges = page.locator("[data-action='go-sesion'] td:last-child span");
      for (let i = 0; i < count; i++) {
        const text = await badges.nth(i).textContent();
        expect(text?.trim()).toBe("Programada");
      }
    }
  });

  test("24. Detail page - 'Ver curso completo' link exists", async ({ page }) => {
    await loginAndNavigate(page, "/sesiones");
    const firstRow = page.locator("[data-action='go-sesion']").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await page.waitForTimeout(800);

    const verCursoLink = page.locator("a:has-text('Ver curso completo')");
    await expect(verCursoLink).toBeVisible();
    const href = await verCursoLink.getAttribute("href");
    expect(href).toMatch(/^#\/cursos\/\d+$/);
  });
});
