# Empleados con Catálogos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el modelo `Empleado` para que adopte la estructura real de la BD del cliente, sincronizar 6 tablas de catálogo localmente, y eliminar el campo `activo` en favor de `estado_id`.

**Architecture:** Un único enfoque de reemplazo limpio: nueva migración Alembic que descarta la tabla `empleados` actual y crea las 6 tablas de catálogo + la tabla `empleados` con la estructura del cliente. El sync IT Mirror se extiende para leer catálogos antes de empleados. `estado_id` reemplaza `activo` en todas las capas.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.x async, Alembic 1.14, Pydantic v2, pytest + pytest-asyncio + aiosqlite

---

## File Map

| Archivo | Acción |
|---|---|
| `app/core/config.py` | Modificar — agregar `ESTADOS_ACTIVOS_IDS` |
| `app/models/catalogos.py` | Crear — 6 modelos de catálogo |
| `app/models/empleados.py` | Reemplazar — nuevo modelo `Empleado` |
| `app/models/__init__.py` | Modificar — importar catalogos |
| `alembic/versions/xxxx_empleados_catalogos.py` | Crear — migración manual |
| `app/schemas/empleados.py` | Reemplazar — schemas de catálogo + empleado |
| `app/schemas/usuarios.py` | Modificar — UsuarioResponse, UsuarioAsignacionUpdate, CatalogoFiltrosResponse |
| `app/repositories/empleado_repository.py` | Modificar — renombrar métodos, cambiar filtros |
| `app/repositories/usuario_repository.py` | Modificar — eliminar referencias a `activo`, `departamento`, `puesto`, `supervisor_id` |
| `app/repositories/base.py` | Modificar — `soft_delete` ya no usa `activo` en Empleado |
| `app/services/auth_service.py` | Modificar — verificación activo + payload token |
| `app/services/usuario_service.py` | Modificar — `activo`→`estado_id`, remover `desactivar_usuario`, `supervisor`→`lider` |
| `app/api/v1/usuarios/router.py` | Modificar — remover endpoint DELETE |
| `app/integrations/it_mirror.py` | Modificar — agregar sync de catálogos |
| `app/utils/seed.py` | Modificar — agregar seed de catálogos y empleados de prueba |
| `tests/conftest.py` | Modificar — actualizar `make_empleado` |
| `tests/test_auth.py` | Verificar — puede requerir ajustes |
| `tests/test_usuarios.py` | Modificar — actualizar assertions a nuevo schema |

---

## Task 1: Agregar ESTADOS_ACTIVOS_IDS a config

**Files:**
- Modify: `app/core/config.py`

- [ ] **Step 1: Escribir test que verifica que el setting carga correctamente**

```python
# tests/test_config.py
def test_estados_activos_ids_default():
    from app.core.config import settings
    assert isinstance(settings.ESTADOS_ACTIVOS_IDS, list)
    assert 1 in settings.ESTADOS_ACTIVOS_IDS
```

- [ ] **Step 2: Correr el test para ver que falla**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
pytest tests/test_config.py -v
```
Expected: `AttributeError: 'Settings' object has no attribute 'ESTADOS_ACTIVOS_IDS'`

- [ ] **Step 3: Agregar el campo en config.py**

En `app/core/config.py`, después de `IT_SYNC_INTERVAL_MINUTES`:

```python
    # Estados que se consideran "empleado activo" — ajustar en producción
    ESTADOS_ACTIVOS_IDS: List[int] = [1]

    @field_validator("ESTADOS_ACTIVOS_IDS", mode="before")
    @classmethod
    def parse_estados_activos(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return [1]
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v
```

- [ ] **Step 4: Correr el test**

```bash
pytest tests/test_config.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/core/config.py tests/test_config.py
git commit -m "feat: add ESTADOS_ACTIVOS_IDS setting for employee active state"
```

---

## Task 2: Crear modelos de catálogo

**Files:**
- Create: `app/models/catalogos.py`

- [ ] **Step 1: Escribir test de instanciación de los 6 modelos**

```python
# tests/test_catalogos_models.py
def test_area_instancia():
    from app.models.catalogos import Area
    a = Area(area_id=1, descripcion="Producción", estatus_id=1)
    assert a.area_id == 1

def test_subarea_instancia():
    from app.models.catalogos import Subarea
    s = Subarea(subarea_id=1, descripcion="Línea A", area_id=1, estatus_id=1)
    assert s.subarea_id == 1

def test_categoria_instancia():
    from app.models.catalogos import Categoria
    c = Categoria(categoria_id=1, descripcion="Operativo", estatus_id=1)
    assert c.categoria_id == 1

def test_puesto_instancia():
    from app.models.catalogos import Puesto
    p = Puesto(puesto_id=1, descripcion="Operador", estatus_id=1)
    assert p.puesto_id == 1

def test_estado_empleado_instancia():
    from app.models.catalogos import EstadoEmpleado
    e = EstadoEmpleado(estado_id=1, descripcion="Activo", estatus_id=1)
    assert e.estado_id == 1

def test_clasificacion_instancia():
    from app.models.catalogos import ClasificacionEmpleado
    cl = ClasificacionEmpleado(clasificacion_id=1, descripcion="Directo", estatus_id=1)
    assert cl.clasificacion_id == 1
```

- [ ] **Step 2: Correr para ver que falla**

```bash
pytest tests/test_catalogos_models.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.models.catalogos'`

- [ ] **Step 3: Crear `app/models/catalogos.py`**

```python
# app/models/catalogos.py
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class Area(Base):
    __tablename__ = "areas"

    area_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    subareas: Mapped[List["Subarea"]] = relationship("Subarea", back_populates="area")
    puestos: Mapped[List["Puesto"]] = relationship("Puesto", back_populates="area")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="area")


class Subarea(Base):
    __tablename__ = "subareas"

    subarea_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.area_id"), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    area: Mapped["Area"] = relationship("Area", back_populates="subareas")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="subarea")


class Categoria(Base):
    __tablename__ = "categorias"

    categoria_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nivel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bono_cat: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="categoria")


class Puesto(Base):
    __tablename__ = "puestos"

    puesto_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )

    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="puestos")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="puesto")


class EstadoEmpleado(Base):
    __tablename__ = "estados_empleados"

    estado_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="estado")


class ClasificacionEmpleado(Base):
    __tablename__ = "clasificacion_empleado"

    clasificacion_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)
    significado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    empleados: Mapped[List["Empleado"]] = relationship(
        "Empleado", back_populates="clasificacion"
    )
```

- [ ] **Step 4: Correr test**

```bash
pytest tests/test_catalogos_models.py -v
```
Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/catalogos.py tests/test_catalogos_models.py
git commit -m "feat: add catalog models (areas, subareas, categorias, puestos, estados_empleados, clasificacion_empleado)"
```

---

## Task 3: Reemplazar modelo Empleado

**Files:**
- Modify: `app/models/empleados.py`

- [ ] **Step 1: Reemplazar completamente `app/models/empleados.py`**

```python
# app/models/empleados.py
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.roles import Rol
    from app.models.solicitudes import Solicitud, SolicitudAprobacion
    from app.models.incidencias import Incidencia, Evidencia
    from app.models.actas import ActaAdministrativa, ActaAprobacion
    from app.models.comedor import ComedorRegistro
    from app.models.notificaciones import Notificacion
    from app.models.auditoria import AuditLog
    from app.models.catalogos import (
        Area, Subarea, Categoria, Puesto, EstadoEmpleado, ClasificacionEmpleado
    )


class Empleado(Base):
    __tablename__ = "empleados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    no_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    no_sap: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    usuario: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)

    # FKs a catálogos (sincronizadas desde cliente)
    categoria_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categorias.categoria_id"), nullable=True
    )
    subarea_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subareas.subarea_id"), nullable=True
    )
    puesto_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("puestos.puesto_id"), nullable=True
    )
    estado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("estados_empleados.estado_id"), nullable=True
    )
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    clasificacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clasificacion_empleado.clasificacion_id"), nullable=True
    )

    # Auto-referencia: líder directo
    lider_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )

    # Campos planos del cliente
    centrocosto_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    foto: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recibe_bono: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    brigada: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    registro: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    a_restringido: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    requiere_cambio_password: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    rol: Mapped["Rol"] = relationship("Rol", back_populates="empleados")
    categoria: Mapped[Optional["Categoria"]] = relationship(
        "Categoria", back_populates="empleados"
    )
    subarea: Mapped[Optional["Subarea"]] = relationship(
        "Subarea", back_populates="empleados"
    )
    puesto: Mapped[Optional["Puesto"]] = relationship(
        "Puesto", back_populates="empleados"
    )
    estado: Mapped[Optional["EstadoEmpleado"]] = relationship(
        "EstadoEmpleado", back_populates="empleados"
    )
    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="empleados")
    clasificacion: Mapped[Optional["ClasificacionEmpleado"]] = relationship(
        "ClasificacionEmpleado", back_populates="empleados"
    )
    lider: Mapped[Optional["Empleado"]] = relationship(
        "Empleado",
        remote_side="Empleado.id",
        foreign_keys=[lider_id],
        back_populates="subordinados",
    )
    subordinados: Mapped[List["Empleado"]] = relationship(
        "Empleado",
        foreign_keys=[lider_id],
        back_populates="lider",
    )

    def __repr__(self) -> str:
        return f"<Empleado id={self.id} no_empleado={self.no_empleado} nombre={self.nombre}>"
```

- [ ] **Step 2: Correr test de instanciación**

```python
# tests/test_empleado_model.py
def test_empleado_nuevo_schema():
    from app.models.empleados import Empleado
    e = Empleado(
        empleado_id=100,
        no_empleado="EMP-001",
        nombre="Juan Pérez",
        password_hash="hashed",
        rol_id=1,
        estado_id=1,
    )
    assert e.no_empleado == "EMP-001"
    assert not hasattr(e, "activo")
    assert not hasattr(e, "apellido")
    assert not hasattr(e, "num_empleado")
    assert hasattr(e, "estado_id")
    assert hasattr(e, "lider_id")
```

```bash
pytest tests/test_empleado_model.py -v
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/models/empleados.py tests/test_empleado_model.py
git commit -m "feat: replace Empleado model with client DB structure"
```

---

## Task 4: Actualizar models/__init__.py

**Files:**
- Modify: `app/models/__init__.py`

- [ ] **Step 1: Agregar imports de catalogos**

Reemplazar el contenido de `app/models/__init__.py`:

```python
# CRITICAL: All models must be imported here so Alembic autogenerate detects them.
from app.models.roles import Rol
from app.models.catalogos import (
    Area,
    Subarea,
    Categoria,
    Puesto,
    EstadoEmpleado,
    ClasificacionEmpleado,
)
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.models.incidencias import Incidencia, Evidencia
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.comedor import Comedor, MenuSemanal, ComedorRegistro
from app.models.notificaciones import Notificacion
from app.models.auditoria import AuditLog, ItSyncLog, TokenBlacklist
from app.models.tress import TressRobotQueue

__all__ = [
    "Rol",
    "Area",
    "Subarea",
    "Categoria",
    "Puesto",
    "EstadoEmpleado",
    "ClasificacionEmpleado",
    "Empleado",
    "Solicitud",
    "SolicitudAprobacion",
    "Incidencia",
    "Evidencia",
    "ActaAdministrativa",
    "ActaAprobacion",
    "Comedor",
    "MenuSemanal",
    "ComedorRegistro",
    "Notificacion",
    "AuditLog",
    "ItSyncLog",
    "TokenBlacklist",
    "TressRobotQueue",
]
```

- [ ] **Step 2: Verificar que los imports no rompen nada**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
python -c "import app.models; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/models/__init__.py
git commit -m "feat: register catalog models in models/__init__.py"
```

---

## Task 5: Crear migración Alembic

**Files:**
- Create: `alembic/versions/<rev>_empleados_catalogos.py`

- [ ] **Step 1: Generar la revisión base**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
alembic revision -m "empleados_catalogos"
```

Anota el ID generado (p.ej. `abc123def456`). Abre el archivo generado en `alembic/versions/`.

- [ ] **Step 2: Escribir el upgrade manualmente**

Reemplaza el cuerpo de `upgrade()` con:

```python
def upgrade() -> None:
    # 1. Drop FKs de tablas dependientes que apuntan a empleados.id
    op.drop_constraint("audit_log_usuario_id_fkey", "audit_log", type_="foreignkey")
    op.drop_constraint("comedor_registros_empleado_id_fkey", "comedor_registros", type_="foreignkey")
    op.drop_constraint("evidencias_subido_por_fkey", "evidencias", type_="foreignkey")
    op.drop_constraint("incidencias_empleado_id_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("incidencias_registrado_por_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("menu_semanal_created_by_fkey", "menu_semanal", type_="foreignkey")
    op.drop_constraint("notificaciones_destinatario_id_fkey", "notificaciones", type_="foreignkey")
    op.drop_constraint("solicitudes_empleado_id_fkey", "solicitudes", type_="foreignkey")
    op.drop_constraint("solicitud_aprobaciones_aprobador_id_fkey", "solicitud_aprobaciones", type_="foreignkey")
    op.drop_constraint("actas_administrativas_empleado_id_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("actas_administrativas_generado_por_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("acta_aprobaciones_firmante_id_fkey", "acta_aprobaciones", type_="foreignkey")

    # 2. Drop tabla empleados vieja
    op.drop_table("empleados")

    # 3. Crear catálogos (orden respeta FKs)
    op.create_table(
        "areas",
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("area_id"),
    )
    op.create_table(
        "categorias",
        sa.Column("categoria_id", sa.Integer(), nullable=False),
        sa.Column("nivel", sa.String(length=50), nullable=True),
        sa.Column("bono_cat", sa.Numeric(10, 2), nullable=True),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("categoria_id"),
    )
    op.create_table(
        "subareas",
        sa.Column("subarea_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.PrimaryKeyConstraint("subarea_id"),
    )
    op.create_table(
        "puestos",
        sa.Column("puesto_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.PrimaryKeyConstraint("puesto_id"),
    )
    op.create_table(
        "estados_empleados",
        sa.Column("estado_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("estado_id"),
    )
    op.create_table(
        "clasificacion_empleado",
        sa.Column("clasificacion_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.Column("significado", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("clasificacion_id"),
    )

    # 4. Crear nueva tabla empleados
    op.create_table(
        "empleados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("no_empleado", sa.String(length=50), nullable=False),
        sa.Column("no_sap", sa.String(length=50), nullable=True),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("usuario", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=True),
        sa.Column("subarea_id", sa.Integer(), nullable=True),
        sa.Column("puesto_id", sa.Integer(), nullable=True),
        sa.Column("estado_id", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("clasificacion_id", sa.Integer(), nullable=True),
        sa.Column("lider_id", sa.Integer(), nullable=True),
        sa.Column("centrocosto_id", sa.Integer(), nullable=True),
        sa.Column("foto", sa.String(length=500), nullable=True),
        sa.Column("recibe_bono", sa.Boolean(), nullable=True),
        sa.Column("brigada", sa.String(length=100), nullable=True),
        sa.Column("registro", sa.Date(), nullable=True),
        sa.Column("a_restringido", sa.Boolean(), nullable=True),
        sa.Column("requiere_cambio_password", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.categoria_id"]),
        sa.ForeignKeyConstraint(["subarea_id"], ["subareas.subarea_id"]),
        sa.ForeignKeyConstraint(["puesto_id"], ["puestos.puesto_id"]),
        sa.ForeignKeyConstraint(["estado_id"], ["estados_empleados.estado_id"]),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["clasificacion_id"], ["clasificacion_empleado.clasificacion_id"]),
        sa.ForeignKeyConstraint(["lider_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empleado_id"),
        sa.UniqueConstraint("no_empleado"),
        sa.UniqueConstraint("email"),
    )

    # 5. Recrear FKs de tablas dependientes
    op.create_foreign_key(None, "audit_log", "empleados", ["usuario_id"], ["id"])
    op.create_foreign_key(None, "comedor_registros", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "evidencias", "empleados", ["subido_por"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["registrado_por"], ["id"])
    op.create_foreign_key(None, "menu_semanal", "empleados", ["created_by"], ["id"])
    op.create_foreign_key(None, "notificaciones", "empleados", ["destinatario_id"], ["id"])
    op.create_foreign_key(None, "solicitudes", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "solicitud_aprobaciones", "empleados", ["aprobador_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["generado_por"], ["id"])
    op.create_foreign_key(None, "acta_aprobaciones", "empleados", ["firmante_id"], ["id"])
```

- [ ] **Step 3: Escribir el downgrade**

```python
def downgrade() -> None:
    # Drop FKs recreadas
    op.drop_constraint("audit_log_usuario_id_fkey", "audit_log", type_="foreignkey")
    op.drop_constraint("comedor_registros_empleado_id_fkey", "comedor_registros", type_="foreignkey")
    op.drop_constraint("evidencias_subido_por_fkey", "evidencias", type_="foreignkey")
    op.drop_constraint("incidencias_empleado_id_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("incidencias_registrado_por_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("menu_semanal_created_by_fkey", "menu_semanal", type_="foreignkey")
    op.drop_constraint("notificaciones_destinatario_id_fkey", "notificaciones", type_="foreignkey")
    op.drop_constraint("solicitudes_empleado_id_fkey", "solicitudes", type_="foreignkey")
    op.drop_constraint("solicitud_aprobaciones_aprobador_id_fkey", "solicitud_aprobaciones", type_="foreignkey")
    op.drop_constraint("actas_administrativas_empleado_id_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("actas_administrativas_generado_por_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("acta_aprobaciones_firmante_id_fkey", "acta_aprobaciones", type_="foreignkey")

    op.drop_table("empleados")
    op.drop_table("clasificacion_empleado")
    op.drop_table("estados_empleados")
    op.drop_table("puestos")
    op.drop_table("subareas")
    op.drop_table("categorias")
    op.drop_table("areas")

    # Recrear empleados original
    op.create_table(
        "empleados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("num_empleado", sa.String(length=50), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("apellido", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("departamento", sa.String(length=150), nullable=True),
        sa.Column("puesto", sa.String(length=150), nullable=True),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("supervisor_id", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("fecha_ingreso", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["supervisor_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("num_empleado"),
    )
    op.create_foreign_key(None, "audit_log", "empleados", ["usuario_id"], ["id"])
    op.create_foreign_key(None, "comedor_registros", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "evidencias", "empleados", ["subido_por"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["registrado_por"], ["id"])
    op.create_foreign_key(None, "menu_semanal", "empleados", ["created_by"], ["id"])
    op.create_foreign_key(None, "notificaciones", "empleados", ["destinatario_id"], ["id"])
    op.create_foreign_key(None, "solicitudes", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "solicitud_aprobaciones", "empleados", ["aprobador_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["generado_por"], ["id"])
    op.create_foreign_key(None, "acta_aprobaciones", "empleados", ["firmante_id"], ["id"])
```

- [ ] **Step 4: Asegúrate que el archivo tenga `import sqlalchemy as sa` y `from alembic import op` en las importaciones**

- [ ] **Step 5: Aplicar la migración (requiere Docker corriendo)**

```bash
docker-compose up -d
alembic upgrade head
```
Expected: migración aplicada sin errores.

- [ ] **Step 6: Commit**

```bash
git add alembic/versions/
git commit -m "feat: migration — add catalog tables and replace empleados schema"
```

---

## Task 6: Reemplazar schemas de empleados y usuarios

**Files:**
- Modify: `app/schemas/empleados.py`
- Modify: `app/schemas/usuarios.py`

- [ ] **Step 1: Reemplazar `app/schemas/empleados.py`**

```python
# app/schemas/empleados.py
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class CatalogoSimpleResponse(BaseModel):
    model_config = {"from_attributes": True}
    descripcion: str
    estatus_id: int


class AreaResponse(CatalogoSimpleResponse):
    area_id: int


class SubareaResponse(CatalogoSimpleResponse):
    subarea_id: int
    area_id: int


class CategoriaResponse(CatalogoSimpleResponse):
    categoria_id: int
    nivel: Optional[str] = None


class PuestoResponse(CatalogoSimpleResponse):
    puesto_id: int
    area_id: Optional[int] = None


class EstadoEmpleadoResponse(CatalogoSimpleResponse):
    estado_id: int


class ClasificacionEmpleadoResponse(CatalogoSimpleResponse):
    clasificacion_id: int
    significado: Optional[str] = None


class EmpleadoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    no_empleado: str
    no_sap: Optional[str] = None
    nombre: str
    email: Optional[str] = None
    usuario: Optional[str] = None
    rol_id: int
    categoria: Optional[CategoriaResponse] = None
    subarea: Optional[SubareaResponse] = None
    puesto: Optional[PuestoResponse] = None
    estado: Optional[EstadoEmpleadoResponse] = None
    area: Optional[AreaResponse] = None
    clasificacion: Optional[ClasificacionEmpleadoResponse] = None
    lider_id: Optional[int] = None
    centrocosto_id: Optional[int] = None
    recibe_bono: Optional[bool] = None
    brigada: Optional[str] = None
    registro: Optional[date] = None
    a_restringido: Optional[bool] = None
    requiere_cambio_password: Optional[bool] = None
    created_at: datetime
```

- [ ] **Step 2: Actualizar `app/schemas/usuarios.py`**

```python
# app/schemas/usuarios.py
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.empleados import (
    AreaResponse,
    CategoriaResponse,
    ClasificacionEmpleadoResponse,
    EstadoEmpleadoResponse,
    PuestoResponse,
    SubareaResponse,
)


class UsuarioAsignacionUpdate(BaseModel):
    """Solo RH puede usar este schema. Permite cambiar únicamente lider_id y rol_id."""
    model_config = {"str_strip_whitespace": True}
    lider_id: Optional[int] = None
    rol_id: Optional[int] = None


class RolBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    nombre: str


class UsuarioResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    no_empleado: str
    nombre: str
    email: Optional[str] = None
    rol_id: int
    rol: Optional[RolBrief] = None
    estado: Optional[EstadoEmpleadoResponse] = None
    area: Optional[AreaResponse] = None
    subarea: Optional[SubareaResponse] = None
    puesto: Optional[PuestoResponse] = None
    categoria: Optional[CategoriaResponse] = None
    clasificacion: Optional[ClasificacionEmpleadoResponse] = None
    lider_id: Optional[int] = None
    registro: Optional[date] = None
    created_at: datetime


class UsuarioListItem(UsuarioResponse):
    """Fila de listado RH con nombre del líder resuelto."""
    lider_nombre: Optional[str] = None


class UsuarioPageResponse(BaseModel):
    items: list[UsuarioListItem]
    total: int
    page: int
    page_size: int


class UsuarioResumenResponse(BaseModel):
    total_plantilla: int
    activos: int
    capacitacion_pendiente: int
    practicantes: int
    porcentaje_operatividad: float


class CatalogoFiltrosResponse(BaseModel):
    areas: list[AreaResponse]
    puestos: list[PuestoResponse]


class SolicitudBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    estado: str
    fecha_inicio: date
    fecha_fin: date
    created_at: datetime


class IncidenciaBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    estado: str
    created_at: datetime


class ActaBrief(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    estado: str
    created_at: datetime


class UsuarioVista360Response(BaseModel):
    model_config = {"from_attributes": True}
    usuario: UsuarioResponse
    solicitudes_recientes: list[SolicitudBrief]
    incidencias_activas: list[IncidenciaBrief]
    actas_firmadas: list[ActaBrief]
    saldo_vacaciones: int


class MetricasUsuarioResponse(BaseModel):
    solicitudes_por_estado: dict[str, int]
    incidencias_por_tipo: dict[str, int]
    dias_antiguedad: int
    total_actas: int
```

- [ ] **Step 3: Verificar imports**

```bash
python -c "from app.schemas.empleados import EmpleadoResponse; from app.schemas.usuarios import UsuarioResponse; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add app/schemas/empleados.py app/schemas/usuarios.py
git commit -m "feat: update empleado and usuario schemas for new model structure"
```

---

## Task 7: Actualizar EmpleadoRepository y UsuarioRepository

**Files:**
- Modify: `app/repositories/empleado_repository.py`
- Modify: `app/repositories/usuario_repository.py`

- [ ] **Step 1: Reemplazar `app/repositories/empleado_repository.py`**

```python
# app/repositories/empleado_repository.py
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.repositories.base import BaseRepository


class EmpleadoRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_by_email(self, email: str) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_no_empleado(self, no_empleado: str) -> Empleado | None:
        # No filtra por estado — sync necesita encontrar empleados inactivos para no duplicar
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.no_empleado == no_empleado)
        )
        return result.scalar_one_or_none()

    async def get_by_empleado_id(self, empleado_id: int) -> Empleado | None:
        """Usado por el sync para resolución de lider_id (FK del cliente → id local)."""
        result = await self.db.execute(
            select(Empleado).where(Empleado.empleado_id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    async def get_subordinados(self, lider_id: int, estados_activos: list[int]) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado).where(
                Empleado.lider_id == lider_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())
```

- [ ] **Step 2: Reemplazar `app/repositories/usuario_repository.py`**

```python
# app/repositories/usuario_repository.py
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.models.catalogos import Area, Puesto
from app.repositories.base import BaseRepository


class UsuarioRepository(BaseRepository[Empleado]):
    def __init__(self, db: AsyncSession):
        super().__init__(Empleado, db)

    async def get_with_rol(self, id: int) -> Empleado | None:
        result = await self.db.execute(
            select(Empleado)
            .options(
                selectinload(Empleado.rol),
                selectinload(Empleado.estado),
                selectinload(Empleado.area),
                selectinload(Empleado.puesto),
                selectinload(Empleado.subarea),
                selectinload(Empleado.categoria),
                selectinload(Empleado.clasificacion),
            )
            .where(Empleado.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _list_filters(
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        estados_activos: list[int] | None,
        solo_activos: bool,
    ) -> list:
        conditions: list = []
        if solo_activos and estados_activos:
            conditions.append(Empleado.estado_id.in_(estados_activos))
        if area_id is not None:
            conditions.append(Empleado.area_id == area_id)
        if puesto_id is not None:
            conditions.append(Empleado.puesto_id == puesto_id)
        if q and q.strip():
            term = f"%{q.strip()}%"
            conditions.append(
                or_(
                    Empleado.nombre.ilike(term),
                    Empleado.no_empleado.ilike(term),
                    Empleado.email.ilike(term),
                )
            )
        return conditions

    async def list_page(
        self,
        offset: int,
        limit: int,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        estados_activos: list[int] | None,
        solo_activos: bool = False,
    ) -> list[Empleado]:
        conditions = self._list_filters(q, area_id, puesto_id, estados_activos, solo_activos)
        query = select(Empleado).options(
            selectinload(Empleado.rol),
            selectinload(Empleado.lider),
            selectinload(Empleado.estado),
            selectinload(Empleado.area),
            selectinload(Empleado.puesto),
        )
        for cond in conditions:
            query = query.where(cond)
        query = query.order_by(Empleado.id).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        estados_activos: list[int] | None,
        solo_activos: bool = False,
    ) -> int:
        conditions = self._list_filters(q, area_id, puesto_id, estados_activos, solo_activos)
        query = select(func.count()).select_from(Empleado)
        for cond in conditions:
            query = query.where(cond)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_subordinados(self, lider_id: int, estados_activos: list[int]) -> list[Empleado]:
        result = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.rol))
            .where(
                Empleado.lider_id == lider_id,
                Empleado.estado_id.in_(estados_activos),
            )
        )
        return list(result.scalars().all())

    async def list_areas_activas(self) -> list[Area]:
        result = await self.db.execute(
            select(Area).where(Area.estatus_id == 1).order_by(Area.descripcion)
        )
        return list(result.scalars().all())

    async def list_puestos_activos(self) -> list[Puesto]:
        result = await self.db.execute(
            select(Puesto).where(Puesto.estatus_id == 1).order_by(Puesto.descripcion)
        )
        return list(result.scalars().all())

    async def count_activos(self, estados_activos: list[int]) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(Empleado.estado_id.in_(estados_activos))
        )
        return result.scalar_one()
```

- [ ] **Step 3: Verificar imports**

```bash
python -c "from app.repositories.empleado_repository import EmpleadoRepository; from app.repositories.usuario_repository import UsuarioRepository; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add app/repositories/empleado_repository.py app/repositories/usuario_repository.py
git commit -m "feat: update EmpleadoRepository and UsuarioRepository for new schema"
```

---

## Task 8: Actualizar auth_service y usuario_service

**Files:**
- Modify: `app/services/auth_service.py`
- Modify: `app/services/usuario_service.py`
- Modify: `app/api/v1/usuarios/router.py`

- [ ] **Step 1: Reemplazar `app/services/auth_service.py`**

```python
# app/services/auth_service.py
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.auditoria import TokenBlacklist
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository


async def authenticate_user(
    email: str, password: str, db: AsyncSession
) -> Empleado:
    repo = EmpleadoRepository(db)
    empleado = await repo.get_by_email(email)

    if not empleado or not verify_password(password, empleado.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if empleado.estado_id not in settings.ESTADOS_ACTIVOS_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empleado inactivo",
        )
    return empleado


def create_tokens(empleado: Empleado) -> dict:
    rol_nombre = empleado.rol.nombre if empleado.rol else "empleado"
    payload = {
        "sub": str(empleado.id),
        "rol": rol_nombre,
        "num": empleado.no_empleado,
        "nombre": empleado.nombre,
    }
    return {
        "access_token": create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
        "token_type": "bearer",
    }


async def revoke_token(jti: str, expires_at: datetime, db: AsyncSession) -> None:
    blacklist_entry = TokenBlacklist(jti=jti, expires_at=expires_at)
    db.add(blacklist_entry)
    await db.flush()


async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    from sqlalchemy import select
    result = await db.execute(
        select(TokenBlacklist).where(TokenBlacklist.jti == jti)
    )
    return result.scalar_one_or_none() is not None


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> dict:
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de tipo incorrecto — se requiere refresh token",
        )

    jti = payload.get("jti", "")
    if await is_token_revoked(jti, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado",
        )

    new_payload = {
        "sub": payload["sub"],
        "rol": payload.get("rol", "empleado"),
        "num": payload.get("num", ""),
        "nombre": payload.get("nombre") or "",
    }
    return {
        "access_token": create_access_token(new_payload),
        "token_type": "bearer",
    }
```

- [ ] **Step 2: Actualizar `app/services/usuario_service.py`**

Aplicar los siguientes cambios en el archivo existente:

**2a. Cambiar `_to_list_item`** (línea ~89):
```python
    def _to_list_item(self, u: Empleado) -> UsuarioListItem:
        base = UsuarioResponse.model_validate(u)
        lider_nombre: str | None = None
        if u.lider:
            lider_nombre = u.lider.nombre or None
        return UsuarioListItem(**base.model_dump(), lider_nombre=lider_nombre)
```

**2b. Cambiar firma de `list_usuarios_page`** — reemplazar parámetros `departamento`, `puesto`, `activo`:
```python
    async def list_usuarios_page(
        self,
        page: int,
        page_size: int,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        current_user: Empleado,
    ) -> UsuarioPageResponse:
        self._require_rh_only(current_user)
        offset = (page - 1) * page_size
        total = await self.repo.count_filtered(q, area_id, puesto_id, None, solo_activos=False)
        items = await self.repo.list_page(offset, page_size, q, area_id, puesto_id, None, solo_activos=False)
        return UsuarioPageResponse(
            items=[self._to_list_item(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        )
```

**2c. Cambiar firma de `list_directorio_empleados_page`**:
```python
    async def list_directorio_empleados_page(
        self,
        page: int,
        page_size: int,
        q: str | None,
        area_id: int | None,
        puesto_id: int | None,
        current_user: Empleado,
    ) -> UsuarioPageResponse:
        self._require_directorio(current_user)
        offset = (page - 1) * page_size
        estados = settings.ESTADOS_ACTIVOS_IDS
        total = await self.repo.count_filtered(q, area_id, puesto_id, estados, solo_activos=True)
        items = await self.repo.list_page(offset, page_size, q, area_id, puesto_id, estados, solo_activos=True)
        return UsuarioPageResponse(
            items=[self._to_list_item(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        )
```

**2d. Cambiar `resumen_plantilla`**:
```python
    async def resumen_plantilla(self, current_user: Empleado) -> UsuarioResumenResponse:
        self._require_rh_only(current_user)
        total = await self.repo.count(filters=None)
        activos = await self.repo.count_activos(settings.ESTADOS_ACTIVOS_IDS)
        pct = round((activos / total) * 100, 1) if total else 0.0
        return UsuarioResumenResponse(
            total_plantilla=total,
            activos=activos,
            capacitacion_pendiente=0,
            practicantes=0,
            porcentaje_operatividad=pct,
        )
```

**2e. Cambiar `resumen_directorio`**:
```python
    async def resumen_directorio(self, current_user: Empleado) -> UsuarioResumenResponse:
        self._require_directorio(current_user)
        activos = await self.repo.count_activos(settings.ESTADOS_ACTIVOS_IDS)
        return UsuarioResumenResponse(
            total_plantilla=activos,
            activos=activos,
            capacitacion_pendiente=0,
            practicantes=0,
            porcentaje_operatividad=100.0 if activos else 0.0,
        )
```

**2f. Cambiar `catalogo_filtros` y `catalogo_directorio`**:
```python
    async def catalogo_filtros(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_rh_only(current_user)
        from app.schemas.empleados import AreaResponse, PuestoResponse
        areas = await self.repo.list_areas_activas()
        puestos = await self.repo.list_puestos_activos()
        return CatalogoFiltrosResponse(
            areas=[AreaResponse.model_validate(a) for a in areas],
            puestos=[PuestoResponse.model_validate(p) for p in puestos],
        )

    async def catalogo_directorio(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_directorio(current_user)
        from app.schemas.empleados import AreaResponse, PuestoResponse
        areas = await self.repo.list_areas_activas()
        puestos = await self.repo.list_puestos_activos()
        return CatalogoFiltrosResponse(
            areas=[AreaResponse.model_validate(a) for a in areas],
            puestos=[PuestoResponse.model_validate(p) for p in puestos],
        )
```

**2g. Cambiar `_ensure_puede_ver_empleado`** — usar `lider_id`:
```python
    async def _ensure_puede_ver_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
    ) -> None:
        rol = self._get_rol(current_user)
        if rol in ("rh", "gerente", "director"):
            return
        if rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = {e.id for e in subordinados}
            if empleado_id in ids or empleado_id == current_user.id:
                return
            raise ForbiddenError(detail="No tienes acceso a este usuario")
        if empleado_id == current_user.id:
            return
        raise ForbiddenError(detail="No tienes acceso a este usuario")
```

**2h. Cambiar `asignar_supervisor_y_rol`** — el campo `supervisor_id` pasa a `lider_id`:
En la función `asignar_supervisor_y_rol`, el `data` schema ahora usa `lider_id`. No hay cambio en la lógica, solo el schema cambió — la función no hardcodea el nombre del campo.

**2i. Eliminar `desactivar_usuario`** — remover el método completo (la activación/desactivación es controlada por el sync, no por RH).

**2j. Cambiar `get_metricas`** — reemplazar `usuario.fecha_ingreso` por `usuario.registro`:
```python
        dias_antiguedad = 0
        if usuario.registro:
            dias_antiguedad = (date.today() - usuario.registro).days
```

**2k. Agregar import faltante en usuario_service.py**:
```python
from app.core.config import settings
```

- [ ] **Step 3: Actualizar `app/api/v1/usuarios/router.py`** — remover endpoint DELETE y actualizar docstring:

```python
# app/api/v1/usuarios/router.py
"""
Directorio administrativo de usuarios — solo RH.

Operaciones disponibles:
  - GET /roles           — catálogo de roles
  - GET /{id}            — detalle de un empleado
  - PATCH /{id}          — editar solo lider_id y rol_id

Creación/desactivación de empleados: no disponible — los empleados
se sincronizan desde IT Mirror (BD del cliente, solo lectura).
"""

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.usuarios import (
    RolBrief,
    UsuarioAsignacionUpdate,
    UsuarioResponse,
)
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/api/v1/usuarios", tags=["Usuarios"])

_RH = ["rh"]


def _svc(db: AsyncSession = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


@router.get("/roles", response_model=list[RolBrief])
async def list_roles(
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Catálogo de roles para formularios de asignación (solo RH)."""
    return await svc.list_roles_rh(current_user=current_user)


@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: int,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_usuario(id=id, current_user=current_user)


@router.patch("/{id}", response_model=UsuarioResponse)
async def asignar_lider_y_rol(
    id: int,
    body: UsuarioAsignacionUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Edición restringida: solo lider_id y rol_id."""
    return await svc.asignar_supervisor_y_rol(
        id=id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )
```

- [ ] **Step 4: Verificar imports**

```bash
python -c "from app.services.auth_service import authenticate_user; from app.services.usuario_service import UsuarioService; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add app/services/auth_service.py app/services/usuario_service.py app/api/v1/usuarios/router.py
git commit -m "feat: update auth_service and usuario_service — replace activo with estado_id"
```

---

## Task 9: Extender IT Mirror con sync de catálogos

**Files:**
- Modify: `app/integrations/it_mirror.py`

- [ ] **Step 1: Agregar método `_sync_catalogos` y actualizar `sync_empleados`**

Después de la línea `_CAMPOS_SYNC: tuple[str, ...] = (...)`, agregar:

```python
    # Catálogos a sincronizar en orden (respeta dependencias FK)
    _CATALOGOS_SYNC: tuple[tuple[str, str, type], ...] = ()  # poblado abajo
```

En `sync_empleados`, antes del loop de empleados, agregar el sync de catálogos:

```python
                # Sync catálogos primero (en orden de dependencias FK)
                await self._sync_catalogos(it_db, rh_db)
```

- [ ] **Step 2: Agregar métodos de sync de catálogos**

Añadir al final de la clase `ITMirrorClient`:

```python
    async def _sync_catalogos(
        self, it_db: AsyncSession, rh_db: AsyncSession
    ) -> None:
        """Sincroniza las 6 tablas de catálogo desde IT Mirror hacia BD local."""
        from app.models.catalogos import (
            Area, Categoria, ClasificacionEmpleado,
            EstadoEmpleado, Puesto, Subarea,
        )

        # Orden respeta dependencias FK
        plan = [
            ("areas", "area_id", Area),
            ("categorias", "categoria_id", Categoria),
            ("subareas", "subarea_id", Subarea),
            ("puestos", "puesto_id", Puesto),
            ("estados_empleados", "estado_id", EstadoEmpleado),
            ("clasificacion_empleado", "clasificacion_id", ClasificacionEmpleado),
        ]

        for tabla, pk_field, Model in plan:
            try:
                rows = await self._leer_tabla_catalogo(it_db, tabla)
                if rows is None:
                    _slog("warning", "CATALOGO_READ_FAILED", tabla=tabla)
                    continue
                for row in rows:
                    await self._upsert_catalogo(rh_db, Model, pk_field, row)
                _slog("info", "CATALOGO_SYNCED", tabla=tabla, count=len(rows))
            except Exception as exc:
                _slog("error", "CATALOGO_SYNC_ERROR", tabla=tabla, error=str(exc))

    async def _leer_tabla_catalogo(
        self, it_db: AsyncSession, tabla: str
    ) -> list[dict] | None:
        """Lee todas las filas de una tabla de catálogo del cliente."""
        try:
            result = await it_db.execute(text(f"SELECT * FROM {tabla}"))  # noqa: S608
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:
            _slog("error", "READ_CATALOGO_FAILED", tabla=tabla, error=str(exc))
            return None

    async def _upsert_catalogo(
        self,
        rh_db: AsyncSession,
        Model,
        pk_field: str,
        row: dict,
    ) -> None:
        """Upsert de un registro de catálogo. Nunca borra; solo inserta o actualiza."""
        from sqlalchemy import select

        pk_value = row[pk_field]
        stmt = select(Model).where(getattr(Model, pk_field) == pk_value)
        result = await rh_db.execute(stmt)
        local = result.scalar_one_or_none()

        if local is None:
            rh_db.add(Model(**row))
        else:
            for campo, valor in row.items():
                if hasattr(local, campo):
                    setattr(local, campo, valor)
```

- [ ] **Step 3: Actualizar `_leer_empleados_it` con las columnas reales del cliente**

Reemplazar el método `_leer_empleados_it`:

```python
    async def _leer_empleados_it(self, it_db: AsyncSession) -> list[dict] | None:
        """Lee todos los empleados de la tabla IT Mirror con la estructura real del cliente."""
        try:
            result = await it_db.execute(
                text(
                    """
                    SELECT empleado_id, no_empleado, no_sap, nombre, usuario,
                           categoria_id, subarea_id, puesto_id, estado_id,
                           area_id, clasificacion_id, lider_id, centrocosto_id,
                           foto, recibe_bono, brigada, registro,
                           a_restringido, requiere_cambio_password
                    FROM empleados
                    """
                )
            )
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:
            _slog("error", "READ_IT_FAILED", error=str(exc))
            return None
```

- [ ] **Step 4: Actualizar `_sync_empleado` con el nuevo mapeo**

Reemplazar el método `_sync_empleado`:

```python
    async def _sync_empleado(self, rh_db: AsyncSession, emp_it: dict) -> str:
        """
        Sincroniza un empleado individual.
        Retorna: 'insertados' | 'actualizados' | 'desactivados'
        """
        from app.models.empleados import Empleado
        from app.models.roles import Rol
        from sqlalchemy import select

        no_emp = emp_it["no_empleado"]

        stmt = select(Empleado).where(Empleado.no_empleado == no_emp)
        result = await rh_db.execute(stmt)
        emp_local = result.scalar_one_or_none()

        # Resolver lider_id: el cliente usa empleado_id del líder, local usa id
        lider_local_id: int | None = None
        if emp_it.get("lider_id"):
            lider_stmt = select(Empleado).where(
                Empleado.empleado_id == emp_it["lider_id"]
            )
            lider_result = await rh_db.execute(lider_stmt)
            lider = lider_result.scalar_one_or_none()
            if lider:
                lider_local_id = lider.id

        campos_sync = {
            "empleado_id": emp_it["empleado_id"],
            "no_sap": emp_it.get("no_sap"),
            "nombre": emp_it["nombre"],
            "usuario": emp_it.get("usuario"),
            "categoria_id": emp_it.get("categoria_id"),
            "subarea_id": emp_it.get("subarea_id"),
            "puesto_id": emp_it.get("puesto_id"),
            "estado_id": emp_it.get("estado_id"),
            "area_id": emp_it.get("area_id"),
            "clasificacion_id": emp_it.get("clasificacion_id"),
            "lider_id": lider_local_id,
            "centrocosto_id": emp_it.get("centrocosto_id"),
            "foto": emp_it.get("foto"),
            "recibe_bono": emp_it.get("recibe_bono"),
            "brigada": emp_it.get("brigada"),
            "registro": emp_it.get("registro"),
            "a_restringido": emp_it.get("a_restringido"),
            "requiere_cambio_password": emp_it.get("requiere_cambio_password"),
        }

        if emp_local is None:
            rol_stmt = select(Rol).where(Rol.nombre == "empleado")
            rol_result = await rh_db.execute(rol_stmt)
            rol = rol_result.scalar_one_or_none()
            if rol is None:
                raise ValueError("Rol 'empleado' no encontrado — verificar seed de roles")

            nuevo = Empleado(
                no_empleado=no_emp,
                password_hash="$2b$12$PLACEHOLDER_CHANGE_ON_FIRST_LOGIN",
                rol_id=rol.id,
                **campos_sync,
            )
            rh_db.add(nuevo)
            _slog("info", "EMPLEADO_INSERT", no_empleado=no_emp)
            return "insertados"

        else:
            era_activo = emp_local.estado_id in (settings.ESTADOS_ACTIVOS_IDS or [1])
            hubo_cambio = False

            for campo, valor in campos_sync.items():
                if getattr(emp_local, campo) != valor:
                    setattr(emp_local, campo, valor)
                    hubo_cambio = True

            ahora_activo = emp_it.get("estado_id") in (settings.ESTADOS_ACTIVOS_IDS or [1])
            if era_activo and not ahora_activo:
                await self._cancelar_solicitudes_pending(rh_db, emp_local.id, no_emp)
                return "desactivados"

            if hubo_cambio:
                _slog("info", "EMPLEADO_UPDATE", no_empleado=no_emp)
            return "actualizados"
```

- [ ] **Step 5: Agregar `from app.core.config import settings` al top del archivo** (si no existe ya)

- [ ] **Step 6: Verificar imports**

```bash
python -c "from app.integrations.it_mirror import ITMirrorClient; print('OK')"
```
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add app/integrations/it_mirror.py
git commit -m "feat: extend IT Mirror sync with catalog tables and updated empleado mapping"
```

---

## Task 10: Actualizar seed con catálogos y empleados de prueba

**Files:**
- Modify: `app/utils/seed.py`

- [ ] **Step 1: Agregar datos de catálogos al seed**

Añadir al inicio del archivo, después de los imports existentes:

```python
from app.models.catalogos import (
    Area, Categoria, ClasificacionEmpleado, EstadoEmpleado, Puesto, Subarea,
)
```

Añadir estas constantes antes de `ROLES_SEED`:

```python
CATALOGOS_SEED: dict = {
    "areas": [
        {"area_id": 1, "descripcion": "Producción", "estatus_id": 1},
        {"area_id": 2, "descripcion": "Administración", "estatus_id": 1},
    ],
    "categorias": [
        {"categoria_id": 1, "descripcion": "Operativo", "nivel": "N1", "bono_cat": None, "estatus_id": 1},
        {"categoria_id": 2, "descripcion": "Administrativo", "nivel": "N2", "bono_cat": None, "estatus_id": 1},
    ],
    "subareas": [
        {"subarea_id": 1, "descripcion": "Línea A", "area_id": 1, "estatus_id": 1},
        {"subarea_id": 2, "descripcion": "Contabilidad", "area_id": 2, "estatus_id": 1},
    ],
    "puestos": [
        {"puesto_id": 1, "descripcion": "Operador", "estatus_id": 1, "area_id": 1},
        {"puesto_id": 2, "descripcion": "Analista", "estatus_id": 1, "area_id": 2},
    ],
    "estados_empleados": [
        {"estado_id": 1, "descripcion": "Activo", "estatus_id": 1},
        {"estado_id": 2, "descripcion": "Baja", "estatus_id": 1},
        {"estado_id": 3, "descripcion": "Suspendido", "estatus_id": 1},
    ],
    "clasificaciones": [
        {"clasificacion_id": 1, "descripcion": "Directo", "estatus_id": 1, "significado": "Personal directo de producción"},
        {"clasificacion_id": 2, "descripcion": "Indirecto", "estatus_id": 1, "significado": "Personal de soporte"},
    ],
}
```

- [ ] **Step 2: Agregar función `seed_catalogos`**

```python
async def seed_catalogos(db) -> None:
    """Crea datos de catálogos mínimos para development. Idempotente por PK."""
    from sqlalchemy import select

    plan = [
        ("areas", Area, "area_id", CATALOGOS_SEED["areas"]),
        ("categorias", Categoria, "categoria_id", CATALOGOS_SEED["categorias"]),
        ("subareas", Subarea, "subarea_id", CATALOGOS_SEED["subareas"]),
        ("puestos", Puesto, "puesto_id", CATALOGOS_SEED["puestos"]),
        ("estados_empleados", EstadoEmpleado, "estado_id", CATALOGOS_SEED["estados_empleados"]),
        ("clasificaciones", ClasificacionEmpleado, "clasificacion_id", CATALOGOS_SEED["clasificaciones"]),
    ]

    for nombre, Model, pk_field, rows in plan:
        for row in rows:
            pk_value = row[pk_field]
            result = await db.execute(
                select(Model).where(getattr(Model, pk_field) == pk_value)
            )
            existing = result.scalar_one_or_none()
            if not existing:
                db.add(Model(**row))
                logger.info("  %s id=%d creado", nombre, pk_value)
        await db.flush()
    logger.info("Catálogos seed completado")
```

- [ ] **Step 3: Actualizar `seed_admin`** — remover campos eliminados, usar nueva estructura:

```python
ADMIN_RH: dict = {
    "empleado_id": 9999,
    "no_empleado": "RH-0001",
    "nombre": "Admin RH",
    "email": "admin.rh@leoni.com",
    "password": "Leoni2026!RH",
    "estado_id": 1,
}
```

```python
async def seed_admin(db, rol_rh_id: int) -> None:
    """Crea el usuario admin RH si no existe."""
    result = await db.execute(
        select(Empleado).where(Empleado.email == ADMIN_RH["email"])
    )
    existing = result.scalar_one_or_none()

    if existing:
        logger.info(
            "  Admin RH ya existe (id=%d, email=%s) — sin cambios",
            existing.id,
            existing.email,
        )
        return

    admin = Empleado(
        empleado_id=ADMIN_RH["empleado_id"],
        no_empleado=ADMIN_RH["no_empleado"],
        nombre=ADMIN_RH["nombre"],
        email=ADMIN_RH["email"],
        password_hash=hash_password(ADMIN_RH["password"]),
        rol_id=rol_rh_id,
        estado_id=ADMIN_RH["estado_id"],
    )
    db.add(admin)
    await db.flush()
    logger.info("  Admin RH creado (id=%d, email=%s)", admin.id, admin.email)
    logger.warning("  IMPORTANTE: Cambiar la password del admin RH después del primer login.")
```

- [ ] **Step 4: Actualizar `seed()` para llamar `seed_catalogos` primero**

```python
async def seed() -> None:
    logger.info("=== Iniciando seed — Plataforma RH Leoni Cable ===")

    async with AsyncSessionLocal() as db:
        try:
            logger.info("Seeding catálogos...")
            await seed_catalogos(db)

            logger.info("Seeding roles...")
            created_roles = await seed_roles(db)

            logger.info("Seeding usuario admin RH...")
            rol_rh_id = created_roles.get("rh")
            if not rol_rh_id:
                raise RuntimeError("El rol 'rh' no fue creado correctamente")
            await seed_admin(db, rol_rh_id)

            await db.commit()
            logger.info("=== Seed completado exitosamente ===")

        except Exception:
            await db.rollback()
            logger.exception("Error durante el seed — rollback ejecutado")
            raise
```

- [ ] **Step 5: Commit**

```bash
git add app/utils/seed.py
git commit -m "feat: extend seed with catalog data and updated admin employee structure"
```

---

## Task 11: Actualizar conftest y tests existentes

**Files:**
- Modify: `tests/conftest.py`
- Modify: `tests/test_auth.py`
- Modify: `tests/test_usuarios.py`

- [ ] **Step 1: Actualizar `make_empleado` en `tests/conftest.py`**

Reemplazar la función `make_empleado`:

```python
async def make_empleado(
    db: AsyncSession,
    *,
    rol: str = "empleado",
    email: str | None = None,
    no_empleado: str | None = None,
    empleado_id: int | None = None,
    nombre: str = "Test Usuario",
    password: str = "Passw0rd!Seguro",
    lider_id: int | None = None,
    estado_id: int = 1,  # 1 = Activo (no hay FK enforcement en SQLite)
):
    import uuid
    from app.models.empleados import Empleado

    uid = str(uuid.uuid4())[:8]
    _email = email or f"emp_{uid}@leoni.test"
    _no_empleado = no_empleado or f"EMP-{uid}"
    _empleado_id = empleado_id or abs(hash(uid)) % 100000

    rol_obj = await _get_or_create_rol(db, rol)

    empleado = Empleado(
        empleado_id=_empleado_id,
        no_empleado=_no_empleado,
        nombre=nombre,
        email=_email,
        password_hash=hash_password(password),
        rol_id=rol_obj.id,
        lider_id=lider_id,
        estado_id=estado_id,
    )
    db.add(empleado)
    await db.flush()
    await db.refresh(empleado)
    empleado.rol = rol_obj
    return empleado
```

- [ ] **Step 2: Actualizar imports en conftest**

Agregar import de catalogos en la lista de imports de modelos:
```python
import app.models.catalogos  # noqa: F401
```

- [ ] **Step 3: Actualizar `tests/test_usuarios.py`**

Los tests usan `response.json()["supervisor_id"]` → cambiar a `response.json()["lider_id"]`.
El body del PATCH usa `{"supervisor_id": supervisor.id}` → cambiar a `{"lider_id": supervisor.id}`.
`response.json()["activo"]` → ya no existe; verificar `response.json()["estado"]` si aplica.

Cambios específicos:

**test_patch_asignacion_supervisor_rh_retorna_200**: cambiar body y assertion:
```python
    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"lider_id": supervisor.id},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["lider_id"] == supervisor.id
    assert body["id"] == empleado.id
```

**test_patch_asignacion_body_vacio_retorna_200_sin_cambios**: remover la assertion sobre `rol_id` o verificar que retorna 200:
```python
    assert response.status_code == 200
    assert response.json()["id"] == empleado.id
```

**test_crear_usuario_endpoint_eliminado**: mantener igual (sigue probando que POST no existe).

- [ ] **Step 4: Correr todos los tests**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
pytest tests/ -v
```
Expected: todos los tests pasan (o identificar cuáles requieren ajuste adicional).

- [ ] **Step 5: Commit**

```bash
git add tests/conftest.py tests/test_auth.py tests/test_usuarios.py
git commit -m "feat: update conftest and tests for new Empleado schema"
```

---

## Task 12: Verificación final

- [ ] **Step 1: Correr suite completa**

```bash
pytest tests/ -v --tb=short
```
Expected: todos los tests pasan.

- [ ] **Step 2: Verificar que el servidor arranca**

```bash
uvicorn app.main:app --reload &
sleep 3
curl http://localhost:8000/docs
kill %1
```
Expected: página de docs responde sin errores.

- [ ] **Step 3: Correr el seed**

```bash
python -m app.utils.seed
```
Expected: catálogos y admin creados sin errores.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "feat: complete empleados-catalogos implementation — all tests passing"
```

---

## Notas de implementación

### Nombres de FK constraints en la migración
Los nombres de constraints en el upgrade/downgrade (`audit_log_usuario_id_fkey`, etc.) son los generados por PostgreSQL automáticamente de la migración inicial. Si al aplicar la migración hay errores de constraint no encontrado, verificar los nombres reales con:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'audit_log'::regclass AND contype = 'f';
```

### Campo `activo` en `base.py`
`BaseRepository.soft_delete()` verifica `hasattr(instance, "activo")`. Como `Empleado` ya no tiene `activo`, llamar `soft_delete` en un `Empleado` retornará `False`. Esto es correcto — el método no se usa para empleados después de este cambio.

### Endpoint DELETE eliminado
`DELETE /api/v1/usuarios/{id}` fue eliminado porque la activación/desactivación de empleados es controlada exclusivamente por el sync IT Mirror (la BD del cliente es fuente de verdad para `estado_id`). RH no puede cambiar el estado de un empleado directamente.

### `ESTADOS_ACTIVOS_IDS` en producción
Antes de ir a producción, ajustar `ESTADOS_ACTIVOS_IDS` en `.env` según los IDs reales de la tabla `estados_empleados` del cliente que correspondan a empleados activos. Ejemplo: `ESTADOS_ACTIVOS_IDS=1,5,7`.
