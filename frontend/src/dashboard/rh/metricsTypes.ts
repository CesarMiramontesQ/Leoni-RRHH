/**
 * Forma de datos lista para futura API de métricas operativas (RH).
 * Valores `null` = dato no disponible (mostrar — / Sin datos sin romper layout).
 */

export type RhOperationalCardId =
  | "almuerzos_hoy"
  | "vacaciones_pendientes"
  | "home_office"
  | "personal_externo"
  | "incidencias"
  | "actas_administrativas";

export type RhOperationalMetricsPayload = {
  almuerzos_hoy: {
    total: number | null;
    capacidad_max: number | null;
    normal: number | null;
    dieta: number | null;
  };
  vacaciones_pendientes: {
    total: number | null;
    requieren_accion_hoy: number | null;
    /** Hash o URL relativa cuando exista el listado filtrado */
    link_href: string | null;
  };
  home_office: {
    activos_hoy: number | null;
    maximo: number | null;
    pendientes_aprobacion: number | null;
    /** Ej. 10 = +10% respecto al día anterior */
    variacion_porcentaje_hoy: number | null;
  };
  personal_externo: {
    por_registrar: number | null;
    mostrar_alerta: boolean;
  };
  incidencias: {
    abiertas: number | null;
    con_seguimiento_hoy: number | null;
    urgente: boolean;
  };
  actas_administrativas: {
    en_proceso: number | null;
    pendientes_firma: number | null;
  };
};
