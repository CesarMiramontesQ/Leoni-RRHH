import type { RhOperationalMetricsPayload } from "./metricsTypes.ts";

/**
 * Datos de demostración desacoplados del componente de presentación.
 * Sustituir por respuesta real en `fetchRhDashboardMetrics`.
 */
export const MOCK_RH_OPERATIONAL_METRICS: RhOperationalMetricsPayload = {
  almuerzos_hoy: {
    total: 342,
    capacidad_max: 400,
    normal: 280,
    dieta: 62,
  },
  vacaciones_pendientes: {
    total: 15,
    requieren_accion_hoy: 5,
    link_href: "#",
  },
  home_office: {
    activos_hoy: 28,
    maximo: 50,
    pendientes_aprobacion: 4,
    variacion_porcentaje_hoy: 10,
  },
  personal_externo: {
    por_registrar: 4,
    mostrar_alerta: true,
  },
  incidencias: {
    abiertas: 8,
    con_seguimiento_hoy: 3,
    urgente: true,
  },
  actas_administrativas: {
    en_proceso: 5,
    pendientes_firma: 2,
  },
};

/** Payload con todo `null` para pruebas de vacíos o error de red. */
export const EMPTY_RH_OPERATIONAL_METRICS: RhOperationalMetricsPayload = {
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
