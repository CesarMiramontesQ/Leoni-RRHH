export type PerfilTareaDisplayInput = {
  descripcion: string;
  tarea_catalogo_nombre?: string | null;
};

export function tareaTituloSubtitulo(t: PerfilTareaDisplayInput): {
  titulo: string;
  subtitulo: string | undefined;
} {
  const titulo = t.tarea_catalogo_nombre?.trim() || t.descripcion;
  const subtitulo =
    t.tarea_catalogo_nombre?.trim() &&
    t.descripcion.trim() &&
    t.descripcion.trim() !== t.tarea_catalogo_nombre.trim()
      ? t.descripcion.trim()
      : undefined;
  return { titulo, subtitulo };
}
