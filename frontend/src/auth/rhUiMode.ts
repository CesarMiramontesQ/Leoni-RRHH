import { getAccessTokenPayload, getRhGestorAlcanceFromToken, getRolFromAccessToken } from "./jwt.ts";

export type RhUiMode = "operativo" | "empleado" | "lider" | "gerente" | "director";

const STORAGE_KEY = "leoni_rh_ui_mode";
export const RH_UI_MODE_CHANGE_EVENT = "rh-ui-mode-change";

const ALL_MODES: readonly RhUiMode[] = ["operativo", "empleado", "lider", "gerente", "director"];

/**
 * Flag ADMIN (`puede_administrar_permisos_rh`). Lo empuja `rhModulePermissions` tras
 * cargar `/me`; también se lee del claim JWT `rh_admin` como respaldo inmediato.
 */
let adminUserFlag = false;

export function setAdminUser(value: boolean): void {
  adminUserFlag = value;
}

/** Usuario ADMIN: ve la vista RH operativa por defecto y puede alternar a su rol operativo. */
export function isAdminUser(): boolean {
  if (adminUserFlag) return true;
  return getAccessTokenPayload()?.rh_admin === true;
}

/**
 * ¿El usuario aparece en la lista de administración de Permisos RH?
 * Lo empuja `rhModulePermissions` tras cargar `/me`. No afecta el toggle ni el
 * modo de UI (todo ADMIN puede alternar Modo RH / Modo operativo).
 */
let inPermisosList = true;

export function setRhInPermisosList(value: boolean): void {
  inPermisosList = value;
}

export function isRhInPermisosList(): boolean {
  return inPermisosList;
}

// ── Modo para usuarios SIN flag ADMIN con permisos RH asignados ──────────────
// Sistema paralelo: un no-ADMIN con >=1 permiso activo alterna entre su modo base
// (su rol) y el Modo RH (módulos asignados).

const NON_RH_MODE_KEY = "leoni_non_rh_ui_mode";

/** ¿El usuario (cualquier rol) tiene >=1 permiso RH activo? Lo empuja `rhModulePermissions`. */
let rhPermisosActivos = false;

export function setRhPermisosActivos(value: boolean): void {
  rhPermisosActivos = value;
}

export function hasRhPermisosActivos(): boolean {
  return rhPermisosActivos;
}

/** Usuario sin flag ADMIN pero con permisos RH asignados (puede usar el toggle). */
export function isNonRhPermisosUser(): boolean {
  return !isAdminUser() && rhPermisosActivos;
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

/** No-ADMIN viendo sus módulos RH asignados (Modo RH). Default: modo base. */
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

/** Modo operativo del toggle según el rol JWT del ADMIN (no asume ADMIN como rol). */
export function getAdminOperationalUiMode(): RhUiMode {
  const rol = getRolFromAccessToken();
  if (rol === "gerente") return "gerente";
  if (rol === "supervisor") return "lider";
  if (rol === "director") return "director";
  if (rol === "empleado") return "empleado";
  const alcance = getRhGestorAlcanceFromToken();
  if (alcance === "supervisor") return "lider";
  if (alcance === "gerente") return "gerente";
  return "empleado";
}

function sanitizeModeForUser(mode: RhUiMode): RhUiMode {
  const operational = getAdminOperationalUiMode();
  if (mode === "operativo" || mode === operational) return mode;
  return "operativo";
}

/** Modo de UI para usuarios ADMIN (default operativo = vista RH). */
export function getRhUiMode(): RhUiMode {
  if (!isAdminUser()) return "operativo";
  const stored = readStoredMode() ?? "operativo";
  return sanitizeModeForUser(stored);
}

export function setRhUiMode(mode: RhUiMode): void {
  if (!isAdminUser()) return;
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
  return getAdminOperationalUiMode();
}

const OPERATIONAL_MODE_LABELS: Record<RhUiMode, string> = {
  operativo: "Modo RH",
  empleado: "Modo empleado",
  lider: "Modo líder",
  gerente: "Modo gerente",
  director: "Modo director",
};

export function getRhToggleLabels(): { off: string; on: string; active: string } {
  const on = OPERATIONAL_MODE_LABELS[getAdminOperationalUiMode()];
  return { off: "Modo RH", on, active: on };
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
  return isAdminUser() && getRhUiMode() === "empleado";
}

export function isRhOperativoUiMode(): boolean {
  return isAdminUser() && getRhUiMode() === "operativo";
}

export function isRhLiderUiMode(): boolean {
  return isAdminUser() && getRhUiMode() === "lider";
}

export function isRhGerenteUiMode(): boolean {
  return isAdminUser() && getRhUiMode() === "gerente";
}

export function isRhDirectorUiMode(): boolean {
  return isAdminUser() && getRhUiMode() === "director";
}

export function isRhGestorTeamUiMode(): boolean {
  return isRhLiderUiMode() || isRhGerenteUiMode();
}

export function rhHasFullOperativoModules(): boolean {
  return isRhOperativoUiMode() && getRhGestorAlcanceFromToken() !== null;
}

/** Valor del header `X-RH-UI-Mode` para usuarios ADMIN autenticados. */
export function getRhUiModeHeaderValue(): string | null {
  if (!isAdminUser()) return null;
  return getRhUiMode();
}

export function resetRhUiMode(): void {
  adminUserFlag = false;
  inPermisosList = true;
  rhPermisosActivos = false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(NON_RH_MODE_KEY);
  } catch {
    /* ignore */
  }
}
