/**
 * Permisos de Nóminas — dos reglas independientes que NO deben inferirse entre sí:
 *
 * - Regla A (navegación): permiso RH "Nóminas" asignado desde el administrador de
 *   permisos RH. Habilita ver las páginas generales (Horas Extra, Conciliación,
 *   Ajustes Nóminas). NO habilita acciones operativas.
 * - Regla B (operativa): autorización explícita configurada dentro de "Ajustes de
 *   Nómina" para registrar/aprobar horas extra (claims JWT `he_autorizado` /
 *   `he_aprobador`). NO depende del permiso RH de Nóminas ni del rol base.
 */

import { isHorasExtraAprobador, isHorasExtraRegistroAutorizado } from "./jwt.ts";
import { hasRhModule } from "./rhModulePermissions.ts";

/** Regla A: el usuario tiene el permiso RH de Nóminas (solo navegación). */
export function hasPayrollAccess(): boolean {
  return hasRhModule("nominas");
}

/** Regla B: el usuario está autorizado a APROBAR horas extra (Ajustes de Nómina). */
export function canApproveOvertime(): boolean {
  return isHorasExtraAprobador();
}

/** Regla B: el usuario está autorizado a REGISTRAR horas extra (Ajustes de Nómina). */
export function canRegisterOvertime(): boolean {
  return isHorasExtraRegistroAutorizado();
}
