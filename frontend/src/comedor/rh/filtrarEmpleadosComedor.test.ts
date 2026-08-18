import { describe, expect, it } from "vitest";
import { filtrarEmpleadosComedor } from "./filtrarEmpleadosComedor.ts";
import type { ComedorEmployeeOption } from "./types.ts";

function opt(id: string, nombre: string, numero: string): ComedorEmployeeOption {
  return { id, nombre, numero, area: "Equipo directo", avatarUrl: null };
}

const EQUIPO: ComedorEmployeeOption[] = [
  opt("10", "Ana López", "553"),
  opt("11", "José Ramírez", "1819"),
  opt("12", "Luis Adrián Colmenero", "3723"),
];

describe("filtrarEmpleadosComedor", () => {
  it("sin texto devuelve el equipo completo, en su orden", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "  ").map((e) => e.id)).toEqual(["10", "11", "12"]);
  });

  it("busca por número de empleado", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "1819").map((e) => e.id)).toEqual(["11"]);
  });

  it("busca por número parcial", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "37").map((e) => e.id)).toEqual(["12"]);
  });

  it("busca por nombre sin distinguir mayúsculas ni acentos", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "jose").map((e) => e.id)).toEqual(["11"]);
    expect(filtrarEmpleadosComedor(EQUIPO, "LOPEZ").map((e) => e.id)).toEqual(["10"]);
  });

  it("busca por apellido a media cadena", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "colmenero").map((e) => e.id)).toEqual(["12"]);
  });

  it("cada palabra tiene que aparecer, en cualquier orden", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "lopez ana").map((e) => e.id)).toEqual(["10"]);
    expect(filtrarEmpleadosComedor(EQUIPO, "ana ramirez")).toEqual([]);
  });

  it("sin coincidencias devuelve vacío, no el equipo entero", () => {
    expect(filtrarEmpleadosComedor(EQUIPO, "zzz")).toEqual([]);
  });
});
