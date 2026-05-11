import React, { useEffect, useMemo, useState } from "react";

const COLORS = {
  Financiera: "#b88a00",
  Clientes: "#3f5f2f",
  Procesos: "#203f73",
  Desarrollo: "#c96d1a",
};

const STORAGE = {
  darkMode: "vikingo_darkMode",
  activeObjective: "vikingo_activeObjective",
  admin: "vikingo_admin",
  siteAccess: "vikingo_siteAccess",
};

const PROCESS_TYPE_STYLES = {
  "Procesos estratégicos": { color: "#991b1b", bg: "#fee2e2", border: "#fecaca" },
  "Procesos operativos": { color: "#203f73", bg: "#dbeafe", border: "#bfdbfe" },
  "Procesos de apoyo": { color: "#c96d1a", bg: "#ffedd5", border: "#fed7aa" },
};

const processMap = [
  {
    type: "Procesos estratégicos",
    processes: [
      { name: "Planeación estratégica del SIG", owner: "Coordinador Estratégico/SIG" },
      { name: "Planeación financiera", owner: "Finanzas" },
      { name: "Gestión de competencias", owner: "Analista de talento" },
      { name: "Evaluación desempeño del SIG", owner: "Coordinador Estratégico/SIG" },
    ],
  },
  {
    type: "Procesos operativos",
    processes: [
      { name: "Ventas", owner: "Director general" },
      { name: "Ingeniería / Desarrollo de productos", owner: "Ingeniero de producto" },
      { name: "Compras", owner: "Gerente Operaciones" },
      { name: "Planeación y control de la producción", owner: "Gerente Operaciones" },
      { name: "Gestión de inventarios", owner: "Gerente Operaciones" },
      { name: "Control de almacenes", owner: "Gerente Operaciones" },
      { name: "Distribución", owner: "Gerente Operaciones" },
      { name: "Gestión de calidad", owner: "Coordinador de Calidad" },
    ],
  },
  {
    type: "Procesos de apoyo",
    processes: [
      { name: "Recursos humanos", owner: "Recursos humanos" },
      { name: "Gestión de Seguridad y Salud laboral", owner: "Coordinador SST" },
      { name: "Transformación Digital y Automatización", owner: "Analista de procesos" },
      { name: "Contabilidad y Cumplimiento Fiscal", owner: "Finanzas" },
    ],
  },
];

const processAliases = {
  "Planeación y control de la producción": ["Planeación y control producción"],
  "Gestión de inventarios": ["Gestión inventarios"],
  "Gestión de calidad": ["Gestión calidad"],
  "Ingeniería / Desarrollo de productos": ["Ingeniería/Desarrollo de productos"],
  "Gestión de Seguridad y Salud laboral": ["SST"],
};

const objectiveVideos = {
  "OBJ-01": "https://mueblesvikingomx.sharepoint.com/sites/ImplementacindelSIG/_layouts/15/embed.aspx?UniqueId=20883046-7cb8-474a-8686-b5f0355a2cee&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create",
};

const strategicKpiNames = {
  GLOBAL: "% desempeño estratégico",
  "OBJ-01": "Margen neto",
  "OBJ-02": "Ventas mensuales",
  "OBJ-03": "Flujo positivo de caja",
  "OBJ-04": "Desviación presupuestal",
  "OBJ-05": "% clientes rentables",
  "OBJ-06": "OTIF",
  "OBJ-07": "CSAT",
  "OBJ-08": "Volumen de producción",
  "OBJ-09": "Exactitud forecast",
  "OBJ-10": "% pedidos con margen validado",
  "OBJ-11": "% procesos estandarizados",
  "OBJ-12": "Índice compromiso organizacional",
  "OBJ-13": "% cumplimiento competencias",
  "OBJ-14": "% operación digitalizada",
};

const objectives = [
  {
    id: "GLOBAL",
    title: "Desempeño estratégico global ≥ 80%",
    perspective: "Desarrollo",
    owner: "Coordinador Estratégico/SIG",
    risk: "Desalineación estratégica y falta de seguimiento integral del desempeño organizacional",
    purpose: "Garantizar el monitoreo integral del desempeño estratégico y la alineación organizacional mediante seguimiento continuo de indicadores clave.",
    chain: [
      { element: "Seguimiento estratégico", meaning: "Monitorear periódicamente el comportamiento de los indicadores estratégicos organizacionales.", contribution: "Permite detectar desviaciones y priorizar acciones estratégicas." },
      { element: "Control organizacional", meaning: "Mantener visibilidad integral del desempeño de los objetivos estratégicos.", contribution: "Favorece la toma de decisiones basada en información." },
      { element: "Alineación estratégica", meaning: "Asegurar coherencia entre procesos, responsables y resultados estratégicos.", contribution: "Fortalece el cumplimiento organizacional." },
      { element: "Desempeño estratégico global ≥80%", meaning: "Mantener un nivel global de cumplimiento estratégico organizacional igual o superior al 80%.", contribution: "Representa estabilidad y madurez del sistema de gestión estratégica." },
    ],
    deployment: [],
  },
  {
    id: "OBJ-01",
    title: "Rentabilidad ≥ 15%",
    perspective: "Financiera",
    owner: "Director general",
    risk: "Variabilidad en costos operativos y reducción de márgenes comerciales",
    purpose: "Garantizar sostenibilidad financiera mediante operaciones eficientes, controladas y orientadas a valor.",
    chain: [
      { element: "Gestión rentable de pedidos", meaning: "Asegurar que los pedidos generen margen y puedan cumplirse operativamente.", contribution: "Evita ventas no rentables y costos ocultos." },
      { element: "Operación estandarizada", meaning: "Ejecutar procesos con orden, control y menor variabilidad operacional.", contribution: "Reduce errores, retrabajos y desperdicio." },
      { element: "Clientes rentables", meaning: "Desarrollar relaciones comerciales sostenibles y rentables.", contribution: "Prioriza clientes que generan valor." },
      { element: "Rentabilidad ≥15%", meaning: "Lograr una utilidad mínima del 15% para asegurar crecimiento, reinversión y estabilidad financiera.", contribution: "Resultado financiero esperado." },
    ],
    deployment: [
      { process: "Ventas", impact: "Mejora alineación comercial y estabilidad operativa conforme a la demanda planificada.", kpi: "% cumplimiento plan comercial", goal: "≥90%", owner: "Director general" },
      { process: "Compras", impact: "Reduce costos ocultos y asegura estabilidad operacional mediante abastecimiento planificado.", kpi: "Número de compras urgentes", goal: "≤5", owner: "Gerente Operaciones" },
      { process: "Planeación y control producción", impact: "Reduce desviaciones operativas y costos ocultos mediante estabilidad en la ejecución productiva.", kpi: "% producción ejecutada sin desviaciones", goal: "≥90%", owner: "Gerente Operaciones" },
      { process: "Gestión inventarios", impact: "Asegura disponibilidad confiable de materiales conforme a programación operativa.", kpi: "% materiales disponibles conforme programación", goal: "≥90%", owner: "Gerente Operaciones" },
      { process: "Gestión calidad", impact: "Reduce desviaciones y costos operativos mediante detección, control y seguimiento de retrabajos.", kpi: "% productos sin retrabajo", goal: "≥95%", owner: "Coordinador de Calidad" },
      { process: "Distribución", impact: "Reduce costos logísticos y reprocesos mediante entregas completas conforme a lo programado.", kpi: "% entregas completas", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Planeación financiera", impact: "Reduce desviaciones financieras mediante control y seguimiento de gastos operativos no contemplados en la planeación inicial.", kpi: "% gastos no planificados", goal: "≤5%", owner: "Finanzas" },
    ],
  },
  {
    id: "OBJ-02",
    title: "Venta anual ≥ 74 MDP",
    perspective: "Financiera",
    owner: "Director general",
    risk: "Disminución de demanda y baja capacidad comercial de colocación",
    purpose: "Alcanzar el crecimiento comercial proyectado mediante una estrategia rentable y alineada a la capacidad operativa.",
    chain: [
      { element: "Capacidad productiva escalable", meaning: "Desarrollar una operación capaz de incrementar producción manteniendo control, cumplimiento y estabilidad operacional.", contribution: "Permite crecer sin generar saturación, retrasos ni desorden operativo." },
      { element: "Clientes rentables", meaning: "Enfocar ventas en clientes que generan margen, volumen y continuidad comercial.", contribution: "Evita crecer con clientes que consumen recursos sin aportar rentabilidad." },
      { element: "Confiabilidad de entrega", meaning: "Cumplir fechas y condiciones acordadas con el cliente.", contribution: "Fortalece recompra, confianza y relación comercial." },
      { element: "Satisfacción del cliente", meaning: "Medir y mejorar la percepción del cliente sobre producto, servicio y cumplimiento.", contribution: "Aumenta fidelidad, recomendación y permanencia." },
      { element: "Venta anual ≥74 MDP", meaning: "Alcanzar la meta anual de ventas definida por Dirección.", contribution: "Representa crecimiento comercial esperado para el año." },
    ],
    deployment: [
      { process: "Planeación y control producción", impact: "Mantiene capacidad operativa disponible para responder al crecimiento comercial.", kpi: "% capacidad disponible para demanda comercial", goal: "≥90%", owner: "Gerente Operaciones" },
      { process: "Gestión inventarios", impact: "Asegura disponibilidad operativa de producto terminado para cumplimiento de entregas programadas.", kpi: "% PT disponible para entrega", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Gestión calidad", impact: "Fortalece satisfacción y permanencia del cliente mediante liberación conforme de pedidos.", kpi: "% pedidos liberados sin observaciones", goal: "≥95%", owner: "Coordinador de Calidad" },
      { process: "Distribución", impact: "Favorece confianza comercial mediante entregas correctas y sin devoluciones operativas.", kpi: "% entregas sin devolución", goal: "≥95%", owner: "Gerente Operaciones" },
    ],
  },
  {
    id: "OBJ-03",
    title: "Liquidez ≥ 5% sobre ventas",
    perspective: "Financiera",
    owner: "Director general",
    risk: "Incremento cartera vencida y baja recuperación de flujo",
    purpose: "Mantener estabilidad financiera y capacidad de respuesta operativa mediante una adecuada gestión del flujo de efectivo.",
    chain: [
      { element: "Disciplina presupuestal", meaning: "Controlar gastos y ejecutar compras conforme al presupuesto autorizado.", contribution: "Reduce desviaciones y protege el flujo operativo." },
      { element: "Control del flujo de efectivo", meaning: "Monitorear ingresos, egresos y disponibilidad financiera de manera continua.", contribution: "Permite anticipar riesgos de liquidez y tomar decisiones oportunas." },
      { element: "Liquidez operativa", meaning: "Mantener capacidad financiera suficiente para sostener la operación diaria.", contribution: "Evita afectaciones operativas por falta de efectivo." },
      { element: "Liquidez ≥5% sobre ventas", meaning: "Mantener un nivel mínimo de liquidez respecto al volumen de ventas.", contribution: "Asegura estabilidad financiera y capacidad de respuesta operativa." },
    ],
    deployment: [
      { process: "Ventas", impact: "Favorece estabilidad financiera mediante control y reducción de cartera vencida.", kpi: "% cartera vencida", goal: "≤10%", owner: "Director general" },
      { process: "Gestión inventarios", impact: "Favorece liquidez mediante reducción de producto terminado sin salida programada.", kpi: "N° PT sin salida programada", goal: "≤50", owner: "Gerente Operaciones" },
      { process: "Planeación financiera", impact: "Favorece estabilidad financiera mediante seguimiento y control del flujo operativo y recuperación del efectivo.", kpi: "Ciclo de caja", goal: "≤Definir", owner: "Finanzas" },
    ],
  },
  {
    id: "OBJ-04",
    title: "Disciplina presupuestal ≤ 5% desviación",
    perspective: "Financiera",
    owner: "Director general",
    risk: "Ejecución operativa fuera del presupuesto autorizado",
    purpose: "Asegurar el control y cumplimiento financiero mediante una administración basada en planeación y seguimiento presupuestal.",
    chain: [
      { element: "Operación estandarizada", meaning: "Ejecutar procesos con orden, control y menor variabilidad operacional.", contribution: "Reduce desperdicios, errores y desviaciones operativas." },
      { element: "Planeación operativa", meaning: "Coordinar compras, producción y recursos conforme a la demanda y capacidad.", contribution: "Evita gastos no planificados y compras urgentes." },
      { element: "Control presupuestal", meaning: "Dar seguimiento continuo al comportamiento financiero y contra el presupuesto definido.", contribution: "Permite detectar desviaciones y tomar acciones oportunas." },
      { element: "Disciplina presupuestal ≤5%", meaning: "Mantener las desviaciones presupuestales dentro del límite definido por Dirección.", contribution: "Protege estabilidad financiera y sostenibilidad operativa." },
    ],
    deployment: [
      { process: "Todos los procesos", impact: "Favorecen disciplina financiera mediante ejecución operativa conforme al presupuesto autorizado.", kpi: "% desviación presupuestal", goal: "≤5%", owner: "Director general" },
    ],
  },
  {
    id: "OBJ-05",
    title: "Clientes ≥ 90% rentables",
    perspective: "Clientes",
    owner: "Ventas",
    risk: "Ventas con baja rentabilidad y descuentos fuera de política",
    purpose: "Priorizar relaciones comerciales sostenibles enfocadas en clientes con margen y estabilidad operativa.",
    chain: [
      { element: "Gestión rentable de pedidos", meaning: "Validar margen, capacidad y viabilidad operativa antes de aceptar pedidos.", contribution: "Evita ventas que generan pérdidas o desorden operacional." },
      { element: "Confiabilidad de entrega", meaning: "Cumplir consistentemente fechas y condiciones acordadas con el cliente.", contribution: "Fortalece relaciones comerciales sostenibles." },
      { element: "Satisfacción del cliente", meaning: "Mejorar percepción del cliente respecto al servicio y cumplimiento.", contribution: "Incrementa permanencia y recompra." },
      { element: "Relación comercial sostenible", meaning: "Desarrollar relaciones comerciales estables, rentables y de largo plazo.", contribution: "Favorece crecimiento rentable y estabilidad financiera." },
    ],
    deployment: [
      { process: "Gestión calidad", impact: "Favorece cumplimiento de entrega mediante liberación oportuna de pedidos conforme a especificación.", kpi: "% pedidos liberados en tiempo", goal: "≥95%", owner: "Coordinador de Calidad" },
      { process: "Planeación y control producción", impact: "Favorece estabilidad de rentabilidad mediante reducción de desviaciones y costos extraordinarios posteriores a la venta.", kpi: "% pedidos sin costos extraordinarios", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Ventas", impact: "Favorece rentabilidad comercial mediante control de ventas realizadas fuera del margen objetivo definido.", kpi: "% ventas fuera margen objetivo", goal: "≤10%", owner: "Director general" },
    ],
  },
  {
    id: "OBJ-06",
    title: "Confiabilidad de entregas ≥ 95%",
    perspective: "Clientes",
    owner: "Ventas",
    risk: "Incumplimiento operativo y desviaciones en entrega de pedidos",
    purpose: "Garantizar entregas completas y oportunas mediante procesos coordinados y controlados.",
    chain: [
      { element: "Alineación demanda-capacidad", meaning: "Coordinar ventas, producción y recursos conforme a la capacidad real de operación.", contribution: "Reduce saturación, urgencias y reprogramaciones." },
      { element: "Capacidad productiva escalable", meaning: "Mantener una operación capaz de responder al crecimiento sin perder control operativo.", contribution: "Permite cumplir producción y entregas de manera estable." },
      { element: "Operación estandarizada", meaning: "Ejecutar procesos bajo estándares definidos y controlados.", contribution: "Reduce errores, retrasos y variabilidad operacional." },
      { element: "Cumplimiento operacional", meaning: "Ejecutar la operación de forma coordinada y conforme a lo planeado.", contribution: "Asegura entregas consistentes y fortalece la confianza del cliente." },
    ],
    deployment: [
      { process: "Ventas", impact: "Favorece confiabilidad de entrega mediante captura correcta y completa de pedidos desde el inicio del proceso.", kpi: "% pedidos capturados correctamente", goal: "≥95%", owner: "Director general" },
      { process: "Planeación y control producción", impact: "Favorece estabilidad de entrega mediante ejecución productiva conforme a la programación establecida.", kpi: "% producción conforme programación", goal: "≥90%", owner: "Gerente Operaciones" },
      { process: "Gestión inventarios", impact: "Favorece confiabilidad de entrega mediante control y exactitud del inventario de producto terminado.", kpi: "% exactitud inventario PT", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Control de almacenes", impact: "Favorece confiabilidad del inventario mediante control y reducción de diferencias detectadas en conteos cíclicos.", kpi: "% diferencias inventario almacén", goal: "≤5%", owner: "Gerente Operaciones" },
      { process: "Distribución", impact: "Favorece cumplimiento logístico mediante ejecución de rutas y entregas conforme a programación definida.", kpi: "% rutas ejecutadas conforme programación", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Distribución", impact: "Favorece confiabilidad de entrega mediante disponibilidad y mantenimiento oportuno de unidades de transporte conforme a la planeación establecida.", kpi: "% cumplimiento mantenimiento transporte", goal: "≥95%", owner: "Gerente Operaciones" },
    ],
  },
  {
    id: "OBJ-07",
    title: "Satisfacción del 90% en CSAT",
    perspective: "Clientes",
    owner: "Ventas",
    risk: "Incremento de incidencias y reclamaciones del cliente",
    purpose: "Fortalecer la percepción y confianza del cliente mediante productos y servicios consistentes.",
    chain: [
      { element: "Operación estandarizada", meaning: "Ejecutar procesos bajo estándares definidos y controlados.", contribution: "Reduce errores, variabilidad y fallas percibidas por el cliente." },
      { element: "Confiabilidad de entrega", meaning: "Cumplir fechas y condiciones acordadas de manera consistente.", contribution: "Genera confianza y estabilidad en la relación comercial." },
      { element: "Atención y respuesta al cliente", meaning: "Dar seguimiento oportuno a necesidades, dudas y problemas del cliente.", contribution: "Mejora la experiencia y percepción del servicio." },
      { element: "Experiencia positiva del cliente", meaning: "Lograr que el cliente perciba valor, cumplimiento y confianza en la empresa.", contribution: "Incrementa satisfacción, permanencia y recomendación comercial." },
    ],
    deployment: [
      { process: "Gestión calidad", impact: "Favorece percepción positiva del cliente mediante reducción de incidencias y reclamaciones posteriores a la entrega.", kpi: "% clientes sin reclamaciones", goal: "≥95%", owner: "Coordinador de Calidad" },
      { process: "Ventas", impact: "Favorece satisfacción del cliente mediante seguimiento y atención adecuada durante la gestión y experiencia del pedido.", kpi: "% pedidos sin incidencias comerciales", goal: "≥95%", owner: "Director general" },
      { process: "Distribución", impact: "Favorece experiencia positiva de entrega mediante reducción de incidencias, malas maniobras u otros.", kpi: "% entregas sin incidencias", goal: "≥95%", owner: "Gerente Operaciones" },
    ],
  },
  {
    id: "OBJ-08",
    title: "Producción anual ≥ 31,000 unidades",
    perspective: "Procesos",
    owner: "Planeación",
    risk: "Saturación operativa y capacidad insuficiente de producción",
    purpose: "Cumplir la demanda comercial mediante una capacidad productiva controlada, eficiente y escalable.",
    chain: [
      { element: "Validación comercial", meaning: "Revisar condiciones comerciales, margen y viabilidad antes de aceptar pedidos.", contribution: "Evita ventas no rentables o inviables operativamente." },
      { element: "Alineación demanda-capacidad", meaning: "Coordinar pedidos con capacidad real de producción y entrega.", contribution: "Reduce saturación, urgencias y retrasos." },
      { element: "Control operacional", meaning: "Ejecutar pedidos con seguimiento, control y coordinación entre procesos.", contribution: "Reduce desviaciones, errores y costos ocultos." },
      { element: "Protección del margen", meaning: "Mantener equilibrio entre ventas, costos y capacidad operativa.", contribution: "Favorece estabilidad financiera y crecimiento rentable." },
    ],
    deployment: [
      { process: "Ventas", impact: "Favorece gestión rentable de pedidos mediante control de excepciones comerciales durante el proceso de cotización.", kpi: "% cotizaciones con excepción comercial", goal: "≤10%", owner: "Director general" },
    ],
  },
  {
    id: "OBJ-09",
    title: "Alineación demanda-capacidad ≥ 90%",
    perspective: "Procesos",
    owner: "Ventas",
    risk: "Pedidos urgentes fuera de planeación comercial y operativa",
    purpose: "Sincronizar ventas, planeación y operación para reducir sobrecargas, incumplimientos y desperdicios.",
    chain: [
      { element: "Integración comercial-operativa", meaning: "Coordinar ventas, producción y abastecimiento bajo una visión compartida de demanda y capacidad.", contribution: "Reduce decisiones aisladas y conflictos operativos." },
      { element: "Planeación sincronizada", meaning: "Balancear demanda, materiales, capacidad y entregas conforme a prioridades del negocio.", contribution: "Evita saturación, urgencias y desabasto." },
      { element: "Capacidad operativa controlada", meaning: "Mantener visibilidad y control sobre la capacidad real de operación.", contribution: "Permite responder al crecimiento sin perder estabilidad." },
      { element: "Ejecución coordinada", meaning: "Ejecutar la operación conforme a lo planeado entre áreas clave.", contribution: "Mejora cumplimiento, estabilidad y eficiencia operacional." },
    ],
    deployment: [
      { process: "Ventas", impact: "Favorece alineación demanda-capacidad mediante reducción de pedidos urgentes fuera de la planeación comercial establecida.", kpi: "% pedidos urgentes", goal: "≤5%", owner: "Director general" },
      { process: "Planeación y control producción", impact: "Favorece alineación demanda-capacidad mediante cumplimiento del plan maestro de producción conforme a la capacidad operativa definida.", kpi: "% cumplimiento plan maestro producción", goal: "≥90%", owner: "Gerente Operaciones" },
      { process: "Compras", impact: "Favorece alineación demanda-capacidad mediante cumplimiento del plan de compra conforme a la programación operativa definida.", kpi: "% cumplimiento plan de compra", goal: "≥95%", owner: "Gerente Operaciones" },
      { process: "Recursos humanos", impact: "Favorece alineación demanda-capacidad mediante cobertura oportuna de vacantes y requerimientos operativos planificados.", kpi: "% cobertura vacantes planificadas", goal: "≥95%", owner: "Recursos humanos" },
      { process: "Planeación y control producción", impact: "Favorece alineación demanda-capacidad mediante ejecución del mantenimiento conforme a la planeación operativa establecida.", kpi: "% cumplimiento mantenimiento planificado", goal: "≥95%", owner: "Gerente Operaciones" },
    ],
  },
  {
    id: "OBJ-10",
    title: "Gestión rentable de pedidos ≥ 95%",
    perspective: "Procesos",
    owner: "Ventas",
    risk: "Pedidos liberados con desviaciones de costo y margen",
    purpose: "Asegurar que los pedidos procesados cumplan criterios de rentabilidad, viabilidad y control operativo.",
    chain: [
      { element: "Operación estandarizada", meaning: "Ejecutar procesos productivos bajo estándares definidos y controlados.", contribution: "Reduce variabilidad y facilita crecimiento ordenado." },
      { element: "Planeación sincronizada", meaning: "Coordinar demanda, producción, materiales y capacidad operativa.", contribution: "Evita saturación y desbalance operativo." },
      { element: "Recursos operativos disponibles", meaning: "Asegurar disponibilidad de personal, materiales, maquinaria y capacidad instalada.", contribution: "Permite sostener incremento de producción sin interrupciones." },
      { element: "Escalabilidad operacional", meaning: "Incrementar capacidad manteniendo control, estabilidad y cumplimiento operacional.", contribution: "Favorece crecimiento sostenible y cumplimiento de producción." },
    ],
    deployment: [
      { process: "Planeación y control producción", impact: "Favorece capacidad productiva escalable mediante aprovechamiento y balance adecuado de la capacidad operativa instalada.", kpi: "% utilización capacidad instalada", goal: "80%", owner: "Gerente Operaciones" },
      { process: "Ingeniería/Desarrollo de productos", impact: "Favorece capacidad productiva escalable mediante estandarización y estabilidad de los procesos operativos.", kpi: "% procesos productivos estandarizados", goal: "≥80%", owner: "Ingeniero de producto" },
      { process: "Ingeniería/Desarrollo de productos", impact: "Favorece escalabilidad operativa mediante validación y liberación de productos compatibles con la capacidad productiva definida.", kpi: "% productos validados para fabricación", goal: "≥80%", owner: "Ingeniero de producto" },
    ],
  },
  {
    id: "OBJ-11",
    title: "Gestión estandarizada de procesos ≥ 90%",
    perspective: "Desarrollo",
    owner: "Coordinador Estratégico/SIG",
    risk: "Procesos no documentados o ejecutados fuera de metodología SIG",
    purpose: "Garantizar disciplina operativa y trazabilidad mediante procesos documentados, controlados y ejecutados de forma homogénea.",
    chain: [
      { element: "Gestión por procesos", meaning: "Definir y gestionar la operación mediante procesos claramente estructurados e interrelacionados.", contribution: "Permite controlar la organización de forma integral y alineada." },
      { element: "Información documentada", meaning: "Mantener procesos, responsabilidades y controles formalmente documentados y disponibles.", contribution: "Facilita claridad, trazabilidad y continuidad operacional." },
      { element: "Aplicación de estándares", meaning: "Ejecutar actividades conforme a lineamientos, procedimientos y controles definidos.", contribution: "Reduce variabilidad y fortalece estabilidad operacional." },
      { element: "Institucionalización operacional", meaning: "Consolidar una operación basada en procesos, control y mejora continua organizacional.", contribution: "Favorece crecimiento sostenible, control y madurez organizacional." },
    ],
    deployment: [
      { process: "Todos los procesos", impact: "Favorece gestión estandarizada mediante diagnóstico e implementación del SIG en los procesos de la organización.", kpi: "% diagnóstico implementación SIG", goal: "≥90%", owner: "Coordinador Estratégico/SIG", strategic: false },
      { process: "Compras", impact: "Favorece gestión estandarizada mediante ejecución del plan de evaluación de proveedores definido por la organización.", kpi: "% cumplimiento plan evaluación proveedores", goal: "≥90%", owner: "Gerente Operaciones" },
    ],
  },
  {
    id: "OBJ-12",
    title: "Compromiso organizacional ≥90%",
    perspective: "Desarrollo",
    owner: "Director general",
    risk: "Baja ejecución de acciones y debilitamiento del compromiso organizacional",
    purpose: "Fortalecer la participación y alineación del personal con la estrategia, cultura y objetivos organizacionales.",
    chain: [
      { element: "Disciplina operativa", meaning: "Fortalecer ejecución, seguimiento y cumplimiento dentro de la operación organizacional.", contribution: "Mejora alineación, estabilidad y control operativo." },
      { element: "Participación organizacional", meaning: "Involucrar al personal en objetivos, procesos y mejora continua.", contribution: "Incrementa compromiso y sentido de pertenencia." },
      { element: "Cultura de ejecución", meaning: "Promover disciplina, responsabilidad y cumplimiento en la operación diaria.", contribution: "Favorece estabilidad y desempeño organizacional." },
      { element: "Alineación organizacional", meaning: "Mantener al personal orientado a los objetivos estratégicos y operativos de la empresa.", contribution: "Fortalece ejecución, coordinación y sostenibilidad organizacional." },
    ],
    deployment: [
      { process: "Todos los procesos", impact: "Favorecen compromiso organizacional mediante cumplimiento oportuno de acciones y compromisos asignados dentro de la operación organizacional.", kpi: "% acciones ejecutadas en tiempo", goal: "≥90%", owner: "Project Manager", strategic: false },
      { process: "Recursos humanos", impact: "Favorece estabilidad y compromiso organizacional mediante seguimiento de asistencia y permanencia del personal operativo y administrativo.", kpi: "% ausentismo operativo", goal: "≤3%", owner: "Recursos humanos" },
      { process: "Recursos humanos", impact: "Favorece estabilidad organizacional mediante permanencia y continuidad del personal dentro de la operación organizacional.", kpi: "% rotación personal", goal: "≤10%", owner: "Recursos humanos" },
      { process: "Recursos humanos", impact: "Favorece disciplina y cultura organizacional mediante control y seguimiento de incidencias relacionadas al cumplimiento interno.", kpi: "N° incidencias disciplinarias", goal: "≤5", owner: "Recursos humanos" },
      { process: "SST", impact: "Favorece compromiso y estabilidad organizacional mediante prevención de accidentes y condiciones inseguras en la operación.", kpi: "N° accidentes incapacitantes", goal: "2", owner: "Coordinador SST" },
    ],
  },
  {
    id: "OBJ-13",
    title: "Competencias validadas ≥ 80% global",
    perspective: "Desarrollo",
    owner: "Analista de talento",
    risk: "Brechas de competencia y baja ejecución del plan de desarrollo",
    purpose: "Asegurar que el personal cuente con las competencias necesarias para ejecutar eficazmente sus funciones y responsabilidades.",
    chain: [
      { element: "Competencias definidas", meaning: "Establecer conocimientos, habilidades y responsabilidades requeridas para cada proceso y puesto.", contribution: "Permite alinear capacidades con necesidades operativas y estratégicas." },
      { element: "Desarrollo de competencias", meaning: "Fortalecer capacidades técnicas, operativas y de gestión conforme a los procesos organizacionales.", contribution: "Mejora desempeño y capacidad de ejecución." },
      { element: "Evaluación del desempeño", meaning: "Verificar aplicación efectiva de competencias en la operación diaria.", contribution: "Permite detectar brechas y oportunidades de mejora." },
      { element: "Capacidad organizacional", meaning: "Mantener personal competente y alineado a la estrategia del negocio.", contribution: "Sostiene crecimiento, estabilidad y mejora continua." },
    ],
    deployment: [
      { process: "Todos los procesos", impact: "Favorecen desarrollo de competencias mediante cumplimiento del plan de desarrollo definido para el personal.", kpi: "% cumplimiento plan desarrollo", goal: "≥90%", owner: "Analista de talento", strategic: false },
      { process: "Recursos humanos", impact: "Favorece desarrollo y fortalecimiento de competencias mediante ejecución del plan anual de capacitación del personal operativo.", kpi: "% cumplimiento plan anual capacitación", goal: "≥90%", owner: "Recursos humanos" },
    ],
  },
  {
    id: "OBJ-14",
    title: "Operación digital integrada ≥ 90%",
    perspective: "Desarrollo",
    owner: "Analista de procesos",
    risk: "Baja adopción de herramientas digitales y dependencia operativa manual",
    purpose: "Integrar procesos, información y herramientas digitales para mejorar control, trazabilidad y toma de decisiones.",
    chain: [
      { element: "Captura digital de información", meaning: "Registrar datos operativos y estratégicos de forma digital y estructurada.", contribution: "Reduce errores, pérdida de información y retrabajos administrativos." },
      { element: "Trazabilidad operacional", meaning: "Mantener seguimiento y visibilidad de la información a lo largo de los procesos.", contribution: "Facilita control, análisis y toma de decisiones." },
      { element: "Integración de sistemas", meaning: "Conectar herramientas, procesos y fuentes de información organizacional.", contribution: "Evita duplicidad y mejora coordinación entre áreas." },
      { element: "Gestión basada en datos", meaning: "Utilizar información confiable para seguimiento, control y toma de decisiones.", contribution: "Mejora capacidad de respuesta y control organizacional." },
    ],
    deployment: [
      { process: "Todos los procesos", impact: "Favorece operación digital integrada mediante uso y adopción de herramientas digitales definidas para la ejecución y control de la operación.", kpi: "% uso herramientas digitales", goal: "≥90%", owner: "Analista de procesos", strategic: false },
    ],
  },
];

function safeGetBoolean(key, fallback = false) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) === "true";
}

function safeGetString(key, fallback) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function groupByPerspective(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.perspective]) acc[item.perspective] = [];
    acc[item.perspective].push(item);
    return acc;
  }, {});
}

function getProcessNamesForMatch(selectedProcess) {
  return [selectedProcess, ...(processAliases[selectedProcess] || [])];
}

function getRelationType(dep, selectedProcess, owner) {
  if (dep.process === "Todos los procesos") return "Proceso transversal";
  if (dep.owner === owner) return "Proceso líder";
  return "Proceso de soporte";
}

function extractGoal(title) {
  return title.match(/(≥|≤|=).*$/)?.[0] || title;
}

function statusClasses(status) {
  if (status === "Activo") return "bg-green-100 text-green-700";
  if (status === "Atención") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

function runDataChecks() {
  console.assert(objectives.length === 15, "Debe haber 15 objetivos estratégicos");
  console.assert(Object.keys(strategicKpiNames).length === 15, "Debe existir nombre de KPI estratégico para cada objetivo");
  console.assert(Object.keys(objectiveVideos).includes("OBJ-01"), "OBJ-01 debe tener video vinculado");
  console.assert(objectives.every((o) => o.id && o.title && o.perspective), "Cada objetivo debe tener id, título y perspectiva");
  console.assert(objectives.every((o) => Array.isArray(o.chain) && o.chain.length > 0), "Cada objetivo debe tener cadena causa-efecto");
  console.assert(objectives.every((o) => Array.isArray(o.deployment) && (o.id === "GLOBAL" || o.deployment.length > 0)), "Cada objetivo operativo debe tener despliegue estratégico");
  console.assert(strategicKpiNames.GLOBAL === "% desempeño estratégico", "Debe existir KPI global de desempeño estratégico");
  console.assert(objectives.some((o) => o.id === "OBJ-11" && o.owner === "Coordinador Estratégico/SIG"), "OBJ-11 debe pertenecer al Coordinador Estratégico/SIG");
  console.assert(objectives.find((o) => o.id === "GLOBAL")?.deployment.length === 0, "El KPI global no debe aparecer como KPI de todos los procesos");
  console.assert(processMap.flatMap((group) => group.processes).some((p) => p.name === "Ingeniería / Desarrollo de productos" && p.owner === "Ingeniero de producto"), "Desarrollo de productos debe tener dueño Ingeniero de producto");
  console.assert(processMap.flatMap((group) => group.processes).some((p) => p.name === "Gestión de calidad" && p.owner === "Coordinador de Calidad"), "Calidad debe tener dueño Coordinador de Calidad");
  console.assert(getProcessNamesForMatch("Gestión de inventarios").includes("Gestión inventarios"), "La vista proceso debe reconocer alias de procesos reales");
}

runDataChecks();

function Badge({ children, className = "" }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-black ${className}`}>{children}</span>;
}

function KpiTypeBadge({ strategic = false, global = false }) {
  const className = global ? "bg-[#b88a00]" : strategic ? "bg-red-600" : "bg-[#203f73]";
  const label = global ? "KPI Global" : strategic ? "KPI Estratégico" : "KPI Táctico";
  return <div className={`px-2 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</div>;
}

function RelationBadge({ relation }) {
  const styles = {
    "Proceso líder": "bg-red-100 text-red-700",
    "Proceso de soporte": "bg-blue-100 text-blue-700",
    "Proceso transversal": "bg-amber-100 text-amber-700",
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${styles[relation] || "bg-gray-100 text-gray-700"}`}>{relation}</span>;
}

function KpiCard({ dep, darkMode, strong, muted, relation }) {
  const isGlobal = dep.kpi === "% desempeño estratégico";
  const strategic = dep.strategic !== undefined ? dep.strategic : dep.process === "Todos los procesos";

  return (
    <div className={`${darkMode ? "bg-[#0b1120]" : "bg-gray-50"} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-xs uppercase font-black text-gray-400">KPI {dep.process}</div>
        <KpiTypeBadge strategic={strategic} global={isGlobal} />
        {relation && <RelationBadge relation={relation} />}
      </div>
      <div className={`mt-2 font-black ${strong}`}>{dep.kpi}</div>
      <div className={`mt-2 text-xs ${muted}`}>{dep.impact}</div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <div className="text-xs uppercase font-black text-gray-400">Meta 2026</div>
          <div className={`font-bold ${strong}`}>{dep.goal}</div>
        </div>
        <div>
          <div className="text-xs uppercase font-black text-gray-400">Responsable</div>
          <div className={`font-bold ${strong}`}>{dep.owner}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const strategicObjectives = useMemo(() => objectives.filter((item) => item.id !== "GLOBAL"), []);
  const [darkMode, setDarkMode] = useState(() => safeGetBoolean(STORAGE.darkMode));
  const [isAdmin, setIsAdmin] = useState(() => safeGetBoolean(STORAGE.admin));
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [activeId, setActiveId] = useState(() => {
    const stored = safeGetString(STORAGE.activeObjective, "OBJ-05");
    return stored === "GLOBAL" ? "OBJ-05" : stored;
  });
  const [activeView, setActiveView] = useState("Dashboard");
  const [previousView, setPreviousView] = useState(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [siteUnlocked, setSiteUnlocked] = useState(() => safeGetBoolean(STORAGE.siteAccess));
  const [sitePassword, setSitePassword] = useState("");
  const [siteAccessError, setSiteAccessError] = useState("");

  const perspectiveGroups = useMemo(() => groupByPerspective(strategicObjectives), [strategicObjectives]);
  const responsibleCards = useMemo(() => {
    const owners = objectives.flatMap((item) => [item.owner, ...item.deployment.map((dep) => dep.owner)]);
    return [...new Set(owners.filter((owner) => owner && owner !== "Ventas" && owner !== "Planeación"))];
  }, []);
  const processCards = useMemo(() => {
    return processMap
      .flatMap((group) => group.processes.map((process) => process.name))
      .filter((process) => process !== "Contabilidad y Cumplimiento Fiscal");
  }, []);
  const [selectedResponsible, setSelectedResponsible] = useState(responsibleCards[0] || "");
  const [selectedProcess, setSelectedProcess] = useState(processCards[0] || "");

  const activeObjective = strategicObjectives.find((item) => item.id === activeId) || strategicObjectives[0];

  const selectedProcessData = useMemo(() => {
    return processMap
      .flatMap((group) => group.processes.map((process) => ({ ...process, type: group.type })))
      .find((process) => process.name === selectedProcess);
  }, [selectedProcess]);

  const responsibleObjectives = useMemo(() => {
    return objectives.filter((objective) =>
      objective.owner === selectedResponsible ||
      (objective.id === "GLOBAL" && selectedResponsible === "Director general") ||
      objective.deployment.some(
        (dep) => dep.owner === selectedResponsible || (dep.process === "Todos los procesos" && selectedResponsible !== "Finanzas")
      )
    );
  }, [selectedResponsible]);

  const processObjectives = useMemo(() => {
    const processNames = getProcessNamesForMatch(selectedProcess);

    return strategicObjectives
      .map((objective) => ({
        ...objective,
        deployment: objective.deployment.filter((dep) =>
          processNames.includes(dep.process) || dep.process === "Todos los procesos"
        ),
      }))
      .filter((objective) => objective.deployment.length > 0);
  }, [selectedProcess, strategicObjectives]);

  const processContributionMap = {
    "Ventas": "Conecta la demanda comercial con la estrategia financiera y el crecimiento rentable del negocio.",
    "Ingeniería / Desarrollo de productos": "Asegura productos viables, estandarizados y compatibles con la capacidad operativa.",
    "Compras": "Garantiza abastecimiento estratégico y estabilidad operativa conforme a la planeación.",
    "Planeación y control de la producción": "Sincroniza capacidad, demanda y ejecución operativa para cumplir objetivos estratégicos.",
    "Gestión de inventarios": "Mantiene disponibilidad y control de materiales para asegurar continuidad operativa.",
    "Control de almacenes": "Fortalece exactitud y confiabilidad de inventarios dentro de la operación.",
    "Distribución": "Asegura cumplimiento logístico y confiabilidad en las entregas al cliente.",
    "Gestión de calidad": "Garantiza cumplimiento de estándares y reducción de desviaciones operativas.",
    "Planeación estratégica del SIG": "Alinea procesos, indicadores y estrategia organizacional mediante el SIG.",
    "Planeación financiera": "Controla estabilidad financiera y disciplina presupuestal organizacional.",
    "Gestión de competencias": "Fortalece capacidades organizacionales y desarrollo del talento.",
    "Evaluación desempeño del SIG": "Monitorea el cumplimiento y madurez del sistema estratégico organizacional.",
    "Recursos humanos": "Impulsa estabilidad organizacional mediante gestión y permanencia del talento.",
    "Gestión de Seguridad y Salud laboral": "Protege la continuidad operativa mediante condiciones seguras de trabajo.",
    "Transformación Digital y Automatización": "Integra herramientas digitales para mejorar trazabilidad y control operativo.",
  };

  const activeColor = COLORS[activeObjective.perspective] || "#111827";
  const card = darkMode ? "bg-[#111827] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800";
  const muted = darkMode ? "text-gray-400" : "text-gray-500";
  const strong = darkMode ? "text-white" : "text-gray-800";

  useEffect(() => {
    window.localStorage.setItem(STORAGE.darkMode, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.admin, String(isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.siteAccess, String(siteUnlocked));
  }, [siteUnlocked]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.activeObjective, activeId === "GLOBAL" ? "OBJ-05" : activeId);
  }, [activeId]);

  const unlockSite = () => {
    if (sitePassword.trim() === "vikingo2026") {
      setSiteUnlocked(true);
      setSitePassword("");
      setSiteAccessError("");
    } else {
      setSiteAccessError("Contraseña incorrecta");
    }
  };

  const login = () => {
    if (user.trim() === "admin" && password === "vikingo") {
      setIsAdmin(true);
      setShowLogin(false);
      setUser("");
      setPassword("");
    }
  };

  const openDashboardObjective = (id) => {
    if (id === "GLOBAL") return;
    setPreviousView(activeView);
    setActiveId(id);
    setActiveView("Dashboard");
  };

  const openProcessView = (processName) => {
    if (processName === "Contabilidad y Cumplimiento Fiscal") return;
    setPreviousView(activeView);
    setSelectedProcess(processName);
    setActiveView("Vista proceso");
  };

  const openObjectiveVideo = () => {
    const videoUrl = objectiveVideos[activeObjective.id];
    if (!videoUrl) return;
    setActiveVideoUrl(videoUrl);
    setActiveVideoTitle(`${activeObjective.id} | ${activeObjective.title}`);
  };

  const visibleDeploymentsForResponsible = (objective) =>
    objective.deployment.filter((dep) => {
      const appliesByOwner = dep.owner === selectedResponsible;
      const appliesByTransversal = dep.process === "Todos los procesos" && selectedResponsible !== "Finanzas";
      const hideCoordinatorSigTactical =
        selectedResponsible === "Coordinador Estratégico/SIG" &&
        objective.id === "OBJ-11" &&
        dep.kpi === "% diagnóstico implementación SIG";
      return (appliesByOwner || appliesByTransversal) && !hideCoordinatorSigTactical;
    });

  if (!siteUnlocked) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-[#111827] px-8 py-8 text-white">
            <div className="text-3xl font-black tracking-wide">VIKIN<span className="text-red-500">GO</span></div>
            <div className="mt-2 text-lg font-semibold">Portal Estratégico</div>
            <div className="text-sm text-gray-400 mt-1">Acceso privado</div>
          </div>

          <div className="p-8 space-y-5">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Ingresar al portal</h1>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Este sitio es privado. Ingresa la contraseña para visualizar el contenido estratégico.
              </p>
            </div>

            <input
              type="password"
              placeholder="Contraseña"
              value={sitePassword}
              onChange={(event) => setSitePassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlockSite();
              }}
              className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800"
            />

            {siteAccessError && (
              <div className="text-sm font-bold text-red-600">{siteAccessError}</div>
            )}

            <button
              onClick={unlockSite}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black shadow-lg transition-all"
            >
              Acceder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-all ${darkMode ? "bg-[#0b1120] text-white" : "bg-[#f4f5f7] text-gray-800"}`}>
      <aside className="w-[270px] min-h-screen bg-[#111827] text-white flex flex-col justify-between shadow-2xl sticky top-0 left-0">
        <div>
          <div className="px-8 py-8 border-b border-white/10">
            <div className="text-3xl font-black tracking-wide">VIKIN<span className="text-red-500">GO</span></div>
            <div className="mt-2 text-lg font-semibold">Portal Estratégico</div>
            <div className="text-sm text-gray-400 mt-1">Muebles Vikingo</div>
          </div>
          <nav className="px-4 py-6 space-y-2">
            {["Dashboard", "Mapa estratégico", "Mapa de procesos", "Vista responsable", "Vista proceso", "Captura estratégica"].map((item) => (
              <button
                key={item}
                onClick={() => setActiveView(item)}
                className={`w-full text-left px-5 py-3 rounded-2xl transition-all font-medium ${activeView === item ? "bg-red-600 shadow-lg" : "text-gray-300 hover:bg-white/10"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-5 border-t border-white/10 space-y-3">
          <button onClick={() => (isAdmin ? setIsAdmin(false) : setShowLogin(true))} className="w-full bg-red-600 hover:bg-red-700 rounded-2xl py-3 font-semibold">
            {isAdmin ? "🔓 Cerrar admin" : "🔐 Acceso admin"}
          </button>
          <button onClick={() => setDarkMode((value) => !value)} className="w-full bg-white/10 hover:bg-white/20 rounded-2xl py-3 font-semibold text-gray-200">
            {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          </button>
        </div>
      </aside>

      {activeVideoUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? "bg-[#111827] text-white" : "bg-white text-gray-800"} w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-white/10`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20">
              <div>
                <div className="text-xs uppercase tracking-wide font-black text-gray-400">Video estratégico</div>
                <div className="font-black">{activeVideoTitle}</div>
              </div>
              <button
                onClick={() => setActiveVideoUrl(null)}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black transition-all"
              >
                ×
              </button>
            </div>
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-black min-h-[320px] flex items-center justify-center p-10">
              <div className="text-center max-w-xl">
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white text-3xl mx-auto shadow-2xl mb-6">
                  ▶
                </div>
                <div className="text-2xl font-black mb-3">{activeVideoTitle}</div>
                <div className="text-sm text-gray-500 leading-relaxed mb-8">
                  El entorno de vista previa bloquea iframes externos de SharePoint.
                  Para evitar solicitudes de permisos y bloqueos, el video se abrirá directamente en una pestaña limpia de Microsoft Stream/SharePoint.
                </div>

                <button
                  onClick={() => window.open(activeVideoUrl, "_blank", "noopener,noreferrer")}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl transition-all"
                >
                  ▶ Abrir video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-[420px] text-gray-800">
            <div className="text-3xl font-black mb-2">Acceso estratégico</div>
            <div className="text-gray-500 mb-8">Portal Estratégico Vikingo</div>
            <div className="space-y-5">
              <input placeholder="Usuario" value={user} onChange={(event) => setUser(event.target.value)} className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20" />
              <input type="password" placeholder="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20" />
              <button onClick={login} className="w-full bg-[#111827] hover:bg-black text-white py-4 rounded-2xl font-black shadow-lg">INGRESAR</button>
              <button onClick={() => setShowLogin(false)} className="w-full text-gray-500 font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className={`${darkMode ? "bg-[#111827] border-white/10" : "bg-white border-gray-200"} min-h-[92px] px-4 lg:px-10 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm border-b`}>
          <div>
            <h1 className={`text-2xl lg:text-3xl font-black tracking-tight ${strong}`}>ANÁLISIS DE LA ESTRATEGIA</h1>
            <p className={`mt-1 ${muted} font-medium text-sm lg:text-base`}>Objetivo → Cadena → Despliegue estratégico → Proceso → Responsable</p>
          </div>
          <div className={`${darkMode ? "bg-white/20 text-white" : "bg-white/80 text-gray-700"} rounded-2xl px-5 py-3 text-sm font-bold shadow-sm`}>09 Mayo 2026</div>
        </header>

        <section className="p-4 lg:p-8 overflow-auto space-y-8">
          {activeView === "Dashboard" && (
            <div className="space-y-8">
              {previousView && (
                <button
                  onClick={() => setActiveView(previousView)}
                  className={`${darkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800"} px-5 py-3 rounded-2xl font-black transition-all`}
                >
                  ← Volver a {previousView}
                </button>
              )}
              <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
                <div className="p-5 lg:p-6 grid grid-cols-1 xl:grid-cols-[1.6fr_.75fr] gap-4 items-center">
                  <div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Objetivo estratégico</div>
                      {objectiveVideos[activeObjective.id] ? (
                        <button
                          onClick={openObjectiveVideo}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black px-3 py-2 rounded-xl shadow-md transition-all"
                        >
                          <span className="text-xs">▶</span>
                          Ver video
                        </button>
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-2 bg-gray-400 cursor-not-allowed text-white text-[11px] font-black px-3 py-2 rounded-xl shadow-md transition-all"
                        >
                          <span className="text-xs">▶</span>
                          Video pendiente
                        </button>
                      )}
                    </div>
                    <select value={activeId} onChange={(event) => setActiveId(event.target.value)} className={`mt-2 w-full text-xl lg:text-2xl font-black rounded-2xl border px-4 py-3 outline-none ${darkMode ? "bg-[#0b1120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
                      {strategicObjectives.map((item) => (
                        <option key={item.id} value={item.id}>{item.id} | {item.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl p-4" style={{ backgroundColor: `${activeColor}18` }}>
                    <div className={`text-xs uppercase font-black ${muted}`}>Perspectiva estratégica</div>
                    <div className="font-black mt-1 text-xl" style={{ color: activeColor }}>{activeObjective.perspective}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 flex items-center px-6 text-white font-black" style={{ backgroundColor: activeColor }}>OBJETIVO</div>
                  <div className="p-7 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className={`text-sm font-black ${muted}`}>{activeObjective.id}</div>
                        <h2 className={`text-2xl font-black mt-1 ${strong}`}>{activeObjective.title}</h2>
                      </div>
                      <Badge className={statusClasses(activeObjective.status || "Activo")}>{activeObjective.status || "Activo"}</Badge>
                    </div>
                    <div>
                      <h3 className={`font-black mb-2 ${strong}`}>Propósito</h3>
                      <p className={`${muted} leading-relaxed`}>{activeObjective.purpose}</p>
                    </div>
                    <div>
                      <h3 className={`font-black mb-2 ${strong}`}>Riesgo crítico</h3>
                      <p className={`${muted} leading-relaxed`}>{activeObjective.risk}</p>
                    </div>
                  </div>
                </div>

                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#203f73] flex items-center px-6 text-white font-black">CADENA CAUSA-EFECTO</div>
                  <div className="p-6 flex flex-col gap-3">
                    {activeObjective.chain.map((node, index) => (
                      <div key={`${node.element}-${index}`} className="flex flex-col items-center gap-3">
                        <div className={`w-full rounded-2xl p-4 border ${index === activeObjective.chain.length - 1 ? "text-white" : darkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`} style={index === activeObjective.chain.length - 1 ? { backgroundColor: activeColor, borderColor: activeColor } : undefined}>
                          <div className="font-black text-center">{node.element}</div>
                          <div className={`mt-2 text-xs leading-relaxed ${index === activeObjective.chain.length - 1 ? "text-white/90" : muted}`}>{node.meaning}</div>
                          <div className={`mt-2 text-xs font-semibold ${index === activeObjective.chain.length - 1 ? "text-white/90" : muted}`}>{node.contribution}</div>
                        </div>
                        {index !== activeObjective.chain.length - 1 && <div className="text-2xl text-gray-400">↓</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#111827] flex items-center px-6 text-white font-black">DESPLIEGUE ESTRATÉGICO</div>
                  <div className="p-6 space-y-4 max-h-[720px] overflow-auto">
                    {activeObjective.deployment.map((item, index) => (
                      <div key={`${item.process}-${item.kpi}-${index}`} className={`${darkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"} border rounded-3xl p-5 shadow-sm`}>
                        <KpiCard dep={item} darkMode={darkMode} strong={strong} muted={muted} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "Mapa estratégico" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-16 bg-[#111827] flex items-center px-8 text-white font-black text-xl">MAPA ESTRATÉGICO</div>
              <div className="p-8 space-y-8">
                {["Financiera", "Clientes", "Procesos", "Desarrollo"].map((perspective) => (
                  <div key={perspective}>
                    <div className="mb-4 inline-flex px-4 py-2 rounded-full font-black text-sm uppercase" style={{ backgroundColor: `${COLORS[perspective]}20`, color: COLORS[perspective] }}>{perspective}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {(perspectiveGroups[perspective] || []).map((item) => (
                        <button key={item.id} onClick={() => openDashboardObjective(item.id)} className="transition-all border rounded-2xl p-5 text-left font-bold shadow-sm hover:text-white" style={{ backgroundColor: `${COLORS[perspective]}10`, borderColor: `${COLORS[perspective]}35` }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = COLORS[perspective]; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = `${COLORS[perspective]}10`; }}>
                          <div className="text-xs opacity-80">{item.id}</div>
                          <div className="mt-1">{item.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "Mapa de procesos" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-16 bg-[#111827] flex items-center px-8 text-white font-black text-xl">MAPA DE PROCESOS</div>
              <div className="p-8 space-y-8">
                <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-white border-gray-200"} border rounded-3xl p-6`}>
                  <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Entrada</div>
                  <div className={`mt-1 text-xl font-black ${strong}`}>Requisitos de las partes interesadas</div>
                </div>

                {processMap.map((group) => {
                  const style = PROCESS_TYPE_STYLES[group.type];
                  return (
                    <div key={group.type} className="rounded-3xl border p-6" style={{ backgroundColor: `${style.bg}55`, borderColor: style.border }}>
                      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                        <div>
                          <div className="text-xs uppercase tracking-wide font-black" style={{ color: style.color }}>Tipo de proceso</div>
                          <div className="text-2xl font-black" style={{ color: style.color }}>{group.type}</div>
                        </div>
                        <div className="px-4 py-2 rounded-full text-xs font-black uppercase" style={{ backgroundColor: style.bg, color: style.color }}>
                          {group.processes.length} procesos
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {group.processes.map((process) => (
                          <button
                            key={process.name}
                            onClick={() => openProcessView(process.name)}
                            className={`${darkMode ? "bg-[#111827] border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-50"} border rounded-2xl p-5 shadow-sm text-left transition-all`}
                          >
                            <div className="text-xs uppercase font-black text-gray-400">Proceso</div>
                            <div className={`mt-2 text-lg font-black ${strong}`}>{process.name}</div>
                            <div className="mt-4 pt-4 border-t border-gray-200/30">
                              <div className="text-xs uppercase font-black text-gray-400">Dueño del proceso</div>
                              <div className={`mt-1 font-bold ${strong}`}>{process.owner}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-white border-gray-200"} border rounded-3xl p-6`}>
                  <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Salida</div>
                  <div className={`mt-1 text-xl font-black ${strong}`}>Satisfacción de las partes interesadas</div>
                </div>
              </div>
            </div>
          )}

          {activeView === "Vista responsable" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-14 bg-[#111827] flex items-center px-6 text-white font-black">VISTA POR RESPONSABLE</div>
              <div className="p-6 border-b border-gray-200">
                <div className={`text-xs uppercase tracking-wide font-black mb-2 ${muted}`}>Seleccionar responsable</div>
                <select value={selectedResponsible} onChange={(event) => setSelectedResponsible(event.target.value)} className={`w-full text-lg font-black rounded-2xl border px-5 py-4 outline-none ${darkMode ? "bg-[#0b1120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
                  {responsibleCards.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
              <div className="p-6 space-y-6 overflow-auto">
                {responsibleObjectives.map((objective) => (
                  <div key={objective.id} className={`${darkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"} border rounded-3xl overflow-hidden`}>
                    <div className="p-5 border-b border-gray-200/20 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase font-black text-gray-400">Objetivo conectado</div>
                          <button onClick={() => openDashboardObjective(objective.id)} className={`mt-1 text-left text-xl font-black ${strong} hover:underline`}>{objective.id} | {objective.title}</button>
                        </div>
                        <div className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: objective.id === "GLOBAL" ? "#0f766e20" : `${COLORS[objective.perspective]}20`, color: objective.id === "GLOBAL" ? "#0f766e" : COLORS[objective.perspective] }}>{objective.id === "GLOBAL" ? "Gestión Estratégica" : objective.perspective}</div>
                      </div>

                      {(objective.owner === selectedResponsible || (objective.id === "GLOBAL" && selectedResponsible === "Director general")) && (
                        <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-gray-50 border-gray-200"} border rounded-2xl p-4`}>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <KpiTypeBadge strategic global={objective.id === "GLOBAL"} />
                          </div>
                          <div className={`font-black text-lg ${strong}`}>{strategicKpiNames[objective.id] || objective.title}</div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs uppercase font-black text-gray-400">Meta 2026</div>
                              <div className={`font-bold ${strong}`}>{extractGoal(objective.title)}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase font-black text-gray-400">Responsable</div>
                              <div className={`font-bold ${strong}`}>{objective.id === "GLOBAL" && selectedResponsible === "Director general" ? "Director general" : objective.owner}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-5">
                      <div className="space-y-3">
                        {visibleDeploymentsForResponsible(objective).map((dep, index) => (
                          <KpiCard key={`${objective.id}-${dep.kpi}-${index}`} dep={dep} darkMode={darkMode} strong={strong} muted={muted} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "Vista proceso" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-14 bg-[#203f73] flex items-center px-6 text-white font-black">VISTA POR PROCESO</div>
              <div className="p-6 border-b border-gray-200">
                <div className={`text-xs uppercase tracking-wide font-black mb-2 ${muted}`}>Seleccionar proceso</div>
                <select value={selectedProcess} onChange={(event) => setSelectedProcess(event.target.value)} className={`w-full text-lg font-black rounded-2xl border px-5 py-4 outline-none ${darkMode ? "bg-[#0b1120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
                  {processCards.map((process) => (
                    <option key={process} value={process}>{process}</option>
                  ))}
                </select>
              </div>

              <div className="p-6 space-y-6 overflow-auto">
                <div className={`${darkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"} border rounded-3xl overflow-hidden`}>
                  <div className="p-5 border-b border-gray-200/20 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs uppercase font-black text-gray-400">Proceso organizacional</div>
                      <div className={`mt-1 text-2xl font-black ${strong}`}>{selectedProcess}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: selectedProcessData?.type === "Procesos estratégicos" ? "#991b1b20" : selectedProcessData?.type === "Procesos operativos" ? "#203f7320" : "#c96d1a20", color: selectedProcessData?.type === "Procesos estratégicos" ? "#991b1b" : selectedProcessData?.type === "Procesos operativos" ? "#203f73" : "#c96d1a" }}>
                        {selectedProcessData?.type}
                      </div>
                      <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-gray-50 border-gray-200"} border rounded-2xl px-4 py-3`}>
                        <div className="text-[10px] uppercase font-black text-gray-400">Dueño del proceso</div>
                        <div className={`font-black ${strong}`}>{selectedProcessData?.owner}</div>
                      </div>
                    </div>
                  </div>

                  <div className={`mx-5 mb-2 mt-5 ${darkMode ? "bg-[#0b1120] border-white/10" : "bg-[#f8fafc] border-gray-200"} border rounded-2xl p-5`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="text-xs uppercase font-black text-gray-400">Aporte estratégico del proceso</div>
                        <div className={`mt-2 text-sm leading-relaxed font-medium ${muted}`}>
                          {processContributionMap[selectedProcess] || "Este proceso contribuye al cumplimiento estratégico mediante control y soporte operacional."}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 min-w-[320px]">
                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">Perspectivas</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{[...new Set(processObjectives.map((o) => o.perspective))].length}</div>
                        </div>

                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">Objetivos</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{processObjectives.length}</div>
                        </div>

                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">KPIs</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{processObjectives.reduce((acc, objective) => acc + objective.deployment.length, 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {processObjectives.map((objective) => (
                      <button
                        key={objective.id}
                        onClick={() => openDashboardObjective(objective.id)}
                        className={`${darkMode ? "bg-[#0b1120] border-white/10 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-white"} border rounded-2xl p-5 text-left transition-all`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-xs uppercase font-black text-gray-400">Objetivo conectado</div>
                            <div className={`mt-1 text-lg font-black ${strong}`}>{objective.id}</div>
                          </div>

                          <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase" style={{ backgroundColor: `${COLORS[objective.perspective]}20`, color: COLORS[objective.perspective] }}>
                            {objective.perspective}
                          </div>
                        </div>

                        <div className={`mt-3 text-sm leading-relaxed ${muted}`}>{objective.title}</div>

                        <div className="mt-4 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-black text-gray-400">KPIs conectados</div>
                            <div className={`font-black ${strong}`}>{objective.deployment.length}</div>
                          </div>

                          <div className="text-xs font-black text-[#203f73]">Ver detalle →</div>
                        </div>
                      </button>
                    ))}

                    {processObjectives.length === 0 && (
                      <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-gray-50 border-gray-200"} border rounded-2xl p-6`}>
                        <div className={`text-lg font-black ${strong}`}>Proceso en construcción estratégica</div>
                        <div className={`mt-2 text-sm leading-relaxed ${muted}`}>Este proceso aún no tiene objetivos estratégicos o KPIs vinculados directamente dentro del despliegue estratégico actual.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "Captura estratégica" && (
            <div>
              {isAdmin ? (
                <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#b88a00] flex items-center px-6 text-white font-black">CAPTURA ESTRATÉGICA MENSUAL</div>
                  <div className="p-8 space-y-4">
                    {Object.keys(COLORS).map((perspective) => (
                      <div key={perspective} className={`${darkMode ? "border-white/10" : "border-gray-200"} grid grid-cols-1 lg:grid-cols-4 gap-4 items-center border rounded-2xl p-4`}>
                        <div className={`font-bold ${strong}`}>{perspective}</div>
                        <div className={`${muted} font-semibold`}>Meta mensual</div>
                        <input defaultValue="90%" className="border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none text-gray-800 focus:ring-2 focus:ring-[#111827]/20" />
                        <div className={`font-black ${strong}`}>90%</div>
                      </div>
                    ))}
                    <div className="pt-4 flex justify-end"><button className="bg-[#111827] hover:bg-black text-white px-8 py-4 rounded-2xl font-black shadow-xl">GUARDAR RESULTADOS</button></div>
                  </div>
                </div>
              ) : (
                <div className={`${card} rounded-3xl shadow-sm border p-8 text-center`}>
                  <div className={`text-2xl font-black ${strong}`}>Acceso restringido</div>
                  <p className={`mt-2 ${muted}`}>Inicia sesión como Analista Estratégico para capturar resultados.</p>
                  <button onClick={() => setShowLogin(true)} className="mt-6 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg">🔐 Acceso admin</button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
