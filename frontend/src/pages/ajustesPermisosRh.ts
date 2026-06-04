import {
  agregarEmpleadoPermisos,
  buscarEmpleadosParaPermisos,
  fetchRhModulosCatalogo,
  fetchRhUsuariosPermisos,
  updateRhUsuarioPermisos,
  type RhEmpleadoBusquedaItem,
  type RhModuloCatalogItem,
  type RhUsuarioPermisosItem,
} from "../api/rhPermisos.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const ROL_LABELS: Record<string, string> = {
  empleado: "Empleado",
  supervisor: "Supervisor",
  rh: "RH",
  director: "Director",
  gerente: "Gerente",
};

function formatRol(rol: string): string {
  return ROL_LABELS[rol] ?? rol.charAt(0).toUpperCase() + rol.slice(1);
}

type PageState = {
  loading: boolean;
  savingId: number | null;
  addingId: number | null;
  searching: boolean;
  error: string | null;
  success: string | null;
  catalog: RhModuloCatalogItem[];
  usuarios: RhUsuarioPermisosItem[];
  draftByEmpleadoId: Map<number, Record<string, boolean>>;
  searchQuery: string;
  searchResults: RhEmpleadoBusquedaItem[];
  expandedEmpleadoIds: Set<number>;
  searchSectionExpanded: boolean;
};

const CHEVRON_SVG = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 shrink-0 text-text-muted transition-transform duration-200"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;

function countActiveModules(modulos: Record<string, boolean>): number {
  return Object.values(modulos).filter(Boolean).length;
}

function groupCatalog(catalog: RhModuloCatalogItem[]): Map<string, RhModuloCatalogItem[]> {
  const groups = new Map<string, RhModuloCatalogItem[]>();
  for (const item of catalog) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return groups;
}

function renderUsuarioRow(
  user: RhUsuarioPermisosItem,
  catalogGroups: Map<string, RhModuloCatalogItem[]>,
  draft: Record<string, boolean>,
  saving: boolean,
  expanded: boolean,
): string {
  const disabled = !user.editable || saving;
  const activeCount = countActiveModules(draft);
  const groupsHtml = [...catalogGroups.entries()]
    .map(([group, items]) => {
      const checks = items
        .map((mod) => {
          const checked = draft[mod.key] === true;
          return `
            <label class="inline-flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                class="rh-permiso-modulo size-4 rounded border-border text-accent focus:ring-accent/30"
                data-modulo-key="${escapeHtml(mod.key)}"
                ${checked ? "checked" : ""}
                ${disabled ? "disabled" : ""}
              />
              <span>${escapeHtml(mod.label)}</span>
            </label>`;
        })
        .join("");
      const groupActive = items.filter((m) => draft[m.key] === true).length;
      return `
        <details class="group/rh-perm-grp rounded-lg border border-border/80 bg-surface/40">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-text-muted transition-transform duration-200 group-open/rh-perm-grp:rotate-180">${CHEVRON_SVG}</span>
              <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(group)}</span>
              <span class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">${groupActive}/${items.length}</span>
            </span>
            ${
              disabled
                ? ""
                : `<button type="button" class="rh-permiso-grupo-todo text-xs font-semibold text-accent hover:underline" data-group="${escapeHtml(group)}">Todo</button>`
            }
          </summary>
          <div class="grid gap-2 border-t border-border/60 px-3 pb-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">${checks}</div>
        </details>`;
    })
    .join("");

  return `
    <article class="${RH_LISTADO_SURFACE} overflow-hidden" data-empleado-id="${user.empleado_id}">
      <header class="border-b border-border/70">
        <button
          type="button"
          class="rh-permiso-empleado-toggle flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-surface/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-inset"
          aria-expanded="${expanded ? "true" : "false"}"
          aria-controls="rh-permiso-body-${user.empleado_id}"
          data-empleado-id="${user.empleado_id}"
        >
          <span class="flex min-w-0 flex-1 items-start gap-3">
            <span class="mt-0.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}">${CHEVRON_SVG}</span>
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold text-text-primary">${escapeHtml(user.nombre)}</span>
                <span class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">${activeCount} módulo${activeCount === 1 ? "" : "s"}</span>
              </span>
              <span class="mt-0.5 block text-sm text-text-muted">${escapeHtml(user.no_empleado)}${user.email ? ` · ${escapeHtml(user.email)}` : ""}</span>
              <span class="mt-1 block text-xs font-medium text-text-muted">Rol: ${escapeHtml(formatRol(user.rol_nombre))}</span>
              ${
                user.puede_administrar_permisos_rh
                  ? `<span class="mt-1 block text-xs font-medium text-accent">Administrador de permisos</span>`
                  : ""
              }
              ${
                !user.editable
                  ? `<span class="mt-1 block text-xs text-amber-700">No puedes modificar tus propios permisos.</span>`
                  : ""
              }
            </span>
          </span>
        </button>
      </header>
      <div
        id="rh-permiso-body-${user.empleado_id}"
        class="rh-permiso-empleado-body grid gap-3 p-4 ${expanded ? "" : "hidden"}"
      >
        ${
          user.editable
            ? `<div class="flex justify-end">
                <button type="button" class="rh-permiso-guardar ${BTN_PRIMARY}" data-empleado-id="${user.empleado_id}" ${saving ? "disabled" : ""}>
                  ${saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>`
            : ""
        }
        ${groupsHtml}
      </div>
    </article>`;
}

function renderSearchBlock(state: PageState): string {
  const expanded = state.searchSectionExpanded;
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden">
      <button
        type="button"
        id="rh-permiso-search-toggle"
        class="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-inset"
        aria-expanded="${expanded ? "true" : "false"}"
        aria-controls="rh-permiso-search-body"
      >
        <span>
          <span class="text-sm font-semibold text-text-primary">Agregar empleado</span>
          <span class="mt-0.5 block text-sm text-text-muted">Busca y agrega colaboradores de cualquier rol.</span>
        </span>
        <span class="transition-transform duration-200 ${expanded ? "rotate-180" : ""}">${CHEVRON_SVG}</span>
      </button>
      <div id="rh-permiso-search-body" class="${expanded ? "border-t border-border/70 p-4" : "hidden"}">
        <div class="flex flex-wrap items-end gap-2">
          <label class="min-w-[16rem] flex-1">
            <span class="mb-1 block text-xs font-medium text-text-muted">Buscar</span>
            <input
              id="rh-permiso-search-input"
              type="search"
              class="w-full rounded border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
              placeholder="Nombre, no. empleado o email"
              value="${escapeHtml(state.searchQuery)}"
              autocomplete="off"
            />
          </label>
          <button type="button" id="rh-permiso-search-btn" class="${BTN_SECONDARY}" ${state.searching ? "disabled" : ""}>
            ${state.searching ? "Buscando…" : "Buscar"}
          </button>
        </div>
        ${
          state.searchResults.length > 0
            ? `<ul class="mt-3 divide-y divide-border/70 rounded-lg border border-border/80">
                ${state.searchResults
                  .map(
                    (emp) => `
                  <li class="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</p>
                      <p class="text-xs text-text-muted">${escapeHtml(emp.no_empleado)} · ${escapeHtml(formatRol(emp.rol_nombre))}${emp.email ? ` · ${escapeHtml(emp.email)}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      class="rh-permiso-agregar ${BTN_PRIMARY}"
                      data-empleado-id="${emp.empleado_id}"
                      ${state.addingId === emp.empleado_id ? "disabled" : ""}
                    >
                      ${state.addingId === emp.empleado_id ? "Agregando…" : "Agregar"}
                    </button>
                  </li>`,
                  )
                  .join("")}
              </ul>`
            : state.searchQuery.trim().length >= 2 && !state.searching
              ? `<p class="mt-3 text-sm text-text-muted">Sin resultados disponibles para agregar.</p>`
              : ""
        }
      </div>
    </section>`;
}

function renderPage(state: PageState): string {
  if (state.loading) {
    return `<p class="text-sm text-text-muted">Cargando permisos…</p>`;
  }
  if (state.error && state.usuarios.length === 0) {
    return `<p class="text-sm text-red-600" role="alert">${escapeHtml(state.error)}</p>`;
  }

  const catalogGroups = groupCatalog(state.catalog);

  return `
    <div class="mx-auto max-w-6xl space-y-6 py-2">
      <header>
        <h1 class="text-2xl font-bold text-text-primary">Permisos por módulo</h1>
        <p class="mt-1 text-sm text-text-muted">Administra accesos por empleado, independientemente de su rol de plataforma.</p>
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
      ${renderSearchBlock(state)}
      <div class="space-y-4">
        ${state.usuarios
          .map((user) =>
            renderUsuarioRow(
              user,
              catalogGroups,
              state.draftByEmpleadoId.get(user.empleado_id) ?? user.modulos,
              state.savingId === user.empleado_id,
              state.expandedEmpleadoIds.has(user.empleado_id),
            ),
          )
          .join("")}
      </div>
    </div>`;
}

export function mountAjustesPermisosRh(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessRhPermisosAdmin()) {
    mountAppShell(container, {
      mainHtml: htmlAccessDenied({
        title: "Acceso restringido",
        description: "Solo los administradores de permisos RH pueden acceder a esta sección.",
        linkHref: "#/",
        linkLabel: "Volver al inicio",
      }),
    });
    return;
  }

  const state: PageState = {
    loading: true,
    savingId: null,
    addingId: null,
    searching: false,
    error: null,
    success: null,
    catalog: [],
    usuarios: [],
    draftByEmpleadoId: new Map(),
    searchQuery: "",
    searchResults: [],
    expandedEmpleadoIds: new Set<number>(),
    searchSectionExpanded: true,
  };

  const paint = (): void => {
    mountAppShell(container, {
      mainHtml: renderPage(state),
      onSignOut: () => {
        clearAuth();
        import("../shellRouter.ts").then((m) => m.abortAuthenticatedShell());
        import("./login.ts").then((m) => m.mountLogin(container));
      },
    });
    bindEvents();
  };

  const readDraftFromDom = (empleadoId: number): Record<string, boolean> => {
    const article = container.querySelector(`article[data-empleado-id="${empleadoId}"]`);
    if (!article) return state.draftByEmpleadoId.get(empleadoId) ?? {};
    const draft = { ...(state.draftByEmpleadoId.get(empleadoId) ?? {}) };
    article.querySelectorAll<HTMLInputElement>(".rh-permiso-modulo").forEach((input) => {
      const key = input.dataset.moduloKey;
      if (key) draft[key] = input.checked;
    });
    return draft;
  };

  const bindEvents = (): void => {
    container.querySelector("#rh-permiso-search-toggle")?.addEventListener(
      "click",
      () => {
        state.searchSectionExpanded = !state.searchSectionExpanded;
        paint();
      },
      { signal },
    );

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-empleado-toggle").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          if (state.expandedEmpleadoIds.has(empleadoId)) {
            state.expandedEmpleadoIds.delete(empleadoId);
          } else {
            state.expandedEmpleadoIds.add(empleadoId);
          }
          paint();
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-grupo-todo").forEach((btn) => {
      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const article = btn.closest("article");
          const empleadoId = Number.parseInt(article?.getAttribute("data-empleado-id") ?? "", 10);
          const group = btn.dataset.group;
          if (!article || !Number.isFinite(empleadoId) || !group) return;
          const draft = readDraftFromDom(empleadoId);
          for (const mod of state.catalog.filter((m) => m.group === group)) {
            draft[mod.key] = true;
          }
          state.draftByEmpleadoId.set(empleadoId, draft);
          state.expandedEmpleadoIds.add(empleadoId);
          paint();
        },
        { signal },
      );
    });

    const searchInput = container.querySelector<HTMLInputElement>("#rh-permiso-search-input");
    searchInput?.addEventListener(
      "input",
      () => {
        state.searchQuery = searchInput.value;
      },
      { signal },
    );
    searchInput?.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void runSearch();
        }
      },
      { signal },
    );

    container.querySelector("#rh-permiso-search-btn")?.addEventListener(
      "click",
      () => void runSearch(),
      { signal },
    );

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-agregar").forEach((btn) => {
      btn.addEventListener(
        "click",
        async () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          state.addingId = empleadoId;
          state.error = null;
          state.success = null;
          paint();
          try {
            const added = await agregarEmpleadoPermisos(empleadoId);
            state.usuarios = [...state.usuarios, added].sort((a, b) =>
              a.nombre.localeCompare(b.nombre, "es"),
            );
            state.draftByEmpleadoId.set(added.empleado_id, { ...added.modulos });
            state.expandedEmpleadoIds.add(added.empleado_id);
            state.searchResults = state.searchResults.filter((e) => e.empleado_id !== empleadoId);
            state.success = `${added.nombre} agregado. Asigna los módulos y guarda.`;
          } catch (err) {
            state.error = err instanceof Error ? err.message : "No se pudo agregar al empleado.";
          } finally {
            state.addingId = null;
            paint();
          }
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLInputElement>(".rh-permiso-modulo").forEach((input) => {
      input.addEventListener(
        "change",
        () => {
          const article = input.closest("article");
          const empleadoId = Number.parseInt(article?.getAttribute("data-empleado-id") ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          state.draftByEmpleadoId.set(empleadoId, readDraftFromDom(empleadoId));
        },
        { signal },
      );
    });

    container.querySelectorAll<HTMLButtonElement>(".rh-permiso-guardar").forEach((btn) => {
      btn.addEventListener(
        "click",
        async () => {
          const empleadoId = Number.parseInt(btn.dataset.empleadoId ?? "", 10);
          if (!Number.isFinite(empleadoId)) return;
          const modulos = readDraftFromDom(empleadoId);
          state.savingId = empleadoId;
          state.expandedEmpleadoIds.add(empleadoId);
          state.error = null;
          state.success = null;
          paint();
          try {
            const updated = await updateRhUsuarioPermisos(empleadoId, modulos);
            state.usuarios = state.usuarios.map((u) =>
              u.empleado_id === empleadoId ? updated : u,
            );
            state.draftByEmpleadoId.set(empleadoId, { ...updated.modulos });
            state.success = `Permisos actualizados para ${updated.nombre}. El usuario debe volver a iniciar sesión para aplicar cambios en API.`;
          } catch (err) {
            state.error = err instanceof Error ? err.message : "No se pudieron guardar los permisos.";
          } finally {
            state.savingId = null;
            paint();
          }
        },
        { signal },
      );
    });
  };

  const runSearch = async (): Promise<void> => {
    const q = state.searchQuery.trim();
    if (q.length < 2) {
      state.error = "Escribe al menos 2 caracteres para buscar.";
      state.searchResults = [];
      paint();
      return;
    }
    state.searching = true;
    state.error = null;
    paint();
    try {
      state.searchResults = await buscarEmpleadosParaPermisos(q);
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Error al buscar empleados.";
      state.searchResults = [];
    } finally {
      state.searching = false;
      paint();
    }
  };

  void (async () => {
    try {
      const [catalog, usuarios] = await Promise.all([
        fetchRhModulosCatalogo(),
        fetchRhUsuariosPermisos(),
      ]);
      state.catalog = catalog;
      state.usuarios = usuarios;
      for (const user of usuarios) {
        state.draftByEmpleadoId.set(user.empleado_id, { ...user.modulos });
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Error al cargar permisos.";
    } finally {
      state.loading = false;
      paint();
    }
  })();
}

export function mountRhModuleAccessDenied(container: HTMLElement): void {
  mountAppShell(container, {
    mainHtml: htmlAccessDenied({
      title: "Acceso no autorizado",
      description: "No tienes permiso para acceder a este módulo. Contacta al administrador de RH si necesitas acceso.",
      linkHref: "#/",
      linkLabel: "Volver al inicio",
    }),
  });
}
