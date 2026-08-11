import { describe, expect, it } from "vitest";

import type {
  ComedorJornadaComidaApi,
  ComedorTurnoComidaApi,
} from "../../api/comedor.ts";
import {
  cruzaMedianoche,
  duracionMinutos,
  filtrarJornadas,
  filtrarTurnos,
  formatCiclo,
  formatDuracion,
  formatRangoJornada,
  renderComedorAjustes,
  toInputTime,
  type ComedorAjustesViewState,
} from "./comedorAjustesView.ts";

function jornada(over: Partial<ComedorJornadaComidaApi> = {}): ComedorJornadaComidaApi {
  return {
    ho_codigo: "001",
    descripcion: "Matutino 6:00 - 14:00",
    hora_entrada: "06:00:00",
    hora_salida: "14:00:00",
    jornada_horas: 8,
    activo: true,
    hora_inicio_comida: null,
    hora_fin_comida: null,
    actualizado_en: null,
    turnos: ["G9"],
    empleados_activos: 83,
    en_catalogo: true,
    ...over,
  };
}

function turno(over: Partial<ComedorTurnoComidaApi> = {}): ComedorTurnoComidaApi {
  return {
    tu_codigo: "G9",
    descripcion: "Grupo G9 2025",
    activo: true,
    tipo_turno: "ROTATIVO",
    jornada_horas: 48,
    dias_semana: 5,
    empleados_activos: 83,
    longitud_ciclo: 56,
    jornadas: ["001", "003"],
    jornadas_configuradas: 1,
    bloques: [],
    aviso: null,
    ...over,
  };
}

describe("duracionMinutos", () => {
  it("mide una ventana normal", () => {
    expect(duracionMinutos("13:00", "14:00")).toBe(60);
    expect(duracionMinutos("10:00", "10:30")).toBe(30);
  });

  it("mide una ventana que cruza medianoche en vez de descartarla", () => {
    // La jornada de 18:00-06:00 come alrededor de las 23:30; exigir inicio < fin
    // dejaría al turno de noche sin poder configurarse.
    expect(duracionMinutos("23:30", "00:30")).toBe(60);
    expect(duracionMinutos("22:00", "01:00")).toBe(180);
  });

  it("descarta una ventana de duración cero o incompleta", () => {
    expect(duracionMinutos("10:00", "10:00")).toBeNull();
    expect(duracionMinutos("", "10:00")).toBeNull();
    expect(duracionMinutos("10:00", "")).toBeNull();
  });
});

describe("cruzaMedianoche", () => {
  it("distingue la ventana que termina al día siguiente", () => {
    expect(cruzaMedianoche("23:30", "00:30")).toBe(true);
    expect(cruzaMedianoche("13:00", "14:00")).toBe(false);
    expect(cruzaMedianoche("", "")).toBe(false);
  });
});

describe("formatDuracion", () => {
  it("usa horas y minutos según haga falta", () => {
    expect(formatDuracion(60)).toBe("1 h");
    expect(formatDuracion(90)).toBe("1 h 30 min");
    expect(formatDuracion(45)).toBe("45 min");
    expect(formatDuracion(null)).toBe("—");
  });
});

describe("toInputTime y formatRangoJornada", () => {
  it("recorta los segundos que manda el backend", () => {
    expect(toInputTime("06:00:00")).toBe("06:00");
    expect(toInputTime(null)).toBe("");
  });

  it("arma el rango de la jornada", () => {
    expect(formatRangoJornada("06:00:00", "14:00:00")).toBe("06:00 – 14:00");
    expect(formatRangoJornada(null, "14:00:00")).toBe("—");
  });
});

describe("formatCiclo", () => {
  it("dice «Semanal» en un fijo y los días en un rotativo", () => {
    expect(formatCiclo(turno({ tipo_turno: "FIJO", longitud_ciclo: 7 }))).toBe("Semanal");
    expect(formatCiclo(turno({ longitud_ciclo: 56 }))).toBe("56 días");
    expect(formatCiclo(turno({ longitud_ciclo: null }))).toBe("—");
  });
});

describe("filtrarJornadas", () => {
  const items = [
    jornada({ ho_codigo: "001" }),
    jornada({
      ho_codigo: "003",
      descripcion: "Nocturno 22:00 - 06:00",
      hora_inicio_comida: "01:00:00",
      hora_fin_comida: "01:30:00",
      turnos: ["G5", "G9"],
    }),
  ];

  it("separa configuradas de sin configurar", () => {
    expect(filtrarJornadas(items, "configurados", "").map((j) => j.ho_codigo)).toEqual(["003"]);
    expect(filtrarJornadas(items, "sin-configurar", "").map((j) => j.ho_codigo)).toEqual(["001"]);
    expect(filtrarJornadas(items, "todos", "")).toHaveLength(2);
  });

  it("busca por código y por descripción", () => {
    expect(filtrarJornadas(items, "todos", "nocturno").map((j) => j.ho_codigo)).toEqual(["003"]);
    expect(filtrarJornadas(items, "todos", "001").map((j) => j.ho_codigo)).toEqual(["001"]);
  });

  it("busca también por el turno que recorre la jornada", () => {
    // Escribir «G5» debe llevar a las jornadas de ese turno, no a cero resultados.
    expect(filtrarJornadas(items, "todos", "g5").map((j) => j.ho_codigo)).toEqual(["003"]);
  });
});

describe("filtrarTurnos", () => {
  const items = [
    turno({ tu_codigo: "G9" }),
    turno({ tu_codigo: "05A", descripcion: "Mixto administrativo", jornadas: ["005A"] }),
  ];

  it("devuelve todo sin búsqueda", () => {
    expect(filtrarTurnos(items, "")).toHaveLength(2);
  });

  it("busca por código, descripción y jornada", () => {
    expect(filtrarTurnos(items, "g9").map((t) => t.tu_codigo)).toEqual(["G9"]);
    expect(filtrarTurnos(items, "administrativo").map((t) => t.tu_codigo)).toEqual(["05A"]);
    expect(filtrarTurnos(items, "005A").map((t) => t.tu_codigo)).toEqual(["05A"]);
  });
});

function estado(over: Partial<ComedorAjustesViewState> = {}): ComedorAjustesViewState {
  return {
    tab: "horarios",
    comedores: {
      panelState: "ready",
      items: [],
      filtroEstado: "todos",
      busqueda: "",
      errorMessage: null,
    },
    turnos: {
      panelState: "ready",
      items: [
        turno({
          bloques: [
            {
              dia_inicio: 1,
              dia_fin: 2,
              dias: 2,
              etiqueta: "Días 1–2",
              estatus: "LABORABLE",
              ho_codigo: "001",
              ho_descripcion: "Matutino 6:00 - 14:00",
              hora_entrada: "06:00:00",
              hora_salida: "14:00:00",
              hora_inicio_comida: "10:00:00",
              hora_fin_comida: "10:30:00",
              configurada: true,
            },
            {
              dia_inicio: 3,
              dia_fin: 4,
              dias: 2,
              etiqueta: "Días 3–4",
              estatus: "DESCANSO",
              ho_codigo: null,
              ho_descripcion: null,
              hora_entrada: null,
              hora_salida: null,
              hora_inicio_comida: null,
              hora_fin_comida: null,
              configurada: false,
            },
          ],
        }),
      ],
      jornadas: [jornada({ hora_inicio_comida: "10:00:00", hora_fin_comida: "10:30:00" })],
      filtroHorario: "todos",
      busqueda: "",
      incluirInactivos: false,
      soloEnUso: true,
      guardandoCodigo: null,
      expandidos: ["G9"],
      errorMessage: null,
      borradores: {},
    },
    validacion: {
      noEmpleado: "",
      fecha: "2026-08-11",
      estado: "idle",
      resultado: null,
      errorMessage: null,
    },
    ...over,
  };
}

describe("renderComedorAjustes", () => {
  it("pinta las jornadas editables y el ciclo del turno expandido", () => {
    const html = renderComedorAjustes(estado());

    expect(html).toContain("Horario de comida por jornada");
    expect(html).toContain('id="comedor-ajustes-jornadas-titulo"');
    expect(html).toContain('id="comedor-ajustes-turnos-titulo"');
    expect(html).toContain('data-jornada-hora-inicio');
    expect(html).toContain('data-jornada-guardar="001"');
    // El ciclo se muestra agrupado, con su etiqueta de tramo.
    expect(html).toContain("Días 1–2");
    expect(html).toContain("Rotativo");
  });

  it("marca el tramo de descanso sin ventana de comida", () => {
    const html = renderComedorAjustes(estado());
    expect(html).toContain("sin comida");
  });

  it("no ofrece editar la jornada dentro del ciclo, solo saltar a su fila", () => {
    // Dos campos abiertos para el mismo dato producirían borradores que se pisan.
    const html = renderComedorAjustes(estado());
    const detalle = html.slice(html.indexOf("Turnos y su ciclo"));
    expect(detalle).not.toContain("data-jornada-hora-inicio");
  });

  it("degrada el turno cuyo ciclo no se puede calcular", () => {
    const st = estado();
    st.turnos.items = [turno({ aviso: "El patrón de rotación no se interpreta", bloques: [] })];
    const html = renderComedorAjustes(st);
    expect(html).toContain("El patrón de rotación no se interpreta");
  });

  it("la pestaña de validación pide empleado y fecha", () => {
    const html = renderComedorAjustes(estado({ tab: "validacion" }));
    expect(html).toContain("data-validacion-empleado");
    expect(html).toContain("data-validacion-fecha");
    expect(html).toContain("data-validacion-consultar");
    expect(html).toContain('id="comedor-ajustes-validacion-titulo"');
  });

  it("la pestaña de comedores usa section card con CTA", () => {
    const html = renderComedorAjustes(estado({ tab: "comedores" }));
    expect(html).toContain('id="comedor-ajustes-comedores-titulo"');
    expect(html).toContain("data-comedor-agregar");
  });
});
