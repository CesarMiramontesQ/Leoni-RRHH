import { fetchRhPermisosMe } from "../api/rhPermisos.ts";
import {
  isRhEmpleadoUiMode,
  isRhGestorTeamUiMode,
  rhHasFullOperativoModules,
  setRhInPermisosList,
  setRhPermisosActivos,
} from "./rhUiMode.ts";
import { getAccessToken } from "./session.ts";

function getSessionRol(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const p = JSON.parse(atob(padded)) as Record<string, unknown>;
    const r = p.rol;
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

type RhModulePermissionsState = {
  loaded: boolean;
  enrolled: boolean;
  modules: Record<string, boolean>;
  canAdminPermisos: boolean;
  enListaPermisos: boolean;
};

const state: RhModulePermissionsState = {
  loaded: false,
  enrolled: false,
  modules: {},
  canAdminPermisos: false,
  enListaPermisos: true,
};

export function resetRhModulePermissions(): void {
  state.loaded = false;
  state.enrolled = false;
  state.modules = {};
  state.canAdminPermisos = false;
  state.enListaPermisos = true;
  setRhInPermisosList(true);
  setRhPermisosActivos(false);
}

export async function loadRhModulePermissions(): Promise<void> {
  try {
    const data = await fetchRhPermisosMe();
    if (!data) {
      state.loaded = true;
      state.enrolled = false;
      state.modules = {};
      state.canAdminPermisos = false;
      state.enListaPermisos = true;
      setRhInPermisosList(true);
      setRhPermisosActivos(false);
      return;
    }
    state.enrolled = data.inscrito;
    state.modules = data.inscrito ? { ...data.modulos } : {};
    state.canAdminPermisos = data.puede_administrar_permisos_rh;
    state.enListaPermisos = data.en_lista_permisos;
    setRhInPermisosList(data.en_lista_permisos);
    setRhPermisosActivos(Object.values(state.modules).some(Boolean));
    state.loaded = true;
  } catch {
    state.loaded = true;
    state.enrolled = false;
    state.modules = {};
    state.canAdminPermisos = false;
    // Fail-open de UI: ante error transitorio no ocultamos el toggle.
    state.enListaPermisos = true;
    setRhInPermisosList(true);
    setRhPermisosActivos(false);
  }
}

export function isEnListaPermisos(): boolean {
  return state.enListaPermisos;
}

export function isModulosRhEnrolled(): boolean {
  return state.enrolled;
}

/**
 * Administración de permisos: depende del flag `puede_administrar_permisos_rh`
 * (permiso), no del rol base. Cualquier usuario con el flag puede administrar.
 */
export function canAccessRhPermisosAdmin(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode()) return false;
  return state.canAdminPermisos;
}

/** Permiso explícito otorgado (cualquier rol inscrito). */
export function hasExplicitModuleGrant(moduleKey: string): boolean {
  if (!state.enrolled) return false;
  if (state.canAdminPermisos) return true;
  return state.modules[moduleKey] === true;
}

/** Control de acceso RH (restricción) o grant explícito para otros roles. */
export function hasRhModule(moduleKey: string): boolean {
  const rol = getSessionRol();
  if (state.canAdminPermisos) return true;
  if (!state.loaded) return true;

  if (rol !== "rh") {
    return hasExplicitModuleGrant(moduleKey);
  }

  if (rhHasFullOperativoModules()) return true;

  if (!state.enrolled) return true;
  return state.modules[moduleKey] === true;
}

export function getRhModulesSnapshot(): Readonly<Record<string, boolean>> {
  return state.modules;
}
