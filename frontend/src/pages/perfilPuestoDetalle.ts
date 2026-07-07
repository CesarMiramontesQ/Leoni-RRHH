import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { getAccessToken } from "../auth/session.ts";
import {
  FIELD_FOCUS,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
  badgeCancelled,
  badgeOpen,
} from "../ui/uiTokens.ts";
import { hasRhModule } from "../auth/rhModulePermissions.ts";
import { tareaTituloSubtitulo } from "../components/puestos/perfilTareaDisplay.ts";
import { mountEditarTareasModal } from "../components/puestos/editarTareasModal.ts";
import { mountEditarCualificacionesModal } from "../components/puestos/editarCualificacionesModal.ts";
import { labelCriterio } from "../components/puestos/cualificacionCriterioFields.ts";
import {
  categoriaDesdeGrupoNombre,
  grupoCompetenciaBadgeClasses,
  type CategoriaCompetencia,
} from "../ui/competenciaCategoria.ts";
import { nivelRequeridoLabel, maxNivelActivoValor, ensureMetodosCalificacionCompetenciaLoaded } from "../ui/nivelCompetencia.ts";
import { mountEditarCompetenciasModal } from "../components/puestos/editarCompetenciasMultiSelect.ts";
import type { EditarCualificacionesModalHandle } from "../components/puestos/editarCualificacionesModal.ts";
import type { EditarTareasModalHandle } from "../components/puestos/editarTareasModal.ts";
import { getPerfilCompetencias, getPerfilCualificaciones, updatePerfil, type PerfilCualificacion } from "../api/puestos.ts";
import type { CriterioRequerido } from "../dashboard/cualificaciones/types.ts";
import { getGradosPuesto } from "../api/gradosPuesto.ts";
import type { GradoPuesto } from "../dashboard/gradosPuesto/types.ts";
import { getCursosPuesto, asignarCursoPuesto, eliminarCursoPuesto, getCursos, getCursoSesiones } from "../api/cursos.ts";
import type { CursoPuestoItem } from "../api/cursos.ts";

// ── Tipos (misma forma de respuesta API) ────────────────────────────────

interface PuestoPerfilInfo {
  id: number;
  codigo: string;
  nombre: string;
  area_nombre: string | null;
  nivel_nombre: string | null;
  descripcion: string | null;
  version: number;
  activo: boolean;
  updated_at?: string;
}

interface Tarea {
  id: number;
  orden: number;
  descripcion: string;
  es_complemento: boolean;
  tarea_catalogo_id?: number | null;
  tarea_catalogo_nombre?: string | null;
}

interface Competencia {
  id: number;
  competencia_id: number;
  competencia_nombre: string;
  tipo_competencia_id: number | null;
  tipo_nombre: string | null;
  categoria: string | null;
  grupo_nombre: string | null;
  nivel_requerido: number;
  orden: number | null;
}

interface AsignacionResumen {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  activo: boolean;
}

type ExecutiveSummary = {
  empleados: number;
  tareas: number;
  competencias: number;
  cualificaciones: number;
  nivelPromedio: string | null;
  competenciasSinNivel: number;
  competenciasExperto: number;
};

// ── Constantes de etiquetas ─────────────────────────────────────────────

/** Orden de categoría técnica/blanda para filas de la matriz. */
const CATEGORIA_MATRIZ_ORDER: Record<string, number> = {
  tecnica: 0,
  blanda: 1,
};

const ICON_BACK = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;
const ICON_BUILDING = `<svg class="size-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-2.25-18v18m-7.5-15v15m-7.5-12v12"/></svg>`;
const ICON_USERS = `<svg class="size-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_USERS_KPI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_USERS_SM = `<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_CLIPBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>`;
const ICON_ACADEMIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"/></svg>`;
const ICON_SPARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>`;
const ICON_PENCIL = `<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Helpers ─────────────────────────────────────────────────────────────

/** Edición del perfil de puesto: RH con el módulo o no-RH con el módulo `puestos` otorgado. */
function canEditarPerfilPuesto(): boolean {
  return hasRhModule("puestos");
}

function safeText(value: string | null | undefined, fallback = "—"): string {
  return escapeHtml(value?.trim() ? value : fallback);
}

type CompetenciasPorGrado = {
  grado: GradoPuesto;
  competencias: Competencia[];
};

async function loadCompetenciasPorGrado(perfilId: number, grados: GradoPuesto[]): Promise<CompetenciasPorGrado[]> {
  const activos = grados.filter((g) => g.activo);
  if (activos.length === 0) return [];

  const porGrado = await Promise.all(
    activos.map(async (grado) => {
      try {
        const items = await getPerfilCompetencias(perfilId, grado.id);
        const competencias = items.map((c) => ({
          id: c.id,
          competencia_id: c.competencia_id,
          competencia_nombre: c.competencia_nombre,
          tipo_competencia_id: c.tipo_competencia_id,
          tipo_nombre: c.tipo_nombre,
          categoria: c.categoria,
          grupo_nombre: c.grupo_nombre,
          nivel_requerido: c.nivel_requerido,
          orden: c.orden,
        }));
        return { grado, competencias };
      } catch {
        return { grado, competencias: [] as Competencia[] };
      }
    }),
  );

  return porGrado;
}

function formatFecha(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function computeExecutiveSummary(
  tareas: Tarea[],
  cualificaciones: PerfilCualificacion[],
  competencias: Competencia[],
  empleados: number,
): ExecutiveSummary {
  const conNivel = competencias.filter((c) => c.nivel_requerido > 0);
  const avg =
    conNivel.length > 0
      ? Math.round((conNivel.reduce((s, c) => s + c.nivel_requerido, 0) / conNivel.length) * 10) / 10
      : null;
  const maxNivel = maxNivelActivoValor();
  const nivelExperto = maxNivel > 0 ? maxNivel : 4;

  // La misma competencia aparece en varios grados: contamos competencias DISTINTAS
  // y tomamos el nivel máximo alcanzado por cada una a lo largo de los grados.
  const nivelMaxPorCompetencia = new Map<number, number>();
  for (const c of competencias) {
    const prev = nivelMaxPorCompetencia.get(c.competencia_id) ?? 0;
    nivelMaxPorCompetencia.set(c.competencia_id, Math.max(prev, c.nivel_requerido ?? 0));
  }
  const nivelesMax = Array.from(nivelMaxPorCompetencia.values());

  return {
    empleados,
    tareas: tareas.length,
    competencias: nivelMaxPorCompetencia.size,
    cualificaciones: cualificaciones.length,
    nivelPromedio: avg != null ? String(avg) : null,
    competenciasSinNivel: nivelesMax.filter((n) => n <= 0).length,
    competenciasExperto: nivelesMax.filter((n) => n >= nivelExperto).length,
  };
}

function nivelVisual(nivel: number): { cls: string; short: string; title: string } {
  const title = nivelRequeridoLabel(nivel);
  if (nivel <= 0) return { cls: "ppd-nivel ppd-nivel--na", short: "—", title };
  if (nivel === 1) return { cls: "ppd-nivel ppd-nivel--1", short: "1", title };
  if (nivel === 2) return { cls: "ppd-nivel ppd-nivel--2", short: "2", title };
  if (nivel === 3) return { cls: "ppd-nivel ppd-nivel--3", short: "3", title };
  return { cls: "ppd-nivel ppd-nivel--4", short: "4", title };
}

function sectionEditBtn(action: string, label: string): string {
  if (!canEditarPerfilPuesto()) return "";
  return `<button type="button" data-action="${action}" class="ppd-section-edit" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ICON_PENCIL}<span class="hidden sm:inline">${escapeHtml(label)}</span></button>`;
}

/** Botón de edición compacto (solo icono) para el encabezado de columna de un grado en la matriz. */
function gradoColEditBtn(gradoId: number, label: string): string {
  if (!canEditarPerfilPuesto()) return "";
  return `<button type="button" data-action="edit-competencias" data-grado-id="${gradoId}" class="ppd-matrix-edit" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ICON_PENCIL}</button>`;
}

function emptyState(message: string, hint?: string): string {
  return `
  <div class="ppd-empty flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
    <p class="text-sm font-medium text-text-primary">${message}</p>
    ${hint ? `<p class="mt-1.5 max-w-xs text-xs leading-relaxed text-text-muted">${hint}</p>` : ""}
  </div>`;
}

function sectionShell(
  id: string,
  title: string,
  subtitle: string,
  count: number,
  editAction: string,
  editLabel: string,
  body: string,
  extraClass = "",
): string {
  return `
  <section id="${id}" class="${RH_LISTADO_SURFACE} ppd-section overflow-hidden ${extraClass}" aria-labelledby="${id}-title">
    <header class="ppd-section-header flex flex-col gap-3 border-b border-slate-100/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div class="min-w-0">
        <h2 id="${id}-title" class="text-sm font-semibold text-text-primary">${escapeHtml(title)}</h2>
        <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(subtitle)}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold tabular-nums text-blue-800 ring-1 ring-blue-200/80">${count}</span>
        ${editAction ? sectionEditBtn(editAction, editLabel) : ""}
      </div>
    </header>
    <div class="ppd-section-body p-4 sm:p-5">${body}</div>
  </section>`;
}

function renderLoadingSkeleton(): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER} ppd-page" aria-busy="true">
    <div class="h-8 w-56 animate-pulse rounded-lg bg-slate-200/90"></div>
    <div class="h-40 animate-pulse rounded-2xl bg-white shadow-sm"></div>
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${"<div class=\"h-28 animate-pulse rounded-2xl bg-white\"></div>".repeat(4)}
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="h-64 animate-pulse rounded-2xl bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl bg-white"></div>
    </div>
  </div>`;
}

// ── Encabezado y resumen ejecutivo ────────────────────────────────────────

function renderHeader(puesto: PuestoPerfilInfo, empleadosCount: number, perfilId: number): string {
  const estadoBadge = puesto.activo
    ? badgeOpen("Activo")
    : badgeCancelled("Inactivo");
  const fechaActualizacion = formatFecha(puesto.updated_at);

  return `
  <header class="${RH_LISTADO_SURFACE} ppd-hero overflow-hidden">
    <div class="border-b border-slate-100/90 bg-gradient-to-br from-slate-50/80 via-white to-blue-50/30 px-4 py-5 sm:px-6 sm:py-6">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">${escapeHtml(puesto.codigo)}</span>
            ${estadoBadge}
            <span class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">Versión ${puesto.version}</span>
          </div>
          <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(puesto.nombre)}</h1>
          <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-secondary">
            <span class="inline-flex items-center gap-1.5">${ICON_BUILDING}<span><strong class="font-semibold text-text-primary">${safeText(puesto.area_nombre)}</strong> · ${safeText(puesto.nivel_nombre)}</span></span>
            <span class="inline-flex items-center gap-1.5">${ICON_USERS}<span><strong class="font-semibold tabular-nums text-text-primary">${empleadosCount}</strong> empleado${empleadosCount !== 1 ? "s" : ""} asignado${empleadosCount !== 1 ? "s" : ""}</span></span>
            ${fechaActualizacion ? `<span class="text-xs text-text-muted">Actualizado ${escapeHtml(fechaActualizacion)}</span>` : ""}
          </div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          ${canEditarPerfilPuesto() ? `<button type="button" data-action="edit-base" class="${RH_LISTADO_BTN_GHOST} ppd-hero-action justify-center">${ICON_PENCIL}<span>Editar perfil</span></button>` : ""}
          <a href="#/puestos/${perfilId}/empleados" class="${RH_LISTADO_BTN_PRIMARY} ppd-hero-action justify-center text-center">${ICON_USERS_SM}<span>Ver empleados</span></a>
        </div>
      </div>
    </div>
    ${
      puesto.descripcion
        ? `<div class="px-4 py-4 sm:px-6">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Descripción del puesto</p>
        <p class="mt-2 text-sm leading-relaxed text-text-secondary">${escapeHtml(puesto.descripcion)}</p>
      </div>`
        : ""
    }
  </header>`;
}

function renderExecutiveSummary(summary: ExecutiveSummary): string {
  const kpis: {
    label: string;
    value: string;
    sub: string;
    icon: string;
    iconWrap: string;
    valueClass?: string;
    valueId?: string;
  }[] = [
    {
      label: "Empleados asignados",
      value: String(summary.empleados),
      sub: "En este perfil",
      icon: ICON_USERS_KPI,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
    {
      label: "Tareas principales",
      value: String(summary.tareas),
      sub: "Definidas en el perfil",
      icon: ICON_CLIPBOARD,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
      valueId: "ppd-kpi-tareas-value",
    },
    {
      label: "Competencias",
      value: String(summary.competencias),
      sub:
        summary.competenciasSinNivel > 0
          ? `${summary.competenciasSinNivel} sin nivel definido`
          : "Con nivel requerido",
      icon: ICON_SPARK,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
      valueClass: summary.competenciasSinNivel > 0 ? "text-amber-800" : "",
    },
    {
      label: "Calificaciones",
      value: String(summary.cualificaciones),
      sub: "Requisitos registrados",
      icon: ICON_ACADEMIC,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--slate",
    },
  ];

  const extraInsights: string[] = [];
  if (summary.nivelPromedio) {
    const maxN = maxNivelActivoValor();
    extraInsights.push(
      `Nivel promedio requerido: <strong>${escapeHtml(summary.nivelPromedio)}</strong>${maxN > 0 ? ` / ${maxN}` : ""}`,
    );
  }
  if (summary.competenciasExperto > 0) {
    const maxN = maxNivelActivoValor();
    const label = maxN > 0 ? `nivel máximo (${maxN})` : "nivel máximo";
    extraInsights.push(
      `<strong>${summary.competenciasExperto}</strong> competencia${summary.competenciasExperto !== 1 ? "s" : ""} en ${label}`,
    );
  }

  return `
  <div class="flex flex-col gap-3" role="group" aria-label="Resumen ejecutivo del puesto">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${kpis
        .map(
          (k) => `
        <article class="rh-dash-kpi-card rounded-[18px] p-5">
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
            <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
          </div>
          <p${k.valueId ? ` id="${k.valueId}"` : ""} class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary ${k.valueClass ?? ""}">${k.value}</p>
          <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
        </article>`,
        )
        .join("")}
    </div>
    ${
      extraInsights.length > 0
        ? `<div class="flex flex-wrap gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-xs text-text-secondary shadow-sm">
        ${extraInsights.map((t) => `<span class="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1">${t}</span>`).join("")}
      </div>`
        : ""
    }
  </div>`;
}

// ── Secciones de contenido ──────────────────────────────────────────────

function renderTareas(tareas: Tarea[], updatedAt: string | null): string {
  const fechaMeta = updatedAt ? ` · Actualizado ${escapeHtml(updatedAt)}` : "";
  const manyTasks = tareas.length > 12;

  if (tareas.length === 0) {
    return sectionShell(
      "ppd-tareas",
      "Tareas principales",
      `Catálogo de funciones del puesto${fechaMeta}`,
      0,
      "edit-tareas",
      "Editar tareas",
      emptyState(
        "Sin tareas registradas",
        canEditarPerfilPuesto() ? "Usa el botón de edición para agregar tareas principales y complementarias." : undefined,
      ),
    );
  }

  const principales = tareas.filter((t) => !t.es_complemento);
  const complemento = tareas.filter((t) => t.es_complemento);

  const renderList = (items: Tarea[]) =>
    items
      .map((t) => {
        const { titulo, subtitulo } = tareaTituloSubtitulo(t);
        const subtituloHtml = subtitulo
          ? `<p class="mt-0.5 text-xs leading-relaxed text-text-muted" title="${escapeHtml(subtitulo)}">${escapeHtml(subtitulo)}</p>`
          : "";
        return `
      <li class="ppd-task-item group flex gap-3 rounded-lg border border-transparent px-2 py-2.5 transition hover:border-slate-200/90 hover:bg-slate-50/80">
        <span class="ppd-task-orden flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-mono text-xs font-bold text-blue-800 ring-1 ring-blue-200/60" aria-hidden="true">${t.orden}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium leading-relaxed text-text-primary" title="${escapeHtml(titulo)}">${escapeHtml(titulo)}</p>
          ${subtituloHtml}
        </div>
      </li>`;
      })
      .join("");

  const body = `
    <div class="ppd-tareas-scroll ${manyTasks ? "ppd-tareas-scroll--tall" : ""}">
      <ol class="flex flex-col gap-0.5">${renderList(principales)}</ol>
      ${
        complemento.length > 0
          ? `<div class="mt-5 border-t border-slate-200/90 pt-4">
          <p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <span class="rounded-md bg-amber-50 px-2 py-0.5 text-amber-900 ring-1 ring-amber-200/80">Complementarias</span>
            <span class="tabular-nums text-slate-500">${complemento.length}</span>
          </p>
          <ol class="flex flex-col gap-0.5">${renderList(complemento)}</ol>
        </div>`
          : ""
      }
    </div>`;

  return sectionShell(
    "ppd-tareas",
    "Tareas principales",
    `${tareas.length} tarea${tareas.length !== 1 ? "s" : ""} definida${tareas.length !== 1 ? "s" : ""}${fechaMeta}`,
    tareas.length,
    "edit-tareas",
    "Editar tareas",
    body,
    manyTasks ? "ppd-section--dense" : "",
  );
}

function renderCriterioDisplay(c: PerfilCualificacion): string {
  const criterio = c.criterio_requerido as CriterioRequerido | null;
  if (criterio?.na) return badgeCancelled("No aplica");
  const label = labelCriterio(criterio, c.opciones);
  if (label === "—") return `<span class="text-sm font-normal text-text-muted">Sin criterio definido</span>`;
  return `<span class="whitespace-pre-line text-sm leading-relaxed">${escapeHtml(label)}</span>`;
}

function renderCualificaciones(cualificaciones: PerfilCualificacion[]): string {
  if (cualificaciones.length === 0) {
    return sectionShell(
      "ppd-cualificaciones",
      "Calificaciones requeridas",
      "Educación, experiencia y formación",
      0,
      "edit-cualificaciones",
      "Editar calificaciones",
      emptyState(
        "Sin calificaciones registradas",
        canEditarPerfilPuesto() ? "Define estudios, experiencia y complementos desde la edición." : undefined,
      ),
    );
  }

  const byTipo = new Map<string, PerfilCualificacion[]>();
  for (const c of cualificaciones) {
    const key = c.tipo_nombre?.trim() || "Otros requisitos";
    const list = byTipo.get(key) ?? [];
    list.push(c);
    byTipo.set(key, list);
  }

  const groupBlocks = Array.from(byTipo.entries())
    .map(
      ([tipoNombre, items]) => `
    <div class="ppd-cualif-group rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/50 to-white p-4">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(tipoNombre)}</h3>
      <div class="mt-3 flex flex-col gap-2">
        ${items
          .map(
            (c) => `
          <article class="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm">
            <p class="text-[10px] font-medium text-text-muted">${escapeHtml(c.cualificacion_nombre || "Cualificación")}</p>
            <div class="mt-1.5 font-semibold text-text-primary">${renderCriterioDisplay(c)}</div>
            ${c.comentarios ? `<p class="mt-1.5 text-xs leading-relaxed text-text-muted">${escapeHtml(c.comentarios)}</p>` : ""}
          </article>`,
          )
          .join("")}
      </div>
    </div>`,
    )
    .join("");

  return sectionShell(
    "ppd-cualificaciones",
    "Calificaciones requeridas",
    "Educación, experiencia, formación y complementos",
    cualificaciones.length,
    "edit-cualificaciones",
    "Editar calificaciones",
    `<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${groupBlocks}</div>`,
  );
}

/** Celda de nivel requerido dentro de la matriz (badge coloreado o guion si no aplica). */
function nivelMatrixCell(nivel: number | null | undefined): string {
  if (nivel == null || nivel <= 0) {
    return `<span class="ppd-matrix-empty" aria-hidden="true">—</span><span class="sr-only">No requerido</span>`;
  }
  const nv = nivelVisual(nivel);
  const label = nv.title.split("—").pop()?.trim() ?? nv.title;
  return `<span class="${nv.cls} ppd-matrix-nivel" title="${escapeHtml(nv.title)}" aria-label="Nivel ${nv.short}: ${escapeHtml(label)}">
    <span class="ppd-nivel-short" aria-hidden="true">${nv.short}</span>
    <span class="ppd-matrix-nivel-label">${escapeHtml(label)}</span>
  </span>`;
}

/** Leyenda con la escala de niveles para interpretar las celdas de la matriz. */
function renderCompetenciasLegend(maxNivel: number): string {
  const n = maxNivel > 0 ? maxNivel : 4;
  const items = Array.from({ length: n }, (_, i) => i + 1)
    .map((lvl) => {
      const nv = nivelVisual(lvl);
      const label = nv.title.split("—").pop()?.trim() ?? nv.title;
      return `<span class="ppd-matrix-legend-item"><span class="${nv.cls} ppd-matrix-legend-badge">${nv.short}</span>${escapeHtml(label)}</span>`;
    })
    .join("");
  return `<div class="ppd-matrix-legend" role="note" aria-label="Escala de niveles">${items}</div>`;
}

type CompMatrixEntry = { nombre: string; niveles: Map<number, number> };

type CompTipoGroup = {
  tipoId: number;
  tipoNombre: string;
  grupoNombre: string | null;
  categoria: string | null;
  comps: Map<number, CompMatrixEntry>;
};

function resolveCategoriaGrupo(categoria: string | null, grupoNombre: string | null): CategoriaCompetencia {
  if (categoria === "tecnica" || categoria === "blanda") return categoria;
  if (grupoNombre) return categoriaDesdeGrupoNombre(grupoNombre);
  return "blanda";
}

function renderCompetencias(porGrado: CompetenciasPorGrado[]): string {
  const maxNivel = maxNivelActivoValor();

  if (porGrado.length === 0) {
    return sectionShell(
      "ppd-competencias",
      "Competencias demostradas",
      "Nivel requerido por grado de progresión",
      0,
      "edit-competencias",
      "Editar competencias",
      emptyState(
        "Configura grados en Ajustes de perfiles antes de asignar competencias",
        canEditarPerfilPuesto() ? "Define grados de progresión y luego asigna competencias por grado." : undefined,
      ),
    );
  }

  const grados = porGrado.map((p) => p.grado);
  const colCount = grados.length + 1;

  const headCells = grados
    .map(
      (g) => `
      <th scope="col" class="ppd-matrix-col">
        <div class="ppd-matrix-col-head">
          <span class="ppd-matrix-col-name">${escapeHtml(g.nombre)}</span>
          ${gradoColEditBtn(g.id, `Editar ${g.nombre}`)}
        </div>
      </th>`,
    )
    .join("");

  // Pivote: tipo_competencia_id → competencia_id → { nombre, nivel por grado }.
  const byTipo = new Map<number, CompTipoGroup>();
  for (const { grado, competencias } of porGrado) {
    for (const c of competencias) {
      const tipoId = c.tipo_competencia_id ?? 0;
      let grupo = byTipo.get(tipoId);
      if (!grupo) {
        grupo = {
          tipoId,
          tipoNombre: c.tipo_nombre?.trim() || "Sin tipo",
          grupoNombre: c.grupo_nombre,
          categoria: c.categoria,
          comps: new Map(),
        };
        byTipo.set(tipoId, grupo);
      } else {
        if (c.tipo_nombre?.trim()) grupo.tipoNombre = c.tipo_nombre.trim();
        if (c.grupo_nombre) grupo.grupoNombre = c.grupo_nombre;
        if (c.categoria) grupo.categoria = c.categoria;
      }
      let entry = grupo.comps.get(c.competencia_id);
      if (!entry) {
        entry = { nombre: c.competencia_nombre, niveles: new Map() };
        grupo.comps.set(c.competencia_id, entry);
      } else if (c.competencia_nombre) {
        entry.nombre = c.competencia_nombre;
      }
      if (c.nivel_requerido != null && c.nivel_requerido > 0) {
        entry.niveles.set(grado.id, c.nivel_requerido);
      }
    }
  }

  const uniqueCount = Array.from(byTipo.values()).reduce((s, g) => s + g.comps.size, 0);

  if (uniqueCount === 0) {
    const emptyHint = canEditarPerfilPuesto()
      ? " Usa el lápiz en cada grado para agregar competencias del catálogo o crear nuevas."
      : "";
    const body = `
    ${renderCompetenciasLegend(maxNivel)}
    <div class="ppd-matrix-wrap">
      <table class="ppd-matrix">
        <thead>
          <tr>
            <th scope="col" class="ppd-matrix-corner">Competencia</th>
            ${headCells}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="${colCount}" class="px-4 py-8 text-center text-sm text-text-muted">
              Sin competencias asignadas.${emptyHint}
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;

    return sectionShell(
      "ppd-competencias",
      "Competencias demostradas",
      "Nivel requerido por grado de progresión",
      0,
      "",
      "",
      body,
    );
  }

  const tipos = Array.from(byTipo.values()).sort((a, b) => {
    const catA = CATEGORIA_MATRIZ_ORDER[resolveCategoriaGrupo(a.categoria, a.grupoNombre)] ?? 2;
    const catB = CATEGORIA_MATRIZ_ORDER[resolveCategoriaGrupo(b.categoria, b.grupoNombre)] ?? 2;
    if (catA !== catB) return catA - catB;
    return a.tipoNombre.localeCompare(b.tipoNombre, "es");
  });

  const bodyRows = tipos
    .map((grupo) => {
      const categoria = resolveCategoriaGrupo(grupo.categoria, grupo.grupoNombre);
      const chipCls = grupoCompetenciaBadgeClasses(categoria);
      const grupoLabel = grupo.grupoNombre
        ? `<span class="ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chipCls}">${escapeHtml(grupo.grupoNombre)}</span>`
        : "";
      const catRow = `<tr class="ppd-matrix-cat"><td colspan="${colCount}"><span class="text-xs font-semibold uppercase tracking-wide text-text-primary">${escapeHtml(grupo.tipoNombre)}</span>${grupoLabel}</td></tr>`;
      const compRows = Array.from(grupo.comps.values())
        .map((entry) => {
          const cells = grados
            .map((g) => `<td class="ppd-matrix-cell">${nivelMatrixCell(entry.niveles.get(g.id) ?? null)}</td>`)
            .join("");
          return `
          <tr class="ppd-matrix-row">
            <th scope="row" class="ppd-matrix-name" title="${escapeHtml(entry.nombre)}">${escapeHtml(entry.nombre)}</th>
            ${cells}
          </tr>`;
        })
        .join("");
      return catRow + compRows;
    })
    .join("");

  const body = `
    ${renderCompetenciasLegend(maxNivel)}
    <div class="ppd-matrix-wrap">
      <table class="ppd-matrix">
        <thead>
          <tr>
            <th scope="col" class="ppd-matrix-corner">Competencia</th>
            ${headCells}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  return sectionShell(
    "ppd-competencias",
    "Competencias demostradas",
    "Nivel requerido por grado de progresión",
    uniqueCount,
    "",
    "",
    body,
  );
}

function empleadoIniciales(nombre: string | null): string {
  if (!nombre?.trim()) return "?";
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderEmpleadosResumen(asignaciones: AsignacionResumen[], perfilId: number): string {
  if (asignaciones.length === 0) {
    return sectionShell(
      "ppd-empleados",
      "Empleados asignados",
      "Colaboradores vinculados a este perfil",
      0,
      "",
      "",
      emptyState(
        "Sin empleados asignados",
        "Cuando existan asignaciones, aparecerán aquí para consulta rápida.",
      ),
    );
  }

  const preview = asignaciones.slice(0, 6);
  const rows = preview
    .map((a) => {
      const nombre = a.nombre_empleado ? escapeHtml(a.nombre_empleado) : `Empleado #${a.empleado_id}`;
      const no =
        a.no_empleado != null
          ? escapeHtml(String(parseInt(a.no_empleado, 10) || a.no_empleado))
          : "";
      return `
      <li class="ppd-emp-row flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50/90">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-800 ring-1 ring-blue-200/70" aria-hidden="true">${escapeHtml(empleadoIniciales(a.nombre_empleado))}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-primary">${nombre}</p>
          ${no ? `<p class="text-xs tabular-nums text-text-muted">No. ${no}</p>` : ""}
        </div>
      </li>`;
    })
    .join("");

  const body = `
    <ul class="flex flex-col gap-0.5 divide-y divide-slate-100/80">${rows}</ul>
    <div class="mt-4 border-t border-slate-100 pt-4">
      <a href="#/puestos/${perfilId}/empleados" class="${RH_LISTADO_BTN_PRIMARY} w-full justify-center text-center">
        Ver todos (${asignaciones.length})
      </a>
      ${
        asignaciones.length > preview.length
          ? `<p class="mt-2 text-center text-xs text-text-muted">+${asignaciones.length - preview.length} colaborador${asignaciones.length - preview.length !== 1 ? "es" : ""} más en la lista completa</p>`
          : ""
      }
    </div>`;

  return sectionShell(
    "ppd-empleados",
    "Empleados asignados",
    "Vista previa de colaboradores",
    asignaciones.length,
    "",
    "",
    body,
  );
}

// ── Cursos asignados al puesto ─────────────────────────────────────────

function renderCursosAsignados(cursos: CursoPuestoItem[], _perfilId: number): string {
  if (cursos.length === 0) {
    return sectionShell(
      "ppd-cursos",
      "Cursos asignados",
      "Capacitaciones requeridas para este puesto",
      0,
      "add-curso",
      "Asignar curso",
      emptyState(
        "Sin cursos asignados",
        canEditarPerfilPuesto() ? "Asigna cursos del catálogo a este perfil de puesto." : undefined,
      ),
    );
  }

  const rows = cursos
    .map(
      (cp) => `
      <li class="ppd-curso-row flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2.5 group">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200/60" aria-hidden="true">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(cp.curso_nombre ?? `Curso #${cp.curso_id}`)}</p>
          <div class="flex items-center gap-2 flex-wrap">
            ${cp.obligatorio ? `<span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/70">Obligatorio</span>` : ""}
            ${cp.sesion_fecha ? `<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200/70">${escapeHtml(new Date(cp.sesion_fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }))}</span>` : ""}
          </div>
        </div>
        ${canEditarPerfilPuesto() ? `<button type="button" data-action="remove-curso" data-curso-puesto-id="${cp.id}" class="opacity-0 group-hover:opacity-100 rounded-md p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600" title="Quitar curso" aria-label="Quitar curso"><svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>` : ""}
      </li>`,
    )
    .join("");

  const body = `<ul class="flex flex-col gap-1.5">${rows}</ul>`;

  return sectionShell(
    "ppd-cursos",
    "Cursos asignados",
    `${cursos.length} curso${cursos.length !== 1 ? "s" : ""} vinculado${cursos.length !== 1 ? "s" : ""}`,
    cursos.length,
    "add-curso",
    "Asignar curso",
    body,
  );
}

// ── Mount y carga ───────────────────────────────────────────────────────

type PerfilDetalleController = {
  perfilId: number;
  reload: () => void;
  puesto: PuestoPerfilInfo | null;
  cursosList: CursoPuestoItem[];
  grados: GradoPuesto[];
  tareasModal: EditarTareasModalHandle | null;
  cualModal: EditarCualificacionesModalHandle | null;
};

const perfilDetalleControllers = new WeakMap<HTMLElement, PerfilDetalleController>();

async function openEditarCompetenciasModal(
  ctrl: PerfilDetalleController,
  host: HTMLElement | null,
  gradoId?: number,
): Promise<void> {
  if (!host) return;

  let grado = gradoId != null ? ctrl.grados.find((g) => g.id === gradoId && g.activo) : undefined;
  if (!grado) {
    grado = ctrl.grados.find((g) => g.activo) ?? ctrl.grados[0];
  }
  if (!grado) {
    showPerfilDetalleNotice(
      host,
      "Configura al menos un grado de puesto en Ajustes de perfiles → Grados en puestos antes de asignar competencias.",
    );
    return;
  }

  const modal = mountEditarCompetenciasModal(host, {
    perfilId: ctrl.perfilId,
    gradoId: grado.id,
    gradoNombre: grado.nombre,
    onSuccess: ctrl.reload,
  });
  modal.open();
}

function showPerfilDetalleNotice(host: HTMLElement, message: string): void {
  const overlayId = "perfil-detalle-notice-overlay";
  host.innerHTML = `
    <div id="${overlayId}" class="ppd-modal-backdrop ${MODAL_OVERLAY}" role="presentation">
      <div class="ppd-modal-panel ${MODAL_PANEL} max-w-md p-6" role="alertdialog" aria-modal="true" aria-labelledby="perfil-detalle-notice-title">
        <h2 id="perfil-detalle-notice-title" class="text-lg font-semibold text-text-primary">No se puede editar competencias</h2>
        <p class="mt-2 text-sm text-text-secondary">${escapeHtml(message)}</p>
        <div class="mt-6 flex justify-end">
          <button type="button" data-perfil-detalle-notice-close class="${RH_LISTADO_BTN_PRIMARY}">Entendido</button>
        </div>
      </div>
    </div>`;

  const overlay = host.querySelector(`#${overlayId}`) as HTMLElement;
  const close = () => {
    host.innerHTML = "";
    document.body.style.overflow = "";
  };
  document.body.style.overflow = "hidden";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  host.querySelector("[data-perfil-detalle-notice-close]")?.addEventListener("click", close);
}

async function handlePerfilDetalleClick(container: HTMLElement, ev: Event): Promise<void> {
  const ctrl = perfilDetalleControllers.get(container);
  if (!ctrl) return;

  const inner = container.querySelector("#perfil-detalle-inner");
  if (!inner) return;

  const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!btn) return;

  switch (btn.dataset.action) {
    case "edit-tareas":
      ctrl.tareasModal?.open();
      break;
    case "edit-cualificaciones":
      ctrl.cualModal?.open();
      break;
    case "edit-competencias": {
      const gradoId = btn.dataset.gradoId ? Number(btn.dataset.gradoId) : undefined;
      await openEditarCompetenciasModal(
        ctrl,
        inner.querySelector("#modal-host-competencias") as HTMLElement | null,
        gradoId,
      );
      break;
    }
    case "edit-base":
      if (ctrl.puesto) {
        openEditBaseModal(
          inner.querySelector("#modal-host-edit-base") as HTMLElement,
          ctrl.puesto,
          ctrl.perfilId,
          ctrl.reload,
        );
      }
      break;
    case "add-curso":
      openAsignarCursoModal(
        inner.querySelector("#modal-host-cursos") as HTMLElement,
        ctrl.perfilId,
        ctrl.cursosList,
        ctrl.reload,
      );
      break;
    case "remove-curso": {
      const cpId = Number(btn.dataset.cursoPuestoId);
      if (!cpId || !confirm("¿Quitar este curso del puesto?")) break;
      try {
        await eliminarCursoPuesto(ctrl.perfilId, cpId);
        ctrl.reload();
      } catch {
        /* noop */
      }
      break;
    }
  }
}

export function mountPerfilPuestoDetalle(container: HTMLElement, id: number): void {
  mountAppShell(container, {
    pageTitle: "Detalle del Puesto",
    activeNav: "puestos",
    mainClass: "py-5 sm:py-6",
    mainHtml: `
      <div id="perfil-detalle-root" class="flex min-h-0 flex-1 flex-col">
        <div id="perfil-detalle-inner"></div>
      </div>`,
  });

  const reload = () => loadPerfilDetalle(container, id);
  perfilDetalleControllers.set(container, {
    perfilId: id,
    reload,
    puesto: null,
    cursosList: [],
    grados: [],
    tareasModal: null,
    cualModal: null,
  });

  const root = container.querySelector("#perfil-detalle-root");
  root?.addEventListener("click", (ev) => {
    void handlePerfilDetalleClick(container, ev);
  });

  void loadPerfilDetalle(container, id);
}

async function fetchJson<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function refreshTareasEnPagina(container: HTMLElement, perfilId: number): Promise<void> {
  const inner = container.querySelector("#perfil-detalle-inner");
  if (!inner) return;

  const section = inner.querySelector("#ppd-tareas");
  if (!section) return;

  const ctrl = perfilDetalleControllers.get(container);
  const updatedAt = ctrl?.puesto?.updated_at ? formatFecha(ctrl.puesto.updated_at) : null;

  try {
    const token = getAccessToken();
    if (!token) return;
    const tareas = await fetchJson<Tarea[]>(`/api/v1/perfiles/${perfilId}/tareas`, token);
    const tareasList = tareas ?? [];

    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderTareas(tareasList, updatedAt);
    const newSection = wrapper.firstElementChild;
    if (newSection) section.replaceWith(newSection);

    const kpiValue = inner.querySelector("#ppd-kpi-tareas-value");
    if (kpiValue) kpiValue.textContent = String(tareasList.length);
  } catch {
    /* noop */
  }
}

async function loadPerfilDetalle(container: HTMLElement, perfilId: number): Promise<void> {
  const inner = container.querySelector("#perfil-detalle-inner");
  if (!inner) return;

  document.body.style.overflow = "";

  inner.innerHTML = renderLoadingSkeleton();

  const token = getAccessToken();
  if (!token) {
    inner.innerHTML = `<p class="text-sm text-red-600">No autenticado</p>`;
    return;
  }

  try {
    await ensureMetodosCalificacionCompetenciaLoaded();
    const gradosActivos = (await getGradosPuesto().catch(() => [])).filter((g) => g.activo);
    const [puesto, tareas, cualificaciones, competenciasPorGrado, asignaciones, cursosAsignados] = await Promise.all([
      fetchJson<PuestoPerfilInfo>(`/api/v1/puestos-perfil/${perfilId}`, token),
      fetchJson<Tarea[]>(`/api/v1/perfiles/${perfilId}/tareas`, token),
      getPerfilCualificaciones(perfilId).catch(() => [] as PerfilCualificacion[]),
      loadCompetenciasPorGrado(perfilId, gradosActivos),
      fetchJson<AsignacionResumen[]>(`/api/v1/perfiles/${perfilId}/asignaciones`, token),
      getCursosPuesto(perfilId).catch(() => [] as CursoPuestoItem[]),
    ]);

    if (!puesto) {
      inner.innerHTML = `<div class="${RH_LISTADO_PAGE_OUTER}"><p class="text-sm text-red-600">Perfil no encontrado (ID: ${perfilId})</p></div>`;
      return;
    }

    const tareasList = tareas ?? [];
    const cualifList = cualificaciones ?? [];
    const compList = competenciasPorGrado.flatMap((g) => g.competencias);
    const asigList = asignaciones ?? [];
    const cursosList = cursosAsignados ?? [];
    const empleadosCount = asigList.length;
    const fechaActualizacion = formatFecha(puesto.updated_at);
    const summary = computeExecutiveSummary(tareasList, cualifList, compList, empleadosCount);

    inner.innerHTML = `
      <div class="${RH_LISTADO_PAGE_OUTER} ppd-page">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <a href="#/puestos" class="ppd-back-link inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40" aria-label="Volver a Perfiles de Puesto">
            ${ICON_BACK}
            Volver
          </a>
          <nav class="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-text-muted" aria-label="Breadcrumb">
            <a href="#/puestos" class="font-medium transition hover:text-leoni-blue">Perfiles de Puesto</a>
            <svg class="size-3 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
            <span class="truncate font-semibold text-text-primary">${escapeHtml(puesto.codigo)} · ${escapeHtml(puesto.nombre)}</span>
          </nav>
        </div>

        ${renderHeader(puesto, empleadosCount, perfilId)}
        ${renderExecutiveSummary(summary)}

        <div class="ppd-layout grid gap-4 lg:grid-cols-2 lg:items-start xl:gap-5">
          <div class="flex flex-col gap-4 sm:gap-5">
            ${renderTareas(tareasList, fechaActualizacion)}
            ${renderCualificaciones(cualifList)}
          </div>
          <div class="flex flex-col gap-4 sm:gap-5">
            ${renderCursosAsignados(cursosList, perfilId)}
            ${renderEmpleadosResumen(asigList, perfilId)}
          </div>
        </div>

        ${renderCompetencias(competenciasPorGrado)}

        <div id="modal-host-tareas"></div>
        <div id="modal-host-cualificaciones"></div>
        <div id="modal-host-competencias"></div>
        <div id="modal-host-edit-base"></div>
        <div id="modal-host-cursos"></div>
      </div>`;

    const contentEl = inner;
    const ctrl = perfilDetalleControllers.get(container);

    if (ctrl) {
      ctrl.puesto = puesto;
      ctrl.cursosList = cursosList;
      ctrl.grados = gradosActivos;
    }

    if (canEditarPerfilPuesto() && ctrl) {
      const reload = ctrl.reload;

      const tareasHost = contentEl.querySelector("#modal-host-tareas") as HTMLElement;
      ctrl.tareasModal = mountEditarTareasModal(tareasHost, {
        perfilId,
        onSuccess: () => void refreshTareasEnPagina(container, perfilId),
      });

      const cualHost = contentEl.querySelector("#modal-host-cualificaciones") as HTMLElement;
      ctrl.cualModal = mountEditarCualificacionesModal(cualHost, { perfilId, onSuccess: reload });
    }
  } catch {
    inner.innerHTML = `
      <div class="${RH_LISTADO_PAGE_OUTER}">
        <div class="rounded-2xl border border-red-200/80 bg-red-50/80 px-6 py-8 text-center" role="alert">
          <p class="text-sm font-semibold text-red-900">Error de conexión al cargar el perfil</p>
        </div>
      </div>`;
  }
}

// ── Modal asignar curso al puesto ─────────────────────────────────────────

function openAsignarCursoModal(
  host: HTMLElement,
  perfilId: number,
  existingCursos: CursoPuestoItem[],
  onSuccess: () => void,
): void {
  const overlayId = "add-curso-overlay";
  const assignedIds = new Set(existingCursos.map((c) => c.curso_id));

  host.innerHTML = `
    <div id="${overlayId}" class="ppd-modal-backdrop ${MODAL_OVERLAY}" role="presentation">
      <div class="ppd-modal-panel ${MODAL_PANEL} max-w-md" role="dialog" aria-modal="true" aria-labelledby="add-curso-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-curso-title" class="text-lg font-semibold text-text-primary">Asignar curso</h2>
              <p class="mt-1 text-sm text-text-muted">Busca y selecciona un curso del catálogo.</p>
            </div>
            <button type="button" id="add-curso-close" class="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-leoni-blue/40" aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <p id="add-curso-error" class="mx-6 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="${RH_LISTADO_LABEL}">Buscar curso</label>
            <input id="add-curso-search" type="text" placeholder="Escribe para buscar..."
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
          </div>
          <div id="add-curso-results" class="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50">
            <p class="px-3 py-4 text-center text-xs text-text-muted">Escribe para buscar cursos</p>
          </div>
          <div id="add-curso-sesiones" class="hidden">
            <label class="${RH_LISTADO_LABEL}">Sesión</label>
            <div class="relative mt-1 grid grid-cols-1">
              <select id="add-curso-sesion-select" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS}">
                <option value="">Sin sesión (asignar directo)</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input id="add-curso-obligatorio" type="checkbox" class="rounded border-slate-300" />
            <label for="add-curso-obligatorio" class="text-sm text-text-secondary">Marcar como obligatorio</label>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" id="add-curso-cancel" class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="button" id="add-curso-submit" disabled class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto disabled:opacity-50">Asignar</button>
          </div>
        </div>
      </div>
    </div>`;

  const overlay = host.querySelector(`#${overlayId}`) as HTMLElement;
  const searchInput = host.querySelector("#add-curso-search") as HTMLInputElement;
  const resultsDiv = host.querySelector("#add-curso-results") as HTMLElement;
  const submitBtn = host.querySelector("#add-curso-submit") as HTMLButtonElement;
  const obligatorioCheck = host.querySelector("#add-curso-obligatorio") as HTMLInputElement;
  const errorEl = host.querySelector("#add-curso-error") as HTMLElement;

  let selectedCursoId: number | null = null;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function close() {
    host.innerHTML = "";
    document.body.style.overflow = "";
  }

  document.body.style.overflow = "hidden";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.querySelector("#add-curso-close")!.addEventListener("click", close);
  host.querySelector("#add-curso-cancel")!.addEventListener("click", close);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
  };
  document.addEventListener("keydown", escHandler);

  searchInput.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      resultsDiv.innerHTML = `<p class="px-3 py-4 text-center text-xs text-text-muted">Escribe al menos 2 caracteres</p>`;
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        const resp = await getCursos({ busqueda: q, page_size: 20 });
        const available = resp.items.filter((c) => c.activo && !assignedIds.has(c.id));
        if (available.length === 0) {
          resultsDiv.innerHTML = `<p class="px-3 py-4 text-center text-xs text-text-muted">Sin resultados</p>`;
          return;
        }
        resultsDiv.innerHTML = available
          .map(
            (c) => `
            <button type="button" data-curso-id="${c.id}" class="add-curso-option flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-blue-50 ${selectedCursoId === c.id ? "bg-blue-50 font-semibold text-blue-800" : "text-text-primary"}">
              <span class="truncate flex-1">${escapeHtml(c.nombre)}</span>
              ${c.obligatorio ? `<span class="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200/70">Oblig.</span>` : ""}
            </button>`,
          )
          .join("");
      } catch {
        resultsDiv.innerHTML = `<p class="px-3 py-4 text-center text-xs text-red-600">Error al buscar</p>`;
      }
    }, 300);
  });

  const sesionesDiv = host.querySelector("#add-curso-sesiones") as HTMLElement;
  const sesionSelect = host.querySelector("#add-curso-sesion-select") as HTMLSelectElement;

  resultsDiv.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-curso-id]");
    if (!btn) return;
    selectedCursoId = Number(btn.dataset.cursoId);
    submitBtn.disabled = false;
    resultsDiv.querySelectorAll(".add-curso-option").forEach((el) => {
      el.classList.remove("bg-blue-50", "font-semibold", "text-blue-800");
      el.classList.add("text-text-primary");
    });
    btn.classList.add("bg-blue-50", "font-semibold", "text-blue-800");
    btn.classList.remove("text-text-primary");

    // Fetch sessions for selected curso
    try {
      const resp = await getCursoSesiones(selectedCursoId);
      const activas = resp.items.filter(s => s.estado === "programada" || s.estado === "en_curso");
      if (activas.length > 0) {
        sesionSelect.innerHTML = `<option value="">Sin sesión (asignar directo)</option>` +
          activas.map(s => {
            const f = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
            const h = s.hora_inicio ? ` ${s.hora_inicio.slice(0, 5)}` : "";
            const cap = s.cupo_max ? ` (${s.inscritos_count}/${s.cupo_max})` : "";
            return `<option value="${s.id}">${f}${h}${cap}${s.ubicacion ? " — " + s.ubicacion : ""}</option>`;
          }).join("");
        sesionesDiv.classList.remove("hidden");
      } else {
        sesionesDiv.classList.add("hidden");
        sesionSelect.innerHTML = `<option value="">Sin sesión (asignar directo)</option>`;
      }
    } catch {
      sesionesDiv.classList.add("hidden");
    }
  });

  submitBtn.addEventListener("click", async () => {
    if (!selectedCursoId) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Asignando...";
    const sesionId = sesionSelect.value ? Number(sesionSelect.value) : null;
    try {
      await asignarCursoPuesto(perfilId, selectedCursoId, obligatorioCheck.checked, sesionId);
      close();
      document.removeEventListener("keydown", escHandler);
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail ?? "Error al asignar.";
      errorEl.textContent = detail;
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Asignar";
    }
  });

  searchInput.focus();
}

// ── Modal editar datos base (misma lógica) ────────────────────────────────

function openEditBaseModal(
  host: HTMLElement,
  puesto: PuestoPerfilInfo,
  perfilId: number,
  onSuccess: () => void,
): void {
  const overlayId = "edit-base-overlay";

  host.innerHTML = `
    <div id="${overlayId}" class="ppd-modal-backdrop ${MODAL_OVERLAY}" role="presentation">
      <div class="ppd-modal-panel ${MODAL_PANEL} max-w-md" role="dialog" aria-modal="true" aria-labelledby="edit-base-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 id="edit-base-title" class="text-lg font-semibold text-text-primary">Editar perfil</h2>
              <p class="mt-1 text-sm text-text-muted">Nombre y nivel organizacional del puesto.</p>
            </div>
            <button type="button" id="edit-base-close" class="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-leoni-blue/40" aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <p id="edit-base-error" class="mx-6 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
        <form id="form-edit-base" class="space-y-4 px-6 py-5">
          <div>
            <label for="eb-nombre" class="${RH_LISTADO_LABEL}">Nombre del puesto</label>
            <input id="eb-nombre" name="nombre_puesto" type="text" required value="${escapeHtml(puesto.nombre)}"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
          </div>
          <div>
            <label for="eb-nivel" class="${RH_LISTADO_LABEL}">Nivel</label>
            <input id="eb-nivel" name="nivel" type="text" value="${safeText(puesto.nivel_nombre, "")}"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" id="edit-base-cancel" class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="submit" id="edit-base-submit" class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto">Guardar</button>
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
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  host.querySelector("#edit-base-close")!.addEventListener("click", close);
  host.querySelector("#edit-base-cancel")!.addEventListener("click", close);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const nombre_puesto = String(fd.get("nombre_puesto") ?? "").trim();

    if (!nombre_puesto) {
      errorEl.textContent = "El nombre es requerido.";
      errorEl.classList.remove("hidden");
      return;
    }

    const submitBtn = host.querySelector("#edit-base-submit") as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";

    try {
      await updatePerfil(perfilId, { nombre_puesto });
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
