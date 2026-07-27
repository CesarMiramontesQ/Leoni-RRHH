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
  getMisEncuestasPendientes,
  responderEncuesta,
} from "../api/encuestas.ts";
import type { EncuestaPendiente } from "../dashboard/cursos/encuestasTypes.ts";

type ScoreDim =
  | "score_general"
  | "score_instructor"
  | "score_contenido"
  | "score_aplicabilidad";

const DIMENSIONES: { dim: ScoreDim; label: string; hint: string }[] = [
  { dim: "score_general", label: "Valoración general", hint: "Tu satisfacción global con el curso" },
  { dim: "score_instructor", label: "Instructor", hint: "Dominio del tema y claridad" },
  { dim: "score_contenido", label: "Contenido", hint: "Calidad y relevancia del material" },
  { dim: "score_aplicabilidad", label: "Aplicabilidad", hint: "Utilidad en tu trabajo diario" },
];

interface FormState {
  score_general: number;
  score_instructor: number;
  score_contenido: number;
  score_aplicabilidad: number;
  comentario: string;
}

function emptyForm(): FormState {
  return {
    score_general: 0,
    score_instructor: 0,
    score_contenido: 0,
    score_aplicabilidad: 0,
    comentario: "",
  };
}

export function mountMisEncuestas(container: HTMLElement, signal?: AbortSignal): void {
  interface State {
    items: EncuestaPendiente[];
    loading: boolean;
    error: string | null;
    respondingId: number | null;
    form: FormState;
    submitting: boolean;
    formError: string | null;
    successMessage: string | null;
  }

  const state: State = {
    items: [],
    loading: true,
    error: null,
    respondingId: null,
    form: emptyForm(),
    submitting: false,
    formError: null,
    successMessage: null,
  };

  async function loadPendientes(): Promise<void> {
    state.loading = true;
    render();
    try {
      const res = await getMisEncuestasPendientes();
      state.items = res.items;
      state.error = null;
    } catch (err: unknown) {
      state.error = (err as Error)?.message ?? "No se pudieron cargar tus encuestas pendientes";
    }
    state.loading = false;
    render();
  }

  function fmtFecha(value: string | null): string | null {
    if (!value) return null;
    const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }

  const STAR_FULL = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-7" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;

  function starRow(dim: ScoreDim, label: string, hint: string, value: number): string {
    const stars = [1, 2, 3, 4, 5]
      .map((n) => {
        const active = n <= value;
        const cls = active ? "text-amber-400" : "text-slate-300 hover:text-amber-300";
        return `<button type="button" data-action="star" data-dim="${dim}" data-value="${n}" class="transition ${cls}" aria-label="${n} de 5" aria-pressed="${active ? "true" : "false"}">${STAR_FULL}</button>`;
      })
      .join("");
    return `
    <div class="flex flex-col gap-1.5 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-text-primary">${escapeHtml(label)}</p>
        <p class="text-xs text-text-muted">${escapeHtml(hint)}</p>
      </div>
      <div class="flex items-center gap-1.5">
        ${stars}
        <span class="ml-2 w-10 text-sm font-semibold tabular-nums text-slate-600">${value > 0 ? `${value}/5` : "—"}</span>
      </div>
    </div>`;
  }

  function renderForm(item: EncuestaPendiente): string {
    const fechaSesion = fmtFecha(item.fecha_sesion);
    const fechaLimite = fmtFecha(item.fecha_limite);
    const completo =
      state.form.score_general > 0 &&
      state.form.score_instructor > 0 &&
      state.form.score_contenido > 0 &&
      state.form.score_aplicabilidad > 0;
    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:px-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Responder encuesta</p>
        <h2 class="text-lg font-bold text-text-primary">${escapeHtml(item.curso_nombre ?? "Curso")}</h2>
        <p class="text-xs text-text-secondary">
          ${fechaSesion ? `Sesión del ${escapeHtml(fechaSesion)}` : "Sesión sin fecha"}
          ${fechaLimite ? ` · Disponible hasta el ${escapeHtml(fechaLimite)}` : ""}
        </p>
      </div>
      <div class="px-5 py-4 sm:px-6">
        ${state.formError ? `<div class="mb-4">${alertError(state.formError)}</div>` : ""}
        <div class="flex flex-col">
          ${DIMENSIONES.map((d) => starRow(d.dim, d.label, d.hint, state.form[d.dim])).join("")}
        </div>
        <div class="mt-4">
          <label for="encuesta-comentario" class="mb-1 block text-sm font-semibold text-text-primary">Comentario (opcional)</label>
          <textarea id="encuesta-comentario" data-action="comentario" rows="3"
            class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}"
            placeholder="Comparte qué te pareció el curso…">${escapeHtml(state.form.comentario)}</textarea>
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

  function renderListItem(item: EncuestaPendiente): string {
    const fechaSesion = fmtFecha(item.fecha_sesion);
    const fechaLimite = fmtFecha(item.fecha_limite);
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-text-primary">${escapeHtml(item.curso_nombre ?? "Curso")}</h3>
        <p class="mt-0.5 text-xs text-text-secondary">
          ${fechaSesion ? `Sesión del ${escapeHtml(fechaSesion)}` : "Sesión sin fecha"}
          ${fechaLimite ? ` · <span class="font-medium text-amber-700">Hasta el ${escapeHtml(fechaLimite)}</span>` : ""}
        </p>
      </div>
      <button type="button" data-action="responder-open" data-id="${item.encuesta_id}" class="${BTN_PRIMARY} shrink-0">Responder</button>
    </div>`;
  }

  function renderEmpty(): string {
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
      <p class="mt-4 text-base font-semibold text-text-primary">No tienes encuestas pendientes</p>
      <p class="mt-1 max-w-sm text-sm text-text-muted">Cuando RH habilite una encuesta de un curso que tomaste, aparecerá aquí para que la respondas.</p>
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

    const responding = state.respondingId != null
      ? state.items.find((i) => i.encuesta_id === state.respondingId) ?? null
      : null;
    if (responding) return renderForm(responding);

    if (state.items.length === 0) return renderEmpty();
    return `<div class="flex flex-col gap-3">${state.items.map(renderListItem).join("")}</div>`;
  }

  function renderPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Encuestas de curso pendientes</h1>
        <p class="text-sm text-text-muted">Califica los cursos que tomaste para ayudarnos a mejorar la capacitación.</p>
      </header>
      ${state.successMessage ? alertSuccess(state.successMessage) : ""}
      ${renderContent()}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Encuestas de curso",
      activeNav: "mis-encuestas",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  function openResponder(id: number): void {
    state.respondingId = id;
    state.form = emptyForm();
    state.formError = null;
    state.successMessage = null;
    render();
  }

  function cancelResponder(): void {
    state.respondingId = null;
    state.form = emptyForm();
    state.formError = null;
    render();
  }

  async function submitResponse(): Promise<void> {
    if (state.respondingId == null || state.submitting) return;
    const f = state.form;
    if (!f.score_general || !f.score_instructor || !f.score_contenido || !f.score_aplicabilidad) {
      state.formError = "Califica las 4 dimensiones (1 a 5).";
      render();
      return;
    }
    state.submitting = true;
    state.formError = null;
    render();
    try {
      await responderEncuesta(state.respondingId, {
        score_general: f.score_general,
        score_instructor: f.score_instructor,
        score_contenido: f.score_contenido,
        score_aplicabilidad: f.score_aplicabilidad,
        comentario: f.comentario.trim() || null,
      });
      state.submitting = false;
      state.respondingId = null;
      state.form = emptyForm();
      state.successMessage = "Tu respuesta fue registrada. ¡Gracias por tu retroalimentación!";
      await loadPendientes();
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
      void loadPendientes();
      return;
    }
    if (action === "responder-open") {
      const id = Number(actionEl.dataset.id);
      if (id) openResponder(id);
      return;
    }
    if (action === "responder-cancel") {
      cancelResponder();
      return;
    }
    if (action === "star") {
      const dim = actionEl.dataset.dim as ScoreDim | undefined;
      const value = Number(actionEl.dataset.value);
      if (dim && value >= 1 && value <= 5) {
        state.form[dim] = value;
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

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement && t.dataset.action === "comentario") {
      state.form.comentario = t.value;
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal });
  container.addEventListener("input", handleInput, { signal });

  void loadPendientes();
}
