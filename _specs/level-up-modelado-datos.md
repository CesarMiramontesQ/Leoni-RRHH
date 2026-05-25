# Level Up — Modelado de Datos (Fase B0)

## Resumen

Crear los modelos SQLAlchemy, migraciones Alembic y seed de datos para todas las entidades nuevas requeridas por el módulo Level Up. Este es el prerrequisito para todo el Track B (funcionalidad real).

## Motivación

El Track A (demo) está completo con datos hardcodeados. Para conectar las 12 pantallas a datos reales, necesitamos primero el esquema de base de datos con todas las entidades, relaciones y constraints.

## Entidades

Se implementarán una por una en este orden (por dependencias):

### 1. Capacidad
- Complementa el modelo `Competencia` existente
- Escala 1-5
- Campos: nombre, descripción, categoría, nivel_max
- Relación: muchos-a-muchos con `PerfilPuesto` (con nivel requerido)

### 2. Habilidad
- Tipos: técnica, blanda, operativa, crítica
- Escala 1-4
- Campos: nombre, descripción, tipo, nivel_max

### 3. EvaluacionCapacidad
- Relación: empleado × capacidad → nivel
- Campos: empleado_id, capacidad_id, nivel_actual, nivel_requerido, fecha_evaluacion, evaluador_id
- Extiende el sistema de evaluaciones existente

### 4. EvaluacionHabilidad
- Relación: empleado × habilidad → nivel
- Campos: empleado_id, habilidad_id, nivel_actual, fecha_evaluacion, evaluador_id

### 5. Curso
- Catálogo maestro separado de `Capacitacion`
- Campos: nombre, proveedor, duración_horas, cupo_max, instructor, categoría (técnico/calidad/seguridad/operativo/blanda), modalidad, sesiones_anio
- `Capacitacion.curso_id` FK nueva

### 6. OPL
- Campos: codigo, titulo, proceso, maquina, aprobador_id, estado_aprobacion, fecha_creacion
- Relación con versiones (1:N)

### 7. OPLVersion
- Campos: opl_id, version_num, archivo_url, cambios_descripcion, fecha, creado_por_id
- Nueva versión dispara reentrenamiento

### 8. Evidencia
- Campos: tipo (foto/documento/video/firma), archivo_url, capacitacion_id, empleado_id, estado (pendiente/validada/devuelta), fecha_subida, notas
- Relación con firmas (1:N)

### 9. EvidenciaFirma
- Multifirma por rol
- Campos: evidencia_id, firmante_id, rol_firma, estado (pendiente/firmada/rechazada), fecha_firma, comentario

### 10. EncuestaPostCurso
- Campos: capacitacion_id, empleado_id, score_general (1-5), score_instructor, score_contenido, score_aplicabilidad, comentario, fecha
- Se dispara automáticamente al completar capacitación

### 11. SugerenciaCapacitacion
- Campos: titulo, justificacion, brecha_pct, adopcion_sector_pct, capacidades_afectadas (JSONB), areas_afectadas (JSONB), personas_alcanzables, duracion_sugerida, inversion_estimada, proveedor_sugerido, prioridad (1-5), estado (activa/aprobada/pospuesta/descartada)

### 12. PlanDesarrollo
- Campos: empleado_id, titulo, fecha_inicio, fecha_fin_estimada, estado (activo/completado/cancelado)
- Relación con etapas (1:N)

### 13. PlanEtapa
- Campos: plan_id, orden, titulo, descripcion, tipo (curso/opl/evaluacion/proyecto), recurso_id, estado (pendiente/en_curso/completada), fecha_inicio, fecha_completado

## Entregables por entidad

Para cada entidad:
- Modelo SQLAlchemy en `app/models/`
- Migración Alembic
- Schema Pydantic en `app/schemas/`
- Datos seed en `app/utils/seed.py`

## Fuera de alcance

- Endpoints API (eso es Fase B1+)
- Cambios en frontend
- Lógica de negocio (algoritmos de sugerencia, disparos automáticos)

## Dependencias

- Modelos existentes: `Empleado`, `PerfilPuesto`, `Capacitacion`, `Competencia`
- PostgreSQL con soporte JSONB
- Alembic configurado y funcional

## Orden de implementación

```
Capacidad → Habilidad → EvaluacionCapacidad → EvaluacionHabilidad
→ Curso (+ FK en Capacitacion) → OPL → OPLVersion
→ Evidencia → EvidenciaFirma → EncuestaPostCurso
→ SugerenciaCapacitacion → PlanDesarrollo → PlanEtapa
```
