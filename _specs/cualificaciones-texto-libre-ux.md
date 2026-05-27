# Cualificaciones de Texto Libre con UX Mejorada

## Resumen

Mejorar la captura y visualización de los 5 tipos de cualificación que permanecen como texto libre: formación profesional, ampliación de formación, estudios universitarios, experiencia profesional, y experiencia de dirección. Se agregan sugerencias autocompletables basadas en valores históricos, campo opcional de "N/A" con un toggle, y para experiencia profesional un campo numérico de años separado del texto descriptivo.

## Motivación

- Estos 5 tipos tienen valores altamente variables (24-47 valores únicos) que no se pueden reducir a un catálogo cerrado.
- Sin embargo, entre 56-72% de los perfiles ponen "N/A" en formación profesional, ampliación, estudios universitarios, y experiencia de dirección — lo que sugiere que son opcionales y frecuentemente irrelevantes.
- "Experiencia profesional" (93% de presencia) mezcla dos tipos de información:
  1. **Años de experiencia** (cuantificable): "5 años", "4-5 años"
  2. **Conocimientos/habilidades** (descriptivo): "Conocimiento en el proceso de producción"
- Actualmente todo se captura en un solo campo de texto sin ninguna asistencia o estructura.

## Alcance

### 1. Toggle "No aplica" para tipos opcionales

Para los tipos: `formacion_profesional`, `ampliacion_formacion`, `estudios_universitarios`, `experiencia_direccion`:

- Agregar un toggle/checkbox "No aplica" en el formulario de captura.
- Si está activado, se guarda `situacion_deseada = "N/A"` y el campo de texto se oculta/deshabilita.
- Al mostrar en la tabla, los registros con "N/A" se muestran con badge gris "No aplica" en vez del texto.
- Reduce fricción: RH no necesita escribir "N/A", "na", "n.a", etc.

### 2. Experiencia profesional: separar años de descripción

Para el tipo `experiencia_profesional`, dividir el campo en dos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `anios_experiencia_min` | int nullable | Años mínimos requeridos (situación deseada) |
| `descripcion_experiencia` | text | Conocimientos/habilidades descriptivas |

En el formulario:
- Input numérico: "Años mínimos de experiencia" (opcional)
- Textarea: "Conocimientos y habilidades requeridas" (principal)

En la evaluación del empleado:
- Input numérico: "Años de experiencia del empleado"
- Textarea: "Conocimientos actuales"

**Compliance parcial automático para años:**
- Si ambos tienen valor numérico: `anios_actual >= anios_requerido` → badge verde/rojo
- Si solo hay texto descriptivo: compliance no se puede computar automáticamente, se muestra sin badge

### 3. Autocompletado con valores históricos

Para todos los tipos de texto libre, implementar un **datalist/autocomplete** que sugiere valores previamente usados en otros perfiles del mismo tipo:

- Al escribir en el campo "Situación deseada", se muestran sugerencias filtradas de valores existentes en `perfil_cualificaciones` con el mismo `tipo`.
- No es catálogo cerrado — el usuario puede escribir lo que quiera, pero las sugerencias reducen duplicados y typos.
- Las sugerencias se cargan de un endpoint: `GET /api/v1/perfil-cualificaciones/sugerencias?tipo=formacion_profesional&q=Ing`

### 4. Endpoint de sugerencias

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/v1/perfil-cualificaciones/sugerencias` | Valores únicos de `situacion_deseada` por tipo, filtrados por query |

Query params:
- `tipo` (requerido): tipo de cualificación
- `q` (opcional): filtro de texto (ILIKE)
- `limit` (default 10): máximo de resultados

Response: `string[]` — lista de valores únicos usados previamente.

Implementación: `SELECT DISTINCT situacion_deseada FROM perfil_cualificaciones WHERE tipo = :tipo AND situacion_deseada ILIKE :q AND situacion_deseada NOT IN ('N/A', 'NA', 'n.a', 'Ninguna') ORDER BY situacion_deseada LIMIT :limit`

### 5. Experiencia de dirección: mismo patrón que experiencia profesional

Para `experiencia_direccion`, aplicar el mismo patrón de años + descripción:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `anios_direccion_min` | int nullable | Años mínimos de experiencia gerencial |
| `descripcion_direccion` | text nullable | Descripción adicional |

Dado que 72% son "N/A", el toggle de "No aplica" tiene prioridad. Si no aplica, los campos de años y descripción se ocultan.

### 6. Complementos: textarea multilinea

El tipo `complementos` es texto largo multilinea (requisitos SST, NOMs, etc.):
- Se muestra como `<textarea>` con rows=6 mínimo.
- No tiene toggle de "N/A" (si no hay complementos, simplemente no se crea el registro).
- No tiene autocompletado (cada complemento es único al puesto).
- En la vista de lectura, se renderiza con saltos de linea preservados (whitespace-pre-line).

### 7. Migración de datos existentes

Agregar columnas opcionales a `perfil_cualificaciones`:

| Columna nueva | Tipo | Default | Uso |
|---------------|------|---------|-----|
| `anios_minimos` | int nullable | NULL | Años mínimos (para experiencia_profesional y experiencia_direccion) |

Agregar columna a `perfil_funciones_cualificacion` (evaluación individual):

| Columna nueva | Tipo | Default | Uso |
|---------------|------|---------|-----|
| `anios_actuales` | int nullable | NULL | Años que tiene el empleado |

No se requiere migración de datos existentes — los campos nuevos son nullable y opcionales.

### 8. Frontend: formulario inteligente por tipo

El modal de cualificaciones (`editarCualificacionesModal.ts`) cambia su formulario según el tipo seleccionado:

| Tipo | Campos mostrados |
|------|-----------------|
| `estudios_finalizados` | Select de catálogo de escolaridad (otro spec) |
| `formacion_profesional` | Toggle "No aplica" + Input con autocomplete |
| `ampliacion_formacion` | Toggle "No aplica" + Input con autocomplete |
| `estudios_universitarios` | Toggle "No aplica" + Input con autocomplete |
| `experiencia_profesional` | Input numérico años + Textarea conocimientos con autocomplete |
| `experiencia_direccion` | Toggle "No aplica" + Input numérico años + Textarea con autocomplete |
| `complementos` | Textarea multilinea (sin autocomplete) |

### Fuera de alcance

- Normalización/merge de valores existentes duplicados ("N/A" vs "NA" vs "n.a" vs "Ninguna")
- Validación de que la experiencia del empleado sea coherente con su antigüedad real
- Catálogo cerrado para formación/estudios (demasiada variabilidad para cerrarlo)
- Compliance automático para formación o estudios (no hay jerarquía clara como en escolaridad)
- Template/preset de cualificaciones por tipo de puesto (e.g. "todos los operadores llevan estas")

## Dependencias

- Modelo `PerfilCualificacion` en `app/models/talento.py` — agregar columna `anios_minimos`
- Modelo `PerfilFuncionesCualificacion` — agregar columna `anios_actuales`
- Schema `perfil_funciones.py` — agregar campos opcionales de años
- Nuevo endpoint de sugerencias en router de perfil_funciones
- Frontend `editarCualificacionesModal.ts` — form condicional por tipo
- Spec `cualificaciones-auto-compliance.md` — se complementa (estudios_finalizados se define allá)
- Migración Alembic para las columnas nuevas

## Criterios de aceptación

- [ ] Toggle "No aplica" funciona para formación, ampliación, estudios universitarios, experiencia dirección
- [ ] Al activar toggle se guarda "N/A" y se muestra badge gris en tabla
- [ ] Experiencia profesional tiene campo numérico de años + textarea de conocimientos
- [ ] Experiencia dirección tiene toggle N/A + campo numérico de años + textarea
- [ ] Compliance automático de años: `anios_actual >= anios_minimos` → badge verde/rojo
- [ ] Autocomplete sugiere valores existentes al escribir (con debounce)
- [ ] Endpoint de sugerencias retorna valores únicos filtrados por tipo y query
- [ ] Complementos se muestra como textarea multilinea con whitespace preservado
- [ ] Formulario cambia dinámicamente según el tipo seleccionado
- [ ] Columnas `anios_minimos` y `anios_actuales` creadas vía migración (nullable)
- [ ] Backwards compatible: registros existentes con texto libre siguen funcionando
- [ ] Los valores "N/A", "NA", "n.a", "Ninguna" no aparecen en sugerencias de autocomplete
