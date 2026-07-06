/**
 * Etiqueta de empleado para gráficas: nombre con el número de empleado entre
 * paréntesis. Centraliza el formato usado en ejes, leyendas y tooltips.
 *
 * - nombre + no_empleado → `"Nombre (12345)"`
 * - solo no_empleado     → `"12345"` (ya es el identificador; sin paréntesis)
 * - solo nombre          → `"Nombre"`
 * - nada                 → `"Sin nombre"`
 */
import { extraerPrimerNombreApellido } from "./comedorNombreCorto.ts";

export function empleadoLabelConNumero(
  nombre: string | null | undefined,
  noEmpleado: string | number | null | undefined,
): string {
  const nom = (nombre ?? "").toString().trim();
  const no = noEmpleado == null ? "" : noEmpleado.toString().trim();
  if (nom && no) return `${nom} (${no})`;
  if (nom) return nom;
  if (no) return no;
  return "Sin nombre";
}

/**
 * Igual que `empleadoLabelConNumero`, pero reduce el nombre a la forma corta
 * `Primer nombre Primer apellido` (p. ej. `"LÓPEZ, ANA MARÍA"` → `"Ana López"`).
 * Sin nombre → solo el número.
 */
export function empleadoLabelCorto(
  nombre: string | null | undefined,
  noEmpleado: string | number | null | undefined,
): string {
  const raw = (nombre ?? "").toString().trim();
  const corto = raw ? extraerPrimerNombreApellido(raw) : null;
  return empleadoLabelConNumero(corto, noEmpleado);
}
