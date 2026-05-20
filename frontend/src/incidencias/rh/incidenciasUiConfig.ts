import { getRolFromAccessToken } from "../../auth/jwt.ts";
import type { RhIncidenciasUiConfig } from "./types.ts";

export function incidenciasUiConfig(): RhIncidenciasUiConfig {
  const rol = getRolFromAccessToken();
  if (rol === "rh") return { modoFiltros: "rh", mostrarFiltroSupervisor: true };
  if (rol === "gerente" || rol === "supervisor") return { modoFiltros: "rh", mostrarFiltroSupervisor: false };
  return { modoFiltros: "estandar", mostrarFiltroSupervisor: true };
}
