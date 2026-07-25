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
import { mountDashboardTalento, ordenarFilas, renderDetallePanel } from "./dashboardTalento.ts";

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

/**
 * `getDesempeno` y `getCapacitacion` traen datos poblados (org + área "Arneses
 * A", la misma que reporta polivalencia) para que el test de degradación
 * pueda distinguir "bloque exitoso con datos reales" de "bloque caído en
 * n/d": si todos los bloques devolvieran `org: null, areas: []` como antes,
 * un bloque caído sería indistinguible en el render de uno exitoso-pero-vacío.
 */
function stubOk() {
  vi.mocked(api.getPolivalencia).mockResolvedValue({
    disponible: true, motivo: null,
    org: { pol_pct: 70, resiliencia_pct: 60, n_criticas: 2, n_empleados: 40, semaforo: "ambar" },
    areas: [areaPol],
  });
  vi.mocked(api.getDesempeno).mockResolvedValue({
    disponible: true, motivo: null, ciclo: { id: 1, nombre: "2026", estado: "activo" },
    org: {
      calificacion_promedio: 78.2, cumplimiento_metas_pct: 80.0, con_resultado_pct: 95.0,
      distribucion: {}, nine_box: {}, semaforo: "verde", n_empleados: 40,
    },
    areas: [
      {
        area_id: 1, area_nombre: "Arneses A", n_empleados: 40,
        calificacion_promedio: 85.5, cumplimiento_metas_pct: 88.0, con_resultado_pct: 97.0,
        distribucion: {}, semaforo: "verde",
      },
    ],
  });
  vi.mocked(api.getCapacitacion).mockResolvedValue({
    disponible: true, motivo: null,
    org: { total_pares: 100, completados: 91, cumplimiento_pct: 91.0, n_obligatorio_pendiente: 3, semaforo: "verde" },
    areas: [
      {
        area_id: 1, area_nombre: "Arneses A", total_pares: 40, completados: 37,
        cumplimiento_pct: 92.3, n_obligatorio_pendiente: 1, semaforo: "verde",
      },
    ],
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
    // Desempeño y capacitación respondieron: sus datos reales (área "Arneses
    // A") siguen presentes, no se degradan por el fallo de otro bloque.
    expect(container.textContent).toContain("85.5%");
    expect(container.textContent).toContain("92.3%");
    // El índice objetivo sí falló: su tile queda en n/d, anclado al mensaje
    // de error que `tileHtml` vuelca como `title` solo en el estado "error"
    // (ver dashboardTalento.ts). Un `toContain("n/d")` a secas no sirve de
    // guardián: cualquier celda vacía produce el mismo texto.
    expect(container.innerHTML).toContain('title="DATOS_ANALISIS no responde">n/d<');
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

/**
 * El panel de detalle debe pintar los 4 agregados del área (desempeño,
 * polivalencia, capacitación, PDI) además de la tabla de empleados en foco:
 * antes se calculaban, se serializaban y nadie los leía en el frontend.
 */
describe("renderDetallePanel", () => {
  const detalle = {
    estado: "ok" as const,
    datos: {
      area_id: 1,
      area_nombre: "Arneses A",
      desempeno: {
        area_id: 1, area_nombre: "Arneses A", n_empleados: 10,
        calificacion_promedio: 82.3, cumplimiento_metas_pct: 75.0,
        con_resultado_pct: 90.0, distribucion: {}, semaforo: "verde",
      },
      polivalencia: {
        area_id: 1, area_nombre: "Arneses A", n_empleados: 10,
        pol_pct: 66.5, resiliencia_pct: 55.0, n_criticas: 1, semaforo: "ambar",
      },
      capacitacion: {
        area_id: 1, area_nombre: "Arneses A", total_pares: 20, completados: 15,
        cumplimiento_pct: 75.0, n_obligatorio_pendiente: 2, semaforo: "ambar",
      },
      pdi: {
        area_id: 1, area_nombre: "Arneses A", total: 5, completados: 3,
        cancelados: 0, cumplimiento_pct: 60.0, n_vencidos: 1, n_activos: 2,
        semaforo: "rojo",
      },
      empleados_foco: [],
    },
  };

  it("pinta los 4 agregados del área con sus valores reales", () => {
    const html = renderDetallePanel(detalle);
    expect(html).toContain("82.3%"); // desempeño
    expect(html).toContain("66.5%"); // polivalencia
    expect(html).toContain("75.0%"); // capacitación
    expect(html).toContain("60.0%"); // pdi
  });

  it("un agregado en null se pinta n/d, nunca 0 %", () => {
    const sinDesempeno = { ...detalle, datos: { ...detalle.datos, desempeno: null } };
    const html = renderDetallePanel(sinDesempeno);
    // El tile de Desempeño debe quedar en "n/d" -- no en "0.0%" (que además
    // significaría algo muy distinto: "el ciclo calificó a todos con 0").
    expect(html).toContain(
      '>Desempeño</p><p class="mt-1 text-xl font-semibold text-text-primary">n/d</p>',
    );
  });
});

/**
 * `ordenarFilas` probada directamente como función pura: es la forma más
 * honesta de cubrir esta lógica. Probarla vía render exigiría construir los
 * cinco bloques (polivalencia/desempeño/capacitación/pdi/objetivo) con
 * area_id cruzados solo para inferir el orden de filas del HTML resultante
 * -- mucho más indirecto que llamar la función exportada con datos mínimos.
 *
 * `FilaArea`/`EstadoPagina` no se exportan desde dashboardTalento.ts, así que
 * los tipos de los fixtures se derivan de la firma de `ordenarFilas` (sin
 * duplicar ni exportar tipos solo para el test).
 */
describe("ordenarFilas", () => {
  type Fila = Parameters<typeof ordenarFilas>[0][number];
  type Estado = Parameters<typeof ordenarFilas>[1];

  function makeEstado(ordenPor: Estado["ordenPor"], ordenDesc: boolean): Estado {
    return {
      polivalencia: { estado: "cargando" },
      desempeno: { estado: "cargando" },
      capacitacion: { estado: "cargando" },
      pdi: { estado: "cargando" },
      objetivo: { estado: "cargando" },
      areaAbierta: null,
      detalle: null,
      ordenPor,
      ordenDesc,
      exporting: false,
      exportError: null,
    };
  }

  function makeFila(overrides: Partial<Fila> & Pick<Fila, "area_id" | "area_nombre">): Fila {
    return {
      n_empleados: 1,
      desempeno: null,
      desempenoSemaforo: null,
      polivalencia: null,
      polivalenciaSemaforo: null,
      objetivo: null,
      capacitacion: null,
      capacitacionSemaforo: null,
      pdi: null,
      pdiSemaforo: null,
      n_criticas: 0,
      ...overrides,
    };
  }

  const filas: Fila[] = [
    makeFila({ area_id: 1, area_nombre: "Media", desempeno: 50 }),
    makeFila({ area_id: 2, area_nombre: "SinDato", desempeno: null }),
    makeFila({ area_id: 3, area_nombre: "Alta", desempeno: 80 }),
  ];

  it("la fila sin dato queda al final en orden descendente", () => {
    const resultado = ordenarFilas(filas, makeEstado("desempeno", true));
    expect(resultado.map((f) => f.area_nombre)).toEqual(["Alta", "Media", "SinDato"]);
  });

  it("la fila sin dato queda al final también en orden ascendente", () => {
    const resultado = ordenarFilas(filas, makeEstado("desempeno", false));
    expect(resultado.map((f) => f.area_nombre)).toEqual(["Media", "Alta", "SinDato"]);
  });
});
