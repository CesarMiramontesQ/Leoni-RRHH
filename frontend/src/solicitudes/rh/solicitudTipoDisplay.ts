import type { RhSolicitudTipoCodigo } from "./types.ts";

/** Orden estable para leyendas y series apiladas. */
export const RH_SOLICITUD_TIPOS_ORDEN: readonly RhSolicitudTipoCodigo[] = [
  "vacaciones",
  "home_office",
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
  "permiso_sin_goce_sueldo",
];

export const RH_SOLICITUD_TIPO_LABEL: Record<RhSolicitudTipoCodigo, string> = {
  vacaciones: "Vacaciones",
  home_office: "Home office",
  matrimonio: "Matrimonio (goce)",
  incapacidad_interna: "Incapacidad interna (goce)",
  defuncion: "Defunción (goce)",
  paternidad: "Paternidad (goce)",
  permiso_sin_goce_sueldo: "Permiso sin goce de sueldo",
};

export function labelSolicitudTipo(tipo: RhSolicitudTipoCodigo): string {
  return RH_SOLICITUD_TIPO_LABEL[tipo];
}

export function emptyConteoPorTipo(): Record<RhSolicitudTipoCodigo, number> {
  return Object.fromEntries(RH_SOLICITUD_TIPOS_ORDEN.map((t) => [t, 0])) as Record<
    RhSolicitudTipoCodigo,
    number
  >;
}
