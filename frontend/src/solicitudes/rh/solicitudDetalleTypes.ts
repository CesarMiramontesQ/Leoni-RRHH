import type { RhSolicitudTipoCodigo } from "./types.ts";

/**
 * Datos de empleado mostrados en el modal de detalle (vista aprobador).
 */
export type SolicitudDetalleEmpleadoVm = {
  nombre: string;
  id_empleado: string;
  area: string;
  puesto: string;
  supervisor: string;
};

/**
 * Datos de la solicitud en el modal de detalle.
 */
export type SolicitudDetalleSolicitudVm = {
  /** Texto del badge (p. ej. tipo + estado pendiente). */
  tipo_badge: string;
  tipo_codigo: RhSolicitudTipoCodigo;
  fecha_inicio: string;
  fecha_fin: string;
  total_dias: number;
  comentario_empleado: string;
  /** null mientras carga o si TRESS falla; solo aplica a vacaciones. */
  saldo_actual: number | null;
  saldo_restante: number | null;
};

/**
 * Vista lista para renderizar el modal (solo solicitudes pendientes en apertura desde tabla).
 */
export type SolicitudDetallePendienteVm = {
  id: string;
  estado: "pending";
  empleado: SolicitudDetalleEmpleadoVm;
  solicitud: SolicitudDetalleSolicitudVm;
  comentario_interno?: string;
};

/** Acciones de decisión del aprobador. */
export type SolicitudDetalleAccion = "aprobar" | "cambios" | "rechazar";

/**
 * Shape en inglés (referencia de integración / contratos externos).
 * Mapeo 1:1 con `SolicitudDetallePendienteVm` vía `toRequestDetail`.
 */
export type RequestDetail = {
  id: string;
  status: "pending";
  employee: {
    name: string;
    employeeId: string;
    area: string;
    position: string;
    supervisor: string;
  };
  request: {
    type: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    employeeComment: string;
    currentBalance: number | null;
    remainingBalance: number | null;
  };
  internalComment?: string;
};

export function toRequestDetail(vm: SolicitudDetallePendienteVm): RequestDetail {
  return {
    id: vm.id,
    status: vm.estado,
    employee: {
      name: vm.empleado.nombre,
      employeeId: vm.empleado.id_empleado,
      area: vm.empleado.area,
      position: vm.empleado.puesto,
      supervisor: vm.empleado.supervisor,
    },
    request: {
      type: vm.solicitud.tipo_badge,
      startDate: vm.solicitud.fecha_inicio,
      endDate: vm.solicitud.fecha_fin,
      totalDays: vm.solicitud.total_dias,
      employeeComment: vm.solicitud.comentario_empleado,
      currentBalance: vm.solicitud.saldo_actual,
      remainingBalance: vm.solicitud.saldo_restante,
    },
    internalComment: vm.comentario_interno,
  };
}
