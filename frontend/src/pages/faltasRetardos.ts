import { getEmpleadosPage } from "../api/empleados.ts";
import {
  createFaltaRetardo,
  getFaltasRetardosPage,
  type FaltaRetardoListItem,
  type FaltaRetardoTipo,
} from "../api/faltasRetardos.ts";
import { canAccessFaltasRetardosPage } from "../auth/jwt.ts";
import {
  mountNuevaFaltaRetardoModal,
  type FaltaRetardoEmpleadoOption,
  type NuevaFaltaRetardoSubmitPayload,
} from "../components/faltasRetardos/nuevaFaltaRetardoModal.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import {
  badgeClassFaltaRetardoTipo,
  FALTA_RETARDO_TIPOS,
  formatFaltaRetardoFechas,
  labelFaltaRetardoTipo,
} from "../faltasRetardos/rh/constants.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../utils/rhListadoTablaLayout.ts";
import { escapeHtml, fmtFechaCorta, paginationRange } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
  SELECT_CHEVRON,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";

const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-3 text-left text-[13px] font-semibold tracking-tight text-[#334155] sm:px-4";

const FILTER_CONTROL =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400";

type FilterState = {
  busqueda: string;
  tipo: "" | FaltaRetardoTipo;
  fecha_inicio: string;
  fecha_fin: string;
  page: number;
  page_size: number;
};

const DEFAULT_FILTERS: FilterState = {
  busqueda: "",
  tipo: "",
  fecha_inicio: "",
  fecha_fin: "",
  page: 1,
  page_size: 20,
};

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "No tiene permiso para consultar faltas y retardos.",
  });
}

function renderTipoBadge(tipo: FaltaRetardoTipo): string {
  const cls = badgeClassFaltaRetardoTipo(tipo);
  return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}">${escapeHtml(labelFaltaRetardoTipo(tipo))}</span>`;
}

function renderTableRow(row: FaltaRetardoListItem): string {
  const nombre = formatNombreEmpleadoUi(row.empleado_nombre ?? "");
  const noEmp = formatNoEmpleadoDisplay(row.numero_empleado);
  const fechas = formatFaltaRetardoFechas(
    fmtFechaCorta(row.fecha_evento),
    row.fecha_fin ? fmtFechaCorta(row.fecha_fin) : null,
  );
  const obs = row.observaciones?.trim()
    ? escapeHtml(row.observaciones.trim())
    : '<span class="text-slate-400">—</span>';
  const registrador = row.registrado_por_nombre
    ? escapeHtml(formatNombreEmpleadoUi(row.registrado_por_nombre))
    : '<span class="text-slate-400">—</span>';

  return `
    <tr class="border-b border-[rgba(148,163,184,0.18)] hover:bg-[rgba(248,250,252,0.85)]">
      <td class="px-3 py-3 sm:px-4">
        <div class="font-medium text-slate-900">${escapeHtml(nombre)}</div>
        <div class="text-xs text-slate-500">#${escapeHtml(noEmp)}</div>
      </td>
      <td class="px-3 py-3 sm:px-4">${renderTipoBadge(row.tipo)}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeHtml(fechas)}</td>
      <td class="max-w-[220px] truncate px-3 py-3 text-sm text-slate-600 sm:px-4" title="${escapeHtml(row.observaciones ?? "")}">${obs}</td>
      <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.created_at))}</td>
      <td class="px-3 py-3 text-sm text-slate-600 sm:px-4">${registrador}</td>
    </tr>
  `;
}

function renderMain(
  filters: FilterState,
  tableData: { items: FaltaRetardoListItem[]; total: number },
  tableStatus: "idle" | "loading" | "ready" | "error",
  tableError: string,
): string {
  const tipoOptions = FALTA_RETARDO_TIPOS.map(
    (t) =>
      `<option value="${t}" ${filters.tipo === t ? "selected" : ""}>${escapeHtml(labelFaltaRetardoTipo(t))}</option>`,
  ).join("");

  let tableHtml = "";
  if (tableStatus === "loading") {
    tableHtml = `<div class="flex min-h-[200px] items-center justify-center text-sm text-slate-500">Cargando registros…</div>`;
  } else if (tableStatus === "error") {
    tableHtml = `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">${escapeHtml(tableError || "Error al cargar los registros.")}</div>`;
  } else if (tableData.items.length === 0) {
    tableHtml = `<div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">No hay registros con los filtros seleccionados.</div>`;
  } else {
    const totalPages = Math.max(1, Math.ceil(tableData.total / filters.page_size));
    const pages = paginationRange(totalPages, filters.page);
    const usaScroll = rhListadoTablaUsaScrollVerticalViewport(tableData.items.length);
    const { bodyWrapCls } = rhListadoTablaClasesLayoutScroll(usaScroll);
    tableHtml = `
      <div class="${bodyWrapCls}">
        <table class="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th class="${TABLE_TH}">Empleado</th>
              <th class="${TABLE_TH}">Tipo</th>
              <th class="${TABLE_TH}">Fecha(s)</th>
              <th class="${TABLE_TH}">Observaciones</th>
              <th class="${TABLE_TH}">Registrado</th>
              <th class="${TABLE_TH}">Usuario</th>
            </tr>
          </thead>
          <tbody>${tableData.items.map(renderTableRow).join("")}</tbody>
        </table>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p class="text-sm text-slate-600">${tableData.total} registro(s)</p>
        <div class="flex flex-wrap items-center gap-1">
          ${pages
            .map((p) => {
              if (p === "ellipsis") return `<span class="px-2 text-slate-400">…</span>`;
              const active = p === filters.page;
              return `<button type="button" data-fr-page="${p}" class="${RH_LISTADO_BTN_GHOST} min-w-9 ${active ? "bg-slate-100 font-semibold" : ""}">${p}</button>`;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  return `
    ${renderLaboralesBackBar()}
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Faltas y retardos</h1>
            <p class="mt-1 text-sm text-slate-600">Registro de eventos laborales de asistencia.</p>
          </div>
          <button type="button" id="fr-btn-nuevo" class="${RH_SOLICITUDES_BTN_PRIMARY}">Nuevo registro</button>
        </div>
        <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Filtros</h2>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="${FILTER_FIELD_WRAP}">
              <label class="${RH_LISTADO_LABEL}" for="fr-filter-busqueda">Buscar empleado</label>
              <input id="fr-filter-busqueda" type="search" class="${FILTER_CONTROL} ${FIELD_FOCUS}" placeholder="Nombre o número…" value="${escapeHtml(filters.busqueda)}" />
            </div>
            <div class="${FILTER_FIELD_WRAP}">
              <label class="${RH_LISTADO_LABEL}" for="fr-filter-tipo">Tipo de evento</label>
              <select id="fr-filter-tipo" class="${RH_LISTADO_SELECT} ${SELECT_CHEVRON} ${FIELD_FOCUS}">
                <option value="">Todos</option>
                ${tipoOptions}
              </select>
            </div>
            <div class="${FILTER_FIELD_WRAP}">
              <label class="${RH_LISTADO_LABEL}" for="fr-filter-fecha-inicio">Desde</label>
              <input id="fr-filter-fecha-inicio" type="date" class="${FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(filters.fecha_inicio)}" />
            </div>
            <div class="${FILTER_FIELD_WRAP}">
              <label class="${RH_LISTADO_LABEL}" for="fr-filter-fecha-fin">Hasta</label>
              <input id="fr-filter-fecha-fin" type="date" class="${FILTER_CONTROL} ${FIELD_FOCUS}" value="${escapeHtml(filters.fecha_fin)}" />
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" id="fr-filter-apply" class="${RH_SOLICITUDES_BTN_PRIMARY}">Aplicar filtros</button>
            <button type="button" id="fr-filter-clear" class="${RH_SOLICITUDES_BTN_SECONDARY}">Limpiar</button>
          </div>
        </section>
        <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
          ${tableHtml}
        </section>
      </div>
    </div>
  `;
}

export function mountFaltasRetardos(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessFaltasRetardosPage()) {
    mountAppShell(container, {
      activeNav: "faltas-retardos",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  let draftFilters: FilterState = { ...DEFAULT_FILTERS };
  let appliedFilters: FilterState = { ...DEFAULT_FILTERS };
  let tableStatus: "idle" | "loading" | "ready" | "error" = "loading";
  let tableError = "";
  let tableData: { items: FaltaRetardoListItem[]; total: number } = { items: [], total: 0 };
  let empleadoOptions: FaltaRetardoEmpleadoOption[] = [];

  mountAppShell(container, {
    pageTitle: "Faltas y retardos",
    activeNav: "faltas-retardos",
    mainHtml: `<div id="fr-page" class="flex min-h-0 flex-1 flex-col">${renderMain(appliedFilters, tableData, tableStatus, tableError)}</div>
      <div id="fr-modal-host"></div>`,
  });

  const modalHost = container.querySelector("#fr-modal-host");
  let modal =
    modalHost instanceof HTMLElement
      ? mountNuevaFaltaRetardoModal(modalHost, {
          empleados: empleadoOptions,
          toastContainer: container,
          onSubmit: async (payload: NuevaFaltaRetardoSubmitPayload) => {
            await createFaltaRetardo(payload);
            appliedFilters = { ...appliedFilters, page: 1 };
            await fetchTable();
          },
        })
      : null;

  function paint(): void {
    const inner = container.querySelector("#fr-page");
    if (inner) {
      inner.innerHTML = renderMain(appliedFilters, tableData, tableStatus, tableError);
    }
  }

  async function fetchEmpleados(): Promise<void> {
    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 500, activo: true });
      empleadoOptions = page.items.map((e) => ({
        empleado_id: e.empleado_id,
        nombre: formatNombreEmpleadoUi(e.nombre),
        no_empleado: formatNoEmpleadoDisplay(e.no_empleado),
      }));
      if (modalHost instanceof HTMLElement) {
        modal?.destroy();
        modal = mountNuevaFaltaRetardoModal(modalHost, {
          empleados: empleadoOptions,
          toastContainer: container,
          onSubmit: async (payload) => {
            await createFaltaRetardo(payload);
            appliedFilters = { ...appliedFilters, page: 1 };
            await fetchTable();
          },
        });
      }
    } catch {
      showEmpleadosToast(container, "No se pudo cargar la lista de empleados.", "error");
    }
  }

  async function fetchTable(): Promise<void> {
    tableStatus = "loading";
    paint();
    try {
      const data = await getFaltasRetardosPage({
        page: appliedFilters.page,
        page_size: appliedFilters.page_size,
        busqueda: appliedFilters.busqueda || undefined,
        tipo: appliedFilters.tipo || undefined,
        fecha_inicio: appliedFilters.fecha_inicio || undefined,
        fecha_fin: appliedFilters.fecha_fin || undefined,
      });
      tableData = { items: data.items, total: data.total };
      tableStatus = "ready";
      tableError = "";
    } catch (err: unknown) {
      tableStatus = "error";
      tableError =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "No se pudo cargar el listado.";
      showEmpleadosToast(container, tableError, "error");
    }
    paint();
  }

  const pageRoot = container.querySelector("#fr-page");
  pageRoot?.addEventListener("input", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("#fr-filter-busqueda");
    if (!input) return;
    draftFilters = { ...draftFilters, busqueda: input.value };
  });
  pageRoot?.addEventListener("change", (event) => {
    const tipo = (event.target as HTMLElement).closest<HTMLSelectElement>("#fr-filter-tipo");
    if (tipo) {
      draftFilters = { ...draftFilters, tipo: tipo.value as FilterState["tipo"] };
      return;
    }
    const fechaInicio = (event.target as HTMLElement).closest<HTMLInputElement>("#fr-filter-fecha-inicio");
    if (fechaInicio) {
      draftFilters = { ...draftFilters, fecha_inicio: fechaInicio.value };
      return;
    }
    const fechaFin = (event.target as HTMLElement).closest<HTMLInputElement>("#fr-filter-fecha-fin");
    if (fechaFin) {
      draftFilters = { ...draftFilters, fecha_fin: fechaFin.value };
    }
  });
  pageRoot?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("#fr-btn-nuevo")) {
      modal?.open();
      return;
    }
    if (target.closest("#fr-filter-apply")) {
      appliedFilters = { ...draftFilters, page: 1 };
      void fetchTable();
      return;
    }
    if (target.closest("#fr-filter-clear")) {
      draftFilters = { ...DEFAULT_FILTERS };
      appliedFilters = { ...DEFAULT_FILTERS };
      void fetchTable();
      return;
    }
    const pageBtn = target.closest<HTMLButtonElement>("[data-fr-page]");
    if (pageBtn) {
      const page = Number.parseInt(pageBtn.dataset.frPage ?? "1", 10);
      if (!Number.isNaN(page)) {
        appliedFilters = { ...appliedFilters, page };
        void fetchTable();
      }
    }
  });

  signal?.addEventListener("abort", () => {
    modal?.destroy();
  });

  void (async () => {
    await Promise.all([fetchEmpleados(), fetchTable()]);
  })();
}
