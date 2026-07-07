import { mountAppShell } from "../layouts/appShell.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

/** Pantalla de bienvenida en Modo RH cuando el usuario no tiene grant de dashboard. */
export function mountRhModoInicio(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Modo RH",
    mainHtml: htmlAccessDenied({
      title: "Modo RH",
      description: "Selecciona un módulo del menú lateral para comenzar.",
    }),
  });
}
