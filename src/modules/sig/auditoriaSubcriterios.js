// Desglose de un criterio de auditoría en 3-4 subcriterios — cada uno con
// su propia pregunta y su propia evidencia observada. El nivel 0/3/5/10
// se sigue decidiendo UNA sola vez por criterio (es lo que alimenta
// Diagnóstico HLS vía upsertEstado); los subcriterios son solo apoyo para
// estructurar la conversación y la evidencia, no tienen nivel propio.
//
// Solo están definidos para los criterios que ya se usan en auditorías
// reales — un criterio sin entrada aquí simplemente no desglosa (la Ficha
// cae de vuelta a un solo campo de evidencia).
const SUBCRITERIOS = {
  "4.4 Procesos del SIG|10": [
    { letra: "a", titulo: "Ubicación en SharePoint", pregunta: "¿Dónde vive tu proceso dentro de la estructura de SharePoint?" },
    { letra: "b", titulo: "Entradas del proceso", pregunta: "¿Cuáles son las entradas de tu proceso — qué necesitas para poder empezar?" },
    { letra: "c", titulo: "Salidas del proceso", pregunta: "¿Cuáles son las salidas — qué entregas, y a quién?" },
    { letra: "d", titulo: "Criterios y controles", pregunta: "¿Qué criterios o controles tienes definidos para saber si el resultado salió bien?" },
  ],
  "4.4 Procesos del SIG|11": [
    { letra: "a", titulo: "Existencia de la matriz", pregunta: "¿Tienes una matriz de cumplimiento para tu proceso?" },
    { letra: "b", titulo: "Contenido", pregunta: "¿Qué estás midiendo ahí — qué contiene?" },
    { letra: "c", titulo: "Actualización reciente", pregunta: "¿Cuándo fue la última vez que la actualizaste, y qué cambiaste?" },
    { letra: "d", titulo: "Si no existe", pregunta: "¿Sabes qué es una matriz de cumplimiento? ¿Hay algo parecido aunque no se llame así?" },
  ],
  "5.3 Roles y responsabilidades|10": [
    { letra: "a", titulo: "Rol propio", pregunta: "¿Cuál es tu rol dentro de este proceso?" },
    { letra: "b", titulo: "Objetivo del rol", pregunta: "¿Cuál es el objetivo de ese rol dentro del proceso?" },
    { letra: "c", titulo: "Conexión con el proceso", pregunta: "¿Cómo se conecta tu rol con el objetivo general del proceso?" },
    { letra: "d", titulo: "Rol específico", pregunta: "Si tienes más de un rol dentro del proceso, ¿cuál es el objetivo de cada uno por separado?" },
  ],
  "5.3 Roles y responsabilidades|11": [
    { letra: "a", titulo: "Quién aprueba", pregunta: "¿Quién autoriza o aprueba cada paso clave de tu proceso?" },
    { letra: "b", titulo: "Evidencia de aprobación", pregunta: "¿Me puedes mostrar evidencia de una aprobación reciente?" },
    { letra: "c", titulo: "A quién escalar", pregunta: "Si algo sale de lo normal, ¿a quién escalas la decisión?" },
    { letra: "d", titulo: "Autoridad específica", pregunta: "Si tienes más de un rol, ¿quién aprueba las decisiones de cada uno por separado?" },
  ],
};

export function getSubcriterios(subtitulo, numero) {
  return SUBCRITERIOS[`${subtitulo}|${numero}`] || null;
}
