let modalHost: HTMLElement | null = null;
let modalAbort: AbortController | null = null;
let modalOwner: string | null = null;

function ensureModalHost(): HTMLElement {
  if (!modalHost) {
    modalHost = document.createElement("div");
    modalHost.id = "ajustes-modal-root";
    document.body.appendChild(modalHost);
  }
  return modalHost;
}

type AjustesModalHandlers = {
  onInteract: (ev: Event) => void;
  onEscape?: () => void;
};

function bindModalHandlers(host: HTMLElement, handlers: AjustesModalHandlers): void {
  modalAbort?.abort();
  modalAbort = new AbortController();
  const { signal } = modalAbort;
  host.addEventListener("click", handlers.onInteract, { signal });
  host.addEventListener("submit", handlers.onInteract, { signal });
  if (handlers.onEscape) {
    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          handlers.onEscape!();
        }
      },
      { signal },
    );
  }
}

function mountModalHtml(ownerId: string, html: string, handlers: AjustesModalHandlers): void {
  if (modalOwner !== ownerId) return;
  const host = ensureModalHost();
  host.innerHTML = html;
  document.body.style.overflow = "hidden";
  bindModalHandlers(host, handlers);
}

/** Monta el HTML del modal en `document.body` (evita recortes por contenedores anidados). */
export function syncAjustesModal(
  ownerId: string,
  open: boolean,
  html: string,
  handlers: AjustesModalHandlers,
): void {
  if (!open) {
    if (modalOwner === ownerId) clearAjustesModal();
    return;
  }

  const host = ensureModalHost();
  const alreadyOpen = modalOwner === ownerId && host.innerHTML.length > 0;
  modalOwner = ownerId;

  if (alreadyOpen) {
    mountModalHtml(ownerId, html, handlers);
    return;
  }

  // Evita que el mismo clic que abre el modal lo cierre al propagarse al overlay.
  requestAnimationFrame(() => mountModalHtml(ownerId, html, handlers));
}

export function clearAjustesModal(): void {
  modalAbort?.abort();
  modalAbort = null;
  modalOwner = null;
  if (modalHost) modalHost.innerHTML = "";
  document.body.style.overflow = "";
}

export function bindAjustesModalCleanup(ownerId: string, signal: AbortSignal): void {
  signal.addEventListener("abort", () => {
    if (modalOwner === ownerId) clearAjustesModal();
  });
}
