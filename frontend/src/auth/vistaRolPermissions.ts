/**
 * Estado de las vistas habilitadas para el rol del usuario.
 *
 * Se carga al arrancar (`main.ts`) y tras el login, en paralelo con
 * `loadRhModulePermissions`. A diferencia de los permisos por módulo, esta
 * configuración NO viaja en el JWT: un cambio del admin RH aplica sin re-login.
 *
 * Un admin RH está exento **solo en Modo RH**. Al simular empleado/líder/gerente con el
 * toggle se le aplica la configuración de ese rol, para que vea exactamente lo que ve
 * quien lo tiene; por eso el backend le manda la matriz completa (`por_rol`) y aquí se
 * resuelve el rol en cada consulta — así el toggle surte efecto sin volver a pedir datos.
 */
import { fetchVistasRolMe } from "../api/vistasRol.ts";
import { getRhUiMode, isAdminUser } from "./rhUiMode.ts";
import { navItemToVistaKey, resolveVistaFromHash } from "./vistaRolRegistry.ts";

type VistaRolState = {
  loaded: boolean;
  /** false para roles fuera del alcance: no se les aplica el gate. */
  configurable: boolean;
  vistas: Record<string, boolean>;
  /** Matriz rol → vistas; solo llega para admins RH. */
  porRol: Record<string, Record<string, boolean>> | null;
};

const state: VistaRolState = {
  loaded: false,
  configurable: false,
  vistas: {},
  porRol: null,
};

/** Modo de UI simulado → rol cuya configuración aplica (espejo del backend). */
const MODO_UI_A_ROL: Readonly<Record<string, string>> = {
  empleado: "empleado",
  lider: "supervisor",
  gerente: "gerente",
};

export function resetVistasRol(): void {
  state.loaded = false;
  state.configurable = false;
  state.vistas = {};
  state.porRol = null;
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
    state.porRol = data.por_rol ? { ...data.por_rol } : null;
    state.loaded = true;
  } catch {
    // Fail-open, igual que `loadRhModulePermissions`: ante un error transitorio no
    // se esconde la navegación del usuario.
    resetVistasRol();
    state.loaded = true;
  }
}

/**
 * Vistas que aplican ahora mismo, o `null` si el gate no aplica.
 *
 * Para un admin se resuelven contra el modo activo en el momento de la consulta (no en
 * la carga), de modo que alternar el toggle cambie el menú al instante.
 */
function vistasActivas(): Record<string, boolean> | null {
  if (!state.loaded) return null;
  if (isAdminUser()) {
    if (!state.porRol) return null;
    const rol = MODO_UI_A_ROL[getRhUiMode()];
    return rol ? (state.porRol[rol] ?? null) : null;
  }
  return state.configurable ? state.vistas : null;
}

/** True si el gate por rol aplica a este usuario en el modo actual. */
export function isVistaRolGateActivo(): boolean {
  return vistasActivas() !== null;
}

/** True si `vistaKey` está en el catálogo configurable y el gate aplica. */
export function vistaRolConfigurada(vistaKey: string | null): vistaKey is string {
  if (!vistaKey) return false;
  const vistas = vistasActivas();
  return vistas !== null && vistaKey in vistas;
}

/** Estado de una vista. Sin gate activo, todo está permitido. */
export function isVistaRolHabilitada(vistaKey: string | null): boolean {
  const vistas = vistasActivas();
  if (!vistaKey || vistas === null || !(vistaKey in vistas)) return true;
  return vistas[vistaKey] === true;
}

/** Compuerta para un ítem del sidebar; `null` si la vista no es configurable. */
export function vistaRolPermiteNavItem(navItemId: string): boolean | null {
  const vistas = vistasActivas();
  if (vistas === null) return null;
  const vistaKey = navItemToVistaKey(navItemId);
  if (!vistaKey || !(vistaKey in vistas)) return null;
  return vistas[vistaKey] === true;
}

/** Compuerta para una ruta; `null` si la ruta no pertenece a una vista configurable. */
export function vistaRolPermiteHash(hash: string): boolean | null {
  const vistas = vistasActivas();
  if (vistas === null) return null;
  const vistaKey = resolveVistaFromHash(hash);
  if (!vistaKey || !(vistaKey in vistas)) return null;
  return vistas[vistaKey] === true;
}

/** Copia del estado activo, para tests y depuración. */
export function getVistasRolSnapshot(): Record<string, boolean> {
  return { ...(vistasActivas() ?? {}) };
}
