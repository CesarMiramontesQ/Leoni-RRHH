/**
 * Presentación compartida de la clasificación de puesto (Willis Towers Watson).
 *
 * Antes había tres formas distintas de pintar lo mismo repartidas por el módulo:
 * un rango con guión en el listado, una lista con comas en el detalle y chips con
 * flechas en el modal. Aquí viven las tres, más los badges de Career Path y
 * Global Grade, para que la clasificación se lea igual en toda la plataforma.
 */

import { escapeHtml } from "../ui/uiUtils.ts";

export type CareerLevelLike = {
  id: number;
  nombre: string;
  codigo?: string | null;
  career_path_codigo?: string | null;
  /**
   * Posición del nivel. El catálogo la expone como `global_grade_orden` y el
   * perfil como `orden` ya resuelto; ambos son el orden del Global Grade, que es
   * lo único que ubica al nivel. `null` = sin equivalencia configurada.
   */
  orden?: number | null;
  global_grade_orden?: number | null;
};

/** Posición del nivel, venga del catálogo o del perfil. */
export function posicionCareerLevel(nivel: CareerLevelLike): number | null {
  return nivel.global_grade_orden ?? nivel.orden ?? null;
}

/** Comparador estable: sin posición van al final, y se desempata por código. */
export function compararCareerLevels(a: CareerLevelLike, b: CareerLevelLike): number {
  const pa = posicionCareerLevel(a);
  const pb = posicionCareerLevel(b);
  if (pa == null && pb == null) {
    return (a.codigo ?? a.nombre).localeCompare(b.codigo ?? b.nombre);
  }
  if (pa == null) return 1;
  if (pb == null) return -1;
  return pa - pb;
}

/** Texto que identifica al nivel: su código (P10) o, si falta, su nombre. */
export function careerLevelLabel(nivel: CareerLevelLike): string {
  return (nivel.codigo ?? "").trim() || nivel.nombre;
}

/**
 * Rango condensado de career levels: "P10 → P12" (o "P10" si es uno solo).
 *
 * Los niveles solo son comparables dentro de su career path, así que se asume
 * que la lista ya viene de un mismo perfil.
 */
export function formatCareerLevelRango(niveles: CareerLevelLike[]): string {
  if (!niveles.length) return "—";
  const ordenados = [...niveles].sort(compararCareerLevels);
  const primero = careerLevelLabel(ordenados[0]);
  if (ordenados.length === 1) return primero;
  return `${primero} → ${careerLevelLabel(ordenados[ordenados.length - 1])}`;
}

/** Chips del rango completo, para el preview del formulario: P10 → P11 → P12. */
export function careerLevelChips(niveles: CareerLevelLike[]): string {
  if (!niveles.length) return "";
  const ordenados = [...niveles].sort(compararCareerLevels);
  return ordenados
    .map(
      (n) =>
        `<span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-text-primary">${escapeHtml(careerLevelLabel(n))}</span>`,
    )
    .join(
      `<span class="mx-1 text-text-muted" aria-hidden="true">→</span>`,
    );
}

/** Badge del career path. Siempre lleva texto, nunca solo color. */
export function careerPathBadge(
  codigo: string | null | undefined,
  nombre: string | null | undefined,
): string {
  const etiqueta = (nombre ?? "").trim() || (codigo ?? "").trim();
  if (!etiqueta) return "";
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
      <span class="size-1.5 rounded-full bg-accent" aria-hidden="true"></span>${escapeHtml(etiqueta)}
    </span>`;
}

export const GLOBAL_GRADE_TOOLTIP =
  "Clasificación organizacional oficial asignada al perfil de puesto conforme a la estructura definida por Recursos Humanos.";

/**
 * Badge del Global Grade.
 *
 * El tooltip es deliberadamente explícito sobre qué es el GG: clasifica el
 * puesto dentro de la estructura organizacional y no expresa sueldo,
 * compensación ni banda salarial.
 */
export function globalGradeBadge(
  codigo: string | null | undefined,
  opts?: { nombre?: string | null },
): string {
  const texto = (codigo ?? "").trim();
  if (!texto) {
    return `<span class="inline-flex items-center rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-text-muted">Sin global grade</span>`;
  }
  const detalle = (opts?.nombre ?? "").trim();
  const title = detalle ? `${detalle} — ${GLOBAL_GRADE_TOOLTIP}` : GLOBAL_GRADE_TOOLTIP;
  return `<span class="inline-flex items-center rounded-full border border-accent/20 bg-accent-light px-2.5 py-0.5 text-xs font-semibold tabular-nums text-accent" title="${escapeHtml(title)}">${escapeHtml(texto)}</span>`;
}

/** Chip de aviso para perfiles a los que les falta clasificación. */
export function clasificacionPendienteBadge(): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800" title="Faltan campos de la clasificación organizacional">
      <span class="size-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>Clasificación pendiente
    </span>`;
}

const ESTADO_ETIQUETAS: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  en_revision: "En revisión",
};

export function estadoPerfilLabel(estado: string | null | undefined): string {
  return ESTADO_ETIQUETAS[(estado ?? "").trim()] ?? "—";
}

export function estadoPerfilBadge(estado: string | null | undefined): string {
  const clave = (estado ?? "").trim();
  const etiqueta = estadoPerfilLabel(clave);
  const tono =
    clave === "activo"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : clave === "en_revision"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-slate-200 bg-slate-50 text-text-secondary";
  const dot =
    clave === "activo"
      ? "bg-emerald-500"
      : clave === "en_revision"
        ? "bg-sky-500"
        : "bg-slate-400";
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tono}">
      <span class="size-1.5 rounded-full ${dot}" aria-hidden="true"></span>${escapeHtml(etiqueta)}
    </span>`;
}

export const ESTADOS_PERFIL: { value: string; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "en_revision", label: "En revisión" },
  { value: "inactivo", label: "Inactivo" },
];

/**
 * ¿Los niveles forman un rango consecutivo por `orden`?
 *
 * Vivía en `dashboard/puestos/types.ts`, que es un archivo de tipos.
 */
export function careerLevelsSonConsecutivos(
  catalogo: CareerLevelLike[],
  ids: number[],
): boolean {
  if (ids.length === 0) return false;
  const posiciones = ids
    .map((id) => {
      const nivel = catalogo.find((g) => g.id === id);
      return nivel ? posicionCareerLevel(nivel) : null;
    })
    .filter((o): o is number => typeof o === "number");
  // Un nivel sin equivalencia no tiene posición, así que el rango no se puede
  // validar: el backend lo rechaza con un mensaje que apunta a Ajustes.
  if (posiciones.length !== ids.length) return false;
  // Deduplicado: dos niveles pueden equivaler al mismo global grade y eso no
  // rompe la contigüidad.
  const unicas = [...new Set(posiciones)].sort((a, b) => a - b);
  return unicas[unicas.length - 1] - unicas[0] + 1 === unicas.length;
}

/** Ids de los niveles entre `desdeId` y `hastaId`, ambos incluidos. */
export function careerLevelsEntre(
  catalogo: CareerLevelLike[],
  desdeId: number | null,
  hastaId: number | null,
): number[] {
  if (desdeId == null || hastaId == null) return [];
  const desde = catalogo.find((g) => g.id === desdeId);
  const hasta = catalogo.find((g) => g.id === hastaId);
  if (!desde || !hasta) return [];
  // Un rango solo tiene sentido dentro de un mismo career path.
  if (desde.career_path_codigo !== hasta.career_path_codigo) return [];
  const pDesde = posicionCareerLevel(desde);
  const pHasta = posicionCareerLevel(hasta);
  // Sin equivalencia no hay posición y no se puede delimitar el rango.
  if (pDesde == null || pHasta == null) return [];
  const [min, max] = pDesde <= pHasta ? [pDesde, pHasta] : [pHasta, pDesde];
  return catalogo
    .filter((g) => {
      if (g.career_path_codigo !== desde.career_path_codigo) return false;
      const p = posicionCareerLevel(g);
      return p != null && p >= min && p <= max;
    })
    .sort(compararCareerLevels)
    .map((g) => g.id);
}

// ---------------------------------------------------------------------------
// Código del career level: el del career path + un número (P1, P10, M3).
// Espejo de `app/utils/career_level_codigo.py`; la validación que manda es la
// del backend, esto evita el viaje y permite proponer el siguiente número.
// ---------------------------------------------------------------------------

/** Límite de `levelup_grados_puesto.codigo`. */
export const MAX_LONGITUD_CODIGO_CAREER_LEVEL = 10;

/** Parte numérica de un código que cumple la regla; `null` si no la cumple. */
export function numeroDeCareerLevel(prefijo: string, codigo: string): number | null {
  const pre = (prefijo ?? "").trim();
  const cod = (codigo ?? "").trim();
  if (!pre || cod.length <= pre.length) return null;
  if (cod.slice(0, pre.length).toLowerCase() !== pre.toLowerCase()) return null;
  const resto = cod.slice(pre.length);
  // Entero ≥ 1 sin ceros a la izquierda: 'P01' sería ambiguo con 'P1'.
  return /^[1-9]\d*$/.test(resto) ? Number(resto) : null;
}

/** Compone el código a partir del número capturado. `null` si el número no sirve. */
export function componerCodigoCareerLevel(
  prefijo: string,
  numero: string,
): string | null {
  const pre = (prefijo ?? "").trim();
  const num = (numero ?? "").trim();
  if (!pre || !/^[1-9]\d*$/.test(num)) return null;
  const codigo = `${pre}${num}`;
  return codigo.length > MAX_LONGITUD_CODIGO_CAREER_LEVEL ? null : codigo;
}

/** Primer número por encima del mayor en uso; 1 si no hay ninguno válido. */
export function siguienteNumeroCareerLevel(
  prefijo: string,
  codigos: string[],
): number {
  const numeros = codigos
    .map((c) => numeroDeCareerLevel(prefijo, c))
    .filter((n): n is number => n != null);
  return numeros.length ? Math.max(...numeros) + 1 : 1;
}
