import { getEmpleadoDirectoryNumericIdFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertSuccess,
  badgePending,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_TEXTAREA,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
} from "../ui/uiTokens.ts";
import { firmar, getMisFirmas } from "../api/evidencias.ts";
import type { EvidenciaResponse, FirmaItem } from "../api/evidencias.ts";

const TIPO_LABELS: Record<string, string> = {
  foto: "Foto",
  documento: "Documento",
  video: "Video",
  firma: "Firma",
};

/**
 * Solo tratamos como enlace navegable las URLs http(s) o rutas absolutas del
 * mismo sitio. Rechazamos las protocolo-relativas (`//host`) para que un valor
 * externo no se convierta en un link off-site que evada el guard.
 * (Mismo guard que `frontend/src/pages/evidencias.ts`.)
 */
function safeHref(url: string): string | null {
  const t = url.trim();
  if (t.startsWith("//")) return null;
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) return t;
  return null;
}

function archivoLink(url: string): string {
  const href = safeHref(url);
  if (!href) {
    return `<span class="text-xs text-slate-600 break-all">${escapeHtml(url)}</span>`;
  }
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sm font-medium text-leoni-blue underline decoration-slate-300 underline-offset-2 hover:decoration-leoni-blue break-all">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
    Abrir evidencia
  </a>`;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function mountMisFirmas(container: HTMLElement, signal?: AbortSignal): void {
  const myId = getEmpleadoDirectoryNumericIdFromAccessToken();

  interface State {
    items: EvidenciaResponse[];
    loading: boolean;
    error: string | null;
    submittingFirmaId: number | null;
    comentarios: Map<number, string>;
    successMessage: string | null;
  }

  const state: State = {
    items: [],
    loading: true,
    error: null,
    submittingFirmaId: null,
    comentarios: new Map(),
    successMessage: null,
  };

  /** Fila de firma que le toca al usuario en sesión (pendiente). */
  function miFirma(ev: EvidenciaResponse): FirmaItem | null {
    if (myId != null) {
      const propia = ev.firmas.find((f) => f.firmante_id === myId && f.estado === "pendiente");
      if (propia) return propia;
    }
    const pendientes = ev.firmas.filter((f) => f.estado === "pendiente");
    return pendientes.length === 1 ? pendientes[0]! : null;
  }

  async function load(): Promise<void> {
    state.loading = true;
    render();
    try {
      state.items = await getMisFirmas();
      state.error = null;
    } catch (err: unknown) {
      state.error =
        (err as { detail?: string })?.detail ??
        (err as Error)?.message ??
        "No se pudieron cargar tus firmas pendientes";
    }
    state.loading = false;
    render();
  }

  function renderCard(ev: EvidenciaResponse): string {
    const firma = miFirma(ev);
    const comentario = firma ? state.comentarios.get(firma.id) ?? "" : "";
    const submitting = firma != null && state.submittingFirmaId === firma.id;
    const tipoLabel = TIPO_LABELS[ev.tipo] ?? ev.tipo;

    const acciones = firma
      ? `
      <div class="mt-4 flex flex-col gap-3">
        <div>
          <label for="firma-comentario-${firma.id}" class="mb-1 block text-sm font-semibold text-text-primary">Comentario (opcional)</label>
          <textarea id="firma-comentario-${firma.id}" data-action="comentario" data-firma="${firma.id}" rows="2"
            class="${FIELD_TEXTAREA}" placeholder="Agrega una nota para RH…"${submitting ? " disabled" : ""}>${escapeHtml(comentario)}</textarea>
        </div>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" data-action="rechazar" data-firma="${firma.id}" class="${BTN_DANGER} w-full sm:w-auto"${submitting ? " disabled" : ""}>
            ${submitting ? "Enviando…" : "Rechazar"}
          </button>
          <button type="button" data-action="firmar" data-firma="${firma.id}" class="${BTN_PRIMARY} w-full sm:w-auto"${submitting ? " disabled" : ""}>
            ${submitting ? "Enviando…" : "Firmar"}
          </button>
        </div>
      </div>`
      : `<p class="mt-4 text-sm text-text-muted">No se encontró tu firma pendiente para esta evidencia.</p>`;

    return `
    <article class="${RH_LISTADO_SURFACE} px-5 py-4 sm:px-6">
      <div class="flex flex-col gap-1 border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(tipoLabel)}</span>
          ${badgePending("Tu firma pendiente")}
        </div>
        <h2 class="text-lg font-bold text-text-primary">${escapeHtml(ev.capacitacion_nombre ?? "Capacitación sin nombre")}</h2>
        <p class="text-xs text-text-secondary">
          Empleado evaluado: <span class="font-medium text-text-primary">${escapeHtml(ev.empleado_nombre ?? `#${ev.empleado_id}`)}</span>
          · Subida el ${escapeHtml(fmtFecha(ev.fecha_subida))}
        </p>
      </div>
      <div class="flex flex-col gap-2 pt-3">
        ${ev.notas ? `<p class="text-sm text-text-secondary"><span class="font-semibold text-text-primary">Notas:</span> ${escapeHtml(ev.notas)}</p>` : ""}
        <div>${archivoLink(ev.archivo_url)}</div>
      </div>
      ${acciones}
    </article>`;
  }

  function renderEmpty(): string {
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
      <p class="mt-4 text-base font-semibold text-text-primary">No tienes firmas pendientes</p>
      <p class="mt-1 max-w-sm text-sm text-text-muted">Cuando RH te asigne una evidencia de capacitación para firmar, aparecerá aquí.</p>
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
    if (state.items.length === 0) return renderEmpty();
    return `<div class="flex flex-col gap-3">${state.items.map(renderCard).join("")}</div>`;
  }

  function renderPage(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Mis firmas pendientes</h1>
        <p class="text-sm text-text-muted">Revisa y firma las evidencias de capacitación que RH te asignó.</p>
      </header>
      ${state.successMessage ? alertSuccess(state.successMessage) : ""}
      ${renderContent()}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Mis firmas",
      activeNav: "mis-firmas",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(),
    });
  }

  async function submit(firmaId: number, estado: "firmada" | "rechazada"): Promise<void> {
    if (state.submittingFirmaId != null) return;
    state.submittingFirmaId = firmaId;
    state.successMessage = null;
    state.error = null;
    render();
    try {
      const comentario = state.comentarios.get(firmaId)?.trim() || null;
      await firmar(firmaId, { estado, comentario });
      state.comentarios.delete(firmaId);
      state.submittingFirmaId = null;
      state.successMessage =
        estado === "firmada" ? "Evidencia firmada correctamente." : "Evidencia rechazada.";
      await load();
    } catch (err: unknown) {
      state.submittingFirmaId = null;
      state.error =
        (err as { detail?: string })?.detail ??
        (err as Error)?.message ??
        "No se pudo registrar tu respuesta";
      render();
    }
  }

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "reload") {
      void load();
      return;
    }
    if (action === "firmar" || action === "rechazar") {
      const firmaId = Number(actionEl.dataset.firma);
      if (Number.isFinite(firmaId)) {
        void submit(firmaId, action === "firmar" ? "firmada" : "rechazada");
      }
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement && t.dataset.action === "comentario") {
      const firmaId = Number(t.dataset.firma);
      if (Number.isFinite(firmaId)) state.comentarios.set(firmaId, t.value);
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal });
  container.addEventListener("input", handleInput, { signal });

  void load();
}
