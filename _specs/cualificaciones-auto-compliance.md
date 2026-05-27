# Cualificaciones con Compliance Automático

## Resumen

Convertir el campo "Nivel de estudios finalizados" de texto libre a un catálogo ordenado jerárquicamente que permite calcular automáticamente si un empleado cumple con el requisito del puesto. El compliance se computa por comparación de niveles (actual >= requerido), eliminando la necesidad de captura manual de cumplimiento. El mismo patrón se aplica al campo "Experiencia profesional" que combina un valor numérico de años con descripción de conocimientos.

## Motivación

- Actualmente `situacion_deseada` y `situacion_actual` son texto libre para todos los tipos de cualificación, lo que impide comparación automática.
- En los 190 PDFs de perfiles de función de Leoni, "Nivel de estudios finalizados" aparece en el 100% de los perfiles con valores que se reducen a un catálogo cerrado de ~6 opciones ordenadas jerárquicamente.
- "Experiencia profesional" aparece en el 93% de los perfiles y mezcla años de experiencia con habilidades descriptivas.
- RH no debería decidir manualmente si "Preparatoria" cumple un requisito de "Secundaria" — eso es trivial de computar.
- Los campos restantes (formación profesional, ampliación, estudios universitarios, experiencia de dirección, complementos) son mayoritariamente "N/A" (56-72%) y se mantienen como texto libre.

## Alcance

### 1. Catálogo de niveles de escolaridad

Nuevo enum/catálogo con jerarquía ordinal:

| Clave | Label | Peso |
|-------|-------|------|
| ninguno | Ninguno | 0 |
| primaria | Primaria | 1 |
| secundaria | Secundaria | 2 |
| preparatoria | Preparatoria / Bachillerato | 3 |
| licenciatura | Licenciatura | 4 |
| maestria | Maestría | 5 |
| doctorado | Doctorado | 6 |

Este catálogo es constante (no tabla en BD) — se define como enum en backend y frontend.

### 2. Cambio en PerfilCualificacion para tipo `estudios_finalizados`

- `situacion_deseada` pasa de texto libre a una **clave del catálogo** (e.g. `"secundaria"`, `"licenciatura"`).
- El frontend muestra un `<select>` con las opciones del catálogo al crear/editar una cualificación de este tipo.
- En backend, se valida que si `tipo == "estudios_finalizados"`, `situacion_deseada` sea una clave válida del catálogo.
- Para tipos distintos a `estudios_finalizados`, `situacion_deseada` sigue siendo texto libre.

### 3. Cambio en PerfilFuncionesCualificacion para tipo `estudios_finalizados`

- `situacion_actual` también se captura como **clave del catálogo** (select, no texto libre).
- Se captura una sola vez al momento de asignar el empleado al perfil (o al evaluar cualificaciones).
- El frontend muestra un `<select>` con las mismas opciones del catálogo.

### 4. Compliance automático computado

Se agrega una propiedad/campo computado (no persistido) que indica si el empleado cumple:

```
cumple = PESO[situacion_actual] >= PESO[situacion_deseada]
```

Donde se computa:
- **Backend**: en el response de evaluación individual, se incluye un campo `cumple: bool` calculado.
- **Frontend**: al renderizar la tabla de cualificaciones del empleado, se muestra un badge "Cumple" (verde) o "No cumple" (rojo) sin permitir edición manual.
- No se persiste en BD — siempre se calcula en runtime.

### 5. Experiencia profesional: años + descripción

Para el tipo `experiencia_profesional` (presente en 93% de los perfiles), el patrón real de los datos es mixto:
- A veces son años: "5 años de experiencia"
- A veces son habilidades: "Conocimiento en el proceso de producción"
- A veces ambos

Se mantiene como **texto libre** por ahora (la variabilidad es demasiado alta para un catálogo cerrado). Se puede agregar un campo numérico opcional `anios_experiencia` en una iteración futura.

### 6. Tipos que permanecen como texto libre

Los siguientes tipos NO cambian su comportamiento actual (texto libre):
- `formacion_profesional` — 63% de presencia, 57% son "N/A"
- `ampliacion_formacion` — 56% de presencia, 70% son "N/A"
- `estudios_universitarios` — 58% de presencia, 62% son "N/A"
- `experiencia_profesional` — texto libre mixto (años + habilidades)
- `experiencia_direccion` — 56% de presencia, 72% son "N/A"
- `complementos` — texto largo multilinea (requisitos SST, NOMs)

### 7. Frontend: formulario condicional en modal de cualificaciones

En el modal `editarCualificacionesModal.ts`:
- Cuando el usuario selecciona tipo = "Estudios finalizados", el campo "Situación deseada" cambia de `<input type="text">` a un `<select>` con las opciones del catálogo de escolaridad.
- Para cualquier otro tipo, sigue siendo `<input type="text">`.

En la tabla de cualificaciones del empleado asignado:
- Para tipo `estudios_finalizados`: mostrar badge de compliance (verde/rojo) computado.
- Para otros tipos: mostrar `situacion_actual` como texto editable (comportamiento actual).

### Fuera de alcance

- Migración automática de datos existentes de texto libre a claves de catálogo (se puede hacer como script separado)
- Auto-compliance para experiencia profesional o dirección (requeriría parsing de texto o campo numérico adicional)
- Validación cruzada con otras fuentes (TRESS, etc.)
- Catálogo de competencias demostradas (ya se modela como CompetenciaRequisito con niveles 0-4)
- Historial de cambios en evaluaciones de cualificación

## Dependencias

- Modelo `PerfilCualificacion` en `app/models/talento.py` — agregar validación condicional
- Modelo `PerfilFuncionesCualificacion` en `app/models/talento.py` — agregar validación condicional
- Schema `perfil_funciones.py` — agregar validador para `estudios_finalizados`
- Constantes de catálogo: nuevo archivo `app/core/catalogos_cualificacion.py` con el enum de escolaridad
- Frontend `editarCualificacionesModal.ts` — form condicional (select vs input)
- Frontend tipos/constants — catálogo de escolaridad espejado en TypeScript
- Router/service de perfil_funciones — incluir `cumple` computado en responses

## Criterios de aceptación

- [ ] Catálogo de escolaridad definido como constante en backend (`app/core/catalogos_cualificacion.py`) y frontend
- [ ] Al crear/editar cualificación tipo `estudios_finalizados`, backend valida que `situacion_deseada` sea clave válida del catálogo
- [ ] Frontend muestra `<select>` para estudios finalizados y `<input text>` para los demás tipos
- [ ] Al capturar `situacion_actual` del empleado (tipo estudios_finalizados), se usa select del catálogo
- [ ] El response de evaluación individual incluye `cumple: bool` computado para `estudios_finalizados`
- [ ] En la vista del empleado, estudios finalizados muestra badge de compliance (verde si cumple, rojo si no)
- [ ] El badge NO es editable — es solo resultado de la comparación nivel actual >= nivel requerido
- [ ] Los demás tipos de cualificación siguen funcionando exactamente igual (texto libre)
- [ ] Tests unitarios para la función de compliance: "licenciatura" >= "secundaria" → true, "primaria" >= "preparatoria" → false
- [ ] Backwards compatible: perfiles existentes con texto libre en `estudios_finalizados` siguen mostrándose (como texto, sin badge)
