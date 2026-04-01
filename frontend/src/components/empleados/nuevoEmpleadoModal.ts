import { getEmpleadosPage } from "../../api/empleados.ts";
import {
  createUsuario,
  fetchUsuariosRoles,
  type UsuarioCreatePayload,
} from "../../api/usuariosAdmin.ts";
import type { CatalogoFiltros, RolBrief, UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { showEmpleadosToast } from "./toast.ts";

/** GET /api/v1/empleados exige page_size ≤ 100; paginamos para el listado de supervisores. */
async function fetchEmpleadosActivosParaSupervisor(): Promise<UsuarioListItem[]> {
  const page_size = 100;
  const acc: UsuarioListItem[] = [];
  let page = 1;
  for (;;) {
    const pg = await getEmpleadosPage({
      page,
      page_size,
      activo: true,
    });
    acc.push(...pg.items);
    if (pg.items.length < page_size || acc.length >= pg.total) break;
    page += 1;
  }
  return acc;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shellHtml(): string {
  return `
    <div
      id="nuevo-empleado-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
    >
      <div
        class="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-empleado-title"
        data-modal-panel
      >
        <div class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="nuevo-empleado-title" class="text-lg font-semibold text-text-primary">Nuevo empleado</h2>
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
        <div id="nuevo-empleado-modal-body" class="px-5 py-4"></div>
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
      Cargando formulario…
    </div>`;
}

function formBodyHtml(
  roles: RolBrief[],
  supervisores: UsuarioListItem[],
  catalogo: CatalogoFiltros,
): string {
  const roleOpts = roles
    .map(
      (r) =>
        `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`,
    )
    .join("");
  const supOpts = supervisores
    .map((u) => {
      const label = `${u.nombre} ${u.apellido}`.trim() || u.email;
      return `<option value="${u.id}">${escapeHtml(label)} · #${escapeHtml(u.num_empleado)}</option>`;
    })
    .join("");
  const deptOpts = catalogo.departamentos
    .map((d) => `<option value="${escapeHtml(d)}"></option>`)
    .join("");
  const puestoOpts = catalogo.puestos
    .map((p) => `<option value="${escapeHtml(p)}"></option>`)
    .join("");

  return `
    <p id="nuevo-empleado-form-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
    <form id="form-nuevo-empleado" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="ne-num_empleado" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Número de empleado <span class="text-red-600">*</span></label>
          <input id="ne-num_empleado" name="num_empleado" required autocomplete="off" maxlength="50"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
        <div>
          <label for="ne-nombre" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre <span class="text-red-600">*</span></label>
          <input id="ne-nombre" name="nombre" required autocomplete="given-name" maxlength="150"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
        <div>
          <label for="ne-apellido" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Apellido <span class="text-red-600">*</span></label>
          <input id="ne-apellido" name="apellido" required autocomplete="family-name" maxlength="150"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
        <div class="sm:col-span-2">
          <label for="ne-email" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Correo <span class="text-red-600">*</span></label>
          <input id="ne-email" name="email" type="email" required autocomplete="email"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
        <div>
          <label for="ne-password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Contraseña <span class="text-red-600">*</span></label>
          <input id="ne-password" name="password" type="password" required autocomplete="new-password" minlength="8"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
          <p class="mt-1 text-xs text-text-muted">Mínimo 8 caracteres (validación del servidor).</p>
        </div>
        <div>
          <label for="ne-password2" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Confirmar contraseña <span class="text-red-600">*</span></label>
          <input id="ne-password2" name="password2" type="password" required autocomplete="new-password" minlength="8"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
        <div>
          <label for="ne-departamento" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Departamento</label>
          <input id="ne-departamento" name="departamento" list="ne-list-dept" autocomplete="organization" maxlength="150"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
          <datalist id="ne-list-dept">${deptOpts}</datalist>
        </div>
        <div>
          <label for="ne-puesto" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Puesto</label>
          <input id="ne-puesto" name="puesto" list="ne-list-puesto" autocomplete="organization-title" maxlength="150"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
          <datalist id="ne-list-puesto">${puestoOpts}</datalist>
        </div>
        <div>
          <label for="ne-rol_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Rol <span class="text-red-600">*</span></label>
          <select id="ne-rol_id" name="rol_id" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
            <option value="" disabled selected>Seleccionar…</option>
            ${roleOpts}
          </select>
        </div>
        <div>
          <label for="ne-supervisor_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Supervisor</label>
          <select id="ne-supervisor_id" name="supervisor_id"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
            <option value="">Sin supervisor</option>
            ${supOpts}
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="ne-fecha_ingreso" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Fecha de ingreso</label>
          <input id="ne-fecha_ingreso" name="fecha_ingreso" type="date"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue" />
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button type="button" data-close-modal
          class="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface">
          Cancelar
        </button>
        <button type="submit" id="ne-submit"
          class="rounded-lg bg-leoni-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-leoni-blue-light focus:outline-none focus:ring-2 focus:ring-leoni-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          Guardar empleado
        </button>
      </div>
    </form>`;
}

export type NuevoEmpleadoModalOptions = {
  getCatalogo: () => CatalogoFiltros;
  onSuccess: () => void | Promise<void>;
  onSessionExpired: () => void;
  toastContainer: HTMLElement;
  signal: AbortSignal;
};

export type NuevoEmpleadoModalHandle = {
  open: () => Promise<void>;
  close: () => void;
  destroy: () => void;
};

export function mountNuevoEmpleadoModal(
  host: HTMLElement,
  options: NuevoEmpleadoModalOptions,
): NuevoEmpleadoModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector("#nuevo-empleado-overlay") as HTMLElement | null;
  const body = host.querySelector("#nuevo-empleado-modal-body") as HTMLElement | null;
  if (!overlay || !body) {
    return {
      open: async () => {},
      close: () => {},
      destroy: () => {
        host.innerHTML = "";
      },
    };
  }

  const overlayEl = overlay;
  const bodyEl = body;

  let loaded = false;
  let rolesCache: RolBrief[] = [];
  let supervisoresCache: UsuarioListItem[] = [];

  function showFormError(msg: string): void {
    const el = host.querySelector("#nuevo-empleado-form-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideFormError(): void {
    const el = host.querySelector("#nuevo-empleado-form-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    // Devolver foco al botón trigger al cerrar
    const trigger = document.querySelector<HTMLElement>("#btn-nuevo-empleado");
    trigger?.focus();
  }

  async function prepareForm(): Promise<void> {
    bodyEl.innerHTML = loadingBodyHtml();
    hideFormError();
    try {
      const [roles, supervisores] = await Promise.all([
        fetchUsuariosRoles(),
        fetchEmpleadosActivosParaSupervisor(),
      ]);
      rolesCache = roles;
      supervisoresCache = supervisores;
      bodyEl.innerHTML = formBodyHtml(roles, supervisores, options.getCatalogo());
      loaded = true;
      bindFormSubmit();
    } catch (e: unknown) {
      if (isUsuariosFetchError(e) && e.status === 401) {
        options.onSessionExpired();
        close();
        return;
      }
      const msg = isUsuariosFetchError(e) ? e.detail : "No se pudo cargar el formulario.";
      bodyEl.innerHTML = `<p class="text-sm text-red-700">${escapeHtml(msg)}</p>
        <button type="button" data-close-modal class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
    }
  }

  function bindFormSubmit(): void {
    const form = host.querySelector("#form-nuevo-empleado") as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        hideFormError();
        const fd = new FormData(form);
        const password = String(fd.get("password") ?? "");
        const password2 = String(fd.get("password2") ?? "");
        if (password !== password2) {
          showFormError("Las contraseñas no coinciden.");
          return;
        }
        const rolRaw = String(fd.get("rol_id") ?? "");
        const rol_id = Number.parseInt(rolRaw, 10);
        if (Number.isNaN(rol_id)) {
          showFormError("Selecciona un rol.");
          return;
        }
        const supRaw = String(fd.get("supervisor_id") ?? "").trim();
        const supervisor_id = supRaw === "" ? null : Number.parseInt(supRaw, 10);
        if (supervisor_id !== null && Number.isNaN(supervisor_id)) {
          showFormError("Supervisor no válido.");
          return;
        }
        const fecha = String(fd.get("fecha_ingreso") ?? "").trim();
        const payload: UsuarioCreatePayload = {
          num_empleado: String(fd.get("num_empleado") ?? ""),
          nombre: String(fd.get("nombre") ?? ""),
          apellido: String(fd.get("apellido") ?? ""),
          email: String(fd.get("email") ?? ""),
          password,
          rol_id,
          departamento: String(fd.get("departamento") ?? "").trim() || null,
          puesto: String(fd.get("puesto") ?? "").trim() || null,
          supervisor_id,
          fecha_ingreso: fecha || null,
        };

        const submitBtn = host.querySelector("#ne-submit") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Guardando…";
        }
        try {
          await createUsuario(payload);
          showEmpleadosToast(options.toastContainer, "Empleado creado correctamente.", "success");
          close();
          form.reset();
          await options.onSuccess();
        } catch (e: unknown) {
          if (isUsuariosFetchError(e) && e.status === 401) {
            options.onSessionExpired();
            close();
            return;
          }
          const msg = isUsuariosFetchError(e) ? e.detail : "Error al guardar.";
          showFormError(msg);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar empleado";
          }
        }
      },
      { signal: options.signal },
    );
  }

  overlayEl.addEventListener(
    "click",
    (e) => {
      if (e.target === overlayEl) close();
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

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && !overlayEl.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKey, { signal: options.signal });

  return {
    open: async () => {
      overlayEl.classList.remove("hidden");
      overlayEl.classList.add("flex");
      document.body.style.overflow = "hidden";
      if (!loaded) await prepareForm();
      else {
        bodyEl.innerHTML = formBodyHtml(rolesCache, supervisoresCache, options.getCatalogo());
        bindFormSubmit();
      }
      // Mover foco al primer campo interactivo del modal
      const firstInput = host.querySelector<HTMLElement>(
        "#nuevo-empleado-modal-body input, #nuevo-empleado-modal-body select, [data-close-modal]",
      );
      firstInput?.focus();
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
