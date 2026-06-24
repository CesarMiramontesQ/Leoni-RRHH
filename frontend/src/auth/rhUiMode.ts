import { getRhGestorAlcanceFromToken, getRolFromAccessToken } from "./jwt.ts";

export type RhUiMode = "operativo" | "empleado" | "lider" | "gerente";

const STORAGE_KEY = "leoni_rh_ui_mode";
export const RH_UI_MODE_CHANGE_EVENT = "rh-ui-mode-change";

const ALL_MODES: readonly RhUiMode[] = ["operativo", "empleado", "lider", "gerente"];

/**
 * ¿El usuario RH aparece en la lista de administración de Permisos RH?
 * Lo empuja `rhModulePermissions` tras cargar `/me`. No afecta el toggle ni el
 * modo de UI (todo RH puede alternar Modo RH / Modo empleado).
 */
let inPermisosList = true;

export function setRhInPermisosList(value: boolean): void {
  inPermisosList = value;
}

export function isRhInPermisosList(): boolean {
  return inPermisosList;
}

// ── Modo para usuarios SIN rol RH con permisos RH asignados ──────────────────
// Sistema paralelo (no toca la lógica RH de arriba): un no-RH con >=1 permiso
// activo alterna entre su modo base (su rol) y el Modo RH (módulos asignados).

const NON_RH_MODE_KEY = "leoni_non_rh_ui_mode";

/** ¿El usuario (cualquier rol) tiene >=1 permiso RH activo? Lo empuja `rhModulePermissions`. */
let rhPermisosActivos = false;

export function setRhPermisosActivos(value: boolean): void {
  rhPermisosActivos = value;
}

export function hasRhPermisosActivos(): boolean {
  return rhPermisosActivos;
}

/** Usuario sin rol RH pero con permisos RH asignados (puede usar el toggle). */
export function isNonRhPermisosUser(): boolean {
  return getRolFromAccessToken() !== "rh" && rhPermisosActivos;
}

function readNonRhMode(): "base" | "rh" {
  try {
    const raw = sessionStorage.getItem(NON_RH_MODE_KEY);
    if (raw === "rh" || raw === "base") return raw;
  } catch {
    /* ignore */
  }
  return "base";
}

/** No-RH viendo sus módulos RH asignados (Modo RH). Default: modo base. */
export function isNonRhRhMode(): boolean {
  return isNonRhPermisosUser() && readNonRhMode() === "rh";
}

export function setNonRhRhMode(active: boolean): void {
  if (!isNonRhPermisosUser()) return;
  try {
    sessionStorage.setItem(NON_RH_MODE_KEY, active ? "rh" : "base");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RH_UI_MODE_CHANGE_EVENT));
  }
}

export function toggleNonRhRhMode(): void {
  setNonRhRhMode(!isNonRhRhMode());
}

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
  inPermisosList = true;
  rhPermisosActivos = false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(NON_RH_MODE_KEY);
  } catch {
    /* ignore */
  }
}
