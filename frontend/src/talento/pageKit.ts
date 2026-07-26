/**
 * Kit visual compartido del hub Talento: shell, eyebrow y KPI cards alineados
 * al design system (Layout A/B + `rh-dash-kpi-card`), para no duplicar markup
 * entre dashboard, listados RH y vistas empleado.
 */
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
} from "../ui/uiTokens.ts";

export type TalentoKpiAccent = "blue" | "sky" | "violet" | "amber" | "red" | "slate" | "orange";

export type TalentoKpiCardOpts = {
  label: string;
  value: string;
  sub?: string;
  /** SVG HTML (stroke icons size-6). Si se omite, no se pinta icon wrap. */
  icon?: string;
  accent?: TalentoKpiAccent;
  valueClass?: string;
  cardClass?: string;
  /** Contenido extra bajo el subtítulo (p. ej. barra de distribución). */
  extra?: string;
};

const ACCENT_WRAP: Record<TalentoKpiAccent, string> = {
  blue: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
  sky: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
  violet: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
  amber: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
  red: "rh-dash-kpi-icon rh-dash-kpi-icon--red",
  slate: "rh-dash-kpi-icon rh-dash-kpi-icon--slate",
  orange: "rh-dash-kpi-icon rh-dash-kpi-icon--orange",
};

/** Iconos KPI reutilizables (stroke 1.5, size-6). */
export const TALENTO_KPI_ICONS = {
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`,
  academic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>`,
  document: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.199 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745-1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>`,
} as const;

/**
 * Contenedor de página Talento. Por defecto: listado sobre degradado del shell.
 * Con `dashboard: true` envuelve además en `RH_DASHBOARD_PAGE_SHELL`.
 */
export function talentoPageRoot(innerHtml: string, opts?: { dashboard?: boolean; rootId?: string }): string {
  const idAttr = opts?.rootId ? ` id="${escapeHtml(opts.rootId)}"` : "";
  const inner = `<div${idAttr} class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">${innerHtml}</div>`;
  if (opts?.dashboard) {
    return `<div class="${RH_DASHBOARD_PAGE_SHELL}">${inner}</div>`;
  }
  return inner;
}

/** Eyebrow / breadcrumb textual encima del `pageHeading`. */
export function talentoEyebrow(text = "Talento"): string {
  return `<p class="text-xs font-medium text-text-muted">${escapeHtml(text)}</p>`;
}

export function talentoKpiSkeleton(): string {
  return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="h-3.5 w-28 rounded-md bg-slate-200/90"></div>
      <div class="h-11 w-11 rounded-xl bg-slate-200/80"></div>
    </div>
    <div class="mt-4 h-10 w-16 rounded-md bg-slate-100/90"></div>
  </article>`;
}

export function talentoKpiCard(opts: TalentoKpiCardOpts): string {
  const accent = opts.accent ?? "blue";
  const iconHtml =
    opts.icon != null && opts.icon !== ""
      ? `<span class="${ACCENT_WRAP[accent]} size-11 shrink-0 [&_svg]:size-5">${opts.icon}</span>`
      : "";
  const sub = opts.sub
    ? `<p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(opts.sub)}</p>`
    : "";
  const valueClass = opts.valueClass ? ` ${opts.valueClass}` : "";
  const cardClass = opts.cardClass ? ` ${opts.cardClass}` : "";
  return `<article class="rh-dash-kpi-card rounded-[18px] p-5${cardClass}">
    <div class="flex items-start justify-between gap-3">
      <p class="text-xs font-semibold text-text-muted">${escapeHtml(opts.label)}</p>
      ${iconHtml}
    </div>
    <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary${valueClass}">${escapeHtml(opts.value)}</p>
    ${sub}${opts.extra ?? ""}
  </article>`;
}

export function talentoKpiGrid(
  cardsHtml: string,
  opts?: { cols?: "4" | "5"; ariaLabel?: string },
): string {
  const cols = opts?.cols === "5" ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4";
  const label = opts?.ariaLabel ?? "Indicadores";
  return `<div class="grid grid-cols-1 gap-3 ${cols}" role="group" aria-label="${escapeHtml(label)}">${cardsHtml}</div>`;
}

/** Panel tonal para detalle expandible (evita card-dentro-de-card con sombra). */
export function talentoDetailPanel(innerHtml: string): string {
  return `<div class="rounded-xl border border-border bg-active-tint/40 p-4 sm:p-5">${innerHtml}</div>`;
}

/** Surface de tabla / listado estándar del hub. */
export function talentoTableSurface(innerHtml: string, extraClass = ""): string {
  const cls = extraClass ? `${RH_LISTADO_SURFACE} ${extraClass}` : RH_LISTADO_SURFACE;
  return `<div class="${cls}">${innerHtml}</div>`;
}
