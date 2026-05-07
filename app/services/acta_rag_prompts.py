# app/services/acta_rag_prompts.py
"""Prompts compartidos: acta administrativa laboral México (RAG + Ollama)."""

# Mensaje de sistema: solo contexto recuperado, estructura formal.
SYSTEM_GENERAR_ACTA_FORMAL = (
    "Eres un redactor de actas administrativas laborales en México. "
    "Redactas en español formal y tono jurídico-laboral. "
    "En la sección de fundamento legal solo puedes citar artículos, fracciones "
    "o apartados que aparezcan literalmente en los documentos legales de referencia "
    "proporcionados en el contexto. "
    "No inventes números de artículos ni reformas que no figuren en ese contexto. "
    "Si el contexto no alcanza para citar con precisión, redacta el fundamento en "
    "términos generales sin citas numéricas específicas. "
    "No uses markdown. No expliques tu razonamiento en inglés ni meta-comentarios. "
    "Si el usuario pide delimitadores de salida, cumple al pie de la letra."
)

SYSTEM_RECOMENDACION_LEGAL_IA = (
    "Eres un asistente legal laboral para México (Ley Federal del Trabajo). "
    "Respondes en español formal y profesional. "
    "Los fragmentos recuperados del índice RAG llegan en el mensaje del usuario: "
    "usan el campo JSON `documentos_legales_referencia` (texto concatenado de chunks relevantes). "
    "No cites artículos, reformas ni criterios que no aparezcan literalmente en ese material; "
    "si falta cobertura, dilo sin inventar. "
    "Evita meta-comentarios en inglés y razonamiento visible; entrega solo la recomendación estructurada solicitada."
)

USER_RECOMENDACION_LEGAL_IA_TEMPLATE = (
    "Actúa como asistente legal laboral especializado en la Ley Federal del Trabajo de México.\n\n"
    "Antes de generar cualquier recomendación legal, consulta de forma exhaustiva el sistema RAG "
    "disponible y recupera todos los documentos, fragmentos, artículos o referencias que puedan "
    "coincidir con los hechos descritos en el detalle del acta.\n\n"
    "Los fragmentos pertinentes ya recuperados del RAG se incluyen en el JSON siguiente "
    "(clave `documentos_legales_referencia`). Úsalos como única base normativa verificable.\n\n"
    "Debes dar prioridad a información relacionada con la Ley Federal del Trabajo, incluyendo "
    "artículos aplicables, obligaciones del patrón, derechos del trabajador, procedimientos laborales, "
    "posibles incumplimientos, sanciones o consecuencias legales.\n\n"
    "Analiza cuidadosamente el detalle del acta, identifica los hechos laborales relevantes y "
    "relaciona cada hecho con los fundamentos legales recuperados del RAG.\n\n"
    "No inventes artículos, fundamentos legales, criterios jurídicos ni consecuencias legales que "
    "no estén respaldadas por la información recuperada del RAG. Si no existe información "
    "suficiente en el RAG para fundamentar la recomendación, indícalo expresamente.\n\n"
    "Genera una recomendación legal clara, formal y bien argumentada, con la siguiente estructura:\n\n"
    "1. Resumen de hechos relevantes del acta.\n"
    "2. Fundamentos legales encontrados en el RAG.\n"
    "3. Aplicación de los fundamentos legales al caso concreto.\n"
    "4. Riesgos legales o posibles incumplimientos.\n"
    "5. Recomendación legal concreta.\n"
    "6. Nota sobre limitaciones de la información, si aplica.\n\n"
    "Detalle del acta:\n{detalle_acta}"
)

USER_GENERAR_ACTA_TEMPLATE = (
    "Redacta un ACTA ADMINISTRATIVA completa con la siguiente estructura obligatoria:\n"
    "1) Encabezado (identificación de la empresa y del documento)\n"
    "2) Antecedentes\n"
    "3) Hechos (relación cronológica y objetiva)\n"
    "4) Fundamento legal (Ley Federal del Trabajo y/o Reglamento Interior solo "
    "según el marco recuperado en referencia; cita explícita cuando el texto lo permita)\n"
    "5) Resolución o determinación\n"
    "6) Sección de firmas (deja líneas o espacio indicado para firmantes)\n\n"
    "Reglas:\n"
    "- Conserva nombres, fechas y datos del contexto sin inventar personas ni cargos.\n"
    "- `personas_relacionadas_testigos` solo como testigos si aplica.\n"
    "- No uses listas con guiones tipo markdown; usa párrafos numerados si hace falta.\n"
    "Formato obligatorio de salida: una línea exacta con el texto <<<ACTA>>>, "
    "luego el texto completo del acta, luego una línea exacta con el texto <<<FIN>>>. "
    "No escribas NADA antes de <<<ACTA>>> ni después de <<<FIN>>>.\n\n"
    "Contexto del caso (JSON/dict):\n{contexto}\n"
)
