import { canAccessOrganigramaPage } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import {
  getOrganigrama,
  type OrganigramaFetchError,
  type OrganigramaNodo,
  type OrganigramaResponse,
} from "../api/organigrama.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../utils/nombreEmpleadoDisplay.ts";

type OrganigramaPageState = {
  loading: boolean;
  error: string | null;
  data: OrganigramaResponse | null;
  selectedNodeId: number | null;
  search: string;
  department: string;
  maxDepth: number | "all";
  zoom: number;
  collapsedByNodeId: Set<number>;
  depthOptions: number[];
  departmentOptions: string[];
};

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;
const SIBLINGS_PREVIEW_LIMIT = 3;

function isUnauthorized(error: unknown): boolean {
  return typeof error === "object" && error != null && "status" in error && (error as { status?: unknown }).status === 401;
}

function isForbidden(error: unknown): boolean {
  return typeof error === "object" && error != null && "status" in error && (error as { status?: unknown }).status === 403;
}

async function handleSessionExpired(container: HTMLElement): Promise<void> {
  clearAuth();
  const shellRouter = await import("../shellRouter.ts");
  shellRouter.abortAuthenticatedShell();
  const loginPage = await import("./login.ts");
  loginPage.mountLogin(container);
}

function fallback(text: string | null | undefined, defaultValue: string): string {
  const normalized = text?.trim();
  return normalized ? normalized : defaultValue;
}

function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function nombreDisplay(nodo: OrganigramaNodo): string {
  return formatNombreEmpleadoUi(nodo.nombre_colaborador, { titulo: true }) || fallback(nodo.nombre_colaborador, "Sin nombre");
}

function flattenNodes(nodes: OrganigramaNodo[]): OrganigramaNodo[] {
  const out: OrganigramaNodo[] = [];
  const walk = (items: OrganigramaNodo[]): void => {
    for (const item of items) {
      out.push(item);
      if (item.children.length > 0) walk(item.children);
    }
  };
  walk(nodes);
  return out;
}

function collectDepth(nodes: OrganigramaNodo[]): number {
  let max = 0;
  const walk = (items: OrganigramaNodo[]): void => {
    for (const node of items) {
      max = Math.max(max, node.nivel_jerarquico);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return max;
}

function filteredTree(nodes: OrganigramaNodo[], state: OrganigramaPageState): OrganigramaNodo[] {
  const needle = normalizeText(state.search);
  const hasNeedle = needle.length > 0;
  const deptNeedle = normalizeText(state.department);
  const maxDepth = state.maxDepth;

  const walk = (node: OrganigramaNodo): OrganigramaNodo | null => {
    if (maxDepth !== "all" && node.nivel_jerarquico > maxDepth) return null;
    const childMatches = node.children
      .map((child) => walk(child))
      .filter((child): child is OrganigramaNodo => child != null);
    const ownText = normalizeText(`${node.nombre_colaborador} ${node.no_empleado}`);
    const matchText = hasNeedle ? ownText.includes(needle) : true;
    const matchDept = deptNeedle ? normalizeText(node.departamento ?? "").includes(deptNeedle) : true;
    if (matchText && matchDept) return { ...node, children: childMatches };
    if (childMatches.length > 0) return { ...node, children: childMatches };
    return null;
  };

  return nodes.map((node) => walk(node)).filter((node): node is OrganigramaNodo => node != null);
}

function findNode(nodes: OrganigramaNodo[], nodeId: number | null): OrganigramaNodo | null {
  if (nodeId == null) return null;
  const all = flattenNodes(nodes);
  return all.find((node) => node.id === nodeId) ?? null;
}

function nivelPillClass(level: OrganigramaNodo["nivel_visual"]): string {
  if (level === "direccion") return "bg-blue-600 text-white";
  if (level === "gerencia") return "bg-violet-500 text-white";
  if (level === "jefaturas") return "bg-emerald-600 text-white";
  return "bg-slate-400 text-white";
}

function nivelLabel(level: OrganigramaNodo["nivel_visual"]): string {
  if (level === "direccion") return "Dirección";
  if (level === "gerencia") return "Gerencia";
  if (level === "jefaturas") return "Jefaturas";
  return "Operación";
}

function nivelPlural(level: OrganigramaNodo["nivel_visual"]): string {
  if (level === "direccion") return "direcciones";
  if (level === "gerencia") return "gerencias";
  if (level === "jefaturas") return "jefaturas";
  return "operaciones";
}

function avatarHtml(nodo: OrganigramaNodo, sizeClass = "size-11"): string {
  const foto = nodo.foto_url?.trim();
  if (foto) {
    return `<img src="${escapeHtml(foto)}" alt="Avatar de ${escapeHtml(nombreDisplay(nodo))}" class="${sizeClass} shrink-0 rounded-full border-2 border-white object-cover shadow-sm" />`;
  }
  const ini = inicialesDesdeNombreDisplay(nombreDisplay(nodo));
  return `<span class="${sizeClass} shrink-0 rounded-full bg-leoni-blue-light text-xs font-semibold text-white grid place-items-center">${escapeHtml(ini)}</span>`;
}

function estadoBadge(nodo: OrganigramaNodo): string {
  const estado = fallback(nodo.estado_empleado, nodo.activo ? "Activo" : "Inactivo");
  const cls = nodo.activo
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${cls}">${escapeHtml(estado.toUpperCase())}</span>`;
}

function nodeCardHtml(node: OrganigramaNodo, selectedId: number | null): string {
  const isSelected = selectedId === node.id;
  const selectedCls = isSelected
    ? "ring-2 ring-leoni-blue/40 border-leoni-blue/30 shadow-md"
    : "ring-1 ring-slate-900/5 border-slate-200";
  const title = fallback(node.nombre_puesto, "Puesto sin asignar");
  return `<button
      type="button"
      data-org-node-id="${node.id}"
      class="group w-[230px] rounded-2xl border bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedCls}"
    >
      <div class="flex items-center gap-2.5">
        ${avatarHtml(node, "size-10")}
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-semibold text-slate-900">${escapeHtml(nombreDisplay(node))}</p>
          <p class="truncate text-[11px] font-semibold uppercase tracking-wide text-leoni-blue">${escapeHtml(title)}</p>
          <p class="mt-0.5 text-[11px] text-slate-400">ID: ${escapeHtml(node.no_empleado)}</p>
        </div>
      </div>
      <div class="mt-2.5 flex items-center justify-between">
        <span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${nivelPillClass(node.nivel_visual)}">${escapeHtml(nivelLabel(node.nivel_visual))}</span>
        <span class="text-[11px] text-slate-500">${escapeHtml(String(node.reportes_directos))} reportes</span>
      </div>
    </button>`;
}

function hiddenChildrenButton(node: OrganigramaNodo, hiddenCount: number): string {
  const label = hiddenCount === 1 ? nivelLabel(node.nivel_visual).toLowerCase() : nivelPlural(node.nivel_visual);
  return `<li class="org-node-item">
    <button
      type="button"
      data-org-expand-node-id="${node.id}"
      class="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
    >
      <span class="grid size-5 place-items-center rounded-full bg-slate-100 text-sm font-bold">+</span>
      ${escapeHtml(String(hiddenCount))} ${escapeHtml(label)} más
    </button>
  </li>`;
}

function treeHtml(nodes: OrganigramaNodo[], state: OrganigramaPageState): string {
  const renderList = (items: OrganigramaNodo[], isRoot = false): string => {
    if (items.length === 0) return "";
    const listClass = isRoot ? "org-tree org-tree-root" : "org-tree";
    return `<ul class="${listClass}">
      ${items.map((node) => renderNode(node)).join("")}
    </ul>`;
  };

  const renderNode = (node: OrganigramaNodo): string => {
    const expanded = state.collapsedByNodeId.has(node.id);
    const hasCollapse = node.children.length > SIBLINGS_PREVIEW_LIMIT;
    const visibleChildren = hasCollapse && !expanded ? node.children.slice(0, SIBLINGS_PREVIEW_LIMIT) : node.children;
    const hidden = hasCollapse && !expanded ? node.children.length - visibleChildren.length : 0;
    const childrenHtml =
      visibleChildren.length > 0 || hidden > 0
        ? `<div class="org-node-children">${renderList(visibleChildren)}${hidden > 0 ? `<ul class="org-tree">${hiddenChildrenButton(node, hidden)}</ul>` : ""}</div>`
        : "";
    return `<li class="org-node-item">
      ${nodeCardHtml(node, state.selectedNodeId)}
      ${childrenHtml}
    </li>`;
  };

  return renderList(nodes, true);
}

function toolbarHtml(state: OrganigramaPageState): string {
  const depthOptions = [
    `<option value="all" ${state.maxDepth === "all" ? "selected" : ""}>Todos</option>`,
    ...state.depthOptions.map((depth) => {
      const selected = state.maxDepth === depth ? "selected" : "";
      return `<option value="${depth}" ${selected}>Hasta nivel ${depth}</option>`;
    }),
  ].join("");

  const deptOptions = [
    `<option value="" ${state.department === "" ? "selected" : ""}>Todos los departamentos</option>`,
    ...state.departmentOptions.map((dept) => {
      const selected = state.department === dept ? "selected" : "";
      return `<option value="${escapeHtml(dept)}" ${selected}>${escapeHtml(dept)}</option>`;
    }),
  ].join("");

  return `<section class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_210px_auto]">
      <label class="relative block">
        <span class="sr-only">Buscar por nombre o número</span>
        <input
          id="org-search"
          type="text"
          autocomplete="off"
          value="${escapeHtml(state.search)}"
          placeholder="Nombre o No. de empleado"
          class="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
        />
        <svg class="pointer-events-none absolute left-3 top-2.5 size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 21-4.35-4.35m1.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </label>
      <select id="org-depth" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20">
        ${depthOptions}
      </select>
      <select id="org-department" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20">
        ${deptOptions}
      </select>
      <div class="flex items-center justify-start gap-2 xl:justify-end">
        <button type="button" data-org-action="zoom-out" class="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Alejar zoom">−</button>
        <button type="button" data-org-action="zoom-in" class="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Acercar zoom">+</button>
        <button type="button" data-org-action="zoom-reset" class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
        <button type="button" data-org-action="export-pdf" class="inline-flex items-center gap-2 rounded-full bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow hover:bg-leoni-blue-light">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V8m0 8 3-3m-3 3-3-3M4.5 18.75h15" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Exportar PDF
        </button>
      </div>
    </div>
  </section>`;
}

function detailPanelHtml(selected: OrganigramaNodo | null): string {
  if (!selected) {
    return `<aside class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p class="text-sm text-slate-500">Selecciona un colaborador en el organigrama para ver su detalle.</p>
    </aside>`;
  }
  const puesto = fallback(selected.nombre_puesto, "Puesto sin asignar");
  const depto = fallback(selected.departamento, "Departamento sin asignar");
  const correo = fallback(selected.correo, "Sin correo");
  const ext = fallback(selected.extension_telefono, "Sin extensión");

  return `<aside class="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg xl:sticky xl:top-20">
    <div class="mb-4 flex items-start justify-between gap-3">
      ${estadoBadge(selected)}
      <button type="button" data-org-action="close-panel" class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar panel">
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="text-center">
      <div class="mx-auto mb-3 flex justify-center">${avatarHtml(selected, "size-20")}</div>
      <p class="text-2xl font-extrabold text-slate-900">${escapeHtml(nombreDisplay(selected))}</p>
      <p class="text-sm font-bold uppercase tracking-wide text-leoni-blue">${escapeHtml(puesto)}</p>
      <p class="text-sm text-slate-400">Departamento: ${escapeHtml(depto)}</p>
    </div>
    <dl class="mt-5 space-y-3 text-sm">
      <div class="rounded-2xl bg-slate-50 px-3 py-2">
        <dt class="text-xs font-semibold text-slate-400">Correo</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(correo)}</dd>
      </div>
      <div class="rounded-2xl bg-slate-50 px-3 py-2">
        <dt class="text-xs font-semibold text-slate-400">Extensión / Teléfono</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(ext)}</dd>
      </div>
      <div class="rounded-2xl bg-slate-50 px-3 py-2">
        <dt class="text-xs font-semibold text-slate-400">Reportes directos</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(String(selected.reportes_directos))} empleados</dd>
      </div>
      <div class="rounded-2xl bg-slate-50 px-3 py-2">
        <dt class="text-xs font-semibold text-slate-400">No. empleado</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(selected.no_empleado)}</dd>
      </div>
    </dl>
    <a href="#/empleados/${selected.id}" class="mt-5 inline-flex w-full items-center justify-center rounded-full border-2 border-leoni-blue bg-white px-4 py-2 text-sm font-semibold text-leoni-blue hover:bg-leoni-blue/5">Ver Perfil Completo</a>
  </aside>`;
}

function legendHtml(): string {
  const item = (text: string, color: string): string =>
    `<span class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80"><span class="size-2.5 rounded-full ${color}"></span>${escapeHtml(text)}</span>`;
  return `<section class="flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
    ${item("Dirección", "bg-blue-600")}
    ${item("Gerencia", "bg-violet-500")}
    ${item("Jefaturas", "bg-emerald-600")}
    ${item("Operación", "bg-slate-400")}
  </section>`;
}

function organigramaStyles(): string {
  return `<style>
    .org-chart-page .org-tree { display: flex; justify-content: center; padding-top: 1rem; position: relative; }
    .org-chart-page .org-tree-root { padding-top: 0; }
    .org-chart-page .org-tree,
    .org-chart-page .org-tree ul { margin: 0; padding-left: 0; list-style: none; }
    .org-chart-page .org-tree .org-node-item { text-align: center; position: relative; padding: 1rem .5rem 0 .5rem; }
    .org-chart-page .org-tree .org-node-item::before,
    .org-chart-page .org-tree .org-node-item::after {
      content: "";
      position: absolute;
      top: 0;
      right: 50%;
      border-top: 1px solid #d3d9e5;
      width: 50%;
      height: 1rem;
    }
    .org-chart-page .org-tree .org-node-item::after {
      right: auto;
      left: 50%;
      border-left: 1px solid #d3d9e5;
    }
    .org-chart-page .org-tree .org-node-item:only-child::after,
    .org-chart-page .org-tree .org-node-item:only-child::before { display: none; }
    .org-chart-page .org-tree .org-node-item:only-child { padding-top: 0; }
    .org-chart-page .org-tree .org-node-item:first-child::before,
    .org-chart-page .org-tree .org-node-item:last-child::after { border: 0; }
    .org-chart-page .org-tree .org-node-item:last-child::before { border-right: 1px solid #d3d9e5; border-radius: 0 10px 0 0; }
    .org-chart-page .org-tree .org-node-item:first-child::after { border-radius: 10px 0 0 0; }
    .org-chart-page .org-node-children > .org-tree::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      border-left: 1px solid #d3d9e5;
      width: 0;
      height: 1rem;
    }
  </style>`;
}

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "Solo el rol RH puede acceder al organigrama empresarial.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

function organigramaMainHtml(state: OrganigramaPageState): string {
  if (state.loading) {
    return `<div class="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-16 text-center text-sm text-text-muted shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      Cargando organigrama empresarial...
    </div>`;
  }

  if (state.error) {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">${escapeHtml(state.error)}</div>`;
  }

  if (!state.data || state.data.roots.length === 0) {
    return `<div class="rounded-2xl border border-border bg-white px-4 py-16 text-center text-sm text-text-muted">
      No hay estructura organizacional disponible con empleados activos.
    </div>`;
  }

  const roots = filteredTree(state.data.roots, state);
  const selectedNode = findNode(state.data.roots, state.selectedNodeId);

  const relacionesWarning = state.data.total_relaciones_incompletas > 0
    ? `<div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Se detectaron ${escapeHtml(String(state.data.total_relaciones_incompletas))} relaciones de jefatura incompletas.
      </div>`
    : "";

  const emptyByFilter = roots.length === 0
    ? `<div class="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 text-center text-sm text-slate-500">
        No hay resultados con los filtros actuales. Ajusta búsqueda, nivel o departamento.
      </div>`
    : `<div class="min-w-max px-8 pb-8 pt-3" style="transform: scale(${state.zoom}); transform-origin: top center;">
         ${treeHtml(roots, state)}
       </div>`;

  return `<section class="org-chart-page space-y-4">
    ${organigramaStyles()}
    <header>
      <h1 class="text-4xl font-extrabold tracking-tight text-slate-900">Organigrama Empresarial</h1>
      <p class="mt-1 text-lg text-slate-500">Visualización jerárquica y estructura organizacional</p>
    </header>
    ${toolbarHtml(state)}
    ${relacionesWarning}
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="rounded-[1.7rem] border border-slate-200 bg-[#f5f8ff] p-3 shadow-sm">
        <div class="h-[60vh] min-h-[470px] overflow-auto rounded-2xl border border-white/70 bg-gradient-to-b from-white/60 to-[#eef3ff]">
          ${emptyByFilter}
        </div>
      </section>
      ${detailPanelHtml(selectedNode)}
    </div>
    ${legendHtml()}
  </section>`;
}

export function mountOrganigrama(container: HTMLElement, signal: AbortSignal): void {
  if (!canAccessOrganigramaPage()) {
    mountAppShell(container, {
      pageTitle: "Organigrama empresarial",
      activeNav: "organigrama",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const state: OrganigramaPageState = {
    loading: true,
    error: null,
    data: null,
    selectedNodeId: null,
    search: "",
    department: "",
    maxDepth: "all",
    zoom: 1,
    collapsedByNodeId: new Set<number>(),
    depthOptions: [],
    departmentOptions: [],
  };

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const paint = (): void => {
    const root = container.querySelector("#organigrama-page-root");
    if (!root) return;
    root.innerHTML = organigramaMainHtml(state);
  };

  mountAppShell(container, {
    pageTitle: "Organigrama empresarial",
    activeNav: "organigrama",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="organigrama-page-root">${organigramaMainHtml(state)}</div>`,
  });

  container.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.id !== "org-search") return;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.search = (target as HTMLInputElement).value;
        paint();
      }, 220);
    },
    { signal },
  );

  container.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.id === "org-depth") {
        const raw = (target as HTMLSelectElement).value;
        state.maxDepth = raw === "all" ? "all" : Number.parseInt(raw, 10);
        paint();
        return;
      }
      if (target.id === "org-department") {
        state.department = (target as HTMLSelectElement).value;
        paint();
      }
    },
    { signal },
  );

  container.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const actionBtn = target.closest<HTMLElement>("[data-org-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-org-action");
        if (action === "zoom-in") {
          state.zoom = Math.min(ZOOM_MAX, Number((state.zoom + ZOOM_STEP).toFixed(2)));
          paint();
          return;
        }
        if (action === "zoom-out") {
          state.zoom = Math.max(ZOOM_MIN, Number((state.zoom - ZOOM_STEP).toFixed(2)));
          paint();
          return;
        }
        if (action === "zoom-reset") {
          state.zoom = 1;
          paint();
          return;
        }
        if (action === "close-panel") {
          state.selectedNodeId = null;
          paint();
          return;
        }
        if (action === "export-pdf") {
          window.print();
        }
        return;
      }

      const nodeBtn = target.closest<HTMLElement>("[data-org-node-id]");
      if (nodeBtn) {
        const rawId = nodeBtn.getAttribute("data-org-node-id");
        const nodeId = rawId ? Number.parseInt(rawId, 10) : NaN;
        if (Number.isFinite(nodeId)) {
          state.selectedNodeId = nodeId;
          paint();
        }
        return;
      }

      const expandBtn = target.closest<HTMLElement>("[data-org-expand-node-id]");
      if (expandBtn) {
        const rawId = expandBtn.getAttribute("data-org-expand-node-id");
        const nodeId = rawId ? Number.parseInt(rawId, 10) : NaN;
        if (!Number.isFinite(nodeId)) return;
        if (state.collapsedByNodeId.has(nodeId)) {
          state.collapsedByNodeId.delete(nodeId);
        } else {
          state.collapsedByNodeId.add(nodeId);
        }
        paint();
      }
    },
    { signal },
  );

  const load = async (): Promise<void> => {
    state.loading = true;
    state.error = null;
    paint();
    try {
      const data = await getOrganigrama();
      state.data = data;
      state.loading = false;
      const allNodes = flattenNodes(data.roots);
      state.selectedNodeId = data.roots[0]?.id ?? null;
      state.depthOptions = Array.from({ length: collectDepth(data.roots) + 1 }, (_, i) => i);
      state.departmentOptions = Array.from(
        new Set(
          allNodes
            .map((node) => node.departamento?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "es"));
      paint();
    } catch (error) {
      if (isUnauthorized(error)) {
        await handleSessionExpired(container);
        return;
      }
      if (isForbidden(error)) {
        state.loading = false;
        state.error = "No tienes permisos para consultar el organigrama.";
        paint();
        window.history.replaceState(null, "", "#/");
        return;
      }
      const detail = (error as OrganigramaFetchError).detail || "No se pudo cargar el organigrama.";
      state.loading = false;
      state.error = detail;
      paint();
    }
  };

  if (!signal.aborted) {
    void load();
  }
}
