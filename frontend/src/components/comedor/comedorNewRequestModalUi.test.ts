import { describe, expect, it } from "vitest";
import {
  buildComedorNewRequestFormHtml,
  type BuildComedorNewRequestFormParams,
} from "./comedorNewRequestModalUi.ts";

function params(
  overrides: Partial<BuildComedorNewRequestFormParams> = {},
): BuildComedorNewRequestFormParams {
  return {
    state: {
      personType: "interno",
      employeeSearch: "",
      selectedEmployeeId: "553",
      supervisorRecipientScope: null,
      externalPeopleCount: "1",
      menuId: "casera",
      fechaServicio: "2026-07-14",
    },
    allowExternalPeople: false,
    allowEmployeeSearch: false,
    errors: {},
    isSubmitting: false,
    menuOptions: [{ id: "casera", label: "Opción A" }],
    searchResults: [],
    employeeOptions: [],
    isSearchingEmployees: false,
    searchEmployeesError: null,
    selectedEmployee: null,
    ...overrides,
  };
}

describe("comedorNewRequestModalUi — calendario con descansos", () => {
  it("usa el calendario propio en lugar del input de fecha nativo", () => {
    const html = buildComedorNewRequestFormHtml(params());

    expect(html).toContain("data-workday-date-picker");
    expect(html).toContain('id="comedor-modal-date"');
    expect(html).toContain('value="2026-07-14"');
    expect(html).not.toContain('type="date"');
  });

  it("avisa mientras consulta los descansos del beneficiario", () => {
    const html = buildComedorNewRequestFormHtml(params({ descansosState: "loading" }));

    expect(html).toContain("Consultando descansos del empleado");
  });

  it("muestra el fallo de descansos sin bloquear el registro", () => {
    const html = buildComedorNewRequestFormHtml(
      params({ descansosState: "error", descansosError: "Sin turno vigente." }),
    );

    expect(html).toContain("Sin turno vigente.");
    // El atributo, no las variantes `disabled:` de Tailwind que trae la clase.
    const submit = html.split('type="submit"')[1]?.split("</button>")[0] ?? "";
    expect(/\sdisabled(?![:-])/.test(submit)).toBe(false);
  });

  it("sí detecta el botón deshabilitado mientras guarda", () => {
    const html = buildComedorNewRequestFormHtml(params({ isSubmitting: true }));

    const submit = html.split('type="submit"')[1]?.split("</button>")[0] ?? "";
    expect(/\sdisabled(?![:-])/.test(submit)).toBe(true);
  });

  it("pinta el error cuando la fecha elegida es un descanso", () => {
    const html = buildComedorNewRequestFormHtml(
      params({ errors: { fechaServicio: "Ese día el colaborador descansa; elige otra fecha." } }),
    );

    expect(html).toContain("Ese día el colaborador descansa; elige otra fecha.");
  });
});

describe("comedorNewRequestModalUi — buscador de miembro del equipo", () => {
  const EQUIPO = [
    { id: "10", nombre: "Ana López", numero: "553", area: "Equipo directo", avatarUrl: null },
    { id: "11", nombre: "José Ramírez", numero: "1819", area: "Equipo directo", avatarUrl: null },
  ];

  function equipoParams(
    overrides: Partial<BuildComedorNewRequestFormParams> = {},
  ): BuildComedorNewRequestFormParams {
    const base = params(overrides);
    return {
      ...base,
      state: {
        ...base.state,
        supervisorRecipientScope: "team",
        selectedEmployeeId: null,
        ...(overrides.state ?? {}),
      },
      supervisorSelfOption: {
        id: "99",
        nombre: "Yo Líder",
        numero: "1000",
        area: "Equipo directo",
        avatarUrl: null,
      },
      teamEmployeeOptions: overrides.teamEmployeeOptions ?? EQUIPO,
    };
  }

  it("ofrece un buscador en vez de un select nativo", () => {
    const html = buildComedorNewRequestFormHtml(equipoParams());

    expect(html).toContain("data-comedor-modal-team-search");
    expect(html).not.toContain("data-comedor-modal-employee-select");
  });

  it("dice que se puede buscar por nombre o por número", () => {
    const html = buildComedorNewRequestFormHtml(equipoParams());
    const input = html.split("data-comedor-modal-team-search")[1]?.split(">")[0] ?? "";

    expect(input).toContain("Nombre o número de empleado");
  });

  it("arranca cerrado: sin escribir nada no vuelca el equipo entero", () => {
    const html = buildComedorNewRequestFormHtml(equipoParams());

    expect(html).toContain("data-comedor-modal-team-search");
    expect(html).not.toContain("data-comedor-modal-team-pick");
  });

  it("lista a cada integrante con su número, y elegible por clic", () => {
    const html = buildComedorNewRequestFormHtml(
      equipoParams({
        state: { ...params().state, supervisorRecipientScope: "team", selectedEmployeeId: null, employeeSearch: "a" },
      }),
    );

    expect(html).toContain('data-comedor-modal-team-pick="10"');
    expect(html).toContain('data-comedor-modal-team-pick="11"');
    expect(html).toContain("1819");
  });

  it("solo lista lo que coincide con la búsqueda", () => {
    const html = buildComedorNewRequestFormHtml(
      equipoParams({ state: { ...params().state, supervisorRecipientScope: "team", selectedEmployeeId: null, employeeSearch: "1819" } }),
    );

    expect(html).toContain('data-comedor-modal-team-pick="11"');
    expect(html).not.toContain('data-comedor-modal-team-pick="10"');
  });

  it("una búsqueda sin coincidencias lo dice, en vez de mostrar una lista vacía", () => {
    const html = buildComedorNewRequestFormHtml(
      equipoParams({ state: { ...params().state, supervisorRecipientScope: "team", selectedEmployeeId: null, employeeSearch: "zzz" } }),
    );

    expect(html).toContain("No hay coincidencias en tu equipo");
  });

  it("con integrante ya elegido y sin búsqueda, la lista se repliega", () => {
    const html = buildComedorNewRequestFormHtml(
      equipoParams({
        state: { ...params().state, supervisorRecipientScope: "team", selectedEmployeeId: "10", employeeSearch: "" },
        selectedEmployee: EQUIPO[0],
      }),
    );

    expect(html).toContain("data-comedor-modal-team-search");
    expect(html).not.toContain("data-comedor-modal-team-pick");
  });

  it("al volver a escribir la lista reaparece para poder cambiar", () => {
    const html = buildComedorNewRequestFormHtml(
      equipoParams({
        state: { ...params().state, supervisorRecipientScope: "team", selectedEmployeeId: "10", employeeSearch: "jose" },
        selectedEmployee: EQUIPO[0],
      }),
    );

    expect(html).toContain('data-comedor-modal-team-pick="11"');
  });

  it("sin equipo mantiene el aviso de siempre, no un buscador vacío", () => {
    const html = buildComedorNewRequestFormHtml(equipoParams({ teamEmployeeOptions: [] }));

    expect(html).toContain("No hay colaboradores en tu equipo directo");
    expect(html).not.toContain("data-comedor-modal-team-search");
  });
});
