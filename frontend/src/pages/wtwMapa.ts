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
import {
  errorState,
  pageHeading,
  RH_LISTADO_SURFACE,
  skeletonBlock,
} from "../ui/uiTokens.ts";

type Estado = "loading" | "ready" | "error";

/** Ancho mínimo de cada columna del eje; por debajo los códigos se aprietan. */
const ANCHO_COLUMNA = "5.5rem";

function renderEje(grades: WtwGrade[]): string {
  const celdas = grades
    .map(
      (g) =>
        `<div class="px-2 py-1.5 text-center text-[11px] font-semibold tabular-nums text-text-secondary">${escapeHtml(g.codigo)}</div>`,
    )
    .join("");
  return `<div class="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50"
      style="grid-template-columns: repeat(${grades.length}, minmax(${ANCHO_COLUMNA}, 1fr));"
      role="row" aria-label="Global grades">${celdas}</div>`;
}

/**
 * Celda de un nivel, colocada por columnas.
 *
 * `grid-column` es 1-based y se calcula contra la posición del grade en el eje,
 * no contra su `orden`: el catálogo puede tener huecos en la numeración y el eje
 * solo pinta los grades que existen.
 */
function renderNivel(nivel: WtwNivel, indicePorOrden: Map<number, number>): string {
  const inicio = indicePorOrden.get(nivel.posicion_desde);
  const fin = indicePorOrden.get(nivel.posicion_hasta);
  if (inicio == null || fin == null) return "";
  const span = fin - inicio + 1;
  const titulo = `${nivel.codigo} · ${nivel.nombre} — ${nivel.global_grades.join(", ")}`;
  return `<div class="flex min-w-0 flex-col justify-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-2 text-center"
      style="grid-column: ${inicio + 1} / span ${span};"
      title="${escapeHtml(titulo)}">
      <span class="text-sm font-semibold tabular-nums text-text-primary">${escapeHtml(nivel.codigo)}</span>
      <span class="truncate text-[11px] leading-tight text-text-secondary">${escapeHtml(nivel.nombre)}</span>
    </div>`;
}

function renderCarril(
  niveles: WtwNivel[],
  grades: WtwGrade[],
  indicePorOrden: Map<number, number>,
): string {
  return `<div class="grid gap-1 py-1"
      style="grid-template-columns: repeat(${grades.length}, minmax(${ANCHO_COLUMNA}, 1fr));"
      role="row">
      ${niveles.map((n) => renderNivel(n, indicePorOrden)).join("")}
    </div>`;
}

function renderSinPosicion(path: WtwPath): string {
  if (path.sin_posicion.length === 0) return "";
  const chips = path.sin_posicion
    .map(
      (n) =>
        `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
          <span class="font-semibold tabular-nums">${escapeHtml(n.codigo)}</span>
          <span>${escapeHtml(n.nombre)}</span>
        </span>`,
    )
    .join("");
  return `<div class="border-t border-slate-100 px-4 py-3 sm:px-5">
      <p class="text-xs leading-relaxed text-text-muted">
        Sin equivalencia configurada, así que no tienen posición en el eje ni se pueden usar
        en el rango de un perfil. Configúrala en
        <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes</a>.
      </p>
      <div class="mt-2 flex flex-wrap gap-1.5">${chips}</div>
    </div>`;
}

function renderPath(
  path: WtwPath,
  grades: WtwGrade[],
  indicePorOrden: Map<number, number>,
): string {
  // Dos niveles del mismo path pueden solaparse; en una fila se pisarían.
  const carriles = repartirEnCarriles(path.niveles);
  const cuerpo =
    carriles.length === 0
      ? `<p class="px-4 py-6 text-center text-sm text-text-muted sm:px-5">
          Este career path aún no tiene career levels con equivalencia configurada.
        </p>`
      : `<div class="overflow-x-auto">
          <div class="min-w-max px-4 pb-3 sm:px-5">
            ${renderEje(grades)}
            ${carriles.map((c) => renderCarril(c, grades, indicePorOrden)).join("")}
          </div>
        </div>`;
  return `<section class="${RH_LISTADO_SURFACE}" aria-label="Career path ${escapeHtml(path.codigo)}">
      <header class="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        ${careerPathBadge(path.codigo, path.nombre)}
        <span class="text-xs text-text-muted">${path.niveles.length} career level(s) posicionado(s)</span>
      </header>
      ${cuerpo}
      ${renderSinPosicion(path)}
    </section>`;
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
      return `<div class="${RH_LISTADO_SURFACE} px-5 py-10 text-center text-sm text-text-muted">
        Todavía no hay global grades capturados, así que no hay eje sobre el que dibujar la
        estructura. Se capturan en
        <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes</a>.
      </div>`;
    }
    // El eje pinta los grades que existen; su `orden` puede tener huecos.
    const indicePorOrden = new Map(mapa.global_grades.map((g, i) => [g.orden, i]));
    return mapa.career_paths
      .map((p) => renderPath(p, mapa!.global_grades, indicePorOrden))
      .join("");
  }

  function paint(): void {
    if (!vivo) return;
    mountAppShell(container, {
      pageTitle: "Estructura WTW",
      activeNav: "wtw",
      mainClass: "py-0",
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
