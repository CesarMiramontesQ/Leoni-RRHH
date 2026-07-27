import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml, fmtDateTimeIso } from "../ui/uiUtils.ts";
import {
  alertError,
  alertSuccess,
  badgeChangesRequested,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import {
  aprobarOpl,
  getMisAprobaciones,
  regresarOpl,
  type OPLResponse,
} from "../api/opls.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanea un href proveniente del servidor/usuario: solo permite URLs http(s)
 * absolutas o rutas internas (`/...`, sin `//host`). Rechaza `javascript:`,
 * `data:` y esquemas protocol-relative. Devuelve `null` si no es seguro.
 * (Mismo criterio que `frontend/src/pages/opls.ts`.)
 */
function safeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

function detailMsg(e: unknown): string {
  if (e && typeof e === "object" && "detail" in e) {
    const d = (e as { detail?: unknown }).detail;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return (e as Error)?.message ?? "Ocurrió un error";
}

// ── Estado de la vista ───────────────────────────────────────────────────────

interface View {
  items: OPLResponse[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  successMessage: string | null;
  busyId: number | null;
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderVersionActual(o: OPLResponse): string {
  const v = o.version_actual;
  if (!v) {
    return `<p class="text-xs text-text-muted">Sin versiones.</p>`;
  }
  const href = safeHref(v.archivo_url);
  const linkHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#1e40af] hover:underline">Abrir archivo</a>`
    : `<span class="text-xs text-text-muted">Enlace no disponible</span>`;
  const cambios = v.cambios_descripcion
    ? `<p class="mt-1 text-xs text-text-secondary">${escapeHtml(v.cambios_descripcion)}</p>`
    : "";
  return `
    <div class="rounded-lg border border-slate-200 px-3 py-2.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold text-text-primary">Versión ${v.version_num}</span>
        ${linkHtml}
      </div>
      <p class="mt-0.5 text-[11px] text-text-muted">${escapeHtml(fmtDateTimeIso(v.fecha))}</p>
      ${cambios}
    </div>`;
}

function renderCard(o: OPLResponse, busyId: number | null): string {
  const meta: string[] = [];
  if (o.proceso) meta.push(`Proceso: ${escapeHtml(o.proceso)}`);
  if (o.maquina) meta.push(`Máquina: ${escapeHtml(o.maquina)}`);
  const metaHtml = meta.length
    ? `<p class="mt-1 text-xs text-text-muted">${meta.join(" &middot; ")}</p>`
    : "";
  const busy = busyId === o.id;
  const disabled = busyId != null ? " disabled" : "";
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 px-5 py-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs font-semibold text-slate-500">${escapeHtml(o.codigo)}</span>
          ${badgeChangesRequested("En revisión")}
        </div>
        <h2 class="mt-1 text-sm font-semibold leading-snug text-text-primary">${escapeHtml(o.titulo)}</h2>
        ${metaHtml}
      </div>
      ${renderVersionActual(o)}
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button type="button" data-action="opl-regresar" data-id="${o.id}" class="${BTN_SECONDARY} text-sm"${disabled}>${busy ? "Procesando…" : "Regresar a borrador"}</button>
        <button type="button" data-action="opl-aprobar" data-id="${o.id}" class="${BTN_PRIMARY} text-sm"${disabled}>${busy ? "Procesando…" : "Aprobar"}</button>
      </div>
    </div>`;
}

function renderEmpty(): string {
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
      <p class="mt-4 text-base font-semibold text-text-primary">No tienes OPLs por aprobar</p>
      <p class="mt-1 max-w-sm text-sm text-text-muted">Cuando alguien te designe como aprobador y envíe una OPL a revisión, aparecerá aquí.</p>
    </div>`;
}

function renderContent(v: View): string {
  if (v.loading) {
    return `
      ${skeletonBlock({ className: "h-32 rounded-2xl border border-[#e5e7eb] bg-white" })}
      ${skeletonBlock({ className: "h-32 rounded-2xl border border-[#e5e7eb] bg-white" })}`;
  }
  if (v.error) {
    return errorState({ message: v.error, actionLabel: "Reintentar", actionAttrs: 'data-action="opl-retry"' });
  }
  if (v.items.length === 0) return renderEmpty();
  return `<div class="flex flex-col gap-3">${v.items.map((o) => renderCard(o, v.busyId)).join("")}</div>`;
}

function renderPage(v: View): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Aprobaciones de OPL</h1>
        <p class="text-sm text-text-muted">Revisa y aprueba las OPLs que te asignaron, o regrésalas a borrador para ajustes.</p>
      </header>
      ${v.successMessage ? alertSuccess(v.successMessage) : ""}
      ${v.actionError ? alertError(v.actionError) : ""}
      ${renderContent(v)}
    </div>`;
}

// ── Montaje ──────────────────────────────────────────────────────────────────

export function mountMisAprobaciones(container: HTMLElement, signal?: AbortSignal): void {
  const view: View = {
    items: [],
    loading: true,
    error: null,
    actionError: null,
    successMessage: null,
    busyId: null,
  };

  const render = (): void => {
    mountAppShell(container, {
      pageTitle: "Aprobaciones de OPL",
      activeNav: "mis-aprobaciones-opl",
      mainClass: "py-5 sm:py-6",
      mainHtml: renderPage(view),
    });
  };

  const load = async (): Promise<void> => {
    view.loading = true;
    view.error = null;
    render();
    try {
      const items = await getMisAprobaciones();
      if (signal?.aborted) return;
      view.items = items;
    } catch (e) {
      view.error = detailMsg(e);
    }
    if (signal?.aborted) return;
    view.loading = false;
    render();
  };

  const ejecutar = async (id: number, modo: "aprobar" | "regresar"): Promise<void> => {
    if (view.busyId != null) return;
    view.busyId = id;
    view.actionError = null;
    view.successMessage = null;
    render();
    try {
      if (modo === "aprobar") {
        await aprobarOpl(id);
      } else {
        await regresarOpl(id);
      }
      if (signal?.aborted) return;
      view.busyId = null;
      view.successMessage = modo === "aprobar" ? "OPL aprobada." : "OPL regresada a borrador.";
      await load();
    } catch (e) {
      if (signal?.aborted) return;
      view.busyId = null;
      view.actionError = detailMsg(e);
      render();
    }
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    switch (action) {
      case "opl-retry":
        void load();
        break;
      case "opl-aprobar":
        if (id) void ejecutar(id, "aprobar");
        break;
      case "opl-regresar":
        if (id) void ejecutar(id, "regresar");
        break;
      default:
        break;
    }
  };

  container.addEventListener("click", onClick, signal ? { signal } : undefined);

  void load();
}
