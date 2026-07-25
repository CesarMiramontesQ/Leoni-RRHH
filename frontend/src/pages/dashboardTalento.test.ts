/**
 * El requisito central del dashboard es la degradación por bloque: si el índice
 * objetivo se cae (DATOS_ANALISIS), la página debe seguir mostrando las otras
 * cuatro columnas. Ese es el test que no puede faltar.
 *
 * Nota de entorno: este proyecto corre vitest con `environment: "node"` (sin
 * jsdom/happy-dom instalado, ver frontend/vitest.config.ts) y no hay forma de
 * instalar dependencias nuevas en este sandbox (el registro npm privado del
 * lockfile no es alcanzable). `mountDashboardTalento` recibe un `HTMLElement`
 * real en producción, pero para poder probarlo aquí se usa un doble mínimo
 * que solo implementa lo que la página consume del contenedor
 * (`innerHTML`/`textContent`/`addEventListener`); `mountAppShell` se mockea
 * para volcar `mainHtml` en ese doble en vez de manipular el DOM real (que
 * además depende de `localStorage`/sesión, inexistentes en "node").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/talento.ts", () => ({
  getPolivalencia: vi.fn(),
  getDesempeno: vi.fn(),
  getCapacitacion: vi.fn(),
  getPdi: vi.fn(),
  getObjetivo: vi.fn(),
  getDetalleArea: vi.fn(),
  descargarDashboardExcel: vi.fn(),
  TalentoApiError: class extends Error {},
}));

vi.mock("../auth/jwt.ts", () => ({
  canAccessRhAssignedModule: vi.fn(() => true),
}));

vi.mock("../layouts/appShell.ts", () => ({
  mountAppShell: vi.fn((container: FakeElement, opts: { mainHtml: string }) => {
    container.innerHTML = opts.mainHtml;
  }),
}));

import * as api from "../api/talento.ts";
import { mountDashboardTalento } from "./dashboardTalento.ts";

/** Doble mínimo de `HTMLElement`: solo lo que `mountDashboardTalento` usa del contenedor. */
class FakeElement {
  private html = "";
  set innerHTML(value: string) {
    this.html = value;
  }
  get innerHTML(): string {
    return this.html;
  }
  get textContent(): string {
    return this.html.replace(/<[^>]*>/g, " ");
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

const areaPol = {
  area_id: 1, area_nombre: "Arneses A", n_empleados: 40,
  pol_pct: 70.0, resiliencia_pct: 60.0, n_criticas: 2, semaforo: "ambar" as const,
};

function stubOk() {
  vi.mocked(api.getPolivalencia).mockResolvedValue({
    disponible: true, motivo: null,
    org: { pol_pct: 70, resiliencia_pct: 60, n_criticas: 2, n_empleados: 40, semaforo: "ambar" },
    areas: [areaPol],
  });
  vi.mocked(api.getDesempeno).mockResolvedValue({
    disponible: true, motivo: null, ciclo: { id: 1, nombre: "2026", estado: "activo" },
    org: null, areas: [],
  });
  vi.mocked(api.getCapacitacion).mockResolvedValue({
    disponible: true, motivo: null, org: null, areas: [],
  });
  vi.mocked(api.getPdi).mockResolvedValue({
    disponible: true, motivo: null, org: null, areas: [],
  });
  vi.mocked(api.getObjetivo).mockResolvedValue({
    disponible: true, motivo: null, rango: null, org: null, areas: [],
  });
}

describe("dashboardTalento", () => {
  let container: FakeElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = new FakeElement();
  });

  it("pide los cinco bloques en paralelo", async () => {
    stubOk();
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(api.getPolivalencia).toHaveBeenCalled());
    expect(api.getDesempeno).toHaveBeenCalled();
    expect(api.getCapacitacion).toHaveBeenCalled();
    expect(api.getPdi).toHaveBeenCalled();
    expect(api.getObjetivo).toHaveBeenCalled();
  });

  it("lista las áreas de polivalencia en la tabla", async () => {
    stubOk();
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
  });

  it("un bloque caído no tumba la página", async () => {
    stubOk();
    vi.mocked(api.getObjetivo).mockRejectedValue(new Error("DATOS_ANALISIS no responde"));
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    expect(container.textContent).toContain("n/d");
  });

  it("muestra el motivo cuando no hay ciclo de desempeño", async () => {
    stubOk();
    vi.mocked(api.getDesempeno).mockResolvedValue({
      disponible: false, motivo: "sin_ciclo", ciclo: null, org: null, areas: [],
    });
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    expect(container.textContent?.toLowerCase()).toContain("ciclo");
  });
});
