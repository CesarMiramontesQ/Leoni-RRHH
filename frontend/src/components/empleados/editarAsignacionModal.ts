// frontend/src/components/empleados/editarAsignacionModal.ts
/**
 * Modal de edición de asignación (solo RH).
 * Permite cambiar el rol del sistema y el comedor asignado en turnos.
 */

import {
  comedorErrorMessage,
  getComedoresActivos,
  getComedorAsignado,
  isComedorApiError,
  type ComedorApiItem,
  type ComedorAsignadoApi,
} from "../../api/comedor.ts";
import { fetchUsuariosRoles, patchUsuarioAsignacion } from "../../api/usuariosAdmin.ts";
import { canAccessRhPermisosAdmin } from "../../auth/rhModulePermissions.ts";
import type { RolBrief, UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { showEmpleadosToast } from "./toast.ts";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const SELECT_CONTROL = `h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}`;
/** Clases aplicadas de una en una (classList no admite varias en un solo token). */
const SELECT_MODIFIED_CLASSES = ["ring-2", "ring-amber-300", "border-amber-400"] as const;

type FormBaseline = {
  rolId: number;
  comedorId: string;
};

function rolIdSeleccionado(empleado: UsuarioListItem, roles: RolBrief[]): number {
  const tieneRol = empleado.rol_id > 0 && roles.some((r) => r.id === empleado.rol_id);
  if (tieneRol) return empleado.rol_id;
  const def = roles.find((r) => r.nombre.trim().toLowerCase() === "empleado");
  return def?.id ?? roles[0]?.id ?? empleado.rol_id;
}

function textoRolActual(empleado: UsuarioListItem, roles: RolBrief[]): string {
  const desdeEmpleado = empleado.rol?.nombre?.trim();
  if (desdeEmpleado) return desdeEmpleado;
  const enCatalogo = roles.find((r) => r.id === empleado.rol_id);
  if (enCatalogo?.nombre?.trim()) return enCatalogo.nombre.trim();
  if (empleado.rol_id > 0) return `Rol #${empleado.rol_id}`;
  return "Sin asignar";
}

function textoComedorActual(
  asignado: ComedorAsignadoApi | null,
  comedores: readonly ComedorApiItem[],
): string {
  if (!asignado) return "Sin asignar";
  const nombreApi = asignado.comedor_nombre?.trim();
  if (nombreApi) return nombreApi;
  const enCatalogo = comedores.find((c) => c.id === asignado.comedor_id);
  if (enCatalogo?.nombre?.trim()) return enCatalogo.nombre.trim();
  return `Comedor #${asignado.comedor_id}`;
}

function buildBaseline(
  empleado: UsuarioListItem,
  roles: RolBrief[],
  comedorAsignado: ComedorAsignadoApi | null,
): FormBaseline {
  return {
    rolId: rolIdSeleccionado(empleado, roles),
    comedorId:
      comedorAsignado != null && comedorAsignado.comedor_id > 0
        ? String(comedorAsignado.comedor_id)
        : "",
  };
}

function renderComedorOptions(
  comedores: readonly ComedorApiItem[],
  selectedId: string,
  asignado: ComedorAsignadoApi | null,
): string {
  const activos = comedores.filter((c) => c.activo);
  const idsActivos = new Set(activos.map((c) => c.id));
  const extra =
    asignado != null && !idsActivos.has(asignado.comedor_id)
      ? `<option value="${String(asignado.comedor_id)}" ${selectedId === String(asignado.comedor_id) ? "selected" : ""}>${escapeHtml(textoComedorActual(asignado, comedores))}</option>`
      : "";

  const placeholder =
    selectedId === ""
      ? `<option value="" selected>Selecciona comedor…</option>`
      : `<option value="">Selecciona comedor…</option>`;

  const rest = activos
    .map(
      (c) =>
        `<option value="${String(c.id)}" ${selectedId === String(c.id) ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`,
    )
    .join("");
  return `${placeholder}${extra}${rest}`;
}

function empleadoInfoCardHtml(
  nombre: string,
  noEmpleado: string,
  rolActual: string,
  comedorActual: string,
): string {
  return `
    <section
      class="rounded-xl border border-slate-200/90 bg-linear-to-br from-slate-50 to-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5"
      aria-label="Información del empleado"
    >
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Empleado</p>
      <p class="mt-1 text-lg font-semibold leading-snug tracking-tight text-[#0A1628]">${escapeHtml(nombre)}</p>
      <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
        <div>
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Número de empleado</dt>
          <dd class="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">#${escapeHtml(noEmpleado)}</dd>
        </div>
        <div>
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rol actual</dt>
          <dd class="mt-0.5 text-sm font-semibold text-slate-800">${escapeHtml(rolActual)}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comedor actual</dt>
          <dd class="mt-0.5 text-sm font-semibold text-slate-800">${escapeHtml(comedorActual)}</dd>
        </div>
      </dl>
    </section>`;
}

function fieldBlockHtml(params: {
  id: "rol" | "comedor";
  label: string;
  description: string;
  forId: string;
  selectHtml: string;
}): string {
  return `
    <div class="flex h-full min-w-0 flex-col" data-ea-field-wrap="${params.id}">
      <div class="mb-2.5 min-h-[4.5rem] shrink-0">
        <div class="flex items-start justify-between gap-2">
          <label for="${params.forId}" class="text-sm font-semibold text-slate-900">${escapeHtml(params.label)}</label>
          <span
            data-ea-modified-badge="${params.id}"
            class="hidden shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800"
            aria-hidden="true"
          >Modificado</span>
        </div>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">${escapeHtml(params.description)}</p>
      </div>
      <div class="relative grid grid-cols-1" data-ea-select-shell>
        ${params.selectHtml}
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

async function fetchComedorAsignadoEmpleado(
  empleadoPkId: number,
): Promise<ComedorAsignadoApi | null> {
  try {
    return await getComedorAsignado(empleadoPkId);
  } catch (e: unknown) {
    if (isComedorApiError(e)) {
      if (e.status === 401) throw e;
      // Sin comedor en turnos, sin permiso legacy o empleado sin fila: el formulario sigue cargando.
      return null;
    }
    throw e;
  }
}

function mensajeErrorCarga(e: unknown): string {
  if (isUsuariosFetchError(e) && e.detail.trim()) return e.detail.trim();
  if (isComedorApiError(e) && e.detail.trim()) return e.detail.trim();
  return comedorErrorMessage(e, "No se pudo cargar el formulario.");
}

function shellHtml(): string {
  return `
    <div
      id="editar-asignacion-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(94vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-asignacion-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 id="editar-asignacion-title" class="text-lg font-semibold leading-snug tracking-tight text-[#0A1628]">
              Editar asignación
            </h2>
            <p class="mt-1 text-xs text-slate-500">Actualiza rol y comedor del empleado.</p>
          </div>
          <button
            type="button"
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            data-close-modal
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div
          id="editar-asignacion-modal-body"
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/40 px-5 py-5 sm:px-6 sm:py-6"
        ></div>
      </div>
    </div>`;
}

function loadingBodyHtml(): string {
  return `
    <div class="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Cargando asignaciones…
    </div>`;
}

function formBodyHtml(
  empleado: UsuarioListItem,
  roles: RolBrief[],
  comedores: ComedorApiItem[],
  comedorAsignado: ComedorAsignadoApi | null,
  baseline: FormBaseline,
  canEditRol: boolean,
): string {
  const rolActual = textoRolActual(empleado, roles);
  const comedorActual = textoComedorActual(comedorAsignado, comedores);
  const name = formatNombreEmpleadoUi(empleado.nombre).trim() || "—";
  const noEmpleado = formatNoEmpleadoDisplay(empleado.no_empleado);

  const roleOpts = roles
    .map(
      (r) =>
        `<option value="${r.id}" ${r.id === baseline.rolId ? "selected" : ""}>${escapeHtml(r.nombre)}</option>`,
    )
    .join("");

  // Un <select disabled> no se incluye en FormData: con rol bloqueado no se envía rol_id.
  const rolSelect = `<select
    id="ea-rol_id"
    name="rol_id"
    required
    data-ea-control="rol"
    ${canEditRol ? "" : "disabled"}
    class="col-start-1 row-start-1 ${SELECT_CONTROL}${canEditRol ? "" : " cursor-not-allowed bg-slate-100 text-slate-500"}"
  >${roleOpts}</select>`;

  const comedorSelect = `<select
    id="ea-comedor_id"
    name="comedor_id"
    required
    data-ea-control="comedor"
    class="col-start-1 row-start-1 ${SELECT_CONTROL}"
  >${renderComedorOptions(comedores, baseline.comedorId, comedorAsignado)}</select>`;

  return `
    <div class="flex flex-col gap-6">
      ${empleadoInfoCardHtml(name, noEmpleado, rolActual, comedorActual)}
      <p id="editar-asignacion-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"></p>
      <form id="form-editar-asignacion" class="flex flex-col gap-6">
        <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5" aria-labelledby="ea-asignaciones-title">
          <h3 id="ea-asignaciones-title" class="text-sm font-semibold text-[#0A1628]">Asignaciones</h3>
          <p class="mt-1 text-xs text-slate-500">Los cambios se aplican al guardar.</p>
          <div class="mt-5 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 sm:gap-5">
            ${fieldBlockHtml({
              id: "rol",
              label: "Rol del sistema",
              description: canEditRol
                ? "Define los permisos de acceso del empleado."
                : "Solo administradores de permisos pueden cambiar el rol.",
              forId: "ea-rol_id",
              selectHtml: rolSelect,
            })}
            ${fieldBlockHtml({
              id: "comedor",
              label: "Comedor asignado",
              description: "Comedor donde el empleado podrá registrar servicios.",
              forId: "ea-comedor_id",
              selectHtml: comedorSelect,
            })}
          </div>
        </section>
        <footer class="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-5 sm:flex-row sm:justify-end">
          <button type="button" data-close-modal class="${BTN_SECONDARY} min-h-11 w-full justify-center sm:w-auto">
            Cancelar
          </button>
          <button
            type="submit"
            id="ea-submit"
            disabled
            class="${BTN_PRIMARY} min-h-11 w-full justify-center px-6 shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[11rem] sm:w-auto"
          >
            <span data-ea-submit-label>Guardar cambios</span>
          </button>
        </footer>
      </form>
    </div>`;
}

function setFieldModified(host: HTMLElement, field: "rol" | "comedor", modified: boolean): void {
  const wrap = host.querySelector(`[data-ea-field-wrap="${field}"]`);
  const badge = host.querySelector(`[data-ea-modified-badge="${field}"]`);
  const control = host.querySelector<HTMLSelectElement>(`[data-ea-control="${field}"]`);
  if (!wrap || !badge || !control) return;
  badge.classList.toggle("hidden", !modified);
  for (const cls of SELECT_MODIFIED_CLASSES) {
    control.classList.toggle(cls, modified);
  }
  wrap.setAttribute("data-ea-modified", modified ? "true" : "false");
}

function syncFormDirtyState(host: HTMLElement, baseline: FormBaseline, isSaving = false): boolean {
  const rolSelect = host.querySelector<HTMLSelectElement>('[data-ea-control="rol"]');
  const comedorSelect = host.querySelector<HTMLSelectElement>('[data-ea-control="comedor"]');
  const submitBtn = host.querySelector<HTMLButtonElement>("#ea-submit");
  if (!rolSelect || !comedorSelect || !submitBtn) return false;

  const rolChanged = Number.parseInt(rolSelect.value, 10) !== baseline.rolId;
  const comedorChanged = comedorSelect.value !== baseline.comedorId;
  const dirty = rolChanged || comedorChanged;

  setFieldModified(host, "rol", rolChanged);
  setFieldModified(host, "comedor", comedorChanged);

  submitBtn.disabled = isSaving || !dirty;
  return dirty;
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
  let comedoresCache: ComedorApiItem[] | null = null;

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

  function setSubmitLoading(loading: boolean): void {
    const submitBtn = host.querySelector<HTMLButtonElement>("#ea-submit");
    const label = host.querySelector("[data-ea-submit-label]");
    if (!submitBtn || !label) return;
    submitBtn.dataset.loading = loading ? "true" : "false";
    submitBtn.setAttribute("aria-busy", loading ? "true" : "false");
    if (loading) {
      label.innerHTML = `<span class="inline-flex items-center gap-2">
        <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Guardando…
      </span>`;
      return;
    }
    label.textContent = "Guardar cambios";
  }

  function close(): void {
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function bindFormInteractions(baseline: FormBaseline): void {
    const rolSelect = host.querySelector<HTMLSelectElement>('[data-ea-control="rol"]');
    const comedorSelect = host.querySelector<HTMLSelectElement>('[data-ea-control="comedor"]');
    const submitBtn = host.querySelector<HTMLButtonElement>("#ea-submit");
    if (!rolSelect || !comedorSelect || !submitBtn) return;

    const onChange = (): void => {
      syncFormDirtyState(host, baseline, submitBtn.dataset.loading === "true");
    };

    rolSelect.addEventListener("change", onChange, { signal: options.signal });
    comedorSelect.addEventListener("change", onChange, { signal: options.signal });
    syncFormDirtyState(host, baseline);
  }

  function bindFormSubmit(empleado: UsuarioListItem, baseline: FormBaseline): void {
    const form = host.querySelector("#form-editar-asignacion") as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        hideError();

        if (!syncFormDirtyState(host, baseline)) return;

        const fd = new FormData(form);

        // Si el control de rol está deshabilitado (sin permiso), no se envía rol_id.
        const rolControl = host.querySelector<HTMLSelectElement>('[data-ea-control="rol"]');
        const canEditRol = !!rolControl && !rolControl.disabled;

        let rol_id: number | undefined;
        if (canEditRol) {
          const rolRaw = String(fd.get("rol_id") ?? "");
          rol_id = Number.parseInt(rolRaw, 10);
          if (Number.isNaN(rol_id)) {
            showError("Selecciona un rol.");
            return;
          }
        }

        const comRaw = String(fd.get("comedor_id") ?? "").trim();
        const comedor_id = Number.parseInt(comRaw, 10);
        if (Number.isNaN(comedor_id) || comedor_id < 1) {
          showError("Selecciona un comedor.");
          return;
        }

        setSubmitLoading(true);
        syncFormDirtyState(host, baseline, true);

        try {
          await patchUsuarioAsignacion(empleado.id, {
            ...(rol_id !== undefined ? { rol_id } : {}),
            comedor_id,
          });
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
          setSubmitLoading(false);
          syncFormDirtyState(host, baseline);
        }
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
        const [roles, comedores, comedorAsignado] = await Promise.all([
          rolesCache ?? fetchUsuariosRoles(),
          comedoresCache ?? getComedoresActivos(),
          fetchComedorAsignadoEmpleado(empleado.id),
        ]);
        rolesCache = roles;
        comedoresCache = comedores;
        const baseline = buildBaseline(empleado, roles, comedorAsignado);
        const canEditRol = canAccessRhPermisosAdmin();
        modalBody.innerHTML = formBodyHtml(
          empleado,
          roles,
          comedores,
          comedorAsignado,
          baseline,
          canEditRol,
        );
        bindFormInteractions(baseline);
        bindFormSubmit(empleado, baseline);
        host.querySelector<HTMLElement>('[data-ea-control="rol"]')?.focus();
      } catch (e: unknown) {
        if (
          (isUsuariosFetchError(e) || isComedorApiError(e)) &&
          e.status === 401
        ) {
          options.onSessionExpired();
          close();
          return;
        }
        const msg = mensajeErrorCarga(e);
        modalBody.innerHTML = `<p class="text-sm text-red-700">${escapeHtml(msg)}</p>
          <button type="button" data-close-modal class="${BTN_SECONDARY} mt-4 min-h-10 px-5">Cerrar</button>`;
      }
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
