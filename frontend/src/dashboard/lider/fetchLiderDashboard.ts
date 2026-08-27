import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { fetchIncidenciasListPage } from "../../api/incidencias.ts";
import { getComedorEquipoReservasMes, type ComedorEquipoReservaApiItem } from "../../api/comedor.ts";
import { getEmpleadosResumen } from "../../api/empleados.ts";
import { getFaltasRetardosEstadisticas } from "../../api/faltasRetardos.ts";
import { fetchDashboardKpis } from "../../api/dashboardKpis.ts";
import { getEmpleadoIdFromAccessToken, getEffectiveGestorNavRol } from "../../auth/jwt.ts";
import { emptyRhIncidenciaListFilters } from "../../incidencias/rh/types.ts";
import { rhIsoLocalDate, rhWeekdayByStart } from "../rh/calendarMonthGrid.ts";
import { emptyLiderDashboardPayload } from "./mock.ts";
import { buildLiderIncidenciasTressChart } from "./buildLiderIncidenciasTressChart.ts";
import { FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO } from "../../faltasRetardos/rh/constants.ts";
import { buildSupervisorHomeOfficeWeekdayChart } from "./buildSupervisorHomeOfficeWeekday.ts";
import {
  esSolicitudTipoCalendarioDashboard,
  SOLICITUD_ESTADO_API,
} from "../empleado/solicitudCalendarioConsts.ts";
import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";
import type { EmpleadoPendingRequestType } from "../empleado/types.ts";
import type {
  LiderApprovalRequestType,
  LiderDashboardPayload,
  TeamCalendarDayEntry,
  TeamCalendarEventKind,
  TeamCalendarLine,
} from "./types.ts";
import { etiquetaTipoComida } from "../../utils/comedorReservaFechas.ts";
import { extraerPrimerNombreApellido } from "../../utils/comedorNombreCorto.ts";

type CalendarMonthFetchTarget = {
  year: number;
  monthIndex: number;
  visibleStartIso?: string;
  visibleEndIso?: string;
  weekStartsOn?: 0 | 1;
};

function eachIsoDayInclusive(fechaInicio: string, fechaFin: string): string[] {
  const a = fechaInicio.slice(0, 10);
  const b = fechaFin.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return [];
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const start = new Date(y1!, m1! - 1, d1!);
  const end = new Date(y2!, m2! - 1, d2!);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) out.push(rhIsoLocalDate(cur));
  return out;
}

/** Colaboradores en la tarjeta «Incidencias por colaborador». */
const INCIDENCIAS_CHART_TOP_N = 10;

/**
 * Ventana de la tarjeta «Incidencias por colaborador»: el último año, móvil.
 * Cambiar a año calendario es mover el inicio al 1 de enero.
 */
function ventanaUltimoAnio(hoy: Date): { inicio: string; fin: string } {
  const inicio = new Date(hoy);
  inicio.setFullYear(inicio.getFullYear() - 1);
  inicio.setDate(inicio.getDate() + 1);
  return { inicio: rhIsoLocalDate(inicio), fin: rhIsoLocalDate(hoy) };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function computeVisibleRange(
  year: number,
  monthIndex: number,
  weekStartsOn: 0 | 1 = 1,
): { startIso: string; endIso: string } {
  const first = new Date(year, monthIndex, 1);
  const startOffset = rhWeekdayByStart(first, weekStartsOn);
  const start = new Date(year, monthIndex, 1 - startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return {
    startIso: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    endIso: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function monthsCoveredByIsoRange(startIso: string, endIso: string): Array<{ year: number; month: number }> {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [];
  const out: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function tipoSolicitudToTeamKind(tipo: RhSolicitudTipoCodigo): TeamCalendarEventKind {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  return "goce_sueldo";
}

function textoCortoTipoSolicitud(tipo: RhSolicitudTipoCodigo): string {
  if (tipo === "vacaciones") return "Vacaciones";
  if (tipo === "home_office") return "Home Office";
  if (tipo === "permiso_sin_goce_sueldo") return "Permiso sin goce";
  if (tipo === "matrimonio") return "Matrimonio (goce)";
  if (tipo === "incapacidad_interna") return "Incap. interna (goce)";
  if (tipo === "defuncion") return "Defunción (goce)";
  if (tipo === "paternidad") return "Paternidad (goce)";
  return "Con goce";
}

function toTeamCalendarLine(
  tipo: RhSolicitudTipoCodigo,
  estado: "approved" | "pending",
  ownerId: string,
  ownerNameRaw: string,
): TeamCalendarLine {
  return {
    kind: tipoSolicitudToTeamKind(tipo),
    text: textoCortoTipoSolicitud(tipo),
    request_status: estado,
    request_tipo: tipo,
    owner_id: ownerId,
    owner_name: ownerNameRaw.trim() || `Empleado ${ownerId}`,
  };
}

function mapSolicitudTipoToApprovalUi(tipo: RhSolicitudTipoCodigo): LiderApprovalRequestType {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  if (tipo === "matrimonio" || tipo === "incapacidad_interna" || tipo === "defuncion" || tipo === "paternidad") {
    return "goce_sueldo";
  }
  return "permiso";
}

function mapTipoPendientePersonal(tipo: RhSolicitudTipoCodigo): EmpleadoPendingRequestType {
  if (tipo === "vacaciones") return "vacation";
  if (tipo === "home_office") return "homeOffice";
  if (tipo === "permiso_sin_goce_sueldo") return "permiso_sin_goce";
  if (tipo === "matrimonio" || tipo === "incapacidad_interna" || tipo === "defuncion" || tipo === "paternidad") {
    return "goce_sueldo";
  }
  return "vacation";
}

function hourLabelFromIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(dt);
}

function mealLineFromReserva(reserva: ComedorEquipoReservaApiItem): TeamCalendarLine {
  const employeeName =
    reserva.empleado_nombre_corto?.trim() || extraerPrimerNombreApellido(reserva.empleado_nombre || "");
  const tipoComida = etiquetaTipoComida(reserva.tipo_comida || "");
  const hour = (
    hourLabelFromIso((reserva as { fecha_registro?: string | null }).fecha_registro) ||
    hourLabelFromIso((reserva as { created_at?: string | null }).created_at)
  ) ?? "Sin hora";
  return {
    kind: "meal",
    text: `Comida ${employeeName} · ${tipoComida}`,
    meal_employee_name: employeeName,
    meal_type_label: tipoComida,
    meal_time_label: hour,
    meal_empleado_id: String(reserva.empleado_id),
  };
}

function capitalizeFirst(raw: string): string {
  if (!raw) return "";
  return `${raw.slice(0, 1).toUpperCase()}${raw.slice(1)}`;
}

function formatApprovalDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };
  if (startIso === endIso) return fmt(startIso);
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

/**
 * Dashboard de supervisor/gerente:
 * construye el calendario de equipo con solicitudes propias+equipo (API scoped por rol).
 */
export async function fetchLiderDashboard(target?: CalendarMonthFetchTarget): Promise<LiderDashboardPayload | null> {
  const role = getEffectiveGestorNavRol();
  if (role !== "supervisor" && role !== "gerente") return null;
  const esGerente = role === "gerente";

  const now = new Date();
  const referenceDate =
    target ? new Date(target.year, target.monthIndex, 1) : now;
  const base = emptyLiderDashboardPayload(referenceDate);
  const myId = getEmpleadoIdFromAccessToken();
  const visibleRange = computeVisibleRange(
    base.team_calendar.initial_year,
    base.team_calendar.initial_month_index,
    target?.weekStartsOn ?? 1,
  );
  const rangeStartIso = target?.visibleStartIso ?? visibleRange.startIso;
  const rangeEndIso = target?.visibleEndIso ?? visibleRange.endIso;

  try {
    // API `/api/v1/solicitudes` admite máximo `limit=100`.
    const mealMonths = monthsCoveredByIsoRange(rangeStartIso, rangeEndIso);
    // Tarjeta «Incidencias activas» (Seguridad y Calidad): solo hace falta el total del
    // listado con el alcance del rol. No paginar filas: en un gerente con cientos de
    // colaboradores eso eran 14+ requests en serie de 10 filas antes de pintar nada.
    const incidenciasPromise = fetchIncidenciasListPage(emptyRhIncidenciaListFilters(), 1, 1)
      .then((p) => p.total)
      .catch(() => 0);
    // Retardos del año en el alcance del líder. Sale del mismo endpoint que alimenta la
    // página Incidencias, así que la tarjeta no puede contradecir a esa pantalla.
    const retardosPromise = getFaltasRetardosEstadisticas({
      tipo: "retardo",
      fecha_inicio: `${now.getFullYear()}-01-01`,
      fecha_fin: rhIsoLocalDate(now),
    })
      .then((e) => e.retardo)
      .catch(() => null);
    // Tarjeta «Incidencias por colaborador»: página Incidencias (`#/faltas-retardos`),
    // no «Seguridad y Calidad». Ventana distinta a la de retardos, así que es otra
    // llamada; el ranking se pide con un lugar de más para que excluir al propio líder
    // no deje la gráfica en nueve.
    const ventana = ventanaUltimoAnio(now);
    const incidenciasEquipoPromise = getFaltasRetardosEstadisticas({
      tipos: FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO,
      fecha_inicio: ventana.inicio,
      fecha_fin: ventana.fin,
      top_empleados: INCIDENCIAS_CHART_TOP_N + 1,
    }).catch(() => null);
    const [
      rows,
      mealRowsByMonth,
      empleadosResumen,
      kpis,
      incidenciasTotal,
      teamRetardos,
      incidenciasEquipo,
    ] = await Promise.all([
        getSolicitudesRows(100),
        role === "supervisor"
          ? Promise.all(mealMonths.map(({ year, month }) => getComedorEquipoReservasMes(year, month)))
          : Promise.resolve([]),
        getEmpleadosResumen().catch(() => null),
        fetchDashboardKpis(),
        incidenciasPromise,
        retardosPromise,
        incidenciasEquipoPromise,
      ]);
    const todayIso = rhIsoLocalDate(now);

    const solicitudesGestion = rows.filter(
      (r) =>
        esSolicitudTipoCalendarioDashboard(r.tipo) &&
        (r.estado === SOLICITUD_ESTADO_API.APROBADO || r.estado === SOLICITUD_ESTADO_API.PENDIENTE),
    );

    const solicitudesCalendario = esGerente
      ? []
      : solicitudesGestion.filter(
          (r) =>
            !(r.fecha_fin.slice(0, 10) < rangeStartIso || r.fecha_inicio.slice(0, 10) > rangeEndIso),
        );

    const day_entries: Record<string, TeamCalendarDayEntry> = {};
    if (!esGerente) {
      for (const r of solicitudesCalendario) {
        const estado = r.estado === SOLICITUD_ESTADO_API.APROBADO ? "approved" : "pending";
        const line = toTeamCalendarLine(r.tipo, estado, r.empleado_id, r.empleado_nombre_raw);
        for (const iso of eachIsoDayInclusive(r.fecha_inicio, r.fecha_fin)) {
          if (iso < rangeStartIso || iso > rangeEndIso) continue;
          const prev = day_entries[iso]?.lines ?? [];
          day_entries[iso] = { lines: [...prev, line] };
        }
      }
    }

    if (role === "supervisor") {
      const mealRows = mealRowsByMonth.flat();
      for (const reserva of mealRows) {
        const iso = reserva.fecha_servicio?.slice(0, 10);
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < rangeStartIso || iso > rangeEndIso) continue;
        const prev = day_entries[iso]?.lines ?? [];
        day_entries[iso] = { lines: [...prev, mealLineFromReserva(reserva)] };
      }
    }

    const ownRows = myId ? solicitudesGestion.filter((r) => r.empleado_id === myId) : [];
    const teamRows = myId ? solicitudesGestion.filter((r) => r.empleado_id !== myId) : solicitudesGestion;
    const teamPendingRows = teamRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE);
    /** `colaboradores_total` del resumen = activos en alcance del rol (incluye al líder); la tarjeta cuenta solo colaboradores. */
    const fallbackTeamCount = new Set(teamRows.map((r) => r.empleado_id)).size;
    const teamCollaboratorsCount =
      empleadosResumen != null
        ? Math.max(0, (empleadosResumen.colaboradores_total ?? 0) - 1)
        : fallbackTeamCount;
    const teamActiveIncidents = incidenciasTotal;
    const esLiderConGraficas = role === "supervisor" || esGerente;
    const supervisorIncidenciasChart =
      esLiderConGraficas && incidenciasEquipo
        ? buildLiderIncidenciasTressChart(incidenciasEquipo.empleados_con_mas_eventos ?? [], {
            excludeEmpleadoId: myId,
            totalEventos: incidenciasEquipo.total_eventos ?? 0,
            totalColaboradores: incidenciasEquipo.total_colaboradores_con_eventos ?? 0,
            maxEmployees: INCIDENCIAS_CHART_TOP_N,
            forceView: "bars",
          })
        : null;
    const hoTeamRows = teamRows.filter(
      (r) => r.tipo === "home_office" && r.estado === SOLICITUD_ESTADO_API.APROBADO,
    );
    const supervisorHoWeekdayChart = esLiderConGraficas
      ? buildSupervisorHomeOfficeWeekdayChart(hoTeamRows)
      : null;
    const approvalRequests = teamPendingRows
      .map((r) => {
        const tipo = mapSolicitudTipoToApprovalUi(r.tipo);
        const name = r.empleado_nombre_raw.trim() || `Empleado ${r.empleado_id}`;
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0] ?? "")
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return {
          id: String(r.id),
          collaborator_name: name,
          collaborator_initials: initials || null,
          request_type: tipo,
          date_range: formatApprovalDateRange(r.fecha_inicio, r.fecha_fin),
          detail: (r.comentarios ?? "").trim() || `${capitalizeFirst(r.tipo.replace("_", " "))} pendiente`,
          status: "Pendiente",
        } satisfies LiderDashboardPayload["approval_requests"][number];
      })
      .sort((a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10));

    let initialYear = now.getFullYear();
    let initialMonth = now.getMonth();
    if (!esGerente) {
      const initial = solicitudesCalendario
        .map((r) => r.fecha_inicio.slice(0, 10))
        .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
        .sort()[0] ?? null;
      const initDate = initial ? new Date(`${initial}T00:00:00`) : now;
      if (!Number.isNaN(initDate.getTime())) {
        initialYear = initDate.getFullYear();
        initialMonth = initDate.getMonth();
      }
    }

    return {
      ...base,
      personal: {
        ...base.personal,
        // Los tres KPIs personales salen de las cachés de nómina en Bono, igual que en el
        // dashboard del empleado: misma fuente y misma definición para los tres roles.
        vacation_available_days: kpis?.vacaciones_disponibles ?? null,
        retardos_anio: kpis?.retardos_anio ?? null,
        pending_requests: ownRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE).length,
        pending_request_types: Array.from(
          new Set(
            ownRows.filter((r) => r.estado === SOLICITUD_ESTADO_API.PENDIENTE).map((r) => mapTipoPendientePersonal(r.tipo)),
          ),
        ),
      },
      team: {
        ...base.team,
        team_active_incidents: teamActiveIncidents,
        team_pending_vacation_requests: teamRows.filter(
          (r) => r.tipo === "vacaciones" && r.estado === SOLICITUD_ESTADO_API.PENDIENTE,
        ).length,
        team_retardos_anio: teamRetardos,
        team_collaborators_count: teamCollaboratorsCount,
      },
      approval_requests: approvalRequests,
      supervisor_incidencias_chart: supervisorIncidenciasChart,
      supervisor_ho_weekday_chart: supervisorHoWeekdayChart,
      team_calendar: {
        ...base.team_calendar,
        initial_year: initialYear,
        initial_month_index: initialMonth,
        day_entries,
        selected_iso_date: todayIso,
      },
    };
  } catch {
    return null;
  }
}
