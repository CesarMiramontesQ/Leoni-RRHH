import {
  getCursosDashboardHistorialEmpleado,
  getCursosDashboardResumen,
} from "../api/cursosSeguimiento.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import {
  renderCursosEmpleadoConsulta,
  type EmpleadoBusquedaItem,
} from "../components/cursos/rhCursosEmpleadoConsulta.ts";
import { renderCursosSeguimientoKpis } from "../components/cursos/rhCursosSeguimientoKpis.ts";
import { renderVistaRapida } from "../components/cursos/rhCursosSeguimientoVistaRapida.ts";
import type {
  CursosDashboardEmpleadoHistorial,
  CursosDashboardResumen,
  EstadoCursoEmpleado,
} from "../dashboard/cursos/seguimientoTypes.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import { RH_LISTADO_PAGE_OUTER } from "../ui/uiTokens.ts";

const EMPLEADO_SEARCH_PAGE_SIZE = 10;

interface State {
  resumen: CursosDashboardResumen | null;
  loadingResumen: boolean;
  empleadoSearchQ: string;
  empleadoSearchResults: EmpleadoBusquedaItem[];
  empleadoSearchPage: number;
  empleadoSearchTotal: number;
  empleadoSearching: boolean;
  selectedEmpleadoId: number | null;
  historial: CursosDashboardEmpleadoHistorial | null;
  historialLoading: boolean;
  historialFiltroEstado: string;
}

export function mountCursosSeguimiento(container: HTMLElement): void {
  const state: State = {
    resumen: null,
    loadingResumen: true,
    empleadoSearchQ: "",
    empleadoSearchResults: [],
    empleadoSearchPage: 1,
    empleadoSearchTotal: 0,
    empleadoSearching: false,
    selectedEmpleadoId: null,
    historial: null,
    historialLoading: false,
    historialFiltroEstado: "",
  };

  let empleadoSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  let empleadoSearchToken = 0;

  async function loadResumen(): Promise<void> {
    state.loadingResumen = true;
    try {
      state.resumen = await getCursosDashboardResumen({ soloActivos: true });
    } catch {
      state.resumen = null;
    }
    state.loadingResumen = false;
    render();
  }

  async function loadHistorialEmpleado(empleadoId: number): Promise<void> {
    state.selectedEmpleadoId = empleadoId;
    state.historialLoading = true;
    state.historial = null;
    render();
    try {
      state.historial = await getCursosDashboardHistorialEmpleado(empleadoId, {
        estadoCurso: (state.historialFiltroEstado || undefined) as EstadoCursoEmpleado | undefined,
        soloActivos: true,
      });
    } catch {
      state.historial = null;
    }
    state.historialLoading = false;
    render();
  }

  async function searchEmpleados(q: string, page = 1): Promise<void> {
    if (q.trim().length < 2) {
      state.empleadoSearchResults = [];
      state.empleadoSearchPage = 1;
      state.empleadoSearchTotal = 0;
      state.empleadoSearching = false;
      render();
      return;
    }
    const token = ++empleadoSearchToken;
    state.empleadoSearchPage = page;
    state.empleadoSearching = true;
    render();
    try {
      const pageRes = await getEmpleadosPage({
        page,
        page_size: EMPLEADO_SEARCH_PAGE_SIZE,
        q: q.trim(),
        activo: true,
      });
      if (token !== empleadoSearchToken) return;
      state.empleadoSearchTotal = pageRes.total;
      state.empleadoSearchResults = pageRes.items.map((i) => ({
        empleado_id: i.id,
        no_empleado: formatNoEmpleadoDisplay(i.no_empleado) || String(i.no_empleado ?? ""),
        nombre: i.nombre,
        area: i.area?.descripcion ?? null,
      }));
    } catch {
      if (token !== empleadoSearchToken) return;
      state.empleadoSearchResults = [];
      state.empleadoSearchTotal = 0;
    }
    state.empleadoSearching = false;
    render();
  }

  function clearEmpleado(): void {
    state.selectedEmpleadoId = null;
    state.historial = null;
    state.historialLoading = false;
    state.historialFiltroEstado = "";
    state.empleadoSearchQ = "";
    state.empleadoSearchResults = [];
    state.empleadoSearchPage = 1;
    state.empleadoSearchTotal = 0;
    state.empleadoSearching = false;
    render();
    container.querySelector<HTMLInputElement>("#seg-empleado-search")?.focus();
  }

  function renderContent(): string {
    const resumen = state.resumen;
    return `<div class="${RH_LISTADO_PAGE_OUTER} ss-page cs-page">
      ${renderLevelUpBackBar()}
      ${renderCursosSeguimientoKpis(resumen?.kpis ?? null, state.loadingResumen)}
      <div class="cs-content-stack flex flex-col gap-4 sm:gap-5">
        ${
          resumen && !state.loadingResumen
            ? `<section class="flex flex-col gap-3" aria-labelledby="cs-vista-rapida-heading">
                <div>
                  <h2 id="cs-vista-rapida-heading" class="text-sm font-semibold text-text-primary">Vista rápida</h2>
                  <p class="mt-0.5 text-xs text-text-muted">Accesos directos a pendientes y sesiones próximas.</p>
                </div>
                ${renderVistaRapida({
                  empleadosCursosPendientes: resumen.empleados_cursos_pendientes,
                  empleadosSesionesPendientes: resumen.empleados_sesiones_pendientes,
                  sesionesProximas: resumen.sesiones_proximas,
                })}
              </section>`
            : ""
        }
        <section class="flex flex-col gap-3" aria-labelledby="cs-consulta-heading">
          <div>
            <h2 id="cs-consulta-heading" class="text-sm font-semibold text-text-primary">Consulta por empleado</h2>
            <p class="mt-0.5 text-xs text-text-muted">Revisa cursos y sesiones pendientes o en curso del colaborador.</p>
          </div>
          ${renderCursosEmpleadoConsulta({
            searchQ: state.empleadoSearchQ,
            searching: state.empleadoSearching,
            results: state.empleadoSearchResults,
            resultsPage: state.empleadoSearchPage,
            resultsTotal: state.empleadoSearchTotal,
            resultsPageSize: EMPLEADO_SEARCH_PAGE_SIZE,
            selectedEmpleadoId: state.selectedEmpleadoId,
            historial: state.historial,
            historialLoading: state.historialLoading,
            historialFiltroEstado: state.historialFiltroEstado,
          })}
        </section>
      </div>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Seguimiento de capacitaciones",
      activeNav: "cursos-seguimiento",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderContent(),
    });
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "emp-search-page") {
      const page = Number(actionEl.dataset.page) || 1;
      if (page !== state.empleadoSearchPage) {
        await searchEmpleados(state.empleadoSearchQ, page);
      }
      return;
    }
    if (action === "emp-search-prev") {
      if (state.empleadoSearchPage > 1) {
        await searchEmpleados(state.empleadoSearchQ, state.empleadoSearchPage - 1);
      }
      return;
    }
    if (action === "emp-search-next") {
      const totalPages = Math.max(1, Math.ceil(state.empleadoSearchTotal / EMPLEADO_SEARCH_PAGE_SIZE));
      if (state.empleadoSearchPage < totalPages) {
        await searchEmpleados(state.empleadoSearchQ, state.empleadoSearchPage + 1);
      }
      return;
    }
    if (action === "open-empleado" || action === "pick-empleado") {
      const id = Number(actionEl.dataset.empleadoId);
      if (id) {
        state.empleadoSearchQ = "";
        state.empleadoSearchResults = [];
        state.empleadoSearchPage = 1;
        state.empleadoSearchTotal = 0;
        await loadHistorialEmpleado(id);
        document.getElementById("cs-consulta-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (action === "clear-empleado") {
      clearEmpleado();
      return;
    }
    if (action === "hist-filtro-estado") {
      state.historialFiltroEstado = actionEl.dataset.estado ?? "";
      if (state.selectedEmpleadoId) await loadHistorialEmpleado(state.selectedEmpleadoId);
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.id !== "seg-empleado-search" || !(t instanceof HTMLInputElement)) return;
    state.empleadoSearchQ = t.value;
    if (empleadoSearchTimeout) clearTimeout(empleadoSearchTimeout);
    empleadoSearchTimeout = setTimeout(() => void searchEmpleados(t.value, 1), 300);
  }

  render();
  container.addEventListener("click", (e) => void handleClick(e));
  container.addEventListener("input", handleInput);

  void loadResumen();
}
