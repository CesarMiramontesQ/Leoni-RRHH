# app/integrations/tress/tress_sql_client.py
"""
Cliente SQL Server de TRESS — SOLO LECTURA.

Conexion via pyodbc con el driver ODBC 17 for SQL Server.
Disponible SOLO en entornos Windows con el driver instalado.
En macOS/Linux se retornan datos stub para desarrollo.

IMPORTANTE:
  - Esta es una conexion SINCRONA (pyodbc no tiene API async).
  - Ejecutar en un ThreadPoolExecutor para no bloquear el event loop.
  - Solo leer datos — nunca escribir directamente a TRESS SQL.
  - Las escrituras van via TressGuiRobot (pywinauto).
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="tress-sql")


def _conectar(conn_string: str):
    """Abre conexion sincrona pyodbc. Lanza si el driver no esta disponible."""
    try:
        import pyodbc
        return pyodbc.connect(conn_string, timeout=10)
    except ImportError:
        raise RuntimeError(
            "pyodbc no instalado — disponible solo en Windows. "
            "Descomenta pyodbc en requirements.txt para la maquina de produccion TRESS."
        )


class TressSqlClient:
    """
    Lee datos del SQL Server de TRESS (empleados, nomina, etc.).
    Usa un pool de hilos para no bloquear el event loop de FastAPI.
    """

    def __init__(self, conn_string: str):
        self.conn_string = conn_string

    def _query_sync(self, sql: str, params: tuple = ()) -> list[dict]:
        """Ejecuta query sincrono — llamar via run_in_executor."""
        conn = _conectar(self.conn_string)
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        finally:
            conn.close()

    async def query(self, sql: str, params: tuple = ()) -> list[dict]:
        """Ejecuta query en thread pool y retorna lista de dicts."""
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(
                _executor,
                partial(self._query_sync, sql, params),
            )
        except RuntimeError as e:
            # pyodbc no disponible en este entorno — stub para desarrollo
            logger.warning("TressSqlClient stub (pyodbc no disponible): %s", str(e))
            return []

    # ── Queries especificas ────────────────────────────────────

    async def get_empleado_tress(self, num_empleado: str) -> dict | None:
        """Busca un empleado por numero en TRESS."""
        rows = await self.query(
            "SELECT TOP 1 * FROM Empleados WHERE NumEmpleado = ?",
            (num_empleado,),
        )
        return rows[0] if rows else None

    async def get_empleados_activos(self, limit: int = 1000) -> list[dict]:
        """Retorna empleados activos de TRESS para sincronizacion."""
        return await self.query(
            f"SELECT TOP {limit} NumEmpleado, Nombre, Apellido, Email, "
            "Departamento, Puesto, FechaIngreso, Estatus "
            "FROM Empleados WHERE Estatus = 'A' ORDER BY NumEmpleado"
        )

    async def get_incidencias_periodo(
        self, fecha_desde: str, fecha_hasta: str
    ) -> list[dict]:
        """Retorna incidencias de TRESS en un rango de fechas (formato YYYY-MM-DD)."""
        return await self.query(
            "SELECT * FROM Incidencias WHERE FechaRegistro BETWEEN ? AND ? ORDER BY FechaRegistro",
            (fecha_desde, fecha_hasta),
        )

    async def get_saldo_vacaciones(self, num_empleado: str) -> dict | None:
        """Retorna saldo de vacaciones desde TRESS."""
        rows = await self.query(
            "SELECT NumEmpleado, SaldoVacaciones, DiasGozados, DiasDisponibles "
            "FROM SaldoVacaciones WHERE NumEmpleado = ?",
            (num_empleado,),
        )
        return rows[0] if rows else None
