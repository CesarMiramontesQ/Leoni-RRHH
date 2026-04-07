import { buildRhIncidenciaFilterOptions } from "../../incidencias/rh/buildRhIncidenciaFilterOptions.ts";
import { SNI_COPY } from "../../solicitudes/solicitudesNuevaIncidenciaCopy.ts";

export function escapeNiHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const LBL = "mb-1.5 block text-xs font-semibold text-slate-700";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";
const SELECT = `${INPUT} appearance-none pr-9`;
const SELECT_WRAP = "relative grid grid-cols-1";
const CHEV = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-4 self-center justify-self-end text-slate-400">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

const SEC_HEAD =
  "mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-800";
const ICON_BOX = "flex size-8 shrink-0 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue";

function iconIdCard(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25h3.75M9 12h3.75M9 15.75h3.75M9 5.25h.008v.008H9V5.25Z" /></svg>`;
}

function iconCal(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
}

function iconClip(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m6.364-6.364 1.318-1.318" /></svg>`;
}

function iconSave(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25l-7.5 3.75V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>`;
}

function tipoOptionsHtml(): string {
  const tipos = buildRhIncidenciaFilterOptions([]).tipos;
  const head = `<option value="">${escapeNiHtml(SNI_COPY.phTipo)}</option>`;
  return (
    head +
    tipos.map((t) => `<option value="${escapeNiHtml(t.id)}">${escapeNiHtml(t.label)}</option>`).join("")
  );
}

export function solicitudesNuevaIncidenciaModalShellHtml(): string {
  const tipoOpts = tipoOptionsHtml();
  return `
    <div
      id="rh-ni-overlay"
      class="fixed inset-0 z-[62] hidden items-center justify-center bg-slate-900/45 p-3 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(94vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.25)] [color-scheme:light]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-ni-title"
      >
        <header class="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="rh-ni-title" class="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">${escapeNiHtml(SNI_COPY.titulo)}</h2>
              <p class="mt-1.5 text-sm leading-relaxed text-slate-500">${escapeNiHtml(SNI_COPY.subtitulo)}</p>
            </div>
            <button
              type="button"
              data-rh-ni-close
              class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              aria-label="${escapeNiHtml(SNI_COPY.cerrar)}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        <form id="rh-ni-form" class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <section class="mb-8" aria-labelledby="rh-ni-sec-emp">
              <h3 id="rh-ni-sec-emp" class="${SEC_HEAD}">
                <span class="${ICON_BOX}" aria-hidden="true">${iconIdCard()}</span>
                ${escapeNiHtml(SNI_COPY.secEmpleado)}
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="rh-ni-empleado" class="${LBL}">${escapeNiHtml(SNI_COPY.lblEmpleado)}</label>
                  <input id="rh-ni-empleado" name="empleado" type="text" autocomplete="name" placeholder="${escapeNiHtml(SNI_COPY.phEmpleado)}" class="${INPUT}" />
                </div>
                <div>
                  <label for="rh-ni-nomina" class="${LBL}">${escapeNiHtml(SNI_COPY.lblNomina)}</label>
                  <input id="rh-ni-nomina" name="numero_nomina" type="text" inputmode="text" placeholder="${escapeNiHtml(SNI_COPY.phNomina)}" class="${INPUT}" />
                </div>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <label for="rh-ni-area" class="${LBL}">${escapeNiHtml(SNI_COPY.lblArea)}</label>
                  <input id="rh-ni-area" name="area" type="text" placeholder="${escapeNiHtml(SNI_COPY.phArea)}" class="${INPUT}" />
                </div>
                <div>
                  <label for="rh-ni-supervisor" class="${LBL}">${escapeNiHtml(SNI_COPY.lblSupervisor)}</label>
                  <input id="rh-ni-supervisor" name="supervisor" type="text" placeholder="${escapeNiHtml(SNI_COPY.phSupervisor)}" class="${INPUT}" />
                </div>
                <div>
                  <label for="rh-ni-rh" class="${LBL}">${escapeNiHtml(SNI_COPY.lblRh)}</label>
                  <input id="rh-ni-rh" name="responsable_rh" type="text" placeholder="${escapeNiHtml(SNI_COPY.phRh)}" class="${INPUT}" />
                </div>
              </div>
            </section>

            <section class="mb-8 border-t border-slate-100 pt-8" aria-labelledby="rh-ni-sec-det">
              <h3 id="rh-ni-sec-det" class="${SEC_HEAD}">
                <span class="${ICON_BOX}" aria-hidden="true">${iconCal()}</span>
                ${escapeNiHtml(SNI_COPY.secDetalle)}
              </h3>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label for="rh-ni-tipo" class="${LBL}">${escapeNiHtml(SNI_COPY.lblTipo)}</label>
                  <div class="${SELECT_WRAP}">
                    <select id="rh-ni-tipo" name="tipo_incidencia" class="col-start-1 row-start-1 ${SELECT}">${tipoOpts}</select>
                    ${CHEV}
                  </div>
                </div>
                <div>
                  <label for="rh-ni-fecha" class="${LBL}">${escapeNiHtml(SNI_COPY.lblFechaHora)}</label>
                  <input id="rh-ni-fecha" name="fecha_hora" type="datetime-local" class="${INPUT}" />
                </div>
                <div>
                  <label for="rh-ni-prioridad" class="${LBL}">${escapeNiHtml(SNI_COPY.lblPrioridad)}</label>
                  <div class="${SELECT_WRAP}">
                    <select id="rh-ni-prioridad" name="prioridad" class="col-start-1 row-start-1 ${SELECT}">
                      <option value="baja">Baja</option>
                      <option value="media" selected>Media</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                    ${CHEV}
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <label for="rh-ni-lugar" class="${LBL}">${escapeNiHtml(SNI_COPY.lblLugar)}</label>
                <input id="rh-ni-lugar" name="lugar" type="text" placeholder="${escapeNiHtml(SNI_COPY.phLugar)}" class="${INPUT}" />
              </div>
              <div class="mt-4">
                <label for="rh-ni-desc" class="${LBL}">${escapeNiHtml(SNI_COPY.lblDescripcion)}</label>
                <textarea id="rh-ni-desc" name="descripcion" rows="4" placeholder="${escapeNiHtml(SNI_COPY.phDescripcion)}" class="${INPUT} min-h-[7.5rem] resize-y"></textarea>
              </div>
            </section>

            <section class="border-t border-slate-100 pt-8" aria-labelledby="rh-ni-sec-ev">
              <h3 id="rh-ni-sec-ev" class="${SEC_HEAD}">
                <span class="${ICON_BOX}" aria-hidden="true">${iconClip()}</span>
                ${escapeNiHtml(SNI_COPY.secEvidencia)}
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="rh-ni-personas" class="${LBL}">${escapeNiHtml(SNI_COPY.lblPersonas)}</label>
                  <input id="rh-ni-personas" name="personas_involucradas" type="text" placeholder="${escapeNiHtml(SNI_COPY.phPersonas)}" class="${INPUT}" />
                </div>
                <div>
                  <label for="rh-ni-testigos" class="${LBL}">${escapeNiHtml(SNI_COPY.lblTestigos)}</label>
                  <input id="rh-ni-testigos" name="testigos" type="text" placeholder="${escapeNiHtml(SNI_COPY.phTestigos)}" class="${INPUT}" />
                </div>
              </div>
              <div class="mt-4">
                <span class="${LBL}">${escapeNiHtml(SNI_COPY.lblEvidencia)}</span>
                <label class="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center transition hover:border-leoni-blue/35 hover:bg-slate-50 sm:py-10">
                  <input id="rh-ni-evidencia" name="evidencia" type="file" accept="image/png,image/jpeg,image/jpg,application/pdf,video/*" multiple class="sr-only" />
                  <span class="rounded-lg bg-white p-2 text-slate-400 shadow-sm" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008H12V8.25Z" /></svg>
                  </span>
                  <span class="mt-3 text-sm font-semibold text-leoni-blue">${escapeNiHtml(SNI_COPY.evidenciaSubir)}</span>
                  <span class="mt-0.5 text-xs text-slate-500">${escapeNiHtml(SNI_COPY.evidenciaDrag)}</span>
                  <span class="mt-3 text-[11px] text-slate-400">${escapeNiHtml(SNI_COPY.evidenciaNota)}</span>
                </label>
              </div>
            </section>
          </div>

          <footer class="shrink-0 border-t border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-6">
            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                data-rh-ni-cancel
                class="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
              >
                ${escapeNiHtml(SNI_COPY.cancelar)}
              </button>
              <button
                type="submit"
                class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-leoni-blue px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
              >
                ${iconSave()}
                ${escapeNiHtml(SNI_COPY.guardar)}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>`;
}
