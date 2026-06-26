import { fetchRhPermisosMe } from "../api/rhPermisos.ts";
import { refreshAccessTokenSession } from "../api/http.ts";
import { getAccessTokenPayload } from "./jwt.ts";
import {
  isNonRhRhMode,
  isRhEmpleadoUiMode,
  isRhGestorTeamUiMode,
  isRhOperativoUiMode,
  setAdminUser,
  setRhInPermisosList,
  setRhPermisosActivos,
} from "./rhUiMode.ts";

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
  setAdminUser(false);
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
      setAdminUser(false);
      setRhInPermisosList(true);
      setRhPermisosActivos(false);
      return;
    }
    state.enrolled = data.inscrito;
    state.modules = data.inscrito ? { ...data.modulos } : {};
    state.canAdminPermisos = data.puede_administrar_permisos_rh;
    state.enListaPermisos = data.en_lista_permisos;
    setAdminUser(data.puede_administrar_permisos_rh);
    setRhInPermisosList(data.en_lista_permisos);
    setRhPermisosActivos(Object.values(state.modules).some(Boolean));
    state.loaded = true;
    if (data.puede_administrar_permisos_rh && getAccessTokenPayload()?.rh_admin !== true) {
      await refreshAccessTokenSession();
    }
  } catch {
    state.loaded = true;
    state.enrolled = false;
    state.modules = {};
    state.canAdminPermisos = false;
    // Fail-open de UI: ante error transitorio no ocultamos el toggle.
    state.enListaPermisos = true;
    setAdminUser(false);
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

/** Control de acceso RH: admin operativo, Modo RH inscrito o grant explícito. */
export function hasRhModule(moduleKey: string): boolean {
  if (state.canAdminPermisos && isRhOperativoUiMode()) return true;
  if (!state.loaded) return true;
  if (isNonRhRhMode() && state.enrolled) return state.modules[moduleKey] === true;
  return hasExplicitModuleGrant(moduleKey);
}

export function getRhModulesSnapshot(): Readonly<Record<string, boolean>> {
  return state.modules;
}
