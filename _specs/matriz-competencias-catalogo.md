# Matriz de Competencias como Catálogo para Perfiles de Puesto

## Resumen

Las competencias requeridas en los perfiles de puesto deben provenir del catálogo centralizado de Matriz de Competencias (`tabla competencias`), en lugar de ser texto libre por perfil. Se debe poder crear nuevas competencias desde la pantalla dedicada de Matriz de Competencias y también inline desde el detalle del perfil de puesto.

## Motivación

Actualmente `PerfilCompetenciaRequerida` almacena categoría y descripción como texto libre sin relación al catálogo `Competencia`. Esto causa duplicación, inconsistencia en nombres, y hace imposible cruzar datos entre la matriz de competencias y los perfiles de puesto. Unificar el origen permite:
- Consistencia en nombres y categorías de competencias
- Reportes cruzados (gap analysis real entre evaluaciones y requisitos)
- Una sola fuente de verdad para la definición de cada competencia

## Alcance

### 1. Vincular competencias requeridas al catálogo

- Agregar campo `competencia_id` (FK a `competencias.id`) en `PerfilCompetenciaRequerida`
- Mantener `descripcion` y `categoria` como campos desnormalizados o eliminarlos en favor de la relación
- Migración que vincula registros existentes por coincidencia de texto (best-effort) o los deja como legacy
- Endpoint de competencias requeridas acepta `competencia_id` en lugar de texto libre

### 2. Pantalla dedicada de Matriz de Competencias (admin)

- Ya existe ruta `#/competencias` con la página `competencias.ts`
- Verificar que el CRUD completo funciona desde la UI (crear, editar, eliminar competencias del catálogo)
- Si falta funcionalidad de creación, agregarla
- Filtros por categoría (técnica/blanda) y por área
- Solo visible/editable para rol RH

### 3. Crear competencia inline desde detalle del perfil

- En el modal de "Editar competencias" (`editarCompetenciasModal.ts`), cambiar el formulario de texto libre a:
  - Selector/buscador de competencias existentes del catálogo
  - Botón "Crear nueva" que abre un mini-form para agregar al catálogo y seleccionarla inmediatamente
- Al seleccionar una competencia del catálogo, se crea la relación `PerfilCompetenciaRequerida` con el `competencia_id`

### Fuera de alcance

- Migración masiva de datos legacy (se hace best-effort o manual)
- Niveles requeridos por competencia en el perfil (ya existe en `CompetenciaRequisito`, no duplicar)
- Evaluaciones de competencias por empleado (módulo separado)
- Cambios en la vista de evaluaciones/gap analysis (se beneficia automáticamente del FK)

## Dependencias

- `GET /api/v1/competencias/` — ya existe (listar catálogo paginado con filtros)
- `POST /api/v1/competencias/` — ya existe (crear en catálogo, solo RH)
- `GET /api/v1/competencias/matriz` — ya existe (vista matriz por área)
- `POST /api/v1/perfiles/:id/competencias` — ya existe (necesita aceptar competencia_id)
- `DELETE /api/v1/perfiles/:id/competencias/:id` — ya existe
- Modelo `Competencia` en `app/models/talento.py` — ya existe
- Modelo `PerfilCompetenciaRequerida` en `app/models/talento.py` — requiere alteración (agregar FK)
- Página `frontend/src/pages/competencias.ts` — ya existe (verificar estado)
- Modal `frontend/src/components/puestos/editarCompetenciasModal.ts` — requiere refactor

## Criterios de aceptación

- [ ] `PerfilCompetenciaRequerida` tiene campo `competencia_id` (FK a `competencias`)
- [ ] Endpoint POST competencias requeridas acepta `competencia_id` y resuelve nombre/categoría del catálogo
- [ ] Modal de editar competencias en perfil muestra selector del catálogo (no texto libre)
- [ ] Desde el modal se puede crear una nueva competencia al catálogo sin salir del flujo
- [ ] Pantalla `#/competencias` permite CRUD completo del catálogo (crear, editar, eliminar)
- [ ] Solo rol RH puede crear/editar competencias en ambas pantallas
- [ ] Competencias existentes sin `competencia_id` siguen mostrándose (backwards compatible)
- [ ] Las tarjetas de detalle del perfil muestran el nombre de la competencia del catálogo
