import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  createRegistro,
  getCursosExternos,
  getVencimientos,
  type CursoExterno,
  type EstadoVencimiento,
  type ProveedorExternoFetchError,
  type RegistroVencimiento,
} from "../api/proveedoresExternos.ts";
import {
  mountProveedorPersonaPicker,
  type ProveedorPersonaPickerController,
  type ProveedorPersonaSeleccion,
} from "../components/proveedores/proveedorPersonaPicker.ts";
import { escapeHtml, fmtFechaLargaEsMx } from "../ui/uiUtils.ts";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  pageHeading,
} from "../ui/uiTokens.ts";

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;

type EstadoFiltro = EstadoVencimiento | "";

const ESTADO_OPCIONES: ReadonlyArray<{ value: EstadoFiltro; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "vencido", label: "Vencidos" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "vigente", label: "Vigentes" },
  { value: "sin_vencimiento", label: "Sin vencimiento" },
];

function estadoBadge(estado: EstadoVencimiento, dias: number | null): string {
  const map: Record<EstadoVencimiento, { cls: string; dot: string; label: string }> = {
    vigente: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "Vigente" },
    por_vencer: { cls: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-400", label: "Por vencer" },
    vencido: { cls: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-500", label: "Vencido" },
    sin_vencimiento: { cls: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400", label: "Sin vencimiento" },
  };
  const m = map[estado];
  let extra = "";
  if (estado === "por_vencer" && dias != null) extra = ` (${dias} d)`;
  else if (estado === "vencido" && dias != null) extra = ` (${Math.abs(dias)} d)`;
  return `<span class="inline-flex items-center gap-1.5 rounded-full border ${m.cls} px-2 py-0.5 text-xs font-semibold"><span class="size-1.5 shrink-0 rounded-full ${m.dot}" aria-hidden="true"></span>${m.label}${extra}</span>`;
}

function renderLoading(): string {
  return `<div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center text-sm text-text-muted">Cargando vencimientos…</div>`;
}

function renderError(msg: string | null): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">No se pudieron cargar los vencimientos</p>
    <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(msg ?? "Error desconocido")}</p>
    <button type="button" data-action="retry" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Reintentar</button>
  </div>`;
}

function renderEmpty(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center">
    <p class="text-base font-semibold text-text-primary">Sin registros de cursos</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Registra el primer curso tomado por una persona externa para dar seguimiento a su vencimiento.
    </p>
    <button type="button" data-action="add" class="${RH_LISTADO_BTN_PRIMARY} mx-auto mt-6 inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Registrar curso</span>
    </button>
  </div>`;
}

function renderRow(r: RegistroVencimiento): string {
  return `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-3.5 align-middle">
        <span class="block text-sm font-semibold text-text-primary">${escapeHtml(r.persona_nombre ?? "—")}</span>
        <span class="block text-xs text-text-muted">${escapeHtml(r.proveedor_nombre ?? "—")}</span>
      </td>
      <td class="px-4 py-3.5 align-middle text-sm text-text-secondary">${escapeHtml(r.curso_nombre ?? "—")}</td>
      <td class="whitespace-nowrap px-4 py-3.5 align-middle text-sm text-text-secondary">${escapeHtml(fmtFechaLargaEsMx(r.fecha_realizado))}</td>
      <td class="whitespace-nowrap px-4 py-3.5 align-middle text-sm text-text-secondary">${r.fecha_vencimiento ? escapeHtml(fmtFechaLargaEsMx(r.fecha_vencimiento)) : "—"}</td>
      <td class="px-4 py-3.5 align-middle">${estadoBadge(r.estado, r.dias_restantes)}</td>
    </tr>`;
}

function renderTable(items: RegistroVencimiento[]): string {
  if (items.length === 0) {
    return `<div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center text-sm text-text-muted">Ningún registro coincide con los filtros.</div>`;
  }
  return `
  <section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Listado de vencimientos">
    <div class="overflow-x-auto">
      <table class="min-w-[760px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Persona / Contratista</th>
            <th scope="col" class="px-4 py-3.5 text-left">Curso</th>
            <th scope="col" class="px-4 py-3.5 text-left">Realizado</th>
            <th scope="col" class="px-4 py-3.5 text-left">Vence</th>
            <th scope="col" class="px-4 py-3.5 text-left">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${items.map(renderRow).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function renderFilters(estado: EstadoFiltro): string {
  const options = ESTADO_OPCIONES.map(
    (o) => `<option value="${o.value}" ${o.value === estado ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
  ).join("");
  return `
  <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Filtros de vencimientos">
    <label for="venc-estado" class="${RH_LISTADO_LABEL}">Filtrar por estado</label>
    <div class="grid grid-cols-1 sm:max-w-xs">
      <select id="venc-estado" class="${RH_LISTADO_SELECT}">${options}</select>
      ${SELECT_CHEVRON}
    </div>
  </section>`;
}

function renderHeader(): string {
  const actions = `
    <button type="button" data-action="add" class="${RH_LISTADO_BTN_PRIMARY} inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Registrar curso</span>
    </button>`;
  return pageHeading(
    "Vencimientos",
    "Seguimiento de los cursos tomados por el personal externo y su vigencia.",
    actions,
  );
}

function renderReady(items: RegistroVencimiento[], estado: EstadoFiltro, hayRegistros: boolean): string {
  const body = !hayRegistros
    ? renderEmpty()
    : `
    <div class="flex flex-col gap-4 sm:gap-5">
      ${renderFilters(estado)}
      ${renderTable(items)}
    </div>`;
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}">
    ${renderLevelUpBackBar()}
    ${renderHeader()}
    ${body}
  </div>`;
}

function renderRegistroModal(cursos: CursoExterno[]): string {
  const cursoOptions = [
    `<option value="">Selecciona un curso…</option>`,
    ...cursos.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`),
  ].join("");
  return `
    <div id="venc-modal-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-xl" role="dialog" aria-modal="true" aria-labelledby="venc-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="venc-modal-title" class="text-lg font-semibold text-text-primary">Registrar curso</h3>
          <p class="mt-1 text-sm text-text-muted">Elige la persona externa y el curso realizado. El vencimiento se calcula según la vigencia del curso.</p>
        </div>
        <form id="venc-modal-form" class="flex flex-col gap-4 px-6 py-5">
          <div id="venc-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          <div id="venc-picker-host"></div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="venc-curso" class="${RH_LISTADO_LABEL}">Curso <span class="text-red-600" aria-hidden="true">*</span></label>
              <div class="grid grid-cols-1">
                <select id="venc-curso" name="curso_externo_id" class="${RH_LISTADO_SELECT}">${cursoOptions}</select>
                ${SELECT_CHEVRON}
              </div>
            </div>
            <div>
              <label for="venc-fecha" class="${RH_LISTADO_LABEL}">Fecha realizado <span class="text-red-600" aria-hidden="true">*</span></label>
              <input id="venc-fecha" name="fecha_realizado" type="date" required class="${FIELD_INPUT}" />
            </div>
          </div>
          <div>
            <label for="venc-obs" class="${RH_LISTADO_LABEL}">Observaciones</label>
            <textarea id="venc-obs" name="observaciones" rows="2" class="${FIELD_TEXTAREA}"></textarea>
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" data-action="close-modal" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">Guardar registro</button>
          </div>
        </form>
      </div>
    </div>`;
}

export function mountCursosVencimientos(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: RegistroVencimiento[] = [];
  let estado: EstadoFiltro = "";
  let hayRegistros = false;
  let errorMessage: string | null = null;
  let picker: ProveedorPersonaPickerController | null = null;
  let seleccion: ProveedorPersonaSeleccion | null = null;

  mountAppShell(container, {
    pageTitle: "Vencimientos",
    activeNav: "cursos-vencimientos",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="venc-root">
      <div id="venc-inner">${renderLoading()}</div>
      <div id="venc-modal-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#venc-inner");
    if (!inner) return;
    if (status === "loading") inner.innerHTML = renderLoading();
    else if (status === "error") inner.innerHTML = renderError(errorMessage);
    else inner.innerHTML = renderReady(items, estado, hayRegistros);
  }

  async function load(): Promise<void> {
    status = "loading";
    paint();
    try {
      const res = await getVencimientos({ page: 1, page_size: 200, estado });
      items = res.items;
      // Sin filtro: si no hay items, no hay registros. Con filtro: consultamos aparte.
      if (estado === "") {
        hayRegistros = items.length > 0;
      } else {
        const all = await getVencimientos({ page: 1, page_size: 1 });
        hayRegistros = all.total > 0;
      }
      status = "ready";
    } catch (e) {
      status = "error";
      errorMessage = (e as ProveedorExternoFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  async function openModal(): Promise<void> {
    const host = container.querySelector("#venc-modal-host");
    if (!host) return;
    let cursos: CursoExterno[] = [];
    try {
      const res = await getCursosExternos({ page: 1, page_size: 200 });
      cursos = res.items;
    } catch {
      cursos = [];
    }
    host.innerHTML = renderRegistroModal(cursos);
    seleccion = null;
    const pickerHost = container.querySelector<HTMLElement>("#venc-picker-host");
    if (pickerHost) {
      picker = mountProveedorPersonaPicker(pickerHost, {
        onChange: (sel) => {
          seleccion = sel;
        },
      });
    }
  }

  function closeModal(): void {
    picker?.destroy();
    picker = null;
    seleccion = null;
    const host = container.querySelector("#venc-modal-host");
    if (host) host.innerHTML = "";
  }

  container.addEventListener(
    "click",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "venc-modal-backdrop") return closeModal();
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "retry") return void load();
      if (action === "add") return void openModal();
      if (action === "close-modal") return closeModal();
    },
    { signal },
  );

  container.addEventListener(
    "change",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "venc-estado") {
        estado = (target as HTMLSelectElement).value as EstadoFiltro;
        void load();
      }
    },
    { signal },
  );

  container.addEventListener(
    "submit",
    async (e) => {
      if (signal.aborted) return;
      const form = (e.target as HTMLElement).closest<HTMLFormElement>("#venc-modal-form");
      if (!form) return;
      e.preventDefault();
      const errorEl = form.querySelector("#venc-form-error") as HTMLElement | null;
      const showError = (msg: string) => {
        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.classList.remove("hidden");
        }
      };

      if (!seleccion) return showError("Selecciona un proveedor y una persona.");
      const fd = new FormData(form);
      const cursoId = Number(fd.get("curso_externo_id"));
      if (Number.isNaN(cursoId) || !fd.get("curso_externo_id")) return showError("Selecciona un curso.");
      const fecha = String(fd.get("fecha_realizado") ?? "").trim();
      if (!fecha) return showError("Indica la fecha en que se realizó el curso.");

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      try {
        await createRegistro({
          persona_id: seleccion.persona_id,
          curso_externo_id: cursoId,
          fecha_realizado: fecha,
          observaciones: String(fd.get("observaciones") ?? "").trim() || null,
        });
        closeModal();
        await load();
      } catch (err) {
        showError((err as ProveedorExternoFetchError)?.detail ?? "Error al guardar el registro");
        if (submitBtn) submitBtn.disabled = false;
      }
    },
    { signal },
  );

  void load();
}
