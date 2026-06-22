from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.emails import Email
    from app.models.empleados_rh import (
        EmpleadoCore,
        EmpleadoRhConfig,
        EmpleadoRhHorasExtra,
        EmpleadoRhPermisos,
    )
    from app.models.roles import Rol
    from app.models.turnos_empleados import TurnoEmpleado
    from app.models.vacaciones import Vacaciones
    from app.models.catalogos import (
        Area,
        Categoria,
        ClasificacionEmpleado,
        EstadoEmpleado,
        Puesto,
        Subarea,
    )


class Empleado(Base):
    """Empleado: identidad y atributos provenientes de ``Bono.empleados`` (PK
    ``empleado_id``, sin ``id``, tabla intacta de Bono). Lo propio del proyecto
    (rol, credenciales, email, datos RH) vive en las tablas ``levelup_empleados_*``
    y se expone aquí vía propiedades de compatibilidad (ver app/models/empleados_rh.py).
    """

    __tablename__ = "empleados"

    empleado_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    no_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    no_sap: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    usuario: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

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

    lider_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    centrocosto_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    foto: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recibe_bono: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    brigada: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    registro: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    a_restringido: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    requiere_cambio_password: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # ── Relaciones a catálogos de Bono (por id; read-only) ──
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
        remote_side="Empleado.empleado_id",
        foreign_keys=[lider_id],
        back_populates="subordinados",
    )
    subordinados: Mapped[List["Empleado"]] = relationship(
        "Empleado",
        foreign_keys=[lider_id],
        back_populates="lider",
    )

    # ── Tablas propias del proyecto (levelup_empleados_*) ──
    core: Mapped[Optional["EmpleadoCore"]] = relationship(
        "EmpleadoCore",
        back_populates="empleado",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
        foreign_keys="EmpleadoCore.empleado_id",
    )
    rh_config: Mapped[Optional["EmpleadoRhConfig"]] = relationship(
        "EmpleadoRhConfig",
        back_populates="empleado",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
        foreign_keys="EmpleadoRhConfig.empleado_id",
    )
    rh_permisos: Mapped[Optional["EmpleadoRhPermisos"]] = relationship(
        "EmpleadoRhPermisos",
        back_populates="empleado",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
        foreign_keys="EmpleadoRhPermisos.empleado_id",
    )
    rh_horas_extra: Mapped[Optional["EmpleadoRhHorasExtra"]] = relationship(
        "EmpleadoRhHorasExtra",
        back_populates="empleado",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
        foreign_keys="EmpleadoRhHorasExtra.empleado_id",
    )
    email_alterno: Mapped[Optional["Email"]] = relationship(
        "Email",
        back_populates="empleado",
        uselist=False,
    )
    turno_empleado: Mapped[Optional["TurnoEmpleado"]] = relationship(
        "TurnoEmpleado",
        back_populates="empleado",
        uselist=False,
    )
    vacaciones: Mapped[Optional["Vacaciones"]] = relationship(
        "Vacaciones",
        back_populates="empleado",
        uselist=False,
    )

    # ── Propiedades de compatibilidad (datos del proyecto en levelup_empleados_*) ──
    # Solo lectura; las escrituras se hacen sobre las filas hijas vía los helpers
    # ensure_* en app/models/empleados_rh.py. Las relaciones core/rh_* usan
    # lazy="selectin", así que estos accesos no disparan IO async perezoso.

    @hybrid_property
    def id(self) -> int:
        """Shim de compatibilidad: el surrogate local ``id`` desapareció; toda
        referencia a ``empleado.id`` / ``Empleado.id`` resuelve a ``empleado_id``
        (instancia y nivel de query)."""
        return self.empleado_id

    @id.expression
    def id(cls):  # noqa: N805
        return cls.empleado_id

    @property
    def rol(self) -> Optional["Rol"]:
        return self.core.rol if self.core else None

    @property
    def rol_id(self) -> Optional[int]:
        return self.core.rol_id if self.core else None

    @property
    def email(self) -> Optional[str]:
        return self.core.email if self.core else None

    @property
    def password_hash(self) -> Optional[str]:
        return self.core.password_hash if self.core else None

    @property
    def created_at(self) -> Optional[datetime]:
        return self.core.created_at if self.core else None

    @property
    def fecha_fin_contrato(self) -> Optional[date]:
        return self.rh_config.fecha_fin_contrato if self.rh_config else None

    @property
    def modulos_rh(self) -> dict:
        cfg = self.rh_config
        if cfg and cfg.modulos_rh is not None:
            return cfg.modulos_rh
        return {}

    @property
    def inscrito_modulos_rh(self) -> bool:
        return bool(self.rh_config.inscrito_modulos_rh) if self.rh_config else False

    @property
    def acceso_rh_removido(self) -> bool:
        return bool(self.rh_config.acceso_rh_removido) if self.rh_config else False

    @property
    def puede_administrar_permisos_rh(self) -> bool:
        return (
            bool(self.rh_permisos.puede_administrar_permisos_rh)
            if self.rh_permisos
            else False
        )

    @property
    def puede_registrar_horas_extra(self) -> bool:
        return (
            bool(self.rh_permisos.puede_registrar_horas_extra)
            if self.rh_permisos
            else False
        )

    @property
    def horas_extra_autorizado_en(self) -> Optional[datetime]:
        return self.rh_horas_extra.autorizado_en if self.rh_horas_extra else None

    @property
    def horas_extra_autorizado_por_id(self) -> Optional[int]:
        return (
            self.rh_horas_extra.autorizado_por_empleado_id
            if self.rh_horas_extra
            else None
        )

    @property
    def horas_extra_autorizado_por(self) -> Optional["Empleado"]:
        """Empleado que autorizó horas extra. Requiere eager-load explícito de
        ``rh_horas_extra.autorizado_por`` (no es selectin para evitar recursión)."""
        return self.rh_horas_extra.autorizado_por if self.rh_horas_extra else None

    def __repr__(self) -> str:
        return f"<Empleado empleado_id={self.empleado_id} no_empleado={self.no_empleado} nombre={self.nombre}>"
