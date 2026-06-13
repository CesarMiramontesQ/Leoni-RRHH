import type {
  HorasExtraFirma,
  HorasExtraFirmaEstado,
  HorasExtraHistorialEvento,
  HorasExtraTipoFirma,
} from "../../api/horasExtraAprobacion.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgeRejected,
} from "../../ui/uiTokens.ts";
import { escapeHtml, fmtDateTimeIso } from "../../ui/uiUtils.ts";

const DETALLE_SECTION_CARD =
  "rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5";

const APROBACION_CARD =
  "flex min-h-[8.5rem] flex-col rounded-lg border border-slate-200/80 bg-slate-50/50 px-3.5 py-3";

type RolAprobacionConfig = {
  tipoFirma: HorasExtraTipoFirma;
  titulo: string;
};

const ROLES_APROBACION: RolAprobacionConfig[] = [
  { tipoFirma: "gerente_regional", titulo: "Gerente Regional" },
  { tipoFirma: "director_planta", titulo: "Director" },
];

function firmaPorTipo(
  firmas: HorasExtraFirma[],
  tipoFirma: HorasExtraTipoFirma,
): HorasExtraFirma | undefined {
  return firmas.find((f) => f.tipo_firma === tipoFirma);
}

function estadoBadge(estado: HorasExtraFirmaEstado): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  return badgeCancelled("Pendiente");
}

function estadoIcon(estado: HorasExtraFirmaEstado): string {
  if (estado === "aprobado") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5 text-emerald-500" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>`;
  }
  if (estado === "rechazado") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5 text-red-500" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5 text-slate-400" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>`;
}

function renderAprobacionCard(config: RolAprobacionConfig, firmas: HorasExtraFirma[]): string {
  const firma = firmaPorTipo(firmas, config.tipoFirma);
  const estado = firma?.estado ?? "pendiente";
  const nombre = firma?.aprobador_nombre?.trim();
  const pendiente = estado === "pendiente" || !nombre;
  const comentarioRechazo =
    estado === "rechazado" && firma?.comentario?.trim() ? firma.comentario.trim() : null;

  const cuerpo = pendiente
    ? `<p class="mt-2 text-sm font-medium text-slate-500">Pendiente de aprobación</p>`
    : `
      <p class="mt-2 text-sm font-semibold text-[#0A1628]">${escapeHtml(nombre!)}</p>
      <div class="mt-2 flex items-center gap-2">
        ${estadoIcon(estado)}
        ${estadoBadge(estado)}
      </div>
      ${
        firma?.fecha_aprobacion
          ? `<p class="mt-2 text-xs font-medium tabular-nums text-slate-600">${escapeHtml(fmtDateTimeIso(firma.fecha_aprobacion))}</p>`
          : ""
      }`;

  const comentarioHtml = comentarioRechazo
    ? `<p class="mt-2 rounded-md border border-red-100 bg-red-50/80 px-2.5 py-2 text-xs leading-relaxed text-red-800">
        <span class="font-semibold">Motivo:</span> ${escapeHtml(comentarioRechazo)}
      </p>`
    : "";

  return `
    <article class="${APROBACION_CARD}">
      <h4 class="text-sm font-semibold text-[#0A1628]">${escapeHtml(config.titulo)}</h4>
      ${cuerpo}
      ${comentarioHtml}
    </article>`;
}

export function renderHorasExtraAprobacionesSection(firmas: HorasExtraFirma[]): string {
  const cards = ROLES_APROBACION.map((rol) => renderAprobacionCard(rol, firmas)).join("");

  return `
    <section class="${DETALLE_SECTION_CARD}">
      <h3 class="text-sm font-semibold text-[#0A1628]">Aprobaciones</h3>
      <p class="mt-0.5 text-xs text-text-secondary">Estado de firma por rol requerido.</p>
      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">${cards}</div>
    </section>`;
}

function fmtHistorialFecha(value: string): string {
  return fmtDateTimeIso(value);
}

export function renderHorasExtraHistorialSection(eventos: HorasExtraHistorialEvento[]): string {
  if (eventos.length === 0) {
    return `
      <section class="${DETALLE_SECTION_CARD}">
        <h3 class="text-sm font-semibold text-[#0A1628]">Historial</h3>
        <p class="mt-3 text-sm text-slate-500">Sin eventos registrados.</p>
      </section>`;
  }

  const rows = eventos
    .map(
      (ev) => `
      <tr class="border-t border-slate-100">
        <td class="px-3 py-2 text-slate-800">${escapeHtml(ev.usuario_nombre)}</td>
        <td class="px-3 py-2 text-slate-600">${escapeHtml(ev.rol ?? "—")}</td>
        <td class="px-3 py-2 text-slate-700">${escapeHtml(ev.accion)}</td>
        <td class="px-3 py-2 text-slate-600">${escapeHtml(ev.comentario ?? "—")}</td>
        <td class="px-3 py-2 text-slate-600">${escapeHtml(fmtHistorialFecha(ev.fecha_hora))}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="${DETALLE_SECTION_CARD}">
      <h3 class="text-sm font-semibold text-[#0A1628]">Historial</h3>
      <div class="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="sticky top-0 bg-slate-50">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="px-3 py-2">Usuario</th>
              <th class="px-3 py-2">Rol</th>
              <th class="px-3 py-2">Acción</th>
              <th class="px-3 py-2">Comentario</th>
              <th class="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}
