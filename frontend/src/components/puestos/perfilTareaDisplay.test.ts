import { describe, expect, it } from "vitest";
import { tareaTituloSubtitulo } from "./perfilTareaDisplay.ts";

describe("tareaTituloSubtitulo", () => {
  it("usa nombre del catálogo como título y descripción como subtítulo", () => {
    expect(
      tareaTituloSubtitulo({
        descripcion: "Supervisar y validar entregas de material.",
        tarea_catalogo_nombre: "Supervisión entregas",
      }),
    ).toEqual({
      titulo: "Supervisión entregas",
      subtitulo: "Supervisar y validar entregas de material.",
    });
  });

  it("tarea legacy sin catálogo muestra solo descripcion", () => {
    expect(
      tareaTituloSubtitulo({
        descripcion: "Texto libre de tarea legacy",
      }),
    ).toEqual({
      titulo: "Texto libre de tarea legacy",
      subtitulo: undefined,
    });
  });

  it("sin descripción distinta omite subtítulo duplicado", () => {
    expect(
      tareaTituloSubtitulo({
        descripcion: "Solo nombre",
        tarea_catalogo_nombre: "Solo nombre",
      }),
    ).toEqual({
      titulo: "Solo nombre",
      subtitulo: undefined,
    });
  });
});
