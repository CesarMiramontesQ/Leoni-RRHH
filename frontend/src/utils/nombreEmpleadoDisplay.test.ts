import { describe, expect, it } from "vitest";
import {
  capitalizarNombreTituloUi,
  formatNombreEmpleadoUi,
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

describe("formatNombreEmpleadoUi", () => {
  it("delega en reordenar sin título", () => {
    expect(formatNombreEmpleadoUi("BORUNDA VAZQUEZ, MARIA MONSERRAT")).toBe("MARIA MONSERRAT BORUNDA VAZQUEZ");
    expect(formatNombreEmpleadoUi("Admin RH")).toBe("Admin RH");
    expect(formatNombreEmpleadoUi("")).toBe("");
  });

  it("opción titulo", () => {
    expect(formatNombreEmpleadoUi("BORUNDA VAZQUEZ, MARIA MONSERRAT", { titulo: true })).toBe(
      "Maria Monserrat Borunda Vazquez",
    );
  });
});

describe("capitalizarNombreTituloUi", () => {
  it("capitaliza por palabra", () => {
    expect(capitalizarNombreTituloUi("MARIA MONSERRAT BORUNDA VAZQUEZ")).toBe(
      "Maria Monserrat Borunda Vazquez",
    );
  });
});
