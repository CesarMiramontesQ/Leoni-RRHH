import type { RhIncidenciaTablaFila, RhIncidenciasEstadisticasData } from "./types.ts";

function normArea(a: string | undefined | null): string {
  const t = (a ?? "").trim();
  return t.length > 0 ? t : "(sin área)";
}

function normSub(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : "(sin subárea)";
}

function textoSegCal(
  tipo: string,
  categoria: string | null | undefined,
  tipoTexto: string | undefined,
): { seg: boolean; cal: boolean } {
  const blob = `${tipoTexto ?? ""} ${tipo} ${categoria ?? ""}`.toLowerCase();
  return {
    seg: blob.includes("seguridad"),
    cal: blob.includes("calidad"),
  };
}

function tipoLabel(row: RhIncidenciaTablaFila): string {
  const raw = row.tipo_texto?.trim();
  return raw && raw.length > 0 ? raw : row.tipo;
}

function isoHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fecha de negocio definida y no posterior a hoy (zona local del navegador). */
function fechaIncidenciaHastaHoy(fecha: string | undefined | null): boolean {
  const f = fecha?.trim();
  if (!f || f.length < 10 || !/^\d{4}-\d{2}-\d{2}/.test(f)) return false;
  return f.slice(0, 10) <= isoHoyLocal();
}

/** Agregados locales (p. ej. dataset mock) alineados con GET /incidencias/estadisticas. */
export function computeRhIncidenciasEstadisticasFromFilas(
  rows: readonly RhIncidenciaTablaFila[],
): RhIncidenciasEstadisticasData {
  const byArea = new Map<string, number>();
  const bySubArea = new Map<string, Map<string, number>>();
  const byEmp = new Map<
    string,
    { empleado_id: number; no_empleado: string | null; nombre: string | null; total: number }
  >();
  const byTipo = new Map<string, number>();
  let nSeg = 0;
  let nCal = 0;

  for (const r of rows) {
    const a = normArea(r.area);
    byArea.set(a, (byArea.get(a) ?? 0) + 1);

    const s = normSub(r.subarea);
    const ar = normArea(r.area);
    let inner = bySubArea.get(s);
    if (!inner) {
      inner = new Map();
      bySubArea.set(s, inner);
    }
    inner.set(ar, (inner.get(ar) ?? 0) + 1);

    const eid = Number.parseInt(String(r.empleado_id), 10);
    const ek = Number.isFinite(eid) ? String(eid) : r.empleado_id;
    const prev = byEmp.get(ek);
    const nom = r.empleado_nombre_raw?.trim() || null;
    const no = r.no_empleado?.trim() || null;
    if (prev) {
      prev.total += 1;
      if (!prev.nombre && nom) prev.nombre = nom;
      if (!prev.no_empleado && no) prev.no_empleado = no;
    } else {
      byEmp.set(ek, {
        empleado_id: Number.isFinite(eid) ? eid : 0,
        no_empleado: no,
        nombre: nom,
        total: 1,
      });
    }

    const t = tipoLabel(r);
    byTipo.set(t, (byTipo.get(t) ?? 0) + 1);

    const { seg, cal } = textoSegCal(r.tipo, r.categoria, r.tipo_texto);
    if (seg) nSeg += 1;
    if (cal) nCal += 1;
  }

  const top =
    <K>(m: Map<K, number>, label: (k: K) => string) =>
    [...m.entries()]
      .map(([k, total]) => ({ key: label(k), total }))
      .sort((x, y) => y.total - x.total)
      .slice(0, 10);

  const areas = top(byArea, (k) => String(k)).map((x) => ({ area: x.key, total: x.total }));

  const subRanked = [...bySubArea.entries()]
    .map(([sub, amap]) => {
      const total = [...amap.values()].reduce((s, v) => s + v, 0);
      const bestArea = [...amap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { subarea: sub, total, area: bestArea };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const empleados = [...byEmp.values()].sort((a, b) => b.total - a.total).slice(0, 10);

  const tipoRows = [...byTipo.entries()].sort((a, b) => b[1] - a[1]);
  const tipoTotal = tipoRows.reduce((s, [, c]) => s + c, 0);
  const incidencias_por_tipo = tipoRows.map(([tipo, total]) => ({
    tipo,
    total,
    porcentaje: tipoTotal > 0 ? Math.round((10000 * total) / tipoTotal) / 100 : 0,
  }));

  const byMonth = new Map<string, number>();
  const byMonthTipo = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!fechaIncidenciaHastaHoy(r.fecha)) continue;
    const fromFecha = r.fecha!.trim();
    const key = fromFecha.length >= 7 ? fromFecha.slice(0, 7) : null;
    if (key && /^\d{4}-\d{2}$/.test(key)) {
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
      const t = tipoLabel(r);
      let inner = byMonthTipo.get(key);
      if (!inner) {
        inner = new Map();
        byMonthTipo.set(key, inner);
      }
      inner.set(t, (inner.get(t) ?? 0) + 1);
    }
  }
  const incidencias_por_mes = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([periodo, total]) => ({ periodo, total }));

  const incidencias_por_mes_y_tipo: { periodo: string; tipo: string; total: number }[] = [];
  for (const [periodo, tmap] of [...byMonthTipo.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [tipo, total] of tmap.entries()) {
      incidencias_por_mes_y_tipo.push({ periodo, tipo, total });
    }
  }

  return {
    total_incidencias: rows.length,
    incidencias_seguridad: nSeg,
    incidencias_calidad: nCal,
    areas_con_mas_incidencias: areas,
    subareas_con_mas_incidencias: subRanked,
    empleados_con_mas_incidencias: empleados,
    incidencias_por_tipo,
    incidencias_por_mes,
    incidencias_por_mes_y_tipo,
    tendencia_agrupacion: null,
    incidencias_por_periodo_y_tipo: [],
    total_periodo_anterior: null,
    variacion_total_pct: null,
  };
}
