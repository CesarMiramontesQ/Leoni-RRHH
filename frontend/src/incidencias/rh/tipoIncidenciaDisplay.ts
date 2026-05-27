/**
 * Etiquetas de tipo para listado y filtros RH (códigos de negocio).
 */

export function labelTipoIncidenciaUi(codigo: string): string {
  const t = codigo.trim();
  switch (t) {
    case "Seguridad":
    case "seguridad":
      return "Seguridad";
    case "Calidad":
    case "calidad":
      return "Calidad";
    case "falta_injustificada":
      return "Falta injustificada";
    case "retardo":
      return "Retardo";
    case "indisciplina":
      return "Indisciplina";
    case "dano_equipo":
      return "Daño a equipo";
    case "falta_justificada":
      return "Falta justificada";
    case "vacaciones":
      return "Vacaciones";
    case "permiso_con_goce":
      return "Permiso con goce";
    case "permiso_sin_goce":
      return "Permiso sin goce";
    case "Evaluacion":
    case "evaluacion":
      return "Evaluación";
    default:
      return t || codigo;
  }
}
