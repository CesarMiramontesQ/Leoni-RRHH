/**
 * Constantes y estilos del calendario personal (rol `empleado`): solicitudes desde API.
 * Estados canónicos alineados con `app/schemas/solicitudes.py` y `RhSolicitudEstadoCodigo`.
 */
import type { RhSolicitudTipoCodigo } from "../../solicitudes/rh/types.ts";
import type { SolicitudEstadoCalendarioEmpleado } from "./types.ts";

/** Rol JWT / sesión para el dashboard colaborador. */
export const ROL_EMPLEADO = "empleado" as const;
export const ROL_SUPERVISOR = "supervisor" as const;
export const ROL_GERENTE = "gerente" as const;

/** Tipos de solicitud que deben aparecer en calendarios de dashboards (Vac, HO, sin goce, con goce). */
export const SOLICITUD_TIPOS_DASHBOARD_CALENDARIO = [
  "vacaciones",
  "home_office",
  "permiso_sin_goce_sueldo",
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
] as const satisfies readonly RhSolicitudTipoCodigo[];

const _SET_SOLICITUD_TIPOS_DASHBOARD = new Set<string>(SOLICITUD_TIPOS_DASHBOARD_CALENDARIO);

export function esSolicitudTipoCalendarioDashboard(tipo: string): tipo is RhSolicitudTipoCodigo {
  return _SET_SOLICITUD_TIPOS_DASHBOARD.has(tipo);
}

/** Valores `estado` en API usados en el calendario del empleado. */
export const SOLICITUD_ESTADO_API = {
  APROBADO: "approved",
  PENDIENTE: "pending",
} as const satisfies Record<string, SolicitudEstadoCalendarioEmpleado>;

export type EmpleadoSolicitudCalendarioBadge = {
  text: string;
  badgeCls: string;
  dotClass: string;
  dotTitle: string;
};

export type CalendarRole = typeof ROL_EMPLEADO | typeof ROL_SUPERVISOR | typeof ROL_GERENTE;

export type CalendarBadgeInput = {
  userRole: string | null | undefined;
  currentUserId: string | null | undefined;
  ownerId: string | null | undefined;
  ownerName: string | null | undefined;
  estado: SolicitudEstadoCalendarioEmpleado;
  tipo: RhSolicitudTipoCodigo;
};

function typeLabel(tipo: RhSolicitudTipoCodigo): string {
  if (tipo === "vacaciones") return "Vacaciones";
  if (tipo === "home_office") return "Home Office";
  if (tipo === "matrimonio") return "Matrimonio";
  if (tipo === "incapacidad_interna") return "Incapacidad interna";
  if (tipo === "defuncion") return "Defunción";
  if (tipo === "permiso_sin_goce_sueldo") return "Permiso sin goce";
  return "Paternidad";
}

function roleWantsOwner(role: string | null | undefined): role is typeof ROL_SUPERVISOR | typeof ROL_GERENTE {
  return role === ROL_SUPERVISOR || role === ROL_GERENTE;
}

/**
 * Convierte "Apellido1 Apellido2, Nombre1 Nombre2" -> "Nombre1 Apellido1".
 * Fallback robusto para nombres sin coma o con segmentos incompletos.
 */
function formatCalendarOwnerName(raw: string | null | undefined): string {
  const input = (raw || "").trim();
  if (!input) return "";

  const [lhs, rhs] = input.split(",", 2).map((s) => s?.trim() ?? "");
  if (lhs && rhs) {
    const apellido = lhs.split(/\s+/).filter(Boolean)[0] ?? "";
    const nombre = rhs.split(/\s+/).filter(Boolean)[0] ?? "";
    const simple = `${nombre} ${apellido}`.trim();
    if (simple) return simple;
  }

  const parts = input.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? "";
}

export function getCalendarRequestBadge(input: CalendarBadgeInput): EmpleadoSolicitudCalendarioBadge {
  const { userRole, currentUserId, ownerId, ownerName, estado, tipo } = input;
  const baseLabel = typeLabel(tipo);
  const isSelf = Boolean(currentUserId && ownerId && currentUserId === ownerId);
  const ownerSimple = formatCalendarOwnerName(ownerName);
  const includeOwner = roleWantsOwner(userRole) && !isSelf && Boolean(ownerSimple);
  const text = includeOwner ? `${baseLabel} ${ownerSimple}` : baseLabel;
  const isAprobado = estado === SOLICITUD_ESTADO_API.APROBADO;
  const isPendiente = estado === SOLICITUD_ESTADO_API.PENDIENTE;

  if (isAprobado) {
    return {
      text,
      badgeCls:
        "rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-emerald-800 md:text-[11px]",
      dotClass: "bg-emerald-600",
      dotTitle: `${text} (aprobada)`,
    };
  }

  if (isPendiente) {
    return {
      text,
      badgeCls:
        "rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-amber-950 md:text-[11px]",
      dotClass: "bg-amber-500",
      dotTitle: `${text} (pendiente)`,
    };
  }

  return {
    text,
    badgeCls:
      "rounded-md bg-border px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-text-muted md:text-[11px]",
    dotClass: "bg-gray-400",
    dotTitle: text,
  };
}

/**
 * Etiqueta y colores para una solicitud en el calendario del empleado.
 * Solo debe usarse cuando `userRole === ROL_EMPLEADO` (el payload ya se construye así).
 */
export function getEmpleadoSolicitudCalendarBadge(
  userRole: string | null | undefined,
  estado: SolicitudEstadoCalendarioEmpleado,
  tipo: RhSolicitudTipoCodigo,
): EmpleadoSolicitudCalendarioBadge {
  return getCalendarRequestBadge({
    userRole,
    currentUserId: null,
    ownerId: null,
    ownerName: null,
    estado,
    tipo,
  });
}
