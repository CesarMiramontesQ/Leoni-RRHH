/**
 * ¿El usuario autenticado es administrativo?
 *
 * Home Office solo está disponible para clasificación Administrativo —lo valida
 * `solicitud_service._validar_creacion_home_office`, que rechaza al resto—, así que
 * las superficies que muestran algo de home office necesitan saberlo antes de pintar.
 *
 * La fuente es `/auth/me`, la misma que ya usa el modal de nueva solicitud para esta
 * regla. El resultado se cachea por usuario mientras dure la pestaña: la clasificación
 * no cambia dentro de una sesión y así el dashboard no repite la consulta en cada
 * repintado.
 */
import { getAuthMe } from "../api/auth.ts";
import { esEmpleadoAdministrativo } from "../utils/empleadoClasificacion.ts";
import { getAccessTokenPayload } from "./jwt.ts";

let cache: { sub: string; valor: boolean } | null = null;

function subActual(): string {
  const sub = getAccessTokenPayload()?.sub;
  return typeof sub === "string" ? sub : "";
}

/**
 * `false` si la consulta falla: ante la duda no se muestra lo que solo aplica a
 * administrativos, en vez de enseñar a un operativo un dato que nunca será suyo.
 */
export async function usuarioActualEsAdministrativo(): Promise<boolean> {
  const sub = subActual();
  if (cache && cache.sub === sub) return cache.valor;
  let valor = false;
  try {
    valor = esEmpleadoAdministrativo((await getAuthMe()).clasificacion);
  } catch {
    return false; // sin cachear: un fallo de red no debe fijar el «no» para toda la sesión
  }
  cache = { sub, valor };
  return valor;
}

/**
 * Solo para tests. En la app no hace falta invalidar a mano: la caché va atada al `sub`
 * del token, así que otro usuario en la misma pestaña no hereda el valor del anterior.
 */
export function resetClasificacionUsuarioCache(): void {
  cache = null;
}
