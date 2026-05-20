import {
  aggregateHoDiasPorDiaLaboral,
  type HoDiasPorDiaLaboralSerie,
} from "./aggregateHoDiasPorDiaLaboral.ts";
import {
  aggregateSolicitudesDiasPorMes,
  type SolicitudDiasPorMesSerie,
} from "./aggregateSolicitudesDiasPorMes.ts";
import { emptyConteoPorTipo, labelSolicitudTipo, RH_SOLICITUD_TIPOS_ORDEN } from "./solicitudTipoDisplay.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./types.ts";

export type SolicitudAnalyticsSlice = {
  /** Presente en `por_tipo`; ausente en `por_estado`. */
  codigo?: RhSolicitudTipoCodigo;
  label: string;
  total: number;
  porcentaje: number;
};

export type SolicitudMesVacHo = {
  periodo: string;
  vacaciones: number;
  home_office: number;
};

export type SolicitudTendenciaMesSerie = {
  codigo: RhSolicitudTipoCodigo;
  label: string;
  valores: readonly number[];
};

/** Solicitudes creadas por mes, desglosadas por tipo (últimos 6 meses). */
export type SolicitudTendenciaMesPorTipo = {
  periodos: readonly string[];
  series: readonly SolicitudTendenciaMesSerie[];
};

export type SolicitudRankingRow = { label: string; total: number };

export type SolicitudDepartamentoVacHoRow = {
  label: string;
  vacaciones: number;
  home_office: number;
  total: number;
};

/** Datos para gráfica apilada vacaciones / home office por departamento. */
export type SolicitudPorDepartamentoChart = {
  rows: readonly SolicitudDepartamentoVacHoRow[];
  departamento_lider: string | null;
  total_vacaciones: number;
  total_home_office: number;
};

const ESTADOS_DEPT_CHART = new Set<RhSolicitudEstadoCodigo>(["approved", "overridden"]);

export type RhSolicitudesAnalyticsKpis = {
  total: number;
  pendientes: number;
  cambios_solicitados: number;
  aprobadas: number;
  area_top: SolicitudRankingRow | null;
};

export type RhSolicitudesAnalyticsData = {
  kpis: RhSolicitudesAnalyticsKpis;
  por_tipo: SolicitudAnalyticsSlice[];
  por_estado: SolicitudAnalyticsSlice[];
  tendencia_mes_por_tipo: SolicitudTendenciaMesPorTipo;
  por_mes_vac_ho: SolicitudMesVacHo[];
  solicitudes_por_departamento: SolicitudPorDepartamentoChart;
  dias_solicitados_por_mes: SolicitudDiasPorMesSerie;
  ho_dias_por_dia_laboral: HoDiasPorDiaLaboralSerie;
};

const ESTADO_LABEL: Record<RhSolicitudEstadoCodigo, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  changes_requested: "Cambios solicitados",
  cancelled: "Cancelada",
  overridden: "Override",
};

function mesFromIsoDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
}

function slicesFromTipoCounts(counts: Map<RhSolicitudTipoCodigo, number>): SolicitudAnalyticsSlice[] {
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  if (total <= 0) return [];
  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .map(([codigo, n]) => ({
      codigo,
      label: labelSolicitudTipo(codigo),
      total: n,
      porcentaje: Math.round((1000 * n) / total) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

function slicesFromCounts(counts: Map<string, number>, labelOf: (key: string) => string): SolicitudAnalyticsSlice[] {
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  if (total <= 0) return [];
  return [...counts.entries()]
    .map(([key, n]) => ({
      label: labelOf(key),
      total: n,
      porcentaje: Math.round((1000 * n) / total) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

function rankingTop(counts: Map<string, number>, top = 5): SolicitudRankingRow[] {
  return [...counts.entries()]
    .map(([label, total]) => ({ label: label.trim() || "Sin dato", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}

function filaCuentaGraficaDepartamento(r: RhSolicitudTablaFila, estadoFiltroActivo: string): boolean {
  if (r.tipo !== "vacaciones" && r.tipo !== "home_office") return false;
  if (estadoFiltroActivo.trim() !== "") return true;
  return ESTADOS_DEPT_CHART.has(r.estado);
}

function buildSolicitudesPorDepartamento(
  vacaciones: Map<string, number>,
  homeOffice: Map<string, number>,
): SolicitudPorDepartamentoChart {
  const labels = new Set([...vacaciones.keys(), ...homeOffice.keys()]);
  const rows = [...labels]
    .map((label) => {
      const v = vacaciones.get(label) ?? 0;
      const h = homeOffice.get(label) ?? 0;
      return { label, vacaciones: v, home_office: h, total: v + h };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  let total_vacaciones = 0;
  let total_home_office = 0;
  for (const r of rows) {
    total_vacaciones += r.vacaciones;
    total_home_office += r.home_office;
  }

  return {
    rows,
    departamento_lider: rows[0]?.label ?? null,
    total_vacaciones,
    total_home_office,
  };
}

function ultimosMeses(count: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

function etiquetaMesCorto(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  if (!y || !m) return periodo;
  const raw = new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" }).format(
    new Date(y, m - 1, 1),
  );
  return raw.replace(/\./g, "");
}

export { etiquetaMesCorto };

export function tendenciaMesTieneDatos(tendencia: SolicitudTendenciaMesPorTipo): boolean {
  return tendencia.series.some((s) => s.valores.some((v) => v > 0));
}

export type ComputeSolicitudesAnalyticsOpts = {
  /** Si está vacío, la gráfica HO por día laboral usa solo aprobadas/overridden. */
  estadoFiltroActivo?: string;
};

export function computeSolicitudesAnalytics(
  rows: readonly RhSolicitudTablaFila[],
  now = new Date(),
  opts: ComputeSolicitudesAnalyticsOpts = {},
): RhSolicitudesAnalyticsData {
  const porTipo = new Map<RhSolicitudTipoCodigo, number>();
  const porEstado = new Map<RhSolicitudEstadoCodigo, number>();
  const porMesPorTipo = new Map<string, Record<RhSolicitudTipoCodigo, number>>();
  const porMesVac = new Map<string, number>();
  const porMesHo = new Map<string, number>();
  const porArea = new Map<string, number>();
  const porAreaVac = new Map<string, number>();
  const porAreaHo = new Map<string, number>();

  let pendientes = 0;
  let cambios = 0;
  let aprobadas = 0;

  for (const r of rows) {
    porTipo.set(r.tipo, (porTipo.get(r.tipo) ?? 0) + 1);

    porEstado.set(r.estado, (porEstado.get(r.estado) ?? 0) + 1);

    if (r.estado === "pending") pendientes += 1;
    if (r.estado === "changes_requested") cambios += 1;
    if (r.estado === "approved" || r.estado === "overridden") aprobadas += 1;

    const mes = mesFromIsoDate(r.fecha_solicitud);
    if (mes) {
      let bucket = porMesPorTipo.get(mes);
      if (!bucket) {
        bucket = emptyConteoPorTipo();
        porMesPorTipo.set(mes, bucket);
      }
      bucket[r.tipo] += 1;
      if (r.tipo === "vacaciones") porMesVac.set(mes, (porMesVac.get(mes) ?? 0) + 1);
      if (r.tipo === "home_office") porMesHo.set(mes, (porMesHo.get(mes) ?? 0) + 1);
    }

    const area = (r.area || "Sin área").trim();
    porArea.set(area, (porArea.get(area) ?? 0) + 1);
    if (filaCuentaGraficaDepartamento(r, opts.estadoFiltroActivo ?? "")) {
      if (r.tipo === "vacaciones") {
        porAreaVac.set(area, (porAreaVac.get(area) ?? 0) + 1);
      } else if (r.tipo === "home_office") {
        porAreaHo.set(area, (porAreaHo.get(area) ?? 0) + 1);
      }
    }
  }

  const mesesVentana = ultimosMeses(6, now);
  const tendencia_mes_por_tipo: SolicitudTendenciaMesPorTipo = {
    periodos: mesesVentana,
    series: RH_SOLICITUD_TIPOS_ORDEN.map((codigo) => ({
      codigo,
      label: labelSolicitudTipo(codigo),
      valores: mesesVentana.map((periodo) => porMesPorTipo.get(periodo)?.[codigo] ?? 0),
    })),
  };
  const por_mes_vac_ho: SolicitudMesVacHo[] = mesesVentana.map((periodo) => ({
    periodo,
    vacaciones: porMesVac.get(periodo) ?? 0,
    home_office: porMesHo.get(periodo) ?? 0,
  }));

  const dias_solicitados_por_mes = aggregateSolicitudesDiasPorMes(rows, mesesVentana);
  const ho_dias_por_dia_laboral = aggregateHoDiasPorDiaLaboral(rows, {
    estadoFiltroActivo: opts.estadoFiltroActivo ?? "",
  });

  return {
    kpis: {
      total: rows.length,
      pendientes,
      cambios_solicitados: cambios,
      aprobadas,
      area_top: rankingTop(porArea, 1)[0] ?? null,
    },
    por_tipo: slicesFromTipoCounts(porTipo),
    por_estado: slicesFromCounts(
      porEstado as Map<string, number>,
      (k) => ESTADO_LABEL[k as RhSolicitudEstadoCodigo] ?? k,
    ),
    tendencia_mes_por_tipo,
    por_mes_vac_ho,
    solicitudes_por_departamento: buildSolicitudesPorDepartamento(porAreaVac, porAreaHo),
    dias_solicitados_por_mes,
    ho_dias_por_dia_laboral,
  };
}
