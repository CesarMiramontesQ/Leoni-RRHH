// frontend/src/pages/misEvaluaciones.ts
// Página self-service "Mis Evaluaciones": el usuario responde las evaluaciones
// 360 donde participa como evaluador. Accesible a cualquier empleado.

import { mountAppShell } from "../layouts/appShell.ts";
import {
  alertError,
  alertSuccess,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_TEXTAREA,
  RH_LISTADO_PAGE_OUTER,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  enviarEvaluacion,
  fetchEvaluacionDetalle,
  fetchMisEvaluaciones,
  guardarBorradorEvaluacion,
  type ComentarioIn,
  type EvaluacionDetalleApi,
  type EvaluacionEstadoApi,
  type MiEvaluacionApi,
  type RespuestaIn,
} from "../api/evaluacion360.ts";

const TIPO_LABELS: Record<string, string> = {
  autoevaluacion: "Autoevaluación",
  jefe: "Jefe directo",
  par: "Par",
  subordinado: "Subordinado",
  cliente_interno: "Cliente interno",
  cliente_externo: "Cliente externo",
};

function estadoBadge(estado: EvaluacionEstadoApi): string {
  const map: Record<EvaluacionEstadoApi, { cls: string; label: string }> = {
    pendiente: { cls: "border-amber-200 bg-amber-50 text-amber-900", label: "Pendiente" },
    en_progreso: { cls: "border-blue-200 bg-blue-50 text-blue-900", label: "En progreso" },
    completada: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", label: "Completada" },
    vencida: { cls: "border-red-200 bg-red-50 text-red-900", label: "Vencida" },
  };
  const b = map[estado];
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${b.cls}">${b.label}</span>`;
}

interface State {
  evaluaciones: MiEvaluacionApi[] | null;
  loadError: boolean;
  filtro: "todas" | EvaluacionEstadoApi;
  detalle: EvaluacionDetalleApi | null;
  detalleLoading: boolean;
  saving: boolean;
  message: { kind: "ok" | "error"; text: string } | null;
}

export function mountMisEvaluaciones(container: HTMLElement, signal?: AbortSignal): void {
  const state: State = {
    evaluaciones: null,
    loadError: false,
    filtro: "todas",
    detalle: null,
    detalleLoading: false,
    saving: false,
    message: null,
  };

  const isStale = (): boolean => Boolean(signal?.aborted);

  // ── Carga ──────────────────────────────────────────────────────────────────
  async function loadLista(): Promise<void> {
    state.loadError = false;
    try {
      state.evaluaciones = await fetchMisEvaluaciones();
    } catch {
      state.loadError = true;
      state.evaluaciones = [];
    }
    if (!isStale()) render();
  }

  async function openDetalle(id: number): Promise<void> {
    state.detalleLoading = true;
    state.detalle = null;
    state.message = null;
    render();
    const detalle = await fetchEvaluacionDetalle(id);
    state.detalleLoading = false;
    if (!detalle) {
      state.message = { kind: "error", text: "No se pudo abrir la evaluación." };
    } else {
      state.detalle = detalle;
    }
    if (!isStale()) render();
  }

  function volverALista(): void {
    state.detalle = null;
    state.message = null;
    render();
    void loadLista();
  }

  // ── Recolección de respuestas del DOM ──────────────────────────────────────
  function recolectar(root: HTMLElement): { respuestas: RespuestaIn[]; comentarios: ComentarioIn[] } {
    const respuestas: RespuestaIn[] = [];
    root.querySelectorAll<HTMLInputElement>('input[type="radio"][data-pregunta]:checked').forEach((el) => {
      respuestas.push({ pregunta_id: Number(el.dataset.pregunta), valor: Number(el.value) });
    });
    const comentarios: ComentarioIn[] = [];
    root.querySelectorAll<HTMLTextAreaElement>("textarea[data-comentario]").forEach((el) => {
      const texto = el.value.trim();
      if (texto) {
        comentarios.push({ competencia_id: Number(el.dataset.comentario), texto, tipo: "general" });
      }
    });
    return { respuestas, comentarios };
  }

  async function guardar(): Promise<void> {
    if (!state.detalle || state.saving) return;
    const root = container.querySelector<HTMLElement>("#mis-eval-detalle");
    if (!root) return;
    state.saving = true;
    render();
    const payload = recolectar(root);
    const res = await guardarBorradorEvaluacion(state.detalle.id, payload);
    state.saving = false;
    if (res) {
      state.detalle = res;
      state.message = { kind: "ok", text: "Borrador guardado." };
    } else {
      state.message = { kind: "error", text: "No se pudo guardar el borrador." };
    }
    if (!isStale()) render();
  }

  async function enviar(): Promise<void> {
    if (!state.detalle || state.saving) return;
    const root = container.querySelector<HTMLElement>("#mis-eval-detalle");
    if (!root) return;
    state.saving = true;
    render();
    const payload = recolectar(root);
    const res = await enviarEvaluacion(state.detalle.id, payload);
    state.saving = false;
    if (res.ok) {
      state.message = { kind: "ok", text: "Evaluación enviada. ¡Gracias!" };
      state.detalle = null;
      render();
      void loadLista();
      return;
    }
    state.message = {
      kind: "error",
      text:
        res.status === 422
          ? "Debes responder todas las preguntas (y comentarios obligatorios) antes de enviar."
          : "No se pudo enviar la evaluación.",
    };
    if (!isStale()) render();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderLista(): string {
    if (state.loadError) {
      return alertError("No se pudieron cargar tus evaluaciones. Intenta de nuevo.");
    }
    if (state.evaluaciones === null) {
      return `<div class="mt-4 space-y-2">${'<div class="h-16 animate-pulse rounded-lg bg-slate-100"></div>'.repeat(3)}</div>`;
    }
    const items =
      state.filtro === "todas"
        ? state.evaluaciones
        : state.evaluaciones.filter((e) => e.estado === state.filtro);

    const counts = {
      todas: state.evaluaciones.length,
      pendiente: state.evaluaciones.filter((e) => e.estado === "pendiente").length,
      en_progreso: state.evaluaciones.filter((e) => e.estado === "en_progreso").length,
      completada: state.evaluaciones.filter((e) => e.estado === "completada").length,
    };
    const tab = (id: State["filtro"], label: string, n: number) =>
      `<button type="button" data-filtro="${id}" class="rounded-lg px-3 py-1.5 text-sm font-medium ${
        state.filtro === id ? "bg-leoni-blue text-white" : "text-text-muted hover:bg-slate-100"
      }">${label} <span class="tabular-nums">(${n})</span></button>`;

    if (items.length === 0) {
      return `
        <div class="mt-4 flex flex-wrap gap-2">
          ${tab("todas", "Todas", counts.todas)}
          ${tab("pendiente", "Pendientes", counts.pendiente)}
          ${tab("en_progreso", "En progreso", counts.en_progreso)}
          ${tab("completada", "Finalizadas", counts.completada)}
        </div>
        <div class="mt-6 rounded-xl border border-border bg-white px-5 py-12 text-center text-sm text-text-muted">
          No tienes evaluaciones ${state.filtro !== "todas" ? "en este estado" : "asignadas"} por ahora.
        </div>`;
    }

    const rows = items
      .map((e) => {
        const puedeResponder = e.estado === "pendiente" || e.estado === "en_progreso";
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/50">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-text-primary">${escapeHtml(e.evaluado_nombre ?? "Evaluación anónima")}</p>
            <p class="text-xs text-text-muted">${escapeHtml(e.campana_nombre ?? "")}</p>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(TIPO_LABELS[e.tipo_evaluador] ?? e.tipo_evaluador)}</td>
          <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${e.fecha_limite ? escapeHtml(e.fecha_limite) : "—"}</td>
          <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-500" style="width:${Math.min(100, e.avance)}%"></div></div><span class="text-xs tabular-nums text-slate-600">${Math.round(e.avance)}%</span></div></td>
          <td class="px-4 py-3">${estadoBadge(e.estado)}</td>
          <td class="px-4 py-3 text-right">
            ${
              puedeResponder
                ? `<button type="button" class="${BTN_PRIMARY}" data-abrir="${e.id}">Responder</button>`
                : `<button type="button" class="${BTN_GHOST}" data-abrir="${e.id}">Ver</button>`
            }
          </td>
        </tr>`;
      })
      .join("");

    return `
      <div class="mt-4 flex flex-wrap gap-2">
        ${tab("todas", "Todas", counts.todas)}
        ${tab("pendiente", "Pendientes", counts.pendiente)}
        ${tab("en_progreso", "En progreso", counts.en_progreso)}
        ${tab("completada", "Finalizadas", counts.completada)}
      </div>
      <div class="mt-4 overflow-hidden rounded-xl border border-border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-3">Evaluado / Campaña</th>
                <th class="px-4 py-3">Mi rol</th>
                <th class="px-4 py-3">Fecha límite</th>
                <th class="px-4 py-3">Avance</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderEscalaRadios(preguntaId: number, valor: number | null, min: number, max: number, etiquetas: Record<string, string> | null): string {
    const opciones: string[] = [];
    for (let v = min; v <= max; v++) {
      const et = etiquetas?.[String(v)];
      opciones.push(`
        <label class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border px-2 py-2 text-center hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-light">
          <input type="radio" name="preg-${preguntaId}" data-pregunta="${preguntaId}" value="${v}" ${valor === v ? "checked" : ""} class="size-4 text-accent focus:ring-accent" />
          <span class="text-sm font-semibold tabular-nums text-text-primary">${v}</span>
          ${et ? `<span class="text-[10px] leading-tight text-text-muted">${escapeHtml(et)}</span>` : ""}
        </label>`);
    }
    return `<div class="grid gap-2" style="grid-template-columns:repeat(${max - min + 1},minmax(0,1fr))">${opciones.join("")}</div>`;
  }

  function renderDetalle(d: EvaluacionDetalleApi): string {
    const min = d.escala?.valor_min ?? 1;
    const max = d.escala?.valor_max ?? 5;
    const et = d.escala?.etiquetas ?? null;
    const readonly = d.estado === "completada";

    const bloques = d.competencias
      .map(
        (c) => `
      <section class="rounded-xl border border-border bg-white p-5">
        <header class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(c.competencia_nombre)}</h3>
          <span class="text-xs text-text-muted">Nivel esperado: ${c.nivel_esperado}</span>
        </header>
        <div class="space-y-4">
          ${c.preguntas
            .map(
              (p) => `
            <div>
              <p class="mb-2 text-sm text-text-primary">${escapeHtml(p.texto)}</p>
              <fieldset ${readonly ? "disabled" : ""}>${renderEscalaRadios(p.pregunta_id, p.valor, min, max, et)}</fieldset>
            </div>`,
            )
            .join("")}
          <div>
            <label class="mb-1 block text-xs font-medium text-text-muted">Comentario ${d.comentarios_obligatorios ? "(obligatorio)" : "(opcional)"}</label>
            <textarea data-comentario="${c.competencia_id}" rows="2" ${readonly ? "disabled" : ""} class="${FIELD_TEXTAREA}" placeholder="Observaciones sobre ${escapeHtml(c.competencia_nombre)}">${escapeHtml(c.comentario ?? "")}</textarea>
          </div>
        </div>
      </section>`,
      )
      .join("");

    return `
      <div id="mis-eval-detalle" class="space-y-4">
        <div class="flex flex-col gap-2 rounded-xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button type="button" class="mb-1 text-xs font-semibold text-accent hover:underline" data-volver>← Volver</button>
            <h2 class="text-base font-bold text-text-primary">${escapeHtml(d.evaluado_nombre ?? "Evaluación anónima")}</h2>
            <p class="text-xs text-text-muted">${escapeHtml(d.campana_nombre ?? "")} · ${escapeHtml(TIPO_LABELS[d.tipo_evaluador] ?? d.tipo_evaluador)}</p>
          </div>
          ${estadoBadge(d.estado)}
        </div>
        ${bloques}
        ${
          readonly
            ? ""
            : `<div class="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-white/95 p-4 backdrop-blur">
                <button type="button" class="${BTN_GHOST}" data-volver>Continuar después</button>
                <button type="button" class="${BTN_SECONDARY}" data-guardar ${state.saving ? "disabled" : ""}>${state.saving ? "Guardando…" : "Guardar borrador"}</button>
                <button type="button" class="${BTN_PRIMARY}" data-enviar ${state.saving ? "disabled" : ""}>Enviar evaluación</button>
              </div>`
        }
      </div>`;
  }

  function renderPage(): string {
    const msg = state.message
      ? state.message.kind === "ok"
        ? alertSuccess(state.message.text)
        : alertError(state.message.text)
      : "";
    let content: string;
    if (state.detalleLoading) {
      content = `<div class="mt-4 h-64 animate-pulse rounded-xl bg-slate-100"></div>`;
    } else if (state.detalle) {
      content = renderDetalle(state.detalle);
    } else {
      content = renderLista();
    }
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Mis Evaluaciones</h1>
        <p class="text-sm text-text-muted">Responde las evaluaciones 360° donde participas como evaluador.</p>
      </header>
      ${msg}
      ${content}
    </div>`;
  }

  function bind(): void {
    container.querySelectorAll<HTMLButtonElement>("[data-filtro]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filtro = btn.dataset.filtro as State["filtro"];
        render();
      });
    });
    container.querySelectorAll<HTMLButtonElement>("[data-abrir]").forEach((btn) => {
      btn.addEventListener("click", () => void openDetalle(Number(btn.dataset.abrir)));
    });
    container.querySelectorAll<HTMLButtonElement>("[data-volver]").forEach((btn) => {
      btn.addEventListener("click", () => volverALista());
    });
    container.querySelector<HTMLButtonElement>("[data-guardar]")?.addEventListener("click", () => void guardar());
    container.querySelector<HTMLButtonElement>("[data-enviar]")?.addEventListener("click", () => void enviar());
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Mis Evaluaciones",
      activeNav: "mis-evaluaciones",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
    bind();
  }

  render();
  void loadLista();
}
