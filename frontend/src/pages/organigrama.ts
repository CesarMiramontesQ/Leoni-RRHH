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
import {
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
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
  const ini = inicialesDesdeNombreDisplay(nombreDisplay(nodo));
  const fallback = `<span class="${sizeClass} org-avatar-fallback inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">${escapeHtml(ini)}</span>`;
  if (foto) {
    return `<span class="relative inline-flex shrink-0">
      <img src="${escapeHtml(foto)}" alt="Avatar de ${escapeHtml(nombreDisplay(nodo))}" data-org-avatar class="${sizeClass} rounded-full border border-white/85 object-cover shadow-sm ring-1 ring-slate-200/70" />
      <span hidden class="org-avatar-fallback--swap">${fallback}</span>
    </span>`;
  }
  return fallback;
}

function estadoBadge(nodo: OrganigramaNodo): string {
  const estado = fallback(nodo.estado_empleado, nodo.activo ? "Activo" : "Inactivo");
  const cls = nodo.activo
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
  const dot = nodo.activo ? "bg-emerald-500" : "bg-slate-400";
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${cls}"><span class="size-1.5 rounded-full ${dot}" aria-hidden="true"></span>${escapeHtml(estado.toUpperCase())}</span>`;
}

function nodeCardHtml(node: OrganigramaNodo, selectedId: number | null): string {
  const isSelected = selectedId === node.id;
  const selectedCls = isSelected
    ? "org-node-selected border-[#1e40af]/40 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_70%)] ring-2 ring-[#2563eb]/25 shadow-[0_14px_32px_rgba(37,99,235,0.16)]"
    : "border-[rgba(148,163,184,0.35)] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_6px_18px_rgba(15,23,42,0.08)]";
  const title = fallback(node.nombre_puesto, "Puesto sin asignar");
  return `<button
      type="button"
      data-org-node-id="${node.id}"
      class="group org-node-card w-[240px] rounded-2xl border px-3.5 py-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2563eb]/35 hover:shadow-[0_14px_30px_rgba(15,23,42,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/45 focus-visible:ring-offset-2 ${selectedCls}"
      aria-label="Ver detalle de ${escapeHtml(nombreDisplay(node))}"
      title="Abrir detalle de ${escapeHtml(nombreDisplay(node))}"
    >
      <div class="flex items-center gap-2.5">
        ${avatarHtml(node, "size-10")}
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-semibold text-slate-900">${escapeHtml(nombreDisplay(node))}</p>
          <p class="truncate text-[11px] font-semibold uppercase tracking-wide text-[#1e40af]" title="${escapeHtml(title)}">${escapeHtml(title)}</p>
          <p class="mt-0.5 text-[11px] text-slate-500">ID: ${escapeHtml(node.no_empleado)}</p>
        </div>
      </div>
      <div class="mt-2.5 flex items-center justify-between">
        <span class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${nivelPillClass(node.nivel_visual)}">${escapeHtml(nivelLabel(node.nivel_visual))}</span>
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

  return `<section class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold tracking-tight text-[#0f172a]">Filtros y acciones</h2>
    </div>
    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_230px_auto]">
      <label class="relative block">
        <span class="sr-only">Buscar por nombre o número</span>
        <input
          id="org-search"
          type="text"
          autocomplete="off"
          value="${escapeHtml(state.search)}"
          placeholder="Nombre o No. de empleado"
          class="min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}"
        />
        <svg class="pointer-events-none absolute left-3 top-2.5 size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 21-4.35-4.35m1.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </label>
      <select id="org-depth" class="min-h-[42px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2.5 text-sm text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}">
        ${depthOptions}
      </select>
      <select id="org-department" class="min-h-[42px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2.5 text-sm text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}">
        ${deptOptions}
      </select>
      <div class="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
        <button type="button" data-org-action="zoom-out" class="inline-flex size-10 items-center justify-center rounded-[11px] border border-[rgba(148,163,184,0.35)] bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.45)] hover:text-[#002147] ${RH_LISTADO_FOCUS_RING}" aria-label="Alejar zoom" title="Alejar zoom">−</button>
        <button type="button" data-org-action="zoom-in" class="inline-flex size-10 items-center justify-center rounded-[11px] border border-[rgba(148,163,184,0.35)] bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.45)] hover:text-[#002147] ${RH_LISTADO_FOCUS_RING}" aria-label="Acercar zoom" title="Acercar zoom">+</button>
        <button type="button" data-org-action="zoom-reset" class="${RH_LISTADO_BTN_SECONDARY} min-h-[40px] rounded-full px-3 py-1.5 text-xs" aria-label="Restablecer zoom" title="Restablecer zoom">Reset</button>
        <button type="button" data-org-action="export-pdf" class="${RH_LISTADO_BTN_PRIMARY} min-h-[40px] rounded-full bg-[linear-gradient(135deg,#1e3a8a_0%,#1d4ed8_100%)] px-4 py-2 shadow-[0_8px_22px_rgba(30,64,175,0.25)] hover:-translate-y-0.5" aria-label="Exportar PDF" title="Exportar PDF">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V8m0 8 3-3m-3 3-3-3M4.5 18.75h15" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Exportar PDF
        </button>
      </div>
    </div>
  </section>`;
}

function detailPanelHtml(selected: OrganigramaNodo | null): string {
  if (!selected) {
    return `<aside class="${RH_LISTADO_SURFACE} rounded-3xl p-6">
      <p class="text-sm text-slate-500">Selecciona un colaborador en el organigrama para ver su detalle.</p>
    </aside>`;
  }
  const puesto = fallback(selected.nombre_puesto, "Puesto sin asignar");
  const depto = fallback(selected.departamento, "Departamento sin asignar");
  const correo = fallback(selected.correo, "Sin correo");
  const ext = fallback(selected.extension_telefono, "Sin extensión");

  return `<aside class="${RH_LISTADO_SURFACE} rounded-3xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] xl:sticky xl:top-20">
    <div class="mb-4 flex items-start justify-between gap-3">
      ${estadoBadge(selected)}
      <button type="button" data-org-action="close-panel" class="rounded-[10px] border border-transparent p-1.5 text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600 ${RH_LISTADO_FOCUS_RING}" aria-label="Cerrar detalle" title="Cerrar detalle">
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="text-center">
      <div class="mx-auto mb-3 flex justify-center">${avatarHtml(selected, "size-20")}</div>
      <p class="text-2xl font-extrabold text-slate-900">${escapeHtml(nombreDisplay(selected))}</p>
      <p class="text-sm font-bold uppercase tracking-wide text-leoni-blue">${escapeHtml(puesto)}</p>
      <p class="mt-1 text-sm text-slate-500">Departamento: ${escapeHtml(depto)}</p>
    </div>
    <dl class="mt-5 space-y-3 text-sm">
      <div class="rounded-2xl border border-slate-200/80 bg-[#f8fafc] px-3 py-2.5">
        <dt class="text-xs font-semibold text-slate-400">Correo</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(correo)}</dd>
      </div>
      <div class="rounded-2xl border border-slate-200/80 bg-[#f8fafc] px-3 py-2.5">
        <dt class="text-xs font-semibold text-slate-400">Extensión / Teléfono</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(ext)}</dd>
      </div>
      <div class="rounded-2xl border border-slate-200/80 bg-[#f8fafc] px-3 py-2.5">
        <dt class="text-xs font-semibold text-slate-400">Reportes directos</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(String(selected.reportes_directos))} empleados</dd>
      </div>
      <div class="rounded-2xl border border-slate-200/80 bg-[#f8fafc] px-3 py-2.5">
        <dt class="text-xs font-semibold text-slate-400">No. empleado</dt>
        <dd class="font-medium text-slate-700">${escapeHtml(selected.no_empleado)}</dd>
      </div>
    </dl>
    <a href="#/empleados/${selected.id}" class="${RH_LISTADO_BTN_SECONDARY} mt-5 inline-flex w-full items-center justify-center rounded-full border-2 border-[#1e40af]/50 bg-white px-4 py-2 text-sm font-semibold text-[#1e40af] hover:bg-[#eff6ff]">Ver Perfil Completo</a>
  </aside>`;
}

function legendHtml(): string {
  const item = (text: string, color: string): string =>
    `<span class="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md"><span class="size-2.5 rounded-full ${color}"></span>${escapeHtml(text)}</span>`;
  return `<section class="${RH_LISTADO_SURFACE} flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3">
    ${item("Dirección", "bg-blue-600")}
    ${item("Gerencia", "bg-violet-500")}
    ${item("Jefaturas", "bg-emerald-600")}
    ${item("Operación", "bg-slate-400")}
  </section>`;
}

function organigramaStyles(): string {
  return `<style>
    .org-chart-page .org-node-card,
    .org-chart-page .org-node-item button,
    .org-chart-page .org-chart-card,
    .org-chart-page .org-micro-anim {
      transition-duration: 180ms;
      transition-timing-function: ease;
    }
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
      border-top: 1.2px solid #cbd5e1;
      width: 50%;
      height: 1rem;
    }
    .org-chart-page .org-tree .org-node-item::after {
      right: auto;
      left: 50%;
      border-left: 1.2px solid #cbd5e1;
    }
    .org-chart-page .org-tree .org-node-item:only-child::after,
    .org-chart-page .org-tree .org-node-item:only-child::before { display: none; }
    .org-chart-page .org-tree .org-node-item:only-child { padding-top: 0; }
    .org-chart-page .org-tree .org-node-item:first-child::before,
    .org-chart-page .org-tree .org-node-item:last-child::after { border: 0; }
    .org-chart-page .org-tree .org-node-item:last-child::before { border-right: 1.2px solid #cbd5e1; border-radius: 0 10px 0 0; }
    .org-chart-page .org-tree .org-node-item:first-child::after { border-radius: 10px 0 0 0; }
    .org-chart-page .org-node-children > .org-tree::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      border-left: 1.2px solid #cbd5e1;
      width: 0;
      height: 1rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .org-chart-page .org-node-card,
      .org-chart-page .org-node-item button,
      .org-chart-page .org-chart-card,
      .org-chart-page .org-micro-anim {
        transition-duration: 1ms !important;
      }
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
    return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} p-6 sm:p-7">
        <div class="animate-pulse space-y-4">
          <div class="h-8 w-72 rounded-md bg-slate-200/90"></div>
          <div class="h-4 w-96 max-w-full rounded-md bg-slate-100/90"></div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="h-9 rounded-full bg-slate-100/90"></div>
            <div class="h-9 rounded-full bg-slate-100/90"></div>
            <div class="h-9 rounded-full bg-slate-100/90"></div>
          </div>
        </div>
      </section>
      <div class="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-16 text-center text-sm text-text-muted shadow-[0_8px_24px_rgba(15,23,42,0.06)]">Cargando organigrama empresarial...</div>
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
  const totalVisibles = flattenNodes(roots).length;
  const selectedDeptLabel = state.department.trim() ? state.department : "Todos";
  const heroMeta = `<div class="mt-4 flex flex-wrap gap-2">
    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"><span class="size-1.5 rounded-full bg-[#1e40af]"></span>${escapeHtml(String(totalVisibles))} empleados visibles</span>
    <span class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-900 shadow-sm"><span class="size-1.5 rounded-full bg-amber-500"></span>${escapeHtml(String(state.data.total_relaciones_incompletas))} relaciones incompletas</span>
    <span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"><span class="size-1.5 rounded-full bg-violet-500"></span>Departamento: ${escapeHtml(selectedDeptLabel)}</span>
  </div>`;

  const relacionesWarning = state.data.total_relaciones_incompletas > 0
    ? `<div class="flex items-start gap-2 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 to-amber-50/40 px-4 py-3 text-sm text-amber-900 shadow-[0_6px_16px_rgba(217,119,6,0.08)]">
        <svg class="mt-0.5 size-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.27 3.93 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3l-8.45-14.07a2 2 0 0 0-3.46 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>
        Se detectaron ${escapeHtml(String(state.data.total_relaciones_incompletas))} relaciones de jefatura incompletas.
        </span>
      </div>`
    : "";

  const emptyByFilter = roots.length === 0
    ? `<div class="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 text-center text-sm text-slate-500">
        <div>
          <p class="text-base font-semibold text-slate-800">No se encontraron empleados</p>
          <p class="mt-1 text-sm text-slate-500">Prueba ajustando la búsqueda o los filtros.</p>
        </div>
      </div>`
    : `<div class="min-w-max px-8 pb-8 pt-3" style="transform: scale(${state.zoom}); transform-origin: top center;">
         ${treeHtml(roots, state)}
       </div>`;

  return `<section class="org-chart-page ${RH_LISTADO_PAGE_OUTER_GRADIENT} space-y-4">
    ${organigramaStyles()}
    <header class="${RH_LISTADO_SURFACE} org-chart-card bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 sm:p-6">
      <h1 class="text-[clamp(1.35rem,2.5vw,1.85rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Organigrama Empresarial</h1>
      <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Visualización jerárquica y estructura organizacional</p>
      ${heroMeta}
    </header>
    ${toolbarHtml(state)}
    ${relacionesWarning}
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="${RH_LISTADO_SURFACE} org-chart-card rounded-[1.7rem] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3">
        <div class="h-[60vh] min-h-[470px] overflow-auto rounded-2xl border border-white/70 bg-gradient-to-b from-[#f8fbff] via-[#f3f7ff] to-[#edf3ff]">
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
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.hasAttribute("data-org-avatar")) return;
      target.classList.add("hidden");
      const swap = target.nextElementSibling;
      if (swap instanceof HTMLElement && swap.classList.contains("org-avatar-fallback--swap")) {
        swap.removeAttribute("hidden");
      }
    },
    { capture: true, signal },
  );

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
