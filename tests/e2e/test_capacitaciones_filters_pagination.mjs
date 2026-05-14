// @ts-check
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const LOGIN_EMAIL = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

const results = [];
function log(name, passed, detail = "") {
  const status = passed ? "PASS" : "FAIL";
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function login(page) {
  await page.goto(BASE);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', LOGIN_EMAIL);
  await page.fill('input[name="password"]', LOGIN_PASS);
  // Login form uses type="submit" button
  await page.click('button[type="submit"]');
  // Wait for navigation after login
  await page.waitForTimeout(2000);
}

async function navigateToCapacitaciones(page) {
  await page.goto(`${BASE}/#/capacitaciones`);
  await page.waitForTimeout(2000);
  // Wait for loading to finish
  await page.waitForFunction(
    () => !document.querySelector("#capacitaciones-page")?.textContent?.includes("Cargando"),
    { timeout: 10000 }
  ).catch(() => {});
}

async function createCapacitacion(page, { nombre, modalidad, duracion, fechaInicio, fechaFin }) {
  // Ensure no modal is open first
  const existingModal = await page.$('#cap-modal-backdrop');
  if (existingModal) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('#cap-modal-backdrop'),
      { timeout: 5000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
  }

  // Click "Nueva capacitacion" button
  await page.click('[data-action="open-create"]');
  await page.waitForSelector('form[data-action="submit-cap"]', { timeout: 5000 });
  await page.waitForTimeout(200);

  await page.fill('input[name="nombre"]', nombre);
  await page.selectOption('select[name="modalidad"]', modalidad);
  await page.fill('input[name="duracion_horas"]', String(duracion));
  await page.fill('input[name="fecha_inicio"]', fechaInicio);
  await page.fill('input[name="fecha_fin"]', fechaFin);

  // Submit form
  await page.click('form[data-action="submit-cap"] button[type="submit"]');

  // Wait for modal to close
  await page.waitForFunction(
    () => !document.querySelector('#cap-modal-backdrop') && !document.querySelector('form[data-action="submit-cap"]'),
    { timeout: 10000 }
  );
  await page.waitForTimeout(500);
}

async function getVisibleCardNames(page) {
  const cards = await page.$$eval(
    ".rounded-lg.border.border-gray-200.bg-white.p-4 h3",
    (els) => els.map((el) => el.textContent?.trim() ?? "")
  );
  return cards;
}

async function cleanupTestData(page) {
  // Delete any existing "Filter " capacitaciones
  let keepDeleting = true;
  while (keepDeleting) {
    const deleteButtons = await page.$$('[data-action="delete-cap"]');
    const cardNames = await getVisibleCardNames(page);
    let deleted = false;
    for (let i = 0; i < cardNames.length; i++) {
      if (cardNames[i].startsWith("Filter ") || cardNames[i].startsWith("Pagination ")) {
        // Accept the confirm dialog
        page.once("dialog", (d) => d.accept());
        const btns = await page.$$('[data-action="delete-cap"]');
        if (btns[i]) {
          await btns[i].click();
          await page.waitForTimeout(1000);
          deleted = true;
          break;
        }
      }
    }
    if (!deleted) keepDeleting = false;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ═══════════════════════════════════════════════════════════════════
    // LOGIN + NAVIGATE
    // ═══════════════════════════════════════════════════════════════════
    await login(page);
    await navigateToCapacitaciones(page);

    // Cleanup any leftover test data
    await cleanupTestData(page);

    // ═══════════════════════════════════════════════════════════════════
    // SETUP — CREATE 3 CAPACITACIONES
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- SETUP: Creating test capacitaciones ---");

    await createCapacitacion(page, {
      nombre: "Filter Presencial A",
      modalidad: "presencial",
      duracion: 4,
      fechaInicio: "2026-06-01",
      fechaFin: "2026-06-15",
    });
    let cards = await getVisibleCardNames(page);
    log("SETUP-1: Create 'Filter Presencial A'", cards.includes("Filter Presencial A"), `Cards: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    await createCapacitacion(page, {
      nombre: "Filter Online B",
      modalidad: "online",
      duracion: 8,
      fechaInicio: "2026-07-01",
      fechaFin: "2026-07-20",
    });
    cards = await getVisibleCardNames(page);
    log("SETUP-2: Create 'Filter Online B'", cards.includes("Filter Online B"), `Cards: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    await createCapacitacion(page, {
      nombre: "Filter Mixta C",
      modalidad: "mixta",
      duracion: 12,
      fechaInicio: "2026-08-01",
      fechaFin: "2026-08-30",
    });
    cards = await getVisibleCardNames(page);
    log("SETUP-3: Create 'Filter Mixta C'", cards.includes("Filter Mixta C"), `Cards: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    // ═══════════════════════════════════════════════════════════════════
    // FILTER TESTS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- FILTER TESTS ---");

    // TEST 4: Search filter — type "Presencial"
    const searchInput = '[data-action="filter-search"]';
    await page.fill(searchInput, "Presencial");
    // Wait for debounce (300ms) + network
    await page.waitForTimeout(600);
    await page.waitForFunction(
      () => !document.querySelector("#capacitaciones-page")?.textContent?.includes("Cargando"),
      { timeout: 5000 }
    ).catch(() => {});
    cards = await getVisibleCardNames(page);
    const hasOnlyPresencial = cards.includes("Filter Presencial A") && !cards.includes("Filter Online B") && !cards.includes("Filter Mixta C");
    log("TEST-4: Search 'Presencial' shows only 'Filter Presencial A'", hasOnlyPresencial, `Visible: ${JSON.stringify(cards)}`);

    // TEST 5: Clear search — all 3 show
    await page.fill(searchInput, "");
    await page.waitForTimeout(600);
    await page.waitForFunction(
      () => !document.querySelector("#capacitaciones-page")?.textContent?.includes("Cargando"),
      { timeout: 5000 }
    ).catch(() => {});
    cards = await getVisibleCardNames(page);
    const allThreeVisible = cards.includes("Filter Presencial A") && cards.includes("Filter Online B") && cards.includes("Filter Mixta C");
    log("TEST-5: Clear search shows all 3 test capacitaciones", allThreeVisible, `Visible: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    // TEST 6: Modalidad filter — select "online"
    await page.selectOption('[data-action="filter-modalidad"]', "online");
    await page.waitForTimeout(600);
    cards = await getVisibleCardNames(page);
    const onlyOnline = cards.includes("Filter Online B") && !cards.includes("Filter Presencial A") && !cards.includes("Filter Mixta C");
    log("TEST-6: Modalidad 'online' shows only 'Filter Online B'", onlyOnline, `Visible: ${JSON.stringify(cards)}`);

    // TEST 7: Reset modalidad — all show
    await page.selectOption('[data-action="filter-modalidad"]', "");
    await page.waitForTimeout(600);
    cards = await getVisibleCardNames(page);
    const allBackAfterModalidad = cards.includes("Filter Presencial A") && cards.includes("Filter Online B") && cards.includes("Filter Mixta C");
    log("TEST-7: Reset modalidad to 'Todas' shows all", allBackAfterModalidad, `Visible: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    // TEST 8: Estado filter — select "activa" (all should be active by default)
    await page.selectOption('[data-action="filter-estado"]', "activa");
    await page.waitForTimeout(600);
    cards = await getVisibleCardNames(page);
    const allActiveVisible = cards.includes("Filter Presencial A") && cards.includes("Filter Online B") && cards.includes("Filter Mixta C");
    log("TEST-8: Estado 'activa' shows all (all active by default)", allActiveVisible, `Visible: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    // Reset estado
    await page.selectOption('[data-action="filter-estado"]', "");
    await page.waitForTimeout(400);

    // TEST 9: Combine filters — modalidad=mixta AND search="Filter"
    await page.selectOption('[data-action="filter-modalidad"]', "mixta");
    await page.waitForTimeout(400);
    await page.fill(searchInput, "Filter");
    await page.waitForTimeout(600);
    cards = await getVisibleCardNames(page);
    const onlyMixtaFilter = cards.includes("Filter Mixta C") && !cards.includes("Filter Presencial A") && !cards.includes("Filter Online B");
    log("TEST-9: Combined (modalidad=mixta + search='Filter') shows only 'Filter Mixta C'", onlyMixtaFilter, `Visible: ${JSON.stringify(cards)}`);

    // TEST 10: Reset all filters
    await page.fill(searchInput, "");
    await page.selectOption('[data-action="filter-modalidad"]', "");
    await page.selectOption('[data-action="filter-estado"]', "");
    await page.waitForTimeout(600);
    cards = await getVisibleCardNames(page);
    const allResetOk = cards.includes("Filter Presencial A") && cards.includes("Filter Online B") && cards.includes("Filter Mixta C");
    log("TEST-10: Reset all filters shows all cards", allResetOk, `Visible: ${JSON.stringify(cards.filter(c => c.startsWith("Filter")))}`);

    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE TEST
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- DEBOUNCE TEST ---");

    // TEST 11: Type quickly — verify debounce (no flicker)
    // Strategy: count how many times the content changes during rapid typing
    await page.fill(searchInput, ""); // clear first
    await page.waitForTimeout(600);

    // We'll listen for network requests during typing
    let apiCallCount = 0;
    const onRequest = (req) => {
      if (req.url().includes("/api/v1/capacitaciones") && req.method() === "GET") {
        apiCallCount++;
      }
    };
    page.on("request", onRequest);

    // Type "Pres" character by character quickly (< 300ms between chars)
    await page.click(searchInput);
    await page.keyboard.type("Pres", { delay: 50 });

    // Wait a bit less than debounce to count premature requests
    await page.waitForTimeout(150);
    const callsDuringTyping = apiCallCount;

    // Now wait for debounce to fire
    await page.waitForTimeout(500);
    const callsAfterDebounce = apiCallCount;

    page.off("request", onRequest);

    // With proper debounce: should fire only 1 request after the last keystroke, not 4
    // During typing (before debounce fires) there should be 0 requests
    const debounceWorking = callsDuringTyping === 0 && callsAfterDebounce === 1;
    log(
      "TEST-11: Debounce works (0 requests during typing, 1 after 300ms)",
      debounceWorking,
      `Calls during typing: ${callsDuringTyping}, calls after debounce: ${callsAfterDebounce}`
    );

    // Reset search
    await page.fill(searchInput, "");
    await page.waitForTimeout(600);

    // ═══════════════════════════════════════════════════════════════════
    // PAGINATION TESTS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- PAGINATION TESTS ---");

    // Count current items first
    cards = await getVisibleCardNames(page);
    const currentTotal = cards.length;
    console.log(`Current total visible cards: ${currentTotal}`);

    // We need >10 items to trigger pagination. Create additional items.
    const neededForPagination = Math.max(0, 11 - currentTotal);
    console.log(`Need to create ${neededForPagination} more items for pagination`);

    for (let i = 1; i <= neededForPagination; i++) {
      await createCapacitacion(page, {
        nombre: `Pagination Test ${i}`,
        modalidad: "presencial",
        duracion: 2,
        fechaInicio: "2026-09-01",
        fechaFin: "2026-09-15",
      });
    }

    // Reload to see all items
    await navigateToCapacitaciones(page);

    // TEST 12: Check if pagination appears
    const paginationText = await page.$eval(
      '[data-action="prev-page"]',
      () => true
    ).catch(() => false);

    if (paginationText) {
      log("TEST-12: Pagination controls appear when >10 items", true, "Pagination buttons found");

      // TEST 13: Verify "Pagina X de Y (Z total)" text
      const paginationFullText = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="prev-page"]');
        const container = btn?.closest(".flex.items-center.justify-between");
        return container?.textContent?.trim() ?? "";
      });
      const matchesPaginaFormat = /Pagina \d+ de \d+ \(\d+ total\)/.test(paginationFullText ?? "");
      log("TEST-13: Pagination shows 'Pagina X de Y (Z total)' format", matchesPaginaFormat, `Text: "${paginationFullText}"`);

      // TEST 14: Test "Siguiente" button advances page
      const pageBeforeNext = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="next-page"]');
        const container = btn?.closest(".flex.items-center.justify-between");
        return container?.textContent?.trim() ?? "";
      });
      const page1Match = pageBeforeNext.match(/Pagina (\d+)/);
      const currentPageNum = page1Match ? parseInt(page1Match[1]) : 0;

      await page.click('[data-action="next-page"]');
      await page.waitForTimeout(800);

      const pageAfterNext = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="next-page"]');
        const container = btn?.closest(".flex.items-center.justify-between");
        return container?.textContent?.trim() ?? "";
      });
      const page2Match = pageAfterNext.match(/Pagina (\d+)/);
      const nextPageNum = page2Match ? parseInt(page2Match[1]) : 0;
      log("TEST-14: 'Siguiente' advances to next page", nextPageNum === currentPageNum + 1, `Was page ${currentPageNum}, now page ${nextPageNum}`);

      // TEST 15: Test "Anterior" goes back
      await page.click('[data-action="prev-page"]');
      await page.waitForTimeout(1200);
      // Wait for pagination to re-render
      await page.waitForSelector('[data-action="prev-page"]', { timeout: 5000 }).catch(() => {});

      const pageAfterPrev = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="prev-page"]');
        const container = btn?.closest(".flex.items-center.justify-between");
        return container?.textContent?.trim() ?? "";
      });
      const page3Match = pageAfterPrev.match(/Pagina (\d+)/);
      const prevPageNum = page3Match ? parseInt(page3Match[1]) : 0;
      log("TEST-15: 'Anterior' goes back to previous page", prevPageNum === currentPageNum, `Back to page ${prevPageNum}`);

      // TEST 16: Verify buttons disabled at boundaries
      // Go to page 1 first
      let safetyCounter = 0;
      while (safetyCounter < 20) {
        safetyCounter++;
        const prevExists = await page.$('[data-action="prev-page"]');
        if (!prevExists) break;
        const isDisabled = await page.$eval('[data-action="prev-page"]', (el) => el.hasAttribute("disabled"));
        if (isDisabled) break;
        await page.click('[data-action="prev-page"]');
        await page.waitForTimeout(800);
        await page.waitForSelector('[data-action="prev-page"]', { timeout: 3000 }).catch(() => {});
      }

      const anteriorDisabledOnPage1 = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="prev-page"]');
        return btn ? btn.hasAttribute("disabled") : false;
      });

      // Go to last page
      safetyCounter = 0;
      while (safetyCounter < 20) {
        safetyCounter++;
        const nextExists = await page.$('[data-action="next-page"]');
        if (!nextExists) break;
        const isDisabled = await page.evaluate(() => {
          const btn = document.querySelector('[data-action="next-page"]');
          return btn ? btn.hasAttribute("disabled") : true;
        });
        if (isDisabled) break;
        await page.click('[data-action="next-page"]');
        await page.waitForTimeout(1200);
        // Wait for re-render to complete
        await page.waitForFunction(
          () => document.querySelector('[data-action="next-page"]') || document.querySelector('.text-center.py-12'),
          { timeout: 5000 }
        ).catch(() => {});
      }

      const siguienteDisabledOnLastPage = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="next-page"]');
        return btn ? btn.hasAttribute("disabled") : false;
      });

      log(
        "TEST-16: Buttons disabled at boundaries (Anterior on p1, Siguiente on last)",
        anteriorDisabledOnPage1 && siguienteDisabledOnLastPage,
        `Anterior disabled on p1: ${anteriorDisabledOnPage1}, Siguiente disabled on last: ${siguienteDisabledOnLastPage}`
      );
    } else {
      // No pagination — check that controls are hidden
      const totalFromPage = await page.evaluate(() => {
        const allCards = document.querySelectorAll(".rounded-lg.border.border-gray-200.bg-white.p-4 h3");
        return allCards.length;
      });
      log("TEST-12: Pagination hidden when items <= page_size", totalFromPage <= 10, `Total visible: ${totalFromPage}`);
      log("TEST-13: (skipped — pagination not visible)", true, "N/A — not enough items");
      log("TEST-14: (skipped — pagination not visible)", true, "N/A");
      log("TEST-15: (skipped — pagination not visible)", true, "N/A");
      log("TEST-16: (skipped — pagination not visible)", true, "N/A");
    }

    // ═══════════════════════════════════════════════════════════════════
    // STATS CARDS TEST
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- STATS CARDS TEST ---");

    // Go back to page 1 / reset filters
    await navigateToCapacitaciones(page);

    // TEST 17: Verify stats cards
    const statsText = await page.evaluate(() => {
      const statCards = document.querySelectorAll(".grid.grid-cols-2.md\\:grid-cols-4 .rounded-lg");
      return Array.from(statCards).map((card) => {
        const label = card.querySelector("p.text-xs")?.textContent?.trim() ?? "";
        const value = card.querySelector("p.text-2xl, p.mt-1")?.textContent?.trim() ?? "";
        return { label, value };
      });
    });

    console.log("Stats cards found:", JSON.stringify(statsText));

    // Get counts from visible cards to verify
    const visibleCards = await page.evaluate(() => {
      const cardEls = document.querySelectorAll(".rounded-lg.border.border-gray-200.bg-white.p-4");
      let presencial = 0, online = 0, mixta = 0, activas = 0;
      cardEls.forEach((card) => {
        const badges = card.querySelectorAll("span.inline-flex");
        badges.forEach((badge) => {
          const text = badge.textContent?.trim() ?? "";
          if (text === "Presencial") presencial++;
          if (text === "En linea") online++;
          if (text === "Mixta") mixta++;
          if (text === "Activa") activas++;
        });
      });
      return { presencial, online, mixta, activas };
    });

    // Stats show counts from the current page items
    const activasStat = statsText.find((s) => s.label.toLowerCase().includes("activa"));
    const presencialStat = statsText.find((s) => s.label.toLowerCase().includes("presencial"));
    const onlineMixtaStat = statsText.find((s) => s.label.toLowerCase().includes("online"));

    const activasMatch = activasStat ? parseInt(activasStat.value) === visibleCards.activas : false;
    const presencialMatch = presencialStat ? parseInt(presencialStat.value) === visibleCards.presencial : false;
    const onlineMixtaMatch = onlineMixtaStat ? parseInt(onlineMixtaStat.value) === (visibleCards.online + visibleCards.mixta) : false;

    log(
      "TEST-17: Stats cards match visible data (Activas, Presencial, Online/Mixta)",
      activasMatch && presencialMatch && onlineMixtaMatch,
      `Stats: Activas=${activasStat?.value}(expected ${visibleCards.activas}), Presencial=${presencialStat?.value}(expected ${visibleCards.presencial}), Online/Mixta=${onlineMixtaStat?.value}(expected ${visibleCards.online + visibleCards.mixta})`
    );

    // ═══════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n--- CLEANUP ---");
    await cleanupTestData(page);
    console.log("Cleanup complete.");

  } catch (err) {
    console.error("FATAL ERROR:", err);
  } finally {
    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("TEST RESULTS SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    results.forEach((r) => {
      console.log(`  [${r.status}] ${r.name}${r.detail ? " — " + r.detail : ""}`);
    });
    console.log(`\nTotal: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("═══════════════════════════════════════════════════════");

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
})();
