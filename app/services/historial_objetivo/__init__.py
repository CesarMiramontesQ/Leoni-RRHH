"""Modulo Historial Objetivo -- indice objetivo del empleado.

Combina senales ya existentes (actas administrativas, faltas/retardos,
incidencias Calidad/Seguridad de Bono, y a futuro progresivo/bono-
productividad) en un unico indice 0-100 con semaforo, para dar una lectura
objetiva y auditable del historial de un empleado.

Este paquete (Tarea 1) solo contiene la formula pura y sus constantes/tipos
-- sin BD ni I/O. El service que resuelve los conteos reales via
repositorios (Tarea 4) vive en `app/services/historial_objetivo_service.py`
(o equivalente) y consume `calcular_indice` de `formula.py`.
"""
