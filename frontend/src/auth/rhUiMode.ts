import { getRolFromAccessToken } from "./jwt.ts";

export type RhUiMode = "operativo" | "empleado";

const STORAGE_KEY = "leoni_rh_ui_mode";
export const RH_UI_MODE_CHANGE_EVENT = "rh-ui-mode-change";

function readStoredMode(): RhUiMode | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === "operativo" || raw === "empleado") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/** Modo de UI para usuarios RH (default operativo). */
export function getRhUiMode(): RhUiMode {
  if (getRolFromAccessToken() !== "rh") return "operativo";
  return readStoredMode() ?? "operativo";
}

export function setRhUiMode(mode: RhUiMode): void {
  if (getRolFromAccessToken() !== "rh") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RH_UI_MODE_CHANGE_EVENT));
  }
}

export function isRhEmpleadoUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "empleado";
}

export function isRhOperativoUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "operativo";
}

/** Valor del header `X-RH-UI-Mode` para requests autenticados RH. */
export function getRhUiModeHeaderValue(): string | null {
  if (getRolFromAccessToken() !== "rh") return null;
  return getRhUiMode();
}

export function resetRhUiMode(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
