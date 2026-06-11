import type {
  HorasExtraEmpleadoOption,
  HorasExtraSolicitudListItem,
  HorasExtraSolicitudOpciones,
  HorasExtraSolicitudResponse,
} from "../../api/horasExtraSolicitud.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type HorasExtraEmpleadoFilaForm = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
  domingo: string;
};

export type HorasExtraSolicitudPageState = {
  opciones: HorasExtraSolicitudOpciones | null;
  opcionesStatus: "loading" | "ready" | "error";
  opcionesError?: string;
  lista: HorasExtraSolicitudListItem[];
  listaStatus: "loading" | "ready" | "error";
  listaError?: string;
  listaTotal: number;
  listaPage: number;
  listaPageSize: number;
  formError?: string;
  listaSuccess?: string;
  submitting: boolean;
  detalleAbierto: HorasExtraSolicitudResponse | null;
  detalleStatus: "idle" | "loading" | "error";
  detalleError?: string;
  empleadosFilas: HorasExtraEmpleadoFilaForm[];
  selectedEmpleadoIds: number[];
  empleadosModalOpen: boolean;
  empleadosModalSearch: string;
  empleadosModalDraftIds: number[];
  solicitudModalOpen: boolean;
};

const DIAS = [
  ["lunes", "Lun"],
  ["martes", "Mar"],
  ["miercoles", "Mié"],
  ["jueves", "Jue"],
  ["viernes", "Vie"],
  ["sabado", "Sáb"],
  ["domingo", "Dom"],
] as const;

function estadoBadge(estado: string): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  if (estado === "cancelado") return badgeCancelled("Cancelado");
  if (estado === "borrador") return badgePending("Borrador");
  return badgePending("Pendiente");
}

function tipoLabel(tipo: string): string {
  return tipo === "espontaneo" ? "Espontánea" : "Planeada";
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function sumFila(fila: HorasExtraEmpleadoFilaForm): number {
  return DIAS.reduce((acc, [key]) => acc + (Number.parseFloat(fila[key]) || 0), 0);
}

export function getSemanasPermitidas(semanaActual: number): number[] {
  const semanas: number[] = [];
  if (semanaActual > 1) {
    semanas.push(semanaActual - 1);
  }
  semanas.push(semanaActual);
  for (let offset = 1; offset <= 4; offset += 1) {
    const futura = semanaActual + offset;
    if (futura <= 53) semanas.push(futura);
  }
  return semanas;
}

function renderSemanaOptions(semanaActual: number): string {
  return getSemanasPermitidas(semanaActual)
    .map(
      (n) =>
        `<option value="${n}"${n === semanaActual ? " selected" : ""}>Semana ${n}</option>`,
    )
    .join("");
}

function semanaLabel(numero: number): string {
  return `Semana ${numero}`;
}

export function filterEmpleadosElegibles(
  empleados: HorasExtraEmpleadoOption[],
  search: string,
): HorasExtraEmpleadoOption[] {
  const q = search.trim().toLowerCase();
  if (!q) return empleados;
  return empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(q) ||
      e.no_empleado.toLowerCase().includes(q),
  );
}

export function renderEmpleadosModalList(
  empleados: HorasExtraEmpleadoOption[],
  draftIds: number[],
): string {
  if (!empleados.length) {
    return `<p class="px-2 py-6 text-center text-sm text-text-secondary">No hay empleados que coincidan con la búsqueda.</p>`;
  }
  return `
    <ul class="divide-y divide-slate-100">
      ${empleados
        .map(
          (e) => `
        <li>
          <label class="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
            <input
              type="checkbox"
              class="size-4 rounded border-slate-300 text-accent focus:ring-accent/40"
              data-he-modal-empleado-id="${e.id}"
              ${draftIds.includes(e.id) ? "checked" : ""}
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-text-primary">${escapeHtml(e.nombre)}</span>
              <span class="block truncate text-xs text-text-secondary">${escapeHtml(e.no_empleado)}</span>
            </span>
          </label>
        </li>`,
        )
        .join("")}
    </ul>`;
}

function renderEmpleadosSeleccionSection(filas: HorasExtraEmpleadoFilaForm[]): string {
  const count = filas.length;
  const countLabel = count
    ? `${count} empleado${count === 1 ? "" : "s"} seleccionado${count === 1 ? "" : "s"}`
    : "Ningún empleado seleccionado";

  return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" id="he-sup-abrir-empleados" class="${BTN_SECONDARY}">
          Seleccionar empleados
        </button>
        <span class="text-sm text-text-secondary" id="he-sup-empleados-count">${countLabel}</span>
      </div>
      <div id="he-sup-empleados-chips" class="${count ? "flex flex-wrap gap-2" : "hidden"}">
        ${filas
          .map(
            (f) => `
          <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-text-primary">
            <span class="truncate">${escapeHtml(f.nombre)}</span>
            <span class="shrink-0 text-text-muted">(${escapeHtml(f.no_empleado)})</span>
          </span>`,
          )
          .join("")}
      </div>
    </div>`;
}

function renderEmpleadosModal(
  empleados: HorasExtraEmpleadoOption[],
  state: HorasExtraSolicitudPageState,
): string {
  if (!state.empleadosModalOpen) return "";

  const filtrados = filterEmpleadosElegibles(empleados, state.empleadosModalSearch);
  const draftCount = state.empleadosModalDraftIds.length;

  return `
    <div id="he-sup-empleados-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="he-sup-empleados-modal-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="he-sup-empleados-modal-title" class="text-lg font-bold text-text-primary">Seleccionar empleados</h2>
            <p class="mt-0.5 text-sm text-text-secondary">Elige uno o más colaboradores de tu equipo operativo.</p>
          </div>
          <button type="button" id="he-sup-empleados-cerrar" class="rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Cerrar">✕</button>
        </div>
        <div class="border-b border-slate-100 px-5 py-3">
          <input
            type="search"
            id="he-sup-empleados-search"
            value="${escapeHtml(state.empleadosModalSearch)}"
            placeholder="Buscar por nombre o número de empleado…"
            autocomplete="off"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}"
          />
        </div>
        <div id="he-sup-empleados-modal-list" class="min-h-0 flex-1 overflow-y-auto">
          ${
            empleados.length
              ? renderEmpleadosModalList(filtrados, state.empleadosModalDraftIds)
              : `<p class="px-5 py-6 text-center text-sm text-text-secondary">No hay empleados operativos disponibles en tu equipo.</p>`
          }
        </div>
        <div class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <span class="text-sm text-text-secondary" id="he-sup-empleados-modal-count">${draftCount} seleccionado${draftCount === 1 ? "" : "s"}</span>
          <div class="flex gap-2">
            <button type="button" id="he-sup-empleados-cancelar" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" id="he-sup-empleados-confirmar" class="${BTN_PRIMARY}">Confirmar</button>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderHorasGrid(filas: HorasExtraEmpleadoFilaForm[]): string {
  if (!filas.length) {
    return `<p class="text-sm text-text-secondary">Selecciona al menos un empleado para capturar horas.</p>`;
  }
  let totalGeneral = 0;
  const body = filas
    .map((fila) => {
      const total = sumFila(fila);
      totalGeneral += total;
      return `
      <tr data-he-fila-empleado="${fila.empleado_id}">
        <td class="px-3 py-2 text-sm font-medium text-text-primary whitespace-nowrap">
          <div>${escapeHtml(fila.nombre)}</div>
          <div class="text-xs text-text-secondary">${escapeHtml(fila.no_empleado)}</div>
        </td>
        ${DIAS.map(
          ([key]) => `
          <td class="px-1 py-2">
            <input type="number" min="0" step="0.5" inputmode="decimal"
              data-he-dia="${key}" data-he-empleado="${fila.empleado_id}"
              class="w-full min-w-[3.25rem] rounded border border-slate-200 px-2 py-1 text-sm tabular-nums ${FIELD_FOCUS}"
              value="${escapeHtml(fila[key])}" />
          </td>`,
        ).join("")}
        <td class="px-3 py-2 text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap" data-he-total-empleado="${fila.empleado_id}">${total.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left">
        <thead class="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th class="px-3 py-2">Empleado</th>
            ${DIAS.map(([, label]) => `<th class="px-1 py-2 text-center">${label}</th>`).join("")}
            <th class="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${body}</tbody>
        <tfoot>
          <tr class="bg-slate-50">
            <td colspan="8" class="px-3 py-2 text-right text-sm font-semibold text-text-secondary">Total general</td>
            <td class="px-3 py-2 text-right text-sm font-bold tabular-nums text-text-primary" id="he-sup-total-general">${totalGeneral.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function renderDetalleModal(state: HorasExtraSolicitudPageState): string {
  if (!state.detalleAbierto && state.detalleStatus !== "loading") return "";
  const det = state.detalleAbierto;
  return `
    <div id="he-sup-detalle-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="he-sup-detalle-title">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="he-sup-detalle-title" class="text-lg font-bold text-text-primary">Solicitud #${det ? det.id : "…"}</h2>
            ${det ? `<p class="text-sm text-text-secondary">${escapeHtml(det.departamento_nombre)} · ${escapeHtml(det.area_descripcion)}</p>` : ""}
          </div>
          <button type="button" id="he-sup-detalle-cerrar" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cerrar</button>
        </div>
        ${
          state.detalleStatus === "loading"
            ? `<p class="text-sm text-text-secondary">Cargando detalle…</p>`
            : state.detalleStatus === "error"
              ? `<p class="text-sm text-red-700">${escapeHtml(state.detalleError ?? "No se pudo cargar el detalle.")}</p>`
              : det
                ? `
          <div class="mb-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div><span class="text-text-secondary">Fecha:</span> <span class="font-medium">${formatFecha(det.fecha_solicitud)}</span></div>
            <div><span class="text-text-secondary">Semana:</span> <span class="font-medium">${semanaLabel(det.semana)}</span></div>
            <div><span class="text-text-secondary">Tipo:</span> <span class="font-medium">${tipoLabel(det.tipo)}</span></div>
            <div><span class="text-text-secondary">Estado:</span> ${estadoBadge(det.estado)}</div>
            <div><span class="text-text-secondary">Centro de costo:</span> <span class="font-medium">${escapeHtml(det.centrocosto_descripcion)}</span></div>
            <div class="sm:col-span-2"><span class="text-text-secondary">Motivo:</span> <span class="font-medium">${escapeHtml(det.motivo_descripcion)}</span></div>
          </div>
          ${renderHorasGrid(
            det.detalle.map((d) => ({
              empleado_id: d.empleado_id,
              no_empleado: d.no_empleado,
              nombre: d.nombre_empleado,
              lunes: String(d.lunes),
              martes: String(d.martes),
              miercoles: String(d.miercoles),
              jueves: String(d.jueves),
              viernes: String(d.viernes),
              sabado: String(d.sabado),
              domingo: String(d.domingo),
            })),
          )}`
                : ""
        }
      </div>
    </div>`;
}

function renderFormularioSolicitud(
  opciones: HorasExtraSolicitudOpciones,
  state: HorasExtraSolicitudPageState,
): string {
  const today = new Date().toISOString().slice(0, 10);

  return `
    <form id="he-sup-form" class="flex flex-col gap-5" novalidate>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-text-secondary">Fecha de solicitud *</span>
          <input type="date" name="fecha_solicitud" required value="${today}" class="w-full rounded border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-text-secondary">Semana *</span>
          <div class="grid grid-cols-1">
            <select name="semana" required class="col-start-1 row-start-1 w-full appearance-none rounded border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm ${FIELD_FOCUS}">
              ${renderSemanaOptions(opciones.semana_actual)}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-text-secondary">Tipo *</span>
          <div class="grid grid-cols-1">
            <select name="tipo" required class="col-start-1 row-start-1 w-full appearance-none rounded border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm ${FIELD_FOCUS}">
              <option value="planeado">Planeada</option>
              <option value="espontaneo">Espontánea</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1 block font-medium text-text-secondary">Motivo *</span>
          <textarea
            name="motivo"
            required
            rows="3"
            maxlength="500"
            class="w-full rounded border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}"
            placeholder="Ej. Cubrir vacante, incremento de producción, soporte a inventario…"
          ></textarea>
        </label>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Empleados incluidos *</h3>
        ${renderEmpleadosSeleccionSection(state.empleadosFilas)}
      </div>

      <div id="he-sup-horas-grid">
        ${renderHorasGrid(state.empleadosFilas)}
      </div>

      ${
        state.formError
          ? `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">${escapeHtml(state.formError)}</p>`
          : ""
      }

      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="he-sup-solicitud-cancelar" class="${BTN_SECONDARY}" ${state.submitting ? "disabled" : ""}>Cancelar</button>
        <button type="submit" class="${BTN_PRIMARY}" ${state.submitting ? "disabled" : ""}>
          ${state.submitting ? "Guardando…" : "Guardar solicitud"}
        </button>
      </div>
    </form>`;
}

function renderSolicitudModal(
  opciones: HorasExtraSolicitudOpciones | null,
  state: HorasExtraSolicitudPageState,
): string {
  if (!state.solicitudModalOpen) return "";

  const body =
    state.opcionesStatus === "loading"
      ? `<p class="text-sm text-text-secondary">Cargando catálogos…</p>`
      : state.opcionesStatus === "error"
        ? `<p class="text-sm text-red-700">${escapeHtml(state.opcionesError ?? "No se pudieron cargar los catálogos.")}</p>`
        : opciones
          ? renderFormularioSolicitud(opciones, state)
          : "";

  return `
    <div id="he-sup-solicitud-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="he-sup-solicitud-modal-title"
      >
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="he-sup-solicitud-modal-title" class="text-lg font-bold text-text-primary">Nueva solicitud de horas extra</h2>
            <p class="mt-0.5 text-sm text-text-secondary">Registra horas extra para colaboradores operativos de tu equipo.</p>
          </div>
          <button type="button" id="he-sup-solicitud-cerrar" class="rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Cerrar">✕</button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          ${body}
        </div>
      </div>
    </div>`;
}

function renderListaTable(state: HorasExtraSolicitudPageState): string {
  if (state.listaStatus === "loading") {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">Cargando solicitudes…</p>`;
  }
  if (state.listaStatus === "error") {
    return `<p class="px-4 py-8 text-center text-sm text-red-700">${escapeHtml(state.listaError ?? "Error al cargar solicitudes.")}</p>`;
  }
  if (!state.lista.length) {
    return `<p class="px-4 py-8 text-center text-sm text-text-secondary">Aún no has creado solicitudes de horas extra.</p>`;
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left">
        <thead class="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            <th class="px-3 py-3">Folio</th>
            <th class="px-3 py-3">Fecha</th>
            <th class="px-3 py-3">Semana</th>
            <th class="px-3 py-3">Departamento / Área</th>
            <th class="px-3 py-3">Tipo</th>
            <th class="px-3 py-3 text-right">Total hrs</th>
            <th class="px-3 py-3">Estado</th>
            <th class="px-3 py-3">Creada</th>
            <th class="px-3 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${state.lista
            .map(
              (row) => `
            <tr>
              <td class="px-3 py-3 text-sm font-semibold text-text-primary">#${row.id}</td>
              <td class="px-3 py-3 text-sm text-text-primary whitespace-nowrap">${formatFecha(row.fecha_solicitud)}</td>
              <td class="px-3 py-3 text-sm text-text-primary whitespace-nowrap">${semanaLabel(row.semana)}</td>
              <td class="px-3 py-3 text-sm text-text-primary">
                <div>${escapeHtml(row.departamento_nombre)}</div>
                <div class="text-xs text-text-secondary">${escapeHtml(row.area_descripcion)}</div>
              </td>
              <td class="px-3 py-3 text-sm text-text-primary">${tipoLabel(row.tipo)}</td>
              <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary text-right">${Number(row.total_horas_general).toFixed(2)}</td>
              <td class="px-3 py-3">${estadoBadge(row.estado)}</td>
              <td class="px-3 py-3 text-sm text-text-secondary whitespace-nowrap">${formatDateTime(row.created_at)}</td>
              <td class="px-3 py-3">
                <button type="button" data-he-ver-id="${row.id}" class="text-sm font-semibold text-accent hover:underline">Ver</button>
              </td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

export function renderHorasExtraSolicitudPage(state: HorasExtraSolicitudPageState): string {
  const opciones = state.opciones;
  const puedeAbrirModal = state.opcionesStatus === "ready" && Boolean(opciones);

  return `
    <div id="horas-extra-solicitud-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <header class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Solicitud de horas extra</h1>
          <p class="mt-1 text-sm text-text-secondary">Consulta tus solicitudes registradas y captura nuevas para tu equipo operativo.</p>
        </div>
        <button
          type="button"
          id="he-sup-abrir-solicitud"
          class="${BTN_PRIMARY} shrink-0"
          ${puedeAbrirModal ? "" : "disabled"}
        >
          Nueva solicitud de horas extra
        </button>
      </header>

      ${
        state.listaSuccess
          ? `<p class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">${escapeHtml(state.listaSuccess)}</p>`
          : ""
      }

      <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Mis solicitudes">
        <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-text-primary">Mis solicitudes registradas</h2>
          <p class="text-xs text-text-secondary">Solo se muestran solicitudes creadas por ti.</p>
        </div>
        ${renderListaTable(state)}
      </section>

      ${renderSolicitudModal(opciones, state)}
      ${renderEmpleadosModal(opciones?.empleados ?? [], state)}
      ${renderDetalleModal(state)}
    </div>`;
}

