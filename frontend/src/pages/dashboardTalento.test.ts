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
  getCiclos: vi.fn(),
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
  hasRhOperativeViewerContext: vi.fn(() => true),
}));

vi.mock("../layouts/appShell.ts", () => ({
  mountAppShell: vi.fn((container: FakeElement, opts: { mainHtml: string }) => {
    container.innerHTML = opts.mainHtml;
  }),
}));

import * as api from "../api/talento.ts";
import {
  distribucionBandasHtml,
  enlacesCruzadosHtml,
  mountDashboardTalento,
  ordenarFilas,
  renderDetallePanel,
} from "./dashboardTalento.ts";

/**
 * Doble mínimo de `HTMLElement`: solo lo que `mountDashboardTalento` usa del
 * contenedor. Guarda los listeners y expone `emit` para poder ejercitar la
 * delegación de eventos (ordenar, abrir área, cambiar ciclo, exportar) sin DOM.
 */
class FakeElement {
  private html = "";
  private listeners: Record<string, ((ev: unknown) => void)[]> = {};
  set innerHTML(value: string) {
    this.html = value;
  }
  get innerHTML(): string {
    return this.html;
  }
  get textContent(): string {
    return this.html.replace(/<[^>]*>/g, " ");
  }
  addEventListener(type: string, cb: (ev: unknown) => void): void {
    (this.listeners[type] ??= []).push(cb);
  }
  removeEventListener(): void {}
  emit(type: string, ev: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }
}

/**
 * Target falso para `emit`: implementa el único método que usa la delegación
 * (`closest`), devolviendo un nodo con `dataset`/`value` para el selector que
 * corresponda y `null` para el resto — igual que haría el DOM real.
 */
function fakeTarget(nodos: Record<string, { dataset?: Record<string, string>; value?: string }>) {
  const self = {
    closest(sel: string) {
      return nodos[sel] ?? null;
    },
  };
  return self;
}

const clickEnArea = (id: string) => ({ target: fakeTarget({ "[data-area-id]": { dataset: { areaId: id } } }) });
const clickEnExportar = () => ({ target: fakeTarget({ "[data-accion]": { dataset: { accion: "exportar" } } }) });
const cambioDeCiclo = (id: string) => ({ target: fakeTarget({ "[data-accion='ciclo']": { value: id } }) });

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
  vi.mocked(api.getCiclos).mockResolvedValue([]);
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

const detalleVacio = {
  area_id: 1, area_nombre: "Arneses A",
  desempeno: null, polivalencia: null, capacitacion: null, pdi: null, empleados_foco: [],
};

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

  it("ofrece el selector con el ciclo vigente marcado", async () => {
    stubOk();
    vi.mocked(api.getCiclos).mockResolvedValue([
      { id: 1, nombre: "2026", estado: "activo" },
      { id: 2, nombre: "2025", estado: "cerrado" },
    ]);
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.innerHTML).toContain('data-accion="ciclo"'));
    // El ciclo marcado es el que el backend eligió (`getDesempeno().ciclo.id`),
    // no el primero de la lista: la fuente de la verdad es la respuesta.
    expect(container.innerHTML).toContain('<option value="1" selected>2026 (Activo)</option>');
    expect(container.innerHTML).toContain('<option value="2">2025 (Cerrado)</option>');
  });

  it("si los ciclos no cargan, la página sigue en pie sin selector", async () => {
    stubOk();
    vi.mocked(api.getCiclos).mockRejectedValue(new Error("boom"));
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    expect(container.innerHTML).not.toContain('data-accion="ciclo"');
  });

  it("el detalle de área se pide con el ciclo vigente", async () => {
    stubOk();
    vi.mocked(api.getDetalleArea).mockResolvedValue(detalleVacio);
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    container.emit("click", clickEnArea("1"));
    await vi.waitFor(() => expect(api.getDetalleArea).toHaveBeenCalledWith(1, 1));
  });

  it("cambiar de ciclo repide el desempeño y recarga el detalle abierto", async () => {
    stubOk();
    vi.mocked(api.getCiclos).mockResolvedValue([
      { id: 1, nombre: "2026", estado: "activo" },
      { id: 2, nombre: "2025", estado: "cerrado" },
    ]);
    vi.mocked(api.getDetalleArea).mockResolvedValue(detalleVacio);
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    container.emit("click", clickEnArea("1"));
    await vi.waitFor(() => expect(api.getDetalleArea).toHaveBeenCalledWith(1, 1));

    container.emit("change", cambioDeCiclo("2"));
    await vi.waitFor(() => expect(api.getDesempeno).toHaveBeenCalledWith(2));
    // El detalle abierto es del ciclo anterior: hay que repedirlo, no dejarlo
    // mostrando señales de un ciclo que ya no es el seleccionado.
    await vi.waitFor(() => expect(api.getDetalleArea).toHaveBeenCalledWith(1, 2));
    // Los bloques que no dependen del ciclo no se vuelven a pedir.
    expect(api.getPolivalencia).toHaveBeenCalledTimes(1);
    expect(api.getCapacitacion).toHaveBeenCalledTimes(1);
  });

  it("exportar manda el ciclo seleccionado", async () => {
    stubOk();
    vi.mocked(api.getCiclos).mockResolvedValue([
      { id: 1, nombre: "2026", estado: "activo" },
      { id: 2, nombre: "2025", estado: "cerrado" },
    ]);
    vi.mocked(api.descargarDashboardExcel).mockResolvedValue(true);
    mountDashboardTalento(container as unknown as HTMLElement);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    container.emit("change", cambioDeCiclo("2"));
    await vi.waitFor(() => expect(api.getDesempeno).toHaveBeenCalledWith(2));
    container.emit("click", clickEnExportar());
    await vi.waitFor(() =>
      expect(api.descargarDashboardExcel).toHaveBeenCalledWith("dashboard_talento.xlsx", 2),
    );
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

  it("incluye los enlaces cruzados del área cuando hay acceso", () => {
    const html = renderDetallePanel(detalle, { operaciones: true, pdi: true, ciclo: true });
    expect(html).toContain('href="#/operaciones?area_id=1"');
    expect(html).toContain('href="#/pdi-gestion?area_id=1"');
    expect(html).toContain('href="#/talento/ciclo-desempeno?area_id=1"');
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

/**
 * Los enlaces cruzados solo apuntan a los módulos que saben filtrar por área
 * (Operaciones y PDI). El acceso lo decide quien monta la página, no este
 * helper: aquí solo se prueba que respeta lo que le dicen.
 */
describe("enlacesCruzadosHtml", () => {
  it("enlaza a Operaciones y PDI con el área en el deep-link", () => {
    const html = enlacesCruzadosHtml(7, { operaciones: true, pdi: true, ciclo: true });
    expect(html).toContain('href="#/operaciones?area_id=7"');
    expect(html).toContain('href="#/pdi-gestion?area_id=7"');
    expect(html).toContain('href="#/talento/ciclo-desempeno?area_id=7"');
  });

  it("omite el enlace del módulo sin acceso", () => {
    const html = enlacesCruzadosHtml(7, { operaciones: false, pdi: true, ciclo: false });
    expect(html).not.toContain("#/operaciones");
    expect(html).toContain('href="#/pdi-gestion?area_id=7"');
  });

  it("sin ningún acceso no pinta nada", () => {
    expect(enlacesCruzadosHtml(7, { operaciones: false, pdi: false, ciclo: false })).toBe("");
  });
});

/**
 * La distribución de bandas es una escala ORDINAL con semántica de estado
 * (bajo/medio/alto), no series categóricas: usa los colores de estado del
 * sistema. La pareja verde-ámbar del semáforo falla la separación CVD
 * (ΔE 5.7 en protanopía), así que el verde baja a `success-text` (#15803D) —
 * la única combinación de design.md que pasa las seis validaciones — y cada
 * banda lleva su conteo en texto: la identidad nunca depende solo del color.
 */
describe("distribucionBandasHtml", () => {
  it("reparte el ancho por proporción y rotula cada banda", () => {
    const html = distribucionBandasHtml({ bajo: 1, medio: 1, alto: 2 });
    // `flex:n` = la proporción de la banda; los 2px de separación se descuentan
    // del reparto en vez de desbordar el ancho.
    expect(html).toContain("flex:1 1 0%");
    expect(html).toContain("flex:2 1 0%");
    expect(html).toContain("Bajo 1");
    expect(html).toContain("Medio 1");
    expect(html).toContain("Alto 2");
  });

  it("omite las bandas vacías en la barra pero no miente en el conteo", () => {
    const html = distribucionBandasHtml({ bajo: 0, medio: 0, alto: 3 });
    expect(html).toContain("flex:3 1 0%");
    expect(html).toContain("Alto 3");
    expect(html).not.toContain("Bajo 0");
  });

  it("sin personas clasificadas no pinta nada", () => {
    expect(distribucionBandasHtml({ bajo: 0, medio: 0, alto: 0 })).toBe("");
    expect(distribucionBandasHtml({})).toBe("");
  });

  it("ignora bandas desconocidas que llegaran del backend", () => {
    const html = distribucionBandasHtml({ bajo: 1, alto: 1, sin_banda: 5 });
    expect(html).not.toContain("sin_banda");
    // Reparto 1:1 entre las dos bandas conocidas; el conteo desconocido no
    // entra al total ni al ancho.
    expect(html).toContain("Bajo 1");
    expect(html).toContain("Alto 1");
    expect((html.match(/flex:1 1 0%/g) ?? []).length).toBe(2);
  });
});
