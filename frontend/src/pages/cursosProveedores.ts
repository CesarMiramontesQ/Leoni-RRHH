import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  createPersona,
  createProveedor,
  deletePersona,
  getProveedor,
  getProveedores,
  updateProveedor,
  type Proveedor,
  type ProveedorDetalle,
  type ProveedorExternoFetchError,
} from "../api/proveedoresExternos.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  pageHeading,
} from "../ui/uiTokens.ts";

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;

type Filters = { text: string };

function renderLoading(): string {
  return `<div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center text-sm text-text-muted">Cargando contratistas…</div>`;
}

function renderError(msg: string | null): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">No se pudieron cargar los contratistas</p>
    <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(msg ?? "Error desconocido")}</p>
    <button type="button" data-action="retry" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Reintentar</button>
  </div>`;
}

function renderEmpty(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center">
    <p class="text-base font-semibold text-text-primary">Aún no hay contratistas registrados</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Registra el primer contratista para dar de alta a su personal externo.
    </p>
    <button type="button" data-action="add" class="${RH_LISTADO_BTN_PRIMARY} mx-auto mt-6 inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Nuevo contratista</span>
    </button>
  </div>`;
}

function renderNoResults(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">Sin resultados</p>
    <p class="mt-1.5 text-xs text-text-muted">Ningún contratista coincide con la búsqueda.</p>
    <button type="button" data-action="clear-search" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Limpiar búsqueda</button>
  </div>`;
}

function renderRow(p: Proveedor): string {
  const nombre = escapeHtml(p.nombre);
  return `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-3.5 align-middle">
        <button type="button" data-action="view" data-id="${p.id}" class="max-w-xs truncate text-left text-sm font-semibold text-accent hover:underline" title="${nombre}">${nombre}</button>
        ${p.rfc ? `<span class="block text-xs text-text-muted">${escapeHtml(p.rfc)}</span>` : ""}
      </td>
      <td class="px-4 py-3.5 align-middle text-sm text-text-secondary">${p.contacto ? escapeHtml(p.contacto) : "—"}</td>
      <td class="px-4 py-3.5 align-middle text-sm text-text-secondary">${p.telefono ? escapeHtml(p.telefono) : "—"}</td>
      <td class="px-4 py-3.5 align-middle text-center text-sm tabular-nums text-text-primary">${p.personas_count}</td>
      <td class="whitespace-nowrap px-3 py-3.5 align-middle text-right">
        <button type="button" data-action="view" data-id="${p.id}" class="${RH_LISTADO_BTN_SECONDARY} !px-3 !py-1.5 text-xs">Ver</button>
      </td>
    </tr>`;
}

function renderTable(items: Proveedor[]): string {
  return `
  <section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Listado de contratistas">
    <div class="overflow-x-auto">
      <table class="min-w-[680px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Contratista</th>
            <th scope="col" class="px-4 py-3.5 text-left">Contacto</th>
            <th scope="col" class="px-4 py-3.5 text-left">Teléfono</th>
            <th scope="col" class="px-4 py-3.5 text-center">Personas</th>
            <th scope="col" class="px-3 py-3.5 text-right"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${items.map(renderRow).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function renderHeader(): string {
  const actions = `
    <button type="button" data-action="add" class="${RH_LISTADO_BTN_PRIMARY} inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Nuevo contratista</span>
    </button>`;
  return pageHeading(
    "Contratistas",
    "Administra las empresas contratistas y el personal externo que ingresa a planta.",
    actions,
  );
}

function renderSearch(filters: Filters): string {
  return `
  <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Búsqueda de contratistas">
    <label for="prov-search" class="${RH_LISTADO_LABEL}">Buscar contratista</label>
    <input type="search" id="prov-search" autocomplete="off" placeholder="Nombre del contratista…"
      value="${escapeHtml(filters.text)}" class="${FIELD_INPUT}" />
  </section>`;
}

function renderReady(items: Proveedor[], filters: Filters): string {
  const q = filters.text.trim().toLowerCase();
  const filtered = q ? items.filter((p) => p.nombre.toLowerCase().includes(q)) : items;
  const body =
    items.length === 0
      ? renderEmpty()
      : `
    <div class="flex flex-col gap-4 sm:gap-5">
      ${renderSearch(filters)}
      ${filtered.length === 0 ? renderNoResults() : renderTable(filtered)}
    </div>`;
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}">
    ${renderLevelUpBackBar()}
    ${renderHeader()}
    ${body}
  </div>`;
}

// ── Modal alta/edición proveedor ─────────────────────────────────────────────
function renderProveedorModal(prov: Proveedor | null): string {
  const editing = prov != null;
  const v = (s: string | null | undefined) => escapeHtml(s ?? "");
  return `
    <div id="prov-modal-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-xl" role="dialog" aria-modal="true" aria-labelledby="prov-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="prov-modal-title" class="text-lg font-semibold text-text-primary">${editing ? "Editar contratista" : "Nuevo contratista"}</h3>
        </div>
        <form id="prov-modal-form" data-id="${editing ? prov!.id : ""}" class="flex flex-col gap-4 px-6 py-5">
          <div id="prov-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          <div>
            <label for="prov-nombre" class="${RH_LISTADO_LABEL}">Nombre / marca <span class="text-red-600" aria-hidden="true">*</span></label>
            <input id="prov-nombre" name="nombre" type="text" required value="${editing ? v(prov!.nombre) : ""}" class="${FIELD_INPUT}" placeholder="Ej. Constructora Acme S.A." />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="prov-rfc" class="${RH_LISTADO_LABEL}">RFC</label>
              <input id="prov-rfc" name="rfc" type="text" value="${editing ? v(prov!.rfc) : ""}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label for="prov-telefono" class="${RH_LISTADO_LABEL}">Teléfono</label>
              <input id="prov-telefono" name="telefono" type="text" value="${editing ? v(prov!.telefono) : ""}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label for="prov-contacto" class="${RH_LISTADO_LABEL}">Contacto</label>
              <input id="prov-contacto" name="contacto" type="text" value="${editing ? v(prov!.contacto) : ""}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label for="prov-email" class="${RH_LISTADO_LABEL}">Email</label>
              <input id="prov-email" name="email" type="email" value="${editing ? v(prov!.email) : ""}" class="${FIELD_INPUT}" />
            </div>
          </div>
          <div>
            <label for="prov-direccion" class="${RH_LISTADO_LABEL}">Dirección</label>
            <textarea id="prov-direccion" name="direccion" rows="2" class="${FIELD_TEXTAREA}">${editing ? v(prov!.direccion) : ""}</textarea>
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" data-action="close-modal" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">${editing ? "Guardar cambios" : "Guardar contratista"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ── Modal detalle proveedor + personas ───────────────────────────────────────
function renderPersonaRow(nombre: string, ident: string | null, puesto: string | null, id: number): string {
  return `
    <li class="flex items-center justify-between gap-3 px-3 py-2">
      <span class="min-w-0">
        <span class="block truncate text-sm text-text-primary">${escapeHtml(nombre)}</span>
        ${
          ident || puesto
            ? `<span class="block truncate text-xs text-text-muted">${escapeHtml([puesto, ident].filter(Boolean).join(" · "))}</span>`
            : ""
        }
      </span>
      <button type="button" data-action="del-persona" data-id="${id}" class="shrink-0 text-xs font-medium text-red-600 hover:underline">Quitar</button>
    </li>`;
}

function renderDetailModal(prov: ProveedorDetalle): string {
  const personas =
    prov.personas.length === 0
      ? '<p class="px-3 py-3 text-sm text-text-muted">Sin personas registradas.</p>'
      : `<ul class="divide-y divide-slate-100">${prov.personas
          .map((p) => renderPersonaRow(p.nombre, p.identificacion, p.puesto, p.id))
          .join("")}</ul>`;
  return `
    <div id="prov-detail-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="prov-detail-title">
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div class="min-w-0">
            <h3 id="prov-detail-title" class="truncate text-lg font-semibold text-text-primary">${escapeHtml(prov.nombre)}</h3>
            <p class="mt-1 text-xs text-text-muted">${[prov.contacto, prov.telefono, prov.email].filter(Boolean).map(escapeHtml).join(" · ") || "Sin datos de contacto"}</p>
          </div>
          <button type="button" data-action="edit-proveedor" data-id="${prov.id}" class="${RH_LISTADO_BTN_SECONDARY} !px-3 !py-1.5 text-xs shrink-0">Editar</button>
        </div>
        <div class="flex flex-col gap-4 px-6 py-5">
          <div class="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p class="mb-2 text-sm font-medium text-text-primary">Agregar persona</p>
            <form id="persona-form" data-proveedor="${prov.id}" class="grid gap-3 sm:grid-cols-3">
              <input name="nombre" type="text" required placeholder="Nombre completo" class="${FIELD_INPUT} sm:col-span-3" />
              <input name="identificacion" type="text" placeholder="Identificación / gafete" class="${FIELD_INPUT}" />
              <input name="puesto" type="text" placeholder="Puesto / rol" class="${FIELD_INPUT}" />
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} justify-center">Agregar</button>
            </form>
            <p id="persona-form-error" class="mt-2 hidden text-sm text-red-700" role="alert"></p>
          </div>
          <div>
            <p class="${RH_LISTADO_LABEL}">Personal externo (${prov.personas.length})</p>
            <div class="rounded-lg border border-border">${personas}</div>
          </div>
          <div class="flex justify-end border-t border-slate-100 pt-4">
            <button type="button" data-action="close-detail" class="${RH_LISTADO_BTN_SECONDARY}">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;
}

export function mountCursosProveedores(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: Proveedor[] = [];
  const filters: Filters = { text: "" };
  let errorMessage: string | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let detailProveedorId: number | null = null;

  mountAppShell(container, {
    pageTitle: "Contratistas",
    activeNav: "cursos-proveedores",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="prov-root">
      <div id="prov-inner">${renderLoading()}</div>
      <div id="prov-modal-host"></div>
      <div id="prov-detail-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#prov-inner");
    if (!inner) return;
    if (status === "loading") inner.innerHTML = renderLoading();
    else if (status === "error") inner.innerHTML = renderError(errorMessage);
    else inner.innerHTML = renderReady(items, filters);
  }

  async function load(): Promise<void> {
    status = "loading";
    paint();
    try {
      const res = await getProveedores({ page: 1, page_size: 200 });
      items = res.items;
      status = "ready";
    } catch (e) {
      status = "error";
      errorMessage = (e as ProveedorExternoFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  function openProveedorModal(prov: Proveedor | null): void {
    const host = container.querySelector("#prov-modal-host");
    if (host) host.innerHTML = renderProveedorModal(prov);
  }
  function closeProveedorModal(): void {
    const host = container.querySelector("#prov-modal-host");
    if (host) host.innerHTML = "";
  }

  async function openDetail(id: number): Promise<void> {
    const host = container.querySelector("#prov-detail-host");
    if (!host) return;
    try {
      const prov = await getProveedor(id);
      detailProveedorId = id;
      host.innerHTML = renderDetailModal(prov);
    } catch {
      host.innerHTML = "";
    }
  }
  async function refreshDetail(): Promise<void> {
    if (detailProveedorId != null) await openDetail(detailProveedorId);
  }
  function closeDetail(): void {
    detailProveedorId = null;
    const host = container.querySelector("#prov-detail-host");
    if (host) host.innerHTML = "";
  }

  container.addEventListener(
    "click",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "prov-modal-backdrop") return closeProveedorModal();
      if (target.id === "prov-detail-backdrop") return closeDetail();
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (!action) return;
      const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
      if (action === "retry") return void load();
      if (action === "clear-search") {
        filters.text = "";
        return paint();
      }
      if (action === "add") return openProveedorModal(null);
      if (action === "close-modal") return closeProveedorModal();
      if (action === "close-detail") return closeDetail();
      if (action === "view" && !Number.isNaN(id)) return void openDetail(id);
      if (action === "edit-proveedor" && !Number.isNaN(id)) {
        const prov = items.find((p) => p.id === id) ?? null;
        closeDetail();
        return openProveedorModal(prov);
      }
      if (action === "del-persona" && !Number.isNaN(id)) return void handleDeletePersona(id);
    },
    { signal },
  );

  async function handleDeletePersona(personaId: number): Promise<void> {
    try {
      await deletePersona(personaId);
      await refreshDetail();
      await load();
    } catch {
      /* noop */
    }
  }

  container.addEventListener(
    "input",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "prov-search") {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filters.text = (target as HTMLInputElement).value;
          paint();
        }, 250);
      }
    },
    { signal },
  );

  container.addEventListener(
    "submit",
    async (e) => {
      if (signal.aborted) return;
      const el = e.target as HTMLElement;

      const provForm = el.closest<HTMLFormElement>("#prov-modal-form");
      if (provForm) {
        e.preventDefault();
        await submitProveedor(provForm);
        return;
      }
      const personaForm = el.closest<HTMLFormElement>("#persona-form");
      if (personaForm) {
        e.preventDefault();
        await submitPersona(personaForm);
      }
    },
    { signal },
  );

  async function submitProveedor(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const errorEl = form.querySelector("#prov-form-error") as HTMLElement | null;
    if (nombre.length < 2) {
      if (errorEl) {
        errorEl.textContent = "El nombre debe tener al menos 2 caracteres.";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    const payload = {
      nombre,
      rfc: String(fd.get("rfc") ?? "").trim() || null,
      contacto: String(fd.get("contacto") ?? "").trim() || null,
      telefono: String(fd.get("telefono") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      direccion: String(fd.get("direccion") ?? "").trim() || null,
    };
    const editId = Number(form.dataset.id);
    const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (!Number.isNaN(editId) && form.dataset.id) {
        await updateProveedor(editId, payload);
      } else {
        await createProveedor(payload);
      }
      closeProveedorModal();
      await load();
    } catch (err) {
      const detail = (err as ProveedorExternoFetchError)?.detail ?? "Error al guardar";
      if (errorEl) {
        errorEl.textContent = detail;
        errorEl.classList.remove("hidden");
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function submitPersona(form: HTMLFormElement): Promise<void> {
    const proveedorId = Number(form.dataset.proveedor);
    if (Number.isNaN(proveedorId)) return;
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const errorEl = container.querySelector("#persona-form-error") as HTMLElement | null;
    if (nombre.length < 2) {
      if (errorEl) {
        errorEl.textContent = "El nombre de la persona debe tener al menos 2 caracteres.";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    try {
      await createPersona(proveedorId, {
        nombre,
        identificacion: String(fd.get("identificacion") ?? "").trim() || null,
        puesto: String(fd.get("puesto") ?? "").trim() || null,
      });
      await refreshDetail();
      await load();
    } catch (err) {
      const detail = (err as ProveedorExternoFetchError)?.detail ?? "Error al agregar la persona";
      if (errorEl) {
        errorEl.textContent = detail;
        errorEl.classList.remove("hidden");
      }
    }
  }

  void load();
}
