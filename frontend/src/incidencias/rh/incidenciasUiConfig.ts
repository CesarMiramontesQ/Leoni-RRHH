import { getRolFromAccessToken } from "../../auth/jwt.ts";
import type { RhIncidenciasUiConfig } from "./types.ts";

export function incidenciasUiConfig(): RhIncidenciasUiConfig {
  const rol = getRolFromAccessToken();
  const mostrarTarjetasEstadisticas = rol !== "supervisor";
  if (rol === "rh") {
    return { modoFiltros: "rh", mostrarFiltroSupervisor: true, mostrarTarjetasEstadisticas };
  }
  if (rol === "gerente" || rol === "supervisor") {
    return { modoFiltros: "rh", mostrarFiltroSupervisor: false, mostrarTarjetasEstadisticas };
  }
  return { modoFiltros: "estandar", mostrarFiltroSupervisor: true, mostrarTarjetasEstadisticas };
}
