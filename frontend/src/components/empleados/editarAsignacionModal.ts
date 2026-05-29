// frontend/src/components/empleados/editarAsignacionModal.ts
/**
 * Modal de edición de asignación (solo RH).
 * Permite cambiar únicamente: líder inmediato y rol del sistema.
 */

import { getEmpleadosPage } from "../../api/empleados.ts";
import { fetchUsuariosRoles, patchUsuarioAsignacion } from "../../api/usuariosAdmin.ts";
import type { RolBrief, UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { showEmpleadosToast } from "./toast.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const LEADER_SEARCH_DEBOUNCE_MS = 250;

function claveOrdenLider(u: UsuarioListItem): string {
  const nombre = u.nombre?.trim();
  if (nombre) return nombre;
  const email = u.email?.trim();
  if (email) return email;
  return String(u.no_empleado ?? "").trim();
}

function ordenarEmpleadosParaLider(empleados: UsuarioListItem[]): UsuarioListItem[] {
  return empleados
    .map((u, index) => ({ u, index }))
    .sort((a, b) => {
      const byName = claveOrdenLider(a.u).localeCompare(claveOrdenLider(b.u), "es", {
        sensitivity: "base",
        ignorePunctuation: true,
      });
      if (byName !== 0) return byName;
      return a.index - b.index;
    })
    .map(({ u }) => u);
}

async function fetchEmpleadosParaLider(): Promise<UsuarioListItem[]> {
  const page_size = 100;
  const acc: UsuarioListItem[] = [];
  let page = 1;
  for (;;) {
    const pg = await getEmpleadosPage({ page, page_size });
    acc.push(...pg.items);
    if (pg.items.length < page_size || acc.length >= pg.total) break;
    page += 1;
  }
  return ordenarEmpleadosParaLider(acc);
}

function normalizarTextoBusqueda(raw: string | null | undefined): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function etiquetaSupervisor(u: UsuarioListItem): string {
  return formatNombreEmpleadoUi(u.nombre).trim() || u.email?.trim() || "—";
}

function construirClaveBusquedaSupervisor(u: UsuarioListItem): string {
  const nombreRaw = u.nombre?.trim() ?? "";
  const nombreUi = formatNombreEmpleadoUi(u.nombre).trim();
  const noEmpleado = formatNoEmpleadoDisplay(u.no_empleado);
  const email = u.email?.trim() ?? "";
  const piezas = [nombreRaw, nombreUi, noEmpleado, email];
  return normalizarTextoBusqueda(piezas.join(" "));
}

function renderSupervisorOption(
  u: UsuarioListItem,
  selectedLiderEmpleadoId: number | null,
  selectedSuffix = "",
): string {
  const label = etiquetaSupervisor(u);
  const sel = u.empleado_id === selectedLiderEmpleadoId ? "selected" : "";
  return `<option value="${u.empleado_id}" ${sel}>${escapeHtml(label)} · #${escapeHtml(formatNoEmpleadoDisplay(u.no_empleado))}${escapeHtml(selectedSuffix)}</option>`;
}

function renderSupervisorOptions(
  empleadoEmpleadoId: number,
  supervisoresOriginales: UsuarioListItem[],
  supervisoresFiltrados: UsuarioListItem[],
  selectedLiderEmpleadoId: number | null,
): string {
  const seleccion = selectedLiderEmpleadoId == null ? "selected" : "";
  let html = `<option value="" ${seleccion}>Sin líder</option>`;

  const filtradosSinSelf = supervisoresFiltrados.filter((u) => u.empleado_id !== empleadoEmpleadoId);
  if (
    selectedLiderEmpleadoId != null &&
    !filtradosSinSelf.some((u) => u.empleado_id === selectedLiderEmpleadoId)
  ) {
    const seleccionado = supervisoresOriginales.find(
      (u) => u.empleado_id === selectedLiderEmpleadoId && u.empleado_id !== empleadoEmpleadoId,
    );
    if (seleccionado) {
      html += renderSupervisorOption(seleccionado, selectedLiderEmpleadoId, " (seleccionado)");
    }
  }

  if (filtradosSinSelf.length === 0) {
    html += `<option value="__sin_resultados" disabled>Sin resultados</option>`;
    return html;
  }

  html += filtradosSinSelf.map((u) => renderSupervisorOption(u, selectedLiderEmpleadoId)).join("");
  return html;
}

function shellHtml(): string {
  return `
    <div
      id="editar-asignacion-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-asignacion-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="editar-asignacion-title" class="text-lg font-semibold text-text-primary">Editar asignación</h2>
            <p class="mt-0.5 text-xs text-text-muted">Solo se pueden cambiar el líder inmediato y el rol del sistema.</p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            data-close-modal
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-asignacion-modal-body" class="px-5 py-4"></div>
      </div>
    </div>`;
}

function loadingBodyHtml(): string {
  return `
    <div class="flex items-center gap-3 py-6 text-sm text-text-muted">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Cargando…
    </div>`;
}

function formBodyHtml(
  empleado: UsuarioListItem,
  roles: RolBrief[],
  supervisores: UsuarioListItem[],
): string {
  const roleOpts = roles
    .map(
      (r) =>
        `<option value="${r.id}" ${r.id === empleado.rol_id ? "selected" : ""}>${escapeHtml(r.nombre)}</option>`,
    )
    .join("");

  const supOpts = renderSupervisorOptions(
    empleado.empleado_id,
    supervisores,
    supervisores,
    empleado.lider_id ?? null,
  );

  const name = formatNombreEmpleadoUi(empleado.nombre).trim() || "—";

  return `
    <p class="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-muted">
      Empleado: <span class="font-semibold text-text-primary">${escapeHtml(name)}</span>
      <span class="ml-1 text-xs">· #${escapeHtml(formatNoEmpleadoDisplay(empleado.no_empleado))}</span>
    </p>
    <p id="editar-asignacion-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
    <form id="form-editar-asignacion" class="space-y-4">
      <div>
        <label for="ea-rol_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          Rol del sistema
        </label>
        <select id="ea-rol_id" name="rol_id" required
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
          ${roleOpts}
        </select>
      </div>
      <div>
        <label for="ea-lider_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          Líder inmediato
        </label>
        <input
          id="ea-lider-search"
          type="search"
          autocomplete="off"
          placeholder="Buscar empleado..."
          class="mb-2 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue"
        />
        <select id="ea-lider_id" name="lider_id"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
          ${supOpts}
        </select>
        <p id="ea-lider-search-status" class="mt-1 min-h-5 text-xs text-text-muted" aria-live="polite"></p>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button type="button" data-close-modal
          class="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface">
          Cancelar
        </button>
        <button type="submit" id="ea-submit"
          class="rounded-lg bg-leoni-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-leoni-blue-light focus:outline-none focus:ring-2 focus:ring-leoni-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          Guardar cambios
        </button>
      </div>
    </form>`;
}

export type EditarAsignacionModalOptions = {
  onSuccess: () => void | Promise<void>;
  onSessionExpired: () => void;
  toastContainer: HTMLElement;
  signal: AbortSignal;
};

export type EditarAsignacionModalHandle = {
  open: (empleado: UsuarioListItem) => Promise<void>;
  close: () => void;
  destroy: () => void;
};

export function mountEditarAsignacionModal(
  host: HTMLElement,
  options: EditarAsignacionModalOptions,
): EditarAsignacionModalHandle {
  host.innerHTML = shellHtml();

  const overlay = host.querySelector("#editar-asignacion-overlay") as HTMLElement | null;
  const body = host.querySelector("#editar-asignacion-modal-body") as HTMLElement | null;

  if (!overlay || !body) {
    return {
      open: async () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }

  const rootOverlay = overlay;
  const modalBody = body;

  let rolesCache: RolBrief[] | null = null;
  let supervisoresCache: UsuarioListItem[] | null = null;

  function showError(msg: string): void {
    const el = host.querySelector("#editar-asignacion-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideError(): void {
    const el = host.querySelector("#editar-asignacion-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function close(): void {
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function bindFormSubmit(empleado: UsuarioListItem): void {
    const form = host.querySelector("#form-editar-asignacion") as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        hideError();

        const fd = new FormData(form);

        const rolRaw = String(fd.get("rol_id") ?? "");
        const rol_id = Number.parseInt(rolRaw, 10);
        if (Number.isNaN(rol_id)) {
          showError("Selecciona un rol.");
          return;
        }

        const lidRaw = String(fd.get("lider_id") ?? "").trim();
        const lider_id = lidRaw === "" ? null : Number.parseInt(lidRaw, 10);

        const submitBtn = host.querySelector("#ea-submit") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Guardando…";
        }

        try {
          await patchUsuarioAsignacion(empleado.id, { rol_id, lider_id });
          showEmpleadosToast(options.toastContainer, "Asignación actualizada correctamente.", "success");
          close();
          await options.onSuccess();
        } catch (e: unknown) {
          if (isUsuariosFetchError(e) && e.status === 401) {
            options.onSessionExpired();
            close();
            return;
          }
          const msg = isUsuariosFetchError(e) ? e.detail : "Error al guardar.";
          showError(msg);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar cambios";
          }
        }
      },
      { signal: options.signal },
    );
  }

  function bindLiderSearch(empleado: UsuarioListItem, supervisores: UsuarioListItem[]): void {
    const searchInput = host.querySelector("#ea-lider-search") as HTMLInputElement | null;
    const liderSelect = host.querySelector("#ea-lider_id") as HTMLSelectElement | null;
    const status = host.querySelector("#ea-lider-search-status") as HTMLElement | null;
    if (!searchInput || !liderSelect) return;

    const indiceBusqueda = supervisores.map((u) => ({
      supervisor: u,
      searchKey: construirClaveBusquedaSupervisor(u),
    }));

    let timer: ReturnType<typeof setTimeout> | undefined;

    const applyFilter = (): void => {
      const termino = normalizarTextoBusqueda(searchInput.value);
      const selectedRaw = liderSelect.value.trim();
      const selectedLiderId =
        selectedRaw === "" ? null : Number.parseInt(selectedRaw, 10);
      const filtrados =
        termino === ""
          ? supervisores
          : indiceBusqueda
              .filter((item) => item.searchKey.includes(termino))
              .map((item) => item.supervisor);

      liderSelect.innerHTML = renderSupervisorOptions(
        empleado.empleado_id,
        supervisores,
        filtrados,
        Number.isNaN(selectedLiderId ?? Number.NaN) ? null : selectedLiderId,
      );

      const selectedStr =
        selectedLiderId == null || Number.isNaN(selectedLiderId) ? "" : String(selectedLiderId);
      liderSelect.value = selectedStr;
      if (liderSelect.value !== selectedStr) liderSelect.value = "";

      if (!status) return;
      if (termino && filtrados.filter((u) => u.empleado_id !== empleado.empleado_id).length === 0) {
        status.textContent = "Sin resultados";
        return;
      }
      status.textContent = "";
    };

    searchInput.addEventListener(
      "input",
      () => {
        clearTimeout(timer);
        timer = window.setTimeout(applyFilter, LEADER_SEARCH_DEBOUNCE_MS);
      },
      { signal: options.signal },
    );
  }

  rootOverlay.addEventListener(
    "click",
    (e) => {
      if (e.target === rootOverlay) close();
    },
    { signal: options.signal },
  );

  host.addEventListener(
    "click",
    (e) => {
      const t = (e.target as HTMLElement).closest("[data-close-modal]");
      if (t) close();
    },
    { signal: options.signal },
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rootOverlay.classList.contains("hidden")) {
        e.preventDefault();
        close();
      }
    },
    { signal: options.signal },
  );

  return {
    open: async (empleado: UsuarioListItem) => {
      rootOverlay.classList.remove("hidden");
      rootOverlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      modalBody.innerHTML = loadingBodyHtml();

      try {
        if (!rolesCache || !supervisoresCache) {
          const [roles, sups] = await Promise.all([
            fetchUsuariosRoles(),
            fetchEmpleadosParaLider(),
          ]);
          rolesCache = roles;
          supervisoresCache = sups;
        }
        modalBody.innerHTML = formBodyHtml(empleado, rolesCache, supervisoresCache);
        bindFormSubmit(empleado);
        bindLiderSearch(empleado, supervisoresCache);
        const firstInput = host.querySelector<HTMLElement>("#editar-asignacion-modal-body select");
        firstInput?.focus();
      } catch (e: unknown) {
        if (isUsuariosFetchError(e) && e.status === 401) {
          options.onSessionExpired();
          close();
          return;
        }
        const msg = isUsuariosFetchError(e) ? e.detail : "No se pudo cargar el formulario.";
        modalBody.innerHTML = `<p class="text-sm text-red-700">${escapeHtml(msg)}</p>
          <button type="button" data-close-modal
            class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
      }
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
