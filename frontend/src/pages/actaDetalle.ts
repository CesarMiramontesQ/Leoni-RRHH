import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  fetchActaDetalleMockById,
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
  if (estado === "abierta") {
    return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">En revisión</span>`;
  }
  if (estado === "en_proceso") {
    return `<span class="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">En proceso</span>`;
  }
  if (estado === "firmada") {
    return `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Firmada</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Cerrada</span>`;
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

function renderAdjuntos(adjuntos: readonly ActaAdjunto[]): string {
  if (adjuntos.length === 0) {
    return `<p class="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Sin archivos adjuntos para esta acta.</p>`;
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
        .map(
          (evento, idx) => `
            <li class="relative pl-6 ${idx < acta.historial.length - 1 ? "pb-4" : ""}">
              <span class="absolute left-0 top-1.5 size-2 rounded-full bg-leoni-blue"></span>
              ${idx < acta.historial.length - 1 ? '<span class="absolute left-[3px] top-3.5 h-[calc(100%-0.25rem)] w-px bg-slate-200"></span>' : ""}
              <p class="text-sm font-semibold text-slate-900">${escapeHtml(evento.titulo)}</p>
              <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(fechaHora(evento.fecha_hora))}</p>
              <p class="mt-1 text-sm text-slate-700">${escapeHtml(evento.descripcion)}</p>
            </li>`,
        )
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
            <h1 class="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">${escapeHtml(acta.titulo_documento)} <span class="text-leoni-blue">#${escapeHtml(acta.folio)}</span></h1>
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

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div class="space-y-4 lg:col-span-8">
          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Información del Empleado</h2>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              ${avatar}
              <div class="min-w-0">
                <p class="truncate text-base font-semibold text-slate-900">${escapeHtml(nombreEmpleado)}</p>
                <p class="text-sm font-medium text-leoni-blue">ID: ${escapeHtml(acta.empleado.id)}</p>
              </div>
            </div>
            <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Área</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.empleado.area)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Puesto</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.empleado.puesto)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Supervisor directo</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.empleado.supervisor_directo)}</dd></div>
            </dl>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Detalle del Evento</h2>
            <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Tipo de incidencia</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.evento.tipo_incidencia)}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Fecha y hora</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(fechaHora(acta.evento.fecha_hora))}</dd></div>
              <div class="rounded-md bg-slate-50 px-3 py-2"><dt class="text-[11px] font-semibold uppercase text-slate-500">Ubicación</dt><dd class="mt-0.5 font-semibold text-slate-800">${escapeHtml(acta.evento.ubicacion)}</dd></div>
            </dl>
            <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p class="text-[11px] font-semibold uppercase text-slate-500">Descripción de los hechos</p>
              <p class="mt-1 text-sm leading-relaxed text-slate-700">${escapeHtml(acta.evento.descripcion)}</p>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-slate-900 sm:text-base">Evidencias y Adjuntos</h2>
              <p class="text-xs text-slate-500">${escapeHtml(String(acta.adjuntos.length))} archivo(s)</p>
            </div>
            <div class="mt-3">${renderAdjuntos(acta.adjuntos)}</div>
          </section>
        </div>

        <aside class="space-y-4 lg:col-span-4">
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
            <div class="mt-3 space-y-2">
              <button type="button" class="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Anular Acta</button>
              <button type="button" class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue">Solicitar Firma Digital</button>
            </div>
          </section>
        </aside>
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

  void (async () => {
    const res = await fetchActaDetalleMockById(actaId, signal);
    if (!res.ok && res.aborted) return;

    if (!res.ok && res.status === 404) {
      page.innerHTML = `
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p class="font-semibold">Acta no encontrada</p>
          <p class="mt-1">${escapeHtml(res.message)}</p>
          <a href="#/actas" class="mt-3 inline-flex items-center gap-1.5 font-semibold text-leoni-blue hover:underline">Volver al listado</a>
        </div>`;
      return;
    }

    if (!res.ok) {
      page.innerHTML = `
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p class="font-semibold">No se pudo cargar el detalle del acta.</p>
          <p class="mt-1">${escapeHtml(res.message)}</p>
          <button type="button" data-rh-acta-retry class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 transition hover:bg-red-100">Reintentar</button>
        </div>`;
      return;
    }

    page.innerHTML = renderDetalleHtml(res.data);
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
      const retryBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rh-acta-retry]");
      if (!retryBtn) return;
      retryBtn.disabled = true;
      window.location.hash = `#/actas/${actaId}`;
    },
    { signal },
  );
}
