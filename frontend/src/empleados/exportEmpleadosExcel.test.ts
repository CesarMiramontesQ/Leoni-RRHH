import { describe, expect, it } from "vitest";
import { buildEmpleadosExcelRows } from "./exportEmpleadosExcel.ts";
import type { UsuarioListItem } from "../api/usuarios.ts";

const filaBase: UsuarioListItem = {
  id: 1,
  empleado_id: 10,
  no_empleado: "1001",
  nombre: "PEREZ, JUAN",
  email: "juan.perez@example.com",
  rol_id: 2,
  rol: null,
  estado: { estado_id: 1, descripcion: "Activo" },
  area: { area_id: 3, descripcion: "Producción" },
  subarea: null,
  puesto: { puesto_id: 4, descripcion: "Operador" },
  categoria: null,
  clasificacion: null,
  lider_id: 5,
  lider_nombre: "GARCIA, ANA",
  registro: "2020-01-15",
  created_at: "2020-01-15T00:00:00Z",
};

describe("buildEmpleadosExcelRows", () => {
  it("mapea columnas visibles del listado RH", () => {
    const rows = buildEmpleadosExcelRows([filaBase]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Empleado: "JUAN PEREZ",
      Correo: "juan.perez@example.com",
      Número: "1001",
      Área: "Producción",
      Puesto: "Operador",
      Líder: "ANA GARCIA",
      Estatus: "Activo",
    });
  });

  it("usa valores por defecto cuando faltan datos", () => {
    const rows = buildEmpleadosExcelRows([
      {
        ...filaBase,
        nombre: "",
        email: null,
        area: null,
        puesto: null,
        lider_nombre: null,
        estado: null,
      },
    ]);
    expect(rows[0]).toMatchObject({
      Empleado: "Sin nombre",
      Correo: "Sin correo",
      Área: "Sin asignar",
      Puesto: "Sin asignar",
      Líder: "Sin asignar",
      Estatus: "Sin estado",
    });
  });
});
