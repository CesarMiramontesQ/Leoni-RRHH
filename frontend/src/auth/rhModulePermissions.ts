import { fetchRhPermisosMe } from "../api/rhPermisos.ts";
import { refreshAccessTokenSession } from "../api/http.ts";
import { getAccessTokenPayload } from "./jwt.ts";
import {
  isAdminUser,
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
  enListaPermisos: boolean;
};

/** Claves legacy → hijas (alineado con app/core/rh_module_registry.py). */
const LEGACY_MODULE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  comedor: ["comedor-registro", "comedor-ajustes", "comedor-planear"],
  puestos: ["puestos-ajustes"],
  cursos: [
    "cursos-seguimiento",
    "sesiones",
    "cursos-ajustes",
    "juntas",
    "proveedores-externos",
    "cursos-externos",
    "cursos-vencimientos",
  ],
  "level-up": ["evaluacion-360"],
};

function moduleGranted(moduleKey: string): boolean {
  if (state.modules[moduleKey] === true) return true;
  for (const [legacy, targets] of Object.entries(LEGACY_MODULE_ALIASES)) {
    if (targets.includes(moduleKey) && state.modules[legacy] === true) return true;
  }
  return false;
}

const state: RhModulePermissionsState = {
  loaded: false,
  enrolled: false,
  modules: {},
  enListaPermisos: true,
};

export function resetRhModulePermissions(): void {
  state.loaded = false;
  state.enrolled = false;
  state.modules = {};
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
      state.enListaPermisos = true;
      setAdminUser(false);
      setRhInPermisosList(true);
      setRhPermisosActivos(false);
      return;
    }
    state.enrolled = data.inscrito;
    state.modules = data.inscrito ? { ...data.modulos } : {};
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

/** Administración de permisos RH: solo usuarios admin en modo operativo/lider/gerente. */
export function canAccessRhPermisosAdmin(): boolean {
  if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode()) return false;
  return isAdminUser();
}

/** Permiso explícito otorgado (cualquier rol inscrito). */
export function hasExplicitModuleGrant(moduleKey: string): boolean {
  if (!state.enrolled) return false;
  if (isAdminUser()) return true;
  return moduleGranted(moduleKey);
}

/** Control de acceso RH: admin operativo, Modo RH inscrito o grant explícito. */
export function hasRhModule(moduleKey: string): boolean {
  if (isAdminUser() && isRhOperativoUiMode()) return true;
  if (!state.loaded) return true;
  if (isNonRhRhMode() && state.enrolled) return moduleGranted(moduleKey);
  return hasExplicitModuleGrant(moduleKey);
}

export function getRhModulesSnapshot(): Readonly<Record<string, boolean>> {
  return state.modules;
}
