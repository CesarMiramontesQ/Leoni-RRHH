import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { getAccessToken } from "../auth/session.ts";
import { BTN_GHOST, BTN_PRIMARY, FIELD_FOCUS } from "../ui/uiTokens.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountEditarTareasModal } from "../components/puestos/editarTareasModal.ts";
import { mountEditarCualificacionesModal } from "../components/puestos/editarCualificacionesModal.ts";
import { mountEditarCompetenciasModal } from "../components/puestos/editarCompetenciasModal.ts";
import { updatePerfil } from "../api/puestos.ts";

interface PuestoPerfilInfo {
  id: number;
  codigo: string;
  nombre: string;
  area_nombre: string;
  nivel: string;
  descripcion: string | null;
  version: number;
  activo: boolean;
}

interface Tarea {
  id: number;
  orden: number;
  descripcion: string;
  es_complemento: boolean;
}

interface Cualificacion {
  id: number;
  tipo: string;
  situacion_deseada: string;
  comentarios: string | null;
}

interface Competencia {
  id: number;
  competencia_id: number | null;
  competencia_nombre: string | null;
  categoria: string;
  descripcion: string;
  orden: number;
}

interface AsignacionResumen {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  activo: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  estudios_finalizados: "Estudios finalizados",
  formacion_profesional: "Formación profesional",
  ampliacion_formacion: "Ampliación de formación",
  estudios_universitarios: "Estudios universitarios",
  experiencia_profesional: "Experiencia profesional",
  experiencia_direccion: "Experiencia en dirección",
  complementos: "Complementos",
};

const CATEGORIA_LABELS: Record<string, string> = {
  informatica: "Informática",
  idiomas: "Idiomas",
  profesional: "Profesional",
  social: "Social",
  personal: "Personal",
  metodos: "Métodos",
  complementos: "Complementos",
};

const CATEGORIA_COLORS: Record<string, string> = {
  informatica: "bg-blue-50 text-blue-700",
  idiomas: "bg-violet-50 text-violet-700",
  profesional: "bg-emerald-50 text-emerald-700",
  social: "bg-amber-50 text-amber-700",
  personal: "bg-rose-50 text-rose-700",
  metodos: "bg-cyan-50 text-cyan-700",
  complementos: "bg-slate-100 text-slate-600",
};

function isRhUser(): boolean {
  return getRolFromAccessToken() === "rh";
}

function pencilBtn(action: string, label: string): string {
  if (!isRhUser()) return "";
  return `
    <button type="button" data-action="${action}" class="${BTN_GHOST} !px-2 !py-1.5 text-xs" title="${label}">
      <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;
}

function emptyState(message: string): string {
  return `
    <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50/40 py-6 text-center">
      <p class="text-sm text-slate-500">${message}</p>
    </div>`;
}

function renderHeader(puesto: PuestoPerfilInfo, empleadosCount: number): string {
  return `
  <div class="rounded-xl border border-border bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">${escapeHtml(puesto.codigo)}</span>
          ${puesto.activo
            ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800"><span class="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>Activo</span>`
            : `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600"><span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>Inactivo</span>`
          }
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">v${puesto.version}</span>
        </div>
        <h1 class="text-xl font-bold text-text-primary sm:text-2xl">${escapeHtml(puesto.nombre)}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 20V8l6 4V8l6 4V4h6v16z"/><path d="M9 17h2M14 17h2"/></svg>
            <b>${escapeHtml(puesto.area_nombre)}</b> · ${escapeHtml(puesto.nivel)}
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${empleadosCount} empleado${empleadosCount !== 1 ? "s" : ""} asignado${empleadosCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${isRhUser() ? `<button type="button" data-action="edit-base" class="${BTN_GHOST} text-sm">Editar</button>` : ""}
        <a href="#/puestos/${puesto.id}/empleados" class="${BTN_GHOST} text-sm">Ver empleados</a>
      </div>
    </div>
    ${puesto.descripcion ? `
    <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
      <span class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">DESCRIPCION DEL PUESTO</span>
      ${escapeHtml(puesto.descripcion)}
    </div>` : ""}
  </div>`;
}

function renderTareas(tareas: Tarea[]): string {
  if (tareas.length === 0) {
    return `
    <div class="rounded-xl border border-border bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-sm font-semibold text-text-primary">Tareas principales</h2>
        ${pencilBtn("edit-tareas", "Editar tareas")}
      </div>
      <div class="p-5">${emptyState("Sin tareas registradas")}</div>
    </div>`;
  }

  const principales = tareas.filter(t => !t.es_complemento);
  const complemento = tareas.filter(t => t.es_complemento);

  const renderList = (items: Tarea[]) => items.map(t => `
    <div class="flex items-start gap-3 py-2">
      <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 font-mono text-[10px] font-bold text-leoni-blue">${t.orden}</span>
      <span class="text-sm text-text-primary">${escapeHtml(t.descripcion)}</span>
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Tareas principales</h2>
        <p class="text-xs text-slate-500">${tareas.length} tarea${tareas.length !== 1 ? "s" : ""} definida${tareas.length !== 1 ? "s" : ""}</p>
      </div>
      <div class="flex items-center gap-2">
        ${pencilBtn("edit-tareas", "Editar tareas")}
        <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${tareas.length}</span>
      </div>
    </div>
    <div class="p-5">
      <div class="flex flex-col divide-y divide-slate-100">${renderList(principales)}</div>
      ${complemento.length > 0 ? `
        <div class="mt-4 border-t border-slate-200 pt-3">
          <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Complementarias</p>
          <div class="flex flex-col divide-y divide-slate-100">${renderList(complemento)}</div>
        </div>` : ""}
    </div>
  </div>`;
}

function renderCualificaciones(cualificaciones: Cualificacion[]): string {
  if (cualificaciones.length === 0) {
    return `
    <div class="rounded-xl border border-border bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-sm font-semibold text-text-primary">Cualificaciones requeridas</h2>
        ${pencilBtn("edit-cualificaciones", "Editar cualificaciones")}
      </div>
      <div class="p-5">${emptyState("Sin cualificaciones registradas")}</div>
    </div>`;
  }

  const grouped = new Map<string, Cualificacion[]>();
  for (const c of cualificaciones) {
    const list = grouped.get(c.tipo) ?? [];
    list.push(c);
    grouped.set(c.tipo, list);
  }

  const sections = Array.from(grouped.entries()).map(([tipo, items]) => `
    <div class="mb-4 last:mb-0">
      <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">${TIPO_LABELS[tipo] ?? tipo}</p>
      ${items.map(c => `
        <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 mb-2 last:mb-0">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text-primary">${escapeHtml(c.situacion_deseada)}</p>
            ${c.comentarios ? `<p class="mt-0.5 text-xs text-slate-500">${escapeHtml(c.comentarios)}</p>` : ""}
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Cualificaciones requeridas</h2>
        <p class="text-xs text-slate-500">Por tipo: estudios, experiencia, formacion</p>
      </div>
      <div class="flex items-center gap-2">
        ${pencilBtn("edit-cualificaciones", "Editar cualificaciones")}
        <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${cualificaciones.length}</span>
      </div>
    </div>
    <div class="p-5">${sections}</div>
  </div>`;
}

function renderCompetencias(competencias: Competencia[]): string {
  if (competencias.length === 0) {
    return `
    <div class="rounded-xl border border-border bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-sm font-semibold text-text-primary">Competencias requeridas</h2>
        ${pencilBtn("edit-competencias", "Editar competencias")}
      </div>
      <div class="p-5">${emptyState("Sin competencias registradas")}</div>
    </div>`;
  }

  const grouped = new Map<string, Competencia[]>();
  for (const c of competencias) {
    const list = grouped.get(c.categoria) ?? [];
    list.push(c);
    grouped.set(c.categoria, list);
  }

  const sections = Array.from(grouped.entries()).map(([cat, items]) => {
    const colorClass = CATEGORIA_COLORS[cat] ?? "bg-slate-100 text-slate-600";
    return `
      <div class="mb-4 last:mb-0">
        <div class="mb-2 flex items-center gap-2">
          <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colorClass}">${CATEGORIA_LABELS[cat] ?? cat}</span>
          <span class="text-[10px] text-slate-400">${items.length} competencia${items.length !== 1 ? "s" : ""}</span>
        </div>
        ${items.map(c => `
          <div class="flex items-center gap-2 py-1.5">
            <span class="text-sm text-text-primary">${escapeHtml(c.competencia_nombre ?? c.descripcion)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Competencias requeridas</h2>
        <p class="text-xs text-slate-500">Por categoria: informatica, idiomas, profesional, etc.</p>
      </div>
      <div class="flex items-center gap-2">
        ${pencilBtn("edit-competencias", "Editar competencias")}
        <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${competencias.length}</span>
      </div>
    </div>
    <div class="p-5">${sections}</div>
  </div>`;
}

function renderEmpleadosResumen(asignaciones: AsignacionResumen[], perfilId: number): string {
  if (asignaciones.length === 0) {
    return `
    <div class="rounded-xl border border-border bg-white shadow-sm">
      <div class="border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-sm font-semibold text-text-primary">Empleados asignados</h2>
      </div>
      <div class="p-5">${emptyState("Sin empleados asignados a este perfil")}</div>
    </div>`;
  }

  const rows = asignaciones.slice(0, 5).map(a => `
    <div class="flex items-center justify-between py-1.5">
      <span class="text-sm text-text-primary">${a.nombre_empleado ? escapeHtml(a.nombre_empleado) : `Empleado #${a.empleado_id}`}</span>
      ${a.no_empleado ? `<span class="text-xs text-slate-400 tabular-nums">${escapeHtml(a.no_empleado)}</span>` : ""}
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Empleados asignados</h2>
        <p class="text-xs text-slate-500">${asignaciones.length} empleado${asignaciones.length !== 1 ? "s" : ""}</p>
      </div>
      <a href="#/puestos/${perfilId}/empleados" class="text-xs font-semibold text-leoni-blue hover:underline">Ver todos</a>
    </div>
    <div class="divide-y divide-slate-100 px-5">${rows}</div>
    ${asignaciones.length > 5 ? `<div class="border-t border-slate-100 px-5 py-2 text-center"><a href="#/puestos/${perfilId}/empleados" class="text-xs text-leoni-blue hover:underline">+${asignaciones.length - 5} mas</a></div>` : ""}
  </div>`;
}

export function mountPerfilPuestoDetalle(container: HTMLElement, id: number): void {
  mountAppShell(container, {
    pageTitle: "Detalle del Puesto",
    activeNav: "puestos",
    mainHtml: `
      <div id="perfil-detalle-root" class="flex min-h-0 flex-1 flex-col gap-4 py-5 sm:gap-5 sm:py-6">
        <nav class="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <a href="#/puestos" class="hover:text-leoni-blue transition">Perfiles de Puesto</a>
          <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          <span class="font-medium text-text-primary" id="breadcrumb-label">Cargando...</span>
        </nav>
        <div id="perfil-detalle-content">
          <p class="text-sm text-text-muted">Cargando perfil...</p>
        </div>
      </div>`,
  });

  loadPerfilDetalle(container, id);
}

async function fetchJson<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function loadPerfilDetalle(container: HTMLElement, perfilId: number): Promise<void> {
  const contentEl = container.querySelector("#perfil-detalle-content");
  const breadcrumbEl = container.querySelector("#breadcrumb-label");
  if (!contentEl) return;

  const token = getAccessToken();
  if (!token) {
    contentEl.innerHTML = `<p class="text-sm text-red-600">No autenticado</p>`;
    return;
  }

  try {
    const [puesto, tareas, cualificaciones, competencias, asignaciones] = await Promise.all([
      fetchJson<PuestoPerfilInfo>(`/api/v1/puestos-perfil/${perfilId}`, token),
      fetchJson<Tarea[]>(`/api/v1/perfiles/${perfilId}/tareas`, token),
      fetchJson<Cualificacion[]>(`/api/v1/perfiles/${perfilId}/cualificaciones`, token),
      fetchJson<Competencia[]>(`/api/v1/perfiles/${perfilId}/competencias`, token),
      fetchJson<AsignacionResumen[]>(`/api/v1/perfiles/${perfilId}/asignaciones`, token),
    ]);

    if (!puesto) {
      contentEl.innerHTML = `<p class="text-sm text-red-600">Perfil no encontrado (ID: ${perfilId})</p>`;
      return;
    }

    if (breadcrumbEl) {
      breadcrumbEl.textContent = `${puesto.codigo} · ${puesto.nombre}`;
    }

    const empleadosCount = asignaciones?.length ?? 0;

    contentEl.innerHTML = `
      ${renderHeader(puesto, empleadosCount)}

      <div class="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div class="flex flex-col gap-4">
          ${renderTareas(tareas ?? [])}
          ${renderCualificaciones(cualificaciones ?? [])}
        </div>
        <div class="flex flex-col gap-4">
          ${renderCompetencias(competencias ?? [])}
          ${renderEmpleadosResumen(asignaciones ?? [], perfilId)}
        </div>
      </div>
      <div id="modal-host-tareas"></div>
      <div id="modal-host-cualificaciones"></div>
      <div id="modal-host-competencias"></div>
      <div id="modal-host-edit-base"></div>`;

    // ── Wire up modals (RH only) ──────────────────────────────────────
    if (isRhUser()) {
      const reload = () => loadPerfilDetalle(container, perfilId);

      // Tareas modal
      const tareasHost = contentEl.querySelector("#modal-host-tareas") as HTMLElement;
      const tareasModal = mountEditarTareasModal(tareasHost, { perfilId, onSuccess: reload });

      // Cualificaciones modal
      const cualHost = contentEl.querySelector("#modal-host-cualificaciones") as HTMLElement;
      const cualModal = mountEditarCualificacionesModal(cualHost, { perfilId, onSuccess: reload });

      // Competencias modal
      const compHost = contentEl.querySelector("#modal-host-competencias") as HTMLElement;
      const compModal = mountEditarCompetenciasModal(compHost, { perfilId, onSuccess: reload });

      // Event delegation for edit buttons
      contentEl.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;
        switch (action) {
          case "edit-tareas":
            tareasModal.open();
            break;
          case "edit-cualificaciones":
            cualModal.open();
            break;
          case "edit-competencias":
            compModal.open();
            break;
          case "edit-base":
            openEditBaseModal(contentEl.querySelector("#modal-host-edit-base") as HTMLElement, puesto, perfilId, reload);
            break;
        }
      });
    }
  } catch {
    contentEl.innerHTML = `<p class="text-sm text-red-600">Error de conexion al cargar el perfil</p>`;
  }
}

// ── Edit base fields modal (inline, simple) ──────────────────────────────────

function openEditBaseModal(
  host: HTMLElement,
  puesto: PuestoPerfilInfo,
  perfilId: number,
  onSuccess: () => void,
): void {
  const overlayId = "edit-base-overlay";

  host.innerHTML = `
    <div
      id="${overlayId}"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-base-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="edit-base-title" class="text-lg font-semibold text-text-primary">Editar perfil</h2>
          <button
            type="button"
            id="edit-base-close"
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <p id="edit-base-error" class="mb-3 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
        <form id="form-edit-base" class="space-y-4">
          <div>
            <label for="eb-nombre" class="mb-1 block text-xs font-medium text-slate-600">Nombre del puesto</label>
            <input id="eb-nombre" name="nombre_puesto" type="text" required
              value="${escapeHtml(puesto.nombre)}"
              class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}" />
          </div>
          <div>
            <label for="eb-nivel" class="mb-1 block text-xs font-medium text-slate-600">Nivel</label>
            <input id="eb-nivel" name="nivel" type="text"
              value="${escapeHtml(puesto.nivel)}"
              class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}" />
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button type="button" id="edit-base-cancel"
              class="${BTN_GHOST} text-sm">Cancelar</button>
            <button type="submit" id="edit-base-submit"
              class="${BTN_PRIMARY} text-sm">Guardar</button>
          </div>
        </form>
      </div>
    </div>`;

  const overlay = host.querySelector(`#${overlayId}`) as HTMLElement;
  const form = host.querySelector("#form-edit-base") as HTMLFormElement;
  const errorEl = host.querySelector("#edit-base-error") as HTMLElement;

  function close() {
    host.innerHTML = "";
    document.body.style.overflow = "";
  }

  document.body.style.overflow = "hidden";

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.querySelector("#edit-base-close")!.addEventListener("click", close);
  host.querySelector("#edit-base-cancel")!.addEventListener("click", close);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); document.removeEventListener("keydown", escHandler); }
  };
  document.addEventListener("keydown", escHandler);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const nombre_puesto = String(fd.get("nombre_puesto") ?? "").trim();
    const nivel = String(fd.get("nivel") ?? "").trim();

    if (!nombre_puesto) {
      errorEl.textContent = "El nombre es requerido.";
      errorEl.classList.remove("hidden");
      return;
    }

    const submitBtn = host.querySelector("#edit-base-submit") as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";

    try {
      await updatePerfil(perfilId, { nombre_puesto, nivel: nivel || undefined });
      close();
      document.removeEventListener("keydown", escHandler);
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail ?? "Error al guardar.";
      errorEl.textContent = detail;
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  });
}
