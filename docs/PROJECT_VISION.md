# Visión del Proyecto — Portal Estratégico Vikingo

> Este documento no describe código. Describe la filosofía, el propósito y la forma de pensar detrás del Portal Estratégico Vikingo. Es el documento que cualquier persona o IA debe leer **antes** de escribir una sola línea de código, porque explica *por qué* existe el portal y *qué* debe proteger, no *cómo* está construido hoy. Para el detalle técnico, ver `ARCHITECTURE.md`, `MODULES.md`, `DATABASE.md`, `BUSINESS_RULES.md`, `UI_GUIDELINES.md`, `DEVELOPMENT_RULES.md`, `CHANGELOG.md` y `ROADMAP.md`.

---

# 1. Propósito del Portal Estratégico Vikingo

El Portal Estratégico Vikingo existe para resolver un problema muy concreto: **en la mayoría de las empresas, la estrategia vive en un documento, los procesos viven en la cabeza de las personas, la capacidad real de trabajo no se mide, y el seguimiento se hace en hojas sueltas que nadie vuelve a abrir.** Cada pieza existe, pero no conversa con las demás. El resultado es una organización que decide sin saber si tiene la capacidad para ejecutar lo decidido, y que ejecuta sin poder demostrar si eso responde a la estrategia.

El portal busca transformar eso en **una sola conversación continua**: la empresa define su estrategia, esa estrategia se traduce en procesos y actividades concretas, esas actividades se asignan a personas reales con una capacidad horaria real, y el desempeño de todo ese ciclo se puede observar y corregir con datos, no con intuición.

**"Portal de Desempeño Organizacional"** no significa un tablero de indicadores más. Significa que el desempeño de la organización —qué tan bien está ejecutando lo que se propuso— se puede ver de punta a punta: desde la decisión estratégica, pasando por el proceso que la operacionaliza, hasta la persona que la ejecuta y la carga que le representa. El desempeño no se mide solo en resultados finales; se mide también en si la estructura de trabajo diseñada es sostenible para las personas que la sostienen.

La conexión entre estrategia, procesos, personas y operación no es conceptual, es literal en el diseño del portal:

- La **estrategia** (Seguimiento Estratégico, Despliegue Estratégico, Centro de Decisiones) define hacia dónde va la organización y qué decisiones se toman en el camino.
- Los **procesos** (Diseño Organizacional) traducen esa estrategia en la forma concreta en que la empresa trabaja: qué se hace, en qué orden, con qué frecuencia, bajo responsabilidad de quién.
- Las **personas** (Catálogo Organizacional, Balance de Carga) son quienes finalmente ejecutan esos procesos, con una capacidad de tiempo que es finita y real.
- La **operación** es el resultado de cruzar lo anterior: ¿la persona indicada tiene el tiempo real para hacer lo que el proceso le exige, además de los proyectos y compromisos adicionales que la estrategia le va sumando?

Cuando esa cadena se rompe en cualquier punto —un proceso que nadie actualiza, una persona sobrecargada que nadie detecta, una decisión estratégica que nunca se convirtió en actividad— el portal deja de cumplir su propósito. Por eso cada regla técnica que existe en los demás documentos (no perder datos, no romper el vínculo entre `proceso_actividades` y Balance de Carga, no sobrescribir planes) es, en el fondo, una forma de proteger esta cadena.

---

# 2. Filosofía del proyecto

**Una sola fuente de verdad.** Cada dato debe tener un único lugar de origen y todos los demás módulos deben consultarlo desde ahí, no duplicarlo. Un proceso, un rol, una actividad, una persona: se definen una vez y se reutilizan, nunca se vuelven a capturar a mano en otro módulo "porque es más rápido".

**Evitar duplicidad de información.** Si un dato ya existe en un módulo, ningún otro módulo debe inventar su propia copia divergente. La duplicidad no es solo un problema técnico de espacio: es el origen de las inconsistencias que hacen que la gente deje de confiar en el sistema ("aquí dice una cosa y allá dice otra").

**La estrategia dirige la operación**, no al revés. Las decisiones estratégicas y el seguimiento estratégico existen para que la operación tenga una dirección; la operación (procesos, actividades, capacidad) existe para hacer realidad esa dirección, no para justificarla después de los hechos.

**Los procesos generan capacidad**, en el sentido de que son ellos los que definen cuánto trabajo real existe en la organización. Un proceso no es un diagrama decorativo: cada actividad que contiene tiene una duración y una frecuencia, y esa suma es, literalmente, la carga de trabajo que alguien va a tener que sostener.

**Las personas ejecutan actividades.** El proceso describe el trabajo; la persona es quien lo hace, con un límite de horas real por día. El portal existe para que ese límite sea visible antes de que se convierta en un problema, no después.

**Los indicadores miden resultados**, no actividad. Medir cuántas tareas se hicieron no es lo mismo que medir si la organización está más cerca de su estrategia. El seguimiento existe para conectar ambas cosas, no para producir reportes que nadie usa para decidir.

**La tecnología debe facilitar la gestión, no complicarla.** Si una funcionalidad hace que una persona tenga que hacer doble trabajo, recordar reglas no escritas, o desconfiar de si el dato que ve es el real, esa funcionalidad está fallando a su propósito, sin importar qué tan sofisticada sea técnicamente.

---

# 3. Filosofía de Diseño Organizacional

Diseño Organizacional **no es un organigrama.** Un organigrama dice quién le reporta a quién. Diseño Organizacional dice **cómo funciona realmente la empresa**: es el modelo operativo. No responde "¿quién manda sobre quién?", responde "¿qué se hace, en qué orden, con qué frecuencia, y quién es responsable de que ocurra?".

La cadena que describe Diseño Organizacional es siempre la misma, en el mismo orden, sin saltos:

```
Proceso
  ↓
Subproceso
  ↓
Actividad
  ↓
Responsable
  ↓
Carga de trabajo
```

Cada nivel existe para el siguiente. Un proceso sin subprocesos es una idea sin estructura. Un subproceso sin actividades es una intención sin trabajo concreto. Una actividad sin responsable es trabajo que nadie va a hacer. Y una actividad con responsable pero sin datos reales de duración y frecuencia es una carga de trabajo que nadie puede ver venir.

Esto es lo que debe quedar absolutamente claro para cualquier persona o IA que toque este sistema: **Diseño Organizacional siempre es el origen de Balance de Carga, nunca al revés.** Balance de Carga no inventa actividades, no decide cuánto dura una tarea, no decide su frecuencia: todo eso lo hereda de Diseño Organizacional. Si algo está mal en la carga de una persona, la pregunta correcta no es "¿cómo lo arreglo en Balance de Carga?", es "¿el diseño del proceso en Diseño Organizacional está reflejando la realidad?". Corregir el síntoma en el destino sin corregir la causa en el origen rompe la única fuente de verdad que el portal está diseñado para proteger.

---

# 4. Filosofía de Balance de Carga

Balance de Carga es donde el modelo operativo definido en Diseño Organizacional se enfrenta a la realidad de las personas: ¿alcanza el tiempo? Cada una de sus vistas responde una pregunta distinta sobre esa misma realidad.

**CAPACIDAD** — Representa cuánto puede dar una persona, no cuánto se le ha pedido. Es el límite real (horas disponibles por día) contra el cual se compara todo lo demás. Sin esta referencia, ninguna otra vista tiene sentido: no se puede hablar de sobrecarga si no hay una capacidad definida contra la cual compararla.

**ASIGNACIONES** — Representan compromiso adicional que no nace del proceso estándar: proyectos, mejoras, formación, eventos, auditorías. Es trabajo real que también consume tiempo real, pero que no estaba en el diseño operativo original. Existen para que ese trabajo "extra" no quede invisible ni se sume a la carga de alguien sin que nadie lo haya decidido conscientemente.

**PENDIENTES** — Una actividad pendiente es una actividad que Diseño Organizacional ya definió como responsabilidad de una persona o un rol, pero que todavía no tiene un lugar en una agenda concreta. Pendiente no significa "olvidada": significa "diseñada, pero aún no programada en el tiempo". Es el puente entre el modelo operativo y la agenda real.

**SEMANA TÍPICA** — Representa el estándar esperado de una semana normal de trabajo: cómo debería verse la carga de una persona si todo ocurriera según lo diseñado, sin sobresaltos. Es una referencia, no un registro de lo que realmente pasó.

**MES TÍPICO** — Es la misma idea de estándar esperado, pero distribuida en las cuatro semanas del mes, respetando que no todas las actividades ocurren cada semana (algunas son mensuales, quincenales, etc.). Sigue siendo un estándar, no un hecho.

**PLANIFICACIÓN** — Es la realidad que efectivamente se va a ejecutar en una semana o mes concretos. Aquí ya no se habla de lo típico ni de lo esperado: se habla de lo que esa persona, en esas fechas, realmente tiene agendado.

Debe quedar claro que **Semana típica y Mes típico son el estándar esperado; Planeación es la realidad que se ejecutará.** Confundir ambas cosas es el error filosófico más fácil de cometer en este módulo: un estándar existe para comparar y detectar desviaciones, no para reemplazar el registro real de lo que va a pasar. Ninguna decisión operativa concreta ("¿qué hago esta semana?") debería tomarse mirando el estándar típico cuando existe una planeación real disponible.

---

# 5. Filosofía de la capacidad

**La capacidad pertenece a la persona. No pertenece al proceso.** Un proceso puede exigir cierta cantidad de trabajo, pero quien tiene un límite de horas al día es siempre una persona, no un proceso ni un rol abstracto. Esta distinción es la base de todo el módulo de Balance de Carga: no se balancea la carga de "un proceso", se balancea la carga de "alguien".

De ahí se desprende una regla más profunda: **todo lo que exige tiempo de una persona compite por la misma disponibilidad, sin importar de dónde venga.**

- Las **actividades de proceso** consumen capacidad.
- Los **proyectos** consumen capacidad.
- La **formación** consume capacidad.
- Las **mejoras** consumen capacidad.

No existen "horas especiales" para cada tipo de trabajo: existen las horas de la persona, y cada tipo de trabajo pelea por una porción de ese mismo total finito. Un error común de diseño sería tratar la capacidad de proceso y la capacidad de proyectos como si fueran dos recursos separados; no lo son. Si una persona está al 100% de su capacidad de proceso y además se le asigna un proyecto, esa persona está sobrecargada — no tiene "otro balde" de horas para el proyecto. Balance de Carga existe precisamente para hacer visible esa competencia por el mismo recurso antes de que se convierta en una sobrecarga silenciosa.

---

# 6. Filosofía de la planificación

**Planear no significa ejecutar. Programar no significa completar.** Poner una actividad en una semana típica, en un mes típico o incluso en una planificación real es declarar una intención de cuándo se hará el trabajo — no es una confirmación de que el trabajo ya ocurrió. La distinción entre "programado" y "completado" debe mantenerse siempre visible; colapsarlas en un solo estado le quita a la organización la capacidad de saber si lo planeado realmente se cumplió.

**La planeación debe ser flexible.** La realidad operativa cambia: una persona se enferma, una prioridad cambia, una actividad se mueve de día o de semana. El sistema debe permitir mover, reprogramar y ajustar sin fricción, porque una planeación que no se puede ajustar deja de usarse y la organización vuelve a planear "por fuera" del sistema, que es exactamente el problema que el portal busca evitar.

**La programación debe conservar historial.** Ajustar una planificación no es lo mismo que borrarla. Cuando una actividad se mueve, se completa, o se retira de una agenda, debe quedar registro de qué pasó, no solo el estado final. Esto es lo que permite, más adelante, comparar lo típico contra lo real y aprender de la diferencia.

**Nunca deben perderse actividades programadas por un error de sincronización.** Esta es, quizás, la regla más importante de esta sección: si un fallo técnico, una recarga de página, un guardado incompleto o una sincronización fallida hace que una actividad programada desaparezca sin que nadie la haya quitado deliberadamente, el sistema falló en su responsabilidad más básica. La confianza de la organización en el portal depende enteramente de que lo que se planeó no se pierda solo.

---

# 7. Filosofía de los proyectos

**Los proyectos no sustituyen actividades de proceso.** Un proceso es trabajo recurrente y ya diseñado; un proyecto es trabajo adicional, con principio y fin, que se suma sobre la operación normal. Tratar un proyecto como si fuera una actividad de proceso (o viceversa) rompe la distinción que permite entender por qué alguien está sobrecargado: no es lo mismo estar sobrecargado por el diseño operativo mismo, que estarlo por la acumulación de compromisos adicionales.

Los proyectos representan trabajo adicional que puede tomar distintas formas, entre ellas:

- **mejora**
- **implementación**
- **capacitación**
- **auditoría**
- **estrategia**
- **innovación**

Todas comparten la misma naturaleza filosófica: son esfuerzo que la organización decide invertir por encima de su operación estándar, casi siempre en nombre de mejorar esa misma operación o de avanzar la estrategia. Por eso deben registrarse y verse con la misma seriedad que cualquier actividad de proceso, y por eso compiten por la misma capacidad descrita en la sección 5 — nunca son "gratis" solo por ser temporales.

---

# 8. Filosofía del SIG

El Sistema de Gestión Integral (SIG) es la mirada que **audita y da coherencia** a todo lo demás: no es un módulo aislado, es el mecanismo que verifica que la estrategia, los procesos y la operación realmente estén conectados como deberían.

- Con **Procesos** (Diseño Organizacional): el SIG revisa que los procesos estén definidos, documentados y controlados — que exista, en la práctica, el modelo operativo que se supone que la empresa sigue.
- Con **Estrategia** (Despliegue Estratégico, Centro de Decisiones): el SIG verifica que el sistema de gestión esté alineado con la dirección estratégica de la organización, no operando por su cuenta.
- Con **Seguimiento Estratégico**: el SIG comparte la misma lógica de revisión periódica — ambos existen para que la organización se detenga a mirar si lo que se propuso realmente está ocurriendo.
- Con **Madurez Organizacional**: el diagnóstico del SIG y la evaluación de madurez son dos formas complementarias de responder la misma pregunta — qué tan sólida es la forma en que la organización gestiona su trabajo, y cuánto puede mejorar.
- Con **Diagnóstico**: el propio módulo de Diagnóstico SIG es la herramienta concreta de autoevaluación contra los numerales del sistema (contexto de la organización, liderazgo, riesgos, recursos, control operacional, medición, mejora), la forma en que el SIG se mide a sí mismo.
- Con **Balance de Carga**: un sistema de gestión que exige controles, revisiones, auditorías y mejoras genera trabajo real — y ese trabajo también consume la capacidad de las personas descrita en la sección 5. El SIG no puede exigir actividades de control o mejora sin que esas actividades se reflejen, tarde o temprano, como carga real en Balance de Carga.

En el fondo, el SIG es el mecanismo de cierre del ciclo completo descrito en la sección 1: estrategia → procesos → personas → operación → **verificación de que todo eso realmente está pasando como se diseñó**.

---

# 9. Principios de desarrollo

Estos principios traducen la filosofía anterior en comportamiento esperado de quien programa (persona o IA):

- **Nunca romper compatibilidad.** Un cambio no debe invalidar datos, flujos o pantallas que ya funcionan para el usuario actual.
- **Nunca perder información del usuario.** Ningún cambio, migración, refactor o "limpieza" debe tener como efecto secundario la pérdida de un registro ya guardado en Supabase o en `localStorage`.
- **Antes de eliminar, confirmar.** Algo que parece código muerto puede no serlo, o puede serlo pero requerir una decisión explícita de quien es dueño del proyecto, no una decisión unilateral de quien está programando.
- **Antes de refactorizar, analizar impacto.** Un módulo grande no se reduce por gusto estético; se reduce entendiendo primero todo lo que depende de él.
- **Preferir reutilizar lógica.** Si ya existe una función, un servicio o un patrón que resuelve el problema, se reutiliza; no se crea una segunda versión ligeramente distinta.
- **Mantener trazabilidad.** Los cambios importantes (de un rol, un subproceso, una decisión estratégica) deben quedar registrados de forma que se pueda reconstruir qué pasó y por qué, no solo cuál es el estado final.
- **Mantener consistencia visual.** El portal debe sentirse como un solo producto, no como diez pantallas hechas por diez personas distintas en momentos distintos.
- **Evitar duplicidad de código.** La misma lógica no debería existir copiada en dos módulos distintos; si aparece dos veces, es una señal de que falta compartirla.
- **Evitar duplicidad de datos.** El mismo hecho de negocio no debería vivir en dos tablas distintas sin que quede absolutamente claro cuál es la fuente de verdad y cuál es, si acaso, una copia derivada.

---

# 10. Visión futura

Con base únicamente en lo que ya existe en la arquitectura y en la documentación del proyecto (sin inventar módulos nuevos), la evolución natural del Portal Estratégico Vikingo apunta a profundizar la misma cadena que ya está diseñada, no a añadirle piezas ajenas a ella:

- **Cerrar los módulos que hoy son estándar o vista sin conexión de datos** (Inicio Ejecutivo, Despliegue Estratégico, Madurez Organizacional, Diagnóstico SIG, y la parte de Desempeño Organizacional que hoy es un espacio reservado) para que dejen de ser vistas de referencia y pasen a alimentarse de la misma fuente de verdad que ya usan Diseño Organizacional y Balance de Carga. La visión de fondo es que **ningún módulo del portal debería quedarse en el nivel de "dato de ejemplo"** una vez que la organización empieza a depender de él.
- **Profundizar el vínculo entre estrategia y operación** que ya existe conceptualmente (Centro de Decisiones y Seguimiento Estratégico apuntando hacia Diseño Organizacional y Balance de Carga), de modo que una decisión estratégica se pueda seguir, cada vez con más naturalidad, hasta la actividad y la carga de trabajo concreta que genera — cerrando en los datos el mismo círculo que ya está descrito en la sección 1 de este documento.
- **Consolidar una sola fuente de verdad donde hoy existen caminos paralelos**, de forma que cada dato del portal tenga un origen inequívoco y todos los módulos que lo necesiten lo consulten desde ahí, en línea con el principio de la sección 2.
- **Madurar el sistema de permisos y roles** hacia una definición única y centralizada de "quién puede ver y hacer qué", coherente en todos los módulos, en lugar de reglas equivalentes repetidas en distintos lugares.
- **Acompañar el crecimiento del portal con mayor solidez técnica** (pruebas, verificación automática, un proceso de build más robusto) a medida que más personas de la organización dependan de él para tomar decisiones — no como un fin en sí mismo, sino como la forma de seguir protegiendo la confianza que la sección 6 exige: que nada planeado se pierda por un fallo técnico.

La visión de largo plazo no es "agregar más módulos": es que los diez que ya existen funcionen como una sola cadena confiable, de estrategia a operación y de vuelta, sin fugas de información ni pasos que dependan de la memoria de una persona.

---

# 11. Principios para futuras IA

Si eres una IA leyendo este documento antes de modificar el Portal Estratégico Vikingo, tu primera tarea no es escribir código: es entender el negocio que ese código sostiene.

Antes de tocar cualquier archivo, pregúntate, en este orden:

1. **Comprensión del negocio** — ¿Entiendo qué representa este dato o esta pantalla en la cadena estrategia → procesos → personas → operación? Si la respuesta no es clara, detente y pregunta al usuario antes de asumir.
2. **Estabilidad** — ¿Este cambio puede romper algo que hoy funciona para alguien que ya usa el portal en su trabajo real? Este proyecto no es un prototipo: es una herramienta operativa viva.
3. **Trazabilidad** — ¿Voy a dejar rastro suficiente de qué cambié y por qué, de forma que otra persona (o yo mismo, más adelante) pueda entender la decisión sin tener que releer todo el código?
4. **Mantenibilidad** — ¿Estoy dejando el código más fácil o más difícil de entender para el siguiente desarrollador o IA que llegue? Reutilizar y simplificar cuenta; duplicar y "resolver rápido" no.
5. **Escalabilidad** — ¿Esta decisión sigue teniendo sentido si la organización crece, agrega más personas, más procesos o más módulos conectados a la misma fuente de datos?

Antes de terminar cualquier tarea:

- Revisa que lo que hiciste sea **coherente con `CLAUDE.md`**.
- Revisa que sea **coherente con los documentos en `docs/`** (`ARCHITECTURE.md`, `MODULES.md`, `DATABASE.md`, `BUSINESS_RULES.md`, `UI_GUIDELINES.md`, `DEVELOPMENT_RULES.md`, `CHANGELOG.md`, `ROADMAP.md`).
- **No contradigas** ninguno de esos documentos existentes; si tu cambio entra en conflicto con algo ya documentado, resuélvelo con el usuario, no reescribiendo la documentación a tu conveniencia.
- **No modifiques ningún archivo adicional** al estrictamente necesario para la tarea pedida.

Este documento no reemplaza a los demás: los interpreta. `CLAUDE.md` y `docs/*` te dicen cómo está construido el portal hoy y qué reglas técnicas debes seguir. Este documento te dice por qué esas reglas existen. Si algún día tienes que elegir entre una solución técnicamente elegante y una que respeta esta filosofía, elige la que respeta la filosofía — el portal existe para servir a la forma en que la empresa piensa su estrategia, sus procesos, sus personas y su operación, no al revés.
