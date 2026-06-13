import { RH_LISTADO_BTN_GHOST, RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export const HE_TABLE_SECTION = `rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden`;

export const HE_TABLE_EL = "min-w-full border-collapse text-left";

export const HE_TABLE_HEAD_ROW = "border-b border-slate-100 bg-[var(--color-grid-header-bg)]";

export const HE_TABLE_TH =
  "px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap";

export const HE_TABLE_ROW = "border-b border-slate-100 transition hover:bg-slate-50/70";

export const HE_TABLE_TD = "px-3 py-3";

export type HorasExtraTableColumn = {
  label: string;
  align?: "left" | "right";
};

export function renderHorasExtraTableTh(column: HorasExtraTableColumn): string {
  const align = column.align === "right" ? " text-right" : "";
  return `<th scope="col" class="${HE_TABLE_TH}${align}">${escapeHtml(column.label)}</th>`;
}

export function renderHorasExtraTableThead(columns: readonly HorasExtraTableColumn[]): string {
  return `
    <thead>
      <tr class="${HE_TABLE_HEAD_ROW}">
        ${columns.map(renderHorasExtraTableTh).join("")}
      </tr>
    </thead>`;
}

export function renderHorasExtraVerButton(opts: {
  dataAttr: string;
  solicitudId: number;
  label?: string;
}): string {
  const label = opts.label ?? "Ver";
  return `
    <button
      type="button"
      class="${RH_LISTADO_BTN_GHOST} min-h-9 px-3 py-1.5 text-xs font-semibold"
      data-${opts.dataAttr}="${opts.solicitudId}"
      aria-label="Ver detalle de la solicitud ${opts.solicitudId}"
    >${escapeHtml(label)}</button>`;
}

export function renderHorasExtraTableStatusRow(colspan: number, innerHtml: string): string {
  return `
    <tr>
      <td colspan="${colspan}" class="px-4 py-16 text-center sm:px-5">
        ${innerHtml}
      </td>
    </tr>`;
}

export function renderHorasExtraTableScroll(columns: readonly HorasExtraTableColumn[], bodyRows: string): string {
  return `
    <div class="overflow-x-auto">
      <table class="${HE_TABLE_EL}">
        ${renderHorasExtraTableThead(columns)}
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

export function renderHorasExtraTableSection(opts: {
  ariaLabel: string;
  columns: readonly HorasExtraTableColumn[];
  bodyRows: string;
  footer?: string;
}): string {
  return `
    <section class="${HE_TABLE_SECTION}" aria-label="${escapeHtml(opts.ariaLabel)}">
      ${renderHorasExtraTableScroll(opts.columns, opts.bodyRows)}
      ${opts.footer ?? ""}
    </section>`;
}
