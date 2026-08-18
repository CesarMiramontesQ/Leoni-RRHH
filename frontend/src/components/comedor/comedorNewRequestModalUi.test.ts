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
