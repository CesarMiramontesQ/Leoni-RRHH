/**
 * Etiquetas de tipo para listado y filtros RH (códigos de negocio / histórico TRESS).
 */

export function labelTipoIncidenciaUi(codigo: string): string {
  const t = codigo.trim();
  switch (t) {
    case "seguridad_historico":
      return "Seguridad";
    case "calidad_historico":
      return "Calidad";
    case "falta_injustificada":
      return "Falta injustificada";
    case "retardo":
      return "Retardo";
    case "indisciplina":
      return "Indisciplina";
    case "dano_equipo":
      return "Daño a equipo";
    default:
      return t || codigo;
  }
}
