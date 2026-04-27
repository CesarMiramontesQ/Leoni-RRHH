export function extraerPrimerNombreApellido(nombreCompleto: string): string {
  const limpio = nombreCompleto.trim().replace(/\s+/g, " ");
  if (!limpio) return "Sin nombre";

  const toTitle = (word: string): string => {
    const w = word.trim();
    if (!w) return "";
    return `${w.slice(0, 1).toUpperCase()}${w.slice(1).toLowerCase()}`;
  };

  // Formato esperado: "APELLIDOS, NOMBRES"
  if (limpio.includes(",")) {
    const [apellidosRaw, nombresRaw] = limpio.split(",", 2);
    const primerApellido = (apellidosRaw?.trim().split(/\s+/) ?? [])[0] ?? "";
    const primerNombre = (nombresRaw?.trim().split(/\s+/) ?? [])[0] ?? "";
    const nombre = toTitle(primerNombre);
    const apellido = toTitle(primerApellido);
    if (nombre && apellido) return `${nombre} ${apellido}`;
    if (nombre) return nombre;
    if (apellido) return apellido;
  }

  // Fallback para datos inesperados sin coma.
  const tokens = limpio.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "Sin nombre";
  if (tokens.length === 1) return toTitle(tokens[0] ?? "");
  return `${toTitle(tokens[0] ?? "")} ${toTitle(tokens[1] ?? "")}`;
}
