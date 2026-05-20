import {
  aggregateSolicitudesPersonasDia,
  formatPersonasDiaChartPeriodTitle,
  getCurrentCalendarMonthRange,
  type SolicitudPersonasDiaSerie,
} from "./aggregateSolicitudesPersonasDia.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./types.ts";

export type SolicitudAnalyticsSlice = { label: string; total: number; porcentaje: number };

export type SolicitudMesVacHo = {
  periodo: string;
  vacaciones: number;
  home_office: number;
};

export type SolicitudRankingRow = { label: string; total: number };

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
  por_mes_creadas: { periodo: string; total: number }[];
  por_mes_vac_ho: SolicitudMesVacHo[];
  areas_top: SolicitudRankingRow[];
  supervisores_pendientes: SolicitudRankingRow[];
  personas_dia: SolicitudPersonasDiaSerie;
  periodo_ausencias_titulo: string;
};

const CATEGORIA_TIPO_LABEL: Record<string, string> = {
  vacaciones: "Vacaciones",
  home_office: "Home office",
  con_goce: "Permisos con goce",
  sin_goce: "Sin goce de sueldo",
};

const ESTADO_LABEL: Record<RhSolicitudEstadoCodigo, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  changes_requested: "Cambios solicitados",
  cancelled: "Cancelada",
  overridden: "Override",
};

function categoriaTipo(tipo: RhSolicitudTipoCodigo): keyof typeof CATEGORIA_TIPO_LABEL {
  if (tipo === "vacaciones") return "vacaciones";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "sin_goce";
  return "con_goce";
}

function mesFromIsoDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
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

export function computeSolicitudesAnalytics(
  rows: readonly RhSolicitudTablaFila[],
  now = new Date(),
): RhSolicitudesAnalyticsData {
  const porTipo = new Map<string, number>();
  const porEstado = new Map<RhSolicitudEstadoCodigo, number>();
  const porMesCreadas = new Map<string, number>();
  const porMesVac = new Map<string, number>();
  const porMesHo = new Map<string, number>();
  const porArea = new Map<string, number>();
  const pendientesPorSupervisor = new Map<string, number>();

  let pendientes = 0;
  let cambios = 0;
  let aprobadas = 0;

  for (const r of rows) {
    const cat = categoriaTipo(r.tipo);
    porTipo.set(cat, (porTipo.get(cat) ?? 0) + 1);

    porEstado.set(r.estado, (porEstado.get(r.estado) ?? 0) + 1);

    if (r.estado === "pending") {
      pendientes += 1;
      const sup = (r.supervisor_nombre || "Sin supervisor").trim();
      pendientesPorSupervisor.set(sup, (pendientesPorSupervisor.get(sup) ?? 0) + 1);
    }
    if (r.estado === "changes_requested") cambios += 1;
    if (r.estado === "approved" || r.estado === "overridden") aprobadas += 1;

    const mes = mesFromIsoDate(r.fecha_solicitud);
    if (mes) {
      porMesCreadas.set(mes, (porMesCreadas.get(mes) ?? 0) + 1);
      if (r.tipo === "vacaciones") porMesVac.set(mes, (porMesVac.get(mes) ?? 0) + 1);
      if (r.tipo === "home_office") porMesHo.set(mes, (porMesHo.get(mes) ?? 0) + 1);
    }

    const area = (r.area || "Sin área").trim();
    porArea.set(area, (porArea.get(area) ?? 0) + 1);
  }

  const mesesVentana = ultimosMeses(6, now);
  const por_mes_creadas = mesesVentana.map((periodo) => ({
    periodo,
    total: porMesCreadas.get(periodo) ?? 0,
  }));
  const por_mes_vac_ho: SolicitudMesVacHo[] = mesesVentana.map((periodo) => ({
    periodo,
    vacaciones: porMesVac.get(periodo) ?? 0,
    home_office: porMesHo.get(periodo) ?? 0,
  }));

  const range = getCurrentCalendarMonthRange(now);

  return {
    kpis: {
      total: rows.length,
      pendientes,
      cambios_solicitados: cambios,
      aprobadas,
      area_top: rankingTop(porArea, 1)[0] ?? null,
    },
    por_tipo: slicesFromCounts(porTipo, (k) => CATEGORIA_TIPO_LABEL[k] ?? k),
    por_estado: slicesFromCounts(
      porEstado as Map<string, number>,
      (k) => ESTADO_LABEL[k as RhSolicitudEstadoCodigo] ?? k,
    ),
    por_mes_creadas,
    por_mes_vac_ho,
    areas_top: rankingTop(porArea, 5),
    supervisores_pendientes: rankingTop(pendientesPorSupervisor, 5),
    personas_dia: aggregateSolicitudesPersonasDia(rows, range.startIso, range.endIso),
    periodo_ausencias_titulo: formatPersonasDiaChartPeriodTitle(now.getFullYear(), now.getMonth()),
  };
}
