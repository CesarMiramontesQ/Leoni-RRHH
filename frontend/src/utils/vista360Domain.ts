import type { UsuarioListItem } from "../api/usuarios.ts";
import type { ActaBrief, SolicitudBrief, UsuarioVista360, UsuarioVista360Usuario } from "../api/vista360.ts";

export type TimelineItem = {
  title: string;
  subtitle: string;
  atIso: string;
};

export function usuarioToListItem(u: UsuarioVista360Usuario): UsuarioListItem {
  return {
    ...u,
    lider_nombre: null,
  };
}

export function buildTimelineItems(data: UsuarioVista360): TimelineItem[] {
  const raw: { t: number; title: string; subtitle: string; atIso: string }[] = [];

  for (const s of data.solicitudes_recientes) {
    raw.push({
      t: Date.parse(s.created_at),
      title: `Solicitud: ${s.tipo}`,
      subtitle: `Estado: ${s.estado}`,
      atIso: s.created_at,
    });
  }
  for (const i of data.incidencias_activas) {
    const estatusTxt = i.estatus_id === null ? "Sin estatus" : `Estatus ${i.estatus_id}`;
    raw.push({
      t: Date.parse(i.created_at),
      title: `Incidencia: ${i.tipo}`,
      subtitle: estatusTxt,
      atIso: i.created_at,
    });
  }
  for (const a of data.actas_firmadas) {
    raw.push({
      t: Date.parse(a.created_at),
      title: "Acta administrativa firmada",
      subtitle: `Estado: ${a.estado}`,
      atIso: a.created_at,
    });
  }

  raw.sort((a, b) => b.t - a.t);
  return raw.map(({ title, subtitle, atIso }) => ({ title, subtitle, atIso }));
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
