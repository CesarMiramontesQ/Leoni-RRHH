import type {
  CriterioRequerido,
  MetodoCalificacionConfig,
  ValorCapturado,
} from "../../dashboard/cualificaciones/types.ts";

export type OpcionCalificacionLite = {
  etiqueta: string;
  valor: string;
  orden?: number;
  peso?: number | null;
};
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, RH_LISTADO_LABEL, RH_LISTADO_SELECT, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export function labelCriterio(
  criterio: CriterioRequerido | null,
  opciones: OpcionCalificacionLite[],
): string {
  if (!criterio) return "—";
  if (criterio.na) return "No aplica";
  if (typeof criterio.opcion_valor === "string") {
    const op = opciones.find((o) => o.valor === criterio.opcion_valor);
    return op?.etiqueta ?? String(criterio.opcion_valor);
  }
  if (typeof criterio.min_anios === "number") {
    const txt = criterio.texto ? ` — ${criterio.texto}` : "";
    return `${criterio.min_anios} años mín.${txt}`;
  }
  if (typeof criterio.texto === "string") return criterio.texto;
  return "—";
}

export function labelCapturado(
  valor: ValorCapturado | null,
  opciones: OpcionCalificacionLite[],
): string {
  if (!valor) return "—";
  if (valor.na) return "No aplica";
  if (typeof valor.opcion_valor === "string") {
    const op = opciones.find((o) => o.valor === valor.opcion_valor);
    return op?.etiqueta ?? String(valor.opcion_valor);
  }
  if (typeof valor.anios === "number") {
    const txt = valor.texto ? ` — ${valor.texto}` : "";
    return `${valor.anios} años${txt}`;
  }
  if (typeof valor.texto === "string") return valor.texto;
  return "—";
}

export function renderCriterioFieldsHtml(opts: {
  prefix: string;
  config: MetodoCalificacionConfig;
  opciones: OpcionCalificacionLite[];
  valor?: CriterioRequerido | null;
  mode?: "requerido" | "captura";
}): string {
  const { prefix, config, opciones, valor, mode = "requerido" } = opts;
  const comparador = config.comparador ?? "none";
  const captura = config.captura ?? {};
  const campos = captura.campos ?? ["texto"];
  const permiteNa = config.permite_na !== false;
  const sorted = [...opciones].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  let html = "";

  if (permiteNa) {
    const checked = valor?.na ? "checked" : "";
    html += `
      <label class="mb-3 flex items-center gap-2 text-sm text-text-primary">
        <input type="checkbox" id="${prefix}-na" data-criterio-na class="rounded border-slate-300" ${checked} />
        No aplica (N/A)
      </label>`;
  }

  if (campos.includes("opcion") || comparador === "ordinal_gte" || comparador === "boolean_yes" || comparador === "exact") {
    if (sorted.length > 0) {
      const current = (valor?.opcion_valor as string) ?? "";
      const options = sorted
        .map(
          (o) =>
            `<option value="${escapeHtml(o.valor)}" ${current === o.valor ? "selected" : ""}>${escapeHtml(o.etiqueta)}</option>`,
        )
        .join("");
      html += `
        <div class="mb-3">
          <label class="${RH_LISTADO_LABEL}" for="${prefix}-opcion">Opción</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="${prefix}-opcion" data-criterio-opcion class="${RH_LISTADO_SELECT} ${FIELD_FOCUS}">
              <option value="">Seleccionar…</option>
              ${options}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>`;
    }
  }

  if (comparador === "numeric_gte" || captura.anios_habilitado) {
    const current = valor?.min_anios ?? valor?.anios ?? "";
    const label = mode === "captura" ? "Años de experiencia" : "Años mínimos requeridos";
    const field = mode === "captura" ? "anios" : "min_anios";
    html += `
      <div class="mb-3">
        <label class="${RH_LISTADO_LABEL}" for="${prefix}-anios">${label}</label>
        <input type="number" min="0" id="${prefix}-anios" data-criterio-field="${field}"
          class="${FIELD_FOCUS} mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" value="${current}" />
      </div>`;
  }

  if (comparador === "none" || campos.includes("texto")) {
    const current = (valor?.texto as string) ?? "";
    html += `
      <div class="mb-3">
        <label class="${RH_LISTADO_LABEL}" for="${prefix}-texto">Descripción / criterio</label>
        <input type="text" id="${prefix}-texto" data-criterio-texto
          class="${FIELD_FOCUS} mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm" value="${escapeHtml(current)}" />
      </div>`;
  }

  return html;
}

export function readCriterioFromForm(container: HTMLElement): CriterioRequerido {
  const na = container.querySelector<HTMLInputElement>("[data-criterio-na]");
  if (na?.checked) return { na: true };

  const result: CriterioRequerido = {};
  const opcion = container.querySelector<HTMLSelectElement>("[data-criterio-opcion]");
  if (opcion?.value) result.opcion_valor = opcion.value;

  const aniosEl = container.querySelector<HTMLInputElement>("[data-criterio-field]");
  if (aniosEl && aniosEl.value !== "") {
    const field = aniosEl.getAttribute("data-criterio-field") ?? "min_anios";
    const num = Number(aniosEl.value);
    if (!Number.isNaN(num)) result[field] = num;
  }

  const texto = container.querySelector<HTMLInputElement>("[data-criterio-texto]");
  if (texto?.value.trim()) result.texto = texto.value.trim();

  return result;
}
