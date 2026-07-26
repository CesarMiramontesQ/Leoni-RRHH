/**
 * Página de empleado del módulo Ciclo de Desempeño (`#/talento/mi-desempeno`):
 * solo lectura de la calificación de desempeño propia por ciclo CERRADO
 * (cumplimiento de metas, 360 normalizada, calificación final, banda).
 *
 * `GET /mis-resultados` (self-service, sin permiso de módulo) solo devuelve
 * ciclos cerrados — `app/services/ciclo_desempeno_service.py:mis_resultados` —
 * y excluye a propósito potencial/banda_potencial/segmento_9box
 * (`MisResultadoResponse`, información sensible de gestión de talento que RH
 * decide si/cuándo exponer). Mismo patrón de página que `pages/misMetas.ts`.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { errorState, pageHeading, RH_LISTADO_PAGE_OUTER_GRADIENT, RH_LISTADO_SURFACE, skeletonBlock } from "../ui/uiTokens.ts";
import { talentoEyebrow } from "../talento/pageKit.ts";
import { bandaBadge, fmtScore, renderEmptyState } from "../cicloDesempeno/shared.ts";
import { getMisResultadosDesempeno, type MisResultadoResponse } from "../api/cicloDesempeno.ts";

interface State {
  resultados: MisResultadoResponse[] | null;
  loading: boolean;
  error: string | null;
}

let mountAbort: AbortController | null = null;

export function mountMisDesempeno(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  const state: State = {
    resultados: null,
    loading: true,
    error: null,
  };

  async function loadResultados(): Promise<void> {
    state.loading = true;
    render();
    try {
      state.resultados = await getMisResultadosDesempeno();
      state.error = null;
    } catch (err: unknown) {
      state.error = (err as Error)?.message ?? "No se pudieron cargar tus resultados";
    }
    state.loading = false;
    render();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderResultadoCard(r: MisResultadoResponse): string {
    return `
    <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <p class="font-semibold text-text-primary">${escapeHtml(r.ciclo_nombre ?? `Ciclo #${r.ciclo_id}`)}</p>
        ${bandaBadge(r.banda_desempeno)}
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-slate-100 px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Calificación de desempeño</p>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${fmtScore(r.calificacion_desempeno)}</p>
        </div>
        <div class="rounded-lg border border-slate-100 px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Cumplimiento de metas</p>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${fmtScore(r.cumplimiento_metas)}</p>
        </div>
        <div class="rounded-lg border border-slate-100 px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Evaluación 360° (normalizada)</p>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${fmtScore(r.calificacion_360_norm)}</p>
        </div>
      </div>
    </article>`;
  }

  function renderResultados(): string {
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando…" });
    }
    if (state.error) {
      return errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="reload"' });
    }
    const resultados = state.resultados ?? [];
    if (resultados.length === 0) {
      return renderEmptyState({
        title: "Aún no tienes resultados de desempeño",
        subtitle: "Cuando RH cierre un ciclo de desempeño, tu calificación aparecerá aquí.",
      });
    }
    return `<div class="flex flex-col gap-3">${resultados.map(renderResultadoCard).join("")}</div>`;
  }

  function renderPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="flex flex-col gap-2">
        ${talentoEyebrow()}
        ${pageHeading("Mi desempeño", "Tu calificación de desempeño por ciclo cerrado: cumplimiento de metas, evaluación 360° y banda final.")}
      </div>
      ${renderResultados()}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Mi desempeño",
      activeNav: "mi-desempeno",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  // ── Delegación de eventos ─────────────────────────────────────────────────

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    if (actionEl.dataset.action === "reload") {
      void loadResultados();
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal: mountSignal });

  void loadResultados();
}
