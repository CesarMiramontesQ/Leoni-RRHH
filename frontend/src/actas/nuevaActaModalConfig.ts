export type NuevaActaEmpleadoOption = {
  id: string;
  nombre: string;
  numeroEmpleado: string;
  areaDepartamento: string;
  supervisorDirecto: string;
};

export type NuevaActaSelectOption = {
  id: string;
  label: string;
};

export type NuevaActaFormData = {
  empleadoId: string;
  numeroEmpleado: string;
  areaDepartamento: string;
  supervisorDirecto: string;
  tipoFalta: string;
  fundamentoLegal: string;
  articuloInciso: string;
  fechaEvento: string;
  lugarIncidente: string;
  descripcionHechos: string;
  personasInvolucradas: string;
  testigos: string;
  responsableRhId: string;
  evidencias: File[];
};

export type NuevaActaFormErrors = Partial<Record<keyof Omit<NuevaActaFormData, "evidencias"> | "evidencias", string>>;

export function createNuevaActaInitialData(): NuevaActaFormData {
  return {
    empleadoId: "",
    numeroEmpleado: "",
    areaDepartamento: "",
    supervisorDirecto: "",
    tipoFalta: "",
    fundamentoLegal: "",
    articuloInciso: "",
    fechaEvento: "",
    lugarIncidente: "",
    descripcionHechos: "",
    personasInvolucradas: "",
    testigos: "",
    responsableRhId: "",
    evidencias: [],
  };
}

export function fillEmployeeSnapshot(
  prev: NuevaActaFormData,
  employee: NuevaActaEmpleadoOption | null,
): NuevaActaFormData {
  if (!employee) {
    return {
      ...prev,
      empleadoId: "",
      numeroEmpleado: "",
      areaDepartamento: "",
      supervisorDirecto: "",
    };
  }
  return {
    ...prev,
    empleadoId: employee.id,
    numeroEmpleado: employee.numeroEmpleado,
    areaDepartamento: employee.areaDepartamento,
    supervisorDirecto: employee.supervisorDirecto,
  };
}

function safeTrim(value: string): string {
  return value.trim();
}

export function validateNuevaActaForm(data: NuevaActaFormData): NuevaActaFormErrors {
  const errors: NuevaActaFormErrors = {};
  if (!safeTrim(data.empleadoId)) errors.empleadoId = "Selecciona un empleado.";
  if (!safeTrim(data.numeroEmpleado)) errors.numeroEmpleado = "No. de empleado no disponible.";
  if (!safeTrim(data.areaDepartamento)) errors.areaDepartamento = "Captura el área o departamento.";
  if (!safeTrim(data.supervisorDirecto)) errors.supervisorDirecto = "Captura el supervisor directo.";
  if (!safeTrim(data.tipoFalta)) errors.tipoFalta = "Describe el tipo de falta disciplinaria.";
  if (!safeTrim(data.fundamentoLegal)) errors.fundamentoLegal = "Selecciona el fundamento legal.";
  if (!safeTrim(data.articuloInciso)) errors.articuloInciso = "Captura el artículo o inciso.";
  if (!safeTrim(data.fechaEvento)) errors.fechaEvento = "Selecciona la fecha del evento.";
  if (!safeTrim(data.lugarIncidente)) errors.lugarIncidente = "Captura el lugar del incidente.";
  if (!safeTrim(data.descripcionHechos)) errors.descripcionHechos = "Describe los hechos.";
  if (!safeTrim(data.responsableRhId)) errors.responsableRhId = "Selecciona responsable de RH.";
  if (data.evidencias.length === 0) errors.evidencias = "Adjunta al menos una evidencia.";
  return errors;
}
