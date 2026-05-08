/**
 * Datos de la sección inferior del dashboard RH (alertas, calendario, resumen, eventos).
 * Listo para sustituir mocks por respuesta de API.
 */

export type RhPriorityAlertIcon = "document" | "calendar" | "bell";

export type RhPriorityAlertChip = {
  id: string;
  label: string;
  icon: RhPriorityAlertIcon;
};

export type RhDayLineKind = "normal" | "dieta" | "vacaciones" | "ho" | "sin_goce" | "goce_sueldo";

/** Línea compacta dentro de una celda del calendario */
export type RhCalendarDayLine = {
  kind: RhDayLineKind;
  /** Texto ya formateado, ej. "Norm. 310", "HO (52/50)" */
  text: string;
  /** Estilo relleno sólido (ej. día “HOY” destacado) */
  solid?: boolean;
  /** Variante error (límite superado) */
  danger?: boolean;
};

export type RhCalendarDayMetrics = {
  lines: RhCalendarDayLine[];
  /** Icono advertencia pequeño en la celda */
  showWarning?: boolean;
  /** Indicador adicional (ej. info / límite HO) */
  showAttention?: boolean;
};

export type RhCalendarConfig = {
  initialYear: number;
  initialMonthIndex: number;
  dayMetrics: Record<string, RhCalendarDayMetrics>;
  selectedIsoDate: string | null;
};

export type RhWeeklySummaryMetrics = {
  total_almuerzos: number | null;
  menus_dieta: number | null;
  home_office_total: number | null;
  promedio_diario: number | null;
};

export type RhUpcomingEventIcon = "umbrella" | "utensils" | "users";

export type RhUpcomingEventItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: RhUpcomingEventIcon;
};

export type RhLowerSectionPayload = {
  priority_alerts: RhPriorityAlertChip[];
  calendar: RhCalendarConfig;
  weekly_summary: RhWeeklySummaryMetrics;
  upcoming_events: RhUpcomingEventItem[];
};
