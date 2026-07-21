import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
  badgeApproved,
  badgeCancelled,
  badgeOpen,
} from "../ui/uiTokens.ts";
import {
  descargarResultadosExcel,
  getEncuesta,
  getResultadosGlobales,
  getResultadosSegmentos,
  getResultadosTextos,
  type EncuestaEstado,
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

function estadoBadge(estado: EncuestaEstado): string {
  if (estado === "borrador") return badgeCancelled("Borrador");
  if (estado === "publicada") return badgeOpen("Publicada");
  return badgeApproved("Cerrada");
}

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

export function mountEncuestasRhResultados(container: HTMLElement, encuestaId: number, signal?: AbortSignal): void {
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
    return `
    <section class="${RH_LISTADO_SURFACE} grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
      <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Estado</p><div class="mt-1">${estadoBadge(res.estado)}</div></div>
      <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Respuestas (n)</p><p class="text-xl font-bold text-text-primary">${res.n}</p></div>
      <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Participantes</p><p class="text-xl font-bold text-text-primary">${res.total_participantes}</p></div>
      <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Tasa de respuesta</p><p class="text-xl font-bold text-text-primary">${res.tasa_respuesta}%</p></div>
    </section>`;
  }

  function renderLikertBars(p: ResultadoPregunta): string {
    const maxConteo = Math.max(1, ...p.distribucion.map((d) => d.conteo));
    const rows = p.distribucion
      .map((d) => {
        const pct = Math.round((d.conteo / maxConteo) * 100);
        return `
        <div class="flex items-center gap-2">
          <span class="w-4 shrink-0 text-xs font-semibold text-text-muted">${d.valor}</span>
          <div class="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-accent" style="width:${pct}%"></div>
          </div>
          <span class="w-8 shrink-0 text-right text-xs tabular-nums text-text-muted">${d.conteo}</span>
        </div>`;
      })
      .join("");
    return `
    <div class="flex flex-col gap-1.5">
      ${p.promedio != null ? `<p class="text-sm font-semibold text-text-primary">Promedio: <span class="tabular-nums">${p.promedio}</span> / 5</p>` : ""}
      ${rows}
    </div>`;
  }

  function renderOpcionesBars(p: ResultadoPregunta): string {
    const maxConteo = Math.max(1, ...p.opciones.map((o) => o.conteo));
    const rows = p.opciones
      .map((o) => {
        const pct = Math.round((o.conteo / maxConteo) * 100);
        return `
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0 truncate text-xs text-text-secondary" title="${escapeHtml(o.texto)}">${escapeHtml(o.texto)}</span>
          <div class="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-accent" style="width:${pct}%"></div>
          </div>
          <span class="w-8 shrink-0 text-right text-xs tabular-nums text-text-muted">${o.conteo}</span>
        </div>`;
      })
      .join("");
    return `<div class="flex flex-col gap-1.5">${rows}</div>`;
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
      return `<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        Aún no hay respuestas suficientes para mostrar resultados (mínimo ${res.umbral_minimo_respuestas}).
      </div>`;
    }
    if (res.preguntas.length === 0) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center text-sm text-text-muted">Esta encuesta no tiene preguntas.</div>`;
    }
    return `<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">${res.preguntas.map(renderPreguntaCard).join("")}</div>`;
  }

  // ── Render: segmentos ─────────────────────────────────────────────────────────

  function renderSegmentoMetric(p: ResultadoPregunta): string {
    if (p.tipo === "likert") return `${escapeHtml(p.texto)}: ${p.promedio ?? "—"}/5 (n=${p.n})`;
    if (p.tipo === "opcion_multiple") {
      const top = [...p.opciones].sort((a, b) => b.conteo - a.conteo)[0];
      return `${escapeHtml(p.texto)}: ${top ? `${escapeHtml(top.texto)} (${top.conteo})` : "sin datos"}`;
    }
    return `${escapeHtml(p.texto)}: ${p.n} respuesta(s)`;
  }

  function renderSegmentosSection(): string {
    return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="resultados-dimension">Dimensión</label>
        <div class="relative">
          <select id="resultados-dimension" data-action="dimension" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
            ${DIMENSIONES.map((d) => `<option value="${d.value}"${state.dimension === d.value ? " selected" : ""}>${d.label}</option>`).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      ${
        state.segmentosLoading || !state.segmentos
          ? `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-10" aria-busy="true"></div>`
          : state.segmentosError
            ? `<div class="${RH_LISTADO_SURFACE} px-6 py-8 text-center text-sm text-red-700" role="alert">${escapeHtml(state.segmentosError)}</div>`
            : state.segmentos.celdas.length === 0
              ? `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center text-sm text-text-muted">Sin datos para esta dimensión.</div>`
              : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  ${state.segmentos.celdas
                    .map((c) => {
                      if (c.oculto) {
                        return `
                        <article class="${RH_LISTADO_SURFACE} p-4">
                          <p class="text-sm font-semibold text-text-primary">${escapeHtml(c.segmento)}</p>
                          <p class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            n = ${c.n} &lt; umbral (${state.segmentos!.umbral_minimo_respuestas}) — resultados ocultos para proteger el anonimato.
                          </p>
                        </article>`;
                      }
                      return `
                      <article class="${RH_LISTADO_SURFACE} p-4">
                        <p class="text-sm font-semibold text-text-primary">${escapeHtml(c.segmento)}</p>
                        <p class="text-xs text-text-muted">n = ${c.n}</p>
                        <ul class="mt-2 flex flex-col gap-1 text-xs text-text-secondary">
                          ${c.preguntas.map((p) => `<li>${renderSegmentoMetric(p)}</li>`).join("")}
                        </ul>
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
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-8 text-center text-sm text-text-muted">Esta encuesta no tiene preguntas de texto abierto.</div>`;
    }
    return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-text-muted" for="resultados-pregunta-texto">Pregunta</label>
        <div class="relative min-w-[16rem]">
          <select id="resultados-pregunta-texto" data-action="pregunta-texto" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
            ${preguntasTexto.map((p) => `<option value="${p.id}"${state.preguntaTextoId === p.id ? " selected" : ""}>${escapeHtml(p.texto)}</option>`).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      ${
        state.textosLoading || !state.textos
          ? `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-10" aria-busy="true"></div>`
          : state.textosError
            ? `<div class="${RH_LISTADO_SURFACE} px-6 py-8 text-center text-sm text-red-700" role="alert">${escapeHtml(state.textosError)}</div>`
            : state.textos.oculto
              ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  Aún no hay respuestas suficientes para mostrar resultados (mínimo ${state.textos.umbral_minimo_respuestas}).
                </div>`
              : state.textos.textos.length === 0
                ? `<div class="${RH_LISTADO_SURFACE} px-6 py-8 text-center text-sm text-text-muted">Sin respuestas de texto todavía.</div>`
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
      return `<div class="${RH_LISTADO_PAGE_OUTER}"><div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"></div></div>`;
    }
    if (state.detalleError || state.resultadosError || !state.detalle || !state.resultados) {
      return `<div class="${RH_LISTADO_PAGE_OUTER}">
        <div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert">
          <p class="text-sm font-semibold text-red-700">${escapeHtml(state.detalleError ?? state.resultadosError ?? "No se pudieron cargar los resultados")}</p>
          <a href="#/talento/encuestas" class="${BTN_SECONDARY} mx-auto mt-4 w-fit">Volver a encuestas</a>
        </div>
      </div>`;
    }
    const detalle = state.detalle;
    const res = state.resultados;
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-3">
        <a href="#/talento/encuestas/${detalle.id}" class="w-fit text-xs font-semibold text-accent hover:underline">← Volver a la encuesta</a>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium text-text-muted">Talento · Resultados</p>
            <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">${escapeHtml(res.titulo)}</h1>
            <p class="mt-1 text-xs text-text-muted">${res.es_anonima ? "Anónima" : "No anónima"} · Umbral mínimo ${res.umbral_minimo_respuestas} respuesta(s)</p>
          </div>
          <button type="button" data-action="exportar" class="${BTN_PRIMARY} w-fit shrink-0" ${state.exportando ? "disabled" : ""}>
            ${state.exportando ? "Exportando…" : "Exportar a Excel"}
          </button>
        </div>
      </header>
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
    if (actionEl.dataset.action === "exportar") {
      void onExportar();
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
  container.addEventListener("click", handleClick, { signal });
  container.addEventListener("change", handleChange, { signal });

  void loadDetalle();
  void loadResultados();
  void loadSegmentos();
}
