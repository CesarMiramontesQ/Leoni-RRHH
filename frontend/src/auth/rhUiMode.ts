import { getRhGestorAlcanceFromToken, getRolFromAccessToken } from "./jwt.ts";

export type RhUiMode = "operativo" | "empleado" | "lider" | "gerente";

const STORAGE_KEY = "leoni_rh_ui_mode";
export const RH_UI_MODE_CHANGE_EVENT = "rh-ui-mode-change";

const ALL_MODES: readonly RhUiMode[] = ["operativo", "empleado", "lider", "gerente"];

function readStoredMode(): RhUiMode | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && ALL_MODES.includes(raw as RhUiMode)) return raw as RhUiMode;
  } catch {
    /* ignore */
  }
  return null;
}

function sanitizeModeForUser(mode: RhUiMode): RhUiMode {
  const alcance = getRhGestorAlcanceFromToken();
  if (alcance === "supervisor") {
    return mode === "lider" ? "lider" : "operativo";
  }
  if (alcance === "gerente") {
    return mode === "gerente" ? "gerente" : "operativo";
  }
  return mode === "empleado" ? "empleado" : "operativo";
}

/** Modo de UI para usuarios RH (default operativo). */
export function getRhUiMode(): RhUiMode {
  if (getRolFromAccessToken() !== "rh") return "operativo";
  const stored = readStoredMode() ?? "operativo";
  return sanitizeModeForUser(stored);
}

export function setRhUiMode(mode: RhUiMode): void {
  if (getRolFromAccessToken() !== "rh") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, sanitizeModeForUser(mode));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RH_UI_MODE_CHANGE_EVENT));
  }
}

export function getRhToggleOffMode(): RhUiMode {
  return "operativo";
}

export function getRhToggleOnMode(): RhUiMode {
  const alcance = getRhGestorAlcanceFromToken();
  if (alcance === "supervisor") return "lider";
  if (alcance === "gerente") return "gerente";
  return "empleado";
}

export function getRhToggleLabels(): { off: string; on: string; active: string } {
  const alcance = getRhGestorAlcanceFromToken();
  if (alcance === "supervisor") {
    return { off: "Modo RH", on: "Modo líder", active: "Modo líder" };
  }
  if (alcance === "gerente") {
    return { off: "Modo RH", on: "Modo gerente", active: "Modo gerente" };
  }
  return { off: "Modo RH", on: "Modo empleado", active: "Modo empleado" };
}

export function getRhUiModeLabel(mode: RhUiMode = getRhUiMode()): string {
  const labels = getRhToggleLabels();
  if (mode === getRhToggleOnMode()) return labels.on;
  return labels.off;
}

export function isRhToggleOn(): boolean {
  return getRhUiMode() === getRhToggleOnMode();
}

export function toggleRhUiMode(): void {
  setRhUiMode(isRhToggleOn() ? getRhToggleOffMode() : getRhToggleOnMode());
}

export function isRhEmpleadoUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "empleado";
}

export function isRhOperativoUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "operativo";
}

export function isRhLiderUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "lider";
}

export function isRhGerenteUiMode(): boolean {
  return getRolFromAccessToken() === "rh" && getRhUiMode() === "gerente";
}

export function isRhGestorTeamUiMode(): boolean {
  return isRhLiderUiMode() || isRhGerenteUiMode();
}

export function rhHasFullOperativoModules(): boolean {
  return isRhOperativoUiMode() && getRhGestorAlcanceFromToken() !== null;
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
