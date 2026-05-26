# Perfiles de Puesto — Editar, Asignar Empleados y Filtros

## Resumen

Agregar funcionalidad de edición de perfil desde el frontend (tareas, cualificaciones, competencias), asignación/desasignación de empleados desde la UI, y filtros en la vista de tarjetas. Actualmente el detalle del perfil es solo lectura y la asignación de empleados se hace solo via API directa.

## Motivacion

El módulo de Perfiles de Puesto tiene toda la infraestructura backend (CRUD perfiles, asignaciones, tareas, cualificaciones, competencias), pero la interfaz web no expone las acciones de escritura. RH necesita poder editar el contenido completo de un perfil y gestionar empleados sin recurrir a herramientas externas. Los filtros en tarjetas permiten encontrar perfiles rápidamente cuando hay muchos.

## Alcance

### 1. Editar perfil desde frontend

- Botón "Editar" en la vista de detalle del perfil (`#/puestos/:id`)
- Formulario inline o modal para editar campos base: nombre, área, nivel, descripción
- Secciones editables para:
  - **Tareas**: agregar, reordenar, eliminar tareas principales y complementarias
  - **Cualificaciones**: agregar/eliminar por tipo (estudios, experiencia, formación, etc.)
  - **Competencias requeridas**: agregar/eliminar por categoría con orden
- Guardar cambios via PUT existente + endpoints específicos de tareas/cualificaciones/competencias
- Confirmación antes de guardar (resumen de cambios)
- Solo visible para rol RH

### 2. Asignar/desasignar empleados desde UI

- En la vista de empleados del perfil (`#/puestos/:id/empleados`), agregar botón "+ Asignar empleado"
- Selector de empleado (buscar por nombre o número de empleado)
- Permitir desasignar empleado existente (con confirmación)
- Usar endpoints existentes: `POST /api/v1/perfiles/:id/asignaciones` y `DELETE /api/v1/perfiles/:id/asignaciones/:asignacion_id`
- Solo visible para rol RH

### 4. Filtros en vista tarjetas

- Agregar barra de filtros sobre el grid de tarjetas en `#/puestos`
- Filtros disponibles: área, nivel, búsqueda por nombre
- Usar el query existente del endpoint `GET /api/v1/puestos-perfil/resumen-tarjetas` (requiere agregar parámetros de filtro al endpoint)
- Mantener filtros al cambiar entre vista tarjetas y tabla

### Fuera de alcance

- Edición masiva (bulk) de perfiles
- Historial de cambios / audit log visual
- Aprobación de cambios por otro usuario
- Importar/exportar perfiles
- Editar asignaciones individuales (evaluaciones de cualificación/competencia del empleado)

## Dependencias

- `PUT /api/v1/puestos-perfil/:id` — ya existe (campos base)
- `POST/PUT/DELETE /api/v1/perfiles/:id/tareas` — ya existe
- `POST/PUT/DELETE /api/v1/perfiles/:id/cualificaciones` — ya existe
- `POST/PUT/DELETE /api/v1/perfiles/:id/competencias-requeridas` — ya existe
- `POST /api/v1/perfiles/:id/asignaciones` — ya existe
- `DELETE /api/v1/perfiles/:id/asignaciones/:id` — ya existe
- `GET /api/v1/puestos-perfil/resumen-tarjetas` — ya existe (necesita filtros)
- `GET /api/v1/empleados` — para selector de empleados (buscar)

## Criterios de aceptacion

- [ ] Botón "Editar" visible solo para RH en detalle del perfil
- [ ] Puede editar nombre, área, nivel, descripción y guardar
- [ ] Puede agregar/eliminar tareas, cualificaciones y competencias
- [ ] Versión del perfil se incrementa al guardar cambios
- [ ] Botón "+ Asignar empleado" en vista empleados (solo RH)
- [ ] Selector permite buscar empleados por nombre/número
- [ ] Puede desasignar empleado con confirmación
- [ ] Filtros en vista tarjetas: área, nivel, búsqueda
- [ ] Filtros se aplican en tiempo real (sin recargar página)
- [ ] Estado de filtros se mantiene al cambiar tarjetas ↔ tabla
- [ ] Empty state cuando filtros no retornan resultados
- [ ] Todas las acciones de escritura requieren rol RH (403 si no)
