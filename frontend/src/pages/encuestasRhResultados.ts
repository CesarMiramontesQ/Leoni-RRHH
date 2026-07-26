import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertWarning,
  BTN_PRIMARY,
  errorState,
  FORM_LABEL,
  FORM_SELECT,
  pageHeading,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { talentoEyebrow } from "../talento/pageKit.ts";
import { estadoBadge, renderEmptyState } from "../encuestasRh/shared.ts";
import {
  descargarResultadosExcel,
  getEncuesta,
  getResultadosGlobales,
  getResultadosSegmentos,
  getResultadosTextos,
  type EncuestaResponse,
  type ResultadoPregunta,
  type ResultadosGlobal,
  type ResultadosSegmentos,
  type SegmentoDimension,
  type TextosResponse,
} from "../api/encuestasRh.ts";

const DIMENSIONES: { value: SegmentoDimension; label: string }[] = [
  { value: "area", label: "Área" },
  { value: "turno", label: "Turno" },
  { value: "clasificacion", label: "Clasificación" },
];

function slugFilename(titulo: string): string {
  const slug = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `resultados_encuesta_${slug || "encuesta"}.xlsx`;
}

interface State {
  detalle: EncuestaResponse | null;
  detalleLoading: boolean;
  detalleError: string | null;

  resultados: ResultadosGlobal | null;
  resultadosLoading: boolean;
  resultadosError: string | null;

  dimension: SegmentoDimension;
  segmentos: ResultadosSegmentos | null;
  segmentosLoading: boolean;
  segmentosError: string | null;

  preguntaTextoId: number | null;
  textos: TextosResponse | null;
  textosLoading: boolean;
  textosError: string | null;

  exportando: boolean;
  exportError: string | null;
}

let mountAbort: AbortController | null = null;

export function mountEncuestasRhResultados(container: HTMLElement, encuestaId: number, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  const state: State = {
    detalle: null,
    detalleLoading: true,
    detalleError: null,

    resultados: null,
    resultadosLoading: true,
    resultadosError: null,

    dimension: "area",
    segmentos: null,
    segmentosLoading: false,
    segmentosError: null,

    preguntaTextoId: null,
    textos: null,
    textosLoading: false,
    textosError: null,

    exportando: false,
    exportError: null,
  };

  async function loadDetalle(): Promise<void> {
    state.detalleLoading = true;
    render();
    try {
      state.detalle = await getEncuesta(encuestaId);
      state.detalleError = null;
      const primeraTexto = state.detalle.preguntas.find((p) => p.tipo === "texto");
      if (primeraTexto) {
        state.preguntaTextoId = primeraTexto.id;
      }
    } catch (err: unknown) {
      state.detalleError = (err as Error)?.message ?? "No se pudo cargar la encuesta";
    }
    state.detalleLoading = false;
    render();
    if (state.preguntaTextoId != null) void loadTextos(state.preguntaTextoId);
  }

  async function loadResultados(): Promise<void> {
    state.resultadosLoading = true;
    render();
    try {
      state.resultados = await getResultadosGlobales(encuestaId);
      state.resultadosError = null;
    } catch (err: unknown) {
      state.resultadosError = (err as Error)?.message ?? "No se pudieron cargar los resultados";
    }
    state.resultadosLoading = false;
    render();
  }

  async function loadSegmentos(): Promise<void> {
    state.segmentosLoading = true;
    render();
    try {
      state.segmentos = await getResultadosSegmentos(encuestaId, state.dimension);
      state.segmentosError = null;
    } catch (err: unknown) {
      state.segmentosError = (err as Error)?.message ?? "No se pudieron cargar los resultados por segmento";
    }
    state.segmentosLoading = false;
    render();
  }

  async function loadTextos(preguntaId: number): Promise<void> {
    state.textosLoading = true;
    render();
    try {
      state.textos = await getResultadosTextos(encuestaId, preguntaId);
      state.textosError = null;
    } catch (err: unknown) {
      state.textosError = (err as Error)?.message ?? "No se pudieron cargar las respuestas de texto";
    }
    state.textosLoading = false;
    render();
  }

  // ── Render: resumen global ────────────────────────────────────────────────────

  function renderResumen(res: ResultadosGlobal): string {
    const stats: { label: string; value: string }[] = [
      { label: "Respuestas (n)", value: String(res.n) },
      { label: "Participantes", value: String(res.total_participantes) },
      { label: "Tasa de respuesta", value: `${res.tasa_respuesta}%` },
    ];
    return `
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <article class="${RH_LISTADO_SURFACE} flex flex-col gap-2 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Estado</p>
        <div>${estadoBadge(res.estado)}</div>
      </article>
      ${stats
        .map(
          (s) => `
        <article class="${RH_LISTADO_SURFACE} flex flex-col gap-1 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(s.label)}</p>
          <p class="text-2xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(s.value)}</p>
        </article>`,
        )
        .join("")}
    </section>`;
  }

  // ── Render: barras (% del total de respuestas de la pregunta) ────────────────

  function renderLikertBars(p: ResultadoPregunta): string {
    const total = p.distribucion.reduce((s, d) => s + d.conteo, 0) || p.n || 0;
    const rows = p.distribucion
      .map((d) => {
        const pct = total > 0 ? Math.round((d.conteo / total) * 100) : 0;
        return `
        <div class="flex items-center gap-2">
          <span class="w-4 shrink-0 text-xs font-semibold tabular-nums text-text-muted" aria-hidden="true">${d.valor}</span>
          <div class="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-accent"
              style="width:${pct}%"
              role="img"
              aria-label="Nivel ${d.valor} de 5: ${d.conteo} respuesta(s), ${pct}% del total"
            ></div>
          </div>
          <span class="w-20 shrink-0 text-right text-xs tabular-nums text-text-muted">${d.conteo} · ${pct}%</span>
        </div>`;
      })
      .join("");
    return `
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2 text-[11px] text-text-muted">
        <span>${p.promedio != null ? `Promedio: <span class="font-semibold tabular-nums text-text-primary">${p.promedio}</span> / 5` : "Sin promedio"}</span>
        <span>Escala 1 (mínimo) – 5 (máximo)</span>
      </div>
      ${rows}
    </div>`;
  }

  function renderOpcionesBars(p: ResultadoPregunta): string {
    const total = p.opciones.reduce((s, o) => s + o.conteo, 0) || p.n || 0;
    const rows = p.opciones
      .map((o) => {
        const pct = total > 0 ? Math.round((o.conteo / total) * 100) : 0;
        return `
        <div class="flex flex-col gap-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xs text-text-secondary" title="${escapeHtml(o.texto)}">${escapeHtml(o.texto)}</span>
            <span class="shrink-0 text-xs tabular-nums text-text-muted">${o.conteo} · ${pct}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-accent"
              style="width:${pct}%"
              role="img"
              aria-label="${escapeHtml(o.texto)}: ${o.conteo} respuesta(s), ${pct}% del total"
            ></div>
          </div>
        </div>`;
      })
      .join("");
    return `<div class="flex flex-col gap-3">${rows}</div>`;
  }

  function renderPreguntaCard(p: ResultadoPregunta): string {
    const body =
      p.tipo === "likert" ? renderLikertBars(p)
      : p.tipo === "opcion_multiple" ? renderOpcionesBars(p)
      : `<p class="text-sm text-text-muted">${p.n} respuesta(s) de texto. Consulta el detalle en la sección "Respuestas abiertas".</p>`;
    return `
    <article class="${RH_LISTADO_SURFACE} p-4">
      <p class="text-sm font-semibold text-text-primary">${escapeHtml(p.texto)}</p>
      <p class="mt-0.5 text-xs text-text-muted">n = ${p.n}</p>
      <div class="mt-3">${body}</div>
    </article>`;
  }

  function renderPreguntasSection(res: ResultadosGlobal): string {
    if (res.oculto_global) {
      return alertWarning(`Aún no hay respuestas suficientes para mostrar resultados (mínimo ${res.umbral_minimo_respuestas}).`);
    }
    if (res.preguntas.length === 0) {
      return renderEmptyState({ title: "Esta encuesta no tiene preguntas." });
    }
    return `<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">${res.preguntas.map(renderPreguntaCard).join("")}</div>`;
  }

  // ── Render: segmentos ─────────────────────────────────────────────────────────

  function renderSegmentoMetricRow(p: ResultadoPregunta): string {
    if (p.tipo === "likert") {
      const pct = p.promedio != null ? Math.round((p.promedio / 5) * 100) : 0;
      return `
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-xs text-text-secondary" title="${escapeHtml(p.texto)}">${escapeHtml(p.texto)}</span>
          <span class="shrink-0 text-xs font-semibold tabular-nums text-text-primary">${p.promedio != null ? `${p.promedio}/5` : "—"}</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-accent" style="width:${pct}%"></div>
        </div>
      </div>`;
    }
    if (p.tipo === "opcion_multiple") {
      const total = p.opciones.reduce((s, o) => s + o.conteo, 0);
      const top = [...p.opciones].sort((a, b) => b.conteo - a.conteo)[0];
      const pct = top && total > 0 ? Math.round((top.conteo / total) * 100) : 0;
      return `
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-xs text-text-secondary" title="${escapeHtml(p.texto)}">${escapeHtml(p.texto)}</span>
          <span class="shrink-0 text-xs font-semibold tabular-nums text-text-primary">${top ? `${pct}%` : "—"}</span>
        </div>
        ${top ? `<p class="truncate text-[11px] text-text-muted" title="${escapeHtml(top.texto)}">${escapeHtml(top.texto)}</p>` : ""}
        <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-accent" style="width:${pct}%"></div>
        </div>
      </div>`;
    }
    return `
    <div class="flex items-center justify-between gap-2">
      <span class="truncate text-xs text-text-secondary" title="${escapeHtml(p.texto)}">${escapeHtml(p.texto)}</span>
      <span class="shrink-0 text-xs font-semibold tabular-nums text-text-primary">n = ${p.n}</span>
    </div>`;
  }

  function renderSegmentosSection(): string {
    return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[12rem]">
          <label class="${FORM_LABEL}" for="resultados-dimension">Dimensión</label>
          <div class="relative">
            <select id="resultados-dimension" data-action="dimension" class="${FORM_SELECT}">
              ${DIMENSIONES.map((d) => `<option value="${d.value}"${state.dimension === d.value ? " selected" : ""}>${d.label}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      ${
        state.segmentosLoading || !state.segmentos
          ? skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-10`, label: "Cargando resultados por segmento…" })
          : state.segmentosError
            ? errorState({
                message: state.segmentosError,
                actionLabel: "Reintentar",
                actionAttrs: 'data-action="reload-segmentos"',
              })
            : state.segmentos.celdas.length === 0
              ? renderEmptyState({ title: "Sin datos para esta dimensión." })
              : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  ${state.segmentos.celdas
                    .map((c) => {
                      if (c.oculto) {
                        return `
                        <article class="${RH_LISTADO_SURFACE} flex flex-col gap-2 p-4">
                          <p class="text-sm font-semibold text-text-primary">${escapeHtml(c.segmento)}</p>
                          ${alertWarning(`n = ${c.n} < umbral (${state.segmentos!.umbral_minimo_respuestas}) — resultados ocultos para proteger el anonimato.`)}
                        </article>`;
                      }
                      return `
                      <article class="${RH_LISTADO_SURFACE} flex flex-col gap-3 p-4">
                        <div>
                          <p class="text-sm font-semibold text-text-primary">${escapeHtml(c.segmento)}</p>
                          <p class="text-xs tabular-nums text-text-muted">n = ${c.n}</p>
                        </div>
                        <div class="flex flex-col gap-2.5">
                          ${c.preguntas.map((p) => renderSegmentoMetricRow(p)).join("")}
                        </div>
                      </article>`;
                    })
                    .join("")}
                </div>`
      }
    </div>`;
  }

  // ── Render: textos ────────────────────────────────────────────────────────────

  function renderTextosSection(): string {
    const preguntasTexto = state.detalle?.preguntas.filter((p) => p.tipo === "texto") ?? [];
    if (preguntasTexto.length === 0) {
      return renderEmptyState({ title: "Esta encuesta no tiene preguntas de texto abierto." });
    }
    return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[16rem]">
          <label class="${FORM_LABEL}" for="resultados-pregunta-texto">Pregunta</label>
          <div class="relative">
            <select id="resultados-pregunta-texto" data-action="pregunta-texto" class="${FORM_SELECT}">
              ${preguntasTexto.map((p) => `<option value="${p.id}"${state.preguntaTextoId === p.id ? " selected" : ""}>${escapeHtml(p.texto)}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      ${
        state.textosLoading || !state.textos
          ? skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-10`, label: "Cargando respuestas de texto…" })
          : state.textosError
            ? errorState({
                message: state.textosError,
                actionLabel: "Reintentar",
                actionAttrs: 'data-action="reload-textos"',
              })
            : state.textos.oculto
              ? alertWarning(`Aún no hay respuestas suficientes para mostrar resultados (mínimo ${state.textos.umbral_minimo_respuestas}).`)
              : state.textos.textos.length === 0
                ? renderEmptyState({ title: "Sin respuestas de texto todavía." })
                : `<div class="flex flex-col gap-2">
                    ${state.textos.textos
                      .map(
                        (t) => `<div class="${RH_LISTADO_SURFACE} px-4 py-3 text-sm text-text-primary">${escapeHtml(t)}</div>`,
                      )
                      .join("")}
                  </div>`
      }
    </div>`;
  }

  // ── Render raíz ───────────────────────────────────────────────────────────────

  function renderPage(): string {
    if (state.detalleLoading || state.resultadosLoading) {
      return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">${skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando resultados…" })}</div>`;
    }
    if (state.detalleError || state.resultadosError || !state.detalle || !state.resultados) {
      return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${errorState({
          message: state.detalleError ?? state.resultadosError ?? "No se pudieron cargar los resultados",
          actionLabel: "Volver a encuestas",
          actionAttrs: 'data-action="volver-encuestas"',
        })}
      </div>`;
    }
    const detalle = state.detalle;
    const res = state.resultados;
    return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="flex flex-col gap-2">
        <a href="#/talento/encuestas/${detalle.id}" class="w-fit text-xs font-semibold text-accent hover:underline">← Volver a la encuesta</a>
        ${talentoEyebrow("Talento · Resultados")}
        ${pageHeading(
          res.titulo,
          `${res.es_anonima ? "Anónima" : "No anónima"} · Umbral mínimo ${res.umbral_minimo_respuestas} respuesta(s)`,
          `<button type="button" data-action="exportar" class="${BTN_PRIMARY} w-fit shrink-0" ${state.exportando ? "disabled" : ""}>
            ${state.exportando ? "Exportando…" : "Exportar a Excel"}
          </button>`,
        )}
      </div>
      ${state.exportError ? alertError(state.exportError) : ""}
      ${renderResumen(res)}
      <section>
        <h2 class="mb-3 text-base font-bold text-text-primary">Resultados por pregunta</h2>
        ${renderPreguntasSection(res)}
      </section>
      <section>
        <h2 class="mb-3 text-base font-bold text-text-primary">Resultados por segmento</h2>
        <p class="mb-3 text-xs text-text-muted">Los segmentos con menos respuestas que el umbral mínimo se ocultan para proteger el anonimato.</p>
        ${renderSegmentosSection()}
      </section>
      <section>
        <h2 class="mb-3 text-base font-bold text-text-primary">Respuestas abiertas</h2>
        ${renderTextosSection()}
      </section>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Resultados de encuesta",
      activeNav: "encuestas-rh",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  async function onExportar(): Promise<void> {
    if (!state.detalle || state.exportando) return;
    state.exportando = true;
    state.exportError = null;
    render();
    try {
      const ok = await descargarResultadosExcel(encuestaId, slugFilename(state.detalle.titulo));
      if (!ok) state.exportError = "No se pudo exportar el archivo";
    } catch (err: unknown) {
      state.exportError = (err as Error)?.message ?? "No se pudo exportar el archivo";
    }
    state.exportando = false;
    render();
  }

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === "exportar") {
      void onExportar();
      return;
    }
    if (action === "reload-segmentos") {
      void loadSegmentos();
      return;
    }
    if (action === "reload-textos") {
      if (state.preguntaTextoId != null) void loadTextos(state.preguntaTextoId);
      return;
    }
    if (action === "volver-encuestas") {
      window.location.hash = "#/talento/encuestas";
      return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLSelectElement)) return;
    if (t.dataset.action === "dimension") {
      state.dimension = t.value as SegmentoDimension;
      void loadSegmentos();
      return;
    }
    if (t.dataset.action === "pregunta-texto") {
      const id = Number(t.value);
      if (id) {
        state.preguntaTextoId = id;
        void loadTextos(id);
      }
      return;
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal: mountSignal });
  container.addEventListener("change", handleChange, { signal: mountSignal });

  void loadDetalle();
  void loadResultados();
  void loadSegmentos();
}
