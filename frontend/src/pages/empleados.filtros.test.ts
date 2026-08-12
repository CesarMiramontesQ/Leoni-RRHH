/**
 * Los filtros no viven en la región que se recarga.
 *
 * Cuando la caja de búsqueda y los selects estaban dentro del bloque que
 * `loadPage()` reemplaza, cada búsqueda, paginación o clic en un KPI los
 * desmontaba mientras viajaba la petición: el campo desaparecía y no se podía
 * escribir ni borrar hasta que respondía el servidor. Aquí se fija la separación
 * en las tres vistas del listado, que es lo que impide que vuelva a pasar.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  EMP_TABLA_REGION_ID,
  renderFiltrosClasico,
  renderFiltrosLiderSupervisorRh,
  renderFiltrosRh,
  renderPanel,
  renderTablaClasica,
  renderTablaLiderSupervisorRh,
  renderTablaRh,
  renderTableLoadingRh,
  type State,
} from "./empleados.ts";

// `renderTablaClasica` resuelve el rol desde el token guardado; en Node no hay
// almacenamiento del navegador y basta con que no haya sesión.
beforeAll(() => {
  const vacio = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
  globalThis.localStorage ??= vacio;
  globalThis.sessionStorage ??= vacio;
});

const STATE: State = {
  page: 1,
  page_size: 10,
  q: "GARCIA",
  area_id: "",
  puesto_id: "",
  activo_rh: "",
  estatus_lider: "",
  kpi_tarjeta_activa: "",
};

const CATALOGO = {
  areas: [{ area_id: 3, descripcion: "PRODUCCIÓN" }],
  puestos: [{ puesto_id: 7, descripcion: "OPERADOR" }],
};

/** Página vacía: evita construir filas, que dependen del rol de la sesión. */
const PAGINA = { items: [], total: 0, page: 1, page_size: 10 };

const CONTROLES = ["emp-search", "emp-filter-area", "emp-filter-puesto"];

describe("región recargable del listado de empleados", () => {
  const vistas = [
    {
      nombre: "RH",
      filtros: () => renderFiltrosRh(STATE, CATALOGO as never, 42, false),
      tabla: () => renderTablaRh(PAGINA as never, 10),
      panel: () => renderPanel(STATE, CATALOGO as never, PAGINA as never, "operativo", false),
      extra: "emp-filter-status",
    },
    {
      nombre: "supervisor",
      filtros: () => renderFiltrosLiderSupervisorRh(STATE, CATALOGO as never, 42),
      tabla: () => renderTablaLiderSupervisorRh(PAGINA as never, 10),
      panel: null,
      extra: "emp-filter-lider-estatus",
    },
    {
      nombre: "clásica",
      filtros: () => renderFiltrosClasico(STATE, CATALOGO as never, "director", false),
      tabla: () => renderTablaClasica(STATE, PAGINA as never, "director"),
      panel: () => renderPanel(STATE, CATALOGO as never, PAGINA as never, "director", false),
      extra: null,
    },
  ] as const;

  for (const vista of vistas) {
    describe(`vista ${vista.nombre}`, () => {
      it("monta los controles de filtro fuera de la tabla", () => {
        const filtros = vista.filtros();
        for (const id of CONTROLES) expect(filtros).toContain(`id="${id}"`);
        if (vista.extra) expect(filtros).toContain(`id="${vista.extra}"`);
      });

      it("no repite ningún control de filtro dentro de la tabla", () => {
        const tabla = vista.tabla();
        for (const id of [...CONTROLES, vista.extra].filter(Boolean)) {
          expect(tabla).not.toContain(`id="${id}"`);
        }
      });

      if (vista.panel) {
        it("deja la tabla dentro de la región recargable y los filtros fuera", () => {
          const panel = vista.panel();
          const marca = `<div id="${EMP_TABLA_REGION_ID}">`;
          const corte = panel.indexOf(marca);
          expect(corte).toBeGreaterThan(-1);
          // Todo lo anterior a la región es lo que sobrevive a una recarga.
          expect(panel.slice(0, corte)).toContain('id="emp-search"');
          expect(panel.slice(corte)).not.toContain('id="emp-search"');
        });
      }
    });
  }

  it("el esqueleto de carga no arrastra la caja de búsqueda", () => {
    // Es el HTML que ocupa la región mientras viaja la petición: si trajera los
    // filtros, volvería a desmontarlos en cada carga.
    const esqueleto = renderTableLoadingRh();
    for (const id of CONTROLES) expect(esqueleto).not.toContain(`id="${id}"`);
    expect(esqueleto).toContain("Cargando tabla");
  });

  it("conserva el texto buscado al repintar los filtros", () => {
    expect(renderFiltrosRh(STATE, CATALOGO as never, 42, false)).toContain('value="GARCIA"');
  });
});
