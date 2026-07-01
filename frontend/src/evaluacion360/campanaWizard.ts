// frontend/src/evaluacion360/campanaWizard.ts
// Asistente (wizard) de 5 pasos para crear una campaña de Evaluación 360°.
// Autónomo: monta su propio overlay, gestiona su estado y, al crear la campaña,
// invoca onCreated() y se desmonta. No depende del paint() de la página.

import { getCompetencias } from "../api/competencias.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import {
  createEval360Campana,
  createEval360Plantilla,
  fetchEval360Escalas,
  fetchEval360Plantillas,
  type CampanaCreatePayload,
  type EscalaApi,
  type PlantillaApi,
  type TipoEvaluadorApi,
} from "../api/evaluacion360.ts";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT, FIELD_TEXTAREA, MODAL_OVERLAY } from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

interface CompetenciaSel {
  competencia_id: number;
  nombre: string;
  peso: number;
  num_preguntas: number | null;
  nivel_esperado: number;
  obligatoria: boolean;
}
interface ParticipanteSel {
  empleado_id: number;
  nombre: string;
  extra: string;
}
type EvaluadorState = Record<TipoEvaluadorApi, { activo: boolean; peso: number }>;

const TIPOS: { tipo: TipoEvaluadorApi; label: string }[] = [
  { tipo: "autoevaluacion", label: "Autoevaluación" },
  { tipo: "jefe", label: "Jefe directo" },
  { tipo: "par", label: "Compañeros (pares)" },
  { tipo: "subordinado", label: "Subordinados" },
  { tipo: "cliente_interno", label: "Clientes internos" },
  { tipo: "cliente_externo", label: "Clientes externos" },
];

const PASOS = ["Información", "Competencias", "Participantes", "Evaluadores", "Configuración"];

interface WizardState {
  step: number;
  nombre: string;
  descripcion: string;
  objetivo: string;
  fecha_inicio: string;
  fecha_cierre: string;
  competencias: CompetenciaSel[];
  participantes: ParticipanteSel[];
  evaluadores: EvaluadorState;
  escala_id: number | null;
  cfg: {
    anonima: boolean;
    comentarios_obligatorios: boolean;
    permitir_borradores: boolean;
    mostrar_progreso: boolean;
    fecha_limite: string;
  };
  // catálogos / búsqueda
  catalogo: { id: number; nombre: string }[] | null;
  escalas: EscalaApi[] | null;
  plantillas: PlantillaApi[] | null;
  busqueda: string;
  resultados: ParticipanteSel[];
  buscando: boolean;
  submitting: boolean;
  error: string | null;
}

export function openCampanaWizard(host: HTMLElement, onCreated: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = MODAL_OVERLAY;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  host.appendChild(overlay);
  // El listener de acciones se registra una sola vez (el innerHTML se reemplaza
  // en cada render, pero el overlay persiste).
  overlay.addEventListener("click", onClick);

  const st: WizardState = {
    step: 1,
    nombre: "",
    descripcion: "",
    objetivo: "",
    fecha_inicio: "",
    fecha_cierre: "",
    competencias: [],
    participantes: [],
    evaluadores: {
      autoevaluacion: { activo: true, peso: 10 },
      jefe: { activo: true, peso: 40 },
      par: { activo: true, peso: 20 },
      subordinado: { activo: true, peso: 20 },
      cliente_interno: { activo: false, peso: 10 },
      cliente_externo: { activo: false, peso: 0 },
    },
    escala_id: null,
    cfg: {
      anonima: false,
      comentarios_obligatorios: false,
      permitir_borradores: true,
      mostrar_progreso: true,
      fecha_limite: "",
    },
    catalogo: null,
    escalas: null,
    plantillas: null,
    busqueda: "",
    resultados: [],
    buscando: false,
    submitting: false,
    error: null,
  };

  function close(): void {
    overlay.remove();
  }

  function sumaPesosEvaluadores(): number {
    return TIPOS.reduce((acc, t) => acc + (st.evaluadores[t.tipo].activo ? Number(st.evaluadores[t.tipo].peso) || 0 : 0), 0);
  }

  function validarPaso(): string | null {
    if (st.step === 1) {
      if (!st.nombre.trim() || st.nombre.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
      if (st.fecha_inicio && st.fecha_cierre && st.fecha_cierre < st.fecha_inicio)
        return "La fecha de cierre no puede ser anterior a la de inicio.";
    }
    if (st.step === 2 && st.competencias.length === 0) return "Selecciona al menos una competencia.";
    if (st.step === 3 && st.participantes.length === 0) return "Selecciona al menos un participante.";
    if (st.step === 4) {
      const activos = TIPOS.filter((t) => st.evaluadores[t.tipo].activo);
      if (activos.length === 0) return "Activa al menos un tipo de evaluador.";
      if (Math.abs(sumaPesosEvaluadores() - 100) > 0.01)
        return `Los pesos de evaluadores activos deben sumar 100% (suman ${sumaPesosEvaluadores()}).`;
    }
    return null;
  }

  async function ensureCatalogo(): Promise<void> {
    if (st.catalogo !== null) return;
    try {
      const comps = await getCompetencias({ page_size: 300 });
      st.catalogo = comps.map((c) => ({ id: c.id, nombre: c.nombre }));
    } catch {
      st.catalogo = [];
    }
    render();
  }

  async function ensureEscalas(): Promise<void> {
    if (st.escalas !== null) return;
    st.escalas = await fetchEval360Escalas();
    if (st.escala_id === null && st.escalas.length > 0) st.escala_id = st.escalas[0].id;
    render();
  }

  async function ensurePlantillas(): Promise<void> {
    if (st.plantillas !== null) return;
    st.plantillas = await fetchEval360Plantillas();
    render();
  }

  function aplicarPlantilla(id: number): void {
    const pl = st.plantillas?.find((p) => p.id === id);
    if (!pl) return;
    st.competencias = pl.competencias.map((c) => ({
      competencia_id: c.competencia_id,
      nombre: c.competencia_nombre ?? `#${c.competencia_id}`,
      peso: c.peso,
      num_preguntas: c.num_preguntas,
      nivel_esperado: c.nivel_esperado,
      obligatoria: c.obligatoria,
    }));
    for (const t of TIPOS) st.evaluadores[t.tipo] = { activo: false, peso: 0 };
    for (const t of pl.evaluador_tipos) {
      st.evaluadores[t.tipo] = { activo: t.activo, peso: t.peso };
    }
    if (pl.escala_id != null) st.escala_id = pl.escala_id;
    const cfg = (pl.config ?? {}) as Record<string, unknown>;
    st.cfg = {
      anonima: Boolean(cfg.anonima),
      comentarios_obligatorios: Boolean(cfg.comentarios_obligatorios),
      permitir_borradores: cfg.permitir_borradores !== false,
      mostrar_progreso: cfg.mostrar_progreso !== false,
      fecha_limite: typeof cfg.fecha_limite === "string" ? cfg.fecha_limite : "",
    };
    st.error = null;
    render();
  }

  async function guardarComoPlantilla(): Promise<void> {
    if (st.competencias.length === 0) {
      st.error = "Agrega competencias antes de guardar la plantilla.";
      render();
      return;
    }
    const nombre = window.prompt("Nombre de la plantilla:", st.nombre || "Nueva plantilla");
    if (!nombre) return;
    const res = await createEval360Plantilla({
      nombre: nombre.trim(),
      escala_id: st.escala_id,
      competencias: st.competencias.map((c, i) => ({
        competencia_id: c.competencia_id, peso: Number(c.peso) || 0,
        num_preguntas: c.num_preguntas, nivel_esperado: c.nivel_esperado,
        obligatoria: c.obligatoria, orden: i,
      })),
      evaluador_tipos: TIPOS.map((t) => ({
        tipo: t.tipo, peso: Number(st.evaluadores[t.tipo].peso) || 0,
        activo: st.evaluadores[t.tipo].activo,
      })),
      config: {
        anonima: st.cfg.anonima,
        comentarios_obligatorios: st.cfg.comentarios_obligatorios,
        permitir_borradores: st.cfg.permitir_borradores,
        mostrar_progreso: st.cfg.mostrar_progreso,
      },
    });
    st.plantillas = null;
    window.alert(res ? "Plantilla guardada." : "No se pudo guardar la plantilla.");
    void ensurePlantillas();
  }

  async function buscarEmpleados(): Promise<void> {
    st.buscando = true;
    render();
    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 20, q: st.busqueda });
      st.resultados = page.items.map((e) => ({
        empleado_id: e.empleado_id,
        nombre: e.nombre,
        extra: [e.puesto?.descripcion, e.area?.descripcion].filter(Boolean).join(" · "),
      }));
    } catch {
      st.resultados = [];
    }
    st.buscando = false;
    render();
  }

  async function submit(): Promise<void> {
    const err = validarPaso();
    if (err) {
      st.error = err;
      render();
      return;
    }
    st.submitting = true;
    st.error = null;
    render();
    const payload: CampanaCreatePayload = {
      nombre: st.nombre.trim(),
      descripcion: st.descripcion.trim() || null,
      objetivo: st.objetivo.trim() || null,
      fecha_inicio: st.fecha_inicio || null,
      fecha_cierre: st.fecha_cierre || null,
      escala_id: st.escala_id,
      competencias: st.competencias.map((c, i) => ({
        competencia_id: c.competencia_id,
        peso: Number(c.peso) || 0,
        num_preguntas: c.num_preguntas,
        nivel_esperado: c.nivel_esperado,
        obligatoria: c.obligatoria,
        orden: i,
      })),
      evaluador_tipos: TIPOS.map((t) => ({
        tipo: t.tipo,
        peso: Number(st.evaluadores[t.tipo].peso) || 0,
        activo: st.evaluadores[t.tipo].activo,
      })),
      empleado_ids: st.participantes.map((p) => p.empleado_id),
      config: {
        anonima: st.cfg.anonima,
        comentarios_obligatorios: st.cfg.comentarios_obligatorios,
        permitir_borradores: st.cfg.permitir_borradores,
        mostrar_progreso: st.cfg.mostrar_progreso,
        fecha_limite: st.cfg.fecha_limite || null,
      },
    };
    const res = await createEval360Campana(payload);
    st.submitting = false;
    if (res) {
      close();
      onCreated();
      return;
    }
    st.error = "No se pudo crear la campaña. Revisa los pesos (deben sumar 100%) y los datos.";
    render();
  }

  // ── Render por paso ─────────────────────────────────────────────────────────
  function renderStepper(): string {
    return `
      <ol class="flex flex-wrap items-center gap-2">
        ${PASOS.map((label, i) => {
          const n = i + 1;
          const estado = n === st.step ? "activo" : n < st.step ? "hecho" : "pendiente";
          const dot =
            estado === "activo"
              ? "bg-leoni-blue text-white"
              : estado === "hecho"
                ? "bg-emerald-500 text-white"
                : "bg-slate-200 text-slate-600";
          return `<li class="flex items-center gap-1.5 text-xs">
            <span class="inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${dot}">${estado === "hecho" ? "✓" : n}</span>
            <span class="${n === st.step ? "font-semibold text-text-primary" : "text-text-muted"}">${escapeHtml(label)}</span>
            ${n < PASOS.length ? '<span class="mx-1 text-slate-300">›</span>' : ""}
          </li>`;
        }).join("")}
      </ol>`;
  }

  function stepInfo(): string {
    const plOpts =
      st.plantillas === null
        ? '<option>Cargando…</option>'
        : [`<option value="">Sin plantilla (configurar manualmente)</option>`]
            .concat(st.plantillas.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`))
            .join("");
    return `
      <div class="mb-4 rounded-lg border border-dashed border-border bg-slate-50/60 p-3">
        <label class="mb-1 block text-xs font-medium text-text-muted">Usar plantilla (opcional)</label>
        <select data-wz-select="plantilla" class="${FIELD_INPUT}">${plOpts}</select>
        <p class="mt-1 text-[11px] text-text-muted">Prellena competencias, evaluadores y configuración desde una plantilla guardada.</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-text-muted">Nombre de la campaña *</label>
          <input type="text" data-wf="nombre" value="${escapeHtml(st.nombre)}" class="${FIELD_INPUT}" placeholder="Ej. Evaluación 360° Liderazgo Q3 2026" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-text-muted">Descripción</label>
          <textarea data-wf="descripcion" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(st.descripcion)}</textarea>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-text-muted">Objetivo</label>
          <textarea data-wf="objetivo" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(st.objetivo)}</textarea>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Fecha inicio</label>
          <input type="date" data-wf="fecha_inicio" value="${escapeHtml(st.fecha_inicio)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Fecha cierre</label>
          <input type="date" data-wf="fecha_cierre" value="${escapeHtml(st.fecha_cierre)}" class="${FIELD_INPUT}" />
        </div>
      </div>`;
  }

  function stepCompetencias(): string {
    const opciones =
      st.catalogo === null
        ? '<option>Cargando…</option>'
        : st.catalogo
            .filter((c) => !st.competencias.some((s) => s.competencia_id === c.id))
            .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
            .join("");
    const filas = st.competencias
      .map(
        (c, idx) => `
      <tr class="border-b border-slate-100">
        <td class="px-2 py-2 text-sm text-text-primary">${escapeHtml(c.nombre)}</td>
        <td class="px-2 py-2"><input type="number" min="0" max="100" data-comp-idx="${idx}" data-comp-field="peso" value="${c.peso}" class="w-16 rounded border border-border px-2 py-1 text-sm" /></td>
        <td class="px-2 py-2"><input type="number" min="1" max="50" data-comp-idx="${idx}" data-comp-field="num_preguntas" value="${c.num_preguntas ?? ""}" placeholder="todas" class="w-20 rounded border border-border px-2 py-1 text-sm" /></td>
        <td class="px-2 py-2"><input type="number" min="0" max="4" data-comp-idx="${idx}" data-comp-field="nivel_esperado" value="${c.nivel_esperado}" class="w-14 rounded border border-border px-2 py-1 text-sm" /></td>
        <td class="px-2 py-2 text-center"><input type="checkbox" data-comp-idx="${idx}" data-comp-field="obligatoria" ${c.obligatoria ? "checked" : ""} class="size-4" /></td>
        <td class="px-2 py-2 text-right"><button type="button" class="text-xs font-semibold text-red-600 hover:underline" data-wz="del-comp" data-id="${c.competencia_id}">Quitar</button></td>
      </tr>`,
      )
      .join("");
    return `
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <label class="mb-1 block text-xs font-medium text-text-muted">Agregar competencia del catálogo</label>
          <select data-wz-select="comp" class="${FIELD_INPUT}">${opciones}</select>
        </div>
        <button type="button" class="${BTN_SECONDARY}" data-wz="add-comp">Agregar</button>
      </div>
      <div class="mt-4 overflow-x-auto rounded-lg border border-border">
        <table class="min-w-full text-left">
          <thead>
            <tr class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-2 py-2">Competencia</th><th class="px-2 py-2">Peso %</th><th class="px-2 py-2"># Preguntas</th><th class="px-2 py-2">Nivel esp.</th><th class="px-2 py-2">Oblig.</th><th class="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>${filas || '<tr><td colspan="6" class="px-2 py-6 text-center text-sm text-text-muted">Sin competencias seleccionadas</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function stepParticipantes(): string {
    const chips = st.participantes
      .map(
        (p) => `
      <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-text-primary">
        ${escapeHtml(p.nombre)}
        <button type="button" class="text-slate-400 hover:text-red-600" data-wz="del-emp" data-id="${p.empleado_id}" aria-label="Quitar">✕</button>
      </span>`,
      )
      .join("");
    const resultados =
      st.buscando
        ? '<p class="px-2 py-3 text-sm text-text-muted">Buscando…</p>'
        : st.resultados.length === 0
          ? '<p class="px-2 py-3 text-sm text-text-muted">Sin resultados. Busca por nombre o número.</p>'
          : st.resultados
              .filter((r) => !st.participantes.some((p) => p.empleado_id === r.empleado_id))
              .map(
                (r) => `
        <button type="button" class="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-2 py-2 text-left hover:bg-slate-50" data-wz="add-emp" data-id="${r.empleado_id}" data-nombre="${escapeHtml(r.nombre)}" data-extra="${escapeHtml(r.extra)}">
          <span class="text-sm text-text-primary">${escapeHtml(r.nombre)}</span>
          <span class="text-xs text-text-muted">${escapeHtml(r.extra)}</span>
        </button>`,
              )
              .join("");
    return `
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <label class="mb-1 block text-xs font-medium text-text-muted">Buscar empleados a evaluar</label>
          <input type="text" data-wz-input="busqueda" value="${escapeHtml(st.busqueda)}" class="${FIELD_INPUT}" placeholder="Nombre o número de empleado" />
        </div>
        <button type="button" class="${BTN_SECONDARY}" data-wz="buscar-emp">Buscar</button>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="max-h-56 overflow-y-auto rounded-lg border border-border">${resultados}</div>
        <div>
          <p class="mb-2 text-xs font-medium text-text-muted">Seleccionados (${st.participantes.length})</p>
          <div class="flex flex-wrap gap-2">${chips || '<span class="text-sm text-text-muted">Aún no hay participantes.</span>'}</div>
        </div>
      </div>`;
  }

  function stepEvaluadores(): string {
    const suma = sumaPesosEvaluadores();
    const filas = TIPOS.map((t) => {
      const e = st.evaluadores[t.tipo];
      return `
      <tr class="border-b border-slate-100">
        <td class="px-3 py-2 text-center"><input type="checkbox" data-eval-tipo="${t.tipo}" data-eval-field="activo" ${e.activo ? "checked" : ""} class="size-4" /></td>
        <td class="px-3 py-2 text-sm text-text-primary">${escapeHtml(t.label)}</td>
        <td class="px-3 py-2 text-right"><input type="number" min="0" max="100" data-eval-tipo="${t.tipo}" data-eval-field="peso" value="${e.peso}" class="w-20 rounded border border-border px-2 py-1 text-right text-sm" ${e.activo ? "" : "disabled"} /> %</td>
      </tr>`;
    }).join("");
    return `
      <p class="text-sm text-text-muted">El sistema sugiere evaluadores automáticamente desde la estructura organizacional (jefe, pares, subordinados). Los clientes se agregan manualmente por campaña.</p>
      <div class="mt-3 overflow-x-auto rounded-lg border border-border">
        <table class="min-w-full text-left">
          <thead><tr class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted"><th class="px-3 py-2">Activo</th><th class="px-3 py-2">Tipo de evaluador</th><th class="px-3 py-2 text-right">Peso</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="mt-2 text-sm ${Math.abs(suma - 100) < 0.01 ? "text-emerald-600" : "text-red-600"}">Suma de pesos activos: <span data-wz-suma class="font-semibold tabular-nums">${suma}</span>% ${Math.abs(suma - 100) < 0.01 ? "✓" : "(debe ser 100%)"}</p>`;
  }

  function stepConfig(): string {
    const escOpts =
      st.escalas === null
        ? '<option>Cargando…</option>'
        : st.escalas
            .map((e) => `<option value="${e.id}" ${st.escala_id === e.id ? "selected" : ""}>${escapeHtml(e.nombre)} (${e.valor_min}–${e.valor_max})</option>`)
            .join("");
    const check = (field: keyof WizardState["cfg"], label: string) =>
      `<label class="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-cfg="${field}" ${st.cfg[field] ? "checked" : ""} class="size-4 rounded border-border text-accent focus:ring-accent" />${escapeHtml(label)}</label>`;
    return `
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Escala de calificación</label>
          <select data-wz-select="escala" class="${FIELD_INPUT}">${escOpts}</select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Fecha límite de respuesta</label>
          <input type="date" data-cfg-date="fecha_limite" value="${escapeHtml(st.cfg.fecha_limite)}" class="${FIELD_INPUT}" />
        </div>
      </div>
      <div class="mt-4 space-y-2">
        ${check("anonima", "Evaluación anónima")}
        ${check("comentarios_obligatorios", "Comentarios obligatorios")}
        ${check("permitir_borradores", "Permitir guardar borradores")}
        ${check("mostrar_progreso", "Mostrar progreso al evaluador")}
      </div>`;
  }

  function renderBody(): string {
    switch (st.step) {
      case 1: return stepInfo();
      case 2: return stepCompetencias();
      case 3: return stepParticipantes();
      case 4: return stepEvaluadores();
      default: return stepConfig();
    }
  }

  function render(): void {
    overlay.innerHTML = `
      <div class="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 class="text-lg font-semibold text-text-primary">Nueva campaña 360°</h2>
          <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" data-wz="close" aria-label="Cerrar">✕</button>
        </div>
        <div class="border-b border-slate-100 px-6 py-3">${renderStepper()}</div>
        <div class="px-6 py-5">
          ${st.error ? `<div class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(st.error)}</div>` : ""}
          ${renderBody()}
        </div>
        <div class="sticky bottom-0 flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <button type="button" class="${BTN_GHOST} ${st.step === 1 ? "invisible" : ""}" data-wz="prev">Anterior</button>
          <div class="flex gap-2">
            ${st.step >= 4 ? `<button type="button" class="${BTN_GHOST}" data-wz="guardar-plantilla">Guardar como plantilla</button>` : ""}
            <button type="button" class="${BTN_SECONDARY}" data-wz="close">Cancelar</button>
            ${
              st.step < PASOS.length
                ? `<button type="button" class="${BTN_PRIMARY}" data-wz="next">Siguiente</button>`
                : `<button type="button" class="${BTN_PRIMARY}" data-wz="submit" ${st.submitting ? "disabled" : ""}>${st.submitting ? "Creando…" : "Crear campaña"}</button>`
            }
          </div>
        </div>
      </div>`;
    bind();
    if (st.step === 1) void ensurePlantillas();
    if (st.step === 2) void ensureCatalogo();
    if (st.step === 5) void ensureEscalas();
  }

  function bind(): void {
    // Campos simples del paso 1 (data-wf).
    overlay.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-wf]").forEach((el) => {
      el.addEventListener("input", () => {
        (st as unknown as Record<string, unknown>)[el.dataset.wf as string] = el.value;
      });
    });
    // Inputs de competencias.
    overlay.querySelectorAll<HTMLInputElement>("[data-comp-idx]").forEach((el) => {
      el.addEventListener("input", () => {
        const idx = Number(el.dataset.compIdx);
        const field = el.dataset.compField as keyof CompetenciaSel;
        const comp = st.competencias[idx];
        if (!comp) return;
        if (field === "obligatoria") comp.obligatoria = (el as HTMLInputElement).checked;
        else if (field === "num_preguntas") comp.num_preguntas = el.value ? Number(el.value) : null;
        else (comp[field] as number) = Number(el.value);
      });
    });
    // Inputs de evaluadores.
    overlay.querySelectorAll<HTMLInputElement>("[data-eval-tipo]").forEach((el) => {
      el.addEventListener("input", () => {
        const tipo = el.dataset.evalTipo as TipoEvaluadorApi;
        const field = el.dataset.evalField;
        if (field === "activo") {
          st.evaluadores[tipo].activo = el.checked;
          render();
        } else {
          st.evaluadores[tipo].peso = Number(el.value) || 0;
          const span = overlay.querySelector("[data-wz-suma]");
          if (span) {
            const suma = sumaPesosEvaluadores();
            span.textContent = String(suma);
            (span.parentElement as HTMLElement).className = `mt-2 text-sm ${Math.abs(suma - 100) < 0.01 ? "text-emerald-600" : "text-red-600"}`;
          }
        }
      });
    });
    // Config checkboxes / fecha / escala.
    overlay.querySelectorAll<HTMLInputElement>("[data-cfg]").forEach((el) => {
      el.addEventListener("change", () => {
        (st.cfg as unknown as Record<string, boolean>)[el.dataset.cfg as string] = el.checked;
      });
    });
    overlay.querySelector<HTMLInputElement>("[data-cfg-date]")?.addEventListener("input", (e) => {
      st.cfg.fecha_limite = (e.target as HTMLInputElement).value;
    });
    overlay.querySelector<HTMLSelectElement>('[data-wz-select="escala"]')?.addEventListener("change", (e) => {
      st.escala_id = Number((e.target as HTMLSelectElement).value);
    });
    overlay.querySelector<HTMLSelectElement>('[data-wz-select="plantilla"]')?.addEventListener("change", (e) => {
      const id = Number((e.target as HTMLSelectElement).value);
      if (id) aplicarPlantilla(id);
    });
    overlay.querySelector<HTMLInputElement>('[data-wz-input="busqueda"]')?.addEventListener("input", (e) => {
      st.busqueda = (e.target as HTMLInputElement).value;
    });
  }

  function onClick(ev: Event): void {
    const target = (ev.target as HTMLElement).closest<HTMLElement>("[data-wz]");
    if (!target) return;
    const action = target.dataset.wz;
    switch (action) {
      case "close":
        close();
        break;
      case "prev":
        st.step = Math.max(1, st.step - 1);
        st.error = null;
        render();
        break;
      case "next": {
        const err = validarPaso();
        if (err) { st.error = err; render(); return; }
        st.error = null;
        st.step = Math.min(PASOS.length, st.step + 1);
        render();
        break;
      }
      case "add-comp": {
        const sel = overlay.querySelector<HTMLSelectElement>('[data-wz-select="comp"]');
        const id = Number(sel?.value);
        const cat = st.catalogo?.find((c) => c.id === id);
        if (cat && !st.competencias.some((c) => c.competencia_id === id)) {
          st.competencias.push({ competencia_id: id, nombre: cat.nombre, peso: 0, num_preguntas: null, nivel_esperado: 3, obligatoria: true });
          repartirPesosCompetencias();
          render();
        }
        break;
      }
      case "del-comp":
        st.competencias = st.competencias.filter((c) => c.competencia_id !== Number(target.dataset.id));
        repartirPesosCompetencias();
        render();
        break;
      case "buscar-emp":
        void buscarEmpleados();
        break;
      case "add-emp": {
        const id = Number(target.dataset.id);
        if (!st.participantes.some((p) => p.empleado_id === id)) {
          st.participantes.push({ empleado_id: id, nombre: target.dataset.nombre ?? "", extra: target.dataset.extra ?? "" });
          render();
        }
        break;
      }
      case "del-emp":
        st.participantes = st.participantes.filter((p) => p.empleado_id !== Number(target.dataset.id));
        render();
        break;
      case "guardar-plantilla":
        void guardarComoPlantilla();
        break;
      case "submit":
        void submit();
        break;
    }
  }

  // Reparte 100% equitativamente entre competencias al agregar/quitar.
  function repartirPesosCompetencias(): void {
    const n = st.competencias.length;
    if (n === 0) return;
    const base = Math.floor((100 / n) * 100) / 100;
    st.competencias.forEach((c, i) => {
      c.peso = i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base;
    });
  }

  render();
}
