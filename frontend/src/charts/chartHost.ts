import type { ChartConfiguration } from "chart.js";
import { escapeHtml } from "../ui/uiUtils.ts";
import { Chart } from "./chartSetup.ts";
import { chartPalette, chartSemanticColors, type ChartSemanticColors } from "./chartTokens.ts";

export type ChartHostContext = {
  colors: ChartSemanticColors;
  palette: readonly string[];
};

export type ChartConfigFactory = (ctx: ChartHostContext) => ChartConfiguration;

export type MountChartOptions = {
  /** Si retorna true, cancela montajes diferidos (p. ej. respuesta async obsoleta). */
  isStale?: () => boolean;
};

const registry = new Map<string, Chart>();
type PendingChartMount = {
  cancel: () => void;
  retry: () => void;
};
const pendingMounts = new Map<string, PendingChartMount>();

/** Opciones de montaje activas (p. ej. `isStale` desde `runChartsAfterLayout`). */
let activeMountOptions: MountChartOptions | undefined;

const MAX_LAYOUT_FRAMES = 60;
const FORCE_MOUNT_MS = 2_500;
let globalLayoutRetryBound = false;

function defaultPluginOptions(colors: ChartSemanticColors): NonNullable<ChartConfiguration["options"]>["plugins"] {
  return {
    legend: {
      labels: {
        color: colors.textSecondary,
        font: { size: 11, weight: 500 },
        boxWidth: 10,
        boxHeight: 10,
        useBorderRadius: true,
        borderRadius: 2,
      },
    },
    tooltip: {
      titleColor: colors.textPrimary,
      bodyColor: colors.textSecondary,
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: colors.border,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 4,
    },
  };
}

/** Ejes cartesianos (bar, line, scatter) con tokens del design system. */
export function chartCartesianScales(colors: ChartSemanticColors): ChartConfiguration["options"] {
  return {
    scales: {
      x: {
        ticks: { color: colors.textMuted, font: { size: 10 } },
        grid: { color: colors.border, drawTicks: false },
        border: { color: colors.border },
      },
      y: {
        ticks: { color: colors.textMuted, font: { size: 10 } },
        grid: { color: colors.border, drawTicks: false },
        border: { color: colors.border },
      },
    },
  };
}

/** Skeleton mientras llegan datos o el layout del contenedor. */
export function renderChartLoadingSkeleton(opts?: {
  heightClass?: string;
  message?: string;
  className?: string;
}): string {
  const height = opts?.heightClass ?? "h-[220px]";
  const message = opts?.message ?? "Cargando gráfica…";
  const wrapCls = opts?.className ?? "relative w-full min-w-0";
  return `
    <div class="${wrapCls} ${height} flex items-center justify-center rounded-lg border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-container-low)]" data-chart-loading aria-busy="true">
      <p class="animate-pulse text-sm text-[color:var(--color-text-muted)]">${escapeHtml(message)}</p>
    </div>`;
}

/** Markup de contenedor + canvas para insertar en plantillas HTML. */
export function renderChartCanvas(opts: {
  chartId: string;
  ariaLabel: string;
  /** Clases Tailwind de altura del contenedor (por defecto h-[220px]). */
  heightClass?: string;
  className?: string;
}): string {
  const height = opts.heightClass ?? "h-[220px]";
  const wrapCls = opts.className ?? "relative w-full min-w-0";
  return `
    <div class="${wrapCls} ${height}" data-chart-host>
      <canvas
        data-chart-canvas
        data-chart-id="${escapeHtml(opts.chartId)}"
        role="img"
        aria-label="${escapeHtml(opts.ariaLabel)}"
      ></canvas>
    </div>`;
}

function chartHostElement(canvas: HTMLCanvasElement): Element | null {
  return canvas.closest("[data-chart-host]") ?? canvas.parentElement;
}

/** El contenedor del canvas tiene dimensiones visibles (> 0). */
export function chartCanvasHostHasDimensions(canvas: HTMLCanvasElement): boolean {
  if (!canvas.isConnected) return false;
  const host = chartHostElement(canvas);
  if (!host) return false;
  const rect = host.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function cancelPendingChartMount(chartId: string): void {
  pendingMounts.get(chartId)?.cancel();
  pendingMounts.delete(chartId);
}

function bindGlobalChartLayoutRetry(): void {
  if (globalLayoutRetryBound || typeof window === "undefined") return;
  globalLayoutRetryBound = true;
  const retry = (): void => {
    retryPendingChartMounts();
  };
  window.addEventListener("resize", retry);
  window.addEventListener("load", retry);
  if (document.fonts?.ready) {
    void document.fonts.ready.then(retry);
  }
}

/** Reintenta montajes diferidos (p. ej. tras layout del app shell post-login). */
export function retryPendingChartMounts(root?: ParentNode): void {
  for (const pending of pendingMounts.values()) {
    pending.retry();
  }
  if (root) resizeChartsIn(root);
}

function resolveMountOptions(options?: MountChartOptions): MountChartOptions | undefined {
  return options ?? activeMountOptions;
}

function createChartInstance(
  canvas: HTMLCanvasElement,
  chartId: string,
  buildConfig: ChartConfigFactory,
): Chart {
  destroyChart(chartId);

  const existingOnCanvas = Chart.getChart(canvas);
  if (existingOnCanvas) existingOnCanvas.destroy();

  const ctx: ChartHostContext = {
    colors: chartSemanticColors(),
    palette: chartPalette(),
  };
  const built = buildConfig(ctx);
  const chart = new Chart(canvas, {
    type: built.type,
    data: built.data,
    options: {
      ...built.options,
      plugins: {
        ...defaultPluginOptions(ctx.colors),
        ...built.options?.plugins,
      },
    },
    plugins: built.plugins,
  });
  registry.set(chartId, chart);
  chart.resize();
  return chart;
}

function scheduleChartMount(
  root: ParentNode,
  chartId: string,
  buildConfig: ChartConfigFactory,
  options?: MountChartOptions,
): void {
  bindGlobalChartLayoutRetry();
  cancelPendingChartMount(chartId);

  let rafId = 0;
  let observer: ResizeObserver | null = null;
  let forceMountTimer: ReturnType<typeof setTimeout> | null = null;
  let frame = 0;
  let cancelled = false;

  const cleanup = (): void => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (forceMountTimer) clearTimeout(forceMountTimer);
    observer?.disconnect();
    observer = null;
    pendingMounts.delete(chartId);
  };

  const resolveCanvas = (): HTMLCanvasElement | null =>
    root.querySelector<HTMLCanvasElement>(
      `[data-chart-canvas][data-chart-id="${CSS.escape(chartId)}"]`,
    );

  const tryMount = (force = false): Chart | null => {
    if (cancelled || options?.isStale?.()) {
      cleanup();
      return null;
    }
    const canvas = resolveCanvas();
    if (!canvas) {
      cleanup();
      return null;
    }
    if (!force && !chartCanvasHostHasDimensions(canvas)) return null;
    cleanup();
    return createChartInstance(canvas, chartId, buildConfig);
  };

  const waitForLayout = (): void => {
    if (cancelled || options?.isStale?.()) {
      cleanup();
      return;
    }
    const chart = tryMount();
    if (chart) return;

    frame += 1;
    if (frame < MAX_LAYOUT_FRAMES) {
      rafId = requestAnimationFrame(waitForLayout);
      return;
    }

    const canvas = resolveCanvas();
    if (!canvas || !canvas.isConnected) {
      cleanup();
      return;
    }

    tryMount(true);
  };

  const canvas = resolveCanvas();
  const host = canvas ? chartHostElement(canvas) : null;
  if (host && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      tryMount();
    });
    observer.observe(host);
  }

  forceMountTimer = setTimeout(() => {
    if (cancelled || registry.has(chartId) || options?.isStale?.()) return;
    tryMount(true);
  }, FORCE_MOUNT_MS);

  pendingMounts.set(chartId, {
    cancel: cleanup,
    retry: () => {
      tryMount();
    },
  });
  rafId = requestAnimationFrame(waitForLayout);
}

/** Instancia activa por id (p. ej. para acciones como suavizar línea). */
export function getChart(chartId: string): Chart | undefined {
  return registry.get(chartId);
}

/** Actualiza datos/opciones de una gráfica existente sin recrearla. */
export function updateChart(chartId: string, buildConfig: ChartConfigFactory): boolean {
  const chart = registry.get(chartId);
  if (!chart) return false;
  const ctx: ChartHostContext = {
    colors: chartSemanticColors(),
    palette: chartPalette(),
  };
  const built = buildConfig(ctx);
  chart.data = built.data;
  if (built.options) {
    chart.options = {
      ...chart.options,
      ...built.options,
      plugins: {
        ...chart.options.plugins,
        ...built.options.plugins,
      },
    };
  }
  chart.update();
  chart.resize();
  return true;
}

/** Destruye una instancia registrada por id. */
export function destroyChart(chartId: string): void {
  cancelPendingChartMount(chartId);
  const existing = registry.get(chartId);
  if (!existing) return;
  existing.destroy();
  registry.delete(chartId);
}

/** Destruye todas las gráficas dentro de un nodo (p. ej. antes de `innerHTML`). */
export function destroyChartsIn(root: ParentNode): void {
  root.querySelectorAll<HTMLCanvasElement>("[data-chart-canvas]").forEach((canvas) => {
    const id = canvas.dataset.chartId;
    if (id) destroyChart(id);
  });
}

/** Reajusta todas las gráficas registradas dentro de un nodo. */
export function resizeChartsIn(root: ParentNode): void {
  root.querySelectorAll<HTMLCanvasElement>("[data-chart-canvas]").forEach((canvas) => {
    const id = canvas.dataset.chartId;
    if (!id) return;
    getChart(id)?.resize();
  });
}

/**
 * Ejecuta montaje de gráficas y reajusta tras el layout del navegador.
 * Usar justo después de asignar `innerHTML` al contenedor padre.
 */
export function runChartsAfterLayout(
  root: ParentNode,
  mount: () => void,
  options?: MountChartOptions,
): void {
  bindGlobalChartLayoutRetry();
  activeMountOptions = options;
  try {
    mount();
    const settle = (): void => {
      if (options?.isStale?.()) return;
      retryPendingChartMounts(root);
      resizeChartsIn(root);
    };
    requestAnimationFrame(() => {
      settle();
      requestAnimationFrame(() => {
        settle();
        requestAnimationFrame(settle);
      });
    });
  } finally {
    activeMountOptions = undefined;
  }
}

/**
 * Monta (o remonta) una gráfica Chart.js en un canvas con `data-chart-id`.
 * Espera a que el canvas exista y su contenedor tenga dimensiones válidas.
 */
export function mountChart(
  root: ParentNode,
  chartId: string,
  buildConfig: ChartConfigFactory,
  options?: MountChartOptions,
): Chart | null {
  const resolved = resolveMountOptions(options);
  const canvas = root.querySelector<HTMLCanvasElement>(
    `[data-chart-canvas][data-chart-id="${CSS.escape(chartId)}"]`,
  );
  if (!canvas) return null;

  if (resolved?.isStale?.()) return null;

  if (chartCanvasHostHasDimensions(canvas)) {
    return createChartInstance(canvas, chartId, buildConfig);
  }

  scheduleChartMount(root, chartId, buildConfig, resolved);
  return registry.get(chartId) ?? null;
}

/** Destruye todas las gráficas del registro global (p. ej. al cambiar de ruta SPA). */
export function destroyAllCharts(): void {
  for (const id of [...registry.keys()]) destroyChart(id);
}
