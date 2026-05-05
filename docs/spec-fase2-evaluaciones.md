# Spec — Fase 2: Evaluaciones de Competencias

**Fecha**: 2026-05-05  
**Autor**: Alberto Flores  
**Estado**: PLANIFICADO  
**Dependencia**: Fase 1 (Puestos Perfil + Competencias + Matriz) — COMPLETADA

---

## 1. Objetivo

Registrar el nivel actual de cada empleado en cada competencia, permitiendo:
- Calcular brechas reales (nivel_requerido - nivel_actual) en vez del gap=100% hardcodeado.
- Cumplimiento % real por empleado, puesto y area.
- Identificar empleados que necesitan desarrollo en competencias especificas.

---

## 2. Modelo de Datos

### 2.1 Tabla `evaluaciones_competencia`

```sql
CREATE TABLE evaluaciones_competencia (
    id              SERIAL PRIMARY KEY,
    empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
    competencia_id  INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
    nivel_actual    INTEGER NOT NULL CHECK (nivel_actual >= 0 AND nivel_actual <= 4),
    evaluador_id    INTEGER REFERENCES empleados(id),
    observaciones   TEXT,
    fecha_evaluacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un empleado solo puede tener UNA evaluacion vigente por competencia
CREATE UNIQUE INDEX uq_evaluacion_vigente
    ON evaluaciones_competencia(empleado_id, competencia_id);
```

**Campos:**
| Campo | Tipo | Descripcion |
|---|---|---|
| empleado_id | FK empleados.id | Empleado evaluado |
| competencia_id | FK competencias.id | Competencia evaluada |
| nivel_actual | 0-4 | 0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto |
| evaluador_id | FK empleados.id (nullable) | Quien evalua (RH o supervisor) |
| observaciones | Text (nullable) | Comentarios opcionales |
| fecha_evaluacion | Timestamptz | Cuando se realizo la evaluacion |

### 2.2 SQLAlchemy Model

```python
# app/models/talento.py — agregar
class EvaluacionCompetencia(Base):
    __tablename__ = "evaluaciones_competencia"
    __table_args__ = (
        UniqueConstraint("empleado_id", "competencia_id", name="uq_evaluacion_vigente"),
        CheckConstraint("nivel_actual >= 0 AND nivel_actual <= 4", name="ck_nivel_actual_rango"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("competencias.id", ondelete="CASCADE"), nullable=False
    )
    nivel_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    evaluador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_evaluacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    competencia: Mapped["Competencia"] = relationship("Competencia")
    evaluador: Mapped[Optional["Empleado"]] = relationship("Empleado", foreign_keys=[evaluador_id])
```

---

## 3. API Endpoints

### 3.1 Router: `/api/v1/evaluaciones`

| Metodo | Path | Rol | Descripcion |
|---|---|---|---|
| GET | `/api/v1/evaluaciones` | auth | Listar evaluaciones (filtros: empleado_id, competencia_id, area_id) |
| POST | `/api/v1/evaluaciones` | rh, supervisor | Crear/actualizar evaluacion de un empleado |
| GET | `/api/v1/evaluaciones/{id}` | auth | Detalle de evaluacion |
| PUT | `/api/v1/evaluaciones/{id}` | rh, supervisor | Actualizar nivel/observaciones |
| DELETE | `/api/v1/evaluaciones/{id}` | rh | Eliminar evaluacion |
| GET | `/api/v1/evaluaciones/empleado/{empleado_id}` | auth* | Todas las evaluaciones de un empleado |
| POST | `/api/v1/evaluaciones/bulk` | rh | Evaluar multiples empleados/competencias en batch |

*auth: cualquier usuario autenticado puede ver sus propias evaluaciones; RH/supervisor ven las de su area.

### 3.2 Schemas Pydantic

```python
# app/schemas/evaluaciones.py

class EvaluacionCreate(BaseModel):
    empleado_id: int
    competencia_id: int
    nivel_actual: int = Field(..., ge=0, le=4)
    observaciones: Optional[str] = None

class EvaluacionUpdate(BaseModel):
    nivel_actual: Optional[int] = Field(None, ge=0, le=4)
    observaciones: Optional[str] = None

class EvaluacionResponse(BaseModel):
    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    competencia_id: int
    competencia_nombre: Optional[str] = None
    nivel_actual: int
    evaluador_id: Optional[int] = None
    evaluador_nombre: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_evaluacion: datetime
    created_at: datetime
    updated_at: datetime

class EvaluacionListResponse(BaseModel):
    items: list[EvaluacionResponse]
    total: int
    page: int
    page_size: int

class EvaluacionBulkCreate(BaseModel):
    evaluaciones: list[EvaluacionCreate]

class EmpleadoCompetenciaResumen(BaseModel):
    competencia_id: int
    competencia_nombre: str
    categoria: str
    nivel_requerido: int  # del puesto del empleado
    nivel_actual: int     # de la evaluacion (0 si no existe)
    gap: int              # nivel_requerido - nivel_actual (min 0)
```

---

## 4. Logica de Negocio

### 4.1 Crear/actualizar evaluacion (upsert)
- Si ya existe evaluacion para (empleado_id, competencia_id), se actualiza el nivel.
- Se registra evaluador_id del usuario que ejecuta la accion.
- Supervisor solo puede evaluar empleados de su area.

### 4.2 Brechas reales (refactorizar `obtener_brechas`)
Actualmente `competencia_service.py:458` asume gap=100% para todos. Con evaluaciones:

```python
# Para cada competencia requerida en el area:
# 1. Obtener empleados del area que estan en puestos que la requieren
# 2. Para cada empleado, buscar su evaluacion en esa competencia
# 3. Si no tiene evaluacion → gap = nivel_requerido (asume nivel_actual=0)
# 4. Si tiene evaluacion → gap = max(0, nivel_requerido - nivel_actual)
# 5. empleados_afectados = empleados con gap > 0
# 6. gap_porcentaje = (empleados_afectados / total_empleados) * 100
```

### 4.3 Cumplimiento real (refactorizar `resumen_area`)
Actualmente mide "completitud de definicion". Con evaluaciones:

```python
# cumplimiento = promedio de (nivel_actual / nivel_requerido) para todas
# las combinaciones empleado×competencia donde existe un requisito.
# Si no hay evaluacion, se cuenta como 0.
# Resultado: 0-100%
```

### 4.4 Permisos
| Accion | Roles |
|---|---|
| Ver propias evaluaciones | cualquier empleado |
| Ver evaluaciones del area | supervisor, rh |
| Ver todas las evaluaciones | rh |
| Crear/editar evaluacion | rh (cualquiera), supervisor (solo su area) |
| Eliminar evaluacion | rh |
| Bulk evaluacion | rh |

---

## 5. Frontend

### 5.1 Pagina: Evaluaciones (`/talento/evaluaciones`)

Vista tabla con:
- Filtros: area, empleado, competencia, rango de nivel
- Columnas: empleado, competencia, nivel_actual (badge con color), evaluador, fecha
- Accion: "Evaluar" abre modal

### 5.2 Modal de Evaluacion

- Select empleado (autocomplete por area)
- Select competencia (filtrado por area)
- Slider/select nivel 0-4 con labels (N/A, Basico, Intermedio, Avanzado, Experto)
- Textarea observaciones
- Boton guardar / cancelar

### 5.3 Vista Empleado (`/talento/evaluaciones/empleado/{id}`)

Radar chart o tabla mostrando:
- Competencias requeridas para su puesto vs nivel actual
- Gaps resaltados en rojo
- Cumplimiento % individual

### 5.4 Integracion con paginas existentes

- **Matriz de competencias**: agregar indicador visual de cobertura (cuantos empleados evaluados vs total)
- **Brechas**: mostrar gaps reales en vez de 100%
- **Resumen area**: cumplimiento % basado en evaluaciones reales

---

## 6. Migracion Alembic

```python
# alembic/versions/xxxx_fase2_evaluaciones_competencia.py
"""Fase 2: tabla evaluaciones_competencia"""

def upgrade():
    op.create_table(
        "evaluaciones_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("nivel_actual", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evaluador_id", sa.Integer(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("fecha_evaluacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.ForeignKeyConstraint(["competencia_id"], ["competencias.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evaluador_id"], ["empleados.id"]),
        sa.CheckConstraint("nivel_actual >= 0 AND nivel_actual <= 4", name="ck_nivel_actual_rango"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_evaluacion_vigente",
        "evaluaciones_competencia",
        ["empleado_id", "competencia_id"],
        unique=True,
    )

def downgrade():
    op.drop_table("evaluaciones_competencia")
```

---

## 7. Tests

### 7.1 Backend (pytest)

| # | Test | Verifica |
|---|---|---|
| 1 | test_crear_evaluacion_rh | RH crea evaluacion → 201, campos correctos |
| 2 | test_crear_evaluacion_supervisor_su_area | Supervisor evalua empleado de su area → 201 |
| 3 | test_crear_evaluacion_supervisor_otra_area | Supervisor evalua empleado otra area → 403 |
| 4 | test_crear_evaluacion_empleado_sin_permiso | Empleado no puede crear → 403 |
| 5 | test_upsert_evaluacion | Crear dos veces misma combinacion → actualiza, no duplica |
| 6 | test_nivel_fuera_rango | nivel=5 → 422 |
| 7 | test_listar_evaluaciones_filtros | Filtrar por area, empleado, competencia |
| 8 | test_ver_propias_evaluaciones | Empleado ve solo las suyas |
| 9 | test_bulk_evaluacion | POST /bulk con 5 evaluaciones → 5 creadas |
| 10 | test_brechas_con_evaluaciones | Crear requisito nivel 3, evaluar nivel 1 → gap=2 |
| 11 | test_cumplimiento_con_evaluaciones | Evaluar todos al nivel requerido → 100% |
| 12 | test_eliminar_evaluacion | DELETE → 204, ya no aparece |

### 7.2 Frontend (manual/E2E)

| # | Paso | Esperado |
|---|---|---|
| 1 | Navegar a /talento/evaluaciones | Tabla vacia con filtros visibles |
| 2 | Click "Evaluar" | Modal abre con campos vacios |
| 3 | Llenar y guardar | Evaluacion aparece en tabla |
| 4 | Ir a brechas del area | Gap refleja el nivel evaluado vs requerido |
| 5 | Ir a resumen del area | Cumplimiento % ya no es "definicion" sino real |

---

## 8. Plan de Implementacion

| Paso | Archivo(s) | Descripcion |
|---|---|---|
| 1 | `app/models/talento.py` | Agregar clase EvaluacionCompetencia |
| 2 | `alembic/versions/xxxx_...` | Migracion para crear tabla |
| 3 | `app/schemas/evaluaciones.py` | Schemas Pydantic (create, update, response, bulk) |
| 4 | `app/repositories/evaluacion_repository.py` | CRUD + queries por empleado/area/competencia |
| 5 | `app/services/evaluacion_service.py` | Logica: upsert, permisos, bulk |
| 6 | `app/api/v1/evaluaciones/router.py` | 7 endpoints |
| 7 | `app/services/competencia_service.py` | Refactorizar `resumen_area` y `obtener_brechas` |
| 8 | `frontend/src/api/evaluaciones.ts` | API client |
| 9 | `frontend/src/pages/evaluaciones.ts` | Pagina + modal |
| 10 | `frontend/src/shellRouter.ts` + nav | Registrar ruta |
| 11 | `tests/test_evaluaciones.py` | 12 tests backend |
| 12 | `openapi.yaml` | Documentar endpoints nuevos |

---

## 9. Criterios de Aceptacion

- [ ] RH puede evaluar cualquier empleado en cualquier competencia (nivel 0-4)
- [ ] Supervisor puede evaluar solo empleados de su area
- [ ] Empleado puede ver sus propias evaluaciones
- [ ] Brechas del area reflejan gaps reales (nivel_requerido - nivel_actual)
- [ ] Cumplimiento % del area se calcula con evaluaciones (no con "definicion")
- [ ] Bulk evaluation permite evaluar multiples empleados de golpe
- [ ] Una evaluacion por (empleado, competencia) — upsert semantics
- [ ] 12/12 tests backend pasan
- [ ] Frontend funcional con tabla, filtros, modal y permisos
