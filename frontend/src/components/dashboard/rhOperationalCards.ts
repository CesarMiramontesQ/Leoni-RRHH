import { escapeHtml } from "../vista360/html.ts";
import type { RhCardAccent, RhCardIconKey, RhOperationalCardView } from "../../dashboard/rh/mapMetricsToCardViews.ts";

const ACCENT_ICON_WRAP: Record<RhCardAccent, string> = {
  blue: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
  orange: "rh-dash-kpi-icon rh-dash-kpi-icon--orange",
  violet: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
  sky: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
  red: "rh-dash-kpi-icon rh-dash-kpi-icon--red",
  amber: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
};

function iconSvg(key: RhCardIconKey): string {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6"';
  switch (key) {
    case "almuerzo":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>`;
    case "calendario":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        <path stroke-linecap="round" stroke-linejoin="round" d="m16.5 9.75-4.5 4.5m0-4.5 4.5 4.5" />
      </svg>`;
    case "edificio":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M9.75 21V9.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M15.75 21v-6.375c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V21" />
      </svg>`;
    case "credencial":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 10.5h.75v.75H6v-.75Zm.75 3H6v-.75h.75v.75Zm-1.125 3a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 .75.75v3.75h-7.5V17.25Z" />
      </svg>`;
    case "alerta":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>`;
    case "acta":
      return `<svg ${common}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V12M10.5 2.25h5.25a1.5 1.5 0 0 1 1.5 1.5v5.25a1.5 1.5 0 0 1-1.5 1.5H10.5m0-8.25v8.25" />
      </svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="9" /></svg>`;
  }
}

function renderProgress(
  percent: number,
  trackClass: string,
  barClass: string,
): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div class="mt-4">
      <div class="h-2 w-full overflow-hidden rounded-full ${trackClass}" role="progressbar" aria-valuenow="${clamped}" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full ${barClass} transition-all" style="width:${clamped}%"></div>
      </div>
    </div>`;
}

function renderCard(view: RhOperationalCardView): string {
  const wrap = ACCENT_ICON_WRAP[view.accent];
  const primary = escapeHtml(view.primaryText);
  const suffix = view.primarySuffix ?? "";
  const pills =
    view.footerPills?.map((p) => {
      const t = escapeHtml(p.text);
      return `
        <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary">
          <span class="size-1.5 shrink-0 rounded-full ${p.dotClass}" aria-hidden="true"></span>
          ${t}
        </span>`;
    }).join("") ?? "";

  const badge = view.badgeUrgente
    ? `<span class="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Urgente</span>`
    : "";

  const action =
    view.actionLink !== null
      ? `<a href="${escapeHtml(view.actionLink.href)}" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-leoni-blue hover:text-leoni-blue-light">
          ${escapeHtml(view.actionLink.text)}
          <span aria-hidden="true">›</span>
        </a>`
      : "";

  const warning =
    view.showWarningGlyph
      ? `<div class="mt-3 flex items-center gap-1.5 text-amber-600" title="Atención requerida">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span class="text-xs font-medium text-text-muted">Revise el registro de personal externo</span>
        </div>`
      : "";

  const progress =
    view.progressPercent !== null
      ? renderProgress(view.progressPercent, view.progressTrackClass, view.progressBarClass)
      : "";

  const primaryRow =
    view.id === "incidencias"
      ? `<div class="mt-2 flex flex-wrap items-center gap-2">
          <p class="${view.primaryClass}">${primary}</p>
          ${badge}
        </div>`
      : `<p class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="${view.primaryClass}">${primary}</span>
          ${suffix}
        </p>`;

  return `
    <article class="rh-dash-kpi-card flex h-full flex-col rounded-[18px] p-5" data-rh-card="${view.id}">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-medium text-text-muted">${escapeHtml(view.title)}</h2>
        <div class="flex shrink-0 rounded-[14px] p-2 ${wrap}" aria-hidden="true">
          ${iconSvg(view.icon)}
        </div>
      </div>
      ${primaryRow}
      ${view.secondaryHtml.join("")}
      ${progress}
      ${
        pills
          ? `<div class="mt-4 flex flex-wrap gap-2">${pills}</div>`
          : ""
      }
      ${action}
      ${warning}
    </article>`;
}

export function renderRhOperationalDashboardIntro(): string {
  return `
    <div class="mb-6">
      <p class="text-sm text-text-muted">Resumen operativo del día. Los datos se actualizarán automáticamente cuando los módulos estén conectados.</p>
    </div>`;
}

export function renderRhOperationalDashboardGrid(views: RhOperationalCardView[]): string {
  const cards = views.map(renderCard).join("");
  return `
    ${renderRhOperationalDashboardIntro()}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${cards}
    </div>`;
}

export function renderRhDashboardSkeletonGrid(): string {
  const cell = `
    <div class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="flex justify-between gap-3">
        <div class="h-4 w-40 rounded bg-slate-200"></div>
        <div class="size-10 rounded-xl bg-slate-200"></div>
      </div>
      <div class="mt-4 h-8 w-24 rounded bg-slate-200"></div>
      <div class="mt-3 h-3 w-full rounded bg-slate-100"></div>
      <div class="mt-4 h-6 w-32 rounded bg-slate-100"></div>
    </div>`;
  return `
    <div class="mb-6">
      <div class="h-4 max-w-xl animate-pulse rounded bg-slate-200"></div>
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${cell.repeat(6)}
    </div>`;
}
