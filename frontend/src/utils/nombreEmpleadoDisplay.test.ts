import { describe, expect, it } from "vitest";
import {
  capitalizarNombreTituloUi,
  formatNombreEmpleadoIncidenciasUi,
  formatNombreEmpleadoUi,
  inicialesDesdeNombreDisplay,
  quitarSegundoApellidoUi,
  reordenarNombreComaApellidos,
} from "./nombreEmpleadoDisplay.ts";

describe("reordenarNombreComaApellidos", () => {
  it("reordena APELLIDOS, NOMBRES", () => {
    expect(reordenarNombreComaApellidos("BORUNDA VAZQUEZ, MARIA MONSERRAT")).toBe(
      "MARIA MONSERRAT BORUNDA VAZQUEZ",
    );
    expect(reordenarNombreComaApellidos("COLLAZO BRIANO, HECTOR")).toBe("HECTOR COLLAZO BRIANO");
  });

  it("sin coma devuelve el texto normalizado", () => {
    expect(reordenarNombreComaApellidos("Admin RH")).toBe("Admin RH");
    expect(reordenarNombreComaApellidos("  Solo   nombre  ")).toBe("Solo nombre");
  });

  it("vacíos", () => {
    expect(reordenarNombreComaApellidos("")).toBe("");
    expect(reordenarNombreComaApellidos("   ")).toBe("");
    expect(reordenarNombreComaApellidos(null)).toBe("");
    expect(reordenarNombreComaApellidos(undefined)).toBe("");
  });

  it("varias comas en la parte de nombres", () => {
    expect(reordenarNombreComaApellidos("APELLIDO, NOMBRE1, NOMBRE2")).toBe("NOMBRE1, NOMBRE2 APELLIDO");
  });
});

describe("quitarSegundoApellidoUi", () => {
  it("quita el último token solo si hay más de dos", () => {
    expect(quitarSegundoApellidoUi("FABIOLA QUEZADA ROMERO")).toBe("FABIOLA QUEZADA");
    expect(quitarSegundoApellidoUi("KARIME GISELLE LOYA FROESE")).toBe("KARIME GISELLE LOYA");
    expect(quitarSegundoApellidoUi("CARLOS ROBERTO REYNOSO RODRIGUEZ")).toBe("CARLOS ROBERTO REYNOSO");
    expect(quitarSegundoApellidoUi("JUAN PEREZ")).toBe("JUAN PEREZ");
    expect(quitarSegundoApellidoUi("MARIA")).toBe("MARIA");
  });
});

describe("formatNombreEmpleadoUi", () => {
  it("reordena y omite segundo apellido por defecto", () => {
    expect(formatNombreEmpleadoUi("QUEZADA ROMERO, FABIOLA")).toBe("FABIOLA QUEZADA");
    expect(formatNombreEmpleadoUi("BORUNDA VAZQUEZ, MARIA MONSERRAT")).toBe("MARIA MONSERRAT BORUNDA");
    expect(formatNombreEmpleadoUi("Admin RH")).toBe("Admin RH");
    expect(formatNombreEmpleadoUi("")).toBe("");
  });

  it("omitirSegundoApellido false conserva apellidos completos", () => {
    expect(
      formatNombreEmpleadoUi("BORUNDA VAZQUEZ, MARIA MONSERRAT", { omitirSegundoApellido: false }),
    ).toBe("MARIA MONSERRAT BORUNDA VAZQUEZ");
  });

  it("opción titulo", () => {
    expect(formatNombreEmpleadoUi("BORUNDA VAZQUEZ, MARIA MONSERRAT", { titulo: true })).toBe(
      "Maria Monserrat Borunda",
    );
  });
});

describe("formatNombreEmpleadoIncidenciasUi", () => {
  it("reordena, conserva ambos apellidos y capitaliza título", () => {
    expect(formatNombreEmpleadoIncidenciasUi("TOVAR DIAZ, ANAHIS")).toBe("Anahis Tovar Diaz");
    expect(formatNombreEmpleadoIncidenciasUi("QUEZADA ROMERO, FABIOLA")).toBe("Fabiola Quezada Romero");
  });
});

describe("inicialesDesdeNombreDisplay", () => {
  it("primer token + último token del nombre mostrado", () => {
    expect(inicialesDesdeNombreDisplay("FABIOLA QUEZADA")).toBe("FQ");
    expect(inicialesDesdeNombreDisplay("KARIME GISELLE LOYA")).toBe("KL");
    expect(inicialesDesdeNombreDisplay("CARLOS ROBERTO REYNOSO")).toBe("CR");
  });

  it("con un solo token y singleTokenUnaLetra, solo la primera letra", () => {
    expect(inicialesDesdeNombreDisplay("MARIA", { singleTokenUnaLetra: true })).toBe("M");
  });

  it("con un solo token sin opción, conserva dos letras del token", () => {
    expect(inicialesDesdeNombreDisplay("MARIA")).toBe("MA");
  });
});

describe("capitalizarNombreTituloUi", () => {
  it("capitaliza por palabra", () => {
    expect(capitalizarNombreTituloUi("MARIA MONSERRAT BORUNDA VAZQUEZ")).toBe(
      "Maria Monserrat Borunda Vazquez",
    );
  });
});
