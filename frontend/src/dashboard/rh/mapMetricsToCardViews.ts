import type { RhOperationalCardId, RhOperationalMetricsPayload } from "./metricsTypes.ts";

export type RhCardAccent = "blue" | "orange" | "violet" | "sky" | "red" | "amber";

export type RhCardIconKey = "almuerzo" | "calendario" | "edificio" | "credencial" | "alerta" | "acta";

export type RhOperationalCardView = {
  id: RhOperationalCardId;
  title: string;
  /** Texto principal (número o frase corta) */
  primaryText: string;
  /** Clases Tailwind para el valor principal (peso/tamaño/color) */
  primaryClass: string;
  /** Fragmento a la derecha o tras el principal (ej. "/ 400 capacidad") */
  primarySuffix: string | null;
  /** Párrafos secundarios debajo del principal */
  secondaryHtml: string[];
  icon: RhCardIconKey;
  accent: RhCardAccent;
  progressPercent: number | null;
  progressTrackClass: string;
  progressBarClass: string;
  footerLeftHtml: string | null;
  footerRightHtml: string | null;
  footerPills: Array<{ text: string; dotClass: string }> | null;
  badgeUrgente: boolean;
  actionLink: { text: string; href: string } | null;
  showWarningGlyph: boolean;
};

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(Math.trunc(n));
}

function pct(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

function emptyPayload(): RhOperationalMetricsPayload {
  return {
    almuerzos_hoy: { total: null, capacidad_max: null, normal: null, dieta: null },
    vacaciones_pendientes: { total: null, requieren_accion_hoy: null, link_href: null },
    home_office: {
      activos_hoy: null,
      maximo: null,
      pendientes_aprobacion: null,
      variacion_porcentaje_hoy: null,
    },
    personal_externo: { por_registrar: null, mostrar_alerta: false },
    incidencias: { abiertas: null, con_seguimiento_hoy: null, urgente: false },
    actas_administrativas: { en_proceso: null, pendientes_firma: null },
  };
}

/**
 * Convierte payload de dominio (o null si falló la carga) en vistas listas para la UI.
 */
export function mapMetricsToCardViews(
  data: RhOperationalMetricsPayload | null,
): RhOperationalCardView[] {
  const m = data ?? emptyPayload();
  const a = m.almuerzos_hoy;
  const v = m.vacaciones_pendientes;
  const h = m.home_office;
  const p = m.personal_externo;
  const i = m.incidencias;
  const ac = m.actas_administrativas;

  const almuerzosPct = pct(a.total, a.capacidad_max);

  const vacacionesSecondaries: string[] = [];
  vacacionesSecondaries.push(
    `<p class="mt-1 text-sm font-semibold text-orange-600">Reclaman acción hoy: ${fmtInt(v.requieren_accion_hoy)}</p>`,
  );

  const variacion = h.variacion_porcentaje_hoy;
  const variacionHtml =
    variacion !== null && variacion !== undefined
      ? (() => {
          const sign = variacion > 0 ? "+" : "";
          const tone =
            variacion > 0 ? "text-emerald-600" : variacion < 0 ? "text-red-600" : "text-text-muted";
          return `<span class="${tone} font-semibold">${sign}${variacion}% hoy</span>`;
        })()
      : `<span class="font-semibold text-text-muted">— hoy</span>`;

  const hoSecondaries: string[] = [
    `<p class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
      <span class="font-semibold uppercase tracking-wide">Pendientes: ${fmtInt(h.pendientes_aprobacion)}</span>
      ${variacionHtml}
    </p>`,
  ];

  const personalPrimary =
    p.por_registrar !== null && p.por_registrar !== undefined && p.por_registrar > 0
      ? `${fmtInt(p.por_registrar)} ${p.por_registrar === 1 ? "persona" : "personas"} por registrar`
      : p.por_registrar === 0
        ? "0 personas por registrar"
        : "Sin datos disponibles";

  const incSecondary =
    i.con_seguimiento_hoy !== null && i.con_seguimiento_hoy !== undefined
      ? `<p class="mt-2 text-sm text-text-muted">${fmtInt(i.con_seguimiento_hoy)} con seguimiento hoy</p>`
      : `<p class="mt-2 text-sm text-text-muted">Seguimiento del día: —</p>`;

  const actasSecondary =
    ac.pendientes_firma !== null && ac.pendientes_firma !== undefined
      ? `<p class="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>${fmtInt(ac.pendientes_firma)} pendientes de firma</span>
        </p>`
      : `<p class="mt-2 text-sm text-text-muted">Pendientes de firma: —</p>`;

  const cards: RhOperationalCardView[] = [
    {
      id: "almuerzos_hoy",
      title: "Total Almuerzos Hoy",
      primaryText: fmtInt(a.total),
      primaryClass: "text-3xl font-bold tracking-tight text-text-primary",
      primarySuffix:
        a.capacidad_max !== null && a.capacidad_max !== undefined
          ? `<span class="text-base font-normal text-text-muted">/ ${fmtInt(a.capacidad_max)} capacidad</span>`
          : `<span class="text-base font-normal text-text-muted">/ — capacidad</span>`,
      secondaryHtml: [],
      icon: "almuerzo",
      accent: "blue",
      progressPercent: almuerzosPct,
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-blue-600",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills:
        a.normal !== null || a.dieta !== null
          ? [
              {
                text: `NORMAL: ${fmtInt(a.normal)}`,
                dotClass: "bg-blue-500",
              },
              {
                text: `DIETA: ${fmtInt(a.dieta)}`,
                dotClass: "bg-emerald-500",
              },
            ]
          : [
              { text: "NORMAL: —", dotClass: "bg-slate-300" },
              { text: "DIETA: —", dotClass: "bg-slate-300" },
            ],
      badgeUrgente: false,
      actionLink: null,
      showWarningGlyph: false,
    },
    {
      id: "vacaciones_pendientes",
      title: "Vacaciones Pendientes",
      primaryText: fmtInt(v.total),
      primaryClass: "text-3xl font-bold tracking-tight text-orange-600",
      primarySuffix: null,
      secondaryHtml: vacacionesSecondaries,
      icon: "calendario",
      accent: "orange",
      progressPercent: null,
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-orange-500",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills: null,
      badgeUrgente: false,
      actionLink:
        v.link_href && v.link_href.length > 0
          ? { text: "Ver solicitudes pendientes", href: v.link_href }
          : null,
      showWarningGlyph: false,
    },
    {
      id: "home_office",
      title: "Home Office",
      primaryText: fmtInt(h.activos_hoy),
      primaryClass: "text-3xl font-bold tracking-tight text-text-primary",
      primarySuffix:
        h.maximo !== null && h.maximo !== undefined
          ? `<span class="text-base font-normal text-text-muted">/ ${fmtInt(h.maximo)} máx</span>`
          : `<span class="text-base font-normal text-text-muted">/ — máx</span>`,
      secondaryHtml: hoSecondaries,
      icon: "edificio",
      accent: "violet",
      progressPercent: pct(h.activos_hoy, h.maximo),
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-violet-600",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills: null,
      badgeUrgente: false,
      actionLink: null,
      showWarningGlyph: false,
    },
    {
      id: "personal_externo",
      title: "Personal Externo",
      primaryText: personalPrimary,
      primaryClass: "text-xl font-bold tracking-tight text-text-primary",
      primarySuffix: null,
      secondaryHtml: [],
      icon: "credencial",
      accent: "sky",
      progressPercent: null,
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-sky-600",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills: null,
      badgeUrgente: false,
      actionLink: null,
      showWarningGlyph: p.mostrar_alerta,
    },
    {
      id: "incidencias",
      title: "Incidencias",
      primaryText:
        i.abiertas !== null && i.abiertas !== undefined ? `${fmtInt(i.abiertas)} abiertas` : "Sin datos disponibles",
      primaryClass: "text-xl font-bold tracking-tight text-text-primary",
      primarySuffix: null,
      secondaryHtml: [incSecondary],
      icon: "alerta",
      accent: "red",
      progressPercent: null,
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-red-600",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills: null,
      badgeUrgente: Boolean(i.urgente && (i.abiertas ?? 0) > 0),
      actionLink: null,
      showWarningGlyph: false,
    },
    {
      id: "actas_administrativas",
      title: "Actas administrativas",
      primaryText:
        ac.en_proceso !== null && ac.en_proceso !== undefined
          ? `${fmtInt(ac.en_proceso)} en proceso`
          : "Sin datos disponibles",
      primaryClass: "text-xl font-bold tracking-tight text-text-primary",
      primarySuffix: null,
      secondaryHtml: [actasSecondary],
      icon: "acta",
      accent: "amber",
      progressPercent: null,
      progressTrackClass: "bg-slate-100",
      progressBarClass: "bg-amber-500",
      footerLeftHtml: null,
      footerRightHtml: null,
      footerPills: null,
      badgeUrgente: false,
      actionLink: null,
      showWarningGlyph: false,
    },
  ];

  return cards;
}
