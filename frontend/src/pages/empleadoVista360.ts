import { getEmpleadoVista360, type UsuarioVista360 } from "../api/vista360.ts";
import type { EstadoEmpleadoResponse } from "../api/usuarios.ts";
import { isUsuariosFetchError } from "../api/usuarios.ts";
import { canAccessEmpleadosPage, canAccessUsuariosAdmin } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountEditarAsignacionModal } from "../components/empleados/editarAsignacionModal.ts";
import type { EditarAsignacionModalHandle } from "../components/empleados/editarAsignacionModal.ts";
import { vista360CardHtml, vista360FieldRowHtml, vista360FieldRowText } from "../components/vista360/card.ts";
import { escapeHtml } from "../components/vista360/html.ts";
import { vista360CompetenciasCardHtml } from "../components/vista360/progressBar.ts";
import { vista360ProfileHeaderHtml } from "../components/vista360/profileHeader.ts";
import { vista360TabButtonClass, vista360TabsHtml, type Vista360TabId } from "../components/vista360/tabs.ts";

const VISTA360_TAB_IDS: Vista360TabId[] = ["resumen", "incidencias", "historial", "beneficios"];

/** Lee `?tab=` del hash `#/empleados/{id}?tab=historial`. */
export function parseVista360InitialTabFromHash(hash: string): Vista360TabId {
  const q = hash.indexOf("?");
  if (q < 0) return "resumen";
  const params = new URLSearchParams(hash.slice(q + 1));
  const t = params.get("tab");
  if (t && (VISTA360_TAB_IDS as readonly string[]).includes(t)) return t as Vista360TabId;
  return "resumen";
}
import { vista360TimelineHtml } from "../components/vista360/timeline.ts";
import { loadEmpleadoVista360 } from "../hooks/useVista360.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";
import {
  antiguedadAniosMeses,
  buildTimelineItems,
  formatActaLine,
  formatFechaHora,
  formatFechaIngreso,
  formatSolicitudLine,
  usuarioToListItem,
} from "../utils/vista360Domain.ts";

const iconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const iconBriefcase = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.184 2.675-.394.633-1.086 1.185-2.066 1.185H7c-.98 0-1.672-.552-2.066-1.185-.397-.639-1.184-1.581-1.184-2.675v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.182-2.649a2.18 2.18 0 0 0-.908-.91 2.18 2.18 0 0 0-1.661-.75H7.5a2.18 2.18 0 0 0-1.661.75 2.18 2.18 0 0 0-.908.91C4.517 5.691 3.75 6.625 3.75 7.706v3.784a2.18 2.18 0 0 0 .75 1.661m16.5 0A2.25 2.25 0 0 1 18 16.5h-12a2.25 2.25 0 0 1-2.25-2.25V8.25A2.25 2.25 0 0 1 6 6h12a2.25 2.25 0 0 1 2.25 2.25v5.25Z" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const iconId = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm3.75 6.75h-9v-.75a3.375 3.375 0 0 1 3.375-3.375h2.25a3.375 3.375 0 0 1 3.375 3.375v.75Z" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const iconCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "Se requiere rol RH, gerente, director o supervisor para ver el directorio.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

function skeletonHtml(): string {
  return `
    <div class="animate-pulse space-y-6" aria-busy="true">
      <div class="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div class="size-28 shrink-0 rounded-2xl bg-slate-200"></div>
            <div class="flex-1 space-y-3">
              <div class="h-9 w-52 max-w-full rounded-lg bg-slate-200"></div>
              <div class="h-4 w-full max-w-sm rounded bg-slate-100"></div>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="h-10 w-24 rounded-lg bg-slate-100"></div>
            <div class="h-10 w-36 rounded-lg bg-slate-200"></div>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-8 gap-y-1 border-b border-slate-200/70">
        ${Array.from({ length: 4 }, () => '<div class="h-11 w-24 rounded bg-slate-100"></div>').join("")}
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        ${Array.from({ length: 4 }, () => '<div class="min-h-40 rounded-2xl bg-slate-100"></div>').join("")}
      </div>
      <div class="flex flex-wrap gap-4">
        <div class="h-9 w-36 rounded-md bg-slate-100"></div>
        <div class="h-9 w-32 rounded-md bg-slate-100"></div>
        <div class="h-9 w-40 rounded-md bg-slate-100"></div>
      </div>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div class="h-56 rounded-2xl bg-slate-100 lg:col-span-7"></div>
        <div class="h-56 rounded-2xl bg-slate-100 lg:col-span-5"></div>
      </div>
    </div>`;
}

function esEstadoVisualActivo(estado: EstadoEmpleadoResponse | null): boolean {
  if (!estado?.descripcion) return false;
  const d = estado.descripcion.trim().toLowerCase();
  if (d.includes("inactiv")) return false;
  return d.includes("activ");
}

function antiguedadFechaIngresoRow(fechaIngreso: string | null): string {
  if (!fechaIngreso?.trim()) return vista360FieldRowText("Fecha de ingreso", null);
  const s = formatFechaIngreso(fechaIngreso);
  if (!s || s === "—") return vista360FieldRowText("Fecha de ingreso", null);
  return vista360FieldRowText("Fecha de ingreso", s);
}

function antiguedadBodyHtml(fechaIngreso: string | null): string {
  const parts = antiguedadAniosMeses(fechaIngreso);
  const tiempoInner =
    parts === null
      ? `<span class="font-semibold text-text-muted">No disponible</span>`
      : `<span class="font-semibold text-leoni-blue">${parts.years}</span> años <span class="font-semibold text-leoni-blue">${parts.months}</span> meses`;
  const evaluacionBlock = `
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500/90">Próxima evaluación</p>
      <div class="mt-1.5 flex items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2">
        <span class="size-2 shrink-0 rounded-full bg-amber-500 shadow-sm ring-2 ring-amber-200/90" aria-hidden="true"></span>
        <p class="text-sm font-semibold text-amber-950">No registrada en el sistema</p>
      </div>
    </div>`;
  return antiguedadFechaIngresoRow(fechaIngreso) + vista360FieldRowHtml("Tiempo en empresa", tiempoInner) + evaluacionBlock;
}

function listSectionHtml(title: string, items: string[]): string {
  if (items.length === 0) {
    return `
      <div class="rounded-lg border border-dashed border-border py-8 text-center">
        <p class="text-sm text-text-muted">${escapeHtml(title)}: sin registros.</p>
      </div>`;
  }
  const lis = items.map((line) => `<li class="border-b border-slate-100 py-3 text-sm text-text-primary last:border-0">${escapeHtml(line)}</li>`).join("");
  return `
    <div>
      <h4 class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(title)}</h4>
      <ul class="mt-2 list-none p-0 m-0">${lis}</ul>
    </div>`;
}

function renderVista360Content(data: UsuarioVista360, activeTab: Vista360TabId): string {
  const u = data.usuario;
  const showRh = canAccessUsuariosAdmin();

  const metaRaw = [u.puesto?.descripcion, u.area?.descripcion, u.subarea?.descripcion]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));
  const metaPartes = [...new Set(metaRaw)];

  const header = vista360ProfileHeaderHtml({
    nombre: u.nombre,
    apellido: "",
    numEmpleado: u.no_empleado,
    metaPartes,
    activo: esEstadoVisualActivo(u.estado),
    showEditar: showRh,
  });

  const quickActions = `
    <div class="rounded-2xl border border-border/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500/90">Acciones rápidas</p>
      <div class="flex flex-wrap gap-2.5">
      <button type="button" disabled title="Próximamente" class="inline-flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500 opacity-80 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:w-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" /></svg>
        Generar documento</button>
      <button type="button" disabled title="Próximamente" class="inline-flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500 opacity-80 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:w-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clip-rule="evenodd" /></svg>
        Solicitar gafete</button>
      <button type="button" disabled title="Próximamente" class="inline-flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500 opacity-80 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:w-auto">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-12a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.828 2.829a1 1 0 1 0 1.415-1.415L11 9.586V6Z" clip-rule="evenodd" /></svg>
        Registro asistencia</button>
      </div>
    </div>`;

  const cardPersonales = vista360CardHtml({
    title: "Personales",
    iconSvg: iconUser,
    iconTone: "blue",
    bodyHtml:
      vista360FieldRowText("Fecha de nacimiento", null) +
      vista360FieldRowText("CURP", null) +
      vista360FieldRowText("NSS", null),
  });

  const cardLaborales = vista360CardHtml({
    title: "Laborales",
    iconSvg: iconBriefcase,
    iconTone: "emerald",
    bodyHtml:
      vista360FieldRowText("Área", u.area?.descripcion ?? null) +
      vista360FieldRowText("Horario", null) +
      vista360FieldRowText("Centro de costos", null),
  });

  const cardContacto = vista360CardHtml({
    title: "Contacto",
    iconSvg: iconId,
    iconTone: "indigo",
    bodyHtml:
      vista360FieldRowText("Email", u.email) +
      vista360FieldRowText("Teléfono", null) +
      vista360FieldRowText("Emergencia", null),
  });

  const cardAntiguedad = vista360CardHtml({
    title: "Antigüedad",
    iconSvg: iconCalendar,
    iconTone: "sky",
    bodyHtml: antiguedadBodyHtml(u.registro),
  });

  const grid = `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${cardPersonales}${cardLaborales}${cardContacto}${cardAntiguedad}
    </div>`;

  const tabs = vista360TabsHtml(activeTab);

  const timelineItems = buildTimelineItems(data);
  const timeline = vista360TimelineHtml(timelineItems);

  const competencias = `
    <aside class="rounded-2xl border border-border/80 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm ring-1 ring-slate-900/5">
      <h3 class="text-sm font-semibold text-text-primary">Competencias</h3>
      <div class="mt-4">${vista360CompetenciasCardHtml([])}</div>
      <button type="button" disabled title="Próximamente"
        class="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 opacity-80 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed">
        Ver evaluación completa</button>
    </aside>`;

  const panel = (id: Vista360TabId, inner: string): string => {
    const hidden = id !== activeTab;
    return `
      <div
        id="v360-panel-${id}"
        role="tabpanel"
        aria-labelledby="v360-tab-${id}"
        data-v360-panel="${id}"
        class="pt-8 ${hidden ? "hidden" : ""}"
        ${hidden ? "hidden" : ""}
      >${inner}</div>`;
  };

  const resumenInner = `
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section class="rounded-2xl border border-border/80 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm ring-1 ring-slate-900/5 lg:col-span-7">
        <h3 class="text-sm font-semibold text-text-primary">Últimas actividades</h3>
        <div class="mt-4">${timeline}</div>
      </section>
      <div class="lg:col-span-5">${competencias}</div>
    </div>`;

  const incidenciasInner =
    data.incidencias_activas.length === 0
      ? `<div class="rounded-2xl border border-dashed border-border/90 bg-slate-50/40 py-12 text-center text-sm font-semibold text-text-primary">No hay incidencias activas.</div>`
      : `<ul class="m-0 list-none divide-y divide-slate-100 overflow-hidden rounded-2xl border border-border/80 bg-white p-0 shadow-sm">${data.incidencias_activas
          .map(
            (i) => `
        <li class="px-5 py-4">
          <p class="font-semibold text-text-primary">${escapeHtml(i.tipo)}</p>
          <p class="mt-0.5 text-sm text-text-muted">Estado: ${escapeHtml(i.estado)} · ${escapeHtml(formatFechaHora(i.created_at))}</p>
        </li>`,
          )
          .join("")}</ul>`;

  const historialInner = `
    <div class="rounded-2xl border border-border/80 bg-white p-5 shadow-sm sm:p-6">
      <div class="space-y-8">
        ${listSectionHtml(
          "Solicitudes recientes",
          data.solicitudes_recientes.map(formatSolicitudLine),
        )}
        ${listSectionHtml(
          "Actas firmadas",
          data.actas_firmadas.map(formatActaLine),
        )}
      </div>
    </div>`;

  const beneficiosInner = `
    <div class="max-w-md rounded-2xl border border-border/80 bg-white p-6 shadow-sm">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500/90">Saldo de vacaciones</p>
      <p class="mt-2 text-3xl font-bold tabular-nums text-leoni-blue">${escapeHtml(String(data.saldo_vacaciones))}</p>
      <p class="mt-2 text-sm text-text-muted">Días (según registro en sistema; integración TRESS pendiente).</p>
    </div>`;

  const panels =
    panel("resumen", resumenInner) +
    panel("incidencias", incidenciasInner) +
    panel("historial", historialInner) +
    panel("beneficios", beneficiosInner);

  return `
    <div id="v360-loaded" class="space-y-6">
      <div>
        <a href="#/empleados" class="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-semibold text-slate-500 transition-colors hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 opacity-80" aria-hidden="true"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>
          Volver al directorio
        </a>
      </div>
      ${header}
      ${tabs}
      ${grid}
      ${quickActions}
      <div id="v360-panels-wrap">${panels}</div>
    </div>`;
}

function bindVista360TabDelegation(v360Root: HTMLElement, getContent: () => HTMLElement | null, signal: AbortSignal): void {
  v360Root.addEventListener(
    "click",
    (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-v360-tab]");
      const contentEl = getContent();
      if (!btn || !contentEl || !contentEl.contains(btn)) return;
      const tab = btn.getAttribute("data-v360-tab") as Vista360TabId | null;
      if (!tab) return;

      contentEl.querySelectorAll<HTMLButtonElement>("[data-v360-tab]").forEach((b) => {
        const id = b.getAttribute("data-v360-tab") as Vista360TabId;
        const on = id === tab;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.className = vista360TabButtonClass(on);
      });

      contentEl.querySelectorAll<HTMLElement>("[data-v360-panel]").forEach((p) => {
        const id = p.getAttribute("data-v360-panel") as Vista360TabId;
        const show = id === tab;
        p.classList.toggle("hidden", !show);
        if (show) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
    },
    { signal },
  );
}

export function mountEmployeeVista360(
  container: HTMLElement,
  empleadoId: number,
  signal: AbortSignal,
  opts?: { initialTab?: Vista360TabId },
): void {
  const initialTab: Vista360TabId = opts?.initialTab ?? "resumen";
  if (!canAccessEmpleadosPage()) {
    mountAppShell(container, {
      pageTitle: "Vista 360",
      activeNav: "empleados",
      mainHtml: `<div class="space-y-4">${forbiddenHtml()}</div>`,
    });
    return;
  }

  const isRh = canAccessUsuariosAdmin();

  mountAppShell(container, {
    pageTitle: "Vista 360",
    activeNav: "empleados",
    mainHtml: `
      <div id="v360-root" class="space-y-6">
        <div id="v360-content">${skeletonHtml()}</div>
      </div>
      ${isRh ? `<div id="v360-edit-modal-host"></div>` : ""}`,
  });

  const contentEl = container.querySelector("#v360-content") as HTMLElement | null;
  const v360Root = container.querySelector("#v360-root") as HTMLElement | null;
  const modalHost = container.querySelector("#v360-edit-modal-host") as HTMLElement | null;

  let editModal: EditarAsignacionModalHandle | null = null;
  if (isRh && modalHost && v360Root) {
    editModal = mountEditarAsignacionModal(modalHost, {
      onSuccess: async () => {
        if (!contentEl) return;
        contentEl.innerHTML = skeletonHtml();
        const r = await loadEmpleadoVista360(empleadoId, signal);
        if (!r.ok && r.aborted) return;
        if (r.ok) {
          contentEl.innerHTML = renderVista360Content(r.data, initialTab);
        } else {
          contentEl.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">${escapeHtml(r.message)}</div>`;
        }
      },
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      toastContainer: v360Root,
      signal,
    });
  }

  async function load(): Promise<void> {
    if (!contentEl) return;
    contentEl.innerHTML = skeletonHtml();
    const r = await loadEmpleadoVista360(empleadoId, signal);
    if (!r.ok && r.aborted) return;
    if (!contentEl) return;
    if (r.ok) {
      contentEl.innerHTML = renderVista360Content(r.data, initialTab);
      return;
    }
    if (r.status === 401) {
      clearAuth();
      void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
        abortAuthenticatedShell();
        void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
      });
      return;
    }
    contentEl.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">${escapeHtml(r.message)}</div>`;
  }

  if (v360Root && contentEl) {
    bindVista360TabDelegation(v360Root, () => container.querySelector("#v360-content"), signal);
  }

  container.addEventListener(
    "click",
    (e) => {
      const t = (e.target as HTMLElement).closest("[data-v360-action]");
      if (!t || !container.contains(t)) return;
      const action = t.getAttribute("data-v360-action");
      if (action === "editar" && editModal && contentEl) {
        const loaded = contentEl.querySelector("#v360-loaded");
        if (!loaded) return;
        void (async () => {
          try {
            const data = await getEmpleadoVista360(empleadoId, { signal });
            void editModal?.open(usuarioToListItem(data.usuario));
          } catch (err: unknown) {
            if (isUsuariosFetchError(err) && err.status === 401) {
              clearAuth();
              void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
                abortAuthenticatedShell();
                void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
              });
              return;
            }
            const msg = isUsuariosFetchError(err) ? err.detail : "No se pudo cargar el empleado.";
            if (v360Root) {
              const { showEmpleadosToast } = await import("../components/empleados/toast.ts");
              showEmpleadosToast(v360Root, msg, "error");
            }
          }
        })();
      }
    },
    { signal },
  );

  void load();
}
