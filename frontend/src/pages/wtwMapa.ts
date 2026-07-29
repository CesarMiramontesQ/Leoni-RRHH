/**
 * Página WTW (`#/puestos/wtw`): la estructura de grados de un vistazo.
 *
 * Una franja por career path sobre un eje común de global grades, con cada
 * career level ocupando el ancho de los grades que abarca — la lectura de la
 * lámina de Willis Towers Watson. Solo lectura: no administra nada, y todo lo
 * que muestra sale del catálogo que se captura en Ajustes.
 *
 * Lo que esta vista hace visible y ninguna otra pantalla enseña: **dos niveles
 * de paths distintos pueden caer en la misma columna**. Un P4 y un M1 pesan lo
 * mismo si equivalen a los mismos global grades, que es el fundamento del
 * sistema — el Global Grade ordena, los career paths son alternativas.
 *
 * No reproduce la paleta de la lámina original (morado/naranja/azul): el
 * sistema de diseño no admite colores inventados y reserva el accent para lo
 * interactivo. La identidad de cada franja la da su badge de career path.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { getMapaWtw } from "../api/wtw.ts";
import type { WtwGrade, WtwMapa, WtwNivel, WtwPath } from "../dashboard/puestos/types.ts";
import { careerPathBadge, GLOBAL_GRADE_TOOLTIP } from "../talento/clasificacionPuestoUi.ts";
import { repartirEnCarriles } from "../talento/wtwCarriles.ts";
import { talentoEyebrow, talentoPageRoot } from "../talento/pageKit.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { tinteOrdinalChip, tinteOrdinalFondo } from "../ui/escalaOrdinal.ts";
import {
  errorState,
  pageHeading,
  RH_LISTADO_SURFACE,
  skeletonBlock,
} from "../ui/uiTokens.ts";

type Estado = "loading" | "ready" | "error";

/** Ancho de cada columna del eje; por debajo los códigos se aprietan. */
const ANCHO_COLUMNA = "4.75rem";

/** Columna fija de la izquierda con la etiqueta del career path. */
const ANCHO_ETIQUETA = "11rem";

// El tinte de la rampa vive en la COLUMNA, no en la celda del nivel: así el
// color codifica el eje y las celdas quedan como figura sobre ese fondo. Y como
// todas las franjas comparten columna, dos niveles del mismo tinte están
// alineados — el color acaba probando lo que la vista quiere enseñar.

function plantillaColumnas(total: number): string {
  return `grid-template-columns: ${ANCHO_ETIQUETA} repeat(${total}, ${ANCHO_COLUMNA});`;
}

/** Celda pegada a la izquierda que no se pierde al desplazar el eje. */
function celdaEtiqueta(contenido: string, clases = ""): string {
  return `<div class="sticky left-0 z-20 flex items-center border-r border-slate-200 bg-white px-4 ${clases}">${contenido}</div>`;
}

function renderEje(grades: WtwGrade[]): string {
  const celdas = grades
    .map((g, i) => {
      const { fondo, texto } = tinteOrdinalChip(i, grades.length);
      return `<div class="flex items-center justify-center py-2">
          <span class="inline-flex min-w-[3.25rem] justify-center rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums"
            style="background: ${fondo}; color: ${texto};">${escapeHtml(g.codigo)}</span>
        </div>`;
    })
    .join("");
  return `<div class="sticky top-0 z-30 grid border-b border-slate-200 bg-white"
      style="${plantillaColumnas(grades.length)}"
      role="row" aria-label="Global grades">
      ${celdaEtiqueta(
        `<span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Global grade</span>`,
        "py-2",
      )}
      ${celdas}
    </div>`;
}

/** Fondo de las columnas: se pinta una vez y las franjas van encima. */
function renderTintes(grades: WtwGrade[]): string {
  const columnas = grades
    .map(
      (_, i) =>
        `<div style="background: ${tinteOrdinalFondo(i, grades.length)};" aria-hidden="true"></div>`,
    )
    .join("");
  return `<div class="pointer-events-none absolute inset-0 grid"
      style="${plantillaColumnas(grades.length)}">
      <div aria-hidden="true"></div>
      ${columnas}
    </div>`;
}

/**
 * Celda de un nivel, colocada por columnas.
 *
 * `grid-column` es 1-based y la columna 1 es la etiqueta fija, de ahí el `+ 2`.
 * El índice sale de la posición del grade en el eje, nunca de su `orden`: el eje
 * se recorta a lo ocupado y su numeración tiene huecos.
 */
function renderNivel(nivel: WtwNivel, indicePorOrden: Map<number, number>): string {
  const inicio = indicePorOrden.get(nivel.posicion_desde);
  const fin = indicePorOrden.get(nivel.posicion_hasta);
  if (inicio == null || fin == null) return "";
  const span = fin - inicio + 1;
  const titulo = `${nivel.codigo} · ${nivel.nombre} — ${nivel.global_grades.join(", ")}`;
  // Translúcida a propósito: deja pasar el tinte de sus columnas, así la celda
  // queda atada a su posición del eje. Una celda que abarca dos grades enseña
  // los dos tintes, que es exactamente lo que significa. El blanco al 85% sobre
  // un tinte que no pasa del 27% deja el fondo efectivo por debajo del 6%, así
  // que el contraste del texto no se mueve.
  return `<div class="relative z-10 mx-0.5 flex min-w-0 flex-col justify-center gap-0.5 rounded-lg border border-white/70 bg-white/85 px-2 py-2.5 text-center shadow-[0_1px_2px_rgba(10,22,40,0.06)] backdrop-blur-[1px]"
      style="grid-column: ${inicio + 2} / span ${span};"
      title="${escapeHtml(titulo)}">
      <span class="text-sm font-semibold tabular-nums leading-none text-text-primary">${escapeHtml(nivel.codigo)}</span>
      <span class="truncate text-[11px] leading-tight text-text-secondary">${escapeHtml(nivel.nombre)}</span>
    </div>`;
}

function renderCarril(
  niveles: WtwNivel[],
  grades: WtwGrade[],
  indicePorOrden: Map<number, number>,
  etiqueta: string,
): string {
  return `<div class="relative grid py-1" style="${plantillaColumnas(grades.length)}" role="row">
      ${celdaEtiqueta(etiqueta, "py-1")}
      ${niveles.map((n) => renderNivel(n, indicePorOrden)).join("")}
    </div>`;
}

/**
 * Una franja por career path, todas dentro del MISMO scroll.
 *
 * Con un scroll por franja, desplazar una desalineaba las demás y se perdía lo
 * único que la vista existe para enseñar.
 */
function renderFranja(
  path: WtwPath,
  grades: WtwGrade[],
  indicePorOrden: Map<number, number>,
): string {
  const carriles = repartirEnCarriles(path.niveles);
  if (carriles.length === 0) {
    return `<div class="relative grid border-t border-slate-100" style="${plantillaColumnas(grades.length)}">
        ${celdaEtiqueta(careerPathBadge(path.codigo, path.nombre), "py-3")}
        <div class="py-3 pl-4 text-xs text-text-muted" style="grid-column: 2 / -1;">
          Sin career levels con equivalencia configurada.
        </div>
      </div>`;
  }
  // La etiqueta va en el primer carril; los demás llevan una celda vacía para
  // que la columna fija no se rompa.
  const filas = carriles
    .map((c, i) =>
      renderCarril(
        c,
        grades,
        indicePorOrden,
        i === 0 ? careerPathBadge(path.codigo, path.nombre) : "",
      ),
    )
    .join("");
  return `<div class="border-t border-slate-100 py-1" role="rowgroup"
      aria-label="Career path ${escapeHtml(path.codigo)}">${filas}</div>`;
}

function renderSinPosicion(paths: WtwPath[]): string {
  const pendientes = paths.filter((p) => p.sin_posicion.length > 0);
  if (pendientes.length === 0) return "";
  const bloques = pendientes
    .map(
      (p) => `<div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-semibold text-text-secondary">${escapeHtml(p.codigo)}</span>
        ${p.sin_posicion
          .map(
            (n) =>
              `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                <span class="font-semibold tabular-nums">${escapeHtml(n.codigo)}</span>
                <span>${escapeHtml(n.nombre)}</span>
              </span>`,
          )
          .join("")}
      </div>`,
    )
    .join("");
  return `<div class="${RH_LISTADO_SURFACE} px-4 py-4 sm:px-5">
      <p class="text-xs leading-relaxed text-text-muted">
        Estos career levels no tienen equivalencia configurada, así que no tienen posición en
        el eje ni se pueden usar en el rango de un perfil. Se configura en
        <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes</a>.
      </p>
      <div class="mt-3 flex flex-col gap-2">${bloques}</div>
    </div>`;
}

export function mountWtwMapa(container: HTMLElement, signal?: AbortSignal): void {
  let estado: Estado = "loading";
  let mapa: WtwMapa | null = null;
  let error = "";
  // Si el usuario navega mientras carga, repintar sobrescribiría la ruta nueva.
  let vivo = true;
  signal?.addEventListener("abort", () => {
    vivo = false;
  });

  function cuerpo(): string {
    if (estado === "loading") {
      return `<div class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
        ${skeletonBlock({ className: "h-64 rounded-xl", label: "Cargando la estructura…" })}
      </div>`;
    }
    if (estado === "error") return errorState({ message: error });
    if (!mapa || mapa.global_grades.length === 0) {
      // El eje solo trae los grades que algún career path ocupa, así que vacío
      // significa «ningún nivel tiene equivalencia», no «no hay grades».
      return `<div class="${RH_LISTADO_SURFACE} px-5 py-10 text-center text-sm text-text-muted">
        Ningún career level tiene equivalencia configurada todavía, así que no hay eje sobre
        el que dibujar la estructura. Se configura en
        <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes</a>.
      </div>`;
    }
      // El eje solo trae los grades ocupados, así que su `orden` tiene huecos: la
    // columna se busca por índice, nunca por `orden`.
    const grades = mapa.global_grades;
    const indicePorOrden = new Map(grades.map((g, i) => [g.orden, i]));
    const franjas = mapa.career_paths
      .map((p) => renderFranja(p, grades, indicePorOrden))
      .join("");
    return `<div class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <div class="relative min-w-max">
            ${renderTintes(grades)}
            ${renderEje(grades)}
            ${franjas}
          </div>
        </div>
      </div>
      ${renderSinPosicion(mapa.career_paths)}`;
  }

  function paint(): void {
    if (!vivo) return;
    mountAppShell(container, {
      pageTitle: "Estructura WTW",
      activeNav: "wtw",
      // `py-0` dejaba el contenido pegado al navbar: el contenedor de página
      // solo trae padding horizontal.
      mainClass: "py-5 sm:py-6",
      mainHtml: talentoPageRoot(`
        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            ${talentoEyebrow("Puestos")}
            ${pageHeading(
              "Estructura WTW",
              "Cada career path sobre el mismo eje de global grades. Dos niveles alineados en la misma columna pesan lo mismo aunque vengan de caminos distintos.",
            )}
          </div>
          <p class="text-xs leading-relaxed text-text-muted">${escapeHtml(GLOBAL_GRADE_TOOLTIP)}</p>
          ${cuerpo()}
        </div>`),
    });
  }

  async function load(): Promise<void> {
    estado = "loading";
    paint();
    try {
      mapa = await getMapaWtw();
      estado = "ready";
    } catch (e) {
      estado = "error";
      error = e instanceof Error ? e.message : "No se pudo cargar la estructura.";
    }
    paint();
  }

  paint();
  void load();
}
