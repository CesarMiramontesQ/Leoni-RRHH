export function escapeIncHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const INC_FIELD_FOCUS =
  "outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2";

export const INC_FILTERS_FIELD_WRAP =
  "min-w-0 w-full flex-1 basis-full sm:basis-[calc(50%-0.5rem)] lg:min-w-[10rem] lg:basis-0";
