import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  createCursoExterno,
  deleteCursoExterno,
  getCursosExternos,
  updateCursoExterno,
  type CursoExterno,
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

function vigenciaLabel(meses: number | null): string {
  if (meses == null) return '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">No vence</span>';
  const txt = meses === 12 ? "1 año" : meses % 12 === 0 ? `${meses / 12} años` : `${meses} meses`;
  return `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-xs font-medium text-blue-900">Cada ${escapeHtml(txt)}</span>`;
}

function renderLoading(): string {
  return `<div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center text-sm text-text-muted">Cargando cursos…</div>`;
}

function renderError(msg: string | null): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">No se pudieron cargar los cursos externos</p>
    <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(msg ?? "Error desconocido")}</p>
    <button type="button" data-action="retry" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Reintentar</button>
  </div>`;
}

function renderEmpty(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center">
    <p class="text-base font-semibold text-text-primary">Aún no hay cursos externos</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Registra los cursos que requiere el personal externo (seguridad, inducción, etc.) y su periodicidad de recertificación.
    </p>
    <button type="button" data-action="add" class="${RH_LISTADO_BTN_PRIMARY} mx-auto mt-6 inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Nuevo curso</span>
    </button>
  </div>`;
}

function renderRow(c: CursoExterno): string {
  return `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-3.5 align-middle">
        <span class="block text-sm font-semibold text-text-primary">${escapeHtml(c.nombre)}</span>
        ${c.descripcion ? `<span class="block max-w-md truncate text-xs text-text-muted" title="${escapeHtml(c.descripcion)}">${escapeHtml(c.descripcion)}</span>` : ""}
      </td>
      <td class="px-4 py-3.5 align-middle">${vigenciaLabel(c.vigencia_meses)}</td>
      <td class="whitespace-nowrap px-3 py-3.5 align-middle text-right">
        <button type="button" data-action="edit" data-id="${c.id}" class="${RH_LISTADO_BTN_SECONDARY} !px-3 !py-1.5 text-xs">Editar</button>
        <button type="button" data-action="delete" data-id="${c.id}" class="${RH_LISTADO_BTN_SECONDARY} !px-3 !py-1.5 text-xs !text-red-600">Baja</button>
      </td>
    </tr>`;
}

function renderTable(items: CursoExterno[]): string {
  return `
  <section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Listado de cursos externos">
    <div class="overflow-x-auto">
      <table class="min-w-[560px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Curso</th>
            <th scope="col" class="px-4 py-3.5 text-left">Vigencia</th>
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
      ${ICON_PLUS}<span>Nuevo curso</span>
    </button>`;
  return pageHeading(
    "Cursos externos",
    "Catálogo de cursos requeridos para el personal externo, con su periodicidad de recertificación.",
    actions,
  );
}

function renderReady(items: CursoExterno[]): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}">
    ${renderLevelUpBackBar()}
    ${renderHeader()}
    ${items.length === 0 ? renderEmpty() : renderTable(items)}
  </div>`;
}

function renderModal(curso: CursoExterno | null): string {
  const editing = curso != null;
  return `
    <div id="curso-modal-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="curso-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="curso-modal-title" class="text-lg font-semibold text-text-primary">${editing ? "Editar curso" : "Nuevo curso externo"}</h3>
        </div>
        <form id="curso-modal-form" data-id="${editing ? curso!.id : ""}" class="flex flex-col gap-4 px-6 py-5">
          <div id="curso-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          <div>
            <label for="curso-nombre" class="${RH_LISTADO_LABEL}">Nombre del curso <span class="text-red-600" aria-hidden="true">*</span></label>
            <input id="curso-nombre" name="nombre" type="text" required value="${editing ? escapeHtml(curso!.nombre) : ""}" class="${FIELD_INPUT}" placeholder="Ej. Inducción de seguridad" />
          </div>
          <div>
            <label for="curso-descripcion" class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea id="curso-descripcion" name="descripcion" rows="2" class="${FIELD_TEXTAREA}">${editing ? escapeHtml(curso!.descripcion ?? "") : ""}</textarea>
          </div>
          <div>
            <label for="curso-vigencia" class="${RH_LISTADO_LABEL}">Vigencia (meses)</label>
            <input id="curso-vigencia" name="vigencia_meses" type="number" min="1" max="600" value="${editing && curso!.vigencia_meses != null ? curso!.vigencia_meses : ""}" class="${FIELD_INPUT}" placeholder="Ej. 12 — dejar vacío si no vence" />
            <p class="mt-1 text-xs text-text-muted">Deja el campo vacío si el curso no requiere recertificación.</p>
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" data-action="close-modal" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">${editing ? "Guardar cambios" : "Guardar curso"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

export function mountCursosExternos(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: CursoExterno[] = [];
  let errorMessage: string | null = null;

  mountAppShell(container, {
    pageTitle: "Cursos externos",
    activeNav: "cursos-externos",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="curso-root">
      <div id="curso-inner">${renderLoading()}</div>
      <div id="curso-modal-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#curso-inner");
    if (!inner) return;
    if (status === "loading") inner.innerHTML = renderLoading();
    else if (status === "error") inner.innerHTML = renderError(errorMessage);
    else inner.innerHTML = renderReady(items);
  }

  async function load(): Promise<void> {
    status = "loading";
    paint();
    try {
      const res = await getCursosExternos({ page: 1, page_size: 200 });
      items = res.items;
      status = "ready";
    } catch (e) {
      status = "error";
      errorMessage = (e as ProveedorExternoFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  function openModal(curso: CursoExterno | null): void {
    const host = container.querySelector("#curso-modal-host");
    if (host) host.innerHTML = renderModal(curso);
  }
  function closeModal(): void {
    const host = container.querySelector("#curso-modal-host");
    if (host) host.innerHTML = "";
  }

  container.addEventListener(
    "click",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "curso-modal-backdrop") return closeModal();
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (!action) return;
      const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
      if (action === "retry") return void load();
      if (action === "add") return openModal(null);
      if (action === "close-modal") return closeModal();
      if (action === "edit" && !Number.isNaN(id)) {
        return openModal(items.find((c) => c.id === id) ?? null);
      }
      if (action === "delete" && !Number.isNaN(id)) return void handleDelete(id);
    },
    { signal },
  );

  async function handleDelete(id: number): Promise<void> {
    try {
      await deleteCursoExterno(id);
      await load();
    } catch {
      /* noop */
    }
  }

  container.addEventListener(
    "submit",
    async (e) => {
      if (signal.aborted) return;
      const form = (e.target as HTMLElement).closest<HTMLFormElement>("#curso-modal-form");
      if (!form) return;
      e.preventDefault();
      const fd = new FormData(form);
      const nombre = String(fd.get("nombre") ?? "").trim();
      const errorEl = form.querySelector("#curso-form-error") as HTMLElement | null;
      if (nombre.length < 2) {
        if (errorEl) {
          errorEl.textContent = "El nombre debe tener al menos 2 caracteres.";
          errorEl.classList.remove("hidden");
        }
        return;
      }
      const vigenciaRaw = String(fd.get("vigencia_meses") ?? "").trim();
      const vigencia_meses = vigenciaRaw === "" ? null : Number(vigenciaRaw);
      const payload = {
        nombre,
        descripcion: String(fd.get("descripcion") ?? "").trim() || null,
        vigencia_meses,
      };
      const editId = Number(form.dataset.id);
      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      try {
        if (!Number.isNaN(editId) && form.dataset.id) {
          await updateCursoExterno(editId, payload);
        } else {
          await createCursoExterno(payload);
        }
        closeModal();
        await load();
      } catch (err) {
        const detail = (err as ProveedorExternoFetchError)?.detail ?? "Error al guardar";
        if (errorEl) {
          errorEl.textContent = detail;
          errorEl.classList.remove("hidden");
        }
        if (submitBtn) submitBtn.disabled = false;
      }
    },
    { signal },
  );

  void load();
}
