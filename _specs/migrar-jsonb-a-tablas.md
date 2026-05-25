# Migrar Datos JSONB Existentes a Nuevas Tablas

> Feature slug: `migrar-jsonb-a-tablas`
> Branch: `claude/feature/migrar-jsonb-a-tablas`
> Date: 2026-05-25
> Status: Done
> Priority: Medium

---

## Problem Statement

La tabla `puestos_perfil` contiene tres columnas JSONB (`competencias_tecnicas`, `habilidades_blandas`, `maquinas_herramientas`) que almacenan datos no normalizados. Esto dificulta el reporting, las consultas SQL avanzadas, y la integridad referencial. Ya existen tablas normalizadas (`perfil_competencias_requeridas`, `perfil_cualificaciones`) creadas en el feature `perfil-funciones` que pueden albergar estos datos, pero la migración de los registros existentes aún no se ha ejecutado.

## Goals

- Extraer los datos de las 3 columnas JSONB y poblar las tablas normalizadas correspondientes
- Garantizar que no se pierda información durante la migración
- Validar que los datos migrados sean consultables desde los endpoints existentes
- Dejar las columnas JSONB vacías o marcadas como deprecated, listas para su eliminación posterior

## Non-Goals

- Eliminar las columnas JSONB de la tabla (eso es el item #16, se hará después de validar)
- Modificar los endpoints de lectura/escritura existentes (ya apuntan a tablas normalizadas)
- Migrar datos de otras tablas que no sean `puestos_perfil`
- Cambiar la estructura de las tablas destino

## User Stories

1. **Como RH**, quiero que las competencias técnicas que ya tenía capturadas en el sistema aparezcan en la nueva vista de competencias del perfil, sin tener que recargarlas manualmente.
2. **Como administrador de BD**, quiero que los datos JSONB existentes estén en tablas normalizadas para poder generar reportes SQL directos sin parsear JSON.
3. **Como desarrollador**, quiero que la migración sea reversible para poder hacer rollback si algo falla.

## Data Mapping

### Origen → Destino

| Columna JSONB | Tabla destino | Categoría/Tipo |
|---|---|---|
| `competencias_tecnicas` | `perfil_competencias_requeridas` | categoria: `profesional` |
| `habilidades_blandas` | `perfil_competencias_requeridas` | categoria: `social` |
| `maquinas_herramientas` | `perfil_competencias_requeridas` | categoria: `complementos` |

### Estructura esperada del JSONB

Cada columna JSONB contiene un array de objetos o strings que representan ítems individuales. La migración debe manejar ambos formatos:
- Array de strings: `["Excel avanzado", "SAP"]`
- Array de objetos: `[{"nombre": "Excel", "nivel": "avanzado"}]`

## Decisions

1. Mapear `competencias_tecnicas` → categoría `profesional`, `habilidades_blandas` → categoría `social`, `maquinas_herramientas` → categoría `complementos`
2. La migración se implementa como script Alembic (data migration) separado de schema migrations
3. Incluir rollback (downgrade) que restaure los datos JSONB desde las tablas normalizadas
4. Asignar `orden` secuencial (1, 2, 3...) basado en la posición en el array original
5. Si un registro JSONB es null o vacío, no crear filas destino

## Acceptance Criteria

- [ ] Todos los registros de `puestos_perfil` con datos JSONB no nulos tienen sus equivalentes en `perfil_competencias_requeridas`
- [ ] El conteo de ítems migrados coincide con el conteo de elementos en los arrays JSONB originales
- [ ] Los endpoints `GET /api/v1/perfiles/:id/competencias` devuelven los datos migrados correctamente
- [ ] La migración es idempotente (ejecutarla dos veces no duplica datos)
- [ ] Existe un downgrade funcional que restaura los datos JSONB
- [ ] Se incluye un test que valida la migración con datos de ejemplo

## Dependencies

- Feature `perfil-funciones` debe estar mergeado (tablas destino deben existir)
- Acceso a la base de datos de desarrollo con datos reales para validar

## Implementation

### Files Created
- `app/utils/jsonb_migration.py` — Lógica reutilizable: `extract_items()` y `CATEGORY_MAP`
- `alembic/versions/x1y2z3a4b5c6_migrar_jsonb_a_competencias_requeridas.py` — Data migration Alembic
- `tests/test_migrar_jsonb.py` — 12 tests (8 unit + 4 integration)

### How to Run
```bash
docker-compose exec backend alembic upgrade head
```

### Test Results
- 12/12 passed (0.48s)

## Risks

- Formatos JSONB inconsistentes entre registros (algunos pueden ser strings, otros arrays, otros null)
- Registros huérfanos si algún `puesto_perfil_id` fue eliminado pero el JSONB persiste
- Volumen de datos: verificar cuántos registros tienen datos JSONB antes de migrar
