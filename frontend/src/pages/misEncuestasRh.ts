import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertSuccess,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
} from "../ui/uiTokens.ts";
import {
  getMiEncuesta,
  getMisEncuestas,
  responderEncuesta,
  type EncuestaResponse,
  type MiEncuestaItem,
  type PreguntaResponse,
  type ResponderItem,
} from "../api/encuestasRh.ts";

type Tab = "pendientes" | "respondidas";

type RespuestaLocal = {
  valor_likert: number | null;
  texto: string;
  opcion_ids: number[];
};

interface State {
  items: MiEncuestaItem[];
  loading: boolean;
  error: string | null;
  tab: Tab;
  respondingId: number | null;
  detalle: EncuestaResponse | null;
  detalleLoading: boolean;
  detalleError: string | null;
  respuestas: Record<number, RespuestaLocal>;
  submitting: boolean;
  formError: string | null;
  successMessage: string | null;
}

function emptyRespuesta(): RespuestaLocal {
  return { valor_likert: null, texto: "", opcion_ids: [] };
}

function fmtFecha(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function mountMisEncuestasRh(container: HTMLElement, signal?: AbortSignal): void {
  const state: State = {
    items: [],
    loading: true,
    error: null,
    tab: "pendientes",
    respondingId: null,
    detalle: null,
    detalleLoading: false,
    detalleError: null,
    respuestas: {},
    submitting: false,
    formError: null,
    successMessage: null,
  };

  async function loadItems(): Promise<void> {
    state.loading = true;
    render();
    try {
      state.items = await getMisEncuestas();
      state.error = null;
    } catch (err: unknown) {
      state.error = (err as Error)?.message ?? "No se pudieron cargar tus encuestas";
    }
    state.loading = false;
    render();
  }

  async function openResponder(id: number): Promise<void> {
    state.respondingId = id;
    state.detalle = null;
    state.detalleLoading = true;
    state.detalleError = null;
    state.formError = null;
    state.successMessage = null;
    render();
    try {
      const detalle = await getMiEncuesta(id);
      state.detalle = detalle;
      state.respuestas = {};
      for (const p of detalle.preguntas) {
        state.respuestas[p.id] = emptyRespuesta();
      }
    } catch (err: unknown) {
      state.detalleError = (err as Error)?.message ?? "No se pudo cargar la encuesta";
    }
    state.detalleLoading = false;
    render();
  }

  function cancelResponder(): void {
    state.respondingId = null;
    state.detalle = null;
    state.detalleError = null;
    state.formError = null;
    render();
  }

  function respuestaCompletada(p: PreguntaResponse): boolean {
    const r = state.respuestas[p.id];
    if (!r) return false;
    if (p.tipo === "likert") return r.valor_likert != null;
    if (p.tipo === "texto") return r.texto.trim().length > 0;
    if (p.tipo === "opcion_multiple") return r.opcion_ids.length > 0;
    return false;
  }

  function renderLikert(p: PreguntaResponse, r: RespuestaLocal): string {
    const opciones = [1, 2, 3, 4, 5]
      .map((n) => {
        const active = r.valor_likert === n;
        const cls = active
          ? "border-accent bg-accent text-white"
          : "border-slate-200 bg-white text-text-secondary hover:border-accent/50 hover:text-accent";
        return `<button type="button" data-action="likert" data-pregunta="${p.id}" data-value="${n}"
          class="flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition ${cls}"
          aria-pressed="${active ? "true" : "false"}" aria-label="${n} de 5">${n}</button>`;
      })
      .join("");
    return `<div class="flex items-center gap-2">${opciones}</div>
      <div class="mt-1 flex justify-between text-xs text-text-muted"><span>Muy en desacuerdo</span><span>Muy de acuerdo</span></div>`;
  }

  function renderOpciones(p: PreguntaResponse, r: RespuestaLocal): string {
    const inputType = p.seleccion_multiple ? "checkbox" : "radio";
    const rows = p.opciones
      .map((o) => {
        const checked = r.opcion_ids.includes(o.id);
        return `<label class="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-text-primary transition hover:border-accent/40 hover:bg-slate-50">
          <input type="${inputType}" name="pregunta-${p.id}" data-action="opcion" data-pregunta="${p.id}" data-opcion="${o.id}"
            class="size-4 shrink-0 border-slate-300 text-accent focus:ring-accent" ${checked ? "checked" : ""} />
          <span>${escapeHtml(o.texto)}</span>
        </label>`;
      })
      .join("");
    return `<div class="flex flex-col gap-2">${rows}</div>`;
  }

  function renderTexto(p: PreguntaResponse, r: RespuestaLocal): string {
    return `<textarea data-action="texto" data-pregunta="${p.id}" rows="3"
      class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}"
      placeholder="Escribe tu respuesta…">${escapeHtml(r.texto)}</textarea>`;
  }

  function renderPregunta(p: PreguntaResponse): string {
    const r = state.respuestas[p.id] ?? emptyRespuesta();
    const body =
      p.tipo === "likert" ? renderLikert(p, r)
      : p.tipo === "opcion_multiple" ? renderOpciones(p, r)
      : renderTexto(p, r);
    return `
    <div class="border-b border-slate-100 py-4 last:border-b-0">
      <p class="text-sm font-semibold text-text-primary">
        ${escapeHtml(p.texto)}${p.requerida ? ` <span class="text-red-500" aria-hidden="true">*</span>` : ""}
      </p>
      <div class="mt-3">${body}</div>
    </div>`;
  }

  function renderForm(detalle: EncuestaResponse): string {
    const preguntasOrdenadas = [...detalle.preguntas].sort((a, b) => a.orden - b.orden);
    const completo = preguntasOrdenadas.filter((p) => p.requerida).every((p) => respuestaCompletada(p));
    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:px-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Responder encuesta</p>
        <h2 class="text-lg font-bold text-text-primary">${escapeHtml(detalle.titulo)}</h2>
        ${detalle.descripcion ? `<p class="text-sm text-text-secondary">${escapeHtml(detalle.descripcion)}</p>` : ""}
        ${
          detalle.es_anonima
            ? `<p class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">Tus respuestas no se vinculan a tu nombre</p>`
            : ""
        }
      </div>
      <div class="px-5 py-2 sm:px-6">
        ${state.formError ? `<div class="my-3">${alertError(state.formError)}</div>` : ""}
        <div class="flex flex-col">
          ${preguntasOrdenadas.map(renderPregunta).join("")}
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" data-action="responder-cancel" class="${BTN_SECONDARY} w-full sm:w-auto"${state.submitting ? " disabled" : ""}>Cancelar</button>
        <button type="button" data-action="responder-submit" class="${BTN_PRIMARY} w-full sm:w-auto"${!completo || state.submitting ? " disabled" : ""}>
          ${state.submitting ? "Enviando…" : "Enviar respuesta"}
        </button>
      </div>
    </div>`;
  }

  function renderRespondingPanel(): string {
    if (state.detalleLoading) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"><p class="sr-only">Cargando…</p></div>`;
    }
    if (state.detalleError || !state.detalle) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert">
        <p class="text-sm font-semibold text-red-700">${escapeHtml(state.detalleError ?? "No se pudo cargar la encuesta")}</p>
        <button type="button" data-action="responder-cancel" class="${BTN_GHOST} mx-auto mt-4">Volver</button>
      </div>`;
    }
    return renderForm(state.detalle);
  }

  function renderListItem(item: MiEncuestaItem): string {
    const fechaLimite = fmtFecha(item.fecha_cierre_programada);
    const respondida = item.participante_estado === "respondida";
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-text-primary">${escapeHtml(item.titulo)}</h3>
        <p class="mt-0.5 text-xs text-text-secondary">
          ${respondida
            ? `Respondida${fmtFecha(item.fecha_respuesta) ? ` el ${escapeHtml(fmtFecha(item.fecha_respuesta)!)}` : ""}`
            : fechaLimite ? `<span class="font-medium text-amber-700">Disponible hasta el ${escapeHtml(fechaLimite)}</span>` : "Sin fecha límite"}
          ${item.es_anonima ? " · Anónima" : ""}
        </p>
      </div>
      ${
        respondida
          ? `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900"><span class="size-1.5 rounded-full bg-emerald-500"></span>Respondida</span>`
          : `<button type="button" data-action="responder-open" data-id="${item.encuesta_id}" class="${BTN_PRIMARY} shrink-0">Responder</button>`
      }
    </div>`;
  }

  function renderEmpty(tab: Tab): string {
    const msg =
      tab === "pendientes"
        ? { title: "No tienes encuestas pendientes", sub: "Cuando RH publique una encuesta dirigida a ti, aparecerá aquí." }
        : { title: "Aún no has respondido encuestas", sub: "Las encuestas que respondas aparecerán en esta lista." };
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
      <p class="mt-4 text-base font-semibold text-text-primary">${msg.title}</p>
      <p class="mt-1 max-w-sm text-sm text-text-muted">${msg.sub}</p>
    </div>`;
  }

  function renderTabs(): string {
    const pendientesCount = state.items.filter((i) => i.participante_estado === "pendiente").length;
    const respondidasCount = state.items.filter((i) => i.participante_estado === "respondida").length;
    const tab = (id: Tab, label: string, count: number): string => {
      const active = state.tab === id;
      const cls = active
        ? "-mb-px border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent"
        : "-mb-px border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-500 hover:text-text-primary";
      return `<button type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-action="tab" data-tab="${id}" class="${cls}">${label} (${count})</button>`;
    };
    return `<div role="tablist" class="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-200/70">
      ${tab("pendientes", "Pendientes", pendientesCount)}
      ${tab("respondidas", "Respondidas", respondidasCount)}
    </div>`;
  }

  function renderContent(): string {
    if (state.loading) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"><p class="sr-only">Cargando…</p></div>`;
    }
    if (state.error) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert">
        <p class="text-sm font-semibold text-red-700">${escapeHtml(state.error)}</p>
        <button type="button" data-action="reload" class="${BTN_GHOST} mx-auto mt-4">Reintentar</button>
      </div>`;
    }
    if (state.respondingId != null) return renderRespondingPanel();

    const filtered = state.items.filter((i) =>
      state.tab === "pendientes" ? i.participante_estado === "pendiente" : i.participante_estado === "respondida",
    );
    return `<div class="flex flex-col gap-4">
      ${renderTabs()}
      ${filtered.length === 0 ? renderEmpty(state.tab) : `<div class="flex flex-col gap-3">${filtered.map(renderListItem).join("")}</div>`}
    </div>`;
  }

  function renderPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <p class="text-xs font-medium text-text-muted">Talento</p>
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Mis encuestas RH</h1>
        <p class="text-sm text-text-muted">Encuestas de clima y pulso organizacional dirigidas a ti.</p>
      </header>
      ${state.successMessage ? alertSuccess(state.successMessage) : ""}
      ${renderContent()}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Mis encuestas RH",
      activeNav: "mis-encuestas-rh",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  async function submitResponse(): Promise<void> {
    if (state.respondingId == null || !state.detalle || state.submitting) return;
    const preguntasOrdenadas = state.detalle.preguntas;
    const faltantes = preguntasOrdenadas.filter((p) => p.requerida && !respuestaCompletada(p));
    if (faltantes.length > 0) {
      state.formError = "Responde todas las preguntas obligatorias antes de enviar.";
      render();
      return;
    }
    const respuestas: ResponderItem[] = preguntasOrdenadas
      .filter((p) => respuestaCompletada(p))
      .map((p) => {
        const r = state.respuestas[p.id] ?? emptyRespuesta();
        if (p.tipo === "likert") return { pregunta_id: p.id, valor_likert: r.valor_likert };
        if (p.tipo === "texto") return { pregunta_id: p.id, texto: r.texto.trim() };
        return { pregunta_id: p.id, opcion_ids: r.opcion_ids };
      });

    state.submitting = true;
    state.formError = null;
    render();
    try {
      await responderEncuesta(state.respondingId, { respuestas });
      state.submitting = false;
      state.respondingId = null;
      state.detalle = null;
      state.respuestas = {};
      state.successMessage = "Tu respuesta fue registrada. ¡Gracias por tu retroalimentación!";
      await loadItems();
    } catch (err: unknown) {
      state.submitting = false;
      state.formError = (err as Error)?.message ?? "No se pudo registrar tu respuesta";
      render();
    }
  }

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "reload") {
      void loadItems();
      return;
    }
    if (action === "tab") {
      const tab = actionEl.dataset.tab as Tab | undefined;
      if (tab) {
        state.tab = tab;
        render();
      }
      return;
    }
    if (action === "responder-open") {
      const id = Number(actionEl.dataset.id);
      if (id) void openResponder(id);
      return;
    }
    if (action === "responder-cancel") {
      cancelResponder();
      return;
    }
    if (action === "likert") {
      const preguntaId = Number(actionEl.dataset.pregunta);
      const value = Number(actionEl.dataset.value);
      if (preguntaId && value >= 1 && value <= 5) {
        const r = state.respuestas[preguntaId] ?? emptyRespuesta();
        r.valor_likert = value;
        state.respuestas[preguntaId] = r;
        state.formError = null;
        render();
      }
      return;
    }
    if (action === "responder-submit") {
      void submitResponse();
      return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.action !== "opcion") return;
    const preguntaId = Number(t.dataset.pregunta);
    const opcionId = Number(t.dataset.opcion);
    if (!preguntaId || !opcionId || !state.detalle) return;
    const pregunta = state.detalle.preguntas.find((p) => p.id === preguntaId);
    const r = state.respuestas[preguntaId] ?? emptyRespuesta();
    if (pregunta?.seleccion_multiple) {
      r.opcion_ids = t.checked
        ? [...r.opcion_ids.filter((id) => id !== opcionId), opcionId]
        : r.opcion_ids.filter((id) => id !== opcionId);
    } else {
      r.opcion_ids = t.checked ? [opcionId] : [];
    }
    state.respuestas[preguntaId] = r;
    state.formError = null;
    render();
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement && t.dataset.action === "texto") {
      const preguntaId = Number(t.dataset.pregunta);
      if (!preguntaId) return;
      const r = state.respuestas[preguntaId] ?? emptyRespuesta();
      r.texto = t.value;
      state.respuestas[preguntaId] = r;
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal });
  container.addEventListener("change", handleChange, { signal });
  container.addEventListener("input", handleInput, { signal });

  void loadItems();
}
