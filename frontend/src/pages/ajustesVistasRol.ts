/**
 * Configuración de vistas por rol (`#/ajustes/vistas-rol`) — solo admin RH.
 *
 * Matriz vista × rol: cada casilla enciende o apaga una pantalla para todo un rol.
 * Los cambios se acumulan en `draft` y se envían juntos al guardar, para que el
 * administrador pueda revisar antes de aplicar.
 */
import {
  fetchVistasRolCatalogo,
  fetchVistasRolConfig,
  restaurarVistasRolConfig,
  updateVistasRolConfig,
  type VistaRolCambio,
  type VistaRolCatalogItem,
} from "../api/vistasRol.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

type Config = Record<string, Record<string, boolean>>;

type PageState = {
  loading: boolean;
  saving: boolean;
  restoring: boolean;
  error: string | null;
  success: string | null;
  catalog: VistaRolCatalogItem[];
  roles: string[];
  /** Config guardada en el servidor: la referencia para saber qué cambió. */
  config: Config;
  /** Config editada en pantalla, aún sin guardar. */
  draft: Config;
  filtroTexto: string;
  /** `all` o un rol: acota la matriz a una sola columna. */
  filtroRol: string;
  confirmRestaurar: boolean;
};

const ROL_LABELS: Readonly<Record<string, string>> = {
  empleado: "Empleado",
  supervisor: "Supervisor",
  gerente: "Gerente",
};

function rolLabel(rol: string): string {
  return ROL_LABELS[rol] ?? rol;
}

function clonarConfig(config: Config): Config {
  return Object.fromEntries(
    Object.entries(config).map(([rol, vistas]) => [rol, { ...vistas }]),
  );
}

/** Solo las casillas que difieren de lo guardado. */
function calcularCambios(state: PageState): VistaRolCambio[] {
  const cambios: VistaRolCambio[] = [];
  for (const rol of state.roles) {
    const guardado = state.config[rol] ?? {};
    const editado = state.draft[rol] ?? {};
    for (const [vistaKey, habilitado] of Object.entries(editado)) {
      if (guardado[vistaKey] !== habilitado) {
        cambios.push({ rol, vista_key: vistaKey, habilitado });
      }
    }
  }
  return cambios;
}

function rolesVisibles(state: PageState): string[] {
  return state.filtroRol === "all" ? state.roles : [state.filtroRol];
}

function vistasFiltradas(state: PageState): VistaRolCatalogItem[] {
  const q = state.filtroTexto.trim().toLowerCase();
  if (!q) return state.catalog;
  return state.catalog.filter(
    (v) =>
      v.label.toLowerCase().includes(q) ||
      v.descripcion.toLowerCase().includes(q) ||
      v.grupo.toLowerCase().includes(q) ||
      v.ruta.toLowerCase().includes(q),
  );
}

function agruparPorGrupo(vistas: VistaRolCatalogItem[]): [string, VistaRolCatalogItem[]][] {
  const grupos: [string, VistaRolCatalogItem[]][] = [];
  for (const vista of vistas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0] === vista.grupo) ultimo[1].push(vista);
    else grupos.push([vista.grupo, [vista]]);
  }
  return grupos;
}

function renderCheckbox(state: PageState, vistaKey: string, rol: string): string {
  const marcado = state.draft[rol]?.[vistaKey] === true;
  const cambiado = state.config[rol]?.[vistaKey] !== state.draft[rol]?.[vistaKey];
  return `
    <td class="px-3 py-2.5 text-center align-middle ${cambiado ? "bg-amber-50" : ""}">
      <input
        type="checkbox"
        data-vista-toggle
        data-vista-key="${escapeHtml(vistaKey)}"
        data-rol="${escapeHtml(rol)}"
        ${marcado ? "checked" : ""}
        aria-label="${escapeHtml(rolLabel(rol))}"
        class="size-4 cursor-pointer rounded border-slate-300 text-[#1e40af] ${FIELD_FOCUS}" />
    </td>`;
}

function renderFilaVista(state: PageState, vista: VistaRolCatalogItem): string {
  const celdas = rolesVisibles(state)
    .map((rol) => renderCheckbox(state, vista.key, rol))
    .join("");
  return `
    <tr class="border-t border-[#eef0f4]">
      <td class="px-3 py-2.5">
        <p class="text-sm font-medium text-[#0f172a]">${escapeHtml(vista.label)}</p>
        <p class="mt-0.5 text-xs leading-snug text-[#64748b]">${escapeHtml(vista.descripcion)}</p>
        <p class="mt-0.5 font-mono text-[11px] text-[#94a3b8]">${escapeHtml(vista.ruta)}</p>
      </td>
      ${celdas}
    </tr>`;
}

function renderGrupo(state: PageState, grupo: string, vistas: VistaRolCatalogItem[]): string {
  const roles = rolesVisibles(state);
  const acciones = roles
    .map(
      (rol) => `
        <td class="px-3 py-1.5 text-center">
          <button type="button" data-grupo-toggle data-grupo="${escapeHtml(grupo)}" data-rol="${escapeHtml(rol)}"
            class="text-[11px] font-medium text-[#1e40af] transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40">
            Alternar
          </button>
        </td>`,
    )
    .join("");
  return `
    <tr class="bg-[#f8fafc]">
      <td class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#475569]">${escapeHtml(grupo)}</td>
      ${acciones}
    </tr>
    ${vistas.map((v) => renderFilaVista(state, v)).join("")}`;
}

function renderTabla(state: PageState): string {
  const vistas = vistasFiltradas(state);
  if (vistas.length === 0) {
    return `<div class="${RH_LISTADO_SURFACE} px-4 py-8 text-center text-sm text-[#64748b]">
      No hay vistas que coincidan con el filtro.
    </div>`;
  }
  const roles = rolesVisibles(state);
  const encabezados = roles
    .map(
      (rol) =>
        `<th scope="col" class="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#475569]">${escapeHtml(rolLabel(rol))}</th>`,
    )
    .join("");
  return `
    <div class="${RH_LISTADO_SURFACE} overflow-x-auto">
      <table class="w-full min-w-[36rem] border-collapse text-left">
        <thead>
          <tr class="border-b border-[#e5e7eb]">
            <th scope="col" class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#475569]">Vista</th>
            ${encabezados}
          </tr>
        </thead>
        <tbody>
          ${agruparPorGrupo(vistas)
            .map(([grupo, delGrupo]) => renderGrupo(state, grupo, delGrupo))
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderToolbar(state: PageState): string {
  const opciones = ["all", ...state.roles]
    .map(
      (valor) =>
        `<option value="${escapeHtml(valor)}" ${state.filtroRol === valor ? "selected" : ""}>${
          valor === "all" ? "Todos los roles" : escapeHtml(rolLabel(valor))
        }</option>`,
    )
    .join("");
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:gap-4">
      <div class="min-w-0 flex-1">
        <label class="${RH_LISTADO_LABEL}" for="vistas-rol-filtro">Buscar vista</label>
        <input id="vistas-rol-filtro" type="search" value="${escapeHtml(state.filtroTexto)}"
          placeholder="Nombre, descripción o ruta"
          class="block w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}" />
      </div>
      <div class="sm:w-56">
        <label class="${RH_LISTADO_LABEL}" for="vistas-rol-filtro-rol">Agrupar por rol</label>
        <select id="vistas-rol-filtro-rol"
          class="block w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
          ${opciones}
        </select>
      </div>
    </div>`;
}

function renderConfirmRestaurar(state: PageState): string {
  if (!state.confirmRestaurar) return "";
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="vistas-rol-restaurar-title">
      <div class="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl">
        <h2 id="vistas-rol-restaurar-title" class="text-base font-semibold text-[#0f172a]">Restaurar configuración inicial</h2>
        <p class="mt-2 text-sm leading-relaxed text-[#64748b]">
          Todas las vistas volverán al acceso que cada rol tenía de origen. Se perderán los
          cambios guardados.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" id="vistas-rol-restaurar-cancelar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" id="vistas-rol-restaurar-confirmar" class="${BTN_PRIMARY}" ${state.restoring ? "disabled" : ""}>
            ${state.restoring ? "Restaurando…" : "Restaurar"}
          </button>
        </div>
      </div>
    </div>`;
}

function renderPage(state: PageState): string {
  if (state.loading) {
    return `<p class="text-sm text-text-muted">Cargando configuración de vistas…</p>`;
  }
  if (state.error && state.catalog.length === 0) {
    return `<p class="text-sm text-red-600" role="alert">${escapeHtml(state.error)}</p>`;
  }

  const pendientes = calcularCambios(state).length;

  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="${RH_LISTADO_SURFACE} p-4 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Vistas por rol</h1>
            <p class="mt-2 max-w-3xl text-sm leading-relaxed text-[#64748b]">
              Controla qué pantallas puede consultar cada rol. Sirve para liberar
              funcionalidad de forma gradual: se apaga una vista, se prueba y se enciende
              cuando esté lista. Los cambios aplican sin que nadie tenga que volver a
              iniciar sesión.
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 self-start">
            <button type="button" id="vistas-rol-restaurar" class="${BTN_GHOST}">Restaurar inicial</button>
            <button type="button" id="vistas-rol-guardar" class="${BTN_PRIMARY}" ${
              state.saving || pendientes === 0 ? "disabled" : ""
            }>
              ${state.saving ? "Guardando…" : pendientes > 0 ? `Guardar (${pendientes})` : "Guardar"}
            </button>
          </div>
        </div>
      </header>
      ${
        state.error
          ? `<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">${escapeHtml(state.error)}</p>`
          : ""
      }
      ${
        state.success
          ? `<p class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">${escapeHtml(state.success)}</p>`
          : ""
      }
      ${
        pendientes > 0
          ? `<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              ${pendientes} cambio${pendientes === 1 ? "" : "s"} sin guardar.
            </p>`
          : ""
      }
      ${renderToolbar(state)}
      ${renderTabla(state)}
      ${renderConfirmRestaurar(state)}
    </div>`;
}

export function mountAjustesVistasRol(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessRhPermisosAdmin()) {
    mountAppShell(container, {
      mainHtml: htmlAccessDenied({
        title: "Acceso restringido",
        description: "Solo los administradores pueden acceder a esta sección.",
        linkHref: "#/",
        linkLabel: "Volver al inicio",
      }),
    });
    return;
  }

  const state: PageState = {
    loading: true,
    saving: false,
    restoring: false,
    error: null,
    success: null,
    catalog: [],
    roles: [],
    config: {},
    draft: {},
    filtroTexto: "",
    filtroRol: "all",
    confirmRestaurar: false,
  };

  const setBodyScrollLocked = (locked: boolean): void => {
    document.body.style.overflow = locked ? "hidden" : "";
  };
  signal?.addEventListener("abort", () => setBodyScrollLocked(false));

  const paint = (opts?: { preserveFilterFocus?: boolean }): void => {
    mountAppShell(container, {
      mainHtml: renderPage(state),
      onSignOut: () => {
        setBodyScrollLocked(false);
        clearAuth();
        void import("../shellRouter.ts").then((m) => m.abortAuthenticatedShell());
        void import("./login.ts").then((m) => m.mountLogin(container));
      },
    });
    setBodyScrollLocked(state.confirmRestaurar);
    bindEvents();
    if (opts?.preserveFilterFocus) {
      const input = container.querySelector<HTMLInputElement>("#vistas-rol-filtro");
      input?.focus();
      const largo = input?.value.length ?? 0;
      input?.setSelectionRange(largo, largo);
    }
  };

  const guardar = async (): Promise<void> => {
    const cambios = calcularCambios(state);
    if (cambios.length === 0) return;
    state.saving = true;
    state.error = null;
    state.success = null;
    paint();
    try {
      const respuesta = await updateVistasRolConfig(cambios);
      state.roles = respuesta.roles;
      state.config = clonarConfig(respuesta.config);
      state.draft = clonarConfig(respuesta.config);
      state.success = `Configuración actualizada (${cambios.length} cambio${
        cambios.length === 1 ? "" : "s"
      }).`;
    } catch (err) {
      state.error =
        err instanceof Error ? err.message : "No se pudo guardar la configuración de vistas.";
    } finally {
      state.saving = false;
      paint();
    }
  };

  const restaurar = async (): Promise<void> => {
    state.restoring = true;
    state.error = null;
    state.success = null;
    paint();
    try {
      const respuesta = await restaurarVistasRolConfig();
      state.roles = respuesta.roles;
      state.config = clonarConfig(respuesta.config);
      state.draft = clonarConfig(respuesta.config);
      state.success = "Se restauró la configuración inicial.";
      state.confirmRestaurar = false;
    } catch (err) {
      state.error =
        err instanceof Error ? err.message : "No se pudo restaurar la configuración inicial.";
    } finally {
      state.restoring = false;
      paint();
    }
  };

  function bindEvents(): void {
    const opts = signal ? { signal } : undefined;

    container.querySelectorAll<HTMLInputElement>("[data-vista-toggle]").forEach((input) => {
      input.addEventListener(
        "change",
        () => {
          const vistaKey = input.dataset.vistaKey;
          const rol = input.dataset.rol;
          if (!vistaKey || !rol) return;
          state.draft[rol] = { ...(state.draft[rol] ?? {}), [vistaKey]: input.checked };
          state.success = null;
          paint();
        },
        opts,
      );
    });

    container.querySelectorAll<HTMLButtonElement>("[data-grupo-toggle]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const grupo = btn.dataset.grupo;
          const rol = btn.dataset.rol;
          if (!grupo || !rol) return;
          const delGrupo = vistasFiltradas(state).filter((v) => v.grupo === grupo);
          // Si queda alguna apagada, el grupo se enciende entero; si no, se apaga.
          const encender = delGrupo.some((v) => state.draft[rol]?.[v.key] !== true);
          const actualizado = { ...(state.draft[rol] ?? {}) };
          for (const vista of delGrupo) actualizado[vista.key] = encender;
          state.draft[rol] = actualizado;
          state.success = null;
          paint();
        },
        opts,
      );
    });

    const filtro = container.querySelector<HTMLInputElement>("#vistas-rol-filtro");
    filtro?.addEventListener(
      "input",
      () => {
        state.filtroTexto = filtro.value;
        paint({ preserveFilterFocus: true });
      },
      opts,
    );

    const filtroRol = container.querySelector<HTMLSelectElement>("#vistas-rol-filtro-rol");
    filtroRol?.addEventListener(
      "change",
      () => {
        state.filtroRol = filtroRol.value;
        paint();
      },
      opts,
    );

    container
      .querySelector<HTMLButtonElement>("#vistas-rol-guardar")
      ?.addEventListener("click", () => void guardar(), opts);

    container.querySelector<HTMLButtonElement>("#vistas-rol-restaurar")?.addEventListener(
      "click",
      () => {
        state.confirmRestaurar = true;
        paint();
      },
      opts,
    );
    container.querySelector<HTMLButtonElement>("#vistas-rol-restaurar-cancelar")?.addEventListener(
      "click",
      () => {
        state.confirmRestaurar = false;
        paint();
      },
      opts,
    );
    container
      .querySelector<HTMLButtonElement>("#vistas-rol-restaurar-confirmar")
      ?.addEventListener("click", () => void restaurar(), opts);
  }

  const cargar = async (): Promise<void> => {
    try {
      const [catalogo, config] = await Promise.all([
        fetchVistasRolCatalogo(),
        fetchVistasRolConfig(),
      ]);
      state.catalog = catalogo;
      state.roles = config.roles;
      state.config = clonarConfig(config.config);
      state.draft = clonarConfig(config.config);
    } catch (err) {
      state.error =
        err instanceof Error ? err.message : "No se pudo cargar la configuración de vistas.";
    } finally {
      state.loading = false;
      paint();
    }
  };

  paint();
  void cargar();
}
