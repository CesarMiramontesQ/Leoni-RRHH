import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  postIncidenciaAgentChat,
  rhFiltersToAgentContext,
  type AgentChatMessage,
} from "../../api/incidenciasAgent.ts";
import type { IncidenciasFetchError } from "../../api/incidencias.ts";
import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciaListFilters } from "../../incidencias/rh/types.ts";
import { RH_LISTADO_BTN_SECONDARY } from "../../ui/uiTokens.ts";

export interface IncidenciasAgentPanelOpts {
  signal: AbortSignal;
  getAppliedFilters: () => RhIncidenciaListFilters;
}

export interface IncidenciasAgentPanelHandle {
  destroy: () => void;
}

function renderMessages(messages: AgentChatMessage[], loading: boolean, error: string | null): string {
  const items =
    messages.length === 0 ?
      `<p class="rh-inc-agent-empty">${escapeHtml(INC_COPY.agenteVacio)}</p>`
    : messages
        .map(
          (m) => `
        <div class="rh-inc-agent-msg rh-inc-agent-msg--${m.role === "user" ? "user" : "assistant"}" role="listitem">
          <p class="rh-inc-agent-msg__label">${m.role === "user" ? escapeHtml(INC_COPY.agenteTu) : escapeHtml(INC_COPY.agenteAsistente)}</p>
          <div class="rh-inc-agent-msg__body">${escapeHtml(m.content).replace(/\n/g, "<br />")}</div>
        </div>`,
        )
        .join("");

  const loadingHtml =
    loading ?
      `<div class="rh-inc-agent-msg rh-inc-agent-msg--assistant" aria-live="polite">
        <p class="rh-inc-agent-msg__label">${escapeHtml(INC_COPY.agenteAsistente)}</p>
        <div class="rh-inc-agent-msg__body rh-inc-agent-msg__body--loading">${escapeHtml(INC_COPY.agentePensando)}</div>
      </div>`
    : "";

  const errorHtml =
    error ?
      `<p class="rh-inc-agent-error" role="alert">${escapeHtml(error)}</p>`
    : "";

  return `<div class="rh-inc-agent-messages" role="list">${items}${loadingHtml}${errorHtml}</div>`;
}

function renderPanel(open: boolean, messages: AgentChatMessage[], loading: boolean, error: string | null): string {
  return `
    <button
      type="button"
      id="rh-inc-agent-fab"
      class="${RH_LISTADO_BTN_SECONDARY} rh-inc-agent-fab"
      aria-expanded="${open}"
      aria-controls="rh-inc-agent-drawer"
    >
      ${escapeHtml(INC_COPY.agenteAbrir)}
    </button>
    <div
      id="rh-inc-agent-backdrop"
      class="rh-inc-agent-backdrop${open ? " rh-inc-agent-backdrop--open" : ""}"
      aria-hidden="${open ? "false" : "true"}"
    ></div>
    <aside
      id="rh-inc-agent-drawer"
      class="rh-inc-agent-drawer${open ? " rh-inc-agent-drawer--open" : ""}"
      aria-label="${escapeHtml(INC_COPY.agenteTitulo)}"
      aria-hidden="${open ? "false" : "true"}"
    >
      <header class="rh-inc-agent-drawer__head">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">${escapeHtml(INC_COPY.agenteTitulo)}</h2>
          <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(INC_COPY.agenteSubtitulo)}</p>
        </div>
        <button type="button" id="rh-inc-agent-close" class="rh-inc-agent-close" aria-label="${escapeHtml(INC_COPY.agenteCerrar)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      ${renderMessages(messages, loading, error)}
      <footer class="rh-inc-agent-drawer__foot">
        <label class="sr-only" for="rh-inc-agent-input">${escapeHtml(INC_COPY.agentePlaceholder)}</label>
        <textarea
          id="rh-inc-agent-input"
          class="rh-inc-agent-input"
          rows="3"
          placeholder="${escapeHtml(INC_COPY.agentePlaceholder)}"
          ${loading ? "disabled" : ""}
        ></textarea>
        <button type="button" id="rh-inc-agent-send" class="${RH_LISTADO_BTN_SECONDARY} w-full justify-center" ${loading ? "disabled" : ""}>
          ${escapeHtml(INC_COPY.agenteEnviar)}
        </button>
      </footer>
    </aside>`;
}

export function mountIncidenciasAgentPanel(
  host: HTMLElement,
  opts: IncidenciasAgentPanelOpts,
): IncidenciasAgentPanelHandle {
  let open = false;
  let loading = false;
  let error: string | null = null;
  const messages: AgentChatMessage[] = [];

  function paint(): void {
    host.innerHTML = renderPanel(open, messages, loading, error);
    const list = host.querySelector(".rh-inc-agent-messages");
    if (list) list.scrollTop = list.scrollHeight;
  }

  async function sendMessage(): Promise<void> {
    const input = host.querySelector<HTMLTextAreaElement>("#rh-inc-agent-input");
    const text = input?.value.trim() ?? "";
    if (!text || loading) return;

    messages.push({ role: "user", content: text });
    if (input) input.value = "";
    loading = true;
    error = null;
    paint();

    try {
      const response = await postIncidenciaAgentChat(
        messages,
        rhFiltersToAgentContext(opts.getAppliedFilters()),
        opts.signal,
      );
      messages.push(response.message);
    } catch (err) {
      const fetchErr = err as IncidenciasFetchError;
      if (fetchErr?.status === 503) {
        error = fetchErr?.detail || INC_COPY.agenteOllamaNoDisponible;
      } else {
        error = fetchErr?.detail || INC_COPY.agenteErrorGenerico;
      }
    } finally {
      loading = false;
      paint();
    }
  }

  function setOpen(next: boolean): void {
    open = next;
    if (!open) error = null;
    paint();
  }

  host.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#rh-inc-agent-fab")) {
        setOpen(!open);
        return;
      }
      if (t.closest("#rh-inc-agent-close") || t.closest("#rh-inc-agent-backdrop")) {
        setOpen(false);
        return;
      }
      if (t.closest("#rh-inc-agent-send")) {
        void sendMessage();
      }
    },
    { signal: opts.signal },
  );

  host.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      const ta = (e.target as HTMLElement).closest<HTMLTextAreaElement>("#rh-inc-agent-input");
      if (ta && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    { signal: opts.signal },
  );

  paint();

  return {
    destroy: () => {
      host.innerHTML = "";
    },
  };
}
