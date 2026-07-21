import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertInfo,
  alertSuccess,
  badgeApproved,
  badgePending,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  FIELD_TEXTAREA,
  pageHeading,
  renderTabNav,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { fmtFechaEncuesta, renderEmptyState } from "../encuestasRh/shared.ts";
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

let mountAbort: AbortController | null = null;

export function mountMisEncuestasRh(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

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

  // Foco pendiente tras un re-render completo (roving tabindex del likert):
  // el click/flecha dispara render(), que reemplaza el DOM, así que el botón
  // recién seleccionado debe volver a recibir foco después de montar.
  let pendingLikertFocus: { pregunta: number; value: number } | null = null;

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

  function selectLikert(preguntaId: number, value: number, focusAfterRender: boolean): void {
    const r = state.respuestas[preguntaId] ?? emptyRespuesta();
    r.valor_likert = value;
    state.respuestas[preguntaId] = r;
    state.formError = null;
    if (focusAfterRender) pendingLikertFocus = { pregunta: preguntaId, value };
    render();
  }

  // Radiogroup Likert (patrón ARIA APG completo): role="radio" + aria-checked,
  // roving tabindex (solo el seleccionado —o el primero si no hay selección—
  // es tabbable) y navegación con flechas (ver handleLikertKeydown).
  function renderLikert(p: PreguntaResponse, r: RespuestaLocal): string {
    const legendId = `pregunta-legend-${p.id}`;
    const selected = r.valor_likert;
    const tabbable = selected ?? 1;
    const opciones = [1, 2, 3, 4, 5]
      .map((n) => {
        const active = selected === n;
        const cls = active
          ? "border-accent bg-accent text-white"
          : "border-slate-200 bg-white text-text-secondary hover:border-accent/50 hover:text-accent";
        return `<button type="button" role="radio" aria-checked="${active}" tabindex="${n === tabbable ? 0 : -1}"
          data-action="likert" data-pregunta="${p.id}" data-value="${n}"
          class="flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition ${cls}"
          aria-label="${n} de 5">${n}</button>`;
      })
      .join("");
    return `<div class="flex items-center gap-2" role="radiogroup" aria-labelledby="${legendId}"${p.requerida ? ' aria-required="true"' : ""}>${opciones}</div>
      <div class="mt-1 flex justify-between text-xs text-text-muted"><span>Muy en desacuerdo</span><span>Muy de acuerdo</span></div>`;
  }

  // Opción única/múltiple: inputs nativos radio/checkbox agrupados por `name`
  // (grupo asociado programáticamente); el fieldset/legend del contenedor
  // (renderPregunta) les da el nombre accesible y el roving tabindex de los
  // radios nativos lo maneja el navegador.
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
      class="${FIELD_TEXTAREA}"
      placeholder="Escribe tu respuesta…">${escapeHtml(r.texto)}</textarea>`;
  }

  function renderPregunta(p: PreguntaResponse): string {
    const r = state.respuestas[p.id] ?? emptyRespuesta();
    const legendId = `pregunta-legend-${p.id}`;
    const body =
      p.tipo === "likert" ? renderLikert(p, r)
      : p.tipo === "opcion_multiple" ? renderOpciones(p, r)
      : renderTexto(p, r);
    return `
    <fieldset class="border-b border-slate-100 py-4 last:border-b-0">
      <legend id="${legendId}" class="text-sm font-semibold text-text-primary">
        ${escapeHtml(p.texto)}${p.requerida ? ` <span class="text-red-500" aria-hidden="true">*</span><span class="sr-only"> (obligatoria)</span>` : ""}
      </legend>
      <div class="mt-3">${body}</div>
    </fieldset>`;
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
        ${detalle.es_anonima ? `<div class="mt-1">${alertInfo("Tus respuestas no se vinculan a tu nombre")}</div>` : ""}
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
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando…" });
    }
    if (state.detalleError || !state.detalle) {
      return errorState({
        message: state.detalleError ?? "No se pudo cargar la encuesta",
        actionLabel: "Volver",
        actionAttrs: 'data-action="responder-cancel"',
      });
    }
    return renderForm(state.detalle);
  }

  function renderListItem(item: MiEncuestaItem): string {
    const respondida = item.participante_estado === "respondida";
    const fechaLimite = fmtFechaEncuesta(item.fecha_cierre_programada);
    const fechaRespuesta = fmtFechaEncuesta(item.fecha_respuesta);
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-text-primary">${escapeHtml(item.titulo)}</h3>
        <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
          ${
            respondida
              ? `<span>Respondida${fechaRespuesta !== "—" ? ` el ${escapeHtml(fechaRespuesta)}` : ""}</span>`
              : fechaLimite !== "—"
                ? badgePending(`Disponible hasta el ${fechaLimite}`)
                : `<span>Sin fecha límite</span>`
          }
          ${item.es_anonima ? `<span class="text-text-muted">· Anónima</span>` : ""}
        </p>
      </div>
      ${
        respondida
          ? badgeApproved("Respondida")
          : `<button type="button" data-action="responder-open" data-id="${item.encuesta_id}" class="${BTN_PRIMARY} shrink-0">Responder</button>`
      }
    </div>`;
  }

  function renderEmpty(tab: Tab): string {
    return tab === "pendientes"
      ? renderEmptyState({
          title: "No tienes encuestas pendientes",
          subtitle: "Cuando RH publique una encuesta dirigida a ti, aparecerá aquí.",
        })
      : renderEmptyState({
          title: "Aún no has respondido encuestas",
          subtitle: "Las encuestas que respondas aparecerán en esta lista.",
        });
  }

  function renderTabs(): string {
    const pendientesCount = state.items.filter((i) => i.participante_estado === "pendiente").length;
    const respondidasCount = state.items.filter((i) => i.participante_estado === "respondida").length;
    return `<div data-tabs="mis-encuestas">
      ${renderTabNav(
        [
          { id: "pendientes", label: "Pendientes", badge: `(${pendientesCount})` },
          { id: "respondidas", label: "Respondidas", badge: `(${respondidasCount})` },
        ],
        state.tab,
        { ariaLabel: "Mis encuestas" },
      )}
    </div>`;
  }

  function renderContent(): string {
    if (state.loading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando…" });
    }
    if (state.error) {
      return errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="reload"' });
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
      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-text-muted">Talento</p>
        ${pageHeading("Mis encuestas RH", "Encuestas de clima y pulso organizacional dirigidas a ti.")}
      </div>
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

    if (pendingLikertFocus) {
      const { pregunta, value } = pendingLikertFocus;
      pendingLikertFocus = null;
      window.requestAnimationFrame(() => {
        container
          .querySelector<HTMLElement>(`[data-action="likert"][data-pregunta="${pregunta}"][data-value="${value}"]`)
          ?.focus();
      });
    }
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

    // Tabs generadas por renderTabNav() (solo `data-tab`, sin `data-action`).
    const tabEl = t.closest<HTMLElement>('[role="tab"][data-tab]');
    if (tabEl) {
      const tab = tabEl.dataset.tab as Tab | undefined;
      if (tab === "pendientes" || tab === "respondidas") {
        state.tab = tab;
        render();
      }
      return;
    }

    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "reload") {
      void loadItems();
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
        selectLikert(preguntaId, value, true);
      }
      return;
    }
    if (action === "responder-submit") {
      void submitResponse();
      return;
    }
  }

  // Roving tabindex del likert: las flechas mueven el foco entre los 5
  // botones del radiogroup y seleccionan el valor al llegar (patrón ARIA APG
  // de radio group de selección única). El foco se restaura tras el
  // re-render vía `pendingLikertFocus` (ver render()).
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== "ArrowRight" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowUp") return;
    const t = e.target as HTMLElement;
    const radio = t.closest<HTMLElement>('[role="radio"][data-action="likert"]');
    if (!radio) return;
    const group = radio.closest<HTMLElement>('[role="radiogroup"]');
    if (!group) return;
    const items = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    const idx = items.indexOf(radio);
    if (idx === -1) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const nextEl = items[(idx + delta + items.length) % items.length];
    const preguntaId = Number(nextEl.dataset.pregunta);
    const value = Number(nextEl.dataset.value);
    if (!preguntaId || !(value >= 1 && value <= 5)) return;
    selectLikert(preguntaId, value, true);
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;

    // Texto libre: el estado ya se actualiza en cada tecleo (handleInput,
    // sin render() para no perder el foco); al salir del campo (blur/change)
    // se vuelve a renderizar para que el boton "Enviar" refleje si la
    // pregunta requerida quedo completa.
    if (t instanceof HTMLTextAreaElement && t.dataset.action === "texto") {
      const preguntaId = Number(t.dataset.pregunta);
      if (!preguntaId) return;
      const r = state.respuestas[preguntaId] ?? emptyRespuesta();
      r.texto = t.value;
      state.respuestas[preguntaId] = r;
      state.formError = null;
      render();
      return;
    }

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
  container.addEventListener("click", handleClick, { signal: mountSignal });
  container.addEventListener("change", handleChange, { signal: mountSignal });
  container.addEventListener("input", handleInput, { signal: mountSignal });
  container.addEventListener("keydown", handleKeydown, { signal: mountSignal });

  void loadItems();
}
