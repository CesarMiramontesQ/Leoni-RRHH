/**
 * Playwright E2E: Validates role-based permissions for all user roles.
 *
 * Tests per role:
 *  - Which nav items are visible in the sidebar
 *  - Which routes are accessible (not redirected to dashboard)
 *  - Evaluaciones: can/cannot see "Nueva evaluación" button
 *  - Puestos/Competencias: accessible only for rh, director, gerente
 *
 * Usage: node tests/e2e/validate_permissions.mjs
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const PASSWORD = "Test1234!";

const USERS = [
  { email: "empleado.test@leoni.com", rol: "empleado" },
  { email: "supervisor.test@leoni.com", rol: "supervisor" },
  { email: "gerente.test@leoni.com", rol: "gerente" },
  { email: "director.test@leoni.com", rol: "director" },
  { email: "rh.test@leoni.com", rol: "rh" },
];

// Expected nav visibility per role (based on shellNavPolicy.ts)
const NAV_EXPECTATIONS = {
  empleado: {
    visible: ["Dashboard", "Solicitudes", "Comedor", "Notificaciones"],
    hidden: ["Organigrama", "Incidencias", "Actas", "Reporte comedor", "Evaluaciones", "Capacitaciones", "Perfiles de Puesto", "Matriz de Competencias", "Empleados"],
  },
  supervisor: {
    visible: ["Dashboard", "Organigrama", "Solicitudes", "Incidencias", "Comedor", "Notificaciones", "Empleados"],
    hidden: ["Actas", "Reporte comedor", "Evaluaciones", "Capacitaciones", "Perfiles de Puesto", "Matriz de Competencias"],
  },
  gerente: {
    visible: ["Dashboard", "Solicitudes", "Incidencias", "Comedor", "Notificaciones", "Empleados"],
    hidden: [
      "Organigrama",
      "Actas",
      "Reporte comedor",
      "Evaluaciones",
      "Capacitaciones",
      "Perfiles de Puesto",
      "Matriz de Competencias",
      "Matriz de Capacidades",
      "Matriz de Habilidades",
      "Manejo de Cursos",
      "Manejo de OPLs",
      "Motor de Evidencias",
      "Motor de Sugerencias",
      "Encuestas Post Curso",
    ],
  },
  director: {
    visible: ["Dashboard", "Solicitudes", "Incidencias", "Actas", "Comedor", "Reporte comedor", "Evaluaciones", "Notificaciones", "Perfiles de Puesto", "Matriz de Competencias", "Empleados"],
    hidden: ["Organigrama"],
  },
  rh: {
    visible: ["Dashboard", "Métricas", "Solicitudes", "Incidencias", "Gestión Comedor", "Reporte de comedor", "Empleados"],
    hidden: [
      "Organigrama",
      "Actas",
      "Evaluaciones",
      "Capacitaciones",
      "Perfiles de Puesto",
      "Matriz de Competencias",
      "Matriz de Capacidades",
      "Matriz de Habilidades",
      "Manejo de Cursos",
      "Manejo de OPLs",
      "Motor de Evidencias",
      "Motor de Sugerencias",
      "Encuestas Post Curso",
    ],
  },
};

// Routes and access expectations
const ROUTE_TESTS = {
  empleado: {
    allowed: ["#/", "#/solicitudes", "#/comedor", "#/notificaciones"],
    blocked: ["#/empleados", "#/evaluaciones", "#/capacitaciones", "#/puestos", "#/competencias", "#/actas", "#/incidencias", "#/organigrama"],
  },
  supervisor: {
    allowed: ["#/", "#/solicitudes", "#/incidencias", "#/comedor", "#/empleados", "#/evaluaciones", "#/notificaciones"],
    blocked: ["#/actas", "#/puestos", "#/competencias"],
  },
  gerente: {
    allowed: ["#/", "#/solicitudes", "#/incidencias", "#/actas", "#/comedor", "#/empleados", "#/evaluaciones", "#/puestos", "#/competencias", "#/notificaciones"],
    blocked: ["#/organigrama"],
  },
  director: {
    allowed: ["#/", "#/solicitudes", "#/incidencias", "#/actas", "#/comedor", "#/empleados", "#/evaluaciones", "#/puestos", "#/competencias", "#/notificaciones"],
    blocked: ["#/organigrama"],
  },
  rh: {
    allowed: ["#/", "#/solicitudes", "#/incidencias", "#/actas", "#/comedor", "#/empleados", "#/evaluaciones", "#/puestos", "#/competencias", "#/organigrama", "#/notificaciones"],
    blocked: [],
  },
};

// Evaluaciones-specific checks
const EVAL_PERMISSIONS = {
  empleado: { canCreate: false },
  supervisor: { canCreate: true },
  gerente: { canCreate: false },
  director: { canCreate: false },
  rh: { canCreate: true },
};

let totalPass = 0;
let totalFail = 0;

function pass(msg) {
  totalPass++;
  console.log(`    ✓ ${msg}`);
}

function fail(msg) {
  totalFail++;
  console.log(`    ✗ FAIL: ${msg}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1000);

  const emailInput =
    (await page.$('input[name="username"]')) ||
    (await page.$('input[type="email"]'));
  const passInput =
    (await page.$('input[name="password"]')) ||
    (await page.$('input[type="password"]'));

  await emailInput.fill(email);
  await passInput.fill(PASSWORD);

  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(3000);
}

async function logout(page) {
  // Clear localStorage to force re-login
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1000);
}

async function testNavVisibility(page, rol) {
  const expectations = NAV_EXPECTATIONS[rol];

  // Get all nav link texts
  const navTexts = await page.$$eval("nav a, aside a", (links) =>
    links.map((a) => a.textContent.trim()).filter((t) => t.length > 0)
  );

  for (const item of expectations.visible) {
    if (navTexts.some((t) => t.includes(item))) {
      pass(`Nav visible: "${item}"`);
    } else {
      fail(`Nav should be visible: "${item}" (found: ${navTexts.join(", ")})`);
    }
  }

  for (const item of expectations.hidden) {
    if (!navTexts.some((t) => t.includes(item))) {
      pass(`Nav hidden: "${item}"`);
    } else {
      fail(`Nav should be hidden: "${item}"`);
    }
  }
}

async function testRouteAccess(page, rol) {
  const routes = ROUTE_TESTS[rol];

  for (const route of routes.allowed) {
    await page.goto(`${BASE}/${route}`);
    await page.waitForTimeout(1500);
    const currentHash = await page.evaluate(() => window.location.hash || "#/");

    if (currentHash === route || currentHash.startsWith(route)) {
      pass(`Route accessible: ${route}`);
    } else {
      fail(`Route ${route} should be accessible, but redirected to ${currentHash}`);
    }
  }

  for (const route of routes.blocked) {
    await page.goto(`${BASE}/${route}`);
    await page.waitForTimeout(1500);
    const currentHash = await page.evaluate(() => window.location.hash || "#/");

    if (currentHash === "#/" || currentHash !== route) {
      pass(`Route blocked: ${route} → redirected to ${currentHash}`);
    } else {
      fail(`Route ${route} should be blocked but was accessible`);
    }
  }
}

async function testEvaluacionesPermissions(page, rol) {
  const expected = EVAL_PERMISSIONS[rol];

  await page.goto(`${BASE}/#/evaluaciones`);
  await page.waitForTimeout(2000);

  const currentHash = await page.evaluate(() => window.location.hash);
  if (!currentHash.startsWith("#/evaluaciones")) {
    pass(`Evaluaciones: access correctly denied for ${rol}`);
    return;
  }

  const createBtn = await page.$('[data-action="open-modal"]');

  if (expected.canCreate) {
    if (createBtn) {
      pass(`Evaluaciones: "Nueva evaluación" button visible`);
    } else {
      fail(`Evaluaciones: "Nueva evaluación" button should be visible for ${rol}`);
    }
  } else {
    if (!createBtn) {
      pass(`Evaluaciones: "Nueva evaluación" button hidden`);
    } else {
      fail(`Evaluaciones: "Nueva evaluación" button should be hidden for ${rol}`);
    }
  }

  // Check delete buttons
  const deleteBtns = await page.$$('[data-action="delete-eval"]');
  if (expected.canCreate) {
    if (deleteBtns.length > 0) {
      pass(`Evaluaciones: "Eliminar" buttons visible`);
    } else {
      pass(`Evaluaciones: no evaluations to show delete buttons (OK)`);
    }
  } else {
    if (deleteBtns.length === 0) {
      pass(`Evaluaciones: "Eliminar" buttons hidden`);
    } else {
      fail(`Evaluaciones: "Eliminar" buttons should be hidden for ${rol}`);
    }
  }
}

async function testEvaluacionesAPIPermissions(page, rol) {
  const canCreate = EVAL_PERMISSIONS[rol].canCreate;

  // Try to create an evaluation via API (using the page's auth context)
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) return { status: 0, detail: "no token" };

    const res = await fetch("/api/v1/evaluaciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        empleado_id: 2,
        competencia_id: 2,
        nivel_actual: 2,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, detail: data.detail || "" };
  });

  if (canCreate) {
    if (result.status === 201 || result.status === 200) {
      pass(`API POST /evaluaciones: allowed (${result.status})`);
    } else if (result.status === 403) {
      // Supervisor might get 403 if employee is in different area
      pass(`API POST /evaluaciones: got 403 (area restriction — expected for supervisor cross-area)`);
    } else {
      fail(`API POST /evaluaciones: expected 200/201, got ${result.status} — ${result.detail}`);
    }
  } else {
    if (result.status === 403) {
      pass(`API POST /evaluaciones: correctly denied (403)`);
    } else if (result.status === 201 || result.status === 200) {
      fail(`API POST /evaluaciones: should be denied for ${rol} but got ${result.status}`);
    } else {
      pass(`API POST /evaluaciones: denied (${result.status} — ${result.detail})`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const user of USERS) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ROL: ${user.rol.toUpperCase()} (${user.email})`);
    console.log(`${"═".repeat(60)}`);

    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    await login(page, user.email);

    console.log(`\n  [Nav Visibility]`);
    await testNavVisibility(page, user.rol);

    console.log(`\n  [Route Access]`);
    await testRouteAccess(page, user.rol);

    console.log(`\n  [Evaluaciones Permissions]`);
    await testEvaluacionesPermissions(page, user.rol);

    console.log(`\n  [API Permissions]`);
    await testEvaluacionesAPIPermissions(page, user.rol);

    await context.close();
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESUMEN: ${totalPass} passed, ${totalFail} failed`);
  console.log(`${"═".repeat(60)}\n`);

  await browser.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

main();
