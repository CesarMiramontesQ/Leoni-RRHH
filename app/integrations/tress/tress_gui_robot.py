# app/integrations/tress/tress_gui_robot.py
"""
DEPRECATED — no usar. No habrá RPA / robot GUI de TRESS.

La integración con nómina es escritura directa a DATOS_ANALISIS.
Este módulo se conserva solo como legado; el scheduler ya no lo invoca.

---
Histórico: Robot GUI de TRESS via pywinauto — ESCRITURA en TRESS.

Disponible SOLO en Windows con TRESS instalado localmente o via RDP.
En otros entornos, los metodos logean un warning y retornan sin operar.

Politica de uso (legacy):
  - Solo escribir lo que no se puede hacer via SQL directo
  - Cada operacion debe ser idempotente o verificar estado previo
  - Timeout por operacion: 30 segundos
  - En caso de error, el registro en tress_robot_queue queda en estado 'failed'
    para reintento manual por el operador RH

pywinauto esta comentado en requirements.txt — descomentar en la maquina TRESS Windows.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tress-gui")

_TRESS_TIMEOUT = 30  # segundos


def _is_windows() -> bool:
    import sys
    return sys.platform == "win32"


class TressGuiRobot:
    """
    Automatiza operaciones de escritura en la interfaz grafica de TRESS.
    Cada metodo publico mapea a una operacion de negocio concreta.
    """

    def _connect_sync(self):
        """Conecta a la ventana principal de TRESS."""
        if not _is_windows():
            raise RuntimeError("pywinauto solo disponible en Windows")
        try:
            from pywinauto import Application
            app = Application(backend="uia").connect(title_re=".*TRESS.*", timeout=10)
            return app
        except ImportError:
            raise RuntimeError(
                "pywinauto no instalado. Descomenta en requirements.txt "
                "en la maquina de produccion TRESS Windows."
            )

    def _stub_warning(self, operacion: str, payload: dict) -> None:
        logger.warning(
            "TressGuiRobot STUB — operacion '%s' no ejecutada (entorno no-Windows). "
            "Payload: %s",
            operacion,
            payload,
        )

    async def _run_sync(self, fn, *args, **kwargs):
        """Ejecuta funcion sincrona en thread pool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            _executor,
            partial(fn, *args, **kwargs),
        )

    # ── Operaciones de negocio ─────────────────────────────────

    async def registrar_incidencia(self, payload: dict) -> bool:
        """
        Registra una incidencia en TRESS GUI.
        payload: {num_empleado, tipo_incidencia, fecha, descripcion}
        """
        if not _is_windows():
            self._stub_warning("registrar_incidencia", payload)
            return False
        try:
            await self._run_sync(self._registrar_incidencia_sync, payload)
            return True
        except Exception as exc:
            logger.error("Error en TressGuiRobot.registrar_incidencia: %s", str(exc), exc_info=True)
            return False

    def _registrar_incidencia_sync(self, payload: dict) -> None:
        app = self._connect_sync()
        main = app.top_window()
        # Navegar a modulo Incidencias → Nueva Incidencia
        main.menu_select("Incidencias->Nueva Incidencia")
        dlg = app.window(title_re="Nueva Incidencia.*")
        dlg.wait("ready", timeout=_TRESS_TIMEOUT)
        dlg["NumEmpleadoEdit"].set_edit_text(payload["num_empleado"])
        dlg["TipoComboBox"].select(payload["tipo_incidencia"])
        dlg["FechaEdit"].set_edit_text(payload["fecha"])
        if payload.get("descripcion"):
            dlg["DescripcionEdit"].set_edit_text(payload["descripcion"])
        dlg["GuardarButton"].click()
        dlg.wait_not("visible", timeout=_TRESS_TIMEOUT)
        logger.info("Incidencia registrada en TRESS para empleado %s", payload["num_empleado"])

    async def registrar_solicitud_vacaciones(self, payload: dict) -> bool:
        """
        Registra solicitud de vacaciones en TRESS.
        payload: {num_empleado, fecha_inicio, fecha_fin, dias}
        """
        if not _is_windows():
            self._stub_warning("registrar_solicitud_vacaciones", payload)
            return False
        try:
            await self._run_sync(self._registrar_vacaciones_sync, payload)
            return True
        except Exception as exc:
            logger.error("Error en TressGuiRobot.registrar_solicitud_vacaciones: %s", str(exc), exc_info=True)
            return False

    def _registrar_vacaciones_sync(self, payload: dict) -> None:
        app = self._connect_sync()
        main = app.top_window()
        main.menu_select("Vacaciones->Nueva Solicitud")
        dlg = app.window(title_re="Nueva Solicitud.*Vacaciones.*")
        dlg.wait("ready", timeout=_TRESS_TIMEOUT)
        dlg["NumEmpleadoEdit"].set_edit_text(payload["num_empleado"])
        dlg["FechaInicioEdit"].set_edit_text(payload["fecha_inicio"])
        dlg["FechaFinEdit"].set_edit_text(payload["fecha_fin"])
        dlg["GuardarButton"].click()
        dlg.wait_not("visible", timeout=_TRESS_TIMEOUT)
        logger.info("Vacaciones registradas en TRESS para empleado %s", payload["num_empleado"])

    async def aplicar_accion_disciplinaria(self, payload: dict) -> bool:
        """
        Registra accion disciplinaria (acta administrativa) en TRESS.
        payload: {num_empleado, tipo_sancion, fecha, folio_acta}
        """
        if not _is_windows():
            self._stub_warning("aplicar_accion_disciplinaria", payload)
            return False
        try:
            await self._run_sync(self._accion_disciplinaria_sync, payload)
            return True
        except Exception as exc:
            logger.error("Error en TressGuiRobot.aplicar_accion_disciplinaria: %s", str(exc), exc_info=True)
            return False

    def _accion_disciplinaria_sync(self, payload: dict) -> None:
        app = self._connect_sync()
        main = app.top_window()
        main.menu_select("Expediente->Accion Disciplinaria->Nueva")
        dlg = app.window(title_re="Nueva Accion Disciplinaria.*")
        dlg.wait("ready", timeout=_TRESS_TIMEOUT)
        dlg["NumEmpleadoEdit"].set_edit_text(payload["num_empleado"])
        dlg["TipoSancionComboBox"].select(payload["tipo_sancion"])
        dlg["FechaEdit"].set_edit_text(payload["fecha"])
        dlg["FolioEdit"].set_edit_text(payload["folio_acta"])
        dlg["GuardarButton"].click()
        dlg.wait_not("visible", timeout=_TRESS_TIMEOUT)
        logger.info("Accion disciplinaria registrada en TRESS para empleado %s", payload["num_empleado"])
