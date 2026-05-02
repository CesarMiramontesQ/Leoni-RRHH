import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  getActaById,
  improveActaWithIa,
  updateActaAdministrativa,
  type ActaDetailResponse,
  type ActaUpdatePayload,
} from "../api/actas.ts";
import {
  type ActaAdjunto,
  type ActaDetalle,
  type ActaEstadoCodigo,
} from "../actas/actasMockData.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

function forbiddenHtml(): string {
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">La sección de detalle de actas administrativas solo está disponible para RH.</p>
      <a href="#/actas" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al listado de actas</a>
    </div>`;
}

function fechaCorta(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function fechaHora(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function badgeEstadoHtml(estado: ActaEstadoCodigo): string {
  if (estado === "abierta" || estado === "en_proceso") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-[#fff7ed] px-3.5 py-1.5 text-xs font-semibold text-[#b45309] ring-1 ring-amber-200/70"><span aria-hidden="true">●</span>En revisión</span>`;
  }
  if (estado === "firmada") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#ecfdf3] px-3.5 py-1.5 text-xs font-semibold text-[#027a48] ring-1 ring-emerald-200/70"><span aria-hidden="true">●</span>Firmada</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70"><span aria-hidden="true">●</span>Cerrada</span>`;
}

function skeletonHtml(): string {
  return `
    <div class="space-y-4" aria-busy="true">
      <div class="animate-pulse rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div class="h-6 w-72 max-w-full rounded bg-slate-200"></div>
        <div class="mt-2 h-4 w-48 rounded bg-slate-100"></div>
      </div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div class="space-y-4 lg:col-span-8">
          <div class="animate-pulse rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
            <div class="h-5 w-40 rounded bg-slate-200"></div>
            <div class="mt-3 h-20 rounded bg-slate-100"></div>
          </div>
          <div class="animate-pulse rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
            <div class="h-5 w-44 rounded bg-slate-200"></div>
            <div class="mt-3 h-28 rounded bg-slate-100"></div>
          </div>
        </div>
        <div class="space-y-4 lg:col-span-4">
          <div class="animate-pulse rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
            <div class="h-5 w-36 rounded bg-slate-200"></div>
            <div class="mt-3 h-32 rounded bg-slate-100"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function adjuntoToneClass(adjunto: ActaAdjunto): string {
  if (adjunto.preview_color === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (adjunto.preview_color === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (adjunto.preview_color === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function estadoProcesoIndex(estado: ActaEstadoCodigo): number {
  if (estado === "abierta") return 0;
  if (estado === "en_proceso") return 1;
  if (estado === "firmada") return 2;
  return 3;
}

function adjuntosCountText(count: number): string {
  if (count <= 0) return "Sin archivos adjuntos";
  if (count === 1) return "1 archivo adjunto";
  return `${String(count)} archivos adjuntos`;
}

function rolBadgeClass(rol: string): string {
  if (rol === "Testigo") return "border-sky-200 bg-sky-50 text-sky-700";
  if (rol === "Responsable RH") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function renderProcesoEstado(estado: ActaEstadoCodigo): string {
  const steps = ["Creada", "En revisión", "Firma pendiente", "Cerrada"];
  const current = estadoProcesoIndex(estado);
  return `
    <ol class="space-y-3">
      ${steps
        .map((step, index) => {
          const isDone = index < current;
          const isCurrent = index === current;
          const dotClass = isDone
            ? "border-[#1e40af] bg-[#1e40af] text-white"
            : isCurrent
              ? "border-[#1e40af] bg-white text-[#1e40af]"
              : "border-slate-300 bg-white text-slate-400";
          const titleClass = isCurrent
            ? "text-slate-900"
            : isDone
              ? "text-slate-800"
              : "text-slate-500";
          return `
            <li class="relative pl-9 ${index < steps.length - 1 ? "pb-3" : ""}">
              <span class="absolute left-0 top-0 inline-flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${dotClass}">
                ${isDone ? "✓" : String(index + 1)}
              </span>
              ${
                index < steps.length - 1
                  ? `<span class="absolute left-[11px] top-6 h-[calc(100%-0.25rem)] w-px ${isDone ? "bg-[#1e40af]/30" : "bg-slate-200"}"></span>`
                  : ""
              }
              <p class="text-sm font-semibold ${titleClass}">${escapeHtml(step)}</p>
              <p class="mt-0.5 text-xs text-slate-500">${isCurrent ? "Estado actual" : isDone ? "Completado" : "Pendiente"}</p>
            </li>`;
        })
        .join("")}
    </ol>
  `;
}

function mapBackendEstadoToUi(
  estado: "draft" | "pending_sign" | "signed" | "archived",
): ActaEstadoCodigo {
  if (estado === "pending_sign") return "en_proceso";
  if (estado === "signed") return "firmada";
  if (estado === "archived") return "cerrada";
  return "abierta";
}

function parsePeopleList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumeroEmpleadoDisplay(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw;
}

function buildActaDetalleFromApi(data: {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  numero_empleado: string | null;
  puesto: string | null;
  area_departamento: string | null;
  supervisor_directo: string | null;
  tipo_falta: string | null;
  fundamento_legal: "Ley Federal del Trabajo" | "Reglamento Interior de Trabajo" | null;
  articulo_inciso: string | null;
  fecha_evento: string | null;
  lugar_incidente: string | null;
  descripcion_hechos: string | null;
  personas_involucradas: string | null;
  testigos: string | null;
  responsable_rh: string | null;
  evidencia: string | null;
  estado: "draft" | "pending_sign" | "signed" | "archived";
  created_at: string;
}): ActaDetalle {
  const numero =
    normalizeNumeroEmpleadoDisplay(data.numero_empleado) ||
    "Sin número";
  const nombre = data.empleado_nombre?.trim() || `Empleado ${numero}`;
  const created = data.created_at;
  const eventoDate = data.fecha_evento
    ? `${data.fecha_evento}T00:00:00`
    : created;
  const evidenciaArchivos = parsePeopleList(data.evidencia);

  const involucrados: ActaDetalle["involucrados"] = [];
  for (const persona of parsePeopleList(data.personas_involucradas)) {
    involucrados.push({
      id: `inv-${persona.toLowerCase().replace(/\s+/g, "-")}`,
      nombre: persona,
      rol: "Involucrado",
    });
  }
  for (const persona of parsePeopleList(data.testigos)) {
    involucrados.push({
      id: `test-${persona.toLowerCase().replace(/\s+/g, "-")}`,
      nombre: persona,
      rol: "Testigo",
    });
  }
  if (data.responsable_rh?.trim()) {
    involucrados.push({
      id: "rh-responsable",
      nombre: data.responsable_rh,
      rol: "Responsable RH",
    });
  }

  return {
    id: data.id,
    folio: `ACT-${String(data.id).padStart(4, "0")}`,
    titulo_documento: "Acta Administrativa",
    estado: mapBackendEstadoToUi(data.estado),
    fecha_creacion: created,
    empleado: {
      id: numero,
      nombre,
      foto_url: null,
      area: data.area_departamento?.trim() || "Sin área",
      puesto: data.puesto?.trim() || "Sin puesto",
      supervisor_directo: data.supervisor_directo?.trim() || "Sin supervisor",
    },
    evento: {
      tipo_incidencia: data.tipo_falta?.trim() || "No especificado",
      fecha_hora: eventoDate,
      ubicacion: data.lugar_incidente?.trim() || "No especificada",
      descripcion:
        data.descripcion_hechos?.trim() ||
        "Sin descripción registrada.",
    },
    involucrados,
    historial: [
      {
        id: `h-created-${data.id}`,
        titulo: "Acta creada",
        descripcion: "Registro creado en la plataforma.",
        fecha_hora: created,
      },
    ],
    adjuntos: evidenciaArchivos.map((nombreArchivo, index) => {
      const parts = nombreArchivo.split(".");
      const ext = (parts[parts.length - 1] || "DOC").toUpperCase();
      return {
        id: `adj-${data.id}-${index + 1}`,
        nombre: nombreArchivo,
        extension: ext,
        peso_mb: 0,
        preview_color: "slate" as const,
      };
    }),
  };
}

function renderAdjuntos(adjuntos: readonly ActaAdjunto[]): string {
  if (adjuntos.length === 0) {
    return `
      <div
        data-rh-acta-dropzone-trigger
        role="button"
        tabindex="0"
        class="rounded-2xl border-2 border-dashed border-slate-300 bg-[#f8fafc] px-4 py-8 text-center transition hover:border-[#1d4ed8]/60 hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
      >
        <div class="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0 4 4m-4-4L8 8M4 16.5v.75A2.75 2.75 0 0 0 6.75 20h10.5A2.75 2.75 0 0 0 20 17.25v-.75" /></svg>
        </div>
        <p class="mt-3 text-sm font-semibold text-slate-800">Sube evidencias o documentos relacionados</p>
        <p class="mt-1 text-xs text-slate-500">PDF, JPG, PNG o DOCX · Máximo 10 MB por archivo</p>
        <button
          type="button"
          data-rh-acta-dropzone-trigger
          class="mt-4 inline-flex items-center rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#1d4ed8]/40 hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
        >
          Seleccionar archivo
        </button>
        <input data-rh-acta-adjuntos-input type="file" class="hidden" multiple />
      </div>`;
  }
  return `
    <div class="space-y-2.5">
      ${adjuntos
        .map((adjunto) => {
          const tone = adjuntoToneClass(adjunto);
          return `
            <article class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:shadow-sm">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-2.5">
                <div class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border text-[11px] font-bold ${tone}">
                  ${escapeHtml(adjunto.extension)}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900" title="${escapeHtml(adjunto.nombre)}">${escapeHtml(adjunto.nombre)}</p>
                  <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(adjunto.peso_mb.toFixed(1))} MB</p>
                </div>
              </div>
                <div class="flex shrink-0 items-center gap-2">
                  <button type="button" class="rounded-md px-2 py-1 text-xs font-semibold text-[#1e40af] transition hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30">Ver</button>
                  <button type="button" class="rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40">Eliminar</button>
                </div>
              </div>
            </article>`;
        })
        .join("")}
    </div>`;
}

function renderEmptyAwareEmpleadoValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "sin puesto" ||
    normalized === "sin área" ||
    normalized === "sin area" ||
    normalized === "sin supervisor" ||
    normalized === "sin supervisor directo"
  ) {
    return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs italic text-slate-500">Sin asignar</span>`;
  }
  return `<span class="font-semibold text-slate-800">${escapeHtml(value)}</span>`;
}

function historialEventVisual(evento: { titulo: string; descripcion: string }): {
  iconHtml: string;
  dotToneClass: string;
} {
  const source = `${evento.titulo} ${evento.descripcion}`.toLowerCase();
  if (source.includes("anul")) {
    return {
      iconHtml: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l8 8M14 6l-8 8" /></svg>`,
      dotToneClass: "border-red-200 bg-red-100 text-red-700",
    };
  }
  if (source.includes("firm")) {
    return {
      iconHtml: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 10 3.5 3.5L15.5 6" /></svg>`,
      dotToneClass: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  }
  if (source.includes("edit") || source.includes("actualiz")) {
    return {
      iconHtml: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m13.8 3.2 3 3L7 16H4v-3l9.8-9.8Z" /></svg>`,
      dotToneClass: "border-sky-200 bg-sky-100 text-sky-700",
    };
  }
  return {
    iconHtml: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 4v6h6" /></svg>`,
    dotToneClass: "border-amber-200 bg-amber-100 text-amber-700",
  };
}

function renderIaActionButton(hasRecommendation: boolean): string {
  const improveButtonLabel = hasRecommendation ? "Regenerar" : "Recomendación IA";
  return `
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        data-rh-acta-ia-view
        title="Ver recomendación de IA guardada para esta acta"
        ${hasRecommendation ? "" : "disabled"}
        class="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#1e40af]/25 bg-white px-3 py-2 text-sm font-semibold text-[#1e40af] transition hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true">📄</span>
        Ver recomendación
      </button>
      <button
        type="button"
        data-rh-acta-ia-improve
        title="${hasRecommendation ? "Generar o regenerar recomendación de redacción" : "Generar recomendación de redacción con IA"}"
        class="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#1e40af] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
      >
        <span aria-hidden="true">✨</span>
        ${improveButtonLabel}
      </button>
    </div>
  `;
}

type ActaEditDraft = {
  tipo_falta: string;
  fundamento_legal: "Ley Federal del Trabajo" | "Reglamento Interior de Trabajo";
  articulo_inciso: string;
  fecha_evento: string;
  lugar_incidente: string;
  descripcion_hechos: string;
  personas_involucradas: string;
  testigos: string;
  responsable_rh: string;
};

type EditStatus = {
  tone: "error" | "success";
  message: string;
};

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const source = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildEditDraftFromApi(data: ActaDetailResponse): ActaEditDraft {
  return {
    tipo_falta: data.tipo_falta?.trim() || "",
    fundamento_legal: data.fundamento_legal || "Ley Federal del Trabajo",
    articulo_inciso: data.articulo_inciso?.trim() || "",
    fecha_evento: toDateInputValue(data.fecha_evento),
    lugar_incidente: data.lugar_incidente?.trim() || "",
    descripcion_hechos: data.descripcion_hechos?.trim() || "",
    personas_involucradas: data.personas_involucradas?.trim() || "",
    testigos: data.testigos?.trim() || "",
    responsable_rh: data.responsable_rh?.trim() || "",
  };
}

function normalizeNullable(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function renderDetalleHtml(
  acta: ActaDetalle,
  hasIaRecommendation: boolean,
  options: {
    isEditMode: boolean;
    isSavingEdit: boolean;
    editDraft: ActaEditDraft | null;
    editStatus: EditStatus | null;
  },
): string {
  const nombreEmpleado = formatNombreEmpleadoUi(acta.empleado.nombre) || acta.empleado.nombre;
  const iniciales = inicialesDesdeNombreDisplay(nombreEmpleado);
  const isEditMode = options.isEditMode;
  const isSavingEdit = options.isSavingEdit;
  const editDraft = options.editDraft;
  const editStatus = options.editStatus;
  const avatar = acta.empleado.foto_url?.trim()
    ? `<img src="${escapeHtml(acta.empleado.foto_url)}" alt="" class="size-14 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />`
    : `<span class="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e40af] to-[#1d4ed8] text-sm font-semibold text-white shadow-sm">${escapeHtml(iniciales)}</span>`;

  const involucrados = acta.involucrados.length
    ? acta.involucrados
        .map(
          (persona) => `
          <li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:shadow-sm">
            <span class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#1e40af] ring-1 ring-[#c7d2fe]">${escapeHtml(
              persona.nombre
                .split(" ")
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join("")
                .slice(0, 2) || "NA",
            )}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(persona.nombre)}</p>
              <p class="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rolBadgeClass(persona.rol)}">${escapeHtml(persona.rol)}</p>
            </div>
          </li>`,
        )
        .join("")
    : `<li class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Sin personas relacionadas registradas.</li>`;

  const historial = acta.historial.length
    ? acta.historial
        .map((evento, idx) => {
          const visual = historialEventVisual(evento);
          return `
            <li class="relative pl-10 ${idx < acta.historial.length - 1 ? "pb-5" : ""}">
              <span class="absolute left-0 top-0.5 inline-flex size-7 items-center justify-center rounded-full border ${visual.dotToneClass}">
                ${visual.iconHtml}
              </span>
              ${idx < acta.historial.length - 1 ? '<span class="absolute left-3.5 top-8 h-[calc(100%-0.25rem)] w-px bg-slate-200"></span>' : ""}
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-semibold text-slate-900">${escapeHtml(evento.titulo)}</p>
                <time class="whitespace-nowrap text-xs text-slate-500">${escapeHtml(fechaHora(evento.fecha_hora))}</time>
              </div>
              <p class="mt-1 text-sm text-slate-600">${escapeHtml(evento.descripcion)}</p>
            </li>`;
        })
        .join("")
    : `<li class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Sin historial registrado.</li>`;

  const editStatusHtml = editStatus
    ? `<p class="mt-3 rounded-lg border px-3 py-2 text-sm ${
        editStatus.tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }">${escapeHtml(editStatus.message)}</p>`
    : "";

  const tipoIncidenciaValue = editDraft?.tipo_falta ?? acta.evento.tipo_incidencia;
  const fechaEventoValue = editDraft?.fecha_evento ?? toDateInputValue(acta.evento.fecha_hora);
  const ubicacionValue = editDraft?.lugar_incidente ?? acta.evento.ubicacion;
  const descripcionValue = editDraft?.descripcion_hechos ?? acta.evento.descripcion;
  const fundamentoLegalValue = editDraft?.fundamento_legal ?? "Ley Federal del Trabajo";
  const articuloValue = editDraft?.articulo_inciso ?? "";
  const involucradosValue = editDraft?.personas_involucradas ?? "";
  const testigosValue = editDraft?.testigos ?? "";
  const responsableRhValue = editDraft?.responsable_rh ?? "";

  return `
    <div id="rh-acta-detalle-root" class="space-y-6">
      <div>
        <a href="#/actas" class="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 opacity-80" aria-hidden="true"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>
          Volver a Actas
        </a>
      </div>

      <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0">
            <h1 class="truncate text-[26px] font-semibold tracking-tight text-[#111827]">${escapeHtml(acta.titulo_documento)} <span class="text-[#1e40af]">#${escapeHtml(acta.folio)}</span></h1>
            <div class="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[#667085]">
              ${badgeEstadoHtml(acta.estado)}
              <span>Creada el ${escapeHtml(fechaCorta(acta.fecha_creacion))}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center justify-start gap-2 md:justify-end">
            <button type="button" class="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#1e40af]/40 hover:text-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V3m0 13.5 4.5-4.5M12 16.5l-4.5-4.5M4.5 21h15" /></svg>
              Descargar PDF
            </button>
            ${
              isEditMode
                ? `<button
                    type="button"
                    data-rh-acta-cancel-edit
                    ${isSavingEdit ? "disabled" : ""}
                    class="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    data-rh-acta-save-edit
                    ${isSavingEdit ? "disabled" : ""}
                    class="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-[#1e40af] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    ${
                      isSavingEdit
                        ? `<svg class="size-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                             <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                             <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
                           </svg>
                           Guardando...`
                        : "Guardar"
                    }
                  </button>`
                : `<button
                    type="button"
                    data-rh-acta-start-edit
                    class="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-[#1e40af] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487ZM19.5 7.125 16.875 4.5" /></svg>
                    Editar Acta
                  </button>`
            }
          </div>
        </div>
        ${editStatusHtml}
      </section>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div class="space-y-6">
          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Información del empleado</h2>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              ${avatar}
              <div class="min-w-0">
                <p class="truncate text-[15px] font-semibold text-[#111827]">${escapeHtml(nombreEmpleado)}</p>
                <p class="text-[13px] font-medium text-[#1e40af]">Número de empleado: ${escapeHtml(acta.empleado.id)}</p>
              </div>
            </div>
            <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div class="rounded-xl border border-slate-100 bg-[#f8fafc] px-3 py-2.5"><dt class="text-[12px] font-medium text-[#667085]">Área</dt><dd class="mt-1 text-[15px]">${renderEmptyAwareEmpleadoValue(acta.empleado.area)}</dd></div>
              <div class="rounded-xl border border-slate-100 bg-[#f8fafc] px-3 py-2.5"><dt class="text-[12px] font-medium text-[#667085]">Puesto</dt><dd class="mt-1 text-[15px]">${renderEmptyAwareEmpleadoValue(acta.empleado.puesto)}</dd></div>
              <div class="rounded-xl border border-slate-100 bg-[#f8fafc] px-3 py-2.5 sm:col-span-2"><dt class="text-[12px] font-medium text-[#667085]">Supervisor directo</dt><dd class="mt-1 text-[15px]">${renderEmptyAwareEmpleadoValue(acta.empleado.supervisor_directo)}</dd></div>
            </dl>
          </section>

          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Detalle del evento</h2>
            ${
              isEditMode
                ? `<div class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Tipo de incidencia</span>
                       <input data-rh-acta-edit-tipo type="text" value="${escapeHtml(tipoIncidenciaValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Fundamento legal</span>
                       <select data-rh-acta-edit-fundamento class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30">
                         <option value="Ley Federal del Trabajo" ${fundamentoLegalValue === "Ley Federal del Trabajo" ? "selected" : ""}>Ley Federal del Trabajo</option>
                         <option value="Reglamento Interior de Trabajo" ${fundamentoLegalValue === "Reglamento Interior de Trabajo" ? "selected" : ""}>Reglamento Interior de Trabajo</option>
                       </select>
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Artículo / inciso</span>
                       <input data-rh-acta-edit-articulo type="text" value="${escapeHtml(articuloValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Fecha del evento</span>
                       <input data-rh-acta-edit-fecha type="date" value="${escapeHtml(fechaEventoValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5 md:col-span-2">
                       <span class="text-[12px] font-medium text-[#667085]">Ubicación</span>
                       <input data-rh-acta-edit-ubicacion type="text" value="${escapeHtml(ubicacionValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                   </div>
                   <label class="mt-4 block rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
                     <span class="text-[12px] font-medium text-[#667085]">Descripción de los hechos</span>
                     <textarea data-rh-acta-edit-descripcion rows="4" class="mt-2 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] leading-relaxed text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30">${escapeHtml(descripcionValue)}</textarea>
                   </label>
                   <div class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Personas involucradas (separadas por coma)</span>
                       <input data-rh-acta-edit-involucradas type="text" value="${escapeHtml(involucradosValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                       <span class="text-[12px] font-medium text-[#667085]">Testigos (separados por coma)</span>
                       <input data-rh-acta-edit-testigos type="text" value="${escapeHtml(testigosValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                     <label class="rounded-xl border border-slate-100 bg-white px-3 py-2.5 md:col-span-2">
                       <span class="text-[12px] font-medium text-[#667085]">Responsable RH</span>
                       <input data-rh-acta-edit-responsable type="text" value="${escapeHtml(responsableRhValue)}" class="mt-1.5 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-[15px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30" />
                     </label>
                   </div>`
                : `<dl class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                     <div class="rounded-xl border border-slate-100 bg-white px-3 py-2.5"><dt class="text-[12px] font-medium text-[#667085]">Tipo de incidencia</dt><dd class="mt-1 text-[15px] font-semibold text-slate-800">${escapeHtml(acta.evento.tipo_incidencia)}</dd></div>
                     <div class="rounded-xl border border-slate-100 bg-white px-3 py-2.5"><dt class="text-[12px] font-medium text-[#667085]">Fecha y hora</dt><dd class="mt-1 text-[15px] font-semibold text-slate-800">${escapeHtml(fechaHora(acta.evento.fecha_hora))}</dd></div>
                     <div class="rounded-xl border border-slate-100 bg-white px-3 py-2.5"><dt class="text-[12px] font-medium text-[#667085]">Ubicación</dt><dd class="mt-1 text-[15px] font-semibold text-slate-800">${escapeHtml(acta.evento.ubicacion)}</dd></div>
                   </dl>
                   <div class="mt-4 rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
                     <p class="text-[12px] font-medium text-[#667085]">Descripción de los hechos</p>
                     <p class="mt-2 text-[15px] leading-relaxed text-slate-700">${escapeHtml(acta.evento.descripcion)}</p>
                   </div>`
            }
          </section>

          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-[17px] font-semibold text-[#111827]">Evidencias y adjuntos</h2>
              <p data-rh-acta-adjuntos-count class="text-[12px] text-[#667085]">${escapeHtml(adjuntosCountText(acta.adjuntos.length))}</p>
            </div>
            <div class="mt-4">${renderAdjuntos(acta.adjuntos)}</div>
          </section>
        </div>

        <aside class="space-y-6">
          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Estado del proceso</h2>
            <div class="mt-4">${renderProcesoEstado(acta.estado)}</div>
          </section>

          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Acciones del acta</h2>
            <div class="mt-4 grid grid-cols-1 gap-2">
              <button type="button" class="inline-flex min-h-10 w-full items-center justify-center rounded-[10px] bg-[#1e40af] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40">Solicitar Firma Digital</button>
              <button type="button" data-rh-acta-open-cancel-modal title="Esta acción no se puede deshacer" class="inline-flex min-h-10 w-full items-center justify-center rounded-[10px] border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40">Anular Acta</button>
            </div>
          </section>

          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Personas relacionadas</h2>
            <ul class="mt-4 space-y-2.5">${involucrados}</ul>
          </section>

          <section class="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Historial del acta</h2>
            <ol class="mt-4">${historial}</ol>
          </section>

          <section class="rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#ecfdf3] via-white to-[#f0fdf4] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
            <h2 class="text-[17px] font-semibold text-[#111827]">Asistente de redacción IA</h2>
            <div class="mt-4 space-y-3">
              ${
                hasIaRecommendation
                  ? `<p class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#027a48]">
                       <span aria-hidden="true">✨</span>
                       Recomendación lista
                     </p>`
                  : ""
              }
              <p class="text-[13px] text-[#667085]">La IA generó una sugerencia de redacción para esta acta.</p>
              <div data-rh-acta-ia-action-wrap>${renderIaActionButton(hasIaRecommendation)}</div>
              <p class="text-xs ${hasIaRecommendation ? "text-[#027a48]" : "text-slate-500"}">
                ${
                  hasIaRecommendation
                    ? "Se generó y guardó una recomendación de redacción."
                    : "Aún no hay una recomendación generada."
                }
              </p>
              <p data-rh-acta-ia-status class="hidden rounded-lg border px-3 py-2 text-sm"></p>
            </div>
          </section>
        </aside>
      </div>

      <div data-rh-acta-cancel-modal class="fixed inset-0 z-50 hidden items-center justify-center p-4">
        <div data-rh-acta-cancel-overlay class="absolute inset-0 bg-slate-900/40"></div>
        <div class="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h3 class="text-base font-semibold text-slate-900">¿Seguro que deseas anular esta acta?</h3>
          <p class="mt-2 text-sm text-slate-600">Esta acción no se puede deshacer.</p>
          <label class="mt-4 block">
            <span class="text-xs font-medium text-slate-600">Motivo de anulación</span>
            <textarea data-rh-acta-cancel-reason rows="3" placeholder="Escribe el motivo..." class="mt-1 w-full rounded-[10px] border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30"></textarea>
          </label>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" data-rh-acta-cancel-close class="inline-flex items-center rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">Cancelar</button>
            <button type="button" data-rh-acta-cancel-confirm class="inline-flex items-center rounded-[10px] bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Sí, anular acta</button>
          </div>
        </div>
      </div>

      <div data-rh-acta-ia-modal class="fixed inset-0 z-50 hidden items-center justify-center p-4">
        <div data-rh-acta-ia-modal-overlay class="absolute inset-0 bg-slate-900/40"></div>
        <div class="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-slate-900">Recomendación de IA</h3>
            <button
              type="button"
              data-rh-acta-ia-modal-close
              class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
          <div class="mt-3 max-h-[58vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p data-rh-acta-ia-text class="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">Presiona "Regenerar" para generar una recomendación.</p>
          </div>
          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              data-rh-acta-ia-regenerate
              class="inline-flex items-center gap-1.5 rounded-[10px] bg-[#1e40af] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              🔄 Regenerar
            </button>
            <button
              type="button"
              data-rh-acta-ia-copy
              class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              Copiar texto
            </button>
            <button
              type="button"
              data-rh-acta-ia-close-primary
              class="inline-flex items-center rounded-lg bg-leoni-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-leoni-blue-light"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

export function mountActaDetalle(container: HTMLElement, actaId: number, signal: AbortSignal): void {
  if (getRolFromAccessToken() !== "rh") {
    mountAppShell(container, {
      pageTitle: "Detalle de acta",
      activeNav: "actas",
      mainClass: "py-5 sm:py-6",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  mountAppShell(container, {
    pageTitle: "Detalle de acta",
    activeNav: "actas",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="rh-acta-detalle-page" class="space-y-4">${skeletonHtml()}</div>`,
  });

  const page = container.querySelector("#rh-acta-detalle-page");
  if (!(page instanceof HTMLElement)) return;
  let isImprovingWithIa = false;
  let isRegeneratingIa = false;
  let iaTextoMejorado = "";
  let hasIaRecommendation = false;
  let actaData: ActaDetailResponse | null = null;
  let isEditMode = false;
  let isSavingEdit = false;
  let editDraft: ActaEditDraft | null = null;
  let editStatus: EditStatus | null = null;

  function renderPageContent(): void {
    if (!actaData) return;
    page.innerHTML = renderDetalleHtml(
      buildActaDetalleFromApi(actaData),
      hasIaRecommendation,
      {
        isEditMode,
        isSavingEdit,
        editDraft,
        editStatus,
      },
    );
  }

  function getInputValue(selector: string): string {
    const input = page.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
    return input?.value.trim() || "";
  }

  function buildEditPayloadFromForm(): ActaUpdatePayload {
    return {
      tipo_falta: getInputValue("[data-rh-acta-edit-tipo]"),
      fundamento_legal: (getInputValue("[data-rh-acta-edit-fundamento]") || "Ley Federal del Trabajo") as
        | "Ley Federal del Trabajo"
        | "Reglamento Interior de Trabajo",
      articulo_inciso: normalizeNullable(getInputValue("[data-rh-acta-edit-articulo]")),
      fecha_evento: getInputValue("[data-rh-acta-edit-fecha]"),
      lugar_incidente: getInputValue("[data-rh-acta-edit-ubicacion]"),
      descripcion_hechos: getInputValue("[data-rh-acta-edit-descripcion]"),
      personas_involucradas: normalizeNullable(getInputValue("[data-rh-acta-edit-involucradas]")),
      testigos: normalizeNullable(getInputValue("[data-rh-acta-edit-testigos]")),
      responsable_rh: getInputValue("[data-rh-acta-edit-responsable]"),
    };
  }

  function validateEditPayload(payload: ActaUpdatePayload): string | null {
    if (!payload.tipo_falta) return "El tipo de incidencia es obligatorio.";
    if (!payload.fundamento_legal) return "El fundamento legal es obligatorio.";
    if (!payload.fecha_evento || !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha_evento)) {
      return "La fecha del evento es obligatoria y debe tener formato válido.";
    }
    if (!payload.lugar_incidente) return "La ubicación es obligatoria.";
    if (!payload.descripcion_hechos) return "La descripción de los hechos es obligatoria.";
    if (!payload.responsable_rh) return "El responsable RH es obligatorio.";
    return null;
  }

  function getImproveBtnIdleHtml(): string {
    const label = hasIaRecommendation ? "Regenerar" : "Recomendación IA";
    return `
      <span aria-hidden="true">✨</span>
      ${label}
    `;
  }
  const improveBtnLoadingHtml = `
    <svg class="size-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    Procesando...
  `;
  const regenerateBtnIdleHtml = "🔄 Regenerar";
  const regenerateBtnLoadingHtml = `
    <svg class="size-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    Regenerando...
  `;

  function setIaActionButton(): void {
    const wrap = page.querySelector<HTMLElement>("[data-rh-acta-ia-action-wrap]");
    if (!wrap) return;
    wrap.innerHTML = renderIaActionButton(hasIaRecommendation);
  }

  function setIaImproveLoading(loading: boolean): void {
    const btn = page.querySelector<HTMLButtonElement>("[data-rh-acta-ia-improve]");
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("cursor-not-allowed", loading);
    btn.classList.toggle("opacity-70", loading);
    btn.innerHTML = loading ? improveBtnLoadingHtml : getImproveBtnIdleHtml();
  }

  function showIaStatus(
    message: string,
    tone: "error" | "success",
  ): void {
    const status = page.querySelector<HTMLElement>("[data-rh-acta-ia-status]");
    if (!status) return;
    status.classList.remove("hidden", "border-red-200", "bg-red-50", "text-red-800", "border-emerald-200", "bg-emerald-50", "text-emerald-800");
    if (tone === "error") {
      status.classList.add("border-red-200", "bg-red-50", "text-red-800");
    } else {
      status.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
    }
    status.textContent = message;
  }

  function setIaModalOpen(open: boolean): void {
    const modal = page.querySelector<HTMLElement>("[data-rh-acta-ia-modal]");
    if (!modal) return;
    modal.classList.toggle("hidden", !open);
    modal.classList.toggle("flex", open);
  }

  function setIaModalText(
    message: string,
    tone: "loading" | "default" | "error" = "default",
  ): void {
    const text = page.querySelector<HTMLElement>("[data-rh-acta-ia-text]");
    if (!text) return;
    text.classList.remove("text-slate-700", "text-slate-600", "text-red-700", "animate-pulse");
    if (tone === "loading") {
      text.classList.add("text-slate-600", "animate-pulse");
    } else if (tone === "error") {
      text.classList.add("text-red-700");
    } else {
      text.classList.add("text-slate-700");
    }
    text.textContent = message;
  }

  function setIaCopyEnabled(enabled: boolean): void {
    const copyBtn = page.querySelector<HTMLButtonElement>("[data-rh-acta-ia-copy]");
    if (!copyBtn) return;
    copyBtn.disabled = !enabled;
  }

  function setIaRegenerateLoading(loading: boolean): void {
    const btn = page.querySelector<HTMLButtonElement>("[data-rh-acta-ia-regenerate]");
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("cursor-not-allowed", loading);
    btn.classList.toggle("opacity-70", loading);
    btn.innerHTML = loading ? regenerateBtnLoadingHtml : regenerateBtnIdleHtml;
  }

  async function generateIaRecommendation(): Promise<void> {
    setIaCopyEnabled(false);
    setIaModalText("Generando recomendación con IA...", "loading");
    try {
      const response = await improveActaWithIa(actaId, signal);
      iaTextoMejorado = response.texto_mejorado.trim();
      hasIaRecommendation = Boolean(iaTextoMejorado);
      setIaActionButton();
      setIaModalText(iaTextoMejorado || "No se recibió contenido para mostrar.");
      setIaCopyEnabled(Boolean(iaTextoMejorado));
      showIaStatus("Se generó y guardó una recomendación de redacción.", "success");
    } catch (error: unknown) {
      if (signal.aborted) return;
      const err = error as { detail?: string } | null;
      const message = err?.detail || "No se pudo generar la recomendación. Intenta de nuevo.";
      setIaModalText(message, "error");
      setIaCopyEnabled(Boolean(iaTextoMejorado));
      showIaStatus(message, "error");
    }
  }

  void (async () => {
    try {
      const data = await getActaById(actaId, signal);
      actaData = data;
      iaTextoMejorado = (data.ia_recomendacion || "").trim();
      hasIaRecommendation = Boolean(iaTextoMejorado);
      renderPageContent();
      return;
    } catch (error: unknown) {
      if (signal.aborted) return;
      const err = error as { status?: number; detail?: string } | null;
      if (err?.status === 404) {
        page.innerHTML = `
          <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p class="font-semibold">Acta no encontrada</p>
            <p class="mt-1">${escapeHtml(err.detail || "No se encontró el acta solicitada.")}</p>
            <a href="#/actas" class="mt-3 inline-flex items-center gap-1.5 font-semibold text-leoni-blue hover:underline">Volver al listado</a>
          </div>`;
        return;
      }
      page.innerHTML = `
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p class="font-semibold">No se pudo cargar el detalle del acta.</p>
          <p class="mt-1">${escapeHtml(err?.detail || "Ocurrió un error inesperado.")}</p>
          <button type="button" data-rh-acta-retry class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 transition hover:bg-red-100">Reintentar</button>
        </div>`;
      return;
    }
  })().catch(() => {
    if (signal.aborted) return;
    page.innerHTML = `
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p class="font-semibold">No se pudo cargar el detalle del acta.</p>
        <p class="mt-1">Ocurrió un error inesperado.</p>
        <a href="#/actas" class="mt-3 inline-flex items-center gap-1.5 font-semibold text-leoni-blue hover:underline">Volver al listado</a>
      </div>`;
  });

  page.addEventListener(
    "click",
    (event) => {
      const startEditBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-start-edit]");
      if (startEditBtn) {
        if (!actaData || isSavingEdit) return;
        editDraft = buildEditDraftFromApi(actaData);
        editStatus = null;
        isEditMode = true;
        renderPageContent();
        return;
      }

      const cancelEditBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-cancel-edit]");
      if (cancelEditBtn) {
        if (isSavingEdit) return;
        isEditMode = false;
        editDraft = actaData ? buildEditDraftFromApi(actaData) : null;
        editStatus = null;
        renderPageContent();
        return;
      }

      const saveEditBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-save-edit]");
      if (saveEditBtn) {
        if (!actaData || !isEditMode || isSavingEdit) return;
        const payload = buildEditPayloadFromForm();
        const validationError = validateEditPayload(payload);
        if (validationError) {
          editStatus = { tone: "error", message: validationError };
          renderPageContent();
          return;
        }

        isSavingEdit = true;
        editStatus = null;
        renderPageContent();

        void (async () => {
          try {
            const updatedActa = await updateActaAdministrativa(actaId, payload, signal);
            actaData = updatedActa;
            isEditMode = false;
            editDraft = buildEditDraftFromApi(actaData);
            editStatus = { tone: "success", message: "Acta actualizada correctamente." };
            renderPageContent();
          } catch (error: unknown) {
            if (signal.aborted) return;
            const err = error as { detail?: string } | null;
            editStatus = {
              tone: "error",
              message: err?.detail || "No se pudieron guardar los cambios. Intenta nuevamente.",
            };
            renderPageContent();
          } finally {
            isSavingEdit = false;
            renderPageContent();
          }
        })();
        return;
      }

      const dropzoneTrigger = (event.target as HTMLElement).closest<HTMLElement>("[data-rh-acta-dropzone-trigger]");
      if (dropzoneTrigger) {
        const input = page.querySelector<HTMLInputElement>("[data-rh-acta-adjuntos-input]");
        input?.click();
        return;
      }

      const openCancelModalBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-open-cancel-modal]");
      if (openCancelModalBtn) {
        const modal = page.querySelector<HTMLElement>("[data-rh-acta-cancel-modal]");
        modal?.classList.remove("hidden");
        modal?.classList.add("flex");
        return;
      }

      const closeCancelModalTrigger = (event.target as HTMLElement).closest<HTMLElement>("[data-rh-acta-cancel-close], [data-rh-acta-cancel-overlay]");
      if (closeCancelModalTrigger) {
        const modal = page.querySelector<HTMLElement>("[data-rh-acta-cancel-modal]");
        modal?.classList.remove("flex");
        modal?.classList.add("hidden");
        return;
      }

      const confirmCancelModalBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-cancel-confirm]");
      if (confirmCancelModalBtn) {
        const modal = page.querySelector<HTMLElement>("[data-rh-acta-cancel-modal]");
        modal?.classList.remove("flex");
        modal?.classList.add("hidden");
        return;
      }

      const closeIaModalTrigger = (event.target as HTMLElement).closest<HTMLElement>("[data-rh-acta-ia-modal-close], [data-rh-acta-ia-modal-overlay], [data-rh-acta-ia-close-primary]");
      if (closeIaModalTrigger) {
        setIaModalOpen(false);
        return;
      }

      const viewBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-ia-view]");
      if (viewBtn) {
        setIaModalOpen(true);
        if (iaTextoMejorado.trim()) {
          setIaModalText(iaTextoMejorado);
        } else {
          setIaModalText("Aún no hay una recomendación guardada para esta acta.");
        }
        setIaCopyEnabled(Boolean(iaTextoMejorado.trim()));
        return;
      }

      const improveBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-ia-improve]");
      if (improveBtn) {
        if (isImprovingWithIa || isRegeneratingIa) return;
        setIaModalOpen(true);
        isImprovingWithIa = true;
        setIaImproveLoading(true);
        void (async () => {
          try {
            await generateIaRecommendation();
          } finally {
            isImprovingWithIa = false;
            setIaImproveLoading(false);
          }
        })();
        return;
      }

      const regenerateBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-ia-regenerate]");
      if (regenerateBtn) {
        if (isImprovingWithIa || isRegeneratingIa) return;
        isRegeneratingIa = true;
        setIaRegenerateLoading(true);
        void (async () => {
          try {
            await generateIaRecommendation();
          } finally {
            isRegeneratingIa = false;
            setIaRegenerateLoading(false);
          }
        })();
        return;
      }

      const copyBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-ia-copy]");
      if (copyBtn) {
        if (!iaTextoMejorado.trim()) return;
        void navigator.clipboard
          .writeText(iaTextoMejorado)
          .then(() => {
            showIaStatus("Texto copiado al portapapeles.", "success");
          })
          .catch(() => {
            showIaStatus("No se pudo copiar el texto. Cópialo manualmente.", "error");
          });
        return;
      }

      const retryBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-retry]");
      if (!retryBtn) return;
      retryBtn.disabled = true;
      window.location.hash = `#/actas/${actaId}`;
    },
    { signal },
  );

  page.addEventListener(
    "keydown",
    (event) => {
      const target = event.target as HTMLElement;
      if (!target.matches("[data-rh-acta-dropzone-trigger]")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const input = page.querySelector<HTMLInputElement>("[data-rh-acta-adjuntos-input]");
      input?.click();
    },
    { signal },
  );

  page.addEventListener(
    "change",
    (event) => {
      const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-rh-acta-adjuntos-input]");
      if (!input) return;
      const countLabel = page.querySelector<HTMLElement>("[data-rh-acta-adjuntos-count]");
      if (!countLabel) return;
      countLabel.textContent = adjuntosCountText(input.files?.length ?? 0);
    },
    { signal },
  );

  page.addEventListener(
    "dragover",
    (event) => {
      const target = event.target as HTMLElement;
      const dropzone = target.closest<HTMLElement>("[data-rh-acta-dropzone-trigger]");
      if (!dropzone) return;
      event.preventDefault();
      dropzone.classList.add("border-blue-500", "bg-blue-50");
    },
    { signal },
  );

  page.addEventListener(
    "dragleave",
    (event) => {
      const target = event.target as HTMLElement;
      const dropzone = target.closest<HTMLElement>("[data-rh-acta-dropzone-trigger]");
      if (!dropzone) return;
      dropzone.classList.remove("border-blue-500", "bg-blue-50");
    },
    { signal },
  );

  page.addEventListener(
    "drop",
    (event) => {
      const target = event.target as HTMLElement;
      const dropzone = target.closest<HTMLElement>("[data-rh-acta-dropzone-trigger]");
      if (!dropzone) return;
      event.preventDefault();
      dropzone.classList.remove("border-blue-500", "bg-blue-50");
      const fileCount = event.dataTransfer?.files?.length ?? 0;
      const countLabel = page.querySelector<HTMLElement>("[data-rh-acta-adjuntos-count]");
      if (countLabel) countLabel.textContent = adjuntosCountText(fileCount);
    },
    { signal },
  );
}
