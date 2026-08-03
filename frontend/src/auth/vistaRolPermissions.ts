/**
 * Estado de las vistas habilitadas para el rol del usuario.
 *
 * Se carga al arrancar (`main.ts`) y tras el login, en paralelo con
 * `loadRhModulePermissions`. A diferencia de los permisos por módulo, esta
 * configuración NO viaja en el JWT: un cambio del admin RH aplica sin re-login.
 */
import { fetchVistasRolMe } from "../api/vistasRol.ts";
import { navItemToVistaKey, resolveVistaFromHash } from "./vistaRolRegistry.ts";

type VistaRolState = {
  loaded: boolean;
  /** false para admin RH y roles fuera del alcance: no se les aplica el gate. */
  configurable: boolean;
  vistas: Record<string, boolean>;
};

const state: VistaRolState = {
  loaded: false,
  configurable: false,
  vistas: {},
};

export function resetVistasRol(): void {
  state.loaded = false;
  state.configurable = false;
  state.vistas = {};
}

export async function loadVistasRol(): Promise<void> {
  try {
    const data = await fetchVistasRolMe();
    if (!data) {
      resetVistasRol();
      state.loaded = true;
      return;
    }
    state.configurable = data.configurable;
    state.vistas = { ...data.vistas };
    state.loaded = true;
  } catch {
    // Fail-open, igual que `loadRhModulePermissions`: ante un error transitorio no
    // se esconde la navegación del usuario.
    resetVistasRol();
    state.loaded = true;
  }
}

/** True si el gate por rol aplica a este usuario. */
export function isVistaRolGateActivo(): boolean {
  return state.loaded && state.configurable;
}

/** True si `vistaKey` está en el catálogo configurable y el gate aplica. */
export function vistaRolConfigurada(vistaKey: string | null): vistaKey is string {
  if (!isVistaRolGateActivo() || !vistaKey) return false;
  return vistaKey in state.vistas;
}

/** Estado de una vista. Sin gate activo, todo está permitido. */
export function isVistaRolHabilitada(vistaKey: string | null): boolean {
  if (!vistaRolConfigurada(vistaKey)) return true;
  return state.vistas[vistaKey] === true;
}

/** Compuerta para un ítem del sidebar; `null` si la vista no es configurable. */
export function vistaRolPermiteNavItem(navItemId: string): boolean | null {
  const vistaKey = navItemToVistaKey(navItemId);
  if (!vistaRolConfigurada(vistaKey)) return null;
  return state.vistas[vistaKey] === true;
}

/** Compuerta para una ruta; `null` si la ruta no pertenece a una vista configurable. */
export function vistaRolPermiteHash(hash: string): boolean | null {
  const vistaKey = resolveVistaFromHash(hash);
  if (!vistaRolConfigurada(vistaKey)) return null;
  return state.vistas[vistaKey] === true;
}

/** Copia del estado, para tests y depuración. */
export function getVistasRolSnapshot(): Record<string, boolean> {
  return { ...state.vistas };
}
