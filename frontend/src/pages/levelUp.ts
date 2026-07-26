import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FORM_LABEL,
  FORM_SELECT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  alertError,
  pageHeading,
  errorState,
  skeletonBlock,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import { getCursos, getCursoById, createCurso, updateCurso, deleteCurso, getCursoPuestos, getCursoEmpleadosExtra, getCursoSesiones, createCursoSesion, deleteCursoSesion, getSesionEmpleados, inscribirEmpleadoSesion, quitarEmpleadoSesion, getSesionEmpleadosElegibles, getCursoCatalogosAsignacion, getCursoAreas, agregarAreaCurso, quitarAreaCurso, agregarPuestoCurso, quitarPuestoCurso, getCursoCatalogosPuestos, buscarEmpleadosExtraCurso, agregarEmpleadoExtraCurso, quitarEmpleadoExtraCurso } from "../api/cursos.ts";
import {
  getProveedores, createProveedor, getCategorias, getTipos, getClasificaciones,
  getInstructoresInternos, getInstructoresExternos,
} from "../api/cursosCatalogo.ts";
import type { Proveedor, CursoCatSimple, InstructorInterno, InstructorExterno } from "../api/cursosCatalogo.ts";
import type { CursoPuestoDetail, CursoEmpleadoDetail, EmpleadoElegible, CursoGrupoItem, CursoCatalogos, CatalogoPuestoPerfilItem, EmpleadoExtraElegible } from "../api/cursos.ts";
import type { Curso, CursoListResponse, CursoCreatePayload, CursoSesion, CursoSesionCreatePayload, InstructorTipo, SesionEmpleadoItem } from "../dashboard/cursos/types.ts";
import { TIPO_LABELS, CLASIFICACION_LABELS, CATEGORIA_LABELS, ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import { hasRhModule } from "../auth/rhModulePermissions.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import type { UsuarioListItem } from "../api/usuarios.ts";
import { getEncuestasDashboard, getCursoEncuestasResumen } from "../api/encuestas.ts";
import {
  listarSugerencias,
  crearSugerencia,
  actualizarSugerencia,
  eliminarSugerencia,
  generarSugerenciasDesdeBrechas,
} from "../api/sugerencias.ts";
import type {
  SugerenciaResponse,
  SugerenciaEstado,
  SugerenciaCreatePayload,
  SugerenciaUpdatePayload,
} from "../api/sugerencias.ts";
import { getAreasOptions } from "../api/puestos.ts";
import type { AreaOption } from "../api/puestos.ts";
import type {
  EncuestasDashboard,
  DashboardCursoItem,
  DistribucionItem,
  ComentarioItem,
  CursoEncuestasResumen,
} from "../dashboard/cursos/encuestasTypes.ts";
import {
  ESTADO_ENCUESTA_BADGE,
  ESTADO_ENCUESTA_LABELS,
} from "../dashboard/cursos/encuestasTypes.ts";



export function mountCursos(container: HTMLElement, signal: AbortSignal): void {
  const isRH = hasRhModule("cursos");

  const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
  const ICON_BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 016 2.292m0-14.25v14.25"/></svg>`;
  const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>`;
  const ICON_BUILDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/></svg>`;
  const ICON_GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>`;
  const ICON_CLIPBOARD_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;

  const FILTER_SELECT_CLS = `${RH_LISTADO_SELECT} col-start-1 row-start-1 appearance-none ${RH_LISTADO_FOCUS_RING}`;
  const FILTER_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

  interface CursoModalDraft {
    nombre: string;
    clasificacion_id: string;
    tipo_id: string;
    duracion_horas: string;
    categoria_id: string;
    centro_costos: string;
    descripcion: string;
    obligatorio: boolean;
  }

  interface CursosState {
    cursos: CursoListResponse;
    loading: boolean;
    page: number;
    filters: { tipo: string; clasificacion: string; obligatorio: string; categoria: string; busqueda: string };
    showCreateModal: boolean;
    editingCurso: Curso | null;
    viewMode: "tarjetas" | "tabla";
    empleados: { id: number; nombre: string }[];
    empleadosLoaded: boolean;
    detailCurso: Curso | null;
    detailPuestos: CursoPuestoDetail[];
    detailEmpleadosExtra: CursoEmpleadoDetail[];
    detailAreas: CursoGrupoItem[];
    detailSesiones: CursoSesion[];
    detailEncuestas: CursoEncuestasResumen | null;
    detailDataLoading: boolean;
    showCreateSesionModal: boolean;
    instructoresInternos: InstructorInterno[];
    instructoresExternos: InstructorExterno[];
    instructoresCatalogLoading: boolean;
    sesionModalTipo: "" | "interno" | "externo";
    viewingSesion: CursoSesion | null;
    sesionEmpleados: SesionEmpleadoItem[];
    selectedEmpleados: Set<number>;
    showAssignSesionPicker: boolean;
    expandedAreas: Set<number>;
    expandedPuestos: Set<number>;
    expandedExtras: boolean;
    showAsignacionMasivaModal: boolean;
    asignacionCatalogos: CursoCatalogos | null;
    asignacionCatalogosLoading: boolean;
    asignacionAreaIds: Set<number>;
    asignacionLoading: boolean;
    asignacionResult: { asignados: number; ya_asignados: number } | null;
    asignacionError: string | null;
    showAsignacionPuestosModal: boolean;
    asignacionPuestosCatalog: CatalogoPuestoPerfilItem[] | null;
    asignacionPuestosCatalogLoading: boolean;
    asignacionPuestoIds: Set<number>;
    asignacionPuestosLoading: boolean;
    asignacionPuestosResult: { asignados: number; ya_asignados: number } | null;
    asignacionPuestosError: string | null;
    showAsignacionExtrasModal: boolean;
    extraSearchQuery: string;
    extraSearchResults: EmpleadoExtraElegible[];
    extraSearchLoading: boolean;
    asignacionExtrasError: string | null;
    proveedoresCatalog: Proveedor[];
    proveedoresLoading: boolean;
    categoriasCatalog: CursoCatSimple[];
    tiposCatalog: CursoCatSimple[];
    clasificacionesCatalog: CursoCatSimple[];
    cursoModalDraft: CursoModalDraft | null;
  }

  const state: CursosState = {
    cursos: { items: [], total: 0, page: 1, page_size: 20 },
    loading: true,
    page: 1,
    filters: { tipo: "", clasificacion: "", obligatorio: "", categoria: "", busqueda: "" },
    showCreateModal: false,
    editingCurso: null,
    viewMode: "tabla",
    empleados: [],
    empleadosLoaded: false,
    detailCurso: null,
    detailPuestos: [],
    detailEmpleadosExtra: [],
    detailAreas: [],
    detailSesiones: [],
    detailEncuestas: null,
    detailDataLoading: false,
    showCreateSesionModal: false,
    instructoresInternos: [],
    instructoresExternos: [],
    instructoresCatalogLoading: false,
    sesionModalTipo: "",
    viewingSesion: null,
    sesionEmpleados: [],
    selectedEmpleados: new Set(),
    showAssignSesionPicker: false,
    expandedAreas: new Set(),
    expandedPuestos: new Set(),
    expandedExtras: false,
    showAsignacionMasivaModal: false,
    asignacionCatalogos: null,
    asignacionCatalogosLoading: false,
    asignacionAreaIds: new Set(),
    asignacionLoading: false,
    asignacionResult: null,
    asignacionError: null,
    showAsignacionPuestosModal: false,
    asignacionPuestosCatalog: null,
    asignacionPuestosCatalogLoading: false,
    asignacionPuestoIds: new Set(),
    asignacionPuestosLoading: false,
    asignacionPuestosResult: null,
    asignacionPuestosError: null,
    showAsignacionExtrasModal: false,
    extraSearchQuery: "",
    extraSearchResults: [],
    extraSearchLoading: false,
    asignacionExtrasError: null,
    proveedoresCatalog: [],
    proveedoresLoading: false,
    categoriasCatalog: [],
    tiposCatalog: [],
    clasificacionesCatalog: [],
    cursoModalDraft: null,
  };

  async function loadEmpleados() {
    if (state.empleadosLoaded) return;
    try {
      let page = 1;
      let all: { id: number; nombre: string }[] = [];
      let total = Infinity;
      while (all.length < total) {
        const res = await getEmpleadosPage({ page, page_size: 100 });
        total = res.total;
        all = all.concat(res.items.map((e: UsuarioListItem) => ({ id: e.id, nombre: e.nombre })));
        page++;
        if (res.items.length < 100) break;
      }
      all.sort((a, b) => a.nombre.localeCompare(b.nombre));
      state.empleados = all;
      state.empleadosLoaded = true;
    } catch { /* ignore */ }
  }

  function setSesionInstructorBlockVisible(el: Element | null, visible: boolean): void {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    if (visible) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function toggleSesionInstructorFields(tipo: string): void {
    const form = container.querySelector("[data-form='create-sesion']");
    if (!form) return;
    const showInterno = tipo === "interno";
    const showExterno = tipo === "externo";
    setSesionInstructorBlockVisible(form.querySelector("[data-sesion-instructor-placeholder]"), !showInterno && !showExterno);
    setSesionInstructorBlockVisible(form.querySelector("[data-sesion-instructor-interno]"), showInterno);
    setSesionInstructorBlockVisible(form.querySelector("[data-sesion-instructor-externo]"), showExterno);
  }

  async function loadInstructoresForSesionModal(): Promise<void> {
    state.instructoresCatalogLoading = true;
    render();
    try {
      const [internos, externos, proveedores] = await Promise.all([
        getInstructoresInternos({ page: 1, page_size: 200, solo_activos: true }),
        getInstructoresExternos({ page: 1, page_size: 200, solo_activos: true }),
        getProveedores({ page: 1, page_size: 200, solo_activos: true }),
      ]);
      state.instructoresInternos = internos.items;
      state.instructoresExternos = externos.items;
      state.proveedoresCatalog = proveedores.items;
    } catch {
      state.instructoresInternos = [];
      state.instructoresExternos = [];
      state.proveedoresCatalog = [];
    }
    state.instructoresCatalogLoading = false;
    render();
    toggleSesionInstructorFields(state.sesionModalTipo);
  }

  function renderSesionProveedorFields(): string {
    const loading = state.instructoresCatalogLoading;
    const disabled = loading ? " disabled" : "";
    let options = loading
      ? `<option value="" selected>Cargando proveedores…</option>`
      : `<option value="">— Sin proveedor —</option>`;
    if (!loading) {
      for (const p of state.proveedoresCatalog) {
        options += `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`;
      }
    }
    return `
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
        <select name="proveedor_id" data-sesion-proveedor-select class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}"${disabled}>
          ${options}
        </select>
        <button type="button" data-action="toggle-sesion-proveedor" class="mt-2 text-xs font-semibold text-[#1e40af] hover:underline">+ Crear nuevo proveedor</button>
        <div data-sesion-nuevo-proveedor class="hidden mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <label for="sesion-nuevo-proveedor-nombre" class="block text-xs font-medium text-slate-600">Nombre del proveedor</label>
          <input id="sesion-nuevo-proveedor-nombre" type="text" maxlength="255" data-sesion-nuevo-proveedor-nombre class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          <p data-sesion-nuevo-proveedor-error class="hidden text-xs text-red-700" role="alert"></p>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-action="save-sesion-nuevo-proveedor" class="${BTN_PRIMARY} text-xs">Guardar proveedor</button>
            <button type="button" data-action="cancel-sesion-proveedor" class="${BTN_SECONDARY} text-xs">Cancelar</button>
          </div>
        </div>
      </div>`;
  }

  // Panel "crear proveedor" de la sesión: manejado por DOM (sin render) para no
  // perder los datos ya escritos en el formulario de sesión. Devuelve true si
  // el click fue consumido.
  async function handleSesionProveedorClick(t: HTMLElement): Promise<boolean> {
    const form = container.querySelector<HTMLFormElement>("[data-form='create-sesion']");
    if (!form) return false;
    const panel = () => form.querySelector<HTMLElement>("[data-sesion-nuevo-proveedor]");
    const input = () => form.querySelector<HTMLInputElement>("[data-sesion-nuevo-proveedor-nombre]");
    const errEl = () => form.querySelector<HTMLElement>("[data-sesion-nuevo-proveedor-error]");

    if (t.closest("[data-action='toggle-sesion-proveedor']")) {
      const p = panel();
      p?.classList.toggle("hidden");
      if (p && !p.classList.contains("hidden")) input()?.focus();
      return true;
    }

    if (t.closest("[data-action='cancel-sesion-proveedor']")) {
      panel()?.classList.add("hidden");
      const i = input();
      if (i) i.value = "";
      errEl()?.classList.add("hidden");
      return true;
    }

    const saveBtn = t.closest<HTMLButtonElement>("[data-action='save-sesion-nuevo-proveedor']");
    if (saveBtn) {
      const err = errEl();
      const showErr = (msg: string) => { if (err) { err.textContent = msg; err.classList.remove("hidden"); } };
      const nombre = (input()?.value ?? "").trim();
      if (nombre.length < 2) { showErr("El nombre debe tener al menos 2 caracteres."); return true; }
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";
      try {
        const created = await createProveedor({ nombre });
        state.proveedoresCatalog = [...state.proveedoresCatalog, created]
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        const select = form.querySelector<HTMLSelectElement>("[data-sesion-proveedor-select]");
        if (select) {
          const opt = document.createElement("option");
          opt.value = String(created.id);
          opt.textContent = created.nombre;
          select.appendChild(opt);
          select.value = String(created.id);
        }
        panel()?.classList.add("hidden");
        const i = input();
        if (i) i.value = "";
        err?.classList.add("hidden");
      } catch (e: unknown) {
        showErr((e as { detail?: string }).detail ?? "No se pudo crear el proveedor.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar proveedor";
      }
      return true;
    }

    return false;
  }

  async function loadCursos() {
    try {
      state.cursos = await getCursos({
        page: state.page,
        page_size: 20,
        tipo: state.filters.tipo || undefined,
        clasificacion: state.filters.clasificacion || undefined,
        obligatorio: state.filters.obligatorio ? state.filters.obligatorio === "true" : undefined,
        categoria: state.filters.categoria || undefined,
        busqueda: state.filters.busqueda || undefined,
      });
    } catch {
      state.cursos = { items: [], total: 0, page: 1, page_size: 20 };
    }
  }

  function captureCursoModalDraft(): void {
    if (!state.showCreateModal && !state.editingCurso) return;
    const form = container.querySelector<HTMLFormElement>('form[data-action="submit-curso"]');
    if (!form) return;
    const fd = new FormData(form);
    state.cursoModalDraft = {
      nombre: String(fd.get("nombre") ?? ""),
      clasificacion_id: String(fd.get("clasificacion_id") ?? ""),
      tipo_id: String(fd.get("tipo_id") ?? ""),
      duracion_horas: String(fd.get("duracion_horas") ?? ""),
      categoria_id: String(fd.get("categoria_id") ?? ""),
      centro_costos: String(fd.get("centro_costos") ?? ""),
      descripcion: String(fd.get("descripcion") ?? ""),
      obligatorio: form.querySelector<HTMLInputElement>("[name='obligatorio']")?.checked ?? false,
    };
  }

  async function loadCursoModalCatalogos(): Promise<void> {
    state.proveedoresLoading = true;
    render();
    const params = { page: 1, page_size: 200, solo_activos: true };
    try {
      const [categorias, tipos, clasificaciones] = await Promise.all([
        getCategorias(params),
        getTipos(params),
        getClasificaciones(params),
      ]);
      state.categoriasCatalog = categorias.items;
      state.tiposCatalog = tipos.items;
      state.clasificacionesCatalog = clasificaciones.items;
    } catch {
      state.categoriasCatalog = [];
      state.tiposCatalog = [];
      state.clasificacionesCatalog = [];
    }
    state.proveedoresLoading = false;
    render();
  }

  function catalogItemLabel(nombre: string, labels: Record<string, string>): string {
    return labels[nombre] ?? nombre;
  }

  function renderCatalogSelect(
    name: string,
    items: CursoCatSimple[],
    selectedId: number | null | undefined,
    draftValue: string | undefined,
    labels: Record<string, string>,
    modalFieldCls: string,
    inactiveLabel: string | null | undefined,
  ): string {
    const selected = draftValue || (selectedId != null ? String(selectedId) : "");
    const matched = items.some((item) => String(item.id) === selected);
    const disabled = state.proveedoresLoading ? " disabled" : "";
    let options = state.proveedoresLoading
      ? `<option value="" selected>Cargando…</option>`
      : `<option value="">—</option>`;
    if (!state.proveedoresLoading) {
      for (const item of items) {
        const isSelected = String(item.id) === selected ? " selected" : "";
        options += `<option value="${item.id}"${isSelected}>${escapeHtml(catalogItemLabel(item.nombre, labels))}</option>`;
      }
      if (selected && !matched) {
        options += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(inactiveLabel ?? "Registro")} (inactivo)</option>`;
      }
    }
    return `<select name="${name}" class="${modalFieldCls}"${disabled}>${options}</select>`;
  }

  async function openCursoModal(curso: Curso | null): Promise<void> {
    if (curso) {
      state.editingCurso = curso;
      state.showCreateModal = false;
    } else {
      state.showCreateModal = true;
      state.editingCurso = null;
    }
    state.proveedoresCatalog = [];
    state.categoriasCatalog = [];
    state.tiposCatalog = [];
    state.clasificacionesCatalog = [];
    state.cursoModalDraft = null;
    render();
    await loadCursoModalCatalogos();
  }

  function closeCursoModal(): void {
    state.showCreateModal = false;
    state.editingCurso = null;
    state.proveedoresCatalog = [];
    state.categoriasCatalog = [];
    state.tiposCatalog = [];
    state.clasificacionesCatalog = [];
    state.proveedoresLoading = false;
    state.cursoModalDraft = null;
  }

  function cursoCatBadge(cat: string | null): string {
    if (!cat) return "";
    const colors: Record<string, { border: string; bg: string; text: string; dot: string }> = {
      tecnico: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", dot: "bg-blue-500" },
      calidad: { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-800", dot: "bg-sky-500" },
      seguridad: { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", dot: "bg-red-400" },
      operativo: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400" },
      blanda: { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500" },
    };
    const c = colors[cat] ?? { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
    const label = CATEGORIA_LABELS[cat] ?? cat;
    return `<span class="inline-flex items-center gap-1.5 rounded-full border ${c.border} ${c.bg} px-2 py-0.5 text-[11px] font-semibold ${c.text}"><span class="size-1.5 shrink-0 rounded-full ${c.dot}" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
  }

  function cursoTipoBadge(tipo: string | null): string {
    if (!tipo) return "";
    const isInterno = tipo === "interno";
    const cls = isInterno
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-purple-200 bg-purple-50 text-purple-800";
    return `<span class="inline-flex items-center rounded-full border ${cls} px-2 py-0.5 text-[10px] font-semibold">${TIPO_LABELS[tipo] ?? tipo}</span>`;
  }

  function kpiSkeletonCard(): string {
    return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="h-3 w-24 rounded bg-slate-200/90"></div>
      <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
      <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
    </article>`;
  }

  function renderCursosPageHeader(): string {
    return `
    <header class="cc-page-header flex flex-col gap-3">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Catálogo de cursos</h1>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Consulta, filtra y administra los cursos disponibles para capacitación y asignación a puestos.
          </p>
        </div>
        ${isRH ? `<button type="button" data-action="open-create-curso" class="${RH_LISTADO_BTN_PRIMARY} cc-btn-nueva w-full shrink-0 sm:w-auto sm:self-start">
          ${ICON_PLUS}<span>Nuevo curso</span>
        </button>` : ""}
      </div>
    </header>`;
  }

  function renderCursosLoading(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page" aria-busy="true" aria-label="Cargando catálogo de cursos">
      ${renderLevelUpBackBar()}
      <div class="h-6 w-56 animate-pulse rounded-md bg-slate-200/90"></div>
      <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
    </div>`;
  }

  function renderCursosKpis(): string {
    const total = state.cursos.total;
    const items = state.cursos.items;
    const obligatorios = items.filter(c => c.obligatorio).length;
    const internos = items.filter(c => c.tipo_nombre === "interno").length;
    const externos = items.filter(c => c.tipo_nombre === "externo").length;

    const kpis = [
      {
        label: "Total catálogo",
        value: String(total),
        sub: "Cursos registrados",
        icon: ICON_BOOK,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
      },
      {
        label: "Obligatorios",
        value: String(obligatorios),
        sub: "En la página actual",
        icon: ICON_SHIELD,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
      },
      {
        label: "Internos",
        value: String(internos),
        sub: "Impartidos en planta",
        icon: ICON_BUILDING,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
      },
      {
        label: "Externos",
        value: String(externos),
        sub: "Con proveedor externo",
        icon: ICON_GLOBE,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      },
    ];

    return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Resumen del catálogo">
      ${kpis.map((k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${k.value}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`).join("")}
    </div>`;
  }

  function hasActiveFilters(): boolean {
    return !!(state.filters.tipo || state.filters.clasificacion || state.filters.obligatorio || state.filters.categoria || state.filters.busqueda);
  }

  function renderFilterSection(): string {
    const total = state.cursos.total;
    const hasFilters = hasActiveFilters();
    const resultsLine = hasFilters
      ? `Mostrando <strong class="font-semibold text-text-primary tabular-nums">${total}</strong> cursos`
      : `<strong class="font-semibold text-text-primary tabular-nums">${total}</strong> cursos en catálogo`;

    return `
    <section class="${RH_LISTADO_SURFACE} cc-filters p-4 sm:p-5" aria-label="Filtros de cursos">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
          <p class="mt-0.5 text-xs text-text-muted">Localiza cursos por nombre, tipo, categoría o clasificación.</p>
        </div>
        <p class="text-xs text-text-muted" aria-live="polite">${resultsLine}</p>
      </div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3">
        <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
          <label for="cursos-search" class="${RH_LISTADO_LABEL}">Buscar</label>
          <div class="relative mt-1">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input id="cursos-search" data-action="cursos-search" type="search" autocomplete="off" placeholder="Nombre del curso…" value="${escapeHtml(state.filters.busqueda)}" class="${FILTER_INPUT_CLS}" />
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-tipo" class="${RH_LISTADO_LABEL}">Tipo</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-tipo" data-action="cursos-filter-tipo" class="${FILTER_SELECT_CLS}">
              <option value="">Todos los tipos</option>
              <option value="interno" ${state.filters.tipo === "interno" ? "selected" : ""}>Interno</option>
              <option value="externo" ${state.filters.tipo === "externo" ? "selected" : ""}>Externo</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-clasificacion" class="${RH_LISTADO_LABEL}">Clasificación</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-clasificacion" data-action="cursos-filter-clasificacion" class="${FILTER_SELECT_CLS}">
              <option value="">Todas</option>
              <option value="adicional" ${state.filters.clasificacion === "adicional" ? "selected" : ""}>Adicional</option>
              <option value="contemplado" ${state.filters.clasificacion === "contemplado" ? "selected" : ""}>Contemplado</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-categoria" class="${RH_LISTADO_LABEL}">Categoría</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-categoria" data-action="cursos-filter-categoria" class="${FILTER_SELECT_CLS}">
              <option value="">Todas</option>
              <option value="tecnico" ${state.filters.categoria === "tecnico" ? "selected" : ""}>Técnico</option>
              <option value="calidad" ${state.filters.categoria === "calidad" ? "selected" : ""}>Calidad</option>
              <option value="seguridad" ${state.filters.categoria === "seguridad" ? "selected" : ""}>Seguridad</option>
              <option value="operativo" ${state.filters.categoria === "operativo" ? "selected" : ""}>Operativo</option>
              <option value="blanda" ${state.filters.categoria === "blanda" ? "selected" : ""}>Blanda</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-obligatorio" class="${RH_LISTADO_LABEL}">Obligatorio</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-obligatorio" data-action="cursos-filter-obligatorio" class="${FILTER_SELECT_CLS}">
              <option value="">Todos</option>
              <option value="true" ${state.filters.obligatorio === "true" ? "selected" : ""}>Sí</option>
              <option value="false" ${state.filters.obligatorio === "false" ? "selected" : ""}>No</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        ${hasFilters ? `
        <div class="w-full shrink-0 sm:w-auto xl:ml-1">
          <button type="button" data-action="cursos-clear-filters" class="${RH_LISTADO_BTN_GHOST} w-full text-xs sm:w-auto">Limpiar filtros</button>
        </div>` : ""}
      </div>
    </section>`;
  }

  function renderCursoCard(c: Curso): string {
    const horas = c.duracion_horas != null ? `${c.duracion_horas}h` : "—";
    return `
    <article class="cc-curso-card flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition hover:border-slate-300/90 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          ${cursoCatBadge(c.categoria_nombre)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
        </div>
        ${cursoTipoBadge(c.tipo_nombre)}
      </div>
      <div class="min-w-0 flex-1">
        <button data-action="view-curso" data-id="${c.id}" class="text-left text-sm font-semibold leading-snug text-text-primary line-clamp-2 transition hover:text-leoni-blue hover:underline">${escapeHtml(c.nombre)}</button>
        <p class="mt-1.5 text-xs text-text-muted">${horas}${c.cupo_max ? ` · cupo ${c.cupo_max}` : ""}</p>
      </div>
      ${c.instructor_nombre ? `
      <div class="flex items-center gap-2">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${c.instructor_nombre.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
        <span class="truncate text-xs text-slate-600">${escapeHtml(c.instructor_nombre)}</span>
      </div>` : ""}
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px]">
        <span class="text-slate-500">${CLASIFICACION_LABELS[c.clasificacion_nombre ?? ""] ?? "—"}</span>
        ${isRH ? `
        <div class="flex shrink-0 items-center gap-2">
          <button data-action="edit-curso" data-id="${c.id}" class="${RH_LISTADO_BTN_GHOST} !px-2 !py-1 text-xs">Editar</button>
          <button data-action="delete-curso" data-id="${c.id}" class="text-xs font-semibold text-red-600 transition hover:text-red-800">Eliminar</button>
        </div>` : ""}
      </div>
    </article>`;
  }

  function renderEmptyState(): string {
    const hasFilters = hasActiveFilters();
    return `
    <div class="${RH_LISTADO_SURFACE} cc-empty px-6 py-14 text-center">
      ${ICON_CLIPBOARD_EMPTY}
      <p class="mt-4 text-base font-semibold text-text-primary">${hasFilters ? "Sin resultados" : "Catálogo vacío"}</p>
      <p class="mt-2 text-sm text-text-secondary">${hasFilters ? "Prueba ajustando los filtros de búsqueda." : "Aún no hay cursos registrados en el catálogo."}</p>
      ${hasFilters ? `<button type="button" data-action="cursos-clear-filters" class="${RH_LISTADO_BTN_GHOST} mx-auto mt-5 text-xs">Limpiar filtros</button>` : isRH ? `<button type="button" data-action="open-create-curso" class="${RH_LISTADO_BTN_PRIMARY} cc-btn-nueva mx-auto mt-6">${ICON_PLUS}<span>Crear primer curso</span></button>` : ""}
    </div>`;
  }

  function renderPagination(): string {
    const pageSize = state.cursos.page_size || 20;
    const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
    if (totalPages <= 1 && state.cursos.total <= pageSize) return "";

    const from = (state.page - 1) * pageSize + 1;
    const to = Math.min(state.page * pageSize, state.cursos.total);

    const pageButtons = paginationRange(totalPages, state.page)
      .map((x) => {
        if (x === "ellipsis") {
          return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
        }
        const active = x === state.page;
        const cls = active
          ? "cc-page-btn cc-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
          : "cc-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
        return `<button type="button" data-action="cursos-goto-page" data-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
      })
      .join("");

    return `
    <footer class="cc-table-footer flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${state.cursos.total}</span>
      </p>
      <nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación del catálogo">
        <button type="button" data-action="cursos-prev" ${state.page <= 1 ? "disabled" : ""}
          class="cc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página anterior</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
        </button>
        ${pageButtons}
        <button type="button" data-action="cursos-next" ${state.page >= totalPages ? "disabled" : ""}
          class="cc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página siguiente</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
        </button>
      </nav>
    </footer>`;
  }

  function renderCreateEditModal(): string {
    const c = state.editingCurso;
    const d = state.cursoModalDraft;
    const isEdit = !!c;
    const title = isEdit ? "Editar curso" : "Nuevo curso";
    const subtitle = isEdit
      ? "Los cambios se reflejan en el catálogo y en las asignaciones existentes."
      : "Registra un curso reutilizable para sesiones y asignación a puestos.";
    const modalFieldCls = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

    return `
    <div id="curso-modal-backdrop" data-action="close-curso-modal" class="cc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div data-modal-inner class="cc-modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="curso-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h2 id="curso-modal-title" class="text-lg font-semibold text-text-primary">${title}</h2>
          <p class="mt-1 text-sm text-text-muted">${subtitle}</p>
        </div>
        <form data-action="submit-curso" class="flex flex-col gap-4 px-6 py-5">
          <div>
            <label class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600" aria-hidden="true">*</span></label>
            <input type="text" name="nombre" required value="${escapeHtml(d?.nombre ?? c?.nombre ?? "")}" class="${modalFieldCls}" />
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Clasificación</label>
            ${renderCatalogSelect(
              "clasificacion_id",
              state.clasificacionesCatalog,
              c?.clasificacion_id,
              d?.clasificacion_id,
              CLASIFICACION_LABELS,
              modalFieldCls,
              c?.clasificacion_nombre ? catalogItemLabel(c.clasificacion_nombre, CLASIFICACION_LABELS) : null,
            )}
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Tipo</label>
            ${renderCatalogSelect(
              "tipo_id",
              state.tiposCatalog,
              c?.tipo_id,
              d?.tipo_id,
              TIPO_LABELS,
              modalFieldCls,
              c?.tipo_nombre ? catalogItemLabel(c.tipo_nombre, TIPO_LABELS) : null,
            )}
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Duración (horas)</label>
              <input type="number" name="duracion_horas" step="0.5" min="0.5" value="${d?.duracion_horas ?? c?.duracion_horas ?? ""}" class="${modalFieldCls}" />
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Categoría</label>
              ${renderCatalogSelect(
                "categoria_id",
                state.categoriasCatalog,
                c?.categoria_id,
                d?.categoria_id,
                CATEGORIA_LABELS,
                modalFieldCls,
                c?.categoria_nombre ? catalogItemLabel(c.categoria_nombre, CATEGORIA_LABELS) : null,
              )}
            </div>
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Centro de costos</label>
            <input type="number" name="centro_costos" value="${d?.centro_costos ?? c?.centro_costos ?? ""}" class="${modalFieldCls}" />
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea name="descripcion" rows="3" class="${modalFieldCls}">${escapeHtml(d?.descripcion ?? c?.descripcion ?? "")}</textarea>
          </div>
          <div class="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <input type="checkbox" name="obligatorio" id="curso-obligatorio" ${(d?.obligatorio ?? c?.obligatorio) ? "checked" : ""} class="mt-0.5 size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            <div>
              <label for="curso-obligatorio" class="text-sm font-medium text-text-primary">Obligatorio</label>
              <p class="mt-0.5 text-xs text-text-muted">Marca el curso como requisito obligatorio para los puestos asignados.</p>
            </div>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="close-curso-modal" class="${BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto">${isEdit ? "Guardar cambios" : "Crear curso"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderDetailPuestos(): string {
    const puestos = state.detailPuestos;
    const hasSesiones = state.detailSesiones.length > 0;
    const totalEmps = puestos.reduce((s, p) => s + p.empleados_count, 0);

    const puestoBlocks = puestos.map((p) => {
      const puestoEmpIds = p.empleados.map((e) => e.empleado_id);
      const allSelected = puestoEmpIds.length > 0 && puestoEmpIds.every((id) => state.selectedEmpleados.has(id));
      const isExpanded = state.expandedPuestos.has(p.id);

      const empRows = p.empleados.length > 0
        ? p.empleados.map((e) => {
          const checked = state.selectedEmpleados.has(e.empleado_id);
          return `
          <li class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            ${hasSesiones && isRH ? `<input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">${escapeHtml((e.nombre ?? "?").slice(0, 2).toUpperCase())}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(e.nombre ?? `#${e.empleado_id}`)}</span>
            ${e.no_empleado ? `<span class="text-xs text-slate-400 tabular-nums">No. ${escapeHtml(e.no_empleado)}</span>` : ""}
          </li>`;
        }).join("")
        : `<li class="text-xs text-slate-400 italic py-1">Sin empleados activos en este puesto</li>`;

      return `
      <div class="border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between px-5 py-3 bg-slate-50/50 cursor-pointer" data-action="toggle-puesto-expand" data-puesto-id="${p.id}">
          <div class="flex items-center gap-2 min-w-0">
            ${hasSesiones && isRH && puestoEmpIds.length > 0 ? `<input type="checkbox" data-action="toggle-puesto" data-puesto-emps='${JSON.stringify(puestoEmpIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <svg class="size-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            <a href="#/puestos/${p.puesto_perfil_id}" class="text-sm font-semibold text-leoni-blue hover:underline truncate">${escapeHtml(p.puesto_nombre ?? `Puesto #${p.puesto_perfil_id}`)}</a>
            ${p.puesto_codigo ? `<span class="text-xs text-slate-400 shrink-0">${escapeHtml(p.puesto_codigo)}</span>` : ""}
            ${p.obligatorio ? `<span class="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70 shrink-0">Obligatorio</span>` : ""}
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-xs text-slate-500 tabular-nums">${p.empleados_count} empleado${p.empleados_count !== 1 ? "s" : ""}</span>
            ${isRH ? `<button data-action="quitar-puesto" data-curso-puesto-id="${p.id}" class="text-xs text-red-600 hover:underline">Quitar</button>` : ""}
          </div>
        </div>
        ${isExpanded ? `<ul class="px-5 py-2">${empRows}</ul>` : ""}
      </div>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-text-primary">Puestos asignados</h3>
          <p class="text-xs text-slate-500 mt-0.5">${puestos.length === 0 ? "Sin puestos asignados" : `${puestos.length} puesto${puestos.length !== 1 ? "s" : ""} · ${totalEmps} empleado${totalEmps !== 1 ? "s" : ""} en total`}</p>
        </div>
        ${isRH ? `<button data-action="open-asignacion-puestos" class="${BTN_SECONDARY} text-xs">+ Asignar puesto</button>` : ""}
      </div>
      ${puestoBlocks}
    </div>`;
  }

  function renderDetailEmpleadosExtra(): string {
    const emps = state.detailEmpleadosExtra;
    const hasSesiones = state.detailSesiones.length > 0;
    const allExtraIds = emps.map((e) => e.empleado_id);
    const allSelected = allExtraIds.length > 0 && allExtraIds.every((id) => state.selectedEmpleados.has(id));

    const rows = emps.map((e) => {
      const checked = state.selectedEmpleados.has(e.empleado_id);
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60">
        ${hasSesiones && isRH ? `<td class="px-4 py-2.5"><input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" /></td>` : ""}
        <td class="px-4 py-2.5 text-sm font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? `Empleado #${e.empleado_id}`)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-500 tabular-nums">${escapeHtml(e.no_empleado ?? "—")}</td>
        ${isRH ? `<td class="px-4 py-2.5 text-right"><button data-action="quitar-extra" data-curso-empleado-id="${e.id}" class="text-xs text-red-600 hover:underline">Quitar</button></td>` : ""}
      </tr>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0 cursor-pointer" data-action="toggle-extras-expand">
          <svg class="size-4 text-slate-400 transition-transform shrink-0 ${state.expandedExtras ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          <div>
            <h3 class="text-sm font-semibold text-text-primary">Empleados extra (individuales)</h3>
            <p class="text-xs text-slate-500 mt-0.5">${emps.length === 0 ? "Sin empleados asignados individualmente" : `${emps.length} empleado${emps.length !== 1 ? "s" : ""} asignado${emps.length !== 1 ? "s" : ""}`}</p>
          </div>
        </div>
        ${isRH ? `<button data-action="open-asignacion-extras" class="${BTN_SECONDARY} text-xs shrink-0">+ Asignar empleado</button>` : ""}
      </div>
      ${state.expandedExtras && emps.length > 0 ? `
      <table class="w-full text-left">
        <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            ${hasSesiones && isRH ? `<th class="px-4 py-2.5 w-10"><input type="checkbox" data-action="toggle-all-extras" data-extra-emps='${JSON.stringify(allExtraIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" /></th>` : ""}
            <th class="px-4 py-2.5">Empleado</th>
            <th class="px-4 py-2.5">No. Empleado</th>
            ${isRH ? `<th class="px-4 py-2.5 text-right">Acciones</th>` : ""}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : ""}
    </div>`;
  }

  function renderDetailView(): string {
    const c = state.detailCurso!;
    const horas = c.duracion_horas ? `${c.duracion_horas}h` : "—";

    function field(label: string, value: string | null | undefined): string {
      return `
      <div>
        <dt class="text-xs font-medium text-slate-500 uppercase tracking-wide">${escapeHtml(label)}</dt>
        <dd class="mt-1 text-sm text-text-primary">${escapeHtml(value || "—")}</dd>
      </div>`;
    }

    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page cc-detail">
      ${renderLevelUpBackBar()}
      <div class="flex flex-col gap-5">
      <h2 class="min-w-0 text-xl font-bold tracking-tight text-text-primary sm:text-2xl truncate">${escapeHtml(c.nombre)}</h2>

      <div class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          ${cursoCatBadge(c.categoria_nombre)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
          <span class="ml-auto text-xs text-slate-500">ID: ${c.id}</span>
        </div>

        <div class="p-6">
          <dl class="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            ${field("Nombre", c.nombre)}
            ${field("Categoría", CATEGORIA_LABELS[c.categoria_nombre ?? ""] ?? c.categoria_nombre)}
            ${field("Clasificación", CLASIFICACION_LABELS[c.clasificacion_nombre ?? ""] ?? c.clasificacion_nombre)}
            ${field("Duración", horas)}
            ${field("Cupo máximo", c.cupo_max ? String(c.cupo_max) : null)}
            ${field("Modalidad", c.modalidad)}
            ${field("Sesiones / año", c.sesiones_anio ? String(c.sesiones_anio) : null)}
            ${field("Centro de costos", c.centro_costos ? String(c.centro_costos) : null)}
            ${field("Obligatorio", c.obligatorio ? "Sí" : "No")}
            ${field("Activo", c.activo ? "Sí" : "No")}
            ${field("Calificación promedio", c.calificacion_promedio != null ? `${c.calificacion_promedio.toFixed(1)} / 5` : "Sin evaluaciones")}
            ${field("Evaluaciones", String(c.total_evaluaciones))}
          </dl>
        </div>

        ${c.descripcion || c.requisitos ? `
        <div class="border-t border-slate-100 p-6 space-y-5">
          ${c.descripcion ? `
          <div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Descripción</h3>
            <p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(c.descripcion)}</p>
          </div>` : ""}
          ${c.requisitos ? `
          <div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Requisitos</h3>
            <p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(c.requisitos)}</p>
          </div>` : ""}
        </div>` : ""}

        <div class="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <span class="text-xs text-slate-400">Creado: ${new Date(c.created_at).toLocaleDateString("es-MX")} · Actualizado: ${new Date(c.updated_at).toLocaleDateString("es-MX")}</span>
          ${isRH ? `
          <div class="flex items-center gap-3">
            <button data-action="edit-curso" data-id="${c.id}" class="${BTN_SECONDARY} text-xs">Editar</button>
            <button data-action="delete-curso" data-id="${c.id}" class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition">Eliminar</button>
          </div>` : ""}
        </div>
      </div>

      ${renderDetailSesiones()}
      ${renderDetailEncuestas()}
      ${renderDetailAreas()}
      ${renderDetailPuestos()}
      ${renderDetailEmpleadosExtra()}
      ${renderSelectionBar()}
      ${state.showAssignSesionPicker ? renderAssignSesionPicker() : ""}
      ${state.showAsignacionMasivaModal ? renderAsignacionMasivaModal() : ""}
      ${state.showAsignacionPuestosModal ? renderAsignacionPuestosModal() : ""}
      ${state.showAsignacionExtrasModal ? renderAsignacionExtrasModal() : ""}
      </div>
    </div>`;
  }

  function renderDetailEncuestas(): string {
    const header = `
      <div class="flex flex-col gap-1 border-b border-slate-100 px-6 py-4">
        <h3 class="text-base font-semibold text-text-primary">Encuestas post curso</h3>
        <p class="text-xs text-text-muted">Resultados consolidados y comparativo por sesión.</p>
      </div>`;

    if (state.detailDataLoading && !state.detailEncuestas) {
      return `<div class="${RH_LISTADO_SURFACE} overflow-hidden">${header}<div class="p-6"><div class="h-24 animate-pulse rounded-lg bg-slate-100"></div></div></div>`;
    }

    const r = state.detailEncuestas;
    if (!r || r.total_evaluaciones === 0) {
      return `<div class="${RH_LISTADO_SURFACE} overflow-hidden">${header}
        <div class="px-6 py-10 text-center">
          <p class="text-sm font-semibold text-text-primary">Sin evaluaciones todavía</p>
          <p class="mt-1 text-xs text-text-muted">Aún no hay encuestas respondidas para este curso.</p>
        </div>
      </div>`;
    }

    const resumenChips = `
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${[
          { label: "Promedio general", value: encFmtScore(r.calificacion_promedio) },
          { label: "Instructor", value: encFmtScore(r.promedio_instructor) },
          { label: "Contenido", value: encFmtScore(r.promedio_contenido) },
          { label: "Aplicabilidad", value: encFmtScore(r.promedio_aplicabilidad) },
        ].map((k) => `
          <div class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p class="text-[11px] font-medium text-text-muted">${escapeHtml(k.label)}</p>
            <p class="mt-0.5 text-xl font-bold tabular-nums text-text-primary">${k.value}<span class="text-xs font-medium text-slate-400">/5</span></p>
          </div>`).join("")}
      </div>`;

    const totalDist = r.distribucion.reduce((acc, item) => acc + item.cantidad, 0);
    const distByScore = new Map<number, number>();
    for (const item of r.distribucion) distByScore.set(item.score, item.cantidad);
    const distribucion = `
      <div class="flex flex-col gap-2">
        <p class="text-xs font-semibold text-text-primary">Distribución de respuestas</p>
        ${[5, 4, 3, 2, 1].map((star) => {
          const count = distByScore.get(star) ?? 0;
          const pct = totalDist > 0 ? Math.round((count / totalDist) * 100) : 0;
          return `
          <div class="flex items-center gap-2.5">
            <span class="w-3 text-right text-xs font-semibold tabular-nums text-slate-700">${star}</span>
            <div class="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${ENC_DIST_COLORS[star]}" style="width: ${pct}%"></div></div>
            <span class="w-8 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-700">${count}</span>
          </div>`;
        }).join("")}
      </div>`;

    const sesionesRows = r.sesiones.map((s) => {
      const fecha = s.fecha_sesion
        ? new Date(s.fecha_sesion + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
        : "—";
      const badge = ESTADO_ENCUESTA_BADGE[s.estado_efectivo];
      const tasa = Math.round(s.tasa_participacion * 100);
      return `
      <tr class="border-t border-slate-100">
        <td class="px-3 py-2.5 text-xs text-slate-700">${escapeHtml(fecha)}</td>
        <td class="px-3 py-2.5"><span class="inline-flex items-center rounded-full border ${badge} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(ESTADO_ENCUESTA_LABELS[s.estado_efectivo])}</span></td>
        <td class="px-3 py-2.5 text-center text-xs tabular-nums text-slate-700">${s.respondidas}/${s.total_asistentes}</td>
        <td class="px-3 py-2.5 text-center text-xs tabular-nums text-slate-700">${tasa}%</td>
        <td class="px-3 py-2.5 text-center">${s.promedio_general != null ? encScorePill(s.promedio_general) : `<span class="text-[10px] text-slate-400">—</span>`}</td>
        <td class="px-3 py-2.5 text-center text-xs tabular-nums text-slate-600">${encFmtScore(s.promedio_instructor)}</td>
        <td class="px-3 py-2.5 text-center text-xs tabular-nums text-slate-600">${encFmtScore(s.promedio_contenido)}</td>
        <td class="px-3 py-2.5 text-center text-xs tabular-nums text-slate-600">${encFmtScore(s.promedio_aplicabilidad)}</td>
      </tr>`;
    }).join("");

    const sesionesTabla = r.sesiones.length === 0 ? "" : `
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sesión</th>
              <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Encuesta</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resp./Asist.</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Participación</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">General</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Instr.</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Conten.</th>
              <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aplic.</th>
            </tr>
          </thead>
          <tbody>${sesionesRows}</tbody>
        </table>
      </div>`;

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      ${header}
      <div class="flex flex-col gap-5 p-6">
        <p class="text-xs text-text-muted">${r.total_evaluaciones} ${r.total_evaluaciones === 1 ? "evaluación recibida" : "evaluaciones recibidas"}.</p>
        ${resumenChips}
        ${distribucion}
      </div>
      ${sesionesTabla ? `<div class="border-t border-slate-100">${sesionesTabla}</div>` : ""}
    </div>`;
  }

  function renderDetailAreas(): string {
    const areas = state.detailAreas;
    const hasSesiones = state.detailSesiones.length > 0;

    const totalEmps = areas.reduce((s, a) => s + a.empleados_count, 0);

    const areaBlocks = areas.map((a) => {
      const areaEmpIds = a.empleados.map((e) => e.empleado_id);
      const allSelected = areaEmpIds.length > 0 && areaEmpIds.every((id) => state.selectedEmpleados.has(id));
      const isExpanded = state.expandedAreas.has(a.id);

      const empRows = a.empleados.length > 0
        ? a.empleados.map((e) => {
          const checked = state.selectedEmpleados.has(e.empleado_id);
          return `
          <li class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            ${hasSesiones && isRH ? `<input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">${escapeHtml((e.nombre ?? "?").slice(0, 2).toUpperCase())}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(e.nombre ?? `#${e.empleado_id}`)}</span>
            ${e.no_empleado ? `<span class="text-xs text-slate-400 tabular-nums">No. ${escapeHtml(e.no_empleado)}</span>` : ""}
          </li>`;
        }).join("")
        : `<li class="text-xs text-slate-400 italic py-1">Sin empleados en esta área</li>`;

      return `
      <div class="border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between px-5 py-3 bg-slate-50/50 cursor-pointer" data-action="toggle-area-expand" data-area-id="${a.id}">
          <div class="flex items-center gap-2">
            ${hasSesiones && isRH && areaEmpIds.length > 0 ? `<input type="checkbox" data-action="toggle-puesto" data-puesto-emps='${JSON.stringify(areaEmpIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <svg class="size-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            <span class="text-sm font-semibold text-text-primary">${escapeHtml(a.nombre)}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-500 tabular-nums">${a.empleados_count} empleado${a.empleados_count !== 1 ? "s" : ""}</span>
            ${isRH ? `<button data-action="quitar-area" data-area-id="${a.id}" class="text-xs text-red-600 hover:underline">Quitar</button>` : ""}
          </div>
        </div>
        ${isExpanded ? `<ul class="px-5 py-2">${empRows}</ul>` : ""}
      </div>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-text-primary">Áreas asignadas</h3>
          <p class="text-xs text-slate-500 mt-0.5">${areas.length === 0 ? "Sin áreas asignadas" : `${areas.length} área${areas.length !== 1 ? "s" : ""} · ${totalEmps} empleado${totalEmps !== 1 ? "s" : ""} en total`}</p>
        </div>
        ${isRH ? `<button data-action="open-asignacion-areas" class="${BTN_SECONDARY} text-xs">+ Asignar área</button>` : ""}
      </div>
      ${areaBlocks}
    </div>`;
  }

  function renderAsignacionMasivaModal(): string {
    const cat = state.asignacionCatalogos;
    const assignedIds = new Set(state.detailAreas.map((a) => a.referencia_id));
    const disponibles = cat?.areas.filter((a) => !assignedIds.has(a.id)) ?? [];
    const selectedCount = state.asignacionAreaIds.size;

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="asignacion-areas">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-text-primary">Asignar áreas al curso</h3>
          <button data-action="close-asignacion-areas" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${state.asignacionCatalogosLoading ? `<p class="text-xs text-slate-400 text-center py-6">Cargando áreas...</p>` :
          !cat ? `<p class="text-xs text-red-500 text-center py-6">Error al cargar áreas.</p>` : `
        <div class="space-y-4">
          <p class="text-xs text-slate-500">Selecciona una o más áreas. Todos los empleados de cada área quedarán vinculados al curso de forma dinámica.</p>
          ${disponibles.length === 0 ? `
            <p class="text-sm text-slate-500 text-center py-4">Todas las áreas disponibles ya están asignadas a este curso.</p>
          ` : `
          <div class="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-slate-200 p-3">
            ${disponibles.map((a) => `
              <label class="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" data-action="toggle-asignacion-area" data-area-ref-id="${a.id}" ${state.asignacionAreaIds.has(a.id) ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span class="text-sm text-text-primary">${escapeHtml(a.descripcion)}</span>
              </label>
            `).join("")}
          </div>
          <button type="button" data-action="confirmar-asignacion-areas" class="${BTN_PRIMARY} w-full text-sm" ${selectedCount === 0 || state.asignacionLoading ? "disabled" : ""}>
            ${state.asignacionLoading ? "Asignando…" : `Asignar ${selectedCount > 0 ? `${selectedCount} área${selectedCount !== 1 ? "s" : ""}` : "áreas"}`}
          </button>`}
          ${state.asignacionResult ? `
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ${state.asignacionResult.asignados} área${state.asignacionResult.asignados !== 1 ? "s" : ""} asignada${state.asignacionResult.asignados !== 1 ? "s" : ""} correctamente.
            </div>` : ""}
          ${state.asignacionError ? `
            <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              ${escapeHtml(state.asignacionError)}
            </div>` : ""}
        </div>`}
      </div>
    </div>`;
  }

  function renderAsignacionPuestosModal(): string {
    const catalog = state.asignacionPuestosCatalog;
    const assignedIds = new Set(state.detailPuestos.map((p) => p.puesto_perfil_id));
    const disponibles = catalog?.filter((p) => !assignedIds.has(p.id)) ?? [];
    const selectedCount = state.asignacionPuestoIds.size;

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="asignacion-puestos">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-text-primary">Asignar puestos al curso</h3>
          <button data-action="close-asignacion-puestos" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${state.asignacionPuestosCatalogLoading ? `<p class="text-xs text-slate-400 text-center py-6">Cargando puestos...</p>` :
          !catalog ? `<p class="text-xs text-red-500 text-center py-6">Error al cargar puestos.</p>` : `
        <div class="space-y-4">
          <p class="text-xs text-slate-500">Selecciona uno o más perfiles de puesto. Todos los empleados activos de cada puesto quedarán vinculados al curso.</p>
          ${catalog.length === 0 ? `
            <p class="text-sm text-slate-500 text-center py-4">No hay perfiles de puesto registrados en el sistema.</p>
          ` : disponibles.length === 0 ? `
            <p class="text-sm text-slate-500 text-center py-4">Todos los perfiles de puesto ya están asignados a este curso.</p>
          ` : `
          <div class="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-slate-200 p-3">
            ${disponibles.map((p) => `
              <label class="flex items-start gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" data-action="toggle-asignacion-puesto" data-puesto-perfil-id="${p.id}" ${state.asignacionPuestoIds.has(p.id) ? "checked" : ""} class="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-text-primary">${escapeHtml(p.nombre)}</span>
                  <span class="block text-xs text-slate-500">${escapeHtml(p.codigo)}${p.area_nombre ? ` · ${escapeHtml(p.area_nombre)}` : ""}</span>
                </span>
              </label>
            `).join("")}
          </div>
          <button type="button" data-action="confirmar-asignacion-puestos" class="${BTN_PRIMARY} w-full text-sm" ${selectedCount === 0 || state.asignacionPuestosLoading ? "disabled" : ""}>
            ${state.asignacionPuestosLoading ? "Asignando…" : `Asignar ${selectedCount > 0 ? `${selectedCount} puesto${selectedCount !== 1 ? "s" : ""}` : "puestos"}`}
          </button>`}
          ${state.asignacionPuestosResult ? `
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ${state.asignacionPuestosResult.asignados} puesto${state.asignacionPuestosResult.asignados !== 1 ? "s" : ""} asignado${state.asignacionPuestosResult.asignados !== 1 ? "s" : ""} correctamente.
            </div>` : ""}
          ${state.asignacionPuestosError ? `
            <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              ${escapeHtml(state.asignacionPuestosError)}
            </div>` : ""}
        </div>`}
      </div>
    </div>`;
  }

  function renderAsignacionExtrasModal(): string {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="asignacion-extras">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-text-primary">Asignar empleado al curso</h3>
          <button data-action="close-asignacion-extras" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="space-y-4">
          <p class="text-xs text-slate-500">Busca un empleado activo que no esté ya vinculado por puesto ni asignado individualmente.</p>
          <div>
            <label for="search-extra-elegible-input" class="${RH_LISTADO_LABEL}">Buscar empleado</label>
            <div class="relative mt-1">
              <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
              <input id="search-extra-elegible-input" type="text" data-action="search-extra-elegible" autocomplete="off" placeholder="Nombre o número de empleado…"
                value="${escapeHtml(state.extraSearchQuery)}"
                class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
            </div>
          </div>
          <div class="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1">
            ${state.extraSearchLoading ? `<p class="py-6 text-center text-xs text-slate-400">Buscando...</p>` :
              state.extraSearchResults.length === 0 && state.extraSearchQuery.trim().length >= 2 ? `<p class="py-6 text-center text-xs text-slate-400">Sin resultados.</p>` :
              state.extraSearchQuery.trim().length < 2 ? `<p class="py-6 text-center text-xs text-slate-400">Escribe al menos 2 caracteres.</p>` :
              state.extraSearchResults.map((emp) => `
                <button type="button" data-action="asignar-empleado-extra" data-empleado-id="${emp.id}" class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-white">
                  <div class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-text-primary">${escapeHtml(emp.nombre ?? "—")}</span>
                    <span class="text-xs text-slate-400">#${escapeHtml(emp.no_empleado ?? "")}</span>
                  </div>
                </button>`).join("")}
          </div>
          ${state.asignacionExtrasError ? `
            <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              ${escapeHtml(state.asignacionExtrasError)}
            </div>` : ""}
        </div>
      </div>
    </div>`;
  }

  function renderSelectionBar(): string {
    const count = state.selectedEmpleados.size;
    if (count === 0 || state.detailSesiones.length === 0 || !isRH) return "";
    return `
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 shadow-lg">
      <span class="text-sm font-medium text-blue-900">${count} empleado${count !== 1 ? "s" : ""} seleccionado${count !== 1 ? "s" : ""}</span>
      <button data-action="open-assign-sesion-picker" class="${BTN_PRIMARY} text-sm">Asignar a sesión</button>
      <button data-action="clear-selection" class="text-xs text-slate-600 hover:text-slate-900">Cancelar</button>
    </div>`;
  }

  function renderAssignSesionPicker(): string {
    const sesiones = state.detailSesiones.filter(s => s.estado === "programada" || s.estado === "en_curso");
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="assign-sesion">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-semibold text-text-primary mb-1">Asignar a sesión</h3>
        <p class="text-xs text-slate-500 mb-4">${state.selectedEmpleados.size} empleado${state.selectedEmpleados.size !== 1 ? "s" : ""} seleccionado${state.selectedEmpleados.size !== 1 ? "s" : ""}</p>
        ${sesiones.length === 0 ? `<p class="text-sm text-slate-400 italic">No hay sesiones activas disponibles.</p>` : `
        <div class="space-y-2 max-h-60 overflow-y-auto">
          ${sesiones.map(s => {
            const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
            const hora = s.hora_inicio ? ` ${s.hora_inicio.slice(0, 5)}` : "";
            const cupo = s.inscritos_count ? ` (${s.inscritos_count})` : "";
            return `
            <button data-action="assign-to-sesion" data-sesion-id="${s.id}" class="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50/50 transition">
              <div>
                <span class="text-sm font-medium text-text-primary">${escapeHtml(fecha)}${escapeHtml(hora)}</span>
                ${s.ubicacion ? `<span class="text-xs text-slate-500 ml-2">${escapeHtml(s.ubicacion)}</span>` : ""}
              </div>
              <span class="text-xs text-slate-400 tabular-nums">${escapeHtml(cupo)}</span>
            </button>`;
          }).join("")}
        </div>`}
        <div class="flex justify-end mt-4">
          <button data-action="close-assign-sesion-picker" class="${BTN_SECONDARY} text-xs">Cancelar</button>
        </div>
      </div>
    </div>`;
  }

  function renderDetailSesiones(): string {
    const sesiones = state.detailSesiones.filter((s) => s.estado !== "cancelada");
    const cursoId = state.detailCurso?.id;

    if (state.detailDataLoading) {
      return `
      <div class="${RH_LISTADO_SURFACE} p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Sesiones programadas</h3>
        <p class="text-xs text-slate-400 italic">Cargando sesiones…</p>
      </div>`;
    }

    if (sesiones.length === 0 && !isRH) {
      return `
      <div class="${RH_LISTADO_SURFACE} p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Sesiones programadas</h3>
        <p class="text-xs text-slate-400 italic">Sin sesiones programadas para este curso.</p>
      </div>`;
    }

    const estadoCls = (e: string) =>
      e === "completada" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
      e === "cancelada" ? "border-red-200 bg-red-50 text-red-800" :
      e === "en_curso" ? "border-blue-200 bg-blue-50 text-blue-800" :
      "border-slate-200 bg-slate-50 text-slate-700";

    const rows = sesiones.map(s => {
      const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
      const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : "—";
      const cupo = `${s.inscritos_count}`;
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
        <td class="px-4 py-2.5 text-sm font-medium text-text-primary cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">${escapeHtml(fecha)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">${escapeHtml(horario)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">${s.tipo ? escapeHtml(s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1)) : "—"}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">${escapeHtml(s.ubicacion ?? "—")}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">${escapeHtml(s.instructor_nombre ?? "—")}</td>
        <td class="px-4 py-2.5 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">
          <span class="text-sm tabular-nums text-blue-600 font-medium">${cupo}</span>
        </td>
        <td class="px-4 py-2.5 cursor-pointer" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">
          <span class="inline-flex items-center rounded-full border ${estadoCls(s.estado)} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(ESTADO_SESION_LABELS[s.estado] ?? s.estado)}</span>
        </td>
        ${isRH ? `<td class="px-4 py-2.5"><button type="button" data-action="delete-sesion" data-action-stop data-curso-id="${cursoId}" data-sesion-id="${s.id}" class="text-xs text-red-600 hover:underline">Eliminar</button></td>` : ""}
      </tr>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-text-primary">Sesiones programadas</h3>
          <p class="text-xs text-slate-500 mt-0.5">${sesiones.length} sesión${sesiones.length !== 1 ? "es" : ""}</p>
        </div>
        ${isRH ? `<button data-action="open-create-sesion" class="${BTN_PRIMARY} text-xs">+ Crear sesión</button>` : ""}
      </div>
      ${sesiones.length === 0 ? `<p class="px-6 py-4 text-xs text-slate-400 italic">Sin sesiones programadas. Crea una para comenzar.</p>` : `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-2.5">Fecha</th>
              <th class="px-4 py-2.5">Horario</th>
              <th class="px-4 py-2.5">Tipo</th>
              <th class="px-4 py-2.5">Ubicación</th>
              <th class="px-4 py-2.5">Instructor</th>
              <th class="px-4 py-2.5">Inscritos</th>
              <th class="px-4 py-2.5">Estado</th>
              ${isRH ? `<th class="px-4 py-2.5"></th>` : ""}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`}
    </div>
    ${state.showCreateSesionModal ? renderCreateSesionModal() : ""}
    ${state.viewingSesion ? renderSesionEmpleadosModal() : ""}`;
  }

  function renderSesionEmpleadosModal(): string {
    const sesion = state.viewingSesion!;
    const fecha = new Date(sesion.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    const horario = sesion.hora_inicio ? ` — ${sesion.hora_inicio.slice(0, 5)}${sesion.hora_fin ? " a " + sesion.hora_fin.slice(0, 5) : ""}` : "";

    const empleadoRows = state.sesionEmpleados.length === 0
      ? `<p class="text-sm text-slate-400 italic py-3">Sin empleados inscritos en esta sesión.</p>`
      : `<div class="divide-y divide-slate-100 max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
          ${state.sesionEmpleados.map(emp => `
            <div class="flex items-center justify-between gap-2 px-3 py-2">
              <div class="min-w-0">
                <span class="text-sm text-text-primary truncate block">${escapeHtml(emp.nombre_empleado ?? "—")}</span>
                <span class="text-xs text-slate-500">${escapeHtml(emp.no_empleado ?? "")}</span>
              </div>
              ${isRH ? `<button data-action="quitar-sesion-empleado" data-inscripcion-id="${emp.id}" class="text-xs text-red-600 hover:underline shrink-0">Quitar</button>` : ""}
            </div>`).join("")}
        </div>`;

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="sesion-empleados">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Empleados inscritos</h3>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(fecha)}${escapeHtml(horario)}${sesion.ubicacion ? " — " + escapeHtml(sesion.ubicacion) : ""}</p>
          </div>
          <button data-action="close-sesion-empleados-modal" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${empleadoRows}
        ${isRH ? `
        <div class="border-t border-slate-200 pt-4 mt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Agregar empleado</p>
          <div class="flex gap-2">
            <input id="sesion-emp-search" type="text" autocomplete="off" placeholder="Buscar por nombre o número..."
              class="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div id="sesion-emp-results" class="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>
        </div>` : ""}
      </div>
    </div>`;
  }

  function renderSesionInstructorFields(): string {
    const tipo = state.sesionModalTipo;
    const placeholderCls = tipo === "interno" || tipo === "externo" ? "hidden" : "";
    const internoCls = tipo === "interno" ? "" : "hidden";
    const externoCls = tipo === "externo" ? "" : "hidden";

    const loadingBlock = state.instructoresCatalogLoading
      ? `<p class="text-xs text-slate-500">Cargando instructores…</p>`
      : "";

    const internoOptions = state.instructoresInternos.length === 0
      ? `<option value="">Sin instructores internos en catálogo</option>`
      : `<option value="">Seleccionar instructor…</option>${state.instructoresInternos.map((i) => {
          const label = [i.nombre_empleado, i.no_empleado ? `#${i.no_empleado}` : "", i.especialidad].filter(Boolean).join(" · ");
          return `<option value="${i.empleado_id}">${escapeHtml(label)}</option>`;
        }).join("")}`;

    const externoOptions = state.instructoresExternos.length === 0
      ? `<option value="">Sin instructores externos en catálogo</option>`
      : `<option value="">Seleccionar instructor…</option>${state.instructoresExternos.map((i) => {
          const label = [i.nombre, i.especialidad, i.empresa].filter(Boolean).join(" · ");
          return `<option value="${i.id}">${escapeHtml(label)}</option>`;
        }).join("")}`;

    return `
      ${loadingBlock}
      <div data-sesion-instructor-placeholder class="${placeholderCls}">
        <label class="block text-xs font-medium text-slate-600 mb-1">Instructor</label>
        <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Selecciona primero el tipo (Interno o Externo).</p>
      </div>
      <div data-sesion-instructor-interno class="${internoCls}">
        <label for="sesion-instructor-interno" class="block text-xs font-medium text-slate-600 mb-1">Instructor interno</label>
        <select id="sesion-instructor-interno" name="instructor_interno_id" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" ${state.instructoresCatalogLoading ? "disabled" : ""}>
          ${internoOptions}
        </select>
      </div>
      <div data-sesion-instructor-externo class="${externoCls}">
        <label for="sesion-instructor-externo" class="block text-xs font-medium text-slate-600 mb-1">Instructor externo</label>
        <select id="sesion-instructor-externo" name="instructor_externo_id" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" ${state.instructoresCatalogLoading ? "disabled" : ""}>
          ${externoOptions}
        </select>
      </div>`;
  }

  function renderCreateSesionModal(): string {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="create-sesion">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-text-primary mb-4">Crear sesión</h3>
        <form data-form="create-sesion" class="flex flex-col gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha inicio *</label>
            <input type="date" name="fecha_inicio" required class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha fin</label>
            <input type="date" name="fecha_fin" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Hora inicio</label>
              <input type="time" name="hora_inicio" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Hora fin</label>
              <input type="time" name="hora_fin" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select name="tipo" data-action="sesion-tipo-change" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}">
                <option value="" ${state.sesionModalTipo === "" ? "selected" : ""}>—</option>
                <option value="interno" ${state.sesionModalTipo === "interno" ? "selected" : ""}>Interno</option>
                <option value="externo" ${state.sesionModalTipo === "externo" ? "selected" : ""}>Externo</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
              <input type="text" name="ubicacion" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
          </div>
          ${renderSesionInstructorFields()}
          ${renderSesionProveedorFields()}
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Costo</label>
            <input type="number" name="costo" min="0" step="0.01" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea name="notas" rows="2" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}"></textarea>
          </div>
          <div class="flex items-center justify-end gap-3 mt-2">
            <button type="button" data-action="close-sesion-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">Crear</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderViewToggle(): string {
    const btnCls = (active: boolean) => active
      ? "cc-view-btn cc-view-btn--active rounded-[10px] bg-[#1e40af] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      : "cc-view-btn rounded-[10px] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-[#1e40af]";
    return `
    <div class="inline-flex items-center gap-0.5 rounded-[12px] border border-slate-200 bg-slate-50/90 p-1" role="group" aria-label="Modo de vista">
      <button type="button" data-action="view-tarjetas" aria-pressed="${state.viewMode === "tarjetas"}" class="${btnCls(state.viewMode === "tarjetas")}">Tarjetas</button>
      <button type="button" data-action="view-tabla" aria-pressed="${state.viewMode === "tabla"}" class="${btnCls(state.viewMode === "tabla")}">Tabla</button>
    </div>`;
  }

  function renderCursosTable(): string {
    const items = state.cursos.items;
    if (items.length === 0) return "";

    return `
    <div class="overflow-x-auto">
      <table class="cc-catalogo-table min-w-[800px] w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3.5">Nombre</th>
            <th class="px-4 py-3.5">Categoría</th>
            <th class="px-4 py-3.5">Tipo</th>
            <th class="px-4 py-3.5">Clasificación</th>
            <th class="px-4 py-3.5">Horas</th>
            <th class="px-4 py-3.5">Obligatorio</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.map(c => `
          <tr
            class="cc-catalogo-row cursor-pointer transition hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue/40"
            data-action="view-curso"
            data-id="${c.id}"
            tabindex="0"
            role="link"
            aria-label="Ver curso ${escapeHtml(c.nombre)}"
          >
            <td class="px-4 py-3.5 align-middle">
              <span class="block max-w-[280px] truncate text-sm font-semibold text-text-primary" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
            </td>
            <td class="px-4 py-3.5 align-middle">${c.categoria_nombre ? cursoCatBadge(c.categoria_nombre) : `<span class="text-slate-400">—</span>`}</td>
            <td class="px-4 py-3.5 align-middle text-slate-600">${c.tipo_nombre ? escapeHtml(TIPO_LABELS[c.tipo_nombre] ?? c.tipo_nombre) : "—"}</td>
            <td class="px-4 py-3.5 align-middle text-slate-600">${c.clasificacion_nombre ? escapeHtml(CLASIFICACION_LABELS[c.clasificacion_nombre] ?? c.clasificacion_nombre) : "—"}</td>
            <td class="px-4 py-3.5 align-middle tabular-nums text-slate-600">${c.duracion_horas ?? "—"}</td>
            <td class="px-4 py-3.5 align-middle">${c.obligatorio
              ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Sí</span>`
              : `<span class="text-slate-400">No</span>`}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderListToolbar(): string {
    return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Resultados</h2>
        <p class="text-xs text-text-muted">${state.cursos.total} curso${state.cursos.total !== 1 ? "s" : ""}</p>
      </div>
      ${renderViewToggle()}
    </div>`;
  }

  function renderListContent(): string {
    const items = state.cursos.items;

    if (state.loading && items.length === 0) {
      return `
      <section class="${RH_LISTADO_SURFACE} cc-table-wrap flex min-h-[240px] flex-col overflow-hidden p-0" aria-busy="true" aria-label="Cargando cursos">
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14">
          <div class="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-leoni-blue" aria-hidden="true"></div>
          <p class="text-sm text-text-secondary">Cargando catálogo…</p>
        </div>
      </section>`;
    }

    if (items.length === 0) {
      return renderEmptyState();
    }

    if (state.viewMode === "tarjetas") {
      return `
      <section class="${RH_LISTADO_SURFACE} cc-cards-wrap flex flex-col overflow-hidden p-0" aria-label="Cursos en tarjetas">
        ${renderListToolbar()}
        <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 2xl:grid-cols-4">
          ${items.map(c => renderCursoCard(c)).join("")}
        </div>
        ${renderPagination()}
      </section>`;
    }

    return `
    <section class="${RH_LISTADO_SURFACE} cc-table-wrap flex flex-col overflow-hidden p-0" aria-label="Listado de cursos">
      ${renderListToolbar()}
      ${renderCursosTable()}
      ${renderPagination()}
    </section>`;
  }

  function renderPage(): string {
    if (state.loading && state.cursos.items.length === 0 && !hasActiveFilters()) {
      return renderCursosLoading();
    }

    const items = state.cursos.items;
    const showKpis = !state.loading || items.length > 0;

    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page">
      ${renderLevelUpBackBar()}
      ${renderCursosPageHeader()}
      ${showKpis ? renderCursosKpis() : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>`}
      <div class="cc-content-stack flex flex-col gap-4 sm:gap-5">
        ${renderFilterSection()}
        ${renderListContent()}
      </div>
    </div>`;
  }

  function render(): void {
    captureCursoModalDraft();
    mountAppShell(container, {
      pageTitle: "Catálogo de cursos",
      activeNav: "cursos",
      mainClass: "py-5 sm:py-6",
      mainHtml: (state.detailCurso ? renderDetailView() : renderPage()) + (state.showCreateModal || state.editingCurso ? renderCreateEditModal() : ""),
    });
  }

  let detailLoadToken = 0;

  async function loadDetailData(cursoId: number): Promise<void> {
    const token = ++detailLoadToken;
    state.detailDataLoading = true;
    render();

    const [puestosR, empExtraR, sesionesR, areasR, encuestasR] = await Promise.allSettled([
      getCursoPuestos(cursoId),
      getCursoEmpleadosExtra(cursoId),
      getCursoSesiones(cursoId),
      getCursoAreas(cursoId),
      getCursoEncuestasResumen(cursoId),
    ]);

    if (token !== detailLoadToken || state.detailCurso?.id !== cursoId) return;

    if (puestosR.status === "fulfilled") state.detailPuestos = puestosR.value;
    if (empExtraR.status === "fulfilled") state.detailEmpleadosExtra = empExtraR.value;
    if (sesionesR.status === "fulfilled") state.detailSesiones = sesionesR.value.items;
    if (areasR.status === "fulfilled") state.detailAreas = areasR.value;
    state.detailEncuestas = encuestasR.status === "fulfilled" ? encuestasR.value : null;

    state.detailDataLoading = false;
    render();
  }

  function navigateToDetail(curso: Curso): void {
    state.detailCurso = curso;
    state.detailPuestos = [];
    state.detailEmpleadosExtra = [];
    state.detailAreas = [];
    state.detailSesiones = [];
    state.detailEncuestas = null;
    state.detailDataLoading = true;
    state.selectedEmpleados = new Set();
    history.replaceState(null, "", `#/cursos/${curso.id}`);
    render();
    void loadDetailData(curso.id);
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let extraSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  let sesionEmpSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  function bindSesionEmpleadoSearch(): void {
    const input = container.querySelector("#sesion-emp-search") as HTMLInputElement | null;
    if (!input) return;
    input.addEventListener("input", () => {
      if (sesionEmpSearchTimeout) clearTimeout(sesionEmpSearchTimeout);
      sesionEmpSearchTimeout = setTimeout(async () => {
        const q = input.value.trim();
        const resultsDiv = container.querySelector("#sesion-emp-results") as HTMLElement | null;
        if (!resultsDiv || !state.viewingSesion || !state.detailCurso) return;
        if (q.length < 2) { resultsDiv.classList.add("hidden"); resultsDiv.innerHTML = ""; return; }
        try {
          const elegibles: EmpleadoElegible[] = await getSesionEmpleadosElegibles(state.detailCurso.id, state.viewingSesion.id, q);
          if (elegibles.length === 0) {
            resultsDiv.innerHTML = `<p class="text-xs text-slate-500 px-2 py-2">Sin empleados elegibles</p>`;
          } else {
            resultsDiv.innerHTML = elegibles.map(e => `
              <button type="button" data-action="inscribir-sesion-empleado" data-empleado-id="${e.id}" class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-white transition">
                <span class="truncate flex-1">${escapeHtml(e.nombre ?? "—")}</span>
                <span class="text-xs text-slate-400">${escapeHtml(e.no_empleado ?? "")}</span>
              </button>`).join("");
          }
          resultsDiv.classList.remove("hidden");

          resultsDiv.querySelectorAll<HTMLButtonElement>("[data-action='inscribir-sesion-empleado']").forEach(btn => {
            btn.addEventListener("click", async () => {
              const empId = Number(btn.dataset.empleadoId);
              if (!empId || !state.viewingSesion || !state.detailCurso) return;
              btn.disabled = true;
              try {
                await inscribirEmpleadoSesion(state.detailCurso.id, state.viewingSesion.id, empId);
                state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, state.viewingSesion.id);
                const resp = await getCursoSesiones(state.detailCurso.id);
                state.detailSesiones = resp.items;
                state.viewingSesion = state.detailSesiones.find(s => s.id === state.viewingSesion!.id) ?? state.viewingSesion;
                render();
                bindSesionEmpleadoSearch();
              } catch (err: any) {
                alert(err?.detail ?? "Error al inscribir empleado.");
                btn.disabled = false;
              }
            });
          });
        } catch {
          resultsDiv.innerHTML = `<p class="text-xs text-red-500 px-2 py-2">Error al buscar</p>`;
          resultsDiv.classList.remove("hidden");
        }
      }, 320);
    });
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    if (t.closest("[data-action='cursos-clear-filters']")) {
      state.filters = { tipo: "", clasificacion: "", obligatorio: "", categoria: "", busqueda: "" };
      state.page = 1;
      state.loading = true;
      render();
      await loadCursos();
      state.loading = false;
      render();
      return;
    }

    if (t.closest("[data-action='view-tarjetas']")) {
      state.viewMode = "tarjetas";
      render();
      return;
    }
    if (t.closest("[data-action='view-tabla']")) {
      state.viewMode = "tabla";
      render();
      return;
    }

    const selectInstructor = t.closest<HTMLElement>("[data-action='select-instructor']");
    if (selectInstructor) {
      const nombre = selectInstructor.dataset.nombre ?? "";
      const hidden = container.querySelector<HTMLInputElement>("input[name='instructor']");
      const search = container.querySelector<HTMLInputElement>("[data-action='instructor-search']");
      const dropdown = container.querySelector<HTMLElement>("[data-ref='instructor-dropdown']");
      if (hidden) hidden.value = nombre;
      if (search) search.value = nombre;
      if (dropdown) dropdown.classList.add("hidden");
      return;
    }

    if (t.closest("[data-action='open-create-curso']")) {
      await loadEmpleados();
      await openCursoModal(null);
      return;
    }

    if (await handleSesionProveedorClick(t)) return;

    const closeBtn = t.closest<HTMLElement>("[data-action='close-curso-modal']");
    if (closeBtn) {
      if (!(closeBtn.id === "curso-modal-backdrop" && t.closest("[data-modal-inner]"))) {
        closeCursoModal();
        render();
      }
      return;
    }

    const editBtn = t.closest<HTMLElement>("[data-action='edit-curso']");
    if (editBtn) {
      const id = Number(editBtn.dataset.id);
      const curso = state.cursos.items.find(c => c.id === id)
        ?? (state.detailCurso?.id === id ? state.detailCurso : null);
      if (curso) {
        await loadEmpleados();
        await openCursoModal(curso);
      }
      return;
    }

    const deleteBtn = t.closest<HTMLElement>("[data-action='delete-curso']");
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      if (id && confirm("¿Eliminar este curso del catálogo?")) {
        try {
          await deleteCurso(id);
          state.detailCurso = null;
          await loadCursos();
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo eliminar el curso.");
        }
      }
      return;
    }

    const viewBtn = t.closest<HTMLElement>("[data-action='view-curso']");
    if (viewBtn && !t.closest("[data-action-stop]")) {
      const id = Number(viewBtn.dataset.id);
      const curso = state.cursos.items.find(c => c.id === id);
      if (curso) {
        navigateToDetail(curso);
      }
      return;
    }

    // ── Session handlers ──
    const deleteSesionBtn = t.closest<HTMLElement>("[data-action='delete-sesion']");
    if (deleteSesionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const cursoId = Number(deleteSesionBtn.dataset.cursoId);
      const sesionId = Number(deleteSesionBtn.dataset.sesionId);
      const sesion = state.detailSesiones.find((s) => s.id === sesionId);
      const tieneInscritos = (sesion?.inscritos_count ?? 0) > 0;
      const confirmMsg = tieneInscritos
        ? "Esta sesión tiene inscritos y se marcará como cancelada. ¿Continuar?"
        : "¿Eliminar esta sesión?";
      if (cursoId && sesionId && confirm(confirmMsg)) {
        try {
          await deleteCursoSesion(cursoId, sesionId);
          const resp = await getCursoSesiones(cursoId);
          state.detailSesiones = resp.items;
          if (state.viewingSesion?.id === sesionId) {
            state.viewingSesion = null;
            state.sesionEmpleados = [];
          }
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo eliminar la sesión.");
        }
      }
      return;
    }

    const goSesionRow = t.closest<HTMLElement>("[data-action='go-sesion-detail']");
    if (goSesionRow && !t.closest("[data-action-stop]")) {
      const cId = goSesionRow.dataset.cursoId;
      const sId = goSesionRow.dataset.sesionId;
      if (cId && sId) window.location.hash = `#/sesiones/${cId}/${sId}`;
      return;
    }

    if (t.closest("[data-action='open-create-sesion']")) {
      state.showCreateSesionModal = true;
      state.sesionModalTipo = "";
      void loadInstructoresForSesionModal();
      render();
      return;
    }

    if (t.closest("[data-action='close-sesion-modal']") || (t as HTMLElement).dataset.backdrop === "create-sesion") {
      state.showCreateSesionModal = false;
      state.instructoresInternos = [];
      state.instructoresExternos = [];
      state.instructoresCatalogLoading = false;
      state.sesionModalTipo = "";
      render();
      return;
    }

    const viewSesionEmpBtn = t.closest<HTMLElement>("[data-action='view-sesion-empleados']");
    if (viewSesionEmpBtn) {
      const sesionId = Number(viewSesionEmpBtn.dataset.sesionId);
      const sesion = state.detailSesiones.find(s => s.id === sesionId);
      if (!sesion || !state.detailCurso) return;
      state.viewingSesion = sesion;
      try {
        state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, sesionId);
      } catch { state.sesionEmpleados = []; }
      render();
      bindSesionEmpleadoSearch();
      return;
    }

    if (t.closest("[data-action='close-sesion-empleados-modal']") || (t as HTMLElement).dataset.backdrop === "sesion-empleados") {
      state.viewingSesion = null;
      state.sesionEmpleados = [];
      render();
      return;
    }

    const quitarEmpBtn = t.closest<HTMLElement>("[data-action='quitar-sesion-empleado']");
    if (quitarEmpBtn) {
      const inscId = Number(quitarEmpBtn.dataset.inscripcionId);
      if (!inscId || !state.viewingSesion || !state.detailCurso) return;
      try {
        await quitarEmpleadoSesion(state.detailCurso.id, state.viewingSesion.id, inscId);
        state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, state.viewingSesion.id);
        const resp = await getCursoSesiones(state.detailCurso.id);
        state.detailSesiones = resp.items;
        state.viewingSesion = state.detailSesiones.find(s => s.id === state.viewingSesion!.id) ?? state.viewingSesion;
        render();
        bindSesionEmpleadoSearch();
      } catch (err: any) {
        alert(err?.detail ?? "Error al quitar empleado.");
      }
      return;
    }

    if (t.closest("[data-action='open-create-sesion']")) {
      state.showAsignacionMasivaModal = true;
      state.asignacionResult = null;
      state.asignacionError = null;
      state.asignacionAreaIds = new Set();
      state.asignacionCatalogosLoading = true;
      render();
      try {
        state.asignacionCatalogos = await getCursoCatalogosAsignacion(state.detailCurso!.id);
      } catch { state.asignacionCatalogos = null; }
      state.asignacionCatalogosLoading = false;
      render();
      return;
    }

    if (t.closest("[data-action='close-asignacion-areas']") || (t as HTMLElement).dataset.backdrop === "asignacion-areas") {
      state.showAsignacionMasivaModal = false;
      render();
      return;
    }

    const toggleAreaExpandBtn = t.closest("[data-action='toggle-area-expand']") as HTMLElement | null;
    if (toggleAreaExpandBtn && !t.closest("[data-action='toggle-puesto']") && !t.closest("[data-action='quitar-area']")) {
      const areaId = Number(toggleAreaExpandBtn.dataset.areaId);
      if (state.expandedAreas.has(areaId)) {
        state.expandedAreas.delete(areaId);
      } else {
        state.expandedAreas.add(areaId);
      }
      render();
      return;
    }

    const togglePuestoExpandBtn = t.closest("[data-action='toggle-puesto-expand']") as HTMLElement | null;
    if (togglePuestoExpandBtn && !t.closest("[data-action='toggle-puesto']") && !t.closest("[data-action='quitar-puesto']") && !t.closest("a")) {
      const puestoId = Number(togglePuestoExpandBtn.dataset.puestoId);
      if (state.expandedPuestos.has(puestoId)) {
        state.expandedPuestos.delete(puestoId);
      } else {
        state.expandedPuestos.add(puestoId);
      }
      render();
      return;
    }

    if (t.closest("[data-action='toggle-extras-expand']") && !t.closest("[data-action='toggle-all-extras']")) {
      state.expandedExtras = !state.expandedExtras;
      render();
      return;
    }

    if (t.matches("[data-action='toggle-asignacion-area']")) {
      const areaRefId = Number((t as HTMLInputElement).dataset.areaRefId);
      if (!areaRefId) return;
      if ((t as HTMLInputElement).checked) {
        state.asignacionAreaIds.add(areaRefId);
      } else {
        state.asignacionAreaIds.delete(areaRefId);
      }
      state.asignacionResult = null;
      state.asignacionError = null;
      render();
      return;
    }

    if (t.closest("[data-action='confirmar-asignacion-areas']")) {
      const areaIds = [...state.asignacionAreaIds];
      if (areaIds.length === 0 || !state.detailCurso) return;
      state.asignacionLoading = true;
      state.asignacionResult = null;
      state.asignacionError = null;
      render();
      let asignados = 0;
      let lastError: string | null = null;
      try {
        for (const areaId of areaIds) {
          try {
            await agregarAreaCurso(state.detailCurso.id, areaId);
            asignados++;
          } catch (err: unknown) {
            const detail = (err as { detail?: string })?.detail;
            lastError = typeof detail === "string" ? detail : "No se pudo asignar una o más áreas.";
          }
        }
        if (asignados > 0) {
          state.asignacionResult = { asignados, ya_asignados: areaIds.length - asignados };
          state.detailAreas = await getCursoAreas(state.detailCurso.id);
          state.asignacionAreaIds = new Set();
        } else {
          state.asignacionError = lastError ?? "No se pudo asignar ninguna área.";
        }
      } catch (err: unknown) {
        const detail = (err as { detail?: string })?.detail;
        state.asignacionError = typeof detail === "string" ? detail : "Error al asignar áreas.";
      }
      state.asignacionLoading = false;
      render();
      return;
    }

    const quitarAreaBtn = t.closest("[data-action='quitar-area']") as HTMLElement | null;
    if (quitarAreaBtn) {
      const areaId = Number(quitarAreaBtn.dataset.areaId);
      if (!areaId) return;
      try {
        await quitarAreaCurso(state.detailCurso!.id, areaId);
        state.detailAreas = state.detailAreas.filter((a) => a.id !== areaId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    if (t.closest("[data-action='open-asignacion-puestos']")) {
      state.showAsignacionPuestosModal = true;
      state.asignacionPuestosResult = null;
      state.asignacionPuestosError = null;
      state.asignacionPuestoIds = new Set();
      state.asignacionPuestosCatalogLoading = true;
      render();
      try {
        state.asignacionPuestosCatalog = await getCursoCatalogosPuestos(state.detailCurso!.id);
      } catch (err: unknown) {
        state.asignacionPuestosCatalog = null;
        const detail = (err as { detail?: string })?.detail;
        state.asignacionPuestosError = typeof detail === "string" ? detail : "Error al cargar perfiles de puesto.";
      }
      state.asignacionPuestosCatalogLoading = false;
      render();
      return;
    }

    if (t.closest("[data-action='close-asignacion-puestos']") || (t as HTMLElement).dataset.backdrop === "asignacion-puestos") {
      state.showAsignacionPuestosModal = false;
      render();
      return;
    }

    if (t.matches("[data-action='toggle-asignacion-puesto']")) {
      const puestoPerfilId = Number((t as HTMLInputElement).dataset.puestoPerfilId);
      if (!puestoPerfilId) return;
      if ((t as HTMLInputElement).checked) {
        state.asignacionPuestoIds.add(puestoPerfilId);
      } else {
        state.asignacionPuestoIds.delete(puestoPerfilId);
      }
      state.asignacionPuestosResult = null;
      state.asignacionPuestosError = null;
      render();
      return;
    }

    if (t.closest("[data-action='confirmar-asignacion-puestos']")) {
      const puestoIds = [...state.asignacionPuestoIds];
      if (puestoIds.length === 0 || !state.detailCurso) return;
      state.asignacionPuestosLoading = true;
      state.asignacionPuestosResult = null;
      state.asignacionPuestosError = null;
      render();
      let asignados = 0;
      let lastError: string | null = null;
      try {
        for (const puestoPerfilId of puestoIds) {
          try {
            await agregarPuestoCurso(state.detailCurso.id, puestoPerfilId);
            asignados++;
          } catch (err: unknown) {
            const detail = (err as { detail?: string })?.detail;
            lastError = typeof detail === "string" ? detail : "No se pudo asignar uno o más puestos.";
          }
        }
        if (asignados > 0) {
          state.asignacionPuestosResult = { asignados, ya_asignados: puestoIds.length - asignados };
          state.detailPuestos = await getCursoPuestos(state.detailCurso.id);
          state.asignacionPuestoIds = new Set();
        } else {
          state.asignacionPuestosError = lastError ?? "No se pudo asignar ningún puesto.";
        }
      } catch (err: unknown) {
        const detail = (err as { detail?: string })?.detail;
        state.asignacionPuestosError = typeof detail === "string" ? detail : "Error al asignar puestos.";
      }
      state.asignacionPuestosLoading = false;
      render();
      return;
    }

    const quitarPuestoBtn = t.closest("[data-action='quitar-puesto']") as HTMLElement | null;
    if (quitarPuestoBtn) {
      const cursoPuestoId = Number(quitarPuestoBtn.dataset.cursoPuestoId);
      if (!cursoPuestoId) return;
      try {
        await quitarPuestoCurso(state.detailCurso!.id, cursoPuestoId);
        state.detailPuestos = state.detailPuestos.filter((p) => p.id !== cursoPuestoId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    if (t.closest("[data-action='open-asignacion-extras']")) {
      state.showAsignacionExtrasModal = true;
      state.asignacionExtrasError = null;
      state.extraSearchQuery = "";
      state.extraSearchResults = [];
      render();
      const input = container.querySelector("[data-action='search-extra-elegible']") as HTMLInputElement | null;
      input?.focus();
      return;
    }

    if (t.closest("[data-action='close-asignacion-extras']") || (t as HTMLElement).dataset.backdrop === "asignacion-extras") {
      state.showAsignacionExtrasModal = false;
      state.extraSearchQuery = "";
      state.extraSearchResults = [];
      state.asignacionExtrasError = null;
      render();
      return;
    }

    const asignarExtraBtn = t.closest("[data-action='asignar-empleado-extra']") as HTMLElement | null;
    if (asignarExtraBtn) {
      const empleadoId = Number(asignarExtraBtn.dataset.empleadoId);
      if (!empleadoId || !state.detailCurso) return;
      state.asignacionExtrasError = null;
      try {
        await agregarEmpleadoExtraCurso(state.detailCurso.id, empleadoId);
        state.detailEmpleadosExtra = await getCursoEmpleadosExtra(state.detailCurso.id);
        state.extraSearchResults = state.extraSearchResults.filter((r) => r.id !== empleadoId);
        if (!state.expandedExtras) state.expandedExtras = true;
        render();
      } catch (err: unknown) {
        const detail = (err as { detail?: string })?.detail;
        state.asignacionExtrasError = typeof detail === "string" ? detail : "No se pudo asignar el empleado.";
        render();
      }
      return;
    }

    const quitarExtraBtn = t.closest("[data-action='quitar-extra']") as HTMLElement | null;
    if (quitarExtraBtn) {
      const cursoEmpleadoId = Number(quitarExtraBtn.dataset.cursoEmpleadoId);
      if (!cursoEmpleadoId) return;
      try {
        await quitarEmpleadoExtraCurso(state.detailCurso!.id, cursoEmpleadoId);
        state.detailEmpleadosExtra = state.detailEmpleadosExtra.filter((e) => e.id !== cursoEmpleadoId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    if (t.closest("[data-action='open-assign-sesion-picker']")) {
      state.showAssignSesionPicker = true;
      render();
      return;
    }

    if (t.closest("[data-action='close-assign-sesion-picker']") || (t as HTMLElement).dataset.backdrop === "assign-sesion") {
      state.showAssignSesionPicker = false;
      render();
      return;
    }

    if (t.closest("[data-action='clear-selection']")) {
      state.selectedEmpleados = new Set();
      render();
      return;
    }

    const assignBtn = t.closest<HTMLElement>("[data-action='assign-to-sesion']");
    if (assignBtn) {
      const sesionId = Number(assignBtn.dataset.sesionId);
      const cursoId = state.detailCurso?.id;
      if (!sesionId || !cursoId) return;
      assignBtn.classList.add("opacity-50", "pointer-events-none");
      let successCount = 0;
      let errorCount = 0;
      for (const empId of state.selectedEmpleados) {
        try {
          await inscribirEmpleadoSesion(cursoId, sesionId, empId);
          successCount++;
        } catch { errorCount++; }
      }
      state.selectedEmpleados = new Set();
      state.showAssignSesionPicker = false;
      const resp = await getCursoSesiones(cursoId);
      state.detailSesiones = resp.items;
      render();
      if (errorCount > 0) {
        alert(`${successCount} inscrito${successCount !== 1 ? "s" : ""}, ${errorCount} error${errorCount !== 1 ? "es" : ""} (posiblemente ya inscritos).`);
      }
      return;
    }

    if (t.closest("[data-action='cursos-prev']")) {
      if (state.page > 1) {
        state.page--;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }

    const gotoPageBtn = t.closest<HTMLElement>("[data-action='cursos-goto-page']");
    if (gotoPageBtn) {
      const targetPage = Number(gotoPageBtn.dataset.page);
      const pageSize = state.cursos.page_size || 20;
      const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
      if (targetPage >= 1 && targetPage <= totalPages && targetPage !== state.page) {
        state.page = targetPage;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }

    if (t.closest("[data-action='cursos-next']")) {
      const pageSize = state.cursos.page_size || 20;
      const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
      if (state.page < totalPages) {
        state.page++;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    if ((t as HTMLSelectElement).matches("[data-action='sesion-tipo-change']")) {
      const tipo = (t as HTMLSelectElement).value as "" | "interno" | "externo";
      state.sesionModalTipo = tipo;
      toggleSesionInstructorFields(tipo);
      return;
    }

    // ── Checkbox: toggle individual employee ──
    if (t.matches("[data-action='toggle-emp']")) {
      const empId = Number((t as HTMLInputElement).dataset.empId);
      if ((t as HTMLInputElement).checked) {
        state.selectedEmpleados.add(empId);
      } else {
        state.selectedEmpleados.delete(empId);
      }
      render();
      return;
    }

    // ── Checkbox: toggle all employees in a puesto ──
    if (t.matches("[data-action='toggle-puesto']")) {
      const ids: number[] = JSON.parse((t as HTMLInputElement).dataset.puestoEmps ?? "[]");
      const checked = (t as HTMLInputElement).checked;
      for (const id of ids) {
        if (checked) state.selectedEmpleados.add(id);
        else state.selectedEmpleados.delete(id);
      }
      render();
      return;
    }

    // ── Checkbox: toggle all extras ──
    if (t.matches("[data-action='toggle-all-extras']")) {
      const ids: number[] = JSON.parse((t as HTMLInputElement).dataset.extraEmps ?? "[]");
      const checked = (t as HTMLInputElement).checked;
      for (const id of ids) {
        if (checked) state.selectedEmpleados.add(id);
        else state.selectedEmpleados.delete(id);
      }
      render();
      return;
    }

    const sel = t as HTMLSelectElement;

    if (sel.matches("[data-action='cursos-filter-tipo']")) {
      state.filters.tipo = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-clasificacion']")) {
      state.filters.clasificacion = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-obligatorio']")) {
      state.filters.obligatorio = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-categoria']")) {
      state.filters.categoria = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='cursos-search']")) {
      state.filters.busqueda = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        state.page = 1;
        await loadCursos();
        render();
        const input = container.querySelector<HTMLInputElement>("[data-action='cursos-search']");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }

    if (t.matches("[data-action='instructor-search']")) {
      const query = t.value.toLowerCase().trim();
      const dropdown = container.querySelector<HTMLElement>("[data-ref='instructor-dropdown']");
      if (!dropdown) return;
      if (!query) {
        dropdown.classList.add("hidden");
        return;
      }
      const matches = state.empleados.filter(e => e.nombre.toLowerCase().includes(query)).slice(0, 20);
      if (matches.length === 0) {
        dropdown.innerHTML = `<div class="px-3 py-2 text-sm text-slate-400">Sin resultados</div>`;
      } else {
        dropdown.innerHTML = matches.map(e =>
          `<button type="button" data-action="select-instructor" data-nombre="${escapeHtml(e.nombre)}" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition truncate">${escapeHtml(e.nombre)}</button>`
        ).join("");
      }
      dropdown.classList.remove("hidden");
    }

    if (t.matches("[data-action='search-extra-elegible']")) {
      state.extraSearchQuery = t.value;
      if (extraSearchTimeout) clearTimeout(extraSearchTimeout);
      if (t.value.trim().length < 2) {
        state.extraSearchResults = [];
        state.asignacionExtrasError = null;
        render();
        return;
      }
      extraSearchTimeout = setTimeout(async () => {
        if (!state.detailCurso) return;
        state.extraSearchLoading = true;
        state.asignacionExtrasError = null;
        render();
        try {
          state.extraSearchResults = await buscarEmpleadosExtraCurso(state.detailCurso.id, state.extraSearchQuery);
        } catch (err: unknown) {
          state.extraSearchResults = [];
          const detail = (err as { detail?: string })?.detail;
          state.asignacionExtrasError = typeof detail === "string" ? detail : "Error al buscar empleados.";
        }
        state.extraSearchLoading = false;
        render();
        const input = container.querySelector("[data-action='search-extra-elegible']") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }
  }

  async function handleSubmit(e: Event): Promise<void> {
    const form = (e.target as HTMLElement).closest("form");
    if (!form) return;

    // ── Create Sesion form ──
    if (form.matches("[data-form='create-sesion']")) {
      e.preventDefault();
      const cursoId = state.detailCurso?.id;
      if (!cursoId) return;
      const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
      if (submitBtn?.disabled) return;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }
      const fd = new FormData(form);
      const payload: CursoSesionCreatePayload = {
        fecha_inicio: fd.get("fecha_inicio") as string,
        fecha_fin: (fd.get("fecha_fin") as string) || undefined,
        hora_inicio: (fd.get("hora_inicio") as string) || undefined,
        hora_fin: (fd.get("hora_fin") as string) || undefined,
        ubicacion: (fd.get("ubicacion") as string) || undefined,
        costo: fd.get("costo") ? Number(fd.get("costo")) : undefined,
        notas: (fd.get("notas") as string) || undefined,
      };
      const proveedorIdRaw = fd.get("proveedor_id");
      if (proveedorIdRaw) payload.proveedor_id = Number(proveedorIdRaw);
      const tipo = (fd.get("tipo") as string) || "";
      if (tipo) {
        payload.tipo = tipo;
        payload.instructor_tipo = tipo as InstructorTipo;
        if (tipo === "interno") {
          const empId = Number(fd.get("instructor_interno_id"));
          if (!empId || Number.isNaN(empId)) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; }
            alert("Selecciona un instructor interno.");
            return;
          }
          payload.instructor_empleado_id = empId;
        } else if (tipo === "externo") {
          const extId = Number(fd.get("instructor_externo_id"));
          if (!extId || Number.isNaN(extId)) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; }
            alert("Selecciona un instructor externo.");
            return;
          }
          payload.instructor_externo_id = extId;
        }
      }
      if (!payload.fecha_inicio) { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; } return; }
      try {
        await createCursoSesion(cursoId, payload);
        state.showCreateSesionModal = false;
        state.instructoresInternos = [];
        state.instructoresExternos = [];
        state.instructoresCatalogLoading = false;
        state.sesionModalTipo = "";
        const resp = await getCursoSesiones(cursoId);
        state.detailSesiones = resp.items;
        render();
      } catch (err: any) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; }
        alert(err?.detail ?? "Error al crear la sesión");
      }
      return;
    }

    // ── Create/Edit Curso form ──
    if (!form.matches("[data-action='submit-curso']")) return;
    e.preventDefault();

    if (state.proveedoresLoading) {
      alert("Espera a que carguen los proveedores.");
      return;
    }

    const fd = new FormData(form);
    const payload: CursoCreatePayload = {
      nombre: fd.get("nombre") as string,
      duracion_horas: fd.get("duracion_horas") ? Number(fd.get("duracion_horas")) : undefined,
      obligatorio: form.querySelector<HTMLInputElement>("[name='obligatorio']")?.checked ?? false,
      descripcion: (fd.get("descripcion") as string) || undefined,
      centro_costos: fd.get("centro_costos") ? Number(fd.get("centro_costos")) : undefined,
    };
    const categoriaIdRaw = fd.get("categoria_id");
    const tipoIdRaw = fd.get("tipo_id");
    const clasificacionIdRaw = fd.get("clasificacion_id");
    if (categoriaIdRaw) payload.categoria_id = Number(categoriaIdRaw);
    if (tipoIdRaw) payload.tipo_id = Number(tipoIdRaw);
    if (clasificacionIdRaw) payload.clasificacion_id = Number(clasificacionIdRaw);

    if (!payload.nombre) return;

    try {
      if (state.editingCurso) {
        await updateCurso(state.editingCurso.id, payload);
      } else {
        await createCurso(payload);
      }
      closeCursoModal();
      await loadCursos();
      render();
    } catch (err: any) {
      alert(err?.detail ?? "Error al guardar el curso");
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    const viewRow = t.closest<HTMLElement>("[data-action='view-curso'][tabindex='0']");
    if (viewRow && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const id = Number(viewRow.dataset.id);
      const curso = state.cursos.items.find(c => c.id === id);
      if (curso) navigateToDetail(curso);
      return;
    }
    if (e.key === "Escape" && state.viewingSesion) {
      state.viewingSesion = null;
      state.sesionEmpleados = [];
      render();
      return;
    }
    if (e.key === "Escape" && state.showCreateSesionModal) {
      state.showCreateSesionModal = false;
      state.instructoresInternos = [];
      state.instructoresExternos = [];
      state.instructoresCatalogLoading = false;
      state.sesionModalTipo = "";
      render();
      return;
    }
    if (e.key === "Escape" && (state.showCreateModal || state.editingCurso)) {
      closeCursoModal();
      render();
    }
  }

  render();
  const listenerOpts = { signal };
  container.addEventListener("click", handleClick, listenerOpts);
  container.addEventListener("change", handleChange, listenerOpts);
  container.addEventListener("input", handleInput, listenerOpts);
  container.addEventListener("submit", handleSubmit, listenerOpts);
  document.addEventListener("keydown", handleKeydown, listenerOpts);

  (async () => {
    await loadCursos();
    if (signal.aborted) return;
    state.loading = false;
    render();

    const hashMatch = location.hash.match(/^#\/cursos\/(\d+)$/);
    if (hashMatch) {
      const cursoId = Number(hashMatch[1]);
      try {
        const curso = await getCursoById(cursoId);
        if (signal.aborted) return;
        navigateToDetail(curso);
      } catch {}
    }
  })();
}

// ── Sugerencias: tipos y datos fake ──────────────────────────────────────────

type SugFuente = "Brecha interna" | "Mercado laboral";
type SugImpacto = "Alto" | "Medio" | "Bajo";

interface SugerenciaItem {
  id: string;
  sugId: number;
  estado: SugerenciaEstado;
  titulo: string;
  fuente: SugFuente;
  impacto: SugImpacto;
  prio: number; // stars filled out of 4
  razon: string;
  capCubre: string[];
  areas: string[];
  personas: number;
  dur: string;
  costo: string;
  proveedor: string;
  brechaPct: number;
  mercadoPct: number;
  benchmark: string;
  featured?: boolean;
  badge?: string;
}

const SUG_ESTADO_LABELS: Record<SugerenciaEstado, string> = {
  activa: "Activa",
  aprobada: "Aprobada",
  pospuesta: "Pospuesta",
  descartada: "Descartada",
};

function sugToStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x))).filter((s) => s.length > 0);
}

/** Mapea la respuesta del backend al view-model que consume `renderSugCard`. */
function mapSugerencia(r: SugerenciaResponse): SugerenciaItem {
  const brechaPct = Math.round(r.brecha_pct ?? 0);
  const mercadoPct = Math.round(r.adopcion_sector_pct ?? 0);
  const impacto: SugImpacto = r.prioridad >= 4 ? "Alto" : r.prioridad === 3 ? "Medio" : "Bajo";
  const fuente: SugFuente = brechaPct >= mercadoPct ? "Brecha interna" : "Mercado laboral";
  const costo =
    r.inversion_estimada != null
      ? `$ ${Number(r.inversion_estimada).toLocaleString("es-MX")}`
      : "—";
  return {
    id: `SUG-${r.id}`,
    sugId: r.id,
    estado: r.estado,
    titulo: r.titulo,
    fuente,
    impacto,
    prio: r.prioridad,
    razon: r.justificacion ?? "",
    capCubre: sugToStringList(r.capacidades_afectadas),
    areas: sugToStringList(r.areas_afectadas),
    personas: r.personas_alcanzables ?? 0,
    dur: r.duracion_sugerida ?? "—",
    costo,
    proveedor: r.proveedor_sugerido ?? "—",
    brechaPct,
    mercadoPct,
    benchmark: "",
  };
}

function sugFuentePill(fuente: SugFuente): string {
  const styles: Record<SugFuente, { border: string; bg: string; text: string; dot: string }> = {
    "Brecha interna": { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
    "Mercado laboral": { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-400" },
  };
  const s = styles[fuente];
  return `<span class="inline-flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} px-2 py-0.5 text-[10px] font-semibold ${s.text}"><span class="size-1.5 shrink-0 rounded-full ${s.dot}" aria-hidden="true"></span>${escapeHtml(fuente)}</span>`;
}

function sugImpactoPill(impacto: SugImpacto): string {
  const styles: Record<SugImpacto, string> = {
    "Alto": "border-red-200 bg-red-50 text-red-700",
    "Medio": "border-amber-200 bg-amber-50 text-amber-700",
    "Bajo": "border-blue-200 bg-blue-50 text-blue-600",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[impacto]} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(impacto)}</span>`;
}

function sugStarRating(filled: number, total: number = 4): string {
  const stars: string[] = [];
  for (let i = 0; i < total; i++) {
    if (i < filled) {
      stars.push(`<span class="text-blue-500 text-sm">&#9733;</span>`);
    } else {
      stars.push(`<span class="text-slate-300 text-sm">&#9733;</span>`);
    }
  }
  return `<span class="inline-flex items-center gap-0.5">${stars.join("")}</span>`;
}

function sugProgressBar(pct: number, color: string): string {
  return `
  <div class="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
    <div class="h-full rounded-full ${color}" style="width: ${pct}%"></div>
  </div>`;
}

function renderSugKpis(items: SugerenciaResponse[]): string {
  const activas = items.filter((s) => s.estado === "activa");
  const porBrecha = activas.filter((s) => (s.brecha_pct ?? 0) >= (s.adopcion_sector_pct ?? 0)).length;
  const porMercado = activas.length - porBrecha;
  const impactoAlto = activas.filter((s) => s.prioridad >= 4).length;
  const inversion = activas.reduce((acc, s) => acc + (s.inversion_estimada ?? 0), 0);
  const personas = activas.reduce((acc, s) => acc + (s.personas_alcanzables ?? 0), 0);
  const inversionLabel =
    inversion >= 1000 ? `$ ${Math.round(inversion / 1000)}k` : `$ ${inversion.toLocaleString("es-MX")}`;
  const kpis = [
    { label: "Sugerencias activas", value: String(activas.length), sub: `${porBrecha} por brecha · ${porMercado} por mercado` },
    { label: "Impacto alto", value: String(impactoAlto), sub: "Prioridad 4-5 (brecha crítica)" },
    { label: "Inversión sugerida", value: inversionLabel, sub: "Acumulado estimado (activas)" },
    { label: "Personas alcanzables", value: String(personas), sub: "Si se aprueban todas" },
  ];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${k.value}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function sugEstadoPill(estado: SugerenciaEstado): string {
  const styles: Record<SugerenciaEstado, string> = {
    activa: "border-blue-200 bg-blue-50 text-blue-700",
    aprobada: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pospuesta: "border-amber-200 bg-amber-50 text-amber-700",
    descartada: "border-slate-200 bg-slate-50 text-slate-500",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[estado]} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(SUG_ESTADO_LABELS[estado])}</span>`;
}

function renderSugCard(sug: SugerenciaItem): string {
  const featuredBorder = sug.featured ? "border-l-[3px] border-l-blue-500" : "";

  // Column 1: Main content
  const pills = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">${escapeHtml(sug.id)}</span>
      ${sugFuentePill(sug.fuente)}
      ${sugImpactoPill(sug.impacto)}
      ${sugEstadoPill(sug.estado)}
      ${sug.badge ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">${escapeHtml(sug.badge)}</span>` : ""}
    </div>`;

  const capPills = sug.capCubre.map(c => `<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">${escapeHtml(c)}</span>`).join("");
  const areaPills = sug.areas.map(a => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">${escapeHtml(a)}</span>`).join("");
  const sep = sug.capCubre.length > 0 && sug.areas.length > 0 ? `<span class="text-slate-300">|</span>` : "";

  const col1 = `
    <div class="flex flex-col gap-2.5 min-w-0">
      ${pills}
      <p class="text-[15px] font-medium text-slate-900 leading-tight">${escapeHtml(sug.titulo)}</p>
      <p class="text-xs text-slate-500 leading-relaxed">${escapeHtml(sug.razon)}</p>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${capPills}
        ${sep}
        ${areaPills}
      </div>
      <div class="flex items-center gap-4 flex-wrap text-[11px] text-slate-600 mt-1">
        <span><b class="font-semibold text-slate-800">${sug.personas}</b> personas</span>
        <span><b class="font-semibold text-slate-800">${escapeHtml(sug.dur)}</b> duración</span>
        <span><b class="font-semibold text-slate-800">${escapeHtml(sug.costo)}</b> inversión est.</span>
        <span>${escapeHtml(sug.proveedor)}</span>
      </div>
    </div>`;

  // Column 2: Justification panel
  const col2 = `
    <div class="rounded-lg bg-slate-50 p-4 flex flex-col gap-3">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Justificación</p>
      <div class="flex flex-col gap-2">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] text-slate-600">Brecha interna</span>
            <span class="text-[11px] font-semibold tabular-nums text-slate-800">${sug.brechaPct}%</span>
          </div>
          ${sugProgressBar(sug.brechaPct, "bg-blue-500")}
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] text-slate-600">Adopción del sector</span>
            <span class="text-[11px] font-semibold tabular-nums text-slate-800">${sug.mercadoPct}%</span>
          </div>
          ${sugProgressBar(sug.mercadoPct, "bg-blue-400")}
        </div>
      </div>
      ${sug.benchmark ? `
      <div class="mt-1">
        <p class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Benchmark</p>
        <p class="text-[11px] text-slate-600 leading-relaxed">${escapeHtml(sug.benchmark)}</p>
      </div>` : ""}
    </div>`;

  // Column 3: Actions
  const disabledAttr = sugActionsBusy ? "disabled" : "";
  const busyCls = sugActionsBusy ? "opacity-60 cursor-not-allowed" : "";
  const btnAttrs = (estado: SugerenciaEstado): string =>
    `data-action="sug-estado" data-id="${sug.sugId}" data-estado="${estado}" ${disabledAttr}`;
  const col3 = `
    <div class="flex flex-col gap-3 items-center justify-start">
      <div class="text-center">
        <p class="text-[10px] font-semibold text-slate-500 mb-1">Prioridad</p>
        ${sugStarRating(sug.prio)}
      </div>
      <div class="w-full border-t border-slate-200"></div>
      <button type="button" class="${BTN_PRIMARY} !text-[11px] !px-3 !py-1.5 w-full ${busyCls}" ${btnAttrs("aprobada")}>Aprobar y programar</button>
      <button type="button" class="${BTN_SECONDARY} !text-[11px] !px-3 !py-1.5 w-full ${busyCls}" ${btnAttrs("pospuesta")}>Posponer</button>
      <button type="button" class="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition w-full ${busyCls}" ${btnAttrs("descartada")}>Descartar</button>
      <div class="w-full border-t border-slate-200"></div>
      <div class="flex w-full gap-2">
        <button type="button" class="${BTN_SECONDARY} !text-[11px] !px-3 !py-1.5 flex-1 ${busyCls}" data-action="sug-editar" data-id="${sug.sugId}" ${disabledAttr}>Editar</button>
        <button type="button" class="${BTN_DANGER} !text-[11px] !px-3 !py-1.5 flex-1 ${busyCls}" data-action="sug-eliminar" data-id="${sug.sugId}" ${disabledAttr}>Eliminar</button>
      </div>
    </div>`;

  return `
  <div class="grid grid-cols-1 gap-4 rounded-xl border border-border bg-white p-5 lg:grid-cols-[1.4fr_1fr_220px] ${featuredBorder}">
    ${col1}
    ${col2}
    ${col3}
  </div>`;
}

/** Estado de mutación en curso; deshabilita acciones de las tarjetas. */
let sugActionsBusy = false;

/** Elementos enfocables dentro de un panel de modal, para el focus-trap basico (Tab/Shift+Tab). */
const SUG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface SugForm {
  titulo: string;
  justificacion: string;
  prioridad: string;
  estado: string;
  cursoId: string;
  brechaPct: string;
  adopcionPct: string;
  personas: string;
  duracion: string;
  inversion: string;
  proveedor: string;
  capacidades: string;
  areas: string;
}

function sugEmptyForm(): SugForm {
  return {
    titulo: "",
    justificacion: "",
    prioridad: "3",
    estado: "activa",
    cursoId: "",
    brechaPct: "",
    adopcionPct: "",
    personas: "",
    duracion: "",
    inversion: "",
    proveedor: "",
    capacidades: "",
    areas: "",
  };
}

interface SugerenciasView {
  items: SugerenciaResponse[];
  areas: AreaOption[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  generating: boolean;
  selectedAreaId: string;
  umbral: string;
  modalOpen: boolean;
  modalMode: "crear" | "editar";
  editId: number | null;
  saving: boolean;
  modalError: string | null;
  cursos: { id: number; nombre: string }[];
  form: SugForm;
}

function renderSugGenerarControl(v: SugerenciasView): string {
  const disabled = v.generating || sugActionsBusy;
  const disAttr = disabled ? "disabled" : "";
  const opts = [
    `<option value="">Selecciona área…</option>`,
    ...v.areas.map(
      (a) => `<option value="${a.id}"${String(a.id) === v.selectedAreaId ? " selected" : ""}>${escapeHtml(a.label)}</option>`,
    ),
  ].join("");
  return `
    <div class="flex items-end gap-2 shrink-0 flex-wrap justify-end">
      <div>
        <label class="${RH_LISTADO_LABEL}" for="sug-area">Área</label>
        <div class="grid grid-cols-1">
          <select id="sug-area" data-action="sug-area-select" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING} min-w-[12rem]" ${disAttr}>${opts}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div>
        <label class="${RH_LISTADO_LABEL}" for="sug-umbral">Umbral %</label>
        <input id="sug-umbral" data-action="sug-umbral" type="number" min="0" max="100" step="1" value="${escapeHtml(v.umbral)}" class="${FIELD_INPUT} !w-24" ${disAttr} />
      </div>
      <button type="button" data-action="sug-generar" class="${RH_LISTADO_BTN_PRIMARY}" ${disAttr}>${v.generating ? "Generando…" : "Generar desde brechas"}</button>
    </div>`;
}

function renderSugField(
  label: string,
  campo: keyof SugForm,
  value: string,
  opts: { type?: string; min?: string; max?: string; step?: string; placeholder?: string } = {},
): string {
  const attrs = [
    `type="${opts.type ?? "text"}"`,
    opts.min != null ? `min="${opts.min}"` : "",
    opts.max != null ? `max="${opts.max}"` : "",
    opts.step != null ? `step="${opts.step}"` : "",
    opts.placeholder ? `placeholder="${escapeHtml(opts.placeholder)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <div>
      <label class="${FORM_LABEL}" for="sug-form-${campo}">${escapeHtml(label)}</label>
      <input id="sug-form-${campo}" data-form="${campo}" ${attrs} value="${escapeHtml(value)}" class="${FIELD_INPUT}" />
    </div>`;
}

function renderSugerenciaModal(v: SugerenciasView): string {
  if (!v.modalOpen) return "";
  const f = v.form;
  const titulo = v.modalMode === "crear" ? "Nueva sugerencia" : "Editar sugerencia";
  const cursoOpts = [
    `<option value=""${f.cursoId === "" ? " selected" : ""}>— sin curso —</option>`,
    ...v.cursos.map(
      (c) => `<option value="${c.id}"${String(c.id) === f.cursoId ? " selected" : ""}>${escapeHtml(c.nombre)}</option>`,
    ),
  ].join("");
  const estadoOpts = (Object.keys(SUG_ESTADO_LABELS) as SugerenciaEstado[])
    .map(
      (e) => `<option value="${e}"${e === f.estado ? " selected" : ""}>${escapeHtml(SUG_ESTADO_LABELS[e])}</option>`,
    )
    .join("");
  const estadoField =
    v.modalMode === "editar"
      ? `
      <div>
        <label class="${FORM_LABEL}" for="sug-form-estado">Estado</label>
        <div class="relative grid grid-cols-1">
          <select id="sug-form-estado" data-form="estado" class="${FORM_SELECT}">${estadoOpts}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>`
      : "";
  return `
    <div class="${MODAL_OVERLAY}" data-modal="sug-modal">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="sug-modal-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="sug-modal-titulo" class="text-base font-bold text-text-primary">${escapeHtml(titulo)}</h2>
          <button type="button" data-action="sug-modal-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.modalError ? `<div class="mb-3">${alertError(v.modalError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            <div>
              <label class="${FORM_LABEL}" for="sug-form-titulo">Título</label>
              <input id="sug-form-titulo" data-form="titulo" type="text" value="${escapeHtml(f.titulo)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="${FORM_LABEL}" for="sug-form-justificacion">Justificación</label>
              <textarea id="sug-form-justificacion" data-form="justificacion" rows="3" class="${FIELD_TEXTAREA}">${escapeHtml(f.justificacion)}</textarea>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="${FORM_LABEL}" for="sug-form-cursoId">Curso asignado</label>
                <div class="relative grid grid-cols-1">
                  <select id="sug-form-cursoId" data-form="cursoId" class="${FORM_SELECT}">${cursoOpts}</select>
                  ${SELECT_CHEVRON}
                </div>
              </div>
              ${renderSugField("Prioridad (1-5)", "prioridad", f.prioridad, { type: "number", min: "1", max: "5", step: "1" })}
              ${estadoField}
              ${renderSugField("Brecha interna (%)", "brechaPct", f.brechaPct, { type: "number", min: "0", max: "100", step: "any" })}
              ${renderSugField("Adopción del sector (%)", "adopcionPct", f.adopcionPct, { type: "number", min: "0", max: "100", step: "any" })}
              ${renderSugField("Personas alcanzables", "personas", f.personas, { type: "number", min: "0", step: "1" })}
              ${renderSugField("Duración sugerida", "duracion", f.duracion, { placeholder: "Ej. 16 horas" })}
              ${renderSugField("Inversión estimada", "inversion", f.inversion, { type: "number", min: "0", step: "any" })}
              ${renderSugField("Proveedor sugerido", "proveedor", f.proveedor)}
            </div>
            ${renderSugField("Capacidades afectadas (separadas por coma)", "capacidades", f.capacidades)}
            ${renderSugField("Áreas afectadas (separadas por coma)", "areas", f.areas)}
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="sug-modal-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="sug-modal-guardar" class="${BTN_PRIMARY}" ${v.saving ? "disabled" : ""}>${v.saving ? "Guardando…" : "Guardar"}</button>
        </footer>
      </div>
    </div>`;
}

function renderSugerenciasPage(v: SugerenciasView): string {
  const activas = v.items.filter((s) => s.estado === "activa").length;
  let body: string;
  if (v.loading) {
    body = `
      ${skeletonBlock({ className: "h-24 rounded-xl border border-border bg-white" })}
      ${skeletonBlock({ className: "h-40 rounded-xl border border-border bg-white" })}
      ${skeletonBlock({ className: "h-40 rounded-xl border border-border bg-white" })}`;
  } else if (v.error) {
    body = errorState({ message: v.error, actionLabel: "Reintentar", actionAttrs: 'data-action="sug-retry"' });
  } else if (v.items.length === 0) {
    body = `
      <div class="rounded-xl border border-border bg-white px-6 py-16 text-center">
        <p class="text-base font-semibold text-text-primary">Sin sugerencias todavía</p>
        <p class="mt-1 text-sm text-text-muted">Genera propuestas a partir de las brechas de un área con el control de arriba.</p>
      </div>`;
  } else {
    body = `
      ${renderSugKpis(v.items)}
      <div class="flex flex-col gap-4">
        ${v.items.map((s) => renderSugCard(mapSugerencia(s))).join("")}
      </div>`;
  }

  const actionErrorHtml = v.actionError
    ? `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">${escapeHtml(v.actionError)}</div>`
    : "";

  return `
  <div class="flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Motor de sugerencias &middot; ${activas} propuesta${activas === 1 ? "" : "s"} activa${activas === 1 ? "" : "s"}</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Cursos sugeridos por brecha y mercado</h1>
        <p class="mt-1 text-sm text-text-muted max-w-3xl">Recomendaciones generadas a partir de brechas internas detectadas y comparaci&oacute;n contra est&aacute;ndares del sector automotriz / manufactura.</p>
      </div>
      <div class="flex items-end gap-2 flex-wrap justify-end">
        <button type="button" data-action="sug-nueva" class="${BTN_PRIMARY}"${sugActionsBusy ? " disabled" : ""}>Nueva sugerencia</button>
        ${renderSugGenerarControl(v)}
      </div>
    </div>
    ${actionErrorHtml}
    ${body}
  </div>
  ${renderSugerenciaModal(v)}`;
}

export function mountSugerencias(container: HTMLElement, signal?: AbortSignal): void {
  const view: SugerenciasView = {
    items: [],
    areas: [],
    loading: true,
    error: null,
    actionError: null,
    generating: false,
    selectedAreaId: "",
    umbral: "0",
    modalOpen: false,
    modalMode: "crear",
    editId: null,
    saving: false,
    modalError: null,
    cursos: [],
    form: sugEmptyForm(),
  };

  const render = (): void => {
    mountAppShell(container, {
      pageTitle: "Sugerencias",
      activeNav: "sugerencias",
      mainHtml: renderSugerenciasPage(view),
    });
  };

  const detail = (e: unknown): string => {
    if (e && typeof e === "object" && "detail" in e) {
      const d = (e as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
    return (e as Error)?.message ?? "Ocurrió un error";
  };

  const refreshList = async (): Promise<void> => {
    try {
      const sugs = await listarSugerencias();
      if (signal?.aborted) return;
      view.items = sugs;
    } catch (e) {
      view.actionError = detail(e);
    }
  };

  const loadAll = async (): Promise<void> => {
    view.loading = true;
    view.error = null;
    render();
    try {
      const [sugs, areas, cursosResp] = await Promise.all([
        listarSugerencias(),
        getAreasOptions(),
        getCursos({ page_size: 500 }),
      ]);
      if (signal?.aborted) return;
      view.items = sugs;
      view.areas = areas;
      view.cursos = cursosResp.items.map((c) => ({ id: c.id, nombre: c.nombre }));
    } catch (e) {
      view.error = detail(e);
    }
    if (signal?.aborted) return;
    view.loading = false;
    render();
  };

  const cambiarEstado = async (id: number, estado: SugerenciaEstado): Promise<void> => {
    if (sugActionsBusy) return;
    sugActionsBusy = true;
    view.actionError = null;
    render();
    try {
      await actualizarSugerencia(id, { estado });
      await refreshList();
    } catch (e) {
      view.actionError = detail(e);
    }
    sugActionsBusy = false;
    if (!signal?.aborted) render();
  };

  const generar = async (): Promise<void> => {
    if (view.generating || sugActionsBusy) return;
    const areaId = Number(view.selectedAreaId);
    if (!areaId) {
      view.actionError = "Selecciona un área para generar sugerencias.";
      render();
      return;
    }
    const umbralNum = Number(view.umbral);
    view.generating = true;
    view.actionError = null;
    render();
    try {
      await generarSugerenciasDesdeBrechas({
        area_id: areaId,
        umbral_brecha: Number.isFinite(umbralNum) ? umbralNum : 0,
      });
      await refreshList();
    } catch (e) {
      view.actionError = detail(e);
    }
    view.generating = false;
    if (!signal?.aborted) render();
  };

  // ── Modal crear/editar ────────────────────────────────────────────────────
  const focusTopModal = (): void => {
    window.requestAnimationFrame(() => {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      const t = panel?.querySelector<HTMLElement>(SUG_FOCUSABLE_SELECTOR);
      t?.focus();
    });
  };

  const abrirModalCrear = (): void => {
    view.modalMode = "crear";
    view.editId = null;
    view.form = sugEmptyForm();
    view.modalError = null;
    view.modalOpen = true;
    render();
    focusTopModal();
  };

  const abrirModalEditar = (id: number): void => {
    const r = view.items.find((s) => s.id === id);
    if (!r) return;
    view.modalMode = "editar";
    view.editId = id;
    view.form = {
      titulo: r.titulo ?? "",
      justificacion: r.justificacion ?? "",
      prioridad: r.prioridad != null ? String(r.prioridad) : "",
      estado: r.estado,
      cursoId: r.curso_id != null ? String(r.curso_id) : "",
      brechaPct: r.brecha_pct != null ? String(r.brecha_pct) : "",
      adopcionPct: r.adopcion_sector_pct != null ? String(r.adopcion_sector_pct) : "",
      personas: r.personas_alcanzables != null ? String(r.personas_alcanzables) : "",
      duracion: r.duracion_sugerida ?? "",
      inversion: r.inversion_estimada != null ? String(r.inversion_estimada) : "",
      proveedor: r.proveedor_sugerido ?? "",
      capacidades: (r.capacidades_afectadas ?? []).join(", "),
      areas: (r.areas_afectadas ?? []).join(", "),
    };
    view.modalError = null;
    view.modalOpen = true;
    render();
    focusTopModal();
  };

  const parseNum = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const parseCsv = (s: string): string[] | null => {
    const arr = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  };

  const guardarModal = async (): Promise<void> => {
    if (view.saving) return;
    const titulo = view.form.titulo.trim();
    if (!titulo) {
      view.modalError = "El título es obligatorio.";
      render();
      focusTopModal();
      return;
    }
    view.saving = true;
    view.modalError = null;
    render();
    const f = view.form;
    const base = {
      titulo,
      justificacion: f.justificacion.trim() || null,
      curso_id: parseNum(f.cursoId),
      prioridad: parseNum(f.prioridad) ?? undefined,
      brecha_pct: parseNum(f.brechaPct),
      adopcion_sector_pct: parseNum(f.adopcionPct),
      capacidades_afectadas: parseCsv(f.capacidades),
      areas_afectadas: parseCsv(f.areas),
      personas_alcanzables: parseNum(f.personas),
      duracion_sugerida: f.duracion.trim() || null,
      inversion_estimada: parseNum(f.inversion),
      proveedor_sugerido: f.proveedor.trim() || null,
    };
    try {
      if (view.modalMode === "crear") {
        const payload: SugerenciaCreatePayload = { ...base };
        await crearSugerencia(payload);
      } else if (view.editId != null) {
        const payload: SugerenciaUpdatePayload = { ...base, estado: f.estado as SugerenciaEstado };
        await actualizarSugerencia(view.editId, payload);
      }
      if (signal?.aborted) return;
      view.modalOpen = false;
      await refreshList();
    } catch (e) {
      view.modalError = detail(e);
    }
    view.saving = false;
    if (!signal?.aborted) render();
  };

  const eliminarSug = async (id: number): Promise<void> => {
    if (!confirm("¿Eliminar esta sugerencia?")) return;
    if (sugActionsBusy) return;
    sugActionsBusy = true;
    view.actionError = null;
    render();
    try {
      await eliminarSugerencia(id);
      await refreshList();
    } catch (e) {
      view.actionError = detail(e);
    }
    sugActionsBusy = false;
    if (!signal?.aborted) render();
  };

  const syncFormField = (target: HTMLElement): void => {
    const campo = (target as HTMLElement).dataset?.form as keyof SugForm | undefined;
    if (!campo) return;
    view.form[campo] = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "sug-estado") {
      const id = Number(btn.dataset.id);
      const estado = btn.dataset.estado as SugerenciaEstado | undefined;
      if (id && estado) void cambiarEstado(id, estado);
    } else if (action === "sug-generar") {
      void generar();
    } else if (action === "sug-retry") {
      void loadAll();
    } else if (action === "sug-nueva") {
      abrirModalCrear();
    } else if (action === "sug-editar") {
      const id = Number(btn.dataset.id);
      if (id) abrirModalEditar(id);
    } else if (action === "sug-eliminar") {
      const id = Number(btn.dataset.id);
      if (id) void eliminarSug(id);
    } else if (action === "sug-modal-cerrar") {
      view.modalOpen = false;
      render();
    } else if (action === "sug-modal-guardar") {
      void guardarModal();
    }
  };

  const onChange = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.dataset?.form) {
      syncFormField(target);
      return;
    }
    const action = (target as HTMLElement).dataset?.action;
    if (action === "sug-area-select") {
      view.selectedAreaId = (target as HTMLSelectElement).value;
    } else if (action === "sug-umbral") {
      view.umbral = (target as HTMLInputElement).value;
    }
  };

  const onInput = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.form) syncFormField(target);
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (!view.modalOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      view.modalOpen = false;
      render();
      return;
    }
    if (e.key === "Tab") {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(SUG_FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  };

  const listenerOpts = signal ? { signal } : undefined;
  container.addEventListener("click", onClick, listenerOpts);
  container.addEventListener("change", onChange, listenerOpts);
  container.addEventListener("input", onInput, listenerOpts);
  container.addEventListener("keydown", handleKeydown, listenerOpts);

  void loadAll();
}

// ── Encuestas: helpers de render (datos reales del dashboard) ────────────────

function encFmtScore(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1);
}

function encScorePill(score: number): string {
  let cls: string;
  if (score >= 4.5) cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
  else if (score >= 4.0) cls = "border-blue-200 bg-blue-50 text-blue-800";
  else if (score >= 3.5) cls = "border-amber-200 bg-amber-50 text-amber-800";
  else cls = "border-red-200 bg-red-50 text-red-800";
  return `<span class="inline-flex items-center gap-1 rounded-full border ${cls} px-2 py-0.5 text-[10px] font-semibold tabular-nums"><svg class="size-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>${score.toFixed(1)}</span>`;
}

function encHorizBar(value: number, max: number, color: string): string {
  const pct = Math.round((value / max) * 100);
  return `
  <div class="flex items-center gap-1.5">
    <div class="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
      <div class="h-full rounded-full ${color}" style="width: ${pct}%"></div>
    </div>
    <span class="text-[10px] font-semibold tabular-nums text-slate-600">${value.toFixed(1)}</span>
  </div>`;
}

function renderEncKpis(d: EncuestasDashboard): string {
  const kpis: Array<{ label: string; value: string; sub: string; sup?: string; isText?: boolean }> = [
    { label: "Encuestas recibidas", value: String(d.total_evaluaciones), sub: "Respuestas registradas" },
    { label: "Score medio", value: encFmtScore(d.score_medio), sup: "/5", sub: "Promedio general" },
    { label: "Cursos evaluados", value: String(d.cursos_evaluados), sub: "Con al menos una respuesta" },
    { label: "Cursos en alerta", value: String(d.cursos_en_alerta), sub: "Score promedio < 3.5" },
  ];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 ${k.isText ? "text-base" : "text-2xl"} font-bold tabular-nums text-text-primary">${escapeHtml(k.value)}${k.sup ? `<span class="text-sm font-medium text-slate-400">${k.sup}</span>` : ""}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function encBarCell(value: number | null): string {
  if (value == null) return `<span class="text-[10px] text-slate-400">—</span>`;
  return encHorizBar(value, 5, value >= 4.0 ? "bg-blue-500" : value >= 3.5 ? "bg-amber-400" : "bg-red-400");
}

function renderEncTabla(cursos: DashboardCursoItem[]): string {
  const rows = cursos.map(c => {
    const warn = c.promedio_general != null && c.promedio_general < 3.5;
    const alertBadge = warn ? `<span class="ml-1.5 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Alerta</span>` : "";
    return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="px-3 py-2.5">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-medium text-slate-900 truncate max-w-[200px]">${escapeHtml(c.curso_nombre)}</span>
          ${alertBadge}
        </div>
      </td>
      <td class="px-3 py-2.5 text-xs text-slate-600">${escapeHtml(c.instructor_nombre ?? "—")}</td>
      <td class="px-3 py-2.5 text-xs text-slate-600">${escapeHtml(c.proveedor_nombre ?? "—")}</td>
      <td class="px-3 py-2.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-700">${c.total_evaluaciones}</td>
      <td class="px-3 py-2.5">${encBarCell(c.promedio_contenido)}</td>
      <td class="px-3 py-2.5">${encBarCell(c.promedio_instructor)}</td>
      <td class="px-3 py-2.5">${encBarCell(c.promedio_aplicabilidad)}</td>
      <td class="px-3 py-2.5 text-center">${c.promedio_general != null ? encScorePill(c.promedio_general) : `<span class="text-[10px] text-slate-400">—</span>`}</td>
    </tr>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white flex flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <div>
        <p class="text-sm font-semibold text-text-primary">Score por curso</p>
        <p class="text-[11px] text-slate-500">Promedio de las encuestas respondidas</p>
      </div>
    </div>
    ${cursos.length === 0 ? `<p class="px-5 py-10 text-center text-sm text-slate-500">Aún no hay cursos con evaluaciones.</p>` : `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Curso</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Instructor</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Proveedor</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">N</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contenido</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Instructor</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aplicabilidad</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Score</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`}
  </div>`;
}

const ENC_DIST_COLORS: Record<number, string> = {
  5: "bg-emerald-500",
  4: "bg-blue-500",
  3: "bg-amber-400",
  2: "bg-blue-400",
  1: "bg-red-500",
};

function renderEncDistribucion(distribucion: DistribucionItem[]): string {
  const byScore = new Map<number, number>();
  for (const item of distribucion) byScore.set(item.score, item.cantidad);
  const total = distribucion.reduce((acc, item) => acc + item.cantidad, 0);
  const data = [5, 4, 3, 2, 1].map((star) => {
    const count = byScore.get(star) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { star, count, pct, color: ENC_DIST_COLORS[star] };
  });
  const rows = data.map(d => `
    <div class="flex items-center gap-2.5">
      <span class="w-3 text-right text-xs font-semibold tabular-nums text-slate-700">${d.star}</span>
      <svg class="size-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
      <div class="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-full rounded-full ${d.color}" style="width: ${d.pct}%"></div>
      </div>
      <span class="w-8 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-700">${d.count}</span>
      <span class="w-8 text-right text-[11px] text-slate-500 tabular-nums">${d.pct}%</span>
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white p-5 flex flex-col gap-4">
    <div>
      <p class="text-sm font-semibold text-text-primary">Distribuci&oacute;n de respuestas</p>
      <p class="text-[11px] text-slate-500">Escala 1 a 5 &middot; ${total} ${total === 1 ? "respuesta" : "respuestas"}</p>
    </div>
    <div class="flex flex-col gap-2.5">
      ${rows}
    </div>
  </div>`;
}

function encComentarioSentimiento(score: number): "positivo" | "neutro" | "mejora" {
  if (score >= 4) return "positivo";
  if (score >= 3) return "neutro";
  return "mejora";
}

function renderEncComentarios(comentarios: ComentarioItem[]): string {
  const sentColors: Record<string, string> = {
    positivo: "border-l-emerald-400",
    neutro: "border-l-amber-400",
    mejora: "border-l-blue-400",
  };
  if (comentarios.length === 0) {
    return `
    <div class="rounded-xl border border-border bg-white p-5 flex flex-col gap-3">
      <p class="text-sm font-semibold text-text-primary">Comentarios destacados</p>
      <p class="text-xs text-slate-500">Aún no hay comentarios registrados.</p>
    </div>`;
  }
  const items = comentarios.map(c => {
    const sentimiento = encComentarioSentimiento(c.score_general);
    const fecha = (() => {
      const d = new Date(c.fecha);
      return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    })();
    return `
    <div class="border-l-[3px] ${sentColors[sentimiento]} rounded-r-lg bg-slate-50 px-3 py-2.5">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-semibold text-amber-500">&starf; ${c.score_general}</span>
        <span class="text-[11px] font-medium text-slate-700">${escapeHtml(c.empleado_nombre ?? "Anónimo")}</span>
        ${fecha ? `<span class="text-[10px] text-slate-400">${escapeHtml(fecha)}</span>` : ""}
      </div>
      <p class="mt-1.5 text-xs italic text-slate-600 leading-relaxed">&ldquo;${escapeHtml(c.comentario)}&rdquo;</p>
    </div>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white p-5 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-text-primary">Comentarios destacados</p>
        <p class="text-[11px] text-slate-500">Retroalimentación de los asistentes</p>
      </div>
    </div>
    <div class="flex flex-col gap-2.5">
      ${items}
    </div>
  </div>`;
}

function renderEncuestasHeader(): string {
  return pageHeading(
    "Encuestas post curso",
    "Score consolidado por curso, instructor y proveedor; insumo para la mejora continua de la oferta formativa de la planta.",
  );
}

function renderEncuestasPage(data: EncuestasDashboard | null, loading: boolean, error: string | null): string {
  let body: string;
  if (loading) {
    body = `<div class="rounded-xl border border-border bg-white px-6 py-16 text-center text-sm text-text-muted" aria-busy="true">Cargando resultados…</div>`;
  } else if (error) {
    body = `<div class="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700" role="alert">${escapeHtml(error)}</div>`;
  } else if (!data || data.total_evaluaciones === 0) {
    body = `
      <div class="rounded-xl border border-border bg-white px-6 py-16 text-center">
        <p class="text-base font-semibold text-text-primary">Sin evaluaciones todavía</p>
        <p class="mt-1 text-sm text-text-muted">Cuando los asistentes respondan las encuestas habilitadas, aquí verás el resumen consolidado.</p>
      </div>`;
  } else {
    body = `
      ${renderEncKpis(data)}
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        ${renderEncTabla(data.cursos)}
        <div class="flex flex-col gap-5">
          ${renderEncDistribucion(data.distribucion)}
          ${renderEncComentarios(data.comentarios)}
        </div>
      </div>`;
  }
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}">
    ${renderEncuestasHeader()}
    ${body}
  </div>`;
}

export function mountEncuestas(container: HTMLElement): void {
  let data: EncuestasDashboard | null = null;
  let loading = true;
  let error: string | null = null;

  const render = (): void => {
    mountAppShell(container, {
      pageTitle: "Encuestas Post Curso",
      activeNav: "encuestas",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderEncuestasPage(data, loading, error),
    });
  };

  render();

  void getEncuestasDashboard()
    .then((d) => {
      data = d;
      loading = false;
      render();
    })
    .catch((e: unknown) => {
      error = (e as Error)?.message ?? "No se pudo cargar el dashboard de encuestas";
      loading = false;
      render();
    });
}
