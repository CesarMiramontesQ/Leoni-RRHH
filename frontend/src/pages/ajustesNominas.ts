import {
  getHorasExtraAutorizados,
  setHorasExtraAutorizacion,
  type HorasExtraAutorizadosFiltro,
  type NominasAjustesFetchError,
} from "../api/nominasAjustes.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderAjustesNominasPage } from "../nominas/ajustes/renderAjustesNominasPage.ts";
import type { AjustesNominasState } from "../nominas/ajustes/types.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const SHELL_OPTS = {
  pageTitle: "Ajustes de Nóminas",
  activeNav: "nominas-ajustes" as const,
  mainClass: "pt-0 pb-5 sm:pb-6",
};

function initialState(): AjustesNominasState {
  return {
    status: "loading",
    items: [],
    total: 0,
    totalAutorizados: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    q: "",
    filtro: "todos",
    seleccion: new Set<number>(),
    updating: false,
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
  let searchTimer: number | undefined;

  const render = (focusSearch = false): void => {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: renderAjustesNominasPage(state),
    });
    bindEvents();
    if (focusSearch) {
      const input = container.querySelector<HTMLInputElement>("#aj-he-busqueda");
      if (input) {
        const len = input.value.length;
        input.focus();
        input.setSelectionRange(len, len);
      }
    }
  };

  const load = async (focusSearch = false): Promise<void> => {
    state = { ...state, status: "loading" };
    render(focusSearch);
    try {
      const data = await getHorasExtraAutorizados({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q,
        filtro: state.filtro,
      });
      if (signal?.aborted) return;
      const visibles = new Set(data.items.map((item) => item.id));
      state = {
        ...state,
        status: "ready",
        items: data.items,
        total: data.total,
        totalAutorizados: data.total_autorizados,
        page: data.page,
        pageSize: data.page_size,
        seleccion: new Set([...state.seleccion].filter((id) => visibles.has(id))),
        errorMessage: undefined,
      };
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (isAuthError(err)) {
        clearAuth();
        window.location.hash = "#/login";
        return;
      }
      state = {
        ...state,
        status: "error",
        errorMessage: err.detail ?? "No se pudo cargar el listado de empleados.",
      };
    }
    if (signal?.aborted) return;
    render(focusSearch);
  };

  const aplicarAutorizacion = async (autorizado: boolean): Promise<void> => {
    const ids = [...state.seleccion];
    if (ids.length === 0 || state.updating) return;
    state = { ...state, updating: true, successMessage: undefined, errorMessage: undefined };
    render();
    try {
      const resultado = await setHorasExtraAutorizacion(ids, autorizado);
      if (signal?.aborted) return;
      state = {
        ...state,
        updating: false,
        seleccion: new Set<number>(),
        successMessage: autorizado
          ? `Autorización otorgada a ${ids.length} ${ids.length === 1 ? "empleado" : "empleados"}.`
          : `Autorización retirada a ${ids.length} ${ids.length === 1 ? "empleado" : "empleados"}.`,
        totalAutorizados: resultado.total_autorizados,
      };
      await load();
    } catch (e) {
      const err = e as NominasAjustesFetchError;
      if (isAuthError(err)) {
        clearAuth();
        window.location.hash = "#/login";
        return;
      }
      if (signal?.aborted) return;
      state = {
        ...state,
        updating: false,
        errorMessage: err.detail ?? "No se pudo actualizar la autorización.",
      };
      render();
    }
  };

  const bindEvents = (): void => {
    const root = container.querySelector("#ajustes-nominas-page");
    if (!root) return;

    root.querySelector<HTMLInputElement>("#aj-he-busqueda")?.addEventListener("input", (ev) => {
      const value = (ev.target as HTMLInputElement).value;
      if (searchTimer !== undefined) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state = { ...state, q: value, page: 1, successMessage: undefined };
        void load(true);
      }, SEARCH_DEBOUNCE_MS);
    });

    root.querySelector<HTMLSelectElement>("#aj-he-filtro")?.addEventListener("change", (ev) => {
      const filtro = (ev.target as HTMLSelectElement).value as HorasExtraAutorizadosFiltro;
      state = { ...state, filtro, page: 1, successMessage: undefined };
      void load();
    });

    root.querySelector<HTMLInputElement>("#aj-he-check-todos")?.addEventListener("change", (ev) => {
      const checked = (ev.target as HTMLInputElement).checked;
      const seleccion = new Set(state.seleccion);
      for (const item of state.items) {
        if (checked) seleccion.add(item.id);
        else seleccion.delete(item.id);
      }
      state = { ...state, seleccion };
      render();
    });

    root.querySelectorAll<HTMLInputElement>("[data-aj-he-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number.parseInt(checkbox.dataset.ajHeCheck ?? "0", 10);
        if (!id) return;
        const seleccion = new Set(state.seleccion);
        if (checkbox.checked) seleccion.add(id);
        else seleccion.delete(id);
        state = { ...state, seleccion };
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aj-he-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = Number.parseInt(btn.dataset.ajHePage ?? "0", 10);
        if (!page || page === state.page || page < 1) return;
        state = { ...state, page, successMessage: undefined };
        void load();
      });
    });

    root.querySelector("#aj-he-autorizar")?.addEventListener("click", () => {
      void aplicarAutorizacion(true);
    });

    root.querySelector("#aj-he-revocar")?.addEventListener("click", () => {
      void aplicarAutorizacion(false);
    });
  };

  void load();
}
