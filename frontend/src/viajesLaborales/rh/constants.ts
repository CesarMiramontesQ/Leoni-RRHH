import type { ViajeLaboralEstado } from "../../api/viajesLaborales.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgeOpen,
  badgePending,
  badgeRejected,
} from "../../ui/uiTokens.ts";
import { labelViajeLaboralEstado } from "../rh/viajesLaboralesFilterHelpers.ts";

export function badgeHtmlViajeLaboralEstado(estado: ViajeLaboralEstado): string {
  const label = labelViajeLaboralEstado(estado);
  switch (estado) {
    case "borrador":
      return badgeOpen(label);
    case "pendiente":
      return badgePending(label);
    case "aprobado":
      return badgeApproved(label);
    case "rechazado":
      return badgeRejected(label);
    case "cancelado":
      return badgeCancelled(label);
    default:
      return badgeOpen(label);
  }
}

export function fmtViaticos(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}
