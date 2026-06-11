import {
  getHorasExtraAutorizados,
  setHorasExtraAutorizacion,
  type HorasExtraAutorizadoItem,
  type NominasAjustesFetchError,
} from "../api/nominasAjustes.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderAjustesNominasPage } from "../nominas/ajustes/renderAjustesNominasPage.ts";
import type { AjustesNominasModalState, AjustesNominasState } from "../nominas/ajustes/types.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SIZE = 10;
const MODAL_RESULTS_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const SHELL_OPTS = {
  pageTitle: "Ajustes de Nóminas",
  activeNav: "nominas-ajustes" as const,
  mainClass: "pt-0 pb-5 sm:pb-6",
};

type FocusTarget = "table-search" | "modal-search" | null;

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

function isAuthError(err: NominasAjustesFetchError): boolean {
  return err.status === 401;
}

export function mountAjustesNominas(container: HTMLElement, signal?: AbortSignal): void {
  if (getRolFromAccessToken() !== "rh") {
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

  const setBodyScrollLocked = (locked: boolean): void => {
    document.body.style.overflow = locked ? "hidden" : "";
  };

  signal?.addEventListener("abort", () => setBodyScrollLocked(false));

  const render = (focus: FocusTarget = null): void => {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: renderAjustesNominasPage(state),
    });
    setBodyScrollLocked(state.modal !== null);
    bindEvents();
    if (focus) {
      const selector = focus === "table-search" ? "#aj-he-busqueda" : "#aj-he-modal-busqueda";
      const input = container.querySelector<HTMLInputElement>(selector);
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

    root.querySelector("#aj-he-abrir-modal")?.addEventListener("click", abrirModal);

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
  };

  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape" && state.modal !== null) {
        ev.preventDefault();
        cerrarModal();
      }
    },
    { signal },
  );

  void load();
}
