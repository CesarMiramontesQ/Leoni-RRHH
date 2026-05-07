import type { ComedorResumenDiarioApiItem } from "../../api/comedor.ts";
import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";
import type { ReporteComedorTipoComidaFilter } from "./types.ts";

export type EstadoOps = "pendiente" | "confirmado" | "cancelado";

export type ReporteAggComedor = {
  comedorNombre: string;
  registros: number;
  confirmados: number;
  pendientes: number;
  cancelados: number;
  empleadosUnicos: number;
  fechasDistintas: number;
};

export type ReporteAggEmpleado = {
  empleadoId: number;
  nombre: string;
  noEmpleado: string;
  area: string;
  registros: number;
  confirmados: number;
  pendientes: number;
  cancelados: number;
  comedorFrecuente: string | null;
  ultimoServicioIso: string | null;
};

export type ReporteAggArea = {
  areaNombre: string;
  registros: number;
  empleadosUnicos: number;
  confirmados: number;
  pendientes: number;
  cancelados: number;
  comedorPrincipal: string | null;
};

function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN;
  return new Date(y, m - 1, d).getTime();
}

/** Inclusive date range [desde, hasta] by calendar date. */
export function rowEnRangoFechaServicio(fechaServicioIso: string, desdeIso: string, hastaIso: string): boolean {
  const t = isoToMs(fechaServicioIso.slice(0, 10));
  const a = isoToMs(desdeIso);
  const b = isoToMs(hastaIso);
  if (!Number.isFinite(t) || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  return t >= a && t <= b;
}

export function clasificarEstadoOps(estadoAcceso: string): EstadoOps {
  const k = estadoAcceso.trim().toUpperCase();
  if (k === "ACCEDIDO") return "confirmado";
  if (k === "EXPIRADO") return "cancelado";
  return "pendiente";
}

export function filterProximosPorRango(
  rows: readonly ComedorRhProximoRegistroRow[],
  desdeIso: string,
  hastaIso: string,
): readonly ComedorRhProximoRegistroRow[] {
  return rows.filter((r) => rowEnRangoFechaServicio(r.fecha_servicio, desdeIso, hastaIso));
}

export function filterPorComedorSeleccion(
  rows: readonly ComedorRhProximoRegistroRow[],
  comedorNombreExacto: string | null,
): readonly ComedorRhProximoRegistroRow[] {
  if (!comedorNombreExacto || !comedorNombreExacto.trim()) return rows;
  const target = comedorNombreExacto.trim().toLowerCase();
  return rows.filter((r) => (r.comedor_nombre || "").trim().toLowerCase() === target);
}

export function filterPorTipoComidaSeleccion(
  rows: readonly ComedorRhProximoRegistroRow[],
  tipoComida: ReporteComedorTipoComidaFilter,
): readonly ComedorRhProximoRegistroRow[] {
  if (tipoComida === "todos") return rows;
  return rows.filter((r) => (r.tipo_comida || "").trim().toLowerCase() === tipoComida);
}

function incEstado(bucket: { confirmados: number; pendientes: number; cancelados: number }, estado: EstadoOps): void {
  if (estado === "confirmado") bucket.confirmados += 1;
  else if (estado === "cancelado") bucket.cancelados += 1;
  else bucket.pendientes += 1;
}

export function aggregateByComedor(rows: readonly ComedorRhProximoRegistroRow[]): ReporteAggComedor[] {
  const map = new Map<
    string,
    {
      registros: number;
      confirmados: number;
      pendientes: number;
      cancelados: number;
      empleados: Set<number>;
      fechas: Set<string>;
    }
  >();
  for (const r of rows) {
    const key = (r.comedor_nombre || "").trim() || "Sin comedor";
    let g = map.get(key);
    if (!g) {
      g = {
        registros: 0,
        confirmados: 0,
        pendientes: 0,
        cancelados: 0,
        empleados: new Set(),
        fechas: new Set(),
      };
      map.set(key, g);
    }
    g.registros += 1;
    g.empleados.add(r.empleado_id);
    g.fechas.add(r.fecha_servicio.slice(0, 10));
    incEstado(g, clasificarEstadoOps(r.estado_acceso));
  }
  const out: ReporteAggComedor[] = [...map.entries()].map(([comedorNombre, g]) => ({
    comedorNombre,
    registros: g.registros,
    confirmados: g.confirmados,
    pendientes: g.pendientes,
    cancelados: g.cancelados,
    empleadosUnicos: g.empleados.size,
    fechasDistintas: g.fechas.size,
  }));
  out.sort((a, b) => b.registros - a.registros);
  return out;
}

export function aggregateByEmpleado(rows: readonly ComedorRhProximoRegistroRow[]): ReporteAggEmpleado[] {
  const map = new Map<
    number,
    {
      nombre: string;
      noEmpleado: string;
      area: string;
      registros: number;
      confirmados: number;
      pendientes: number;
      cancelados: number;
      fechas: string[];
      comedores: Map<string, number>;
    }
  >();
  for (const r of rows) {
    let g = map.get(r.empleado_id);
    if (!g) {
      g = {
        nombre: r.empleado_nombre,
        noEmpleado: r.no_empleado,
        area: r.area,
        registros: 0,
        confirmados: 0,
        pendientes: 0,
        cancelados: 0,
        fechas: [],
        comedores: new Map(),
      };
      map.set(r.empleado_id, g);
    }
    g.registros += 1;
    g.fechas.push(r.fecha_servicio);
    const cn = (r.comedor_nombre || "").trim() || "Sin comedor";
    g.comedores.set(cn, (g.comedores.get(cn) ?? 0) + 1);
    incEstado(g, clasificarEstadoOps(r.estado_acceso));
  }
  const out: ReporteAggEmpleado[] = [];
  for (const [empleadoId, g] of map) {
    let topComedor: string | null = null;
    let topN = 0;
    for (const [name, n] of g.comedores) {
      if (n > topN) {
        topN = n;
        topComedor = name;
      }
    }
    let ultimo: string | null = null;
    for (const f of g.fechas) {
      if (!ultimo || f > ultimo) ultimo = f;
    }
    out.push({
      empleadoId,
      nombre: g.nombre,
      noEmpleado: g.noEmpleado,
      area: g.area,
      registros: g.registros,
      confirmados: g.confirmados,
      pendientes: g.pendientes,
      cancelados: g.cancelados,
      comedorFrecuente: topComedor && topN > 0 ? topComedor : null,
      ultimoServicioIso: ultimo,
    });
  }
  out.sort((a, b) => b.registros - a.registros);
  return out;
}

export function aggregateByArea(rows: readonly ComedorRhProximoRegistroRow[]): ReporteAggArea[] {
  const map = new Map<
    string,
    {
      registros: number;
      confirmados: number;
      pendientes: number;
      cancelados: number;
      empleados: Set<number>;
      comedores: Map<string, number>;
    }
  >();
  for (const r of rows) {
    const key = (r.area || "").trim() || "Sin área";
    let g = map.get(key);
    if (!g) {
      g = {
        registros: 0,
        confirmados: 0,
        pendientes: 0,
        cancelados: 0,
        empleados: new Set(),
        comedores: new Map(),
      };
      map.set(key, g);
    }
    g.registros += 1;
    g.empleados.add(r.empleado_id);
    const cn = (r.comedor_nombre || "").trim() || "Sin comedor";
    g.comedores.set(cn, (g.comedores.get(cn) ?? 0) + 1);
    incEstado(g, clasificarEstadoOps(r.estado_acceso));
  }
  const out: ReporteAggArea[] = [];
  for (const [areaNombre, g] of map) {
    let principal: string | null = null;
    let topN = 0;
    for (const [name, n] of g.comedores) {
      if (n > topN) {
        topN = n;
        principal = name;
      }
    }
    out.push({
      areaNombre,
      registros: g.registros,
      empleadosUnicos: g.empleados.size,
      confirmados: g.confirmados,
      pendientes: g.pendientes,
      cancelados: g.cancelados,
      comedorPrincipal: principal,
    });
  }
  out.sort((a, b) => b.registros - a.registros);
  return out;
}

export function diasEnPeriodoCalendario(desdeIso: string, hastaIso: string): number {
  const a = isoToMs(desdeIso);
  const b = isoToMs(hastaIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

export function sumResumenDiario(items: readonly ComedorResumenDiarioApiItem[]): {
  total: number;
  caseras: number;
  saludables: number;
  diasConDatos: number;
} {
  let caseras = 0;
  let saludables = 0;
  let diasConDatos = 0;
  for (const row of items) {
    const c = Number.isFinite(row.caseras) ? row.caseras : 0;
    const s = Number.isFinite(row.saludables) ? row.saludables : 0;
    if (c + s > 0) diasConDatos += 1;
    caseras += Math.max(0, c);
    saludables += Math.max(0, s);
  }
  return { total: caseras + saludables, caseras, saludables, diasConDatos };
}

export function serieDiariaTotales(
  items: readonly ComedorResumenDiarioApiItem[],
  tipoComida: ReporteComedorTipoComidaFilter = "todos",
): readonly number[] {
  return [...items]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((row) => {
      const caseras = Math.max(0, row.caseras);
      const saludables = Math.max(0, row.saludables);
      if (tipoComida === "casera") return caseras;
      if (tipoComida === "saludable") return saludables;
      return caseras + saludables;
    });
}
