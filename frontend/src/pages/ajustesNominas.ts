import { getEmpleadosPage } from "../api/empleados.ts";
import {
  createHorasExtraAprobadores,
  deleteHorasExtraAprobador,
  getHorasExtraAprobadores,
  getHorasExtraAutorizados,
  setHorasExtraAutorizacion,
  type HorasExtraAprobadoresListResponse,
  type HorasExtraAprobadorItem,
  type HorasExtraAutorizadoItem,
  type NominasAjustesFetchError,
} from "../api/nominasAjustes.ts";
import type { UsuarioListItem } from "../api/usuarios.ts";
import { canAccessNominasAjustesPage } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderAjustesNominasPage } from "../nominas/ajustes/renderAjustesNominasPage.ts";
import type {
  AjustesNominasModalState,
  AjustesNominasState,
  AprobadorCandidato,
  AprobadoresModalState,
  AprobadorItem,
  AprobadorTipo,
} from "../nominas/ajustes/types.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SIZE = 10;
const MODAL_RESULTS_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const SHELL_OPTS = {
  pageTitle: "Ajustes de Nóminas",
  activeNav: "nominas-ajustes" as const,
  mainClass: "pt-0 pb-5 sm:pb-6",
};

type FocusTarget = "table-search" | "modal-search" | "aprobadores-modal-search" | null;

function initialState(): AjustesNominasState {
  return {
    status: "loading",
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    q: "",
    stats: null,
    revokingId: null,
    modal: null,
    aprobadores: {
      loading: true,
      mutatingId: null,
      gerentes: [],
      directores: [],
      modal: null,
    },
  };
}

function initialModalState(): AjustesNominasModalState {
  return {
    q: "",
    searching: true,
    searched: false,
    results: [],
    seleccionados: new Map<number, HorasExtraAutorizadoItem>(),
    submitting: false,
  };
}

function initialAprobadoresModalState(tipo: AprobadorTipo): AprobadoresModalState {
  return {
    tipo,
    q: "",
    searching: true,
    searched: false,
    results: [],
    seleccionados: new Map<number, AprobadorCandidato>(),
    submitting: false,
  };
}

function toAprobadorCandidato(item: UsuarioListItem): AprobadorCandidato {
  const areaPuesto = [item.area?.descripcion, item.puesto?.descripcion]
    .filter(Boolean)
    .join(" · ");
  return {
    // PK de empleados (el API espera empleado_ids = empleados.id, no empleado_id).
    empleadoId: item.id,
    noEmpleado: item.no_empleado,
    nombre: item.nombre,
    email: item.email,
    areaPuesto: areaPuesto || null,
  };
}

function toAprobadorItem(item: HorasExtraAprobadorItem): AprobadorItem {
  const areaPuesto = [item.area_descripcion, item.puesto_descripcion]
    .filter(Boolean)
    .join(" · ");
  return {
    id: item.id,
    empleadoId: item.empleado_id,
    noEmpleado: item.no_empleado,
    nombre: item.nombre,
    email: item.email,
    areaPuesto: areaPuesto || null,
    activo: item.activo,
  };
}

function mapAprobadoresResponse(data: HorasExtraAprobadoresListResponse): {
  gerentes: AprobadorItem[];
  directores: AprobadorItem[];
} {
  return {
    gerentes: data.gerentes.map(toAprobadorItem),
    directores: data.directores.map(toAprobadorItem),
  };
}

function isAuthError(err: NominasAjustesFetchError): boolean {
  return err.status === 401;
}

export function mountAjustesNominas(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessNominasAjustesPage()) {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: htmlAccessDenied({
        title: "Acceso restringido",
        description: "Esta página solo está disponible para usuarios con rol RH.",
      }),
    });
    return;
  }

  let state = initialState();
  let tableSearchTimer: number | undefined;
  let modalSearchTimer: number | undefined;
  let modalSearchSeq = 0;
  let aprobadoresSearchTimer: number | undefined;
  let aprobadoresSearchSeq = 0;

  const setBodyScrollLocked = (locked: boolean): void => {
    document.body.style.overflow = locked ? "hidden" : "";
  };

  signal?.addEventListener("abort", () => setBodyScrollLocked(false));

  const render = (focus: FocusTarget = null): void => {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: renderAjustesNominasPage(state),
    });
    setBodyScrollLocked(state.modal !== null || state.aprobadores.modal !== null);
    bindEvents();
    if (focus) {
      const selectors: Record<Exclude<FocusTarget, null>, string> = {
        "table-search": "#aj-he-busqueda",
        "modal-search": "#aj-he-modal-busqueda",
        "aprobadores-modal-search": "#aj-ap-modal-busqueda",
      };
      const input = container.querySelector<HTMLInputElement>(selectors[focus]);
      if (input) {
        const len = input.value.length;
        input.focus();
        input.setSelectionRange(len, len);
      }
    }
  };

  const handleAuthError = (err: NominasAjustesFetchError): boolean => {
    if (!isAuthError(err)) return false;
    setBodyScrollLocked(false);
    clearAuth();
    window.location.hash = "#/login";
    return true;
  };

  const load = async (focus: FocusTarget = null): Promise<void> => {
    state = { ...state, status: "loading" };
    render(focus);
    try {
      const data = await getHorasExtraAutorizados({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q,
        filtro: "autorizados",
      });
      if (signal?.aborted) return;
      state = {
        ...state,
        status: "ready",
        items: data.items,
        total: data.total,
        stats: data.stats,
        page: data.page,
        pageSize: data.page_size,
        errorMessage: undefined,
      };
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      state = {
        ...state,
        status: "error",
        errorMessage: err.detail ?? "No se pudo cargar el listado de empleados autorizados.",
      };
    }
    if (signal?.aborted) return;
    render(focus);
  };

  const retirarAutorizacion = async (empleadoId: number): Promise<void> => {
    if (state.revokingId !== null) return;
    const empleado = state.items.find((item) => item.id === empleadoId);
    state = { ...state, revokingId: empleadoId, successMessage: undefined, errorMessage: undefined };
    render();
    try {
      await setHorasExtraAutorizacion([empleadoId], false);
      if (signal?.aborted) return;
      state = {
        ...state,
        revokingId: null,
        successMessage: `Autorización retirada a ${empleado?.nombre ?? "1 empleado"}.`,
      };
      await load();
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted) return;
      state = {
        ...state,
        revokingId: null,
        errorMessage: err.detail ?? "No se pudo retirar la autorización.",
      };
      render();
    }
  };

  const buscarDisponibles = async (q: string): Promise<void> => {
    if (!state.modal) return;
    const seq = ++modalSearchSeq;
    state = { ...state, modal: { ...state.modal, q, searching: true, errorMessage: undefined } };
    render("modal-search");
    try {
      const data = await getHorasExtraAutorizados({
        page: 1,
        pageSize: MODAL_RESULTS_LIMIT,
        q,
        filtro: "no_autorizados",
      });
      if (signal?.aborted || seq !== modalSearchSeq || !state.modal) return;
      state = {
        ...state,
        modal: {
          ...state.modal,
          searching: false,
          searched: true,
          results: data.items.filter((item) => !item.autorizado),
        },
      };
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted || seq !== modalSearchSeq || !state.modal) return;
      state = {
        ...state,
        modal: {
          ...state.modal,
          searching: false,
          searched: true,
          results: [],
          errorMessage: err.detail ?? "No se pudieron buscar empleados disponibles.",
        },
      };
    }
    render("modal-search");
  };

  const abrirModal = (): void => {
    state = { ...state, modal: initialModalState(), successMessage: undefined, errorMessage: undefined };
    render();
    void buscarDisponibles("");
  };

  const cerrarModal = (): void => {
    if (state.modal?.submitting) return;
    if (modalSearchTimer !== undefined) window.clearTimeout(modalSearchTimer);
    modalSearchSeq += 1;
    state = { ...state, modal: null };
    render();
  };

  const toggleSeleccion = (empleadoId: number, checked: boolean): void => {
    if (!state.modal) return;
    const seleccionados = new Map(state.modal.seleccionados);
    if (checked) {
      const emp = state.modal.results.find((item) => item.id === empleadoId);
      if (!emp) return;
      seleccionados.set(empleadoId, emp);
    } else {
      seleccionados.delete(empleadoId);
    }
    state = { ...state, modal: { ...state.modal, seleccionados } };
    render();
  };

  const confirmarAutorizacion = async (): Promise<void> => {
    const modal = state.modal;
    if (!modal || modal.submitting || modal.seleccionados.size === 0) return;
    const ids = [...modal.seleccionados.keys()];
    state = { ...state, modal: { ...modal, submitting: true, errorMessage: undefined } };
    render();
    try {
      const resultado = await setHorasExtraAutorizacion(ids, true);
      if (signal?.aborted) return;
      state = {
        ...state,
        modal: null,
        stats: resultado.stats,
        page: 1,
        successMessage: `Autorización otorgada a ${ids.length} ${ids.length === 1 ? "empleado" : "empleados"}.`,
      };
      await load();
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted || !state.modal) return;
      state = {
        ...state,
        modal: {
          ...state.modal,
          submitting: false,
          errorMessage: err.detail ?? "No se pudo completar la autorización.",
        },
      };
      render();
    }
  };

  // ── Configuración de aprobadores ──

  const setAprobadores = (
    patch: Partial<AjustesNominasState["aprobadores"]>,
    focus: FocusTarget = null,
  ): void => {
    state = { ...state, aprobadores: { ...state.aprobadores, ...patch } };
    render(focus);
  };

  const cargarAprobadores = async (): Promise<void> => {
    try {
      const data = await getHorasExtraAprobadores();
      if (signal?.aborted) return;
      setAprobadores({ loading: false, ...mapAprobadoresResponse(data) });
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted) return;
      setAprobadores({
        loading: false,
        errorMessage: err.detail ?? "No se pudo cargar la configuración de aprobadores.",
      });
    }
  };

  const buscarCandidatosAprobador = async (q: string): Promise<void> => {
    const modal = state.aprobadores.modal;
    if (!modal) return;
    const seq = ++aprobadoresSearchSeq;
    setAprobadores(
      { modal: { ...modal, q, searching: true, errorMessage: undefined } },
      "aprobadores-modal-search",
    );
    try {
      const data = await getEmpleadosPage({ page: 1, page_size: MODAL_RESULTS_LIMIT, q, activo: true });
      if (signal?.aborted || seq !== aprobadoresSearchSeq || !state.aprobadores.modal) return;
      const tipo = state.aprobadores.modal.tipo;
      const registrados = new Set(
        (tipo === "director" ? state.aprobadores.directores : state.aprobadores.gerentes).map(
          (item) => item.empleadoId,
        ),
      );
      setAprobadores(
        {
          modal: {
            ...state.aprobadores.modal,
            searching: false,
            searched: true,
            results: data.items
              .map(toAprobadorCandidato)
              .filter((emp) => !registrados.has(emp.empleadoId)),
          },
        },
        "aprobadores-modal-search",
      );
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted || seq !== aprobadoresSearchSeq || !state.aprobadores.modal) return;
      setAprobadores(
        {
          modal: {
            ...state.aprobadores.modal,
            searching: false,
            searched: true,
            results: [],
            errorMessage: err.detail ?? "No se pudieron buscar empleados.",
          },
        },
        "aprobadores-modal-search",
      );
    }
  };

  const abrirModalAprobadores = (tipo: AprobadorTipo): void => {
    setAprobadores({
      modal: initialAprobadoresModalState(tipo),
      successMessage: undefined,
      errorMessage: undefined,
    });
    void buscarCandidatosAprobador("");
  };

  const cerrarModalAprobadores = (): void => {
    if (state.aprobadores.modal?.submitting) return;
    if (aprobadoresSearchTimer !== undefined) window.clearTimeout(aprobadoresSearchTimer);
    aprobadoresSearchSeq += 1;
    setAprobadores({ modal: null });
  };

  const toggleSeleccionAprobador = (empleadoId: number, checked: boolean): void => {
    const modal = state.aprobadores.modal;
    if (!modal) return;
    // El modal de director solo admite una selección a la vez.
    const seleccionados =
      modal.tipo === "director"
        ? new Map<number, AprobadorCandidato>()
        : new Map(modal.seleccionados);
    if (checked) {
      const emp = modal.results.find((item) => item.empleadoId === empleadoId);
      if (!emp) return;
      seleccionados.set(empleadoId, emp);
    } else {
      seleccionados.delete(empleadoId);
    }
    setAprobadores({ modal: { ...modal, seleccionados } });
  };

  const guardarAprobadores = async (): Promise<void> => {
    const modal = state.aprobadores.modal;
    if (!modal || modal.submitting || modal.seleccionados.size === 0) return;
    const seleccion = [...modal.seleccionados.values()];
    setAprobadores({ modal: { ...modal, submitting: true, errorMessage: undefined } });
    try {
      const data = await createHorasExtraAprobadores(
        modal.tipo,
        seleccion.map((emp) => emp.empleadoId),
      );
      if (signal?.aborted) return;
      const successMessage =
        modal.tipo === "director"
          ? "Director agregado como aprobador."
          : `${seleccion.length} ${seleccion.length === 1 ? "gerente regional agregado" : "gerentes regionales agregados"} como ${seleccion.length === 1 ? "aprobador" : "aprobadores"}.`;
      setAprobadores({
        ...mapAprobadoresResponse(data),
        modal: null,
        successMessage,
        errorMessage: undefined,
      });
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted || !state.aprobadores.modal) return;
      setAprobadores({
        modal: {
          ...state.aprobadores.modal,
          submitting: false,
          errorMessage: err.detail ?? "No se pudieron guardar los aprobadores.",
        },
      });
    }
  };

  const buscarAprobadorPorId = (aprobadorId: number): AprobadorItem | undefined =>
    state.aprobadores.gerentes.find((entry) => entry.id === aprobadorId) ??
    state.aprobadores.directores.find((entry) => entry.id === aprobadorId);

  const eliminarAprobador = async (aprobadorId: number): Promise<void> => {
    if (state.aprobadores.mutatingId !== null) return;
    const item = buscarAprobadorPorId(aprobadorId);
    if (!item) return;
    setAprobadores({ mutatingId: aprobadorId, successMessage: undefined, errorMessage: undefined });
    try {
      const data = await deleteHorasExtraAprobador(aprobadorId);
      if (signal?.aborted) return;
      setAprobadores({
        mutatingId: null,
        ...mapAprobadoresResponse(data),
        successMessage: `${item.nombre} eliminado de los aprobadores.`,
      });
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (handleAuthError(err)) return;
      if (signal?.aborted) return;
      setAprobadores({
        mutatingId: null,
        errorMessage: err.detail ?? "No se pudo eliminar el aprobador.",
      });
    }
  };

  const bindEvents = (): void => {
    const root = container.querySelector("#ajustes-nominas-page");
    if (!root) return;

    root.querySelector<HTMLInputElement>("#aj-he-busqueda")?.addEventListener("input", (ev) => {
      const value = (ev.target as HTMLInputElement).value;
      if (tableSearchTimer !== undefined) window.clearTimeout(tableSearchTimer);
      tableSearchTimer = window.setTimeout(() => {
        state = { ...state, q: value, page: 1, successMessage: undefined };
        void load("table-search");
      }, SEARCH_DEBOUNCE_MS);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-he-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = Number.parseInt(btn.dataset.ajHePage ?? "0", 10);
        if (!page || page === state.page || page < 1) return;
        state = { ...state, page, successMessage: undefined };
        void load();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-he-revocar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number.parseInt(btn.dataset.ajHeRevocar ?? "0", 10);
        if (id) void retirarAutorizacion(id);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-he-abrir-modal]").forEach((btn) => {
      btn.addEventListener("click", abrirModal);
    });

    // Modal
    const backdrop = root.querySelector("#aj-he-modal-backdrop");
    backdrop?.addEventListener("click", (ev) => {
      if (ev.target === backdrop) cerrarModal();
    });
    root.querySelector("#aj-he-modal-cerrar")?.addEventListener("click", cerrarModal);
    root.querySelector("#aj-he-modal-cancelar")?.addEventListener("click", cerrarModal);
    root.querySelector("#aj-he-modal-confirmar")?.addEventListener("click", () => {
      void confirmarAutorizacion();
    });

    root.querySelector<HTMLInputElement>("#aj-he-modal-busqueda")?.addEventListener("input", (ev) => {
      const value = (ev.target as HTMLInputElement).value;
      if (modalSearchTimer !== undefined) window.clearTimeout(modalSearchTimer);
      modalSearchTimer = window.setTimeout(() => {
        void buscarDisponibles(value);
      }, SEARCH_DEBOUNCE_MS);
    });

    root.querySelectorAll<HTMLInputElement>("[data-aj-he-modal-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number.parseInt(checkbox.dataset.ajHeModalCheck ?? "0", 10);
        if (id) toggleSeleccion(id, checkbox.checked);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-he-modal-quitar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number.parseInt(btn.dataset.ajHeModalQuitar ?? "0", 10);
        if (id) toggleSeleccion(id, false);
      });
    });

    // Sección de aprobadores
    root.querySelectorAll<HTMLButtonElement>("[data-aj-ap-abrir-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipo = btn.dataset.ajApAbrirModal as AprobadorTipo | undefined;
        if (tipo === "gerente_regional" || tipo === "director") abrirModalAprobadores(tipo);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-ap-eliminar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number.parseInt(btn.dataset.ajApEliminar ?? "0", 10);
        if (id) void eliminarAprobador(id);
      });
    });

    // Modal de aprobadores
    const aprobadoresBackdrop = root.querySelector("#aj-ap-modal-backdrop");
    aprobadoresBackdrop?.addEventListener("click", (ev) => {
      if (ev.target === aprobadoresBackdrop) cerrarModalAprobadores();
    });
    root.querySelector("#aj-ap-modal-cerrar")?.addEventListener("click", cerrarModalAprobadores);
    root.querySelector("#aj-ap-modal-cancelar")?.addEventListener("click", cerrarModalAprobadores);
    root.querySelector("#aj-ap-modal-confirmar")?.addEventListener("click", () => {
      void guardarAprobadores();
    });

    root
      .querySelector<HTMLInputElement>("#aj-ap-modal-busqueda")
      ?.addEventListener("input", (ev) => {
        const value = (ev.target as HTMLInputElement).value;
        if (aprobadoresSearchTimer !== undefined) window.clearTimeout(aprobadoresSearchTimer);
        aprobadoresSearchTimer = window.setTimeout(() => {
          void buscarCandidatosAprobador(value);
        }, SEARCH_DEBOUNCE_MS);
      });

    root.querySelectorAll<HTMLInputElement>("[data-aj-ap-modal-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number.parseInt(checkbox.dataset.ajApModalCheck ?? "0", 10);
        if (id) toggleSeleccionAprobador(id, checkbox.checked);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-ap-modal-quitar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number.parseInt(btn.dataset.ajApModalQuitar ?? "0", 10);
        if (id) toggleSeleccionAprobador(id, false);
      });
    });
  };

  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key !== "Escape") return;
      if (state.aprobadores.modal !== null) {
        ev.preventDefault();
        cerrarModalAprobadores();
      } else if (state.modal !== null) {
        ev.preventDefault();
        cerrarModal();
      }
    },
    { signal },
  );

  void load();
  void cargarAprobadores();
}
