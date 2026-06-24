import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import { getCursoById, getCursoSesion, getSesionEmpleados, inscribirEmpleadoSesion, quitarEmpleadoSesion, getSesionEmpleadosElegibles, updateCursoSesion, actualizarAsistencia } from "../api/cursos.ts";
import type { EmpleadoElegible } from "../api/cursos.ts";
import { ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import type { Curso, CursoSesion, EstadoSesion, SesionEmpleadoItem, CursoSesionUpdatePayload } from "../dashboard/cursos/types.ts";

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>`;
const ICON_MAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>`;

const SS_DETAIL_PAGE_OUTER = `${RH_LISTADO_PAGE_OUTER} ss-page ss-detail pt-3 sm:pt-5`;
const MODAL_FIELD_CLS = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;
const ESTADO_SELECT_CLS = `${RH_LISTADO_SELECT} col-start-1 row-start-1 w-auto min-w-[9rem] appearance-none font-semibold ${RH_LISTADO_FOCUS_RING}`;

function estadoBadgeCls(estado: string): string {
  if (estado === "completada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (estado === "cancelada") return "border-red-200 bg-red-50 text-red-800";
  if (estado === "en_curso") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function mountSesionDetalle(container: HTMLElement, cursoId: number, sesionId: number, signal: AbortSignal): void {
  interface State {
    curso: Curso | null;
    sesion: CursoSesion | null;
    empleados: SesionEmpleadoItem[];
    loading: boolean;
    error: string | null;
    searchQuery: string;
    searchResults: EmpleadoElegible[];
    searchLoading: boolean;
    showAddModal: boolean;
    showEditModal: boolean;
  }

  const state: State = {
    curso: null,
    sesion: null,
    empleados: [],
    loading: true,
    error: null,
    searchQuery: "",
    searchResults: [],
    searchLoading: false,
    showAddModal: false,
    showEditModal: false,
  };

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async function loadData(): Promise<void> {
    try {
      const [curso, sesion, empleados] = await Promise.all([
        getCursoById(cursoId),
        getCursoSesion(cursoId, sesionId),
        getSesionEmpleados(cursoId, sesionId),
      ]);
      state.curso = curso;
      state.sesion = sesion;
      state.empleados = empleados;
      state.error = null;
    } catch (err: unknown) {
      const e = err as { detail?: string };
      state.error = e?.detail ?? "Error al cargar la sesión";
    }
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Detalle de sesión",
      activeNav: "sesiones",
      mainClass: "py-0",
      mainHtml: renderPage(),
    });
    bindEvents();
  }

  function kpiSkeletonCard(): string {
    return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="h-3 w-24 rounded bg-slate-200/90"></div>
      <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
      <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
    </article>`;
  }

  function renderLoading(): string {
    return `
    <div class="${SS_DETAIL_PAGE_OUTER}" aria-busy="true" aria-label="Cargando detalle de sesión">
      <div class="h-5 w-32 animate-pulse rounded bg-slate-200/90"></div>
      <div class="h-16 w-full max-w-3xl animate-pulse rounded-xl bg-slate-100/90"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-48 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <p class="sr-only">Cargando...</p>
    </div>`;
  }

  function renderError(): string {
    return `
    <div class="${SS_DETAIL_PAGE_OUTER}">
      ${renderBreadcrumb()}
      <div class="${RH_LISTADO_SURFACE} flex min-h-[240px] flex-col items-center justify-center px-6 py-14 text-center" role="alert">
        <p class="text-base font-semibold text-text-primary">Error al cargar la sesión</p>
        <p class="mt-2 max-w-md text-sm text-red-700">${escapeHtml(state.error ?? "Error inesperado")}</p>
        <a href="#/sesiones" class="${RH_LISTADO_BTN_SECONDARY} mt-6">← Sesiones</a>
      </div>
    </div>`;
  }

  function renderBreadcrumb(): string {
    return `
    <nav class="ss-detail-breadcrumb text-xs text-text-muted" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <li>
          <a href="#/sesiones" class="font-medium transition hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">← Sesiones</a>
        </li>
        <li class="text-slate-300" aria-hidden="true">/</li>
        <li class="font-semibold text-text-primary" aria-current="page">Detalle de sesión</li>
      </ol>
    </nav>`;
  }

  function renderKpis(s: CursoSesion): string {
    const fechaCorta = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    const cupoText = s.cupo_max != null ? `${state.empleados.length}/${s.cupo_max}` : String(state.empleados.length);
    const estadoLabel = ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;

    const kpis = [
      {
        label: "Inscritos",
        value: cupoText,
        sub: s.cupo_max != null ? "Ocupación de cupo" : "Empleados en sesión",
        icon: ICON_USERS,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
      },
      {
        label: "Estado",
        value: estadoLabel,
        sub: "Estado operativo",
        icon: ICON_CALENDAR,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
      },
      {
        label: "Fecha inicio",
        value: fechaCorta,
        sub: s.hora_inicio ? `Inicio ${s.hora_inicio.slice(0, 5)}` : "Sin horario definido",
        icon: ICON_CALENDAR,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
      },
      {
        label: "Ubicación",
        value: s.ubicacion ? (s.ubicacion.length > 18 ? `${s.ubicacion.slice(0, 16)}…` : s.ubicacion) : "—",
        sub: s.instructor_nombre ? escapeHtml(s.instructor_nombre) : "Sin instructor",
        icon: ICON_MAP,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      },
    ];

    return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Resumen de la sesión">
      ${kpis.map((k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${typeof k.value === "string" && k.label === "Ubicación" ? escapeHtml(k.value) : escapeHtml(String(k.value))}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${k.sub}</p>
      </article>`).join("")}
    </div>`;
  }

  function sessionField(label: string, value: string | null | undefined): string {
    return `
    <div>
      <dt class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(label)}</dt>
      <dd class="mt-1 text-sm font-medium text-text-primary">${escapeHtml(value || "—")}</dd>
    </div>`;
  }

  function renderPage(): string {
    if (state.loading) return renderLoading();
    if (state.error || !state.sesion || !state.curso) return renderError();

    const s = state.sesion;
    const c = state.curso;

    const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const fechaFin = s.fecha_fin ? new Date(s.fecha_fin + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : null;
    const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : null;
    const cupoDisplay = s.cupo_max != null ? `${state.empleados.length} / ${s.cupo_max}` : String(state.empleados.length);
    const estadoLabel = ESTADO_SESION_LABELS[s.estado as EstadoSesion] ?? s.estado;
    const badgeCls = estadoBadgeCls(s.estado);

    return `
    <div class="${SS_DETAIL_PAGE_OUTER}">
      <header class="ss-detail-header flex flex-col gap-4 sm:gap-5">
        ${renderBreadcrumb()}
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Sesión #${s.id}</p>
            <p class="mt-1 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(fecha)}</p>
            <p class="mt-2 text-sm text-text-secondary">${horario ? `${escapeHtml(horario)} · ` : ""}${s.ubicacion ? escapeHtml(s.ubicacion) : "Sin ubicación"}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-full border ${badgeCls} px-2.5 py-0.5 text-xs font-semibold">${escapeHtml(estadoLabel)}</span>
            <button type="button" data-action="open-edit-sesion" class="${RH_LISTADO_BTN_SECONDARY} text-xs">Editar sesión</button>
          </div>
        </div>
      </header>

      ${renderKpis(s)}

      <section class="${RH_LISTADO_SURFACE} ss-detail-curso overflow-hidden p-0">
        <div class="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Curso</p>
            <h1 class="mt-1 text-lg font-bold text-text-primary sm:text-xl">${escapeHtml(c.nombre)}</h1>
            ${c.descripcion ? `<p class="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">${escapeHtml(c.descripcion)}</p>` : ""}
          </div>
          <a href="#/cursos/${c.id}" class="${RH_LISTADO_BTN_GHOST} shrink-0 text-xs">Ver curso completo</a>
        </div>
        <div class="flex flex-wrap gap-x-6 gap-y-2 px-5 py-4 text-xs text-text-secondary sm:px-6">
          ${c.proveedor_nombre ? `<span>Proveedor: <strong class="text-text-primary">${escapeHtml(c.proveedor_nombre)}</strong></span>` : ""}
          ${c.duracion_horas ? `<span>Duración: <strong class="text-text-primary">${c.duracion_horas}h</strong></span>` : ""}
          ${c.categoria_nombre ? `<span>Categoría: <strong class="text-text-primary">${escapeHtml(c.categoria_nombre)}</strong></span>` : ""}
          ${c.centro_costos ? `<span>Centro costos: <strong class="text-text-primary">${c.centro_costos}</strong></span>` : ""}
        </div>
      </section>

      <section class="${RH_LISTADO_SURFACE} ss-detail-sesion overflow-hidden p-0">
        <div class="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 class="text-base font-semibold text-text-primary">Datos de la Sesión</h2>
            <p class="mt-0.5 text-xs text-text-muted">Información operativa y logística</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label for="sesion-estado" class="text-xs font-medium text-text-muted">Estado</label>
            <div class="relative grid grid-cols-1">
              <select id="sesion-estado" data-action="change-estado" class="${ESTADO_SELECT_CLS} ${badgeCls}">
                ${(["programada", "en_curso", "completada", "cancelada"] as const).map((e) =>
                  `<option value="${e}" ${s.estado === e ? "selected" : ""}>${escapeHtml(ESTADO_SESION_LABELS[e])}</option>`
                ).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
        </div>
        <div class="p-5 sm:p-6">
          <dl class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            ${sessionField("Fecha inicio", fecha)}
            ${fechaFin ? sessionField("Fecha fin", fechaFin) : ""}
            ${horario ? sessionField("Horario", horario) : ""}
            ${s.tipo ? sessionField("Tipo", s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1)) : ""}
            ${s.ubicacion ? sessionField("Ubicación", s.ubicacion) : ""}
            ${s.instructor_nombre ? sessionField("Instructor", s.instructor_nombre) : ""}
            ${s.costo != null ? sessionField("Costo", `$${s.costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`) : ""}
            ${sessionField("Cupo", cupoDisplay)}
            ${sessionField("Inscritos", String(state.empleados.length))}
          </dl>
          ${s.notas ? `
          <div class="mt-6 border-t border-slate-100 pt-5">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Notas</p>
            <p class="mt-2 text-sm leading-relaxed text-text-secondary whitespace-pre-line">${escapeHtml(s.notas)}</p>
          </div>` : ""}
        </div>
      </section>

      <section class="${RH_LISTADO_SURFACE} ss-detail-empleados flex flex-col overflow-hidden p-0" aria-label="Empleados inscritos">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 class="text-base font-semibold text-text-primary">Empleados Inscritos (${state.empleados.length})</h2>
            <p class="mt-0.5 text-xs text-text-muted">Asistencia y gestión de inscripciones</p>
          </div>
          <button type="button" data-action="open-add-empleado" class="${RH_LISTADO_BTN_PRIMARY} text-xs">${ICON_PLUS}<span>Agregar empleado</span></button>
        </div>
        ${state.empleados.length === 0 ? `
        <div class="px-6 py-14 text-center">
          <p class="text-sm font-medium text-text-secondary">Sin empleados inscritos en esta sesión.</p>
          <button type="button" data-action="open-add-empleado" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-5 text-xs">${ICON_PLUS}<span>Agregar empleado</span></button>
        </div>` : `
        <div class="overflow-x-auto">
          <table class="ss-empleados-table min-w-[640px] w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3.5">No. Empleado</th>
                <th class="px-4 py-3.5">Nombre</th>
                <th class="px-4 py-3.5">Asistencia</th>
                <th class="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${state.empleados.map((emp) => `
              <tr class="ss-empleado-row transition hover:bg-slate-50/70">
                <td class="px-4 py-3.5 tabular-nums text-slate-600">${escapeHtml(emp.no_empleado ?? "—")}</td>
                <td class="px-4 py-3.5 font-semibold text-text-primary">${escapeHtml(emp.nombre_empleado ?? "—")}</td>
                <td class="px-4 py-3.5">
                  <label class="inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" data-action="toggle-asistencia" data-id="${emp.id}"
                      ${emp.asistio === true ? "checked" : ""}
                      class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
                    <span class="text-sm ${emp.asistio === true ? "font-medium text-emerald-600" : emp.asistio === false ? "font-medium text-red-600" : "text-slate-400"}">${emp.asistio === true ? "Asistió" : emp.asistio === false ? "No asistió" : "Pendiente"}</span>
                  </label>
                </td>
                <td class="px-4 py-3.5 text-right">
                  <button type="button" data-action="quitar-empleado" data-id="${emp.id}" class="${RH_LISTADO_BTN_GHOST} !px-2 !py-1 text-xs text-red-600 hover:text-red-800">Quitar</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`}
      </section>

      ${state.showAddModal ? renderAddModal() : ""}
      ${state.showEditModal ? renderEditModal() : ""}
    </div>`;
  }

  function renderEditModal(): string {
    const s = state.sesion!;
    return `
    <div class="ss-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" data-backdrop="edit-sesion-modal" role="presentation">
      <div class="ss-modal-panel w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="edit-sesion-title">
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h3 id="edit-sesion-title" class="text-lg font-semibold text-text-primary">Editar Sesión</h3>
            <p class="mt-1 text-sm text-text-muted">Actualiza fechas, horario y datos logísticos.</p>
          </div>
          <button type="button" data-action="close-edit-modal" class="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text-primary" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <form data-form="edit-sesion" class="flex flex-col gap-4 px-6 py-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Fecha inicio <span class="text-red-600" aria-hidden="true">*</span></label>
              <input type="date" name="fecha_inicio" required value="${s.fecha_inicio}" class="${MODAL_FIELD_CLS}" />
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Fecha fin</label>
              <input type="date" name="fecha_fin" value="${s.fecha_fin ?? ""}" class="${MODAL_FIELD_CLS}" />
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Hora inicio</label>
              <input type="time" name="hora_inicio" value="${s.hora_inicio?.slice(0, 5) ?? ""}" class="${MODAL_FIELD_CLS}" />
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Hora fin</label>
              <input type="time" name="hora_fin" value="${s.hora_fin?.slice(0, 5) ?? ""}" class="${MODAL_FIELD_CLS}" />
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Tipo</label>
              <select name="tipo" class="${MODAL_FIELD_CLS}">
                <option value="">—</option>
                <option value="interno" ${s.tipo === "interno" ? "selected" : ""}>Interno</option>
                <option value="externo" ${s.tipo === "externo" ? "selected" : ""}>Externo</option>
              </select>
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Ubicación</label>
              <input type="text" name="ubicacion" value="${escapeHtml(s.ubicacion ?? "")}" class="${MODAL_FIELD_CLS}" />
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Instructor</label>
              <input type="text" name="instructor_nombre" value="${escapeHtml(s.instructor_nombre ?? "")}" class="${MODAL_FIELD_CLS} disabled:bg-slate-50 disabled:text-slate-500" placeholder="Se asigna desde catálogo" disabled />
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Costo</label>
              <input type="number" name="costo" min="0" step="0.01" value="${s.costo ?? ""}" class="${MODAL_FIELD_CLS}" />
            </div>
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Notas</label>
            <textarea name="notas" rows="2" class="${MODAL_FIELD_CLS}">${escapeHtml(s.notas ?? "")}</textarea>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="close-edit-modal" class="${BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto">Guardar</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderAddModal(): string {
    return `
    <div class="ss-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" data-backdrop="add-empleado-modal" role="presentation">
      <div class="ss-modal-panel w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="add-empleado-title">
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h3 id="add-empleado-title" class="text-lg font-semibold text-text-primary">Agregar Empleado a Sesión</h3>
            <p class="mt-1 text-sm text-text-muted">Busca colaboradores elegibles para inscribir.</p>
          </div>
          <button type="button" data-action="close-add-modal" class="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text-primary" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="space-y-4 px-6 py-5">
          <div>
            <label for="search-elegible-input" class="${RH_LISTADO_LABEL}">Buscar empleado</label>
            <div class="relative mt-1">
              <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
              <input id="search-elegible-input" type="text" data-action="search-elegible" autocomplete="off" placeholder="Nombre o número de empleado…"
                value="${escapeHtml(state.searchQuery)}"
                class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
            </div>
          </div>
          <div class="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1">
            ${state.searchLoading ? `<p class="py-6 text-center text-xs text-slate-400">Buscando...</p>` :
              state.searchResults.length === 0 && state.searchQuery.length >= 2 ? `<p class="py-6 text-center text-xs text-slate-400">Sin resultados.</p>` :
              state.searchQuery.length < 2 ? `<p class="py-6 text-center text-xs text-slate-400">Escribe al menos 2 caracteres.</p>` :
              state.searchResults.map((emp) => `
                <button type="button" data-action="inscribir-empleado" data-empleado-id="${emp.id}" class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white">
                  <div class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-text-primary">${escapeHtml(emp.nombre ?? "—")}</span>
                    <span class="text-xs text-slate-400">#${escapeHtml(emp.no_empleado ?? "")}</span>
                  </div>
                  <span class="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">${escapeHtml(emp.origen)}</span>
                </button>`).join("")}
          </div>
        </div>
      </div>
    </div>`;
  }

  function bindEvents(): void {
    container.addEventListener("click", handleClick, { signal });
    container.addEventListener("input", handleInput, { signal });
    container.addEventListener("change", handleChange, { signal });
    container.addEventListener("submit", handleSubmit, { signal });
  }

  async function handleSubmit(e: Event): Promise<void> {
    const form = (e.target as HTMLElement).closest("[data-form='edit-sesion']") as HTMLFormElement | null;
    if (!form) return;
    e.preventDefault();

    const fd = new FormData(form);
    const payload: CursoSesionUpdatePayload = {};
    const fechaInicio = fd.get("fecha_inicio") as string;
    if (fechaInicio) payload.fecha_inicio = fechaInicio;
    const fechaFin = fd.get("fecha_fin") as string;
    if (fechaFin) payload.fecha_fin = fechaFin;
    const horaInicio = fd.get("hora_inicio") as string;
    if (horaInicio) payload.hora_inicio = horaInicio;
    const horaFin = fd.get("hora_fin") as string;
    if (horaFin) payload.hora_fin = horaFin;
    const tipo = fd.get("tipo") as string;
    payload.tipo = tipo || undefined;
    const ubicacion = fd.get("ubicacion") as string;
    payload.ubicacion = ubicacion || undefined;
    const costo = fd.get("costo") as string;
    if (costo) payload.costo = Number(costo);
    const notas = fd.get("notas") as string;
    payload.notas = notas || undefined;

    try {
      const updated = await updateCursoSesion(cursoId, sesionId, payload);
      state.sesion = updated;
      state.showEditModal = false;
      render();
    } catch {
      render();
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    if ((t as HTMLSelectElement).matches("[data-action='change-estado']")) {
      const newEstado = (t as HTMLSelectElement).value as EstadoSesion;
      if (!state.sesion || newEstado === state.sesion.estado) return;
      try {
        const updated = await updateCursoSesion(cursoId, sesionId, { estado: newEstado });
        state.sesion = updated;
        render();
      } catch {
        render();
      }
      return;
    }

    if ((t as HTMLInputElement).matches("[data-action='toggle-asistencia']")) {
      const id = Number((t as HTMLInputElement).dataset.id);
      const checked = (t as HTMLInputElement).checked;
      if (!id) return;
      try {
        await actualizarAsistencia(cursoId, sesionId, id, checked);
        const emp = state.empleados.find((e) => e.id === id);
        if (emp) emp.asistio = checked;
        render();
      } catch {
        render();
      }
    }
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    if ((t as HTMLElement).matches("[data-backdrop='add-empleado-modal']")) {
      state.showAddModal = false;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      return;
    }

    if (t.closest("[data-action='open-add-empleado']")) {
      state.showAddModal = true;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      const input = container.querySelector("[data-action='search-elegible']") as HTMLInputElement | null;
      input?.focus();
      return;
    }

    if (t.closest("[data-action='close-add-modal']")) {
      state.showAddModal = false;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      return;
    }

    if (t.closest("[data-action='open-edit-sesion']")) {
      state.showEditModal = true;
      render();
      return;
    }

    if (t.closest("[data-action='close-edit-modal']") || (t as HTMLElement).matches("[data-backdrop='edit-sesion-modal']")) {
      state.showEditModal = false;
      render();
      return;
    }

    const inscribirBtn = t.closest("[data-action='inscribir-empleado']") as HTMLElement | null;
    if (inscribirBtn) {
      const empId = Number(inscribirBtn.dataset.empleadoId);
      if (!empId) return;
      try {
        await inscribirEmpleadoSesion(cursoId, sesionId, empId);
        state.empleados = await getSesionEmpleados(cursoId, sesionId);
        state.searchResults = state.searchResults.filter((r) => r.id !== empId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    const quitarBtn = t.closest("[data-action='quitar-empleado']") as HTMLElement | null;
    if (quitarBtn) {
      const id = Number(quitarBtn.dataset.id);
      if (!id) return;
      try {
        await quitarEmpleadoSesion(cursoId, sesionId, id);
        state.empleados = state.empleados.filter((e) => e.id !== id);
        render();
      } catch { /* silently handle */ }
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='search-elegible']")) {
      state.searchQuery = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      if (t.value.trim().length < 2) {
        state.searchResults = [];
        render();
        return;
      }
      searchTimeout = setTimeout(async () => {
        state.searchLoading = true;
        render();
        try {
          state.searchResults = await getSesionEmpleadosElegibles(cursoId, sesionId, state.searchQuery);
        } catch {
          state.searchResults = [];
        }
        state.searchLoading = false;
        render();
        const input = container.querySelector("[data-action='search-elegible']") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }
  }

  render();

  (async () => {
    await loadData();
    state.loading = false;
    render();
  })();
}
