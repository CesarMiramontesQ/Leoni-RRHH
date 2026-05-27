/**
 * Playwright script: Poblar perfiles de puesto con competencias y empleados
 * via API (autenticada con JWT).
 *
 * Usage: node tests/e2e/seed_perfiles_competencias.mjs
 */

const BASE = "http://localhost:8000";
const LOGIN_USER = "admin.rh@leoni.com";
const LOGIN_PASS = "Leoni2026!RH";

// Competencias disponibles (IDs reales en BD)
const COMPETENCIAS = {
  SAP: 20,
  MS_OFFICE: 21,
  INGLES: 22,
  APQP_PPAP: 23,
  TRABAJO_EQUIPO: 24,
  SAP_QM: 25,
  LECTURA_PLANOS: 26,
  INSTRUMENTOS_MEDICION: 27,
  ANALISIS_8D: 28,
  SAP_MM_WM: 29,
  EXCEL_POWER_BI: 30,
  GESTION_INVENTARIOS: 31,
  LIDERAZGO: 32,
  LEAN_5S: 33,
  SAP_PM: 34,
  PLC_SIEMENS: 35,
  DIAGRAMAS_ELECTRICOS: 36,
  SOLDADURA: 37,
  TPM: 38,
};

// Mapeo: perfil_id → competencias que debe tener
const PERFIL_COMPETENCIAS = {
  1: [COMPETENCIAS.MS_OFFICE, COMPETENCIAS.TRABAJO_EQUIPO, COMPETENCIAS.LEAN_5S, COMPETENCIAS.LECTURA_PLANOS],
  3: [COMPETENCIAS.SAP_QM, COMPETENCIAS.APQP_PPAP, COMPETENCIAS.ANALISIS_8D, COMPETENCIAS.INSTRUMENTOS_MEDICION, COMPETENCIAS.INGLES],
  4: [COMPETENCIAS.PLC_SIEMENS, COMPETENCIAS.DIAGRAMAS_ELECTRICOS, COMPETENCIAS.SOLDADURA, COMPETENCIAS.TPM, COMPETENCIAS.LECTURA_PLANOS],
  5: [COMPETENCIAS.LIDERAZGO, COMPETENCIAS.LEAN_5S, COMPETENCIAS.SAP, COMPETENCIAS.TRABAJO_EQUIPO, COMPETENCIAS.EXCEL_POWER_BI],
  6: [COMPETENCIAS.LECTURA_PLANOS, COMPETENCIAS.INSTRUMENTOS_MEDICION, COMPETENCIAS.MS_OFFICE, COMPETENCIAS.LEAN_5S],
  7: [COMPETENCIAS.MS_OFFICE, COMPETENCIAS.TRABAJO_EQUIPO, COMPETENCIAS.LEAN_5S, COMPETENCIAS.LECTURA_PLANOS],
  8: [COMPETENCIAS.PLC_SIEMENS, COMPETENCIAS.DIAGRAMAS_ELECTRICOS, COMPETENCIAS.TPM, COMPETENCIAS.SAP_PM, COMPETENCIAS.SOLDADURA],
  10: [COMPETENCIAS.SAP_MM_WM, COMPETENCIAS.EXCEL_POWER_BI, COMPETENCIAS.GESTION_INVENTARIOS, COMPETENCIAS.LIDERAZGO, COMPETENCIAS.LEAN_5S],
  11: [COMPETENCIAS.LEAN_5S, COMPETENCIAS.TRABAJO_EQUIPO, COMPETENCIAS.MS_OFFICE, COMPETENCIAS.INGLES],
  12: [COMPETENCIAS.SAP, COMPETENCIAS.EXCEL_POWER_BI, COMPETENCIAS.APQP_PPAP, COMPETENCIAS.LEAN_5S, COMPETENCIAS.ANALISIS_8D, COMPETENCIAS.INGLES],
  13: [COMPETENCIAS.LIDERAZGO, COMPETENCIAS.LEAN_5S, COMPETENCIAS.TRABAJO_EQUIPO, COMPETENCIAS.SAP, COMPETENCIAS.EXCEL_POWER_BI],
  14: [COMPETENCIAS.SAP_MM_WM, COMPETENCIAS.EXCEL_POWER_BI, COMPETENCIAS.GESTION_INVENTARIOS, COMPETENCIAS.INGLES, COMPETENCIAS.MS_OFFICE],
  15: [COMPETENCIAS.MS_OFFICE, COMPETENCIAS.INGLES, COMPETENCIAS.EXCEL_POWER_BI, COMPETENCIAS.SAP, COMPETENCIAS.APQP_PPAP],
  16: [COMPETENCIAS.SAP_MM_WM, COMPETENCIAS.GESTION_INVENTARIOS, COMPETENCIAS.LIDERAZGO, COMPETENCIAS.LEAN_5S, COMPETENCIAS.EXCEL_POWER_BI],
};

// Mapeo: perfil_id → empleados a asignar (IDs reales)
const PERFIL_EMPLEADOS = {
  1: [259, 559, 170, 356, 661],
  3: [228, 507, 934, 409, 135],
  4: [326, 276, 78, 292, 371],
  5: [215, 400, 447, 317, 342],
  6: [611, 759, 632, 510, 789],
  7: [393, 586, 501, 678, 363],
  8: [35, 73, 837, 315, 696],
  10: [238, 334, 225, 226, 257],
  11: [884, 219],
  12: [593, 422, 80, 87, 830],
  13: [34, 537, 941, 853, 785],
  14: [478, 642, 787, 559, 276],
  15: [27, 240, 170, 363],
  16: [259, 507],
};

async function getToken() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(LOGIN_USER)}&password=${encodeURIComponent(LOGIN_PASS)}`,
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function addCompetencia(token, perfilId, competenciaId) {
  const res = await fetch(`${BASE}/api/v1/perfiles/${perfilId}/competencias`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ competencia_id: competenciaId }),
  });
  if (res.status === 409) return "duplicate";
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ Error adding comp ${competenciaId} to perfil ${perfilId}: ${res.status} ${text}`);
    return "error";
  }
  return "ok";
}

async function addAsignacion(token, perfilId, empleadoId) {
  const res = await fetch(`${BASE}/api/v1/perfiles/${perfilId}/asignaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ puesto_perfil_id: perfilId, empleado_id: empleadoId }),
  });
  if (res.status === 409 || res.status === 422) return "duplicate";
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ Error assigning emp ${empleadoId} to perfil ${perfilId}: ${res.status} ${text}`);
    return "error";
  }
  return "ok";
}

async function main() {
  console.log("=== Seed: Competencias y Empleados en Perfiles de Puesto ===\n");

  const token = await getToken();
  console.log("✓ Login exitoso\n");

  // 1. Agregar competencias
  console.log("── Agregando competencias a perfiles ──");
  for (const [perfilId, compIds] of Object.entries(PERFIL_COMPETENCIAS)) {
    let added = 0;
    let skipped = 0;
    for (const compId of compIds) {
      const result = await addCompetencia(token, perfilId, compId);
      if (result === "ok") added++;
      else skipped++;
    }
    console.log(`  Perfil ${perfilId}: ${added} agregadas, ${skipped} ya existían`);
  }

  console.log("\n── Asignando empleados a perfiles ──");
  for (const [perfilId, empIds] of Object.entries(PERFIL_EMPLEADOS)) {
    let added = 0;
    let skipped = 0;
    for (const empId of empIds) {
      const result = await addAsignacion(token, perfilId, empId);
      if (result === "ok") added++;
      else skipped++;
    }
    console.log(`  Perfil ${perfilId}: ${added} asignados, ${skipped} ya existían/error`);
  }

  console.log("\n✓ Seed completado");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
