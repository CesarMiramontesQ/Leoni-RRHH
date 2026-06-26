import { getEffectiveGestorNavRol, getRolFromAccessToken, hasRhOperativeViewerContext } from "../../auth/jwt.ts";
import type { RhIncidenciasUiConfig } from "./types.ts";

export function incidenciasUiConfig(): RhIncidenciasUiConfig {
  const rol = getEffectiveGestorNavRol() ?? getRolFromAccessToken();
  if (hasRhOperativeViewerContext()) {
    return { modoFiltros: "rh", mostrarFiltroSupervisor: true, mostrarTarjetasEstadisticas: true };
  }
  if (rol === "gerente" || rol === "supervisor") {
    return { modoFiltros: "rh", mostrarFiltroSupervisor: false, mostrarTarjetasEstadisticas };
  }
  return { modoFiltros: "estandar", mostrarFiltroSupervisor: true, mostrarTarjetasEstadisticas };
}
