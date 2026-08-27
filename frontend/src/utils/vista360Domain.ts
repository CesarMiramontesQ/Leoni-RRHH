import type { UsuarioListItem } from "../api/usuarios.ts";
import type { ActaBrief, SolicitudBrief, UsuarioVista360Usuario } from "../api/vista360.ts";

export function usuarioToListItem(u: UsuarioVista360Usuario): UsuarioListItem {
  return {
    ...u,
    lider_nombre: null,
  };
}

const fmtDate = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const fmtDateTime = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** ISO fecha (registro / antigüedad). */
export function formatFechaIngreso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtDate.format(d);
}

export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDateTime.format(d);
}

/** Antigüedad en años y meses completos desde fecha de registro hasta hoy. */
export function antiguedadAniosMeses(fechaIngresoIso: string | null): { years: number; months: number } | null {
  if (!fechaIngresoIso) return null;
  const start = new Date(fechaIngresoIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function formatSolicitudLine(s: SolicitudBrief): string {
  return `${s.tipo} · ${s.estado} · ${formatFechaHora(s.created_at)}`;
}

export function formatActaLine(a: ActaBrief): string {
  return `Acta #${a.id} · ${a.estado} · ${formatFechaHora(a.created_at)}`;
}
