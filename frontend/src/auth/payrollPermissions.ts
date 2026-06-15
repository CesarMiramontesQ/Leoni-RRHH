/**
 * Permisos de Nóminas — dos reglas independientes que NO deben inferirse entre sí:
 *
 * - Regla A (navegación): permiso RH por PÁGINA asignado desde el administrador de
 *   permisos RH (`nominas-horas-extra`, `nominas-conciliacion`, `nominas-ajustes`).
 *   Habilita ver cada página del submenú. NO habilita acciones operativas. Se evalúa
 *   con `hasRhModule(<página>)` / `hasExplicitModuleGrant(<página>)` donde se navega.
 * - Regla B (operativa): autorización explícita configurada dentro de "Ajustes de
 *   Nómina" para registrar/aprobar horas extra (claims JWT `he_autorizado` /
 *   `he_aprobador`). NO depende del permiso RH de Nóminas ni del rol base.
 */

import { isHorasExtraAprobador, isHorasExtraRegistroAutorizado } from "./jwt.ts";

/** Regla B: el usuario está autorizado a APROBAR horas extra (Ajustes de Nómina). */
export function canApproveOvertime(): boolean {
  return isHorasExtraAprobador();
}

/** Regla B: el usuario está autorizado a REGISTRAR horas extra (Ajustes de Nómina). */
export function canRegisterOvertime(): boolean {
  return isHorasExtraRegistroAutorizado();
}
