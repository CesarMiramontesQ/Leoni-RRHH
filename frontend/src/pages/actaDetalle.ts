import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { getActaById, improveActaWithIa } from "../api/actas.ts";
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
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300/50"><span aria-hidden="true">🕐</span>En revisión</span>`;
  }
  if (estado === "firmada") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-300/50"><span aria-hidden="true">✅</span>Aprobado</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-900 ring-1 ring-red-300/50"><span aria-hidden="true">❌</span>Rechazado</span>`;
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
    "Sin numero";
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
      puesto: "Sin puesto",
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
        class="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition hover:border-leoni-blue/50 hover:bg-leoni-blue/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
      >
        <div class="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0 4 4m-4-4L8 8M4 16.5v.75A2.75 2.75 0 0 0 6.75 20h10.5A2.75 2.75 0 0 0 20 17.25v-.75" /></svg>
        </div>
        <p class="mt-3 text-sm font-medium text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
        <button
          type="button"
          data-rh-acta-dropzone-trigger
          class="mt-3 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue"
        >
          Agregar archivo
        </button>
        <input data-rh-acta-adjuntos-input type="file" class="hidden" multiple />
      </div>`;
  }
  return `
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      ${adjuntos
        .map((adjunto) => {
          const tone = adjuntoToneClass(adjunto);
          return `
            <article class="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
              <div class="flex items-start gap-2.5">
                <div class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border text-[11px] font-bold ${tone}">
                  ${escapeHtml(adjunto.extension)}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900" title="${escapeHtml(adjunto.nombre)}">${escapeHtml(adjunto.nombre)}</p>
                  <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(adjunto.peso_mb.toFixed(1))} MB</p>
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

function renderDetalleHtml(acta: ActaDetalle): string {
  const nombreEmpleado = formatNombreEmpleadoUi(acta.empleado.nombre) || acta.empleado.nombre;
  const iniciales = inicialesDesdeNombreDisplay(nombreEmpleado);
  const avatar = acta.empleado.foto_url?.trim()
    ? `<img src="${escapeHtml(acta.empleado.foto_url)}" alt="" class="size-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
    : `<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-sm font-semibold text-white">${escapeHtml(iniciales)}</span>`;

  const involucrados = acta.involucrados.length
    ? acta.involucrados
        .map(
          (persona) => `
          <li class="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <span class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">${escapeHtml(
              persona.nombre
                .split(" ")
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join("")
                .slice(0, 2) || "NA",
            )}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(persona.nombre)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(persona.rol)}</p>
            </div>
          </li>`,
        )
        .join("")
    : `<li class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Sin personas involucradas registradas.</li>`;

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
    : `<li class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Sin historial registrado.</li>`;

  return `
    <div id="rh-acta-detalle-root" class="space-y-4">
      <div>
        <a href="#/actas" class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-leoni-blue">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 opacity-80" aria-hidden="true"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>
          Volver a Actas
        </a>
      </div>

      <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">${escapeHtml(acta.titulo_documento)} <span class="text-leoni-blue">#${escapeHtml(acta.folio)}</span></h1>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:text-sm">
              ${badgeEstadoHtml(acta.estado)}
              <span>Creado el ${escapeHtml(fechaCorta(acta.fecha_creacion))}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-leoni-blue/40 hover:text-leoni-blue sm:text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V3m0 13.5 4.5-4.5M12 16.5l-4.5-4.5M4.5 21h15" /></svg>
              Descargar PDF
            </button>
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light sm:text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487ZM19.5 7.125 16.875 4.5" /></svg>
              Editar Acta
            </button>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div class="space-y-5">
          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Información del Empleado</h2>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              ${avatar}
              <div class="min-w-0">
                <p class="truncate text-base font-semibold text-slate-900">${escapeHtml(nombreEmpleado)}</p>
                <p class="text-sm font-medium text-leoni-blue">No. empleado: ${escapeHtml(acta.empleado.id)}</p>
              </div>
            </div>
            <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Area</dt><dd class="mt-0.5">${renderEmptyAwareEmpleadoValue(acta.empleado.area)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Puesto</dt><dd class="mt-0.5">${renderEmptyAwareEmpleadoValue(acta.empleado.puesto)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Supervisor directo</dt><dd class="mt-0.5">${renderEmptyAwareEmpleadoValue(acta.empleado.supervisor_directo)}</dd></div>
            </dl>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Detalle del Evento</h2>
            <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Tipo de incidencia</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.evento.tipo_incidencia)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Fecha y hora</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(fechaHora(acta.evento.fecha_hora))}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Ubicacion</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.evento.ubicacion)}</dd></div>
            </dl>
            <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600">Descripcion de los hechos</p>
              <p class="mt-1 text-sm leading-relaxed text-slate-700">${escapeHtml(acta.evento.descripcion)}</p>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Evidencias y Adjuntos</h2>
              <p data-rh-acta-adjuntos-count class="text-xs text-slate-500">${escapeHtml(String(acta.adjuntos.length))} archivo(s)</p>
            </div>
            <div class="mt-3">${renderAdjuntos(acta.adjuntos)}</div>
          </section>
        </div>

        <aside class="space-y-5">
          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Personas Involucradas</h2>
            <ul class="mt-3 space-y-2">${involucrados}</ul>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Historial de Acta</h2>
            <ol class="mt-3">${historial}</ol>
          </section>

          <section class="rounded-xl border border-red-200/80 bg-white p-4 shadow-sm ring-1 ring-red-500/10 sm:p-5">
            <h2 class="text-sm font-semibold text-red-700 sm:text-base">Acciones de Control</h2>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button type="button" data-rh-acta-open-cancel-modal class="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Anular Acta</button>
              <button type="button" class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue">Solicitar Firma Digital</button>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Asistencia de Redacción</h2>
            <div class="mt-3 space-y-3">
              <button
                type="button"
                data-rh-acta-ia-improve
                title="Usa IA para mejorar la redacción de los hechos descritos en el acta"
                class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                <span aria-hidden="true">✨</span>
                Mejorar con IA
              </button>
              <p class="text-xs text-slate-500">Usa IA para mejorar la redaccion de los hechos descritos en el acta.</p>
              <p data-rh-acta-ia-status class="hidden rounded-lg border px-3 py-2 text-sm"></p>
              <div data-rh-acta-ia-result class="hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold text-slate-900">Version mejorada por IA</h3>
                  <button
                    type="button"
                    data-rh-acta-ia-copy
                    class="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue"
                  >
                    Copiar texto
                  </button>
                </div>
                <p data-rh-acta-ia-text class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"></p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div data-rh-acta-cancel-modal class="fixed inset-0 z-50 hidden items-center justify-center p-4">
        <div data-rh-acta-cancel-overlay class="absolute inset-0 bg-slate-900/40"></div>
        <div class="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
          <h3 class="text-base font-semibold text-slate-900">Confirmar anulacion</h3>
          <p class="mt-2 text-sm text-slate-600">¿Estás seguro de que deseas anular esta acta? Esta acción no se puede deshacer.</p>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" data-rh-acta-cancel-close class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
            <button type="button" data-rh-acta-cancel-confirm class="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Confirmar anulacion</button>
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
  let iaTextoMejorado = "";

  const improveBtnIdleHtml = `
    <span aria-hidden="true">✨</span>
    Mejorar con IA
  `;
  const improveBtnLoadingHtml = `
    <svg class="size-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    Procesando...
  `;

  function setIaImproveLoading(loading: boolean): void {
    const btn = page.querySelector<HTMLButtonElement>("[data-rh-acta-ia-improve]");
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("cursor-not-allowed", loading);
    btn.classList.toggle("opacity-70", loading);
    btn.innerHTML = loading ? improveBtnLoadingHtml : improveBtnIdleHtml;
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

  void (async () => {
    try {
      const data = await getActaById(actaId, signal);
      page.innerHTML = renderDetalleHtml(buildActaDetalleFromApi(data));
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

      const improveBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-ia-improve]");
      if (improveBtn) {
        if (isImprovingWithIa) return;
        isImprovingWithIa = true;
        setIaImproveLoading(true);
        void (async () => {
          try {
            const response = await improveActaWithIa(actaId, signal);
            iaTextoMejorado = response.texto_mejorado.trim();
            const result = page.querySelector<HTMLElement>("[data-rh-acta-ia-result]");
            const text = page.querySelector<HTMLElement>("[data-rh-acta-ia-text]");
            if (result && text) {
              text.textContent = iaTextoMejorado;
              result.classList.remove("hidden");
            }
            showIaStatus("Se genero una sugerencia de redaccion.", "success");
          } catch (error: unknown) {
            if (signal.aborted) return;
            const err = error as { detail?: string } | null;
            showIaStatus(
              err?.detail || "No se pudo generar la mejora con IA. Intenta nuevamente.",
              "error",
            );
          } finally {
            isImprovingWithIa = false;
            setIaImproveLoading(false);
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
            showIaStatus("No se pudo copiar el texto. Copialo manualmente.", "error");
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
      countLabel.textContent = `${String(input.files?.length ?? 0)} archivo(s)`;
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
      dropzone.classList.add("border-leoni-blue", "bg-leoni-blue/5");
    },
    { signal },
  );

  page.addEventListener(
    "dragleave",
    (event) => {
      const target = event.target as HTMLElement;
      const dropzone = target.closest<HTMLElement>("[data-rh-acta-dropzone-trigger]");
      if (!dropzone) return;
      dropzone.classList.remove("border-leoni-blue", "bg-leoni-blue/5");
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
      dropzone.classList.remove("border-leoni-blue", "bg-leoni-blue/5");
      const fileCount = event.dataTransfer?.files?.length ?? 0;
      const countLabel = page.querySelector<HTMLElement>("[data-rh-acta-adjuntos-count]");
      if (countLabel) countLabel.textContent = `${String(fileCount)} archivo(s)`;
    },
    { signal },
  );
}
