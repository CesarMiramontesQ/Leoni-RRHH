/**
 * Página de empleado del módulo Metas (`#/talento/mis-metas`): metas
 * individuales asignadas por ciclo, formulario de check-in por resultado
 * clave (avance en vivo con `avanceRcCliente`) y calificación al cierre.
 *
 * Nota de alcance: `GET /mis-metas` no expone el nombre/vigencia del ciclo
 * (solo `ciclo_id`, ver app/schemas/metas.py:MetaResponse) ni un endpoint de
 * historial de check-ins por resultado clave — el backend solo devuelve el
 * check-in recién creado (`CheckinResponse`). Por eso las metas se agrupan
 * por "Ciclo #{id}" y el "historial" mostrado es solo de los check-ins
 * hechos en esta sesión (no un historial persistente del servidor).
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertInfo,
  alertSuccess,
  BTN_PRIMARY,
  errorState,
  FIELD_INPUT,
  pageHeading,
  renderTabNav,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { talentoEyebrow } from "../talento/pageKit.ts";
import {
  avanceBar,
  avanceRcCliente,
  DIRECCION_LABELS,
  estadoMetaBadge,
  renderEmptyState,
  TIPO_METRICA_LABELS,
} from "../metas/shared.ts";
import {
  getMiMeta,
  getMisMetas,
  miCheckin,
  type CheckinResponse,
  type MetaResponse,
  type ResultadoClaveResponse,
} from "../api/metas.ts";

type Tab = "activas" | "cerradas";

interface State {
  metas: MetaResponse[] | null;
  loading: boolean;
  error: string | null;
  tab: Tab;
  successMessage: string | null;

  checkinValores: Record<number, string>;
  checkinNotas: Record<number, string>;
  checkinSaving: Record<number, boolean>;
  checkinError: Record<number, string | null>;
  /** Check-ins registrados EN ESTA SESIÓN (no un historial persistente — ver nota de alcance arriba). */
  checkinHistorial: Record<number, CheckinResponse[]>;
}

let mountAbort: AbortController | null = null;

export function mountMisMetas(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  const state: State = {
    metas: null,
    loading: true,
    error: null,
    tab: "activas",
    successMessage: null,

    checkinValores: {},
    checkinNotas: {},
    checkinSaving: {},
    checkinError: {},
    checkinHistorial: {},
  };

  async function loadMetas(): Promise<void> {
    state.loading = true;
    render();
    try {
      state.metas = await getMisMetas();
      state.error = null;
    } catch (err: unknown) {
      state.error = (err as Error)?.message ?? "No se pudieron cargar tus metas";
    }
    state.loading = false;
    render();
  }

  function findRc(rcId: number): ResultadoClaveResponse | undefined {
    for (const m of state.metas ?? []) {
      const found = m.resultados_clave.find((rc) => rc.id === rcId);
      if (found) return found;
    }
    return undefined;
  }

  function findMetaIdByRc(rcId: number): number | null {
    for (const m of state.metas ?? []) {
      if (m.resultados_clave.some((rc) => rc.id === rcId)) return m.id;
    }
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderRcCard(rc: ResultadoClaveResponse, editable: boolean): string {
    const valor = state.checkinValores[rc.id] ?? "";
    const nota = state.checkinNotas[rc.id] ?? "";
    const saving = state.checkinSaving[rc.id] ?? false;
    const error = state.checkinError[rc.id];
    const historial = state.checkinHistorial[rc.id] ?? [];
    const preview =
      valor.trim() !== "" && Number.isFinite(Number(valor))
        ? `${avanceRcCliente({
            tipo_metrica: rc.tipo_metrica,
            direccion: rc.direccion,
            valor_inicial: rc.valor_inicial,
            valor_objetivo: rc.valor_objetivo,
            valor_actual: Number(valor),
          })}%`
        : "";
    return `
    <div class="rounded-lg border border-slate-200 p-3">
      <p class="text-sm font-semibold text-text-primary">${escapeHtml(rc.titulo)}</p>
      <p class="text-xs text-text-muted">${TIPO_METRICA_LABELS[rc.tipo_metrica]}${rc.tipo_metrica !== "booleano" ? ` · ${DIRECCION_LABELS[rc.direccion]}` : ""}${rc.unidad ? ` · ${escapeHtml(rc.unidad)}` : ""}</p>
      <p class="mt-1 text-xs tabular-nums text-text-muted">Inicial ${rc.valor_inicial} → Objetivo ${rc.valor_objetivo} · Actual ${rc.valor_actual}</p>
      <div class="mt-2">${avanceBar(rc.avance, { compact: true })}</div>
      ${
        editable
          ? `<div class="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
              <div class="flex-1">
                <label class="text-[11px] text-text-muted" for="rc-valor-${rc.id}">Nuevo valor</label>
                <div class="flex items-center gap-2">
                  <input id="rc-valor-${rc.id}" type="number" step="any" data-checkin-valor="${rc.id}" value="${escapeHtml(valor)}" class="${FIELD_INPUT}" />
                  <span class="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-text-secondary" data-rc-preview="${rc.id}">${preview}</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="text-[11px] text-text-muted" for="rc-nota-${rc.id}">Nota de check-in (opcional)</label>
                <input id="rc-nota-${rc.id}" type="text" data-checkin-nota="${rc.id}" value="${escapeHtml(nota)}" class="${FIELD_INPUT}" />
              </div>
              <button type="button" data-action="checkin-guardar" data-id="${rc.id}" class="${BTN_PRIMARY} shrink-0" ${saving ? "disabled" : ""}>${saving ? "Guardando…" : "Registrar avance"}</button>
            </div>
            ${error ? `<p class="mt-1 text-xs text-red-700">${escapeHtml(error)}</p>` : ""}`
          : ""
      }
      ${
        historial.length > 0
          ? `<div class="mt-3 border-t border-slate-100 pt-2">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Check-ins de esta sesión</p>
              <ul class="mt-1 flex flex-col gap-1">
                ${historial
                  .map(
                    (c) =>
                      `<li class="text-xs text-text-secondary">Valor <span class="font-semibold tabular-nums">${c.valor_registrado}</span> (${c.avance_resultante}%)${c.nota ? ` — ${escapeHtml(c.nota)}` : ""}</li>`,
                  )
                  .join("")}
              </ul>
            </div>`
          : ""
      }
    </div>`;
  }

  function renderMetaCard(m: MetaResponse): string {
    const editable = m.estado !== "cerrada";
    return `
    <article class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="font-semibold text-text-primary">${escapeHtml(m.titulo)}</p>
          ${m.descripcion ? `<p class="mt-0.5 text-sm text-text-muted">${escapeHtml(m.descripcion)}</p>` : ""}
        </div>
        <div class="flex shrink-0 items-center gap-2">${estadoMetaBadge(m.estado)}</div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <span class="shrink-0 text-xs font-medium text-text-muted">Peso ${m.peso}%</span>
        <div class="flex-1">${avanceBar(m.avance)}</div>
      </div>
      ${
        m.estado === "cerrada"
          ? `<div class="mt-3">${alertInfo(`Calificación de cierre: ${m.calificacion_cierre ?? "—"}${m.comentario_cierre ? ` · ${m.comentario_cierre}` : ""}`)}</div>`
          : ""
      }
      <div class="mt-4 flex flex-col gap-3">
        ${
          m.resultados_clave.length === 0
            ? `<p class="text-xs text-text-muted">Esta meta no tiene resultados clave definidos.</p>`
            : m.resultados_clave.map((rc) => renderRcCard(rc, editable)).join("")
        }
      </div>
    </article>`;
  }

  function renderMetasList(): string {
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando…" });
    }
    if (state.error) {
      return errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="reload"' });
    }
    const filtered = (state.metas ?? []).filter((m) => (state.tab === "activas" ? m.estado !== "cerrada" : m.estado === "cerrada"));
    if (filtered.length === 0) {
      return state.tab === "activas"
        ? renderEmptyState({ title: "No tienes metas activas", subtitle: "Cuando tu jefe o RH te asigne una meta, aparecerá aquí." })
        : renderEmptyState({ title: "Aún no tienes metas cerradas", subtitle: "Las metas calificadas al cierre del ciclo aparecerán aquí." });
    }
    const ciclosIds = Array.from(new Set(filtered.map((m) => m.ciclo_id))).sort((a, b) => b - a);
    return `<div class="flex flex-col gap-5">
      ${ciclosIds
        .map(
          (cid) => `
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Ciclo #${cid}</p>
          <div class="flex flex-col gap-3">${filtered.filter((m) => m.ciclo_id === cid).map(renderMetaCard).join("")}</div>
        </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderTabs(): string {
    const activas = (state.metas ?? []).filter((m) => m.estado !== "cerrada").length;
    const cerradas = (state.metas ?? []).filter((m) => m.estado === "cerrada").length;
    return `<div data-tabs="mis-metas">
      ${renderTabNav(
        [
          { id: "activas", label: "Activas", badge: `(${activas})` },
          { id: "cerradas", label: "Cerradas", badge: `(${cerradas})` },
        ],
        state.tab,
        { ariaLabel: "Mis metas" },
      )}
    </div>`;
  }

  function renderPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="flex flex-col gap-2">
        ${talentoEyebrow()}
        ${pageHeading("Mis metas", "Objetivos asignados y seguimiento de tus resultados clave.")}
      </div>
      ${state.successMessage ? alertSuccess(state.successMessage) : ""}
      ${renderTabs()}
      ${renderMetasList()}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Mis metas",
      activeNav: "mis-metas",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  function updateCheckinPreview(rcId: number, valorStr: string): void {
    const rc = findRc(rcId);
    const span = container.querySelector<HTMLElement>(`[data-rc-preview="${rcId}"]`);
    if (!rc || !span) return;
    if (valorStr.trim() === "") {
      span.textContent = "";
      return;
    }
    const valor = Number(valorStr);
    if (!Number.isFinite(valor)) {
      span.textContent = "";
      return;
    }
    const pct = avanceRcCliente({
      tipo_metrica: rc.tipo_metrica,
      direccion: rc.direccion,
      valor_inicial: rc.valor_inicial,
      valor_objetivo: rc.valor_objetivo,
      valor_actual: valor,
    });
    span.textContent = `${pct}%`;
  }

  async function onGuardarCheckin(rcId: number): Promise<void> {
    const valorStr = state.checkinValores[rcId] ?? "";
    const valor = Number(valorStr);
    if (valorStr.trim() === "" || !Number.isFinite(valor)) {
      state.checkinError[rcId] = "Ingresa un valor numérico";
      render();
      return;
    }
    state.checkinSaving[rcId] = true;
    state.checkinError[rcId] = null;
    render();
    try {
      const nota = (state.checkinNotas[rcId] ?? "").trim() || null;
      const resultado = await miCheckin(rcId, { valor, nota });
      state.checkinHistorial[rcId] = [resultado, ...(state.checkinHistorial[rcId] ?? [])];
      delete state.checkinValores[rcId];
      delete state.checkinNotas[rcId];
      state.checkinSaving[rcId] = false;
      state.successMessage = "Avance registrado.";
      const metaId = findMetaIdByRc(rcId);
      if (metaId != null) {
        const refreshed = await getMiMeta(metaId);
        state.metas = (state.metas ?? []).map((m) => (m.id === refreshed.id ? refreshed : m));
      }
      render();
    } catch (err: unknown) {
      state.checkinSaving[rcId] = false;
      state.checkinError[rcId] = (err as Error)?.message ?? "No se pudo registrar tu avance";
      render();
    }
  }

  // ── Delegación de eventos ─────────────────────────────────────────────────────

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;

    const tabEl = t.closest<HTMLElement>('[role="tab"][data-tab]');
    if (tabEl) {
      const group = tabEl.closest<HTMLElement>("[data-tabs]")?.dataset.tabs;
      const tabId = tabEl.dataset.tab;
      if (group === "mis-metas" && (tabId === "activas" || tabId === "cerradas")) {
        state.tab = tabId;
        render();
      }
      return;
    }

    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "reload") {
      void loadMetas();
      return;
    }
    if (action === "checkin-guardar") {
      const id = Number(actionEl.dataset.id);
      if (id) void onGuardarCheckin(id);
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    const valorRcId = t.dataset.checkinValor;
    if (valorRcId != null) {
      const rcId = Number(valorRcId);
      state.checkinValores[rcId] = t.value;
      updateCheckinPreview(rcId, t.value);
      return;
    }
    const notaRcId = t.dataset.checkinNota;
    if (notaRcId != null) {
      state.checkinNotas[Number(notaRcId)] = t.value;
      return;
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal: mountSignal });
  container.addEventListener("input", handleInput, { signal: mountSignal });

  void loadMetas();
}
