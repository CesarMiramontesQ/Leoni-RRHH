/**
 * Campos adicionales mock para el detalle de solicitud (no están en la fila de tabla).
 * Sustituir por respuesta de API de detalle.
 */

export type SolicitudDetalleMockExtra = {
  id_empleado: string;
  puesto: string;
  comentario_empleado: string;
};

const EXTRAS: Readonly<Record<number, SolicitudDetalleMockExtra>> = {
  2938: {
    id_empleado: "EMP-8842",
    puesto: "Analista Sr.",
    comentario_empleado:
      "Solicitud para viaje familiar postergado desde el año pasado.",
  },
  2939: {
    id_empleado: "EMP-2201",
    puesto: "Desarrollador",
    comentario_empleado: "Home office los viernes por curso en línea.",
  },
};

export function getSolicitudDetalleMockExtra(solicitudId: number): SolicitudDetalleMockExtra {
  return (
    EXTRAS[solicitudId] ?? {
      id_empleado: `EMP-${solicitudId}`,
      puesto: "Colaborador",
      comentario_empleado: "",
    }
  );
}
