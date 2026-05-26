# Competencias: Subcategoría en Un Solo Paso y Visualización en Matriz

## Resumen

Unificar el flujo de agregar competencias al perfil de puesto en un solo paso (seleccionar/crear + subcategoría juntos), eliminar el campo manual de "Orden", y mostrar la subcategoría como columna visible en la pantalla de Matriz de Competencias.

## Motivación

Actualmente, al agregar una competencia del catálogo al perfil de puesto se requieren dos pasos: primero buscar y seleccionar, luego elegir subcategoría y orden. Esto es innecesario y confuso. Además, la subcategoría asignada solo se ve en el contexto del perfil de puesto pero no en la pantalla de Matriz de Competencias, donde también debería ser visible. El campo de "Orden" es manual y ya fue resuelto con auto-incremento en tareas — debe aplicarse la misma lógica aquí.

## Alcance

### 1. Unificar selección + subcategoría en un solo paso

- Al buscar y seleccionar una competencia del catálogo, el selector de subcategoría debe mostrarse inline en la misma zona de búsqueda (no en un paso separado después de seleccionar)
- El botón de "Agregar" incluye tanto la competencia seleccionada como la subcategoría elegida
- Eliminar completamente el campo de "Orden" — se calcula automáticamente como `competencias.length + 1`

### 2. Crear competencia inline: incluir subcategoría en el form

- El mini-form de "Nueva competencia en catálogo" (nombre, descripción, grupo) debe incluir también el selector de subcategoría
- Al hacer clic en "Crear y seleccionar", se crea la competencia en el catálogo Y se asigna al perfil con la subcategoría elegida, todo en una sola acción
- No se necesita un segundo paso de confirmación

### 3. Subcategoría visible en Matriz de Competencias

- Agregar columna "Subcategoría" a la tabla del catálogo en la pantalla de Matriz de Competencias (`#/competencias`)
- El campo `subcategoria` debe guardarse en la tabla `competencias` del catálogo (nuevo campo)
- Al crear una competencia desde la pantalla de Matriz de Competencias (`+ Nueva competencia`), incluir el campo de subcategoría en el formulario de creación
- Al editar una competencia desde Matriz de Competencias, permitir cambiar la subcategoría

### 4. Filtrar competencias ya asignadas del buscador

- Al buscar competencias del catálogo, excluir las que ya están asignadas al perfil actual
- Esto previene duplicados (actualmente se permite agregar la misma competencia dos veces, como se ve con "SAP PM" duplicada)
- La validación debe ser tanto en frontend (filtrar resultados localmente) como en backend (rechazar duplicados con error 409 o similar)

### 5. Consistencia en creación desde ambas pantallas

- Crear competencia desde el modal de perfil de puesto → mismos campos y comportamiento que desde Matriz de Competencias (nombre, descripción, grupo, subcategoría)
- La subcategoría de la competencia en el catálogo se usa como default al asignarla a un perfil, pero puede sobreescribirse por perfil si es necesario

### Fuera de alcance

- Drag & drop para reordenar competencias (podría agregarse después, como en tareas)
- Migración de subcategorías existentes en `perfil_competencias_requeridas` al catálogo
- Cambios en evaluaciones o gap analysis

## Dependencias

- `tabla competencias` — requiere nuevo campo `subcategoria` (nullable)
- `POST /api/v1/competencias/` — requiere aceptar `subcategoria` en el body
- `PUT /api/v1/competencias/:id` — requiere aceptar `subcategoria` en el body
- `GET /api/v1/competencias/` — response debe incluir `subcategoria`
- `frontend/src/components/puestos/editarCompetenciasModal.ts` — refactor de flujo UX
- `frontend/src/pages/competencias.ts` — agregar columna y campo en forms
- `frontend/src/api/competencias.ts` — actualizar tipos
- `frontend/src/dashboard/competencias/types.ts` — agregar campo subcategoria al tipo

## Criterios de aceptación

- [ ] Al buscar una competencia del catálogo, el selector de subcategoría aparece junto al resultado seleccionado (mismo paso, no pantalla separada)
- [ ] No existe campo manual de "Orden" — se auto-calcula
- [ ] El form de "Nueva competencia en catálogo" incluye subcategoría como campo
- [ ] Al crear y seleccionar una competencia inline, se asigna al perfil con subcategoría en una sola acción
- [ ] La tabla de Matriz de Competencias muestra columna "Subcategoría"
- [ ] Crear/editar competencia desde Matriz de Competencias incluye campo subcategoría
- [ ] El campo `subcategoria` se persiste en la tabla `competencias` del backend
- [ ] Backwards compatible: competencias sin subcategoría se muestran sin error
- [ ] El buscador de catálogo no muestra competencias que ya están asignadas al perfil
- [ ] No se puede guardar una competencia duplicada en el mismo perfil (validación backend)
