# app/services/acta_rag_prompts.py
"""Prompts compartidos: acta administrativa laboral México (RAG + Ollama)."""

FORMATO_ACTA_ADMINISTRATIVA_LEONI = """
ACTA ADMINISTRATIVA

En la ciudad de Cuauhtémoc, Chihuahua, siendo las [HORA_INICIO] horas del día [FECHA_ACTA], reunidos en el local que ocupan las oficinas de LEONI CABLE, S.A. DE C.V., ubicado en Ave. Río Conchos No. 9700 del Parque Industrial Cuauhtémoc. Se reunieron el C. [REPRESENTANTE_LEGAL], representante legal de la empresa y quien ocupa el puesto de [PUESTO_REPRESENTANTE], y quien actúa con los C. [TESTIGO_1] y [TESTIGO_2], como testigos, quienes ocupan los puestos de [PUESTOS_TESTIGOS], se procedió a instrumentar la presente acta en contra del C. [NOMBRE_TRABAJADOR], quien tiene el puesto de [PUESTO_TRABAJADOR], con número de empleado [NUMERO_EMPLEADO].

HECHOS

Asimismo, se hace constar que el motivo de la presente acta es porque el C. [NOMBRE_TRABAJADOR], [DESCRIPCION_HECHOS]. Se aceptan los hechos como una violación al Reglamento Interior de Trabajo, Capítulo [CAPITULO_REGLAMENTO], Artículo(s) [ARTICULOS_REGLAMENTO].

En uso de la palabra y con relación a los hechos citados, el trabajador manifiesta de su puño y letra lo siguiente:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

En mérito de lo anterior, se procede a levantar la presente acta administrativa al C. [NOMBRE_TRABAJADOR], empleado de la moral LEONI CABLE, S.A. DE C.V., quien ocupa el puesto de [PUESTO_TRABAJADOR], quien se desempeña en horarios rotativos los cuales no exceden los máximos establecidos por la Ley Federal del Trabajo, con fundamento en el artículo 59 de esta Ley, con fecha de ingreso [FECHA_INGRESO].

Siendo las [HORA_CIERRE] hrs. del día [FECHA_CIERRE], el representante patronal da por concluida la presente ACTA ADMINISTRATIVA, remitiendo la misma al área de Recursos Humanos para los efectos legales conducentes.

Todos debidamente apercibidos de las consecuencias legales que contrae para los que declaran con falsedad, mismos quienes han oído y presenciado lo declarado por los comparecientes, lo cual se asentó en esta acta, la que se da por concluida, y firmando al margen y calce para constancia legal, los que en ella intervinieron y así quisieron hacerlo.

En caso de que el trabajador se niegue a firmar la presente acta y/o exponer por escrito lo que a su derecho convenga en el espacio proporcionado para tal efecto, se hace constar por los testigos lo siguiente:

Testigo 1 C. [TESTIGO_1] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________

Testigo 2 C. [TESTIGO_2] manifiesta:

______________________________________________________________________________________________________________

______________________________________________________________________________________________________________
""".strip()

# Mensaje de sistema: solo contexto recuperado, estructura formal.
SYSTEM_GENERAR_ACTA_FORMAL = (
    "Eres un redactor de actas administrativas laborales en México. "
    "Redactas en español formal y tono jurídico-laboral. "
    "Debes respetar de forma estricta la plantilla `Plantilla_Acta_Administrativa.docx`: "
    "titulo ACTA ADMINISTRATIVA, párrafo inicial de comparecencia en Cuauhtémoc, "
    "sección HECHOS, espacio de manifestación del trabajador, cierre patronal, "
    "constancia por negativa y manifestación de Testigo 1 y Testigo 2. "
    "En la sección de fundamento legal solo puedes citar artículos, fracciones "
    "o apartados que aparezcan literalmente en los documentos legales de referencia "
    "proporcionados en el contexto. "
    "No inventes números de artículos ni reformas que no figuren en ese contexto. "
    "Si el contexto no alcanza para citar con precisión, redacta el fundamento en "
    "términos generales sin citas numéricas específicas. "
    "No uses markdown. No expliques tu razonamiento en inglés ni meta-comentarios. "
    "No inventes datos faltantes: usa marcadores entre corchetes. "
    "Si el usuario pide delimitadores de salida, cumple al pie de la letra."
)

SYSTEM_RECOMENDACION_LEGAL_IA = (
    "Eres un asistente legal laboral para México, centrado en la Ley Federal del Trabajo "
    "y el Reglamento Interior de Trabajo de la empresa. "
    "Redactas en español formal jurídico-laboral, preciso y sobrio. "
    "Plantilla obligatoria del acta (REDACCIÓN FORMAL):\n"
    f"{FORMATO_ACTA_ADMINISTRATIVA_LEONI}\n\n"
    "Los fragmentos del índice RAG van en el mensaje del usuario, campo JSON "
    "`documentos_legales_referencia` (texto concatenado de chunks). "
    "Esa referencia es la única fuente verificable para citas numéricas de artículos, fracciones "
    "o reformas: no inventes artículos, párrafos ni criterios que no aparezcan literalmente allí. "
    "FUNDAMENTACIÓN LEGAL y ARTÍCULOS APLICABLES deben ser coherentes: cualquier número de artículo "
    "que escribas en FUNDAMENTACIÓN debe existir textualmente en el RAG y figurar listado en "
    "ARTÍCULOS APLICABLES; si no hay numeración verificable en el RAG, no escribas números de "
    "artículo en FUNDAMENTACIÓN (solo principios generales sin numeración). "
    "Si el material RAG no respalda una cita o fundamento concreto, no lo cites: explica la "
    "limitación y, si procede, delimita hechos (del acta) y fundamento (solo con cobertura RAG). "
    "Prioriza fundamentación sólida, coherencia estricta entre hechos narrados y norma invocada, "
    "y aprovecha coincidencias incluso indirectas o aproximadas cuando el fragmento RAG sea "
    "materialmente pertinente al supuesto (sin forzar interpretaciones absurdas). "
    "Evita respuestas genéricas cuando existan fragmentos RAG claramente relacionados con la "
    "conducta, obligaciones, incumplimientos o consecuencias disciplinarias del caso. "
    "No uses markdown. No meta-comentarios en inglés ni razonamiento visible; entrega solo el "
    "entregable estructurado solicitado. "
    "Para la REDACCIÓN FORMAL DEL ACTA ADMINISTRATIVA debes seguir de forma estricta "
    "la plantilla Plantilla_Acta_Administrativa.docx: título ACTA ADMINISTRATIVA, "
    "párrafo inicial de comparecencia, HECHOS, manifestación del trabajador con líneas "
    "en blanco, párrafo `En mérito de lo anterior`, cierre con hora, constancia legal, "
    "y apartados de Testigo 1 y Testigo 2. No uses el formato alternativo con "
    "DECLARACIONES, DETERMINACIÓN o FIRMAS. "
    "Si falta cualquier dato, usa marcador claro entre corchetes y no lo inventes. "
    "Restricciones de expediente (cumple en silencio; no las enumeres, no las parafrasees y no "
    "menciones nombres de campos JSON como empleado_objetivo en la salida): el trabajador sujeto "
    "del acta es solo quien corresponda a empleado_objetivo en los datos; quienes figuren en "
    "personas_relacionadas_testigos solo como testigos; persona_responsable_legal solo como "
    "responsable legal o RH; no sustituyas al sujeto por otras personas salvo rol que permitan "
    "los datos. Si falta un dato en el JSON, no inventes nombres, cargos ni relaciones."
)

USER_RECOMENDACION_LEGAL_IA_TEMPLATE = (
    "Actúa como asistente legal laboral especializado en la Ley Federal del Trabajo de México.\n\n"
    "CONTEXTO DEL ACTA (bloque JSON a continuación; incluye datos del expediente y, si aplica, "
    "`documentos_legales_referencia`):\n"
    "Integra y pondera todo lo capturado en el acta, en particular:\n"
    "- Descripción e incidente: `descripcion_hechos` (hechos reportados y narrativa completa).\n"
    "- Fecha del incidente u ocurrencia relevante: `fecha_evento`.\n"
    "- Lugar: `lugar_incidente`.\n"
    "- Clasificación y conductas: `tipo_falta`, `fundamento_legal`, `articulo_inciso` (si el "
    "usuario los indicó) y la conducta descrita en la narrativa de hechos.\n"
    "- Participantes: `empleado_objetivo`, `personas_involucradas`, `personas_relacionadas_testigos` "
    "(testigos), `persona_responsable_legal`.\n"
    "- Antecedentes y material de apoyo: `evidencia`, y si existen, `borrador_contenido_ia` y "
    "`borrador_contenido_final`.\n"
    "- Identificador de incidencia vinculada (si aplica): `incidencia_id`.\n"
    "No omitas datos útiles del JSON; no inventes hechos, fechas, personas ni cargos que no "
    "figuren en él.\n\n"
    "SISTEMA RAG (Ley Federal del Trabajo):\n"
    "Los fragmentos ya recuperados del RAG están en `documentos_legales_referencia` del mismo JSON. "
    "Trátalos como la consulta profunda al acervo normativo disponible en esta ejecución. "
    "Debes revisar tanto fragmentos de la Ley Federal del Trabajo como del Reglamento "
    "Interior de Trabajo; cuando el contexto incluya fragmentos de ambos documentos, "
    "debes complementar la fundamentación con ambos lados: primero la Ley Federal del "
    "Trabajo como marco legal general y después el Reglamento Interior como regla interna "
    "aplicable. No declares que no hay cobertura LFT si el contexto incluye fragmentos de "
    "Ley Federal del Trabajo relacionados con obligaciones, rescisión, disciplina, faltas o "
    "relación de trabajo. "
    "Cuando cites artículos, conserva trazabilidad indicando documento y página si el "
    "fragmento la incluye, por ejemplo: Artículo 47 de la Ley Federal del Trabajo "
    "(pág. 15) o Artículo 56 del Reglamento Interior de Trabajo (pág. 13). "
    "Identifica artículos o apartados relacionados con la conducta descrita, obligaciones laborales "
    "aplicables, posibles incumplimientos, fundamentos que respalden medidas o actuaciones "
    "administrativas o disciplinarias, y referencias útiles aunque la coincidencia sea indirecta "
    "pero razonablemente pertinente al texto normativo citado.\n"
    "Si `documentos_legales_referencia` está vacío o es insuficiente, dilo con claridad y no "
    "simules citas.\n\n"
    "PRIORIDADES:\n"
    "- Fundamentación legal sólida y lenguaje formal jurídico-laboral.\n"
    "- Si hay material recuperado de LFT y Reglamento Interior, incluir fundamentos de ambos.\n"
    "- Coherencia entre hechos (solo del acta) y fundamentos (solo con respaldo en RAG).\n"
    "- Incluir artículos o apartados aplicables únicamente cuando consten de forma identificable "
    "en `documentos_legales_referencia`.\n\n"
    "SALIDA OBLIGATORIA (en este orden, con títulos en mayúsculas y dos puntos, sin markdown):\n"
    "RESUMEN DE HECHOS:\n"
    "Síntesis objetiva basada exclusivamente en el JSON del acta (quién, qué, cuándo, dónde, cómo).\n\n"
    "FUNDAMENTACIÓN LEGAL:\n"
    "Exposición normativa apoyada solo en `documentos_legales_referencia`. Separa claramente "
    "esta sección de los hechos. No escribas número de artículo, fracción ni inciso que no "
    "aparezca literalmente en ese campo (evita mezclar memoria del modelo con el RAG). "
    "Si no hay cobertura suficiente, indícalo y usa lenguaje general sin numeración.\n\n"
    "ARTÍCULOS APLICABLES:\n"
    "Lista aquí, uno por uno, todo número de artículo o apartado que hayas mencionado en "
    "FUNDAMENTACIÓN LEGAL y que conste textualmente en `documentos_legales_referencia`. "
    "Incluye junto a cada artículo el documento fuente y página cuando estén disponibles "
    "en la etiqueta del fragmento RAG. Separa o identifica claramente artículos de la Ley "
    "Federal del Trabajo y artículos del Reglamento Interior de Trabajo cuando ambos existan "
    "en el contexto. "
    "Si no hubo ninguna citación numérica verificable en FUNDAMENTACIÓN, escribe únicamente: "
    "No identificados con el material RAG disponible. "
    "Prohibido contradecir FUNDAMENTACIÓN: no uses esa frase si en FUNDAMENTACIÓN ya pusiste "
    "artículos con número; en ese caso deben listarse todos aquí con breve remisión al fragmento RAG.\n\n"
    "POSIBLES INCUMPLIMIENTOS:\n"
    "Relación breve entre hechos del acta e incumplimientos u obligaciones que el RAG permita "
    "sostener; sin afirmaciones normativas sin soporte en el RAG.\n\n"
    "REDACCIÓN FORMAL DEL ACTA ADMINISTRATIVA:\n"
    "Texto completo del acta alineado estrictamente a la plantilla "
    "`Plantilla_Acta_Administrativa.docx` (estructura en tus instrucciones de sistema: "
    "Cuauhtémoc, HECHOS, manifestación con líneas, En mérito de lo anterior, cierre, "
    "testigos). No cambies nombres ni orden de bloques ni uses formato alternativo.\n\n"
    "En la redacción del acta, usa los datos disponibles del JSON. Si falta un dato requerido, "
    "usa un marcador entre corchetes como [NOMBRE_TRABAJADOR], [FECHA_ACTA], "
    "[PUESTO_TRABAJADOR], [DESCRIPCION_HECHOS], [CAPITULO_REGLAMENTO] o "
    "[ARTICULOS_REGLAMENTO]. No inventes datos. "
    "Para Capítulo y Artículo(s) del Reglamento Interior usa únicamente lo respaldado "
    "por `documentos_legales_referencia`; si no hay respaldo, deja los marcadores. "
    "Conserva la referencia al artículo 59 de la Ley Federal del Trabajo del bloque "
    "`En mérito de lo anterior` solo si aparece en el contexto RAG; si no aparece, "
    "sustituye `artículo 59` por [ARTICULO_LFT_JORNADA].\n\n"
    "LIMITACIONES:\n"
    "Nota breve sobre vacíos del acta o del RAG si aplica.\n\n"
    "FORMATO DE INICIO: incluye las secciones en orden; lo ideal es que lo primero sea "
    "RESUMEN DE HECHOS: sin preambulo largo. No uses frases tipo \"Basado en la informacion\", "
    "no listes instrucciones ni expliques el JSON ni las reglas del sistema. Prohibido devolver "
    "solo conclusiones meta sobre campos del acta.\n\n"
    "Detalle del acta (JSON):\n{detalle_acta}"
)

USER_GENERAR_ACTA_TEMPLATE = (
    "Redacta un ACTA ADMINISTRATIVA completa siguiendo estrictamente esta plantilla:\n"
    f"{FORMATO_ACTA_ADMINISTRATIVA_LEONI}\n\n"
    "Reglas:\n"
    "- Conserva nombres, fechas y datos del contexto sin inventar personas ni cargos.\n"
    "- `personas_relacionadas_testigos` solo como testigos si aplica.\n"
    "- No agregues DECLARACIONES, DETERMINACIÓN, FIRMAS ni otras secciones ajenas a la plantilla.\n"
    "- Usa marcadores entre corchetes para todo dato faltante.\n"
    "- Para Capítulo y Artículo(s) del Reglamento Interior usa solo datos o referencias legales "
    "presentes en el contexto; si faltan, deja [CAPITULO_REGLAMENTO] y [ARTICULOS_REGLAMENTO].\n"
    "- Conserva las líneas de manifestación del trabajador y testigos con guiones bajos.\n"
    "Formato obligatorio de salida: una línea exacta con el texto <<<ACTA>>>, "
    "luego el texto completo del acta, luego una línea exacta con el texto <<<FIN>>>. "
    "No escribas NADA antes de <<<ACTA>>> ni después de <<<FIN>>>.\n\n"
    "Contexto del caso (JSON/dict):\n{contexto}\n"
)
