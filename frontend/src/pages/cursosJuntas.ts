import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  createJunta,
  getJunta,
  getJuntas,
  type Junta,
  type JuntaDetalle,
  type JuntaFetchError,
} from "../api/juntas.ts";
import {
  mountEmpleadoMultiSelect,
  type EmpleadoMultiSelectController,
} from "../components/empleados/empleadoMultiSelect.ts";
import { escapeHtml, fmtFechaLargaEsMx } from "../ui/uiUtils.ts";
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

// ── Render: estados ─────────────────────────────────────────────────────────

function renderLoading(): string {
  return `<div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center text-sm text-text-muted">Cargando juntas…</div>`;
}

function renderError(msg: string | null): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">No se pudieron cargar las juntas</p>
    <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(msg ?? "Error desconocido")}</p>
    <button type="button" data-action="retry" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Reintentar</button>
  </div>`;
}

function renderEmpty(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-14 text-center">
    <p class="text-base font-semibold text-text-primary">Aún no hay juntas registradas</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Registra la primera junta para dejar constancia del motivo, la categoría y los asistentes.
    </p>
    <button type="button" data-action="add-junta" class="${RH_LISTADO_BTN_PRIMARY} mx-auto mt-6 inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Nueva junta</span>
    </button>
  </div>`;
}

function renderNoResults(): string {
  return `
  <div class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
    <p class="text-sm font-semibold text-text-primary">Sin resultados</p>
    <p class="mt-1.5 text-xs text-text-muted">Ninguna junta coincide con la búsqueda.</p>
    <button type="button" data-action="clear-search" class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Limpiar búsqueda</button>
  </div>`;
}

// ── Render: tabla ───────────────────────────────────────────────────────────

function categoriaBadge(categoria: string | null): string {
  if (!categoria) return '<span class="text-xs text-text-muted">—</span>';
  return `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-xs font-medium text-blue-900">${escapeHtml(categoria)}</span>`;
}

function renderRow(j: Junta): string {
  const nombre = escapeHtml(j.nombre);
  const motivo = j.motivo ? escapeHtml(j.motivo) : "—";
  return `
    <tr class="hover:bg-slate-50/70">
      <td class="px-4 py-3.5 align-middle">
        <button type="button" data-action="view-junta" data-id="${j.id}" class="max-w-xs truncate text-left text-sm font-semibold text-accent hover:underline" title="${nombre}">${nombre}</button>
      </td>
      <td class="px-4 py-3.5 align-middle">${categoriaBadge(j.categoria)}</td>
      <td class="px-4 py-3.5 align-middle"><p class="max-w-sm truncate text-sm text-text-secondary" title="${escapeHtml(j.motivo ?? "")}">${motivo}</p></td>
      <td class="px-4 py-3.5 align-middle text-center text-sm tabular-nums text-text-primary">${j.asistentes_count}</td>
      <td class="whitespace-nowrap px-4 py-3.5 align-middle text-sm text-text-secondary">${escapeHtml(fmtFechaLargaEsMx(j.created_at))}</td>
      <td class="whitespace-nowrap px-3 py-3.5 align-middle text-right">
        <button type="button" data-action="view-junta" data-id="${j.id}" class="${RH_LISTADO_BTN_SECONDARY} !px-3 !py-1.5 text-xs">Ver</button>
      </td>
    </tr>`;
}

function renderTable(items: Junta[]): string {
  return `
  <section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Listado de juntas">
    <div class="overflow-x-auto">
      <table class="min-w-[720px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Nombre</th>
            <th scope="col" class="px-4 py-3.5 text-left">Categoría</th>
            <th scope="col" class="px-4 py-3.5 text-left">Motivo</th>
            <th scope="col" class="px-4 py-3.5 text-center">Asistentes</th>
            <th scope="col" class="px-4 py-3.5 text-left">Fecha de creación</th>
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
    <button type="button" data-action="add-junta" class="${RH_LISTADO_BTN_PRIMARY} inline-flex items-center gap-2">
      ${ICON_PLUS}<span>Nueva junta</span>
    </button>`;
  return pageHeading(
    "Juntas",
    "Registra las juntas realizadas y administra su información básica y sus asistentes.",
    actions,
  );
}

function renderSearch(filters: Filters): string {
  return `
  <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Búsqueda de juntas">
    <label for="juntas-search" class="${RH_LISTADO_LABEL}">Buscar junta</label>
    <input type="search" id="juntas-search" autocomplete="off" placeholder="Nombre de la junta…"
      value="${escapeHtml(filters.text)}" class="${FIELD_INPUT}" />
  </section>`;
}

function renderReady(items: Junta[], filters: Filters): string {
  const q = filters.text.trim().toLowerCase();
  const filtered = q
    ? items.filter((j) => j.nombre.toLowerCase().includes(q))
    : items;

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

// ── Render: modales ─────────────────────────────────────────────────────────

function renderCreateModal(): string {
  return `
    <div id="junta-modal-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="junta-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="junta-modal-title" class="text-lg font-semibold text-text-primary">Nueva junta</h3>
          <p class="mt-1 text-sm text-text-muted">Registra la junta y agrega a los empleados asistentes.</p>
        </div>
        <form id="junta-modal-form" class="flex flex-col gap-4 px-6 py-5">
          <div id="junta-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert"></div>
          <div>
            <label for="junta-nombre" class="${RH_LISTADO_LABEL}">Nombre de la junta <span class="text-red-600" aria-hidden="true">*</span></label>
            <input id="junta-nombre" name="nombre" type="text" required class="${FIELD_INPUT}" placeholder="Ej. Junta de seguridad mensual" />
          </div>
          <div>
            <label for="junta-motivo" class="${RH_LISTADO_LABEL}">Motivo</label>
            <textarea id="junta-motivo" name="motivo" rows="2" class="${FIELD_TEXTAREA}" placeholder="Describe el motivo de la junta"></textarea>
          </div>
          <div>
            <label for="junta-categoria" class="${RH_LISTADO_LABEL}">Categoría</label>
            <input id="junta-categoria" name="categoria" type="text" class="${FIELD_INPUT}" placeholder="Ej. Seguridad, Calidad, RH…" />
          </div>
          <div class="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p class="mb-2 text-sm font-medium text-text-primary">Asistentes</p>
            <div id="junta-asistentes-host"></div>
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" data-action="close-modal" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}">Guardar junta</button>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDetailModal(junta: JuntaDetalle): string {
  const asistentes =
    junta.asistentes.length === 0
      ? '<p class="text-sm text-text-muted">Sin asistentes registrados.</p>'
      : `<ul class="divide-y divide-slate-100 rounded-lg border border-border">${junta.asistentes
          .map(
            (a) => `
        <li class="flex items-center justify-between gap-3 px-3 py-2">
          <span class="min-w-0">
            <span class="block truncate text-sm text-text-primary">${escapeHtml(a.nombre ?? "—")}</span>
            ${
              a.puesto || a.area
                ? `<span class="block truncate text-xs text-text-muted">${escapeHtml([a.puesto, a.area].filter(Boolean).join(" · "))}</span>`
                : ""
            }
          </span>
          <span class="shrink-0 text-xs font-medium tabular-nums text-text-muted">${a.no_empleado ?? ""}</span>
        </li>`,
          )
          .join("")}</ul>`;

  return `
    <div id="junta-detail-backdrop" class="${MODAL_OVERLAY}" role="presentation">
      <div class="${MODAL_PANEL} max-w-xl" role="dialog" aria-modal="true" aria-labelledby="junta-detail-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h3 id="junta-detail-title" class="text-lg font-semibold text-text-primary">${escapeHtml(junta.nombre)}</h3>
          <p class="mt-1 text-xs text-text-muted">Registrada el ${escapeHtml(fmtFechaLargaEsMx(junta.created_at))}</p>
        </div>
        <div class="flex flex-col gap-4 px-6 py-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="${RH_LISTADO_LABEL}">Categoría</p>
              <p class="text-sm text-text-primary">${junta.categoria ? escapeHtml(junta.categoria) : "—"}</p>
            </div>
            <div>
              <p class="${RH_LISTADO_LABEL}">Asistentes</p>
              <p class="text-sm text-text-primary">${junta.asistentes.length}</p>
            </div>
          </div>
          <div>
            <p class="${RH_LISTADO_LABEL}">Motivo</p>
            <p class="whitespace-pre-line text-sm text-text-secondary">${junta.motivo ? escapeHtml(junta.motivo) : "—"}</p>
          </div>
          <div>
            <p class="${RH_LISTADO_LABEL}">Lista de asistentes</p>
            ${asistentes}
          </div>
          <div class="flex justify-end border-t border-slate-100 pt-4">
            <button type="button" data-action="close-detail" class="${RH_LISTADO_BTN_SECONDARY}">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Montaje de la página ────────────────────────────────────────────────────

export function mountCursosJuntas(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: Junta[] = [];
  const filters: Filters = { text: "" };
  let errorMessage: string | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let asistentesCtrl: EmpleadoMultiSelectController | null = null;

  mountAppShell(container, {
    pageTitle: "Juntas",
    activeNav: "cursos-juntas",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="juntas-root">
      <div id="juntas-inner">${renderLoading()}</div>
      <div id="junta-modal-host"></div>
      <div id="junta-detail-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#juntas-inner");
    if (!inner) return;
    if (status === "loading") inner.innerHTML = renderLoading();
    else if (status === "error") inner.innerHTML = renderError(errorMessage);
    else inner.innerHTML = renderReady(items, filters);
  }

  async function loadJuntas(): Promise<void> {
    status = "loading";
    paint();
    try {
      const res = await getJuntas({ page: 1, page_size: 100 });
      items = res.items;
      status = "ready";
    } catch (e) {
      status = "error";
      errorMessage = (e as JuntaFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  function openCreateModal(): void {
    const host = container.querySelector("#junta-modal-host");
    if (!host) return;
    host.innerHTML = renderCreateModal();
    const emsHost = container.querySelector<HTMLElement>("#junta-asistentes-host");
    if (emsHost) {
      asistentesCtrl = mountEmpleadoMultiSelect(emsHost, { label: "Buscar empleados a agregar" });
    }
  }

  function closeCreateModal(): void {
    asistentesCtrl?.destroy();
    asistentesCtrl = null;
    const host = container.querySelector("#junta-modal-host");
    if (host) host.innerHTML = "";
  }

  async function openDetailModal(id: number): Promise<void> {
    const host = container.querySelector("#junta-detail-host");
    if (!host) return;
    try {
      const junta = await getJunta(id);
      host.innerHTML = renderDetailModal(junta);
    } catch {
      host.innerHTML = "";
    }
  }

  function closeDetailModal(): void {
    const host = container.querySelector("#junta-detail-host");
    if (host) host.innerHTML = "";
  }

  container.addEventListener(
    "click",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;

      // Backdrops (clic fuera del panel).
      if (target.id === "junta-modal-backdrop") {
        closeCreateModal();
        return;
      }
      if (target.id === "junta-detail-backdrop") {
        closeDetailModal();
        return;
      }

      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "retry") {
        void loadJuntas();
        return;
      }
      if (action === "clear-search") {
        filters.text = "";
        paint();
        return;
      }
      if (action === "add-junta") {
        openCreateModal();
        return;
      }
      if (action === "close-modal") {
        closeCreateModal();
        return;
      }
      if (action === "close-detail") {
        closeDetailModal();
        return;
      }
      if (action === "view-junta") {
        const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
        if (!Number.isNaN(id)) void openDetailModal(id);
      }
    },
    { signal },
  );

  container.addEventListener(
    "input",
    (e) => {
      if (signal.aborted) return;
      const target = e.target as HTMLElement;
      if (target.id === "juntas-search") {
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
      const form = (e.target as HTMLElement).closest("#junta-modal-form");
      if (!form) return;
      e.preventDefault();

      const fd = new FormData(form as HTMLFormElement);
      const nombre = String(fd.get("nombre") ?? "").trim();
      const motivo = String(fd.get("motivo") ?? "").trim() || null;
      const categoria = String(fd.get("categoria") ?? "").trim() || null;
      const errorEl = (form as HTMLElement).querySelector("#junta-form-error") as HTMLElement | null;

      if (nombre.length < 3) {
        if (errorEl) {
          errorEl.textContent = "El nombre de la junta debe tener al menos 3 caracteres.";
          errorEl.classList.remove("hidden");
        }
        return;
      }

      const asistente_ids = (asistentesCtrl?.getSelected() ?? []).map((s) => s.empleado_id);

      const submitBtn = (form as HTMLElement).querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando…";
      }

      try {
        await createJunta({ nombre, motivo, categoria, asistente_ids });
        closeCreateModal();
        await loadJuntas();
      } catch (err) {
        const detail = (err as JuntaFetchError)?.detail ?? "Error al guardar la junta";
        if (errorEl) {
          errorEl.textContent = detail;
          errorEl.classList.remove("hidden");
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Guardar junta";
        }
      }
    },
    { signal },
  );

  void loadJuntas();
}
