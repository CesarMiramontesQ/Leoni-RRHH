import { updateMatrizBulk, type CompetenciasFetchError } from "../../api/competencias.ts";
import { getGradosPuesto } from "../../api/gradosPuesto.ts";
import {
  getAreasOptions,
  getPerfilCompetencias,
  getPerfilesList,
  type PerfilCompetencia,
} from "../../api/puestos.ts";
import type { NivelMatriz } from "../../dashboard/competencias/types.ts";
import type { PerfilPuestoListItem } from "../../dashboard/puestos/types.ts";
import {
  buildNivelMetodoOptions,
  ensureMetodosCalificacionCompetenciaLoaded,
  nivelMetodoSelectTone,
} from "../../ui/metodosCalificacionCompetencia.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  FIELD_FOCUS,
  RH_LISTADO_SURFACE,
  RH_LISTADO_FOCUS_RING,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";

function selectTone(nivel: number): string {
  return nivelMetodoSelectTone(nivel);
}

export type MatrizRequisitosModel = {
  status: "idle" | "loading" | "ready" | "saving" | "error";
  areaId: string;
  areaOptions: { id: number; label: string }[];
  puestoId: string;
  puestos: PerfilPuestoListItem[];
  competencias: PerfilCompetencia[];
  pending: Map<number, NivelMatriz>;
  errorMessage: string | null;
  saveMessage: string | null;
  canEdit: boolean;
};

export function createMatrizRequisitosModel(canEdit: boolean): MatrizRequisitosModel {
  return {
    status: "idle",
    areaId: "",
    areaOptions: [],
    puestoId: "",
    puestos: [],
    competencias: [],
    pending: new Map(),
    errorMessage: null,
    saveMessage: null,
    canEdit,
  };
}

export function getEffectiveNivel(model: MatrizRequisitosModel, comp: PerfilCompetencia): NivelMatriz {
  if (model.pending.has(comp.competencia_id)) {
    return model.pending.get(comp.competencia_id)!;
  }
  return (comp.nivel_requerido ?? 0) as NivelMatriz;
}

function puestosFiltrados(model: MatrizRequisitosModel): PerfilPuestoListItem[] {
  if (!model.areaId) return model.puestos;
  const areaLabel = model.areaOptions.find((a) => String(a.id) === model.areaId)?.label;
  if (!areaLabel) return model.puestos;
  return model.puestos.filter((p) => p.area === areaLabel);
}

function puestoSeleccionado(model: MatrizRequisitosModel): PerfilPuestoListItem | undefined {
  const id = Number.parseInt(model.puestoId, 10);
  if (!Number.isFinite(id)) return undefined;
  return model.puestos.find((p) => p.id === id);
}

export function renderMatrizRequisitosTab(model: MatrizRequisitosModel): string {
  const areaOptions = model.areaOptions
    .map(
      (a) =>
        `<option value="${a.id}" ${String(a.id) === model.areaId ? "selected" : ""}>${escapeHtml(a.label)}</option>`,
    )
    .join("");

  const puestosOpts = puestosFiltrados(model)
    .map(
      (p) =>
        `<option value="${p.id}" ${String(p.id) === model.puestoId ? "selected" : ""}>${escapeHtml(p.nombre_puesto)} (${escapeHtml(p.codigo)})</option>`,
    )
    .join("");

  const puesto = puestoSeleccionado(model);
  const nivelOptions = buildNivelMetodoOptions(true);

  const legend = `
    <div class="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
      <span class="font-semibold uppercase tracking-wide">Nivel mínimo requerido</span>
      ${nivelOptions.map(
        (o) =>
          `<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${selectTone(o.value)}">${escapeHtml(o.label)}</span>`,
      ).join("")}
    </div>`;

  let body = "";
  if (!model.puestoId) {
    body = `<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center text-sm text-text-muted">Selecciona un <strong class="font-semibold text-text-primary">perfil de puesto</strong> para definir el nivel requerido de cada competencia asociada.</div>`;
  } else if (model.status === "loading") {
    body = `<div class="flex min-h-[200px] items-center justify-center text-sm text-text-muted" aria-busy="true">Cargando competencias del puesto…</div>`;
  } else if (model.status === "error") {
    body = `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(model.errorMessage ?? "Error al cargar")}</div>`;
  } else if (model.competencias.length === 0) {
    body = `
    <div class="rounded-xl border border-amber-200/80 bg-amber-50/60 px-6 py-10 text-center text-sm text-amber-950">
      <p class="font-semibold">Este puesto no tiene competencias asociadas</p>
      <p class="mt-2 leading-relaxed">Agrégalas desde el perfil del puesto (pestaña Competencias) y vuelve aquí para asignar el nivel 1–4.</p>
      <a href="#/puestos/${escapeHtml(model.puestoId)}" class="mt-4 inline-flex font-semibold text-leoni-blue hover:underline">Ir al perfil del puesto →</a>
    </div>`;
  } else {
    const rows = model.competencias
      .map((comp) => {
        const nivel = getEffectiveNivel(model, comp);
        const dirty = model.pending.has(comp.competencia_id);
        const sub = comp.tipo_nombre
          ? escapeHtml(comp.tipo_nombre)
          : "—";
        const opts = nivelOptions.map(
          (o) =>
            `<option value="${o.value}" ${o.value === nivel ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
        ).join("");
        return `<tr class="border-t border-slate-100 hover:bg-slate-50/60">
          <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(comp.competencia_nombre)}</td>
          <td class="px-4 py-3 text-sm text-text-muted">${sub}</td>
          <td class="px-4 py-3 text-right">
            <div class="grid grid-cols-1 justify-end">
              <select
                data-action="puesto-nivel-req"
                data-competencia-id="${comp.competencia_id}"
                class="col-start-1 row-start-1 min-w-[10rem] appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm font-semibold ${selectTone(nivel)} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING} ${dirty ? "ring-2 ring-leoni-blue/50" : ""}"
                ${model.canEdit ? "" : "disabled"}
                aria-label="Nivel requerido para ${escapeHtml(comp.competencia_nombre)}"
              >${opts}</select>
              ${SELECT_CHEVRON}
            </div>
          </td>
        </tr>`;
      })
      .join("");

    body = `
      <div class="overflow-hidden rounded-xl border border-slate-200/90">
        <table class="min-w-full border-collapse text-sm">
          <thead class="bg-[var(--color-grid-header-bg,#f8fafc)]">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Competencia</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Tipo</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Nivel requerido</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-xs text-text-muted">La misma competencia puede tener distinto nivel en otro puesto; los cambios aplican solo a <strong>${escapeHtml(puesto?.nombre_puesto ?? "este puesto")}</strong>.</p>`;
  }

  const pendingCount = model.pending.size;
  const saveBar =
    model.canEdit && model.puestoId && model.competencias.length > 0
      ? `<div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p class="text-sm text-text-muted">${pendingCount > 0 ? `<strong class="text-text-primary">${pendingCount}</strong> cambio${pendingCount !== 1 ? "s" : ""} sin guardar` : "Sin cambios pendientes"}</p>
          <button type="button" data-action="puesto-niveles-guardar" class="${BTN_PRIMARY}" ${pendingCount === 0 || model.status === "saving" ? "disabled" : ""}>
            ${model.status === "saving" ? "Guardando…" : "Guardar niveles del puesto"}
          </button>
        </div>`
      : !model.canEdit && model.puestoId
        ? `<p class="text-sm rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-amber-950">Solo Recursos Humanos puede editar los niveles requeridos.</p>`
        : "";

  const saveMsg = model.saveMessage
    ? `<p class="text-sm text-emerald-800 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">${escapeHtml(model.saveMessage)}</p>`
    : "";

  return `
    <div class="flex flex-col gap-4">
      <p class="text-sm leading-relaxed text-text-secondary">
        Elige un <strong class="font-semibold text-text-primary">perfil de puesto</strong> y define el nivel mínimo de cada competencia asociada según los niveles configurados en ajustes.
        Una misma competencia del catálogo puede exigir niveles distintos en cada puesto.
      </p>
      ${legend}
      <div class="${RH_LISTADO_SURFACE} p-4 sm:p-5 flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label for="comp-puesto-area" class="mb-1.5 block text-xs font-semibold text-text-secondary">Área (filtro)</label>
            <select id="comp-puesto-area" data-action="puesto-niveles-area" class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-3 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
              <option value="">Todas las áreas</option>
              ${areaOptions}
            </select>
          </div>
          <div>
            <label for="comp-puesto-select" class="mb-1.5 block text-xs font-semibold text-text-secondary">Perfil de puesto</label>
            <div class="grid grid-cols-1">
              <select id="comp-puesto-select" data-action="puesto-niveles-puesto" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-text-primary shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                <option value="">— Seleccionar puesto —</option>
                ${puestosOpts}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
        </div>
        ${puesto ? `<p class="text-xs text-text-muted">Código <span class="font-mono font-semibold">${escapeHtml(puesto.codigo)}</span>${puesto.area ? ` · ${escapeHtml(puesto.area)}` : ""}</p>` : ""}
        ${saveMsg}
        ${body}
        ${saveBar}
      </div>
    </div>`;
}

export async function loadMatrizFilterOptions(model: MatrizRequisitosModel): Promise<void> {
  await ensureMetodosCalificacionCompetenciaLoaded();
  model.areaOptions = await getAreasOptions();
}

export async function loadPuestosList(model: MatrizRequisitosModel): Promise<void> {
  const area_id = model.areaId ? Number(model.areaId) : undefined;
  const all: PerfilPuestoListItem[] = [];
  const page_size = 100;
  for (let page = 1; page <= 20; page += 1) {
    const batch = await getPerfilesList({ page_size, area_id, page });
    all.push(...batch);
    if (batch.length < page_size) break;
  }
  model.puestos = all;
}

export async function loadCompetenciasPuesto(model: MatrizRequisitosModel): Promise<void> {
  const id = Number.parseInt(model.puestoId, 10);
  if (!Number.isFinite(id)) {
    model.competencias = [];
    model.status = "idle";
    return;
  }
  model.status = "loading";
  model.errorMessage = null;
  model.saveMessage = null;
  try {
    await ensureMetodosCalificacionCompetenciaLoaded();
    const grados = await getGradosPuesto({ page_size: 200 });
    const gradoId = (grados.find((g) => g.orden === 1) ?? grados[0])?.id;
    if (!gradoId) {
      model.competencias = [];
      model.status = "ready";
      return;
    }
    model.competencias = await getPerfilCompetencias(id, gradoId);
    model.pending.clear();
    model.status = "ready";
  } catch (e: unknown) {
    model.status = "error";
    model.errorMessage = (e as { status?: number; detail?: string })?.detail ?? "Error al cargar competencias";
    model.competencias = [];
  }
}

export function applyPuestoNivelChange(
  model: MatrizRequisitosModel,
  competenciaId: number,
  nivel: NivelMatriz,
): void {
  const comp = model.competencias.find((c) => c.competencia_id === competenciaId);
  const original = (comp?.nivel_requerido ?? 0) as NivelMatriz;
  if (nivel === original) {
    model.pending.delete(competenciaId);
  } else {
    model.pending.set(competenciaId, nivel);
  }
}

export async function savePuestoNivelesPending(model: MatrizRequisitosModel): Promise<boolean> {
  if (!model.canEdit || !model.puestoId || model.pending.size === 0) return false;
  model.status = "saving";
  model.saveMessage = null;
  const puestoId = model.puestoId;
  const cambios = [...model.pending.entries()].map(([competencia_id, nivel]) => ({
    competencia_id: String(competencia_id),
    puesto_id: puestoId,
    nivel,
  }));
  try {
    const result = await updateMatrizBulk({ cambios });
    model.pending.clear();
    await loadCompetenciasPuesto(model);
    model.saveMessage =
      result.errores.length > 0
        ? `Guardado parcial: ${result.actualizados} niveles. ${result.errores.join("; ")}`
        : `Se guardaron ${result.actualizados} niveles para este puesto.`;
    return true;
  } catch (e: unknown) {
    model.status = "ready";
    model.errorMessage = (e as CompetenciasFetchError)?.detail ?? "Error al guardar";
    return false;
  }
}
