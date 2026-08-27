import { loadVista360ProfileFoto, releaseEmpleadoFotoCache } from "../api/empleadoFoto.ts";
import { getEmpleadoVista360, type UsuarioVista360 } from "../api/vista360.ts";
import { diasRestantesTexto, estatusContratoBadge, type ContratoEmpleadoResumen } from "../api/contratos.ts";
import type { EstadoEmpleadoResponse } from "../api/usuarios.ts";
import { isUsuariosFetchError } from "../api/usuarios.ts";
import { canAccessEmpleadosPage, canAccessUsuariosAdmin } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { whenModuleBackLinkVisible } from "../navigation/moduleBackLink.ts";
import { mountEditarAsignacionModal } from "../components/empleados/editarAsignacionModal.ts";
import type { EditarAsignacionModalHandle } from "../components/empleados/editarAsignacionModal.ts";
import { vista360CardHtml, vista360FieldRowHtml, vista360FieldRowText } from "../components/vista360/card.ts";
import {
  vista360EstadisticasCardsHtml,
  vista360EstadisticasSkeletonHtml,
} from "../components/vista360/incidenciasMetricasCards.ts";
import { escapeHtml } from "../components/vista360/html.ts";
import { vista360ProfileHeaderHtml } from "../components/vista360/profileHeader.ts";
import { loadEmpleadoVista360, type EmpleadoIncidenciasMetricas } from "../hooks/useVista360.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import {
  antiguedadAniosMeses,
  formatFechaIngreso,
  usuarioToListItem,
} from "../utils/vista360Domain.ts";

const iconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const iconBriefcase = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.184 2.675-.394.633-1.086 1.185-2.066 1.185H7c-.98 0-1.672-.552-2.066-1.185-.397-.639-1.184-1.581-1.184-2.675v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.182-2.649a2.18 2.18 0 0 0-.908-.91 2.18 2.18 0 0 0-1.661-.75H7.5a2.18 2.18 0 0 0-1.661.75 2.18 2.18 0 0 0-.908.91C4.517 5.691 3.75 6.625 3.75 7.706v3.784a2.18 2.18 0 0 0 .75 1.661m16.5 0A2.25 2.25 0 0 1 18 16.5h-12a2.25 2.25 0 0 1-2.25-2.25V8.25A2.25 2.25 0 0 1 6 6h12a2.25 2.25 0 0 1 2.25 2.25v5.25Z" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const iconCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const vista360PageShellClass =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "Se requiere rol RH, gerente, director o supervisor para ver el directorio.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

function skeletonHtml(): string {
  const estadisticasBlock = vista360EstadisticasSkeletonHtml(true);
  const gridSkeleton = `
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        ${Array.from({ length: 3 }, () => '<div class="min-h-40 rounded-2xl bg-slate-100"></div>').join("")}
      </div>`;
  const bodyBlock = `${gridSkeleton}${estadisticasBlock}`;
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
      ${bodyBlock}
    </div>`;
}

function esEstadoVisualActivo(estado: EstadoEmpleadoResponse | null): boolean {
  if (!estado?.descripcion) return false;
  const d = estado.descripcion.trim().toLowerCase();
  if (d.includes("inactiv")) return false;
  return d.includes("activ");
}

function formatCentroCostos(centrocostoId: number | null | undefined): string | null {
  if (centrocostoId == null) return null;
  return String(centrocostoId);
}

function antiguedadFechaIngresoRow(fechaIngreso: string | null): string {
  if (!fechaIngreso?.trim()) return vista360FieldRowText("Fecha de ingreso", null);
  const s = formatFechaIngreso(fechaIngreso);
  if (!s || s === "—") return vista360FieldRowText("Fecha de ingreso", null);
  return vista360FieldRowText("Fecha de ingreso", s);
}

/** «Contrato: <descripción> · vence 12 sep 2026 (en 16 d)» con badge; indefinido / sin dato / «—». */
function contratoRowHtml(contrato: ContratoEmpleadoResumen | null | undefined): string {
  if (!contrato || (!contrato.contrato_codigo && !contrato.contrato_descripcion)) {
    return vista360FieldRowText("Contrato", null);
  }
  const nombre = escapeHtml(contrato.contrato_descripcion ?? contrato.contrato_codigo ?? "—");
  let detalle = "";
  if (contrato.estatus === "indefinido") {
    detalle = `<span class="text-text-muted">· no vence</span>`;
  } else if (contrato.fecha_vencimiento) {
    const cuando = diasRestantesTexto(contrato.dias_restantes);
    detalle = `<span class="text-text-muted">· ${contrato.estatus === "vencido" ? "venció" : "vence"} ${escapeHtml(formatFechaIngreso(contrato.fecha_vencimiento))}${cuando ? ` (${escapeHtml(cuando.toLowerCase())})` : ""}</span>`;
  }
  return vista360FieldRowHtml(
    "Contrato",
    `<span class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">${nombre} ${detalle} ${estatusContratoBadge(contrato.estatus)}</span>`,
  );
}

function antiguedadBodyHtml(fechaIngreso: string | null, contrato?: ContratoEmpleadoResumen | null): string {
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
  return (
    antiguedadFechaIngresoRow(fechaIngreso) +
    vista360FieldRowHtml("Tiempo en empresa", tiempoInner) +
    contratoRowHtml(contrato) +
    evaluacionBlock
  );
}

function renderVista360Content(
  data: UsuarioVista360,
  incidenciasMetricas: EmpleadoIncidenciasMetricas | null,
  saldoVacacionesReal: number | null,
): string {
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
    empleadoId: u.id,
    metaPartes,
    activo: esEstadoVisualActivo(u.estado),
    showEditar: showRh,
  });

  const te = data.turno_empleado;

  const estadisticasSection =
    incidenciasMetricas !== null
      ? vista360EstadisticasCardsHtml(incidenciasMetricas, saldoVacacionesReal)
      : vista360EstadisticasSkeletonHtml(true);

  const cardPersonales = vista360CardHtml({
    title: "Personales",
    iconSvg: iconUser,
    iconTone: "blue",
    bodyHtml:
      vista360FieldRowText("Comedor", showRh ? (te?.comedor ?? null) : null) +
      vista360FieldRowText("Centro de costos", formatCentroCostos(u.centrocosto_id)) +
      vista360FieldRowText("Email", u.email),
  });

  const cardLaborales = vista360CardHtml({
    title: "Laborales",
    iconSvg: iconBriefcase,
    iconTone: "emerald",
    bodyHtml:
      vista360FieldRowText("Área", u.area?.descripcion ?? null) +
      vista360FieldRowText("Subárea", u.subarea?.descripcion ?? null) +
      vista360FieldRowText("Turno", showRh ? (te?.turno ?? null) : null),
  });

  const cardAntiguedad = vista360CardHtml({
    title: "Antigüedad",
    iconSvg: iconCalendar,
    iconTone: "sky",
    // Fecha de ingreso real (CB_FEC_ING) con fallback al `registro` legacy si la BD externa no respondió.
    bodyHtml: antiguedadBodyHtml(data.fecha_ingreso ?? u.registro, data.contrato),
  });

  const grid = `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${cardPersonales}${cardLaborales}${cardAntiguedad}
    </div>`;

  return `
    <div id="v360-loaded" class="space-y-6">
      ${whenModuleBackLinkVisible(`
      <div>
        <a href="#/empleados" class="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-semibold text-slate-500 transition-colors hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 opacity-80" aria-hidden="true"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>
          Volver al directorio
        </a>
      </div>`)}
      ${header}
      ${grid}
      ${estadisticasSection}
    </div>`;
}

export function mountEmployeeVista360(
  container: HTMLElement,
  empleadoId: number,
  signal: AbortSignal,
): void {
  if (!canAccessEmpleadosPage()) {
    mountAppShell(container, {
      pageTitle: "Vista 360",
      activeNav: "empleados",
      mainClass: "pt-0 pb-5 sm:pb-6",
      mainHtml: `<div class="${vista360PageShellClass}"><div class="mx-auto w-full max-w-[1320px] space-y-4 px-2 pb-2 sm:px-3">${forbiddenHtml()}</div></div>`,
    });
    return;
  }

  const isRh = canAccessUsuariosAdmin();

  mountAppShell(container, {
    pageTitle: "Vista 360",
    activeNav: "empleados",
    mainClass: "pt-0 pb-5 sm:pb-6",
    mainHtml: `
      <div class="${vista360PageShellClass}">
        <div id="v360-root" class="mx-auto w-full max-w-[1320px] space-y-6 px-2 pb-2 sm:px-3">
          <div id="v360-content">${skeletonHtml()}</div>
        </div>
      </div>
      ${isRh ? `<div id="v360-edit-modal-host"></div>` : ""}`,
  });

  const contentEl = container.querySelector("#v360-content") as HTMLElement | null;
  const v360Root = container.querySelector("#v360-root") as HTMLElement | null;
  const modalHost = container.querySelector("#v360-edit-modal-host") as HTMLElement | null;

  let editModal: EditarAsignacionModalHandle | null = null;

  function afterVista360Rendered(): void {
    if (!v360Root) return;
    void loadVista360ProfileFoto(v360Root, empleadoId, signal);
  }

  if (isRh && modalHost && v360Root) {
    editModal = mountEditarAsignacionModal(modalHost, {
      onSuccess: async () => {
        if (!contentEl) return;
        contentEl.innerHTML = skeletonHtml();
        const r = await loadEmpleadoVista360(empleadoId, signal);
        if (!r.ok && r.aborted) return;
        if (r.ok) {
          contentEl.innerHTML = renderVista360Content(r.data, r.incidenciasMetricas, r.saldoVacacionesReal);
          afterVista360Rendered();
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

  signal.addEventListener(
    "abort",
    () => {
      releaseEmpleadoFotoCache();
    },
    { once: true },
  );

  async function load(): Promise<void> {
    if (!contentEl) return;
    releaseEmpleadoFotoCache(empleadoId);
    contentEl.innerHTML = skeletonHtml();
    const r = await loadEmpleadoVista360(empleadoId, signal);
    if (!r.ok && r.aborted) return;
    if (!contentEl) return;
    if (r.ok) {
      contentEl.innerHTML = renderVista360Content(r.data, r.incidenciasMetricas, r.saldoVacacionesReal);
      afterVista360Rendered();
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
