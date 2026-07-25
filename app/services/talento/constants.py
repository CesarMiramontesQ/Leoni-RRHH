"""Umbrales y topes del Dashboard de Talento (configurables).

Los umbrales de polivalencia NO se definen aqui: se importan de
`app.services.operaciones.constants` para que el dashboard y el modulo
Operaciones no puedan divergir. Los de desempeno tampoco: salen del propio
ciclo (`umbral_medio` / `umbral_alto`).
"""

from app.services.operaciones.constants import COBERTURA_AMBAR_MIN

# Semaforo de porcentajes de cumplimiento (capacitacion y PDI).
CUMPLIMIENTO_VERDE_MIN = 80.0
CUMPLIMIENTO_AMBAR_MIN = 50.0

# Un empleado cuenta con la senal `polivalencia_baja` si su indice individual
# queda por debajo de este umbral. Es el mismo corte rojo/ambar que usa la
# cobertura en Operaciones: no se inventa un umbral nuevo.
POLIVALENCIA_BAJA_MAX = COBERTURA_AMBAR_MIN

# Un empleado esta "en foco" si acumula al menos esta cantidad de senales malas.
MIN_SENALES_FOCO = 2

# Tope de empleados en foco devueltos por area.
MAX_EMPLEADOS_FOCO = 10

# Rango por defecto del bloque de historial objetivo, en meses hacia atras.
RANGO_OBJETIVO_MESES_DEFAULT = 12
