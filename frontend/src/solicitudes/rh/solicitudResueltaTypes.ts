import type { RhSolicitudTipoCodigo } from "./types.ts";

/** Tipo de hito en la línea de tiempo (presentación). */
export type SolicitudHistorialTipo =
  | "creada"
  | "revisada"
  | "aprobada"
  | "rechazada"
  | "firma_pendiente"
  | "finalizada";

export type SolicitudHistorialItemVm = {
  id: string;
  tipo: SolicitudHistorialTipo;
  titulo: string;
  actor_nombre: string;
  actor_rol: string;
  comentario?: string;
  /** Texto ya formateado para UI (fecha y hora). */
  fecha_hora: string;
};

/** Estado binario para UI (aprobada incluye override de tabla). */
export type SolicitudResueltaEstadoUi = "aprobada" | "rechazada";

/**
 * Vista de detalle de solicitud resuelta (consulta, sin decisión).
 */
export type SolicitudResueltaDetalleVm = {
  id: string;
  titulo: string;
  id_etiqueta: string;
  estado_ui: SolicitudResueltaEstadoUi;
  tipo_codigo: RhSolicitudTipoCodigo;
  empleado_nombre: string;
  tipo_ausencia: string;
  departamento: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_dias: number;
  actualizado_en: string;
  actualizado_relativo?: string;
  motivo_rechazo?: string;
  comentario_rechazo_largo?: string;
  rechazado_por?: string;
  fecha_rechazo?: string;
  siguiente_paso?: string;
  puede_firmar: boolean;
  puede_cancelar: boolean;
  proceso_completado: boolean;
  comprobante_disponible: boolean;
  historial: SolicitudHistorialItemVm[];
};

// —— Contratos en inglés (integración / docs) ——————————————————————————————

export type RequestStatus = "approved" | "rejected";

export type ApprovalTimelineItemType =
  | "created"
  | "reviewed"
  | "approved"
  | "rejected"
  | "pending_signature"
  | "finalized";

export type ApprovalTimelineItem = {
  id: string;
  type: ApprovalTimelineItemType;
  title: string;
  actorName: string;
  actorRole: string;
  comment?: string;
  date: string;
};

export type ResolvedRequestDetail = {
  id: string;
  title: string;
  status: RequestStatus;
  employeeName: string;
  requestType: string;
  department: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  updatedAt: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  nextStep?: string;
  canSign?: boolean;
  canCancel?: boolean;
  timeline: ApprovalTimelineItem[];
};

function mapHistorialTipoToEn(t: SolicitudHistorialTipo): ApprovalTimelineItemType {
  const m: Record<SolicitudHistorialTipo, ApprovalTimelineItemType> = {
    creada: "created",
    revisada: "reviewed",
    aprobada: "approved",
    rechazada: "rejected",
    firma_pendiente: "pending_signature",
    finalizada: "finalized",
  };
  return m[t];
}

export function toResolvedRequestDetail(vm: SolicitudResueltaDetalleVm): ResolvedRequestDetail {
  const status: RequestStatus = vm.estado_ui === "aprobada" ? "approved" : "rejected";
  return {
    id: vm.id,
    title: vm.titulo,
    status,
    employeeName: vm.empleado_nombre,
    requestType: vm.tipo_ausencia,
    department: vm.departamento,
    startDate: vm.fecha_inicio,
    endDate: vm.fecha_fin,
    totalDays: vm.total_dias,
    updatedAt: vm.actualizado_en,
    rejectionReason: vm.motivo_rechazo,
    rejectedBy: vm.rechazado_por,
    rejectedAt: vm.fecha_rechazo,
    nextStep: vm.siguiente_paso,
    canSign: vm.puede_firmar,
    canCancel: vm.puede_cancelar,
    timeline: vm.historial.map((h) => ({
      id: h.id,
      type: mapHistorialTipoToEn(h.tipo),
      title: h.titulo,
      actorName: h.actor_nombre,
      actorRole: h.actor_rol,
      comment: h.comentario,
      date: h.fecha_hora,
    })),
  };
}
