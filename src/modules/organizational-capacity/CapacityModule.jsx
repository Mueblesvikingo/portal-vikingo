// NOTA DE LAYOUT:
// Este mÃ³dulo vive dentro de AppLayout, que ya controla min-h-screen, sidebar, topbar y scroll.
// Por eso la raÃ­z del mÃ³dulo NO debe usar min-h-screen ni p-6 globales adicionales,
// porque eso puede deformar el tamaÃ±o de todo el portal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createActivity,
  createRole,
  createSubprocess,
  updateSubprocessOrder,
  updateSubprocess,
  deleteActivity,
  deleteSubprocess,
  getOrganizationalDesignData,
  getProcessDesignData,
  updateActivity,
  updateActivityOrder,
  updateRole,
  getSubprocessTraceability,
createSubprocessTraceability,
} from "../../services/organizationalDesignService";

const organizationalDesignVideoUrl = "https://www.youtube.com/embed/h9zZ-Ct12q4?autoplay=1&rel=0&modestbranding=1";

const ventasProcesses = [
  {
    id: 1,
    name: "Elaborar anÃ¡lisis de mercado",
    status: "default",
    load: 0,
    owner: "Director General",
    lane: "Director General",
    input: "Necesidad de planeaciÃ³n de ventas / Plan estratÃ©gico",
    output: "InformaciÃ³n para definir metas de venta",
    active: true,
    approved: false,
    audited: false,
    activities: [],
    impact: "Sin el anÃ¡lisis de mercado, la planeaciÃ³n de ventas puede iniciar sin una lectura clara de demanda, clientes, oportunidades y condiciones comerciales.",
    benefit: "Permite orientar las metas de venta y la estrategia comercial con base en informaciÃ³n del mercado y necesidades de planeaciÃ³n.",
    aiAutomation: "Puede aplicar IA para analizar tendencias, comparar informaciÃ³n histÃ³rica y apoyar la identificaciÃ³n de patrones comerciales.",
  },
  {
    id: 2,
    name: "Definir metas de venta",
    status: "default",
    load: 0,
    owner: "Director General",
    lane: "Director General",
    input: "AnÃ¡lisis de mercado",
    output: "Metas de venta",
    active: true,
    approved: false,
    audited: false,
    activities: [],
    impact: "Sin metas de venta definidas, el proceso comercial pierde direcciÃ³n, referencia de cumplimiento y base para evaluar desempeÃ±o.",
    benefit: "Establece objetivos comerciales que sirven como guÃ­a para cartera, precios, planeaciÃ³n comercial y seguimiento de KPIÂ´s.",
    aiAutomation: "Puede apoyarse con IA para simular escenarios de venta y automatizaciÃ³n para registrar metas aprobadas.",
  },
  {
    id: 3,
    name: "GestiÃ³n de cartera y precios",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "Metas de venta / Historial de venta",
    output: "Cartera de clientes / Rentabilidad de productos / Estrategia de precios",
    active: true,
    approved: false,
    audited: false,
    impact: "Sin este subproceso se debilita la segmentaciÃ³n comercial, la identificaciÃ³n de riesgos y oportunidades y la definiciÃ³n de precios.",
    benefit: "Permite analizar mercado, segmentar clientes, definir prioridades comerciales y diseÃ±ar una estrategia de precios basada en rentabilidad.",
    aiAutomation: "Puede aplicar IA para detectar patrones de clientes, riesgos, oportunidades y rentabilidad; la automatizaciÃ³n puede apoyar actualizaciÃ³n de cartera y precios.",
    activities: [
      { id: 1, name: "Analizar mercado y demanda", responsible: "Analista comercial", impact: "Sin analizar mercado y demanda, las decisiones comerciales pueden tomarse sin base suficiente.", benefit: "Permite entender el comportamiento comercial antes de segmentar clientes y definir estrategias.", aiAutomation: "Puede aplicar IA para revisar tendencias de demanda e historial de venta." },
      { id: 2, name: "Identificar requisitos normativos", responsible: "Analista comercial", impact: "Sin identificar requisitos normativos, la estrategia comercial puede omitir condiciones de cumplimiento aplicables.", benefit: "Asegura que el anÃ¡lisis comercial considere cumplimiento normativo antes de definir prioridades.", aiAutomation: "Puede apoyarse con listas digitales y revisiÃ³n asistida de requisitos documentados." },
      { id: 3, name: "Identificar riesgos y oportunidades", responsible: "Analista comercial", impact: "Sin identificar riesgos y oportunidades, la cartera y precios pueden diseÃ±arse sin considerar amenazas o ventajas comerciales.", benefit: "Permite anticipar riesgos y aprovechar oportunidades dentro del enfoque comercial.", aiAutomation: "Puede aplicar IA para clasificar riesgos y oportunidades por patrones comerciales." },
      { id: 4, name: "Segmentar clientes", responsible: "Analista comercial", impact: "Sin segmentaciÃ³n, los esfuerzos comerciales pueden dispersarse sin enfoque por tipo de cliente.", benefit: "Permite organizar la cartera de clientes y definir prioridades por segmento.", aiAutomation: "Puede aplicar IA para agrupar clientes por comportamiento, volumen o caracterÃ­sticas comerciales." },
      { id: 5, name: "Definir prioridades por segmento", responsible: "Analista comercial", impact: "Sin prioridades por segmento, la gestiÃ³n comercial puede carecer de enfoque y secuencia de atenciÃ³n.", benefit: "Facilita enfocar recursos comerciales segÃºn segmentos definidos.", aiAutomation: "Puede automatizarse con reglas de priorizaciÃ³n y tableros de cartera." },
      { id: 6, name: "Definir metas comerciales preliminares", responsible: "Analista comercial", impact: "Sin metas preliminares, la estrategia comercial puede llegar a precios sin referencia de objetivos.", benefit: "Aporta una base para revisar cartera, precios y aprobaciÃ³n comercial.", aiAutomation: "Puede usar IA para generar escenarios preliminares con base en historial y metas." },
      { id: 7, name: "Evaluar estructura actual de precios", responsible: "Analista de precios", impact: "Sin evaluar precios actuales, la rentabilidad de productos puede no reflejarse en la estrategia.", benefit: "Permite revisar la estructura de precios antes de diseÃ±ar ajustes o estrategia.", aiAutomation: "Puede automatizarse con anÃ¡lisis de rentabilidad y comparaciÃ³n de precios." },
      { id: 8, name: "DiseÃ±ar estrategia de precios", responsible: "Analista de precios", impact: "Sin estrategia de precios, las decisiones comerciales pueden quedar sin estructura ni criterio aprobado.", benefit: "Define una estrategia de precios alineada a rentabilidad y enfoque comercial.", aiAutomation: "Puede aplicar IA para evaluar escenarios de precio y margen." },
    ],
  },
  {
    id: 4,
    name: "PlaneaciÃ³n comercial",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "InformaciÃ³n histÃ³rica de ventas",
    output: "Plan de demanda / Forecast validado",
    active: true,
    approved: false,
    audited: false,
    impact: "Sin planeaciÃ³n comercial, el proceso de ventas puede carecer de forecast, plan de demanda y comunicaciÃ³n del plan.",
    benefit: "Permite consolidar informaciÃ³n histÃ³rica, analizar demanda, validar forecast y comunicar el plan comercial.",
    aiAutomation: "Puede aplicar IA para forecast y anÃ¡lisis de demanda; la automatizaciÃ³n puede actualizar histÃ³ricos y difundir planes.",
    activities: [
      { id: 1, name: "Consolidar ventas histÃ³ricas", responsible: "Analista comercial", impact: "Sin consolidar ventas histÃ³ricas, no hay base confiable para anÃ¡lisis y forecast.", benefit: "Prepara la informaciÃ³n histÃ³rica necesaria para depuraciÃ³n y anÃ¡lisis de demanda.", aiAutomation: "Puede automatizarse integrando datos del sistema de venta." },
      { id: 2, name: "Depurar informaciÃ³n", responsible: "Analista comercial", impact: "Sin depuraciÃ³n, el anÃ¡lisis puede basarse en informaciÃ³n incompleta o incorrecta.", benefit: "Mejora la confiabilidad de los datos antes de analizar la demanda.", aiAutomation: "Puede usar IA para detectar inconsistencias y automatizaciÃ³n para validar campos." },
      { id: 3, name: "Analizar demanda", responsible: "Analista comercial", impact: "Sin anÃ¡lisis de demanda, el forecast puede no reflejar necesidades reales de venta.", benefit: "Permite proyectar demanda con base en informaciÃ³n histÃ³rica depurada.", aiAutomation: "Puede aplicar IA para tendencias, estacionalidad y comportamiento de demanda." },
      { id: 4, name: "Elaborar Forecast", responsible: "Analista comercial", impact: "Sin forecast, el plan de demanda puede no tener proyecciÃ³n estructurada.", benefit: "Genera una proyecciÃ³n comercial para validaciÃ³n y planeaciÃ³n.", aiAutomation: "Puede aplicar modelos predictivos o plantillas automatizadas de forecast." },
      { id: 5, name: "Validar Forecast", responsible: "Director comercial", impact: "Sin validaciÃ³n, el forecast puede pasar a plan sin revisiÃ³n directiva.", benefit: "Asegura que la proyecciÃ³n sea revisada antes de elaborar el plan.", aiAutomation: "Puede usar alertas de aprobaciÃ³n y revisiÃ³n asistida de variaciones." },
      { id: 6, name: "Forecast Validado", responsible: "Analista comercial", impact: "Sin forecast validado, el plan de demanda puede carecer de base aprobada.", benefit: "Formaliza la proyecciÃ³n como insumo para elaborar y ajustar el plan.", aiAutomation: "Puede automatizar registro de versiÃ³n validada y trazabilidad." },
      { id: 7, name: "Elabora y ajusta plan", responsible: "Analista comercial", impact: "Sin elaborar y ajustar el plan, el forecast no se convierte en plan operativo de demanda.", benefit: "Convierte el forecast validado en plan de demanda preparado para aprobaciÃ³n.", aiAutomation: "Puede automatizar cÃ¡lculos, versiones y ajustes del plan." },
      { id: 8, name: "Aprueba plan de demanda", responsible: "Director comercial", impact: "Sin aprobaciÃ³n, el plan de demanda puede comunicarse sin autorizaciÃ³n formal.", benefit: "Libera el plan para comunicarlo y difundirlo.", aiAutomation: "Puede automatizar flujo de aprobaciÃ³n y notificaciones." },
    ],
  },
  {
    id: 5,
    name: "GestiÃ³n integral de pedidos",
    status: "default",
    load: 0,
    owner: "Coordinador de ventas",
    lane: "Coordinador de ventas",
    input: "Plan comercial / Requerimiento de productos",
    output: "Promesa de entrega / Plan maestro de producciÃ³n / Cliente o vendedor comunicado",
    active: true,
    approved: false,
    audited: false,
    impact: "Sin gestiÃ³n integral de pedidos, los pedidos institucionales y externos pueden no validarse, aprobarse, calendarizarse o comunicarse correctamente.",
    benefit: "Integra la atenciÃ³n de pedidos institucionales y externos, manteniendo validaciÃ³n, revisiÃ³n, aprobaciÃ³n, calendarizaciÃ³n y comunicaciÃ³n.",
    aiAutomation: "Puede automatizar captura, validaciÃ³n, cÃ¡lculo de fechas, comunicaciÃ³n y seguimiento de pedidos.",
    activities: [
      { id: 1, name: "GestiÃ³n de pedidos institucionales", responsible: "Coordinador de ventas", impact: "Sin esta gestiÃ³n, el pedido institucional puede no pasar por validaciÃ³n, revisiÃ³n de crÃ©dito, condiciones y fecha de entrega.", benefit: "Asegura recepciÃ³n, validaciÃ³n, aprobaciÃ³n, calendarizaciÃ³n y comunicaciÃ³n del pedido institucional.", aiAutomation: "Puede automatizar registros de pedido, validaciones, cÃ¡lculo de fechas y comunicaciÃ³n al cliente." },
      { id: 2, name: "GestiÃ³n de pedidos externos", responsible: "Coordinador de ventas", impact: "Sin esta gestiÃ³n, el pedido externo puede no coordinar formulario, validaciÃ³n, flete, crÃ©dito, entrega y comunicaciÃ³n al vendedor.", benefit: "Permite controlar recepciÃ³n, revisiÃ³n, aprobaciÃ³n, calendarizaciÃ³n y cierre del pedido externo.", aiAutomation: "Puede automatizar formularios, captura en sistema, cÃ¡lculo de flete, fechas y notificaciones." },
    ],
  },
  {
    id: 6,
    name: "Servicio postventa",
    status: "default",
    load: 0,
    owner: "Coordinador de ventas",
    lane: "Coordinador de ventas",
    input: "Entrega de productos al cliente / RemisiÃ³n de entrega",
    output: "Servicio postventa cerrado / Reporte de resultados / NotificaciÃ³n de soluciÃ³n al cliente",
    active: true,
    approved: false,
    audited: false,
    impact: "Sin servicio postventa, las incidencias de entrega, quejas o aclaraciones pueden quedar sin anÃ¡lisis, correcciÃ³n o evaluaciÃ³n de satisfacciÃ³n.",
    benefit: "Permite registrar incidencias, coordinar acciones correctivas, evaluar satisfacciÃ³n y cerrar el servicio postventa.",
    aiAutomation: "Puede automatizar registro de incidencias, evidencias, seguimiento, evaluaciÃ³n de satisfacciÃ³n y alertas de desviaciones.",
    activities: [
      { id: 1, name: "Entrega de productos al cliente", responsible: "Coordinador de distribuciÃ³n", impact: "Sin entrega documentada, el flujo postventa no cuenta con evidencia inicial de entrega.", benefit: "Inicia el servicio postventa con base en la entrega realizada al cliente.", aiAutomation: "Puede automatizar evidencias de entrega y notificaciÃ³n al Ã¡rea comercial." },
      { id: 2, name: "Revisa remisiÃ³n de entrega de productos", responsible: "Coordinador de ventas", impact: "Sin revisar la remisiÃ³n, pueden no detectarse inconsistencias de entrega.", benefit: "Permite confirmar si existen o no inconsistencias posteriores a la entrega.", aiAutomation: "Puede automatizar validaciÃ³n de remisiones y alertas de inconsistencias." },
      { id: 3, name: "Registra incidencia de entrega", responsible: "Coordinador de ventas", impact: "Sin registro de incidencia, la gestiÃ³n posterior queda sin trazabilidad.", benefit: "Permite documentar incidencias de entrega para su anÃ¡lisis y atenciÃ³n.", aiAutomation: "Puede automatizar formularios de incidencia y folios de seguimiento." },
      { id: 4, name: "Realiza servicio postventa", responsible: "Coordinador de ventas", impact: "Sin servicio postventa, las quejas o aclaraciones del cliente pueden no atenderse formalmente.", benefit: "Activa el seguimiento postventa y atenciÃ³n al cliente.", aiAutomation: "Puede automatizar comunicaciÃ³n, tickets y seguimiento postventa." },
      { id: 5, name: "Cliente comparte evidencia de incidencias", responsible: "Cliente", impact: "Sin evidencia del cliente, el anÃ¡lisis de la incidencia puede carecer de soporte.", benefit: "Aporta evidencia para evaluar correcciÃ³n o devoluciÃ³n.", aiAutomation: "Puede habilitar carga digital de fotos, documentos y comentarios." },
      { id: 6, name: "Registra y comunica incidencia", responsible: "Analista comercial", impact: "Sin comunicar la incidencia, las Ã¡reas responsables pueden no actuar oportunamente.", benefit: "Asegura comunicaciÃ³n interna y trazabilidad de la incidencia.", aiAutomation: "Puede automatizar avisos y asignaciones de incidencia." },
      { id: 7, name: "Analiza incidencia", responsible: "Coordinador de producciÃ³n / Calidad", impact: "Sin anÃ¡lisis, no se determina si procede correcciÃ³n o devoluciÃ³n.", benefit: "Permite decidir acciones correctivas o devoluciÃ³n con base en evidencia.", aiAutomation: "Puede apoyar clasificaciÃ³n de incidencias y anÃ¡lisis de recurrencia." },
      { id: 8, name: "Ejecuta acciÃ³n correctiva", responsible: "Coordinador de producciÃ³n / Calidad", impact: "Sin acciÃ³n correctiva, la incidencia puede permanecer abierta o repetirse.", benefit: "Permite corregir la situaciÃ³n y avanzar al cierre del servicio postventa.", aiAutomation: "Puede automatizar planes de acciÃ³n, responsables y fechas compromiso." },
      { id: 9, name: "Aplica evaluaciÃ³n de satisfacciÃ³n al cliente", responsible: "Analista comercial", impact: "Sin evaluaciÃ³n, no se mide la percepciÃ³n del cliente tras el servicio.", benefit: "Recaba informaciÃ³n para analizar satisfacciÃ³n y posibles desviaciones.", aiAutomation: "Puede automatizar encuestas y captura de resultados." },
      { id: 10, name: "Analizar resultados de satisfacciÃ³n", responsible: "Analista comercial", impact: "Sin anÃ¡lisis de resultados, no se identifican desviaciones o recurrencias.", benefit: "Permite detectar tendencias y necesidad de acciones de mejora.", aiAutomation: "Puede aplicar IA para anÃ¡lisis de comentarios, tendencias y alertas." },
      { id: 11, name: "Define acciones de mejora", responsible: "Director comercial", impact: "Sin acciones de mejora, las desviaciones pueden repetirse.", benefit: "Permite cerrar desviaciones mediante acciones definidas.", aiAutomation: "Puede automatizar seguimiento de acciones y responsables." },
    ],
  },
  {
    id: 7,
    name: "EvaluaciÃ³n de satisfacciÃ³n del cliente",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "RetroalimentaciÃ³n del cliente / Seguimiento postventa",
    output: "Reporte de satisfacciÃ³n / Acciones de mejora continua / ValidaciÃ³n de acciones de mejora",
    active: true,
    approved: false,
    audited: false,
    impact: "Sin evaluaciÃ³n de satisfacciÃ³n, no se consolidan incidencias ni se definen acciones ante desviaciones recurrentes.",
    benefit: "Permite recopilar, analizar y reportar satisfacciÃ³n del cliente, ademÃ¡s de coordinar y dar seguimiento a mejoras.",
    aiAutomation: "Puede automatizar encuestas, consolidaciÃ³n de incidencias, reportes y seguimiento de acciones de mejora.",
    activities: [
      { id: 1, name: "Recopilar informaciÃ³n", responsible: "Analista comercial", impact: "Sin recopilar informaciÃ³n, no hay base para consolidar incidencias ni satisfacciÃ³n.", benefit: "ReÃºne retroalimentaciÃ³n del cliente y seguimiento postventa para anÃ¡lisis.", aiAutomation: "Puede automatizar recolecciÃ³n desde formularios y registros postventa." },
      { id: 2, name: "Consolidar incidencias", responsible: "Analista comercial", impact: "Sin consolidaciÃ³n, las incidencias pueden quedar dispersas y sin patrÃ³n visible.", benefit: "Agrupa incidencias para revisar recurrencia y satisfacciÃ³n.", aiAutomation: "Puede aplicar IA para clasificar incidencias y detectar recurrencias." },
      { id: 3, name: "Analizar informaciÃ³n de satisfacciÃ³n del cliente", responsible: "Analista comercial", impact: "Sin anÃ¡lisis, no se identifican desviaciones o incidencias recurrentes.", benefit: "Permite determinar si existen desviaciones o recurrencias que requieren mejora.", aiAutomation: "Puede aplicar IA para interpretar respuestas y comentarios del cliente." },
      { id: 4, name: "Generar reporte de satisfacciÃ³n", responsible: "Analista comercial", impact: "Sin reporte, el seguimiento de indicadores queda sin evidencia consolidada.", benefit: "Formaliza resultados de satisfacciÃ³n e indicadores para revisiÃ³n.", aiAutomation: "Puede automatizar reportes e indicadores de satisfacciÃ³n." },
      { id: 5, name: "Definir acciones de mejora", responsible: "Director comercial", impact: "Sin acciones de mejora, las desviaciones recurrentes pueden mantenerse.", benefit: "Convierte hallazgos de satisfacciÃ³n en acciones de mejora continua.", aiAutomation: "Puede sugerir acciones a partir de recurrencias y priorizarlas." },
      { id: 6, name: "Coordinar implementaciÃ³n de mejoras", responsible: "Director de operaciones", impact: "Sin coordinaciÃ³n, las mejoras definidas pueden no implementarse.", benefit: "Asegura ejecuciÃ³n coordinada de mejoras derivadas de satisfacciÃ³n.", aiAutomation: "Puede automatizar tareas, responsables, fechas y recordatorios." },
      { id: 7, name: "Seguimiento de acciones de mejora", responsible: "Director de operaciones", impact: "Sin seguimiento, no se valida el cierre de acciones de mejora.", benefit: "Permite validar acciones de mejora y mantener mejora continua.", aiAutomation: "Puede automatizar tableros de seguimiento y alertas de vencimiento." },
    ],
  },
  {
    id: 8,
    name: "Seguimiento de KPIÂ´s comerciales",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "VEN-RE 02 Seguimiento postventa / InformaciÃ³n comercial",
    output: "Seguimiento de KPIÂ´s comerciales",
    active: true,
    approved: false,
    audited: false,
    activities: [],
    impact: "Sin seguimiento de KPIÂ´s comerciales, el desempeÃ±o del proceso de ventas pierde mediciÃ³n visible.",
    benefit: "Permite verificar indicadores comerciales y conectar resultados con evaluaciÃ³n del desempeÃ±o.",
    aiAutomation: "Puede automatizar tableros de KPIÂ´s y alertas por desviaciones.",
  },
  {
    id: 9,
    name: "EvaluaciÃ³n del desempeÃ±o",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "Seguimiento de KPIÂ´s comerciales / AuditorÃ­a interna / RevisiÃ³n por la direcciÃ³n",
    output: "EvaluaciÃ³n del desempeÃ±o",
    active: true,
    approved: false,
    audited: false,
    activities: [],
    impact: "Sin evaluaciÃ³n del desempeÃ±o, no se determina si existen hallazgos o necesidades de mejora.",
    benefit: "Permite verificar el desempeÃ±o del proceso y activar mejora cuando existan hallazgos.",
    aiAutomation: "Puede aplicar IA para resumir desempeÃ±o y detectar patrones de hallazgos.",
  },
  {
    id: 10,
    name: "Implementar acciones de mejora",
    status: "default",
    load: 0,
    owner: "Analista comercial",
    lane: "Analista comercial",
    input: "Hallazgos identificados / EvaluaciÃ³n del desempeÃ±o",
    output: "Proceso mejorado",
    active: true,
    approved: false,
    audited: false,
    activities: [],
    impact: "Sin implementar acciones de mejora, los hallazgos pueden permanecer abiertos y el proceso no mejora.",
    benefit: "Permite cerrar hallazgos y mantener el proceso de ventas en mejora continua.",
    aiAutomation: "Puede automatizar seguimiento de acciones, responsables, fechas y evidencias de cierre.",
  },
];

const processFilterOptions = [
  "Todos los procesos",
  "PlaneaciÃ³n estratÃ©gica del SIG",
  "PlaneaciÃ³n financiera",
  "GestiÃ³n de competencias",
  "Ventas",
  "IngenierÃ­a / Desarrollo de productos",
  "Compras",
  "PlaneaciÃ³n y control de la producciÃ³n",
  "GestiÃ³n de inventarios",
  "Control de almacenes",
  "DistribuciÃ³n",
  "GestiÃ³n de calidad",
  "Recursos humanos",
  "TransformaciÃ³n Digital y AutomatizaciÃ³n",
  "Contabilidad y Cumplimiento Fiscal",
];

const processLanes = ["Director General", "Analista comercial", "Coordinador de ventas"];

const BASE_MONTHLY_HOURS = 192;
const WEEKS_PER_MONTH = 4;

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getFrequencyMonthlyEquivalent(type = "monthly", value = 1) {
  const frequencyValue = Math.max(0, toNumber(value, 0));

  switch (type) {
    case "event":
      return 0;
    case "daily":
      return frequencyValue * 22;
    case "weekly":
      return frequencyValue * 4.33;
    case "biweekly":
      return frequencyValue * 2.16;
    case "monthly":
      return frequencyValue;
    case "quarterly":
      return frequencyValue / 3;
    case "semiannual":
      return frequencyValue / 6;
    case "annual":
      return frequencyValue / 12;
    default:
      return frequencyValue;
  }
}

function getFrequencyLabel(type) {
  const labels = {
    event: "Por evento",
    daily: "Diaria",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
  };

  return labels[type] || labels.monthly;
}

function calculateCapacity({ timeHours = 0, frequencyType = "monthly", frequencyValue = 1, frequencyMonthly = null }) {
  const hours = Math.max(0, toNumber(timeHours));
  const monthlyEquivalent = frequencyMonthly === null || frequencyMonthly === undefined
    ? getFrequencyMonthlyEquivalent(frequencyType, frequencyValue)
    : Math.max(0, toNumber(frequencyMonthly));
  const monthlyHours = hours * monthlyEquivalent;
  const weeklyHours = monthlyHours / WEEKS_PER_MONTH;
  const loadPercent = BASE_MONTHLY_HOURS > 0 ? (monthlyHours / BASE_MONTHLY_HOURS) * 100 : 0;

  return {
    monthlyEquivalent: Number(monthlyEquivalent.toFixed(2)),
    weeklyHours: Number(weeklyHours.toFixed(2)),
    monthlyHours: Number(monthlyHours.toFixed(2)),
    loadPercent: Number(loadPercent.toFixed(2)),
  };
}

function getCriticalityStyle(criticality) {
  const styles = {
    low: "border-sky-200 bg-sky-50 text-sky-700",
    medium: "border-yellow-200 bg-yellow-50 text-yellow-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    critical: "border-red-200 bg-red-50 text-red-700",
  };

  return styles[criticality] || styles.medium;
}

const statusConfig = {
  healthy: { label: "Completo", style: "border-sky-200 bg-sky-50 text-sky-700" },
  warning: { label: "Parcial", style: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  critical: { label: "Revisar", style: "border-red-200 bg-red-50 text-red-600" },
  default: { label: "Nuevo / sin captura", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function getStatusStyle(status) {
  return (statusConfig[status] || statusConfig.default).style;
}

function getStatusLabel(status) {
  return (statusConfig[status] || statusConfig.default).label;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function firstValue(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "inactivo", "inactive", "0", "no"].includes(normalized)) return false;
    if (["true", "activo", "active", "1", "si", "sÃ­"].includes(normalized)) return true;
  }
  return fallback;
}

function mapSupabaseDesignData({ processes = [], roles = [], subprocesses = [], activities = [] }) {
  if (!Array.isArray(processes) || processes.length === 0) return { processes: [], lanes: [] };

  const roleById = new Map();
  const rolesByProcess = new Map();
  const pushByProcessKey = (map, key, value) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return;
    if (!map.has(normalizedKey)) map.set(normalizedKey, []);
    map.get(normalizedKey).push(value);
  };

  roles.forEach((role, index) => {
    const roleId = firstValue(role, ["id", "rol_id", "role_id"], null);
    const roleName = String(firstValue(role, ["rol", "nombre_rol", "role", "nombre", "name", "puesto"], `Rol ${index + 1}`));
    const mappedRole = { ...role, roleName };
    if (roleId !== null) roleById.set(String(roleId), mappedRole);
    const processId = String(firstValue(role, ["proceso_id", "process_id"], ""));
    const processName = String(firstValue(role, ["proceso", "processName", "nombre_proceso"], ""));
    pushByProcessKey(rolesByProcess, processId, mappedRole);
    pushByProcessKey(rolesByProcess, processName, mappedRole);
  });


  const subprocessesByProcess = new Map();
  subprocesses
    .sort((a, b) => toNumber(firstValue(a, ["orden", "orden_flujo", "id"]), 0) - toNumber(firstValue(b, ["orden", "orden_flujo", "id"]), 0))
    .forEach((subprocess, index) => {
      const processId = String(firstValue(subprocess, ["proceso_id", "process_id"], ""));
      const processName = String(firstValue(subprocess, ["proceso", "processName", "nombre_proceso"], ""));
      const responsible = String(firstValue(subprocess, ["responsable", "responsible", "rol", "role"], "Subprocesos"));
      const code = String(firstValue(subprocess, ["codigo", "codigo_subproceso", "code"], ""));
      const id = toNumber(firstValue(subprocess, ["id"], index + 1), index + 1);

      const block = {
        ...subprocess,
        id,
        subproceso_id: id,
        codigo_subproceso: code,
        code,
        name: String(firstValue(subprocess, ["nombre", "name", "subproceso"], `Subproceso ${index + 1}`)),
        rol: responsible,
        lane: responsible,
        responsible,
        position: String(firstValue(subprocess, ["puesto", "position"], responsible)),
        processName,
        description: String(firstValue(subprocess, ["objetivo", "descripcion", "description"], "")),
        criticality: String(firstValue(subprocess, ["criticidad", "criticality"], "medium")),
        load: toNumber(firstValue(subprocess, ["carga", "load", "carga_horas"], 0), 0),
        active: normalizeBoolean(firstValue(subprocess, ["activo", "active"], true), true),
        status: normalizeBoolean(firstValue(subprocess, ["activo", "active"], true), true)
          ? String(firstValue(subprocess, ["status", "estado"], "default"))
          : "inactive",
        order: toNumber(firstValue(subprocess, ["orden", "orden_flujo", "secuencia", "id"], index), index),
        impact: String(firstValue(subprocess, ["impacto", "impact", "objetivo", "descripcion"], "")),
        benefit: String(firstValue(subprocess, ["beneficio", "benefit"], "")),
        aiAutomation: String(firstValue(subprocess, ["automatizacion_ia", "aiAutomation"], "")),
        isSubprocess: true,
      };

      pushByProcessKey(subprocessesByProcess, processId, block);
      pushByProcessKey(subprocessesByProcess, processName, block);
    });

  const activitiesByProcess = new Map();
  activities
    .sort((a, b) => toNumber(firstValue(a, ["orden_flujo", "orden", "secuencia", "id"]), 0) - toNumber(firstValue(b, ["orden_flujo", "orden", "secuencia", "id"]), 0))
    .forEach((activity, index) => {
      const processId = String(firstValue(activity, ["proceso_id", "process_id"], ""));
      const processName = String(firstValue(activity, ["proceso", "processName", "nombre_proceso"], ""));
      const roleId = firstValue(activity, ["proceso_rol_id", "rol_id", "role_id", "proceso_roles_id"], null);
      const role = roleId !== null ? roleById.get(String(roleId)) : null;
      const roleName = String(firstValue(activity, ["rol", "role", "carril"], role?.roleName || ""));
      const responsible = String(firstValue(activity, ["responsable", "responsible"], roleName || role?.responsable || role?.roleName || "Responsable"));
      const durationMinutes = toNumber(firstValue(activity, ["duracion_minutos", "durationMinutes"], 60), 60);
      const block = {
        id: toNumber(firstValue(activity, ["id"], index + 1), index + 1),
        dbId: firstValue(activity, ["dbId", "supabaseId", "id"], null),
        supabaseId: firstValue(activity, ["dbId", "supabaseId", "id"], null),
        name: String(firstValue(activity, ["actividad", "nombre_actividad", "titulo", "nombre", "name"], `Actividad ${index + 1}`)),
        rol: roleName,
        lane: roleName || responsible,
        responsible,
        position: String(firstValue(activity, ["puesto", "position"], role?.puesto || responsible)),
        proceso_rol_id: roleId,
        processName,
        subproceso: String(firstValue(activity, ["subproceso"], "")),
        fase: String(firstValue(activity, ["fase"], "")),
        description: String(firstValue(activity, ["descripcion", "description"], "")),
        criticality: String(firstValue(activity, ["criticidad", "criticality"], "medium")),
        load: toNumber(firstValue(activity, ["carga", "load", "carga_horas"], 0), 0),
        active: normalizeBoolean(firstValue(activity, ["activa", "activo", "active"], true), true),
        status: String(firstValue(activity, ["status", "estado"], "default")),
        automated: normalizeBoolean(firstValue(activity, ["automatizada", "automated"], false), false),
        timeHours: Number((durationMinutes / 60).toFixed(2)),
        durationMinutes,
        frequencyType: String(firstValue(activity, ["frecuencia", "frequencyType"], "monthly")),
        frequencyValue: toNumber(firstValue(activity, ["frequencyValue", "frecuencia_valor"], 1), 1),
        typicalDay: String(firstValue(activity, ["dia_tipico", "typicalDay"], "Lunes")),
        order: toNumber(firstValue(activity, ["orden_flujo", "orden", "secuencia"], index), index),
        impact: String(firstValue(activity, ["impacto", "impact", "descripcion"], "")),
        benefit: String(firstValue(activity, ["beneficio", "benefit"], "")),
        aiAutomation: String(firstValue(activity, ["automatizacion_ia", "aiAutomation"], "")),
        criticidad: String(firstValue(activity, ["criticidad", "criticality"], "medium")),
        estado: String(firstValue(activity, ["estado", "status"], "default")),
        automatizada: normalizeBoolean(firstValue(activity, ["automatizada", "automated"], false), false),
        impacto: String(firstValue(activity, ["impacto", "impact", "descripcion"], "")),
        beneficio: String(firstValue(activity, ["beneficio", "benefit"], "")),
        automatizacion_ia: String(firstValue(activity, ["automatizacion_ia", "aiAutomation"], "")),
        carga_horas: toNumber(firstValue(activity, ["carga_horas", "load"], 0), 0),
        frecuencia: String(firstValue(activity, ["frecuencia", "frequencyType"], "monthly")),
        frecuencia_valor: toNumber(firstValue(activity, ["frecuencia_valor", "frequencyValue"], 1), 1),
      };
      pushByProcessKey(activitiesByProcess, processId, block);
      pushByProcessKey(activitiesByProcess, processName, block);
    });

  const mappedProcesses = processes
    .filter((process) => normalizeBoolean(firstValue(process, ["activo", "active"], true), true))
    .map((process) => {
      const id = toNumber(firstValue(process, ["id"], 0), 0);
      return {
        id,
        name: String(firstValue(process, ["nombre", "name", "proceso"], `Proceso ${id}`)),
        status: String(firstValue(process, ["status", "estado"], "default")),
        load: 0,
        owner: String(firstValue(process, ["responsable", "owner"], "Responsable")),
        lane: String(firstValue(process, ["tipo", "categoria", "lane"], "Operativo")),
        input: String(firstValue(process, ["entrada", "input"], "")),
        output: String(firstValue(process, ["salida", "output"], "")),
        active: true,
        approved: false,
        audited: false,
        impact: String(firstValue(process, ["impacto", "impact"], "")),
        benefit: String(firstValue(process, ["beneficio", "benefit"], "")),
        aiAutomation: String(firstValue(process, ["automatizacion_ia", "aiAutomation"], "")),
        roles: [...(rolesByProcess.get(String(id)) || []), ...(rolesByProcess.get(String(firstValue(process, ["nombre", "name", "proceso"], ""))) || [])],
        subprocesses: [...(subprocessesByProcess.get(String(id)) || []), ...(subprocessesByProcess.get(String(firstValue(process, ["nombre", "name", "proceso"], ""))) || [])],
        activities: [...(activitiesByProcess.get(String(id)) || []), ...(activitiesByProcess.get(String(firstValue(process, ["nombre", "name", "proceso"], ""))) || [])],
      };
    });

  const lanes = [...new Set(mappedProcesses.map((process) => process.lane).filter(Boolean))];
  return { processes: mappedProcesses, lanes };
}

function getBlockCondition(block) {
  if (block.active === false || block.activo === false || block.activa === false) return "inactive";

  const hasAnyInfo =
    hasText(block.input) ||
    hasText(block.output) ||
    hasText(block.impact) ||
    hasText(block.benefit) ||
    hasText(block.aiAutomation) ||
    hasText(block.owner) ||
    hasText(block.responsible) ||
    hasText(block.time);

  const hasMainInfo =
    (hasText(block.input) || hasText(block.responsible) || hasText(block.owner)) &&
    (hasText(block.output) || hasText(block.time)) &&
    hasText(block.impact) &&
    hasText(block.benefit) &&
    hasText(block.aiAutomation);

  if (!hasAnyInfo) return "new";
  if (!hasMainInfo) return "partial";
  return "complete";
}

function getBlockStyle(block) {
  const condition = getBlockCondition(block);

  if (condition === "inactive") {
    return "border-gray-300 bg-gray-300 text-gray-500 opacity-80 saturate-0 grayscale";
  }

  if (condition === "new") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (condition === "partial") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

function runDevChecks() {
  ["healthy", "warning", "critical", "default", "unknown"].forEach((status) => {
    console.assert(typeof getStatusStyle(status) === "string", `Missing style for ${status}`);
    console.assert(typeof getStatusLabel(status) === "string", `Missing label for ${status}`);
  });
  console.assert(getBlockCondition({ active: true }) === "new", "Empty active block should be green/new");
  console.assert(getBlockCondition({ active: false }) === "inactive", "Inactive block should be gray/inactive");
  console.assert(getBlockCondition({ active: true, impact: "x" }) === "partial", "Partial block should be yellow/partial");
  console.assert(
    getBlockCondition({ active: true, input: "x", output: "y", impact: "a", benefit: "b", aiAutomation: "c" }) === "complete",
    "Complete block should be blue/complete"
  );
  console.assert(ventasProcesses.every((process) => Array.isArray(process.activities)), "Every process must include activities");
  console.assert(getFrequencyMonthlyEquivalent("weekly", 1) === 4.33, "Weekly frequency should convert to 4.33 monthly events");
  console.assert(getFrequencyMonthlyEquivalent("quarterly", 1) === 0.3333333333333333, "Quarterly frequency should convert to one third monthly events");
  console.assert(calculateCapacity({ timeHours: 2, frequencyType: "weekly", frequencyValue: 1 }).monthlyHours === 8.66, "Capacity monthly hours should use equivalent frequency");
  console.assert(calculateCapacity({ timeHours: 2, frequencyType: "monthly", frequencyValue: 8 }).weeklyHours === 4, "Capacity weekly hours should be monthly hours divided by 4");
  console.assert(calculateCapacity({ timeHours: 2, frequencyType: "monthly", frequencyValue: 8 }).loadPercent === 8.33, "Capacity percent should use 192 monthly hours as base");
  console.assert(ventasProcesses.every((process) => processLanes.includes(process.lane)), "Every process must belong to a valid lane");
  console.assert(processLanes.length >= 1, "At least one lane is required");
  console.assert(ventasProcesses.length >= 1, "At least one subprocess is required");
}

if (typeof window !== "undefined") runDevChecks();

function useEightColumnWidth(viewportRef, visibleColumnCount) {
  const [cellWidth, setCellWidth] = useState(120);

  useEffect(() => {
    const updateCellWidth = () => {
      if (!viewportRef.current) return;
      setCellWidth(Math.max(88, viewportRef.current.clientWidth / visibleColumnCount));
    };
    updateCellWidth();
    window.addEventListener("resize", updateCellWidth);
    return () => window.removeEventListener("resize", updateCellWidth);
  }, [viewportRef, visibleColumnCount]);

  return cellWidth;
}

function MiniMetric({ title, value, note, red, yellow }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1">
      <div className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-gray-400">{title}</div>
      <div className={`text-lg font-black leading-none ${red ? "text-red-500" : yellow ? "text-yellow-500" : "text-[#0f172a]"}`}>{value}</div>
      <div className="truncate text-[8px] leading-none text-gray-500">{note}</div>
    </div>
  );
}

function EditableCard({ title, value, onChange, suffix }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="truncate text-[10px] font-black uppercase text-gray-400">{title}</div>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-black text-[#0f172a] outline-none focus:border-red-200"
        />
        {suffix && <span className="shrink-0 text-xs font-black text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function LockedCard({ title, value, note }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3 opacity-90">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase text-gray-400">{title}</div>
        <div className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-gray-400">Bloqueado</div>
      </div>
      <div className="mt-1 text-base font-black text-[#0f172a]">{value}</div>
      <div className="mt-1 text-[9px] font-semibold leading-tight text-gray-400">{note}</div>
    </div>
  );
}

function ActivityModal({ activity, onSave, onClose, availableRoles = [] }) {
  const [traceLog, setTraceLog] = useState([]);
  const cleanRoleText = (role) => {
    const rawValue =
      typeof role === "string"
        ? role
        : firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "");

    return String(rawValue || "")
      .replace(/\(id:\s*\d+\)/gi, "")
      .replace(/^(ROL[-_\s]*\d+|\d+)\s*[-:]\s*/i, "")
      .trim();
  };

  const roleOptions = useMemo(() => {
    const seen = new Set();
    return (availableRoles || [])
      .map(cleanRoleText)
      .filter((roleName) => {
        if (!roleName || seen.has(roleName)) return false;
        seen.add(roleName);
        return true;
      });
  }, [availableRoles]);

  const [draft, setDraft] = useState({
    name: activity.actividad || activity.name || "",
    responsible: activity.responsable || activity.responsible || "",
    rol: activity.rol || activity.lane || activity.responsable || activity.responsible || "",
    criticality: activity.criticidad || activity.criticality || "medium",
    timeHours: activity.timeHours ?? activity.time ?? (activity.duracion_minutos ? Number(activity.duracion_minutos) / 60 : ""),
    frequencyType: activity.frecuencia || activity.frequencyType || "monthly",
    frequencyValue: activity.frecuencia_valor ?? activity.frequencyValue ?? activity.frequencyMonthly ?? 1,
    load: activity.carga_horas ?? activity.load ?? 0,
    status: activity.estado || activity.status || (activity.active === false || activity.activa === false ? "inactive" : "active"),
    automated: activity.automatizada ?? activity.automated ?? false,
    impact: activity.impacto ?? activity.impact ?? "",
    benefit: activity.beneficio ?? activity.benefit ?? "",
    aiAutomation: activity.automatizacion_ia ?? activity.aiAutomation ?? "",
  });

  const capacity = calculateCapacity({
    timeHours: draft.timeHours,
    frequencyType: draft.frequencyType,
    frequencyValue: draft.frequencyValue,
  });

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setTraceLog((current) => [
      {
        id: current.length + 1,
        field,
        user: "Usuario actual",
        date: new Date().toLocaleString("es-MX"),
        detail: `Cambio registrado en ${field}`,
      },
      ...current,
    ]);
  };

  const updateResponsible = (value) => {
    const cleanName = cleanRoleText(value);
    if (!cleanName) return;

    setDraft((current) => ({
      ...current,
      responsible: cleanName,
      rol: cleanName,
      position: cleanName,
    }));
    setTraceLog((current) => [
      {
        id: current.length + 1,
        field: "responsible",
        user: "Usuario actual",
        date: new Date().toLocaleString("es-MX"),
        detail: "Cambio registrado en responsible",
      },
      ...current,
    ]);
  };

  const saveChanges = async () => {
    const updatedActivity = {
      ...activity,
      ...draft,
      dbId: activity.dbId || activity.supabaseId || activity.id,
      supabaseId: activity.supabaseId || activity.dbId || activity.id,
      criticality: draft.criticality,
      time: `${capacity.monthlyHours}h mensuales`,
      timeHours: toNumber(draft.timeHours),
      durationMinutes: Math.round(toNumber(draft.timeHours) * 60),
      criticidad: draft.criticality,
      estado: draft.status,
      automatizada: draft.automated,
      impacto: draft.impact,
      beneficio: draft.benefit,
      automatizacion_ia: draft.aiAutomation,
      carga_horas: capacity.monthlyHours,
      frecuencia: draft.frequencyType,
      frecuencia_valor: Number(draft.frequencyValue || 1),
      frequencyType: draft.frequencyType,
      frequencyValue: toNumber(draft.frequencyValue, 1),
      frequencyMonthly: capacity.monthlyEquivalent,
      weeklyHours: capacity.weeklyHours,
      monthlyHours: capacity.monthlyHours,
      load: capacity.loadPercent,
      active: draft.status === "active",
      responsible: draft.responsible,
      responsable: draft.responsible,
      rol: draft.responsible,
      position: draft.responsible,
      puesto: draft.responsible,
    };

    try {
      await onSave?.(updatedActivity);
      onClose();
    } catch (error) {
      console.error("Error guardando actividad:", error);
      alert(`No se pudo guardar la actividad: ${error.message || "revisa la consola"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-[#071226] px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Detalle editable de actividad</div>
            <input
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-2xl font-black text-white outline-none focus:border-white/40"
            />
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button onClick={saveChanges} className="rounded-xl bg-white/10 px-4 py-1.5 text-[11px] font-black text-white hover:bg-white/20">
              Guardar
            </button>
            <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white hover:bg-white/20">
              &times;
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="truncate text-[10px] font-black uppercase text-gray-400">Responsable</div>
              <select
                value={roleOptions.includes(draft.responsible) ? draft.responsible : ""}
                onChange={(event) => updateResponsible(event.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-black text-[#0f172a] outline-none focus:border-red-200"
              >
                <option value="">Seleccionar rol</option>
                {roleOptions.map((roleName) => (
                  <option key={roleName} value={roleName}>{roleName}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="truncate text-[10px] font-black uppercase text-gray-400">Criticidad</div>
              <select
                value={draft.criticality}
                onChange={(event) => updateDraft("criticality", event.target.value)}
                className={`mt-1 w-full min-w-0 rounded-lg border px-2 py-1 text-xs font-black outline-none ${getCriticalityStyle(draft.criticality)}`}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">CrÃ­tica</option>
              </select>
            </div>
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="truncate text-[10px] font-black uppercase text-gray-400">Estado</div>
              <select
                value={draft.status}
                onChange={(event) => updateDraft("status", event.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-black text-[#0f172a] outline-none"
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </div>
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="truncate text-[10px] font-black uppercase text-gray-400">AutomatizaciÃ³n</div>
              <select
                value={draft.automated ? "yes" : "no"}
                onChange={(event) => updateDraft("automated", event.target.value === "yes")}
                className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-black text-[#0f172a] outline-none"
              >
                <option value="no">No automatizada</option>
                <option value="yes">Automatizada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <EditableCard title="Tiempo por ejecuciÃ³n" value={draft.timeHours} onChange={(value) => updateDraft("timeHours", value)} suffix="h" />
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="truncate text-[10px] font-black uppercase text-gray-400">Frecuencia</div>
              <select
                value={draft.frequencyType}
                onChange={(event) => updateDraft("frequencyType", event.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-black text-[#0f172a] outline-none"
              >
                <option value="event">Por evento</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <EditableCard title="Cantidad" value={draft.frequencyValue} onChange={(value) => updateDraft("frequencyValue", value)} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">Frecuencia equivalente</div>
              <div className="mt-1 text-2xl font-black text-emerald-700">{capacity.monthlyEquivalent}</div>
              <div className="mt-1 text-[9px] font-semibold text-gray-400">veces/mes Â· {getFrequencyLabel(draft.frequencyType)}</div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-600">Carga semanal</div>
              <div className="mt-1 text-2xl font-black text-sky-700">{capacity.weeklyHours}h</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">Carga mensual</div>
              <div className="mt-1 text-2xl font-black text-blue-700">{capacity.monthlyHours}h</div>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-yellow-50/70 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-yellow-600">Capacidad usada</div>
              <div className="mt-1 text-2xl font-black text-yellow-700">{capacity.loadPercent}%</div>
              <div className="mt-1 text-[9px] font-semibold text-gray-400">Base mensual: {BASE_MONTHLY_HOURS}h</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Impacto si no se hace</div>
              <textarea value={draft.impact} onChange={(event) => updateDraft("impact", event.target.value)} className="mt-2 h-[84px] w-full resize-none overflow-y-auto rounded-2xl border border-red-100 bg-white p-3 text-xs leading-relaxed text-gray-700 outline-none focus:border-red-300" />
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Beneficio si se hace</div>
              <textarea value={draft.benefit} onChange={(event) => updateDraft("benefit", event.target.value)} className="mt-2 h-[84px] w-full resize-none overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-3 text-xs leading-relaxed text-gray-700 outline-none focus:border-emerald-300" />
            </div>
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">IA y automatizacion</div>
              <textarea value={draft.aiAutomation} onChange={(event) => updateDraft("aiAutomation", event.target.value)} className="mt-2 h-[84px] w-full resize-none overflow-y-auto rounded-2xl border border-blue-100 bg-white p-3 text-xs leading-relaxed text-gray-700 outline-none focus:border-blue-300" />
            </div>
          </div>

          {traceLog.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Trazabilidad</div>
              <div className="mt-2 max-h-[120px] space-y-2 overflow-y-auto">
                {traceLog.map((item) => (
                  <div key={item.id} className="rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-gray-500">
                    {item.date} Â· {item.user} Â· {item.detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralDataModal({ process, onSave, onClose, traceability = [], availableRoles = [] }) {
  const restrictedRoles = "Dirección, Coordinador SIG o Analista de procesos";
  const roleOptions = useMemo(() => {
    const seen = new Set();
    return (availableRoles || [])
      .map((role) => String(firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "") || "").trim())
      .filter((roleName) => {
        if (!roleName || seen.has(roleName)) return false;
        seen.add(roleName);
        return true;
      });
  }, [availableRoles]);
  const [draft, setDraft] = useState({
  code: process.code || process.codigo || process.codigo_subproceso || "",
  name: process.name || process.nombre || "",
  objective: process.objective || process.objetivo || process.description || "",
  active: process.active !== false,
  approved: Boolean(process.approved),
  audited: Boolean(process.audited),
  owner: process.owner || process.responsible || process.responsable || "",
  impact: process.impact || "",
  benefit: process.benefit || "",
  aiAutomation: process.aiAutomation || "",
});
const [traceLog, setTraceLog] = useState(
  traceability.length > 0
    ? traceability.map((item) => ({
        id: item.id,
        field: item.campo,
        user: item.usuario || "Sistema",
        date: item.created_at
          ? new Date(item.created_at).toLocaleString("es-MX")
          : "Sin fecha",
        detail:
          item.detalle ||
          `Cambio de "${item.valor_anterior || ""}" a "${item.valor_nuevo || ""}"`,
      }))
    : [
        {
          id: 1,
          field: "Creación del registro",
          user: "Sistema",
          date: "Hoy",
          detail: "Registro inicial del subproceso en el módulo de capacidad.",
        },
      ]
);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setTraceLog((current) => [
      {
        id: current.length + 1,
        field,
        user: "Usuario actual",
        date: new Date().toLocaleString("es-MX"),
        detail: `Cambio registrado en ${field}`,
      },
      ...current,
    ]);
  };

  const saveChanges = async () => {
    try {
      await onSave?.(draft);
      onClose();
    } catch (error) {
      console.error("Error guardando datos generales:", error);
      alert(`No se pudo guardar: ${error.message || "revisa la consola"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#071226] px-5 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Datos generales del subproceso</div>
          <div className="flex items-center gap-2">
            <button onClick={saveChanges} className="rounded-xl bg-white/10 px-4 py-1.5 text-[11px] font-black text-white hover:bg-white/20">
              Guardar
            </button>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20">
              &times;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4">
      <EditableCard
  title="Código"
  value={draft.code}
  onChange={(value) => updateDraft("code", value)}
/>

<EditableCard
  title="Nombre"
  value={draft.name}
  onChange={(value) => updateDraft("name", value)}
/>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase text-gray-400">Status</div>
            <select
              value={draft.active ? "active" : "inactive"}
              onChange={(event) => updateDraft("active", event.target.value === "active")}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-black text-[#0f172a] outline-none"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <LockedCard title="Aprobación" value={draft.approved ? "Aprobado" : "Pendiente de aprobación"} note={`Campo bloqueado. Solo ${restrictedRoles} pueden modificarlo.`} />
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase text-gray-400">Responsable</div>
            <select
              value={roleOptions.includes(draft.owner) ? draft.owner : ""}
              onChange={(event) => updateDraft("owner", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-black text-[#0f172a] outline-none focus:border-red-300"
            >
              <option value="">Seleccionar rol</option>
              {roleOptions.map((roleName) => (
                <option key={roleName} value={roleName}>{roleName}</option>
              ))}
            </select>
          </div>
      
          <LockedCard title="Auditado" value={draft.audited ? "Auditado" : "No auditado"} note={`Campo bloqueado. Solo ${restrictedRoles} pueden modificarlo.`} />

          <div className="col-span-2 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Impacto</div>
              <textarea value={draft.impact} onChange={(event) => updateDraft("impact", event.target.value)} className="mt-2 h-[76px] w-full resize-none overflow-y-auto rounded-xl border border-red-100 bg-white p-2 text-xs text-gray-700 outline-none focus:border-red-300" />
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Beneficio</div>
              <textarea value={draft.benefit} onChange={(event) => updateDraft("benefit", event.target.value)} className="mt-2 h-[76px] w-full resize-none overflow-y-auto rounded-xl border border-emerald-100 bg-white p-2 text-xs text-gray-700 outline-none focus:border-emerald-300" />
            </div>
            
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Trazabilidad de cambios</div>
            <div className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-gray-400">{traceLog.length} registros</div>
          </div>
          <div className="max-h-[88px] space-y-2 overflow-y-auto pr-1">
            {traceLog.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-black text-[#0f172a]">{item.field}</div>
                  <div className="text-[9px] font-bold text-gray-400">{item.date}</div>
                </div>
                <div className="mt-1 text-[10px] font-semibold text-gray-500">
                  {item.user} · {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaneFormModal({ processName, nextOrder, onSave, onClose }) {
  const [draft, setDraft] = useState({
    rol: "",
    responsable: "",
    orden: nextOrder ?? 0,
  });

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveChanges = () => {
    if (!draft.rol.trim()) return;
    onSave?.({
      ...draft,
      proceso: processName,
      orden: Number(draft.orden || 0),
      orden_flujo: Number(draft.orden || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#071226] px-5 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Nuevo carril</div>
            <div className="mt-1 text-lg font-black text-white">{processName}</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20">&times;</button>
        </div>
        <div className="grid gap-3 p-5">
          <EditableCard title="Rol / carril" value={draft.rol} onChange={(value) => updateDraft("rol", value)} />
          <EditableCard title="Responsable" value={draft.responsable} onChange={(value) => updateDraft("responsable", value)} />
          <EditableCard title="Orden" value={draft.orden} onChange={(value) => updateDraft("orden", value)} />
          <button type="button" onClick={saveChanges} className="rounded-xl bg-red-600 px-4 py-2 text-[11px] font-black text-white hover:bg-red-700">Guardar carril</button>
        </div>
      </div>
    </div>
  );
}

function BlockFormModal({ processName, roles = [], nextOrder, onSave, onClose }) {
  const defaultRole = roles[0]?.roleName || roles[0]?.rol || roles[0]?.nombre || roles[0]?.puesto || "";
  const [draft, setDraft] = useState({
    actividad: "",
    rol: defaultRole,
    responsable: "",
    puesto: "",
    subproceso: "",
    fase: "",
    duracion_minutos: 60,
    frecuencia: "Mensual",
    dia_tipico: "Lunes",
  });

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const selectedRole = roles.find((role) => {
    const roleName = role.roleName || role.rol || role.nombre || role.puesto || "";
    return roleName === draft.rol;
  });

  const saveChanges = () => {
    if (!draft.actividad.trim()) return;
    onSave?.({
      ...draft,
      proceso: processName,
      proceso_rol_id: selectedRole?.id || null,
      orden_flujo: Number(nextOrder || 0),
      duracion_minutos: Number(draft.duracion_minutos || 60),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#071226] px-5 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Nuevo bloque</div>
            <div className="mt-1 text-lg font-black text-white">{processName}</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20">&times;</button>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <EditableCard title="Actividad" value={draft.actividad} onChange={(value) => updateDraft("actividad", value)} />
          </div>
          <div className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="truncate text-[10px] font-black uppercase text-gray-400">Rol / carril</div>
            <select value={draft.rol} onChange={(event) => updateDraft("rol", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-black text-[#0f172a] outline-none focus:border-red-200">
              {roles.length === 0 && <option value="">Sin carril</option>}
              {roles.map((role) => {
                const roleName = role.roleName || role.rol || role.nombre || role.puesto || "Responsable";
                return <option key={role.id || roleName} value={roleName}>{roleName}</option>;
              })}
            </select>
          </div>
          <EditableCard title="Responsable" value={draft.responsable} onChange={(value) => updateDraft("responsable", value)} />
          <EditableCard title="Puesto" value={draft.puesto} onChange={(value) => updateDraft("puesto", value)} />
          <EditableCard title="Subproceso" value={draft.subproceso} onChange={(value) => updateDraft("subproceso", value)} />
          <EditableCard title="Fase" value={draft.fase} onChange={(value) => updateDraft("fase", value)} />
          <EditableCard title="DuraciÃ³n min" value={draft.duracion_minutos} onChange={(value) => updateDraft("duracion_minutos", value)} />
          <EditableCard title="Frecuencia" value={draft.frecuencia} onChange={(value) => updateDraft("frecuencia", value)} />
          <EditableCard title="DÃ­a tÃ­pico" value={draft.dia_tipico} onChange={(value) => updateDraft("dia_tipico", value)} />
          <button type="button" onClick={saveChanges} className="rounded-xl bg-red-600 px-4 py-2 text-[11px] font-black text-white hover:bg-red-700 md:col-span-2">Guardar bloque</button>
        </div>
      </div>
    </div>
  );
}

function LaneInsightModal({ lane, onClose }) {
  const roleName = lane?.lane || "Responsable";
  const isActive = lane?.active !== false;
  const catalogRole = lane?.catalogRole || null;
  const hasCatalogData = Boolean(catalogRole);
  const roleList = roleName.split("/").map((role) => role.trim()).filter(Boolean);

  const [insights, setInsights] = useState(() =>
    roleList.map((role) => ({
      role,
      risk: catalogRole?.risk || catalogRole?.riesgo || "Puede quedar una brecha de responsabilidad, retrasarse el flujo o depender de otros roles sin una asignacion clara de capacidad.",
      opportunity: catalogRole?.opportunity || catalogRole?.oportunidad || "Asegura continuidad, toma de decisiones y capacidad visible para ejecutar las actividades asignadas dentro del flujo.",
    }))
  );

  const updateInsight = (roleIndex, field, value) => {
    setInsights((current) => current.map((item, index) => (index === roleIndex ? { ...item, [field]: value } : item)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#071226] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Riesgos y oportunidades del rol</div>
            <div className="mt-1 truncate text-lg font-black text-white">{roleName}</div>
          </div>
          <button onClick={onClose} className="ml-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20">
            &times;
          </button>
        </div>

        <div className="grid gap-3 overflow-y-auto p-5">
          <div className={`rounded-2xl border p-4 ${isActive ? "border-emerald-100 bg-emerald-50/60" : "border-gray-200 bg-gray-100"}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Estado del carril</div>
            <div className="mt-1 text-base font-black text-[#0f172a]">{isActive ? "Activo en el flujo" : "Existe, pero no se estÃ¡ ejecutando"}</div>
          </div>

          <div className="space-y-3 pr-1">
            {insights.map((item, index) => (
              <div key={`${item.role}-${index}`} className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 w-full">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400">Rol {index + 1}</div>
                  <div className="mt-1 w-full rounded-xl border border-transparent bg-transparent text-base font-black text-[#0f172a]">{item.role}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Riesgo si no se tiene / no se ejecuta</div>
                    <textarea value={item.risk} readOnly={hasCatalogData} onChange={(event) => updateInsight(index, "risk", event.target.value)} className={`mt-2 min-h-[100px] w-full resize-none rounded-xl border border-red-100 bg-white/70 p-3 text-sm font-semibold leading-relaxed text-gray-700 outline-none focus:border-red-300 ${hasCatalogData ? "cursor-not-allowed opacity-80" : ""}`} />
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Oportunidad / propÃ³sito dentro del flujo</div>
                    <textarea value={item.opportunity} readOnly={hasCatalogData} onChange={(event) => updateInsight(index, "opportunity", event.target.value)} className={`mt-2 min-h-[100px] w-full resize-none rounded-xl border border-emerald-100 bg-white/70 p-3 text-sm font-semibold leading-relaxed text-gray-700 outline-none focus:border-emerald-300 ${hasCatalogData ? "cursor-not-allowed opacity-80" : ""}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualGridMap({ title, initialLanes, blockKey, storageKey, onSelectBlock, addBlockLabel, createBlock, onAddLane, onAddBlock, onUpdateBlock, onRemoveBlock, onMoveBlock, onRemoveLane, onUpdateLane, onSaveLaneOrder, availableRoles = [], roleCatalogError = null }) {
  const laneHeight = 84;
  const roleColumnWidth = 176;
  const blockHeight = 84;
  const visibleColumnCount = 8;
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const dragMovedRef = useRef(false);
  const dragLatestPositionRef = useRef(null);
  const cellWidth = useEightColumnWidth(viewportRef, visibleColumnCount);
  const columnStorageKey = `${storageKey}_column_count`;
  const getStoredColumnCount = () => {
    if (typeof window === "undefined") return visibleColumnCount;

    try {
      const saved = Number(window.localStorage.getItem(columnStorageKey));
      return Number.isFinite(saved) && saved >= visibleColumnCount ? saved : visibleColumnCount;
    } catch {
      return visibleColumnCount;
    }
  };
  const [columnCount, setColumnCount] = useState(() => getStoredColumnCount());
  const [dragging, setDragging] = useState(null);
  const [selectedLaneInsight, setSelectedLaneInsight] = useState(null);
  const [lanes, setLanes] = useState(() => initialLanes.map((lane) => ({ ...lane, active: lane.active !== false })));
  const [editingLane, setEditingLane] = useState(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [rolePickerValue, setRolePickerValue] = useState("");
  const visibleEmptyLaneStorageKey = `${storageKey}_visible_empty_lanes`;
  const hiddenLaneStorageKey = `${storageKey}_hidden_lanes`;
  const readVisibleEmptyLaneIds = () => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(visibleEmptyLaneStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  const [visibleEmptyLaneIds, setVisibleEmptyLaneIds] = useState(() => readVisibleEmptyLaneIds());
  const readHiddenLaneKeys = () => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(hiddenLaneStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  const [hiddenLaneKeys, setHiddenLaneKeys] = useState(() => readHiddenLaneKeys());
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const dragStartSnapshotRef = useRef(null);
  const laneEditSnapshotRef = useRef(null);
  const blockEditSnapshotRef = useRef(null);
  const getLaneName = (lane) =>
    String(firstValue(lane, ["lane", "rol", "roleName", "name", "responsable"], "") || "").trim();
  const getLaneRemovalKey = (lane) => {
    const laneId = lane?.roleId || lane?.id;
    if (laneId) return `id:${laneId}`;

    const laneName = getLaneName(lane).toLowerCase();
    return laneName ? `name:${laneName}` : "";
  };
  const isValidLane = (lane) => {
    const laneName = getLaneName(lane);
    const normalizedName = laneName.toLowerCase();

    if (!laneName) return false;
    if (["seleccionar rol", "responsable", "subprocesos"].includes(normalizedName)) return false;
    if (normalizedName.startsWith("nuevo rol")) return false;
    if (lane?.active === false || lane?.activo === false || lane?.activa === false) return false;
    if (hiddenLaneKeys.includes(getLaneRemovalKey(lane))) return false;
    if (Array.isArray(lane?.[blockKey]) && lane[blockKey].length > 0) return true;

    const laneId = lane?.roleId || lane?.id;
    if (laneId && visibleEmptyLaneIds.includes(String(laneId))) return true;
    if (lane?.isExplicitLane === true) return true;
    if (lane?.orden !== null && lane?.orden !== undefined && String(lane.orden).trim() !== "") return true;
    if (lane?.order !== null && lane?.order !== undefined && String(lane.order).trim() !== "") return true;

    return false;
  };
  const initialLanesSignature = JSON.stringify(
    initialLanes.map((lane) => ({
      lane: lane.lane,
      roleId: lane.roleId,
      blocks: lane[blockKey].map((block) => [
        block.id,
        block.name,
        block.actividad,
        block.responsible,
        block.responsable,
        block.position,
        block.puesto,
        block.proceso_rol_id,
        block.criticality,
        block.criticidad,
        block.status,
        block.estado,
        block.automated,
        block.automatizada,
        block.impact,
        block.impacto,
        block.benefit,
        block.beneficio,
        block.aiAutomation,
        block.automatizacion_ia,
        block.frequencyType,
        block.frecuencia,
        block.frequencyValue,
        block.frecuencia_valor,
        block.timeHours,
        block.durationMinutes,
        block.duracion_minutos,
        block.load,
        block.carga_horas,
        block.active,
        block.activo,
        block.activa,
      ]),
    }))
  );

  const defaultPositions = useMemo(() => {
    const positions = {};
    initialLanes.filter(isValidLane).forEach((lane, laneIndex) => {
      lane[blockKey].forEach((block, blockIndex) => {
        positions[block.id] = {
          laneIndex,
          step: blockIndex,
        };
      });
    });
    return positions;
  }, [initialLanesSignature, blockKey]);

  const readSavedPositions = () => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
    } catch {
      return {};
    }
  };

  const mergeSavedPositions = (basePositions) => {
    const savedPositions = readSavedPositions();
    const next = { ...basePositions };

    Object.entries(savedPositions).forEach(([blockId, position]) => {
      if (!next[blockId]) return;

      next[blockId] = {
        ...next[blockId],
        step: Number.isFinite(Number(position?.step))
          ? Number(position.step)
          : next[blockId].step,
      };
    });

    return next;
  };

  const [positions, setPositions] = useState(() => mergeSavedPositions(defaultPositions));

  const visibleLanes = lanes.filter(isValidLane);
  const allBlocks = visibleLanes.flatMap((lane) => lane[blockKey]);
  const maxPositionStep = Math.max(
    0,
    ...Object.values(positions).map((position) => toNumber(position?.step, 0))
  );
  const canvasHeight = visibleLanes.length * laneHeight;
  const effectiveColumnCount = Math.max(columnCount, visibleColumnCount, maxPositionStep + 1);
  const canvasWidth = effectiveColumnCount * cellWidth;
  const cleanRoleText = (role) => {
    const rawValue =
      typeof role === "string"
        ? role
        : firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "");

    return String(rawValue || "")
      .replace(/\(id:\s*\d+\)/gi, "")
      .replace(/^(ROL[-_\s]*\d+|\d+)\s*[-:]\s*/i, "")
      .trim();
  };

  const roleCatalogOptions = useMemo(() => {
    const seen = new Set();
    return (availableRoles || [])
      .map((role) => ({
        roleName: cleanRoleText(role),
        risk: String(firstValue(role, ["riesgo", "risk"], "") || "").trim(),
        opportunity: String(firstValue(role, ["oportunidad", "opportunity"], "") || "").trim(),
      }))
      .filter((role) => {
        if (!role.roleName || seen.has(role.roleName)) return false;
        seen.add(role.roleName);
        return true;
      });
  }, [availableRoles, lanes]);

  const roleOptions = roleCatalogOptions.map((role) => role.roleName);
  const roleCatalogByName = useMemo(
    () => new Map(roleCatalogOptions.map((role) => [role.roleName, role])),
    [roleCatalogOptions]
  );

  const cloneState = (sourceLanes = lanes, sourcePositions = positions, sourceColumnCount = columnCount) => ({
    lanes: JSON.parse(JSON.stringify(sourceLanes)),
    positions: JSON.parse(JSON.stringify(sourcePositions)),
    columnCount: sourceColumnCount,
  });

  const applyHistoryState = (snapshot) => {
    if (!snapshot) return;
    setLanes(snapshot.lanes);
    setPositions(snapshot.positions);
    setColumnCount(snapshot.columnCount);
    savePositions(snapshot.positions);
  };

  const rememberState = (snapshot = cloneState()) => {
    setUndoStack((current) => [...current.slice(-24), snapshot]);
    setRedoStack([]);
  };

  const undoLastAction = () => {
    setUndoStack((current) => {
      if (current.length === 0) return current;
      const previous = current[current.length - 1];
      setRedoStack((redoCurrent) => [...redoCurrent.slice(-24), cloneState()]);
      applyHistoryState(previous);
      return current.slice(0, -1);
    });
  };

  const redoLastAction = () => {
    setRedoStack((current) => {
      if (current.length === 0) return current;
      const next = current[current.length - 1];
      setUndoStack((undoCurrent) => [...undoCurrent.slice(-24), cloneState()]);
      applyHistoryState(next);
      return current.slice(0, -1);
    });
  };

  useEffect(() => {
    setLanes(initialLanes.map((lane) => ({ ...lane, active: lane.active !== false })));
    const nextPositions = mergeSavedPositions(defaultPositions);
    setPositions(nextPositions);
    savePositions(nextPositions);
  }, [initialLanesSignature, defaultPositions]);

  useEffect(() => {
    setVisibleEmptyLaneIds(readVisibleEmptyLaneIds());
    setHiddenLaneKeys(readHiddenLaneKeys());
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(visibleEmptyLaneStorageKey, JSON.stringify(visibleEmptyLaneIds));
  }, [visibleEmptyLaneStorageKey, visibleEmptyLaneIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(hiddenLaneStorageKey, JSON.stringify(hiddenLaneKeys));
  }, [hiddenLaneStorageKey, hiddenLaneKeys]);

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      allBlocks.forEach((block) => {
        if (!next[block.id]) next[block.id] = { laneIndex: 0, step: 0 };
      });
      return next;
    });
  }, [allBlocks.length]);

  const savePositions = (nextPositions) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextPositions));
    } catch {
      // localStorage puede estar bloqueado; el estado queda en sesiÃ³n.
    }
  };

  const saveColumnCount = (nextColumnCount) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(columnStorageKey, String(nextColumnCount));
    } catch {
      // localStorage puede estar bloqueado; el estado queda en sesion.
    }
  };

  const getNode = (blockId) => {
    const position = positions[blockId];
    if (!position) return null;
    const laneIndex = Math.max(0, Math.min(visibleLanes.length - 1, position.laneIndex ?? 0));
    const step = Math.max(0, Math.min(effectiveColumnCount - 1, position.step ?? 0));
    return { x: step * cellWidth, y: laneIndex * laneHeight, laneIndex, step };
  };

  const getOrderedBlocks = (sourcePositions = positions) =>
    allBlocks
      .map((block, fallbackIndex) => ({
        block,
        fallbackIndex,
        position: sourcePositions[block.id] || positions[block.id] || { laneIndex: 0, step: fallbackIndex },
      }))
      .sort((a, b) => {
        const stepDiff =
          toNumber(a.position?.step, a.fallbackIndex) -
          toNumber(b.position?.step, b.fallbackIndex);
        if (stepDiff !== 0) return stepDiff;

        const laneDiff =
          toNumber(a.position?.laneIndex, 0) -
          toNumber(b.position?.laneIndex, 0);
        if (laneDiff !== 0) return laneDiff;

        return a.fallbackIndex - b.fallbackIndex;
      })
      .map(({ block }) => block);

  const getOrderedBlockPayload = (sourcePositions = positions) =>
    getOrderedBlocks(sourcePositions).map((block, index) => {
      const position = sourcePositions[block.id] || positions[block.id] || {};
      const lane = visibleLanes[toNumber(position.laneIndex, 0)] || {};
      const manualNumber = toNumber(
        firstValue(block, ["displayNumber", "order", "orden_flujo", "secuencia"], index + 1),
        index + 1
      );

      return {
        id: block.id,
        order: manualNumber,
        orden_flujo: manualNumber,
        positionOrder: index + 1,
        roleId: lane.roleId,
        lane: lane.lane,
      };
    });

  const displayNumberById = useMemo(() => {
    const numbers = {};
    getOrderedBlocks(positions).forEach((block, index) => {
      numbers[block.id] = firstValue(
        block,
        ["displayNumber", "order", "orden_flujo", "secuencia"],
        index + 1
      );
    });
    return numbers;
  }, [allBlocks, positions]);

  const getBlockDisplayNumber = (block) =>
    firstValue(
      block,
      ["displayNumber", "order", "orden_flujo", "secuencia"],
      displayNumberById[block.id] || 1
    );

  const getBlockNumberUpdates = (value) => {
    const nextNumber = String(value || "").trim();

    return {
      displayNumber: nextNumber,
      order: nextNumber,
      orden_flujo: nextNumber,
    };
  };

  const startDrag = (event, block) => {
    event.preventDefault();
    dragMovedRef.current = false;
    dragStartSnapshotRef.current = cloneState();
    const node = getNode(block.id);
    if (!node || !canvasRef.current) return;
    dragLatestPositionRef.current = { laneIndex: node.laneIndex, step: node.step };
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id: block.id, offsetX: event.clientX - rect.left - node.x, offsetY: event.clientY - rect.top - node.y });
  };

  const moveDrag = (event) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = event.clientX - rect.left - dragging.offsetX;
    const rawY = event.clientY - rect.top - dragging.offsetY;
    const nextStep = Math.max(0, Math.min(effectiveColumnCount - 1, Math.round(rawX / cellWidth)));
    const nextLaneIndex = Math.max(0, Math.min(visibleLanes.length - 1, Math.round(rawY / laneHeight)));

    dragMovedRef.current = true;
    dragLatestPositionRef.current = { step: nextStep, laneIndex: nextLaneIndex };
    setPositions((current) => {
      const next = { ...current, [dragging.id]: { ...current[dragging.id], step: nextStep, laneIndex: nextLaneIndex } };
      savePositions(next);
      return next;
    });
  };

  const stopDrag = () => {
    const finalPosition = dragging ? dragLatestPositionRef.current || positions[dragging.id] : null;
    if (dragging && finalPosition) {
      if (dragMovedRef.current && dragStartSnapshotRef.current) {
        rememberState(dragStartSnapshotRef.current);
      }
      const nextPositions = {
        ...positions,
        [dragging.id]: {
          ...(positions[dragging.id] || {}),
          ...finalPosition,
        },
      };
      const lane = visibleLanes[finalPosition.laneIndex];
      onMoveBlock?.(
        dragging.id,
        finalPosition.step,
        lane?.roleId,
        lane?.lane,
        getOrderedBlockPayload(nextPositions)
      );
    }
    dragStartSnapshotRef.current = null;
    dragLatestPositionRef.current = null;
    setDragging(null);
  };
  const addColumn = () => {
    rememberState();
    setColumnCount((current) => {
      const next = current + 1;
      saveColumnCount(next);
      return next;
    });
  };

  const removeColumn = () => {
    rememberState();
    setColumnCount((current) => {
      const next = Math.max(visibleColumnCount, current - 1);
      saveColumnCount(next);
      return next;
    });
    setPositions((current) => {
      const nextMaxStep = Math.max(visibleColumnCount, columnCount - 1) - 1;
      const next = Object.fromEntries(Object.entries(current).map(([id, position]) => [id, { ...position, step: Math.min(position.step ?? 0, nextMaxStep) }]));
      savePositions(next);
      return next;
    });
  };

  const openRolePicker = () => {
    if (roleOptions.length === 0) return;
    setRolePickerValue(roleOptions[0] || "");
    setShowRolePicker(true);
  };

  const addLaneFromCatalog = async () => {
    const laneName = cleanRoleText(rolePickerValue);
    if (!laneName || !roleOptions.includes(laneName)) return;

    const createdLane = onAddLane ? await onAddLane(laneName, visibleLanes.length) : null;
    if (onAddLane && !createdLane) return;
    rememberState();
    const createdLaneId = createdLane?.roleId || createdLane?.id;
    if (createdLaneId) {
      setVisibleEmptyLaneIds((current) => [...new Set([...current, String(createdLaneId)])]);
    }
    const nextLane = {
      lane: createdLane?.lane || laneName,
      roleId: createdLane?.roleId || createdLane?.id,
      id: createdLane?.id,
      orden: createdLane?.orden,
      order: createdLane?.order,
      active: true,
      isExplicitLane: true,
      [blockKey]: [],
    };
    const laneRemovalKey = getLaneRemovalKey(nextLane);
    if (laneRemovalKey) {
      setHiddenLaneKeys((current) => current.filter((key) => key !== laneRemovalKey));
    }
    setLanes((current) => [
      ...current.filter((lane) => getLaneRemovalKey(lane) !== laneRemovalKey),
      nextLane,
    ]);
    setShowRolePicker(false);
  };

  const toggleLaneActive = (laneIndex) => {
    const lane = visibleLanes[laneIndex];
    const nextActive = lane?.active === false;
    rememberState();
    setLanes((current) => current.map((item) => (getLaneKey(item, 0) === getLaneKey(lane, 0) ? { ...item, active: nextActive } : item)));
    onUpdateLane?.({ ...lane, active: nextActive }, { active: nextActive, activo: nextActive });
  };

  const removeLane = (laneIndex) => {
    const laneToRemove = visibleLanes[laneIndex];
    if (!laneToRemove) return;
    rememberState();
    onRemoveLane?.(laneToRemove);
    const laneRemovalKey = getLaneRemovalKey(laneToRemove);
    const laneId = laneToRemove?.roleId || laneToRemove?.id;
    if (laneRemovalKey) {
      setHiddenLaneKeys((current) => [...new Set([...current, laneRemovalKey])]);
    }
    if (laneId) {
      setVisibleEmptyLaneIds((current) => current.filter((id) => id !== String(laneId)));
    }
    const removedIds = new Set((laneToRemove?.[blockKey] || []).map((block) => block.id));
    const nextVisibleCount = Math.max(visibleLanes.length - 1, 0);
    setLanes((current) => current.filter((item) => getLaneKey(item, 0) !== getLaneKey(laneToRemove, 0)));
    setPositions((current) => {
      const next = {};
      Object.entries(current).forEach(([id, position]) => {
        if (removedIds.has(Number(id))) return;
        next[id] = {
          ...position,
          laneIndex: nextVisibleCount <= 0
            ? 0
            : position.laneIndex > laneIndex
              ? position.laneIndex - 1
              : Math.min(position.laneIndex ?? 0, nextVisibleCount - 1),
        };
      });
      savePositions(next);
      return next;
    });
  };

  const moveLane = (laneIndex, direction) => {
    const nextIndex = laneIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleLanes.length) return;

    rememberState();

    const nextLanes = [...visibleLanes];
    const [movedLane] = nextLanes.splice(laneIndex, 1);
    nextLanes.splice(nextIndex, 0, movedLane);

    setLanes(nextLanes);
    setPositions((current) => {
      const next = { ...current };

      Object.entries(next).forEach(([blockId, position]) => {
        if (position.laneIndex === laneIndex) {
          next[blockId] = { ...position, laneIndex: nextIndex };
        } else if (position.laneIndex === nextIndex) {
          next[blockId] = { ...position, laneIndex };
        }
      });

      savePositions(next);
      return next;
    });

    if (onSaveLaneOrder) {
      console.log("Guardando orden carriles:", nextLanes.map((lane, index) => ({
        id: lane.id,
        rol: lane.lane || lane.rol || lane.name,
        orden: index + 1,
      })));
      onSaveLaneOrder(nextLanes);
    } else {
      nextLanes.forEach((lane, index) => {
        if (!lane?.roleId) return;
        onUpdateLane?.(lane, {
          orden: index + 1,
          orden_flujo: index + 1,
        });
      });
    }
  };

  const getLaneKey = (lane, index) => lane?.roleId || lane?.id || `lane-${index}`;

  const saveLaneName = (laneIndex, nextName) => {
    const lane = visibleLanes[laneIndex];
    if (!lane) return;
    const cleanName = cleanRoleText(nextName);
    if (!cleanName || !roleOptions.includes(cleanName)) return;

    rememberState();

    setLanes((current) => current.map((item, index) => (index === laneIndex ? { ...item, lane: cleanName } : item)));
    onUpdateLane?.({ ...lane, lane: cleanName }, { lane: cleanName, rol: cleanName, responsable: cleanName });
    setEditingLane(null);
  };

  const updateBlock = (blockId, updates) => {
    const blockToUpdate = allBlocks.find((block) => Number(block.id) === Number(blockId));

    setLanes((current) =>
      current.map((lane) => ({
        ...lane,
        [blockKey]: lane[blockKey].map((block) =>
          Number(block.id) === Number(blockId) ? { ...block, ...updates } : block
        ),
      }))
    );

    onUpdateBlock?.(blockId, {
      ...blockToUpdate,
      ...updates,
    });
  };

  const addBlock = async () => {
    if (visibleLanes.length === 0) return;

    const nextId = Math.max(...allBlocks.map((block) => Number(block.id)), 0) + 1;
    const newBlock = createBlock(nextId, visibleLanes[0]?.lane);
    const step = Math.min(effectiveColumnCount - 1, allBlocks.length % effectiveColumnCount);
    const createdBlock = onAddBlock ? await onAddBlock({ ...newBlock, order: step, lane: visibleLanes[0]?.lane, roleId: visibleLanes[0]?.roleId }) : null;
    if (onAddBlock && !createdBlock) return;
    const blockToInsert = createdBlock || newBlock;

    rememberState();
    setLanes((current) => current.map((lane) => (getLaneKey(lane, 0) === getLaneKey(visibleLanes[0], 0) ? { ...lane, [blockKey]: [...lane[blockKey], blockToInsert] } : lane)));
    setPositions((current) => {
      const next = { ...current, [blockToInsert.id || nextId]: { laneIndex: 0, step } };
      savePositions(next);
      return next;
    });
  };

  const removeBlock = (blockId) => {
    const blockToRemove = allBlocks.find(
      (block) => Number(block.id) === Number(blockId)
    );

    onRemoveBlock?.(blockId, blockToRemove);
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">{title}</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-gray-200 bg-white">
              <button type="button" onClick={undoLastAction} disabled={undoStack.length === 0} className="px-2 py-1.5 text-[11px] font-black text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400" title="Deshacer">&#8630;</button>
              <button type="button" onClick={redoLastAction} disabled={redoStack.length === 0} className="border-l border-gray-200 px-2 py-1.5 text-[11px] font-black text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400" title="Rehacer">&#8631;</button>
            </div>
            <div className="flex items-center rounded-xl border border-gray-200 bg-white">
              <button type="button" onClick={addColumn} className="px-3 py-1.5 text-[10px] font-black text-gray-500 hover:text-red-500">+ Columna</button>
              <button type="button" onClick={removeColumn} className="border-l border-gray-200 px-2 py-1.5 text-[10px] font-black text-gray-300 hover:text-red-500" title="Quitar columna">&times;</button>
            </div>
            <button type="button" onClick={openRolePicker} disabled={roleOptions.length === 0} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black text-gray-500 hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">+ Carril</button>
            <button type="button" onClick={addBlock} className="rounded-xl bg-red-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-red-700">{addBlockLabel}</button>
          </div>
        </div>
      </div>

      <div className="bg-[#f8fafc] p-3">
        <div className="mb-2 grid gap-2 px-1" style={{ gridTemplateColumns: `${roleColumnWidth}px 1fr` }}>
          <div className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400">Roles</div>
          <div className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400">Flujo operativo</div>
        </div>

        {visibleLanes.length === 0 && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-black text-amber-700">
            {"No existen roles configurados para este macroproceso"}
          </div>
        )}

        {visibleLanes.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `${roleColumnWidth}px 1fr` }}>
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white" style={{ height: canvasHeight }}>
            {visibleLanes.map((laneData, index) => {
              const { lane, active } = laneData;
              const laneKey = getLaneKey(laneData, index);
              const selectedLaneValue = lane;

              return (
                <div key={laneKey} className={`absolute left-0 right-0 flex items-center gap-1 border-b border-gray-100 px-2 ${active === false ? "bg-gray-100 opacity-60 saturate-0" : "bg-white"}`} style={{ top: index * laneHeight, height: laneHeight }}>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button type="button" onClick={() => moveLane(index, -1)} disabled={index === 0} className="h-4 w-4 rounded-full bg-gray-50 text-[9px] font-black leading-none text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400" title="Mover carril arriba">&#8593;</button>
                  <button type="button" onClick={() => moveLane(index, 1)} disabled={index === visibleLanes.length - 1} className="h-4 w-4 rounded-full bg-gray-50 text-[9px] font-black leading-none text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400" title="Mover carril abajo">&#8595;</button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-400">Responsable</div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => toggleLaneActive(index)} className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${active === false ? "bg-gray-200 text-gray-500 hover:bg-gray-300" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`} title={active === false ? "Activar rol" : "Apagar rol"}>{active === false ? "OFF" : "ON"}</button>
                      <button type="button" onClick={() => removeLane(index)} className="text-[10px] font-black text-gray-300 hover:text-red-500" title="Quitar carril">&times;</button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <button type="button" onClick={() => setSelectedLaneInsight({ lane, active, catalogRole: roleCatalogByName.get(lane) || null })} className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] font-black text-gray-400 hover:border-red-200 hover:text-red-500" title="Ver riesgos y oportunidades">i</button>
                    <select
                      value={selectedLaneValue}
                      onChange={(event) => saveLaneName(index, event.target.value)}
                      disabled={roleOptions.length === 0}
                      className="w-full rounded-lg border border-transparent bg-transparent text-[10px] font-black leading-tight text-[#0f172a] outline-none hover:border-gray-200 hover:bg-gray-50 focus:border-red-200 focus:bg-white disabled:text-gray-400"
                    >
                      {selectedLaneValue && !roleOptions.includes(selectedLaneValue) && <option value={selectedLaneValue}>{selectedLaneValue}</option>}
                      {roleOptions.map((roleName) => (
                        <option key={roleName} value={roleName}>{roleName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                </div>
              );
            })}
          </div>

          <div ref={viewportRef} className="overflow-x-auto overflow-y-hidden rounded-2xl border border-gray-200 bg-white">
            <div ref={canvasRef} onMouseMove={moveDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag} className="relative select-none" style={{ width: canvasWidth, minWidth: canvasWidth, height: canvasHeight }}>
              {visibleLanes.map((laneData, index) => (
                <div key={getLaneKey(laneData, index)} className={`absolute left-0 right-0 border-b border-gray-100 ${laneData.active === false ? "bg-gray-200/60" : "bg-slate-50/40"}`} style={{ top: index * laneHeight, height: laneHeight }} />
              ))}

              <div className="absolute inset-0 opacity-[0.045]" style={{ backgroundImage: "linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)", backgroundSize: `${cellWidth}px ${laneHeight}px` }} />

              {allBlocks.map((block) => {
                const node = getNode(block.id);
                if (!node) return null;
                return (
                  <button key={block.id} onMouseDown={(event) => startDrag(event, block)} onClick={() => { if (!dragMovedRef.current) onSelectBlock(block); }} className={`absolute z-20 flex items-start overflow-hidden rounded-xl border px-1.5 py-1.5 text-left shadow-sm cursor-grab transition-all hover:shadow-md active:cursor-grabbing ${getBlockStyle(block)}`} style={{ left: node.x, top: node.y, width: cellWidth, height: blockHeight, minWidth: cellWidth }}>
                    <div className="flex h-full w-full flex-col justify-between gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          value={getBlockDisplayNumber(block)}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateBlock(block.id, getBlockNumberUpdates(event.target.value))}
                          className={`h-4 min-w-8 max-w-14 rounded-full border border-transparent px-2 text-center text-[10px] font-black shadow-sm outline-none focus:border-red-300 ${block.active === false || block.activo === false || block.activa === false ? "bg-gray-300 text-gray-500" : "bg-white/80 text-current"}`}
                          title="Número editable de orden"
                        />
                        <span role="button" tabIndex={0} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }} className="text-[10px] font-black leading-none text-gray-300 hover:text-red-500" title="Quitar bloque">&times;</span>
                      </div>
                      <textarea value={block.name} onFocus={() => { blockEditSnapshotRef.current = cloneState(); }} onBlur={() => { if (blockEditSnapshotRef.current) { rememberState(blockEditSnapshotRef.current); blockEditSnapshotRef.current = null; } }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => updateBlock(block.id, { name: event.target.value })} className="h-[54px] w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent text-center text-[11px] font-black leading-[1.12] text-current outline-none hover:border-white/50 focus:border-white/80 focus:bg-white/40" title="Editar nombre del bloque" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>

      {showRolePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#071226] px-5 py-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Nuevo carril</div>
                <div className="mt-1 text-lg font-black text-white">Seleccionar rol</div>
              </div>
              <button type="button" onClick={() => setShowRolePicker(false)} className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20">&times;</button>
            </div>
            <div className="grid gap-3 p-5">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Rol institucional</div>
                <select value={rolePickerValue} onChange={(event) => setRolePickerValue(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-[#0f172a] outline-none focus:border-red-200">
                  {roleOptions.map((roleName) => (
                    <option key={roleName} value={roleName}>{roleName}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={addLaneFromCatalog} className="rounded-xl bg-red-600 px-4 py-2 text-[11px] font-black text-white hover:bg-red-700">Agregar carril</button>
            </div>
          </div>
        </div>
      )}
      {selectedLaneInsight && <LaneInsightModal lane={selectedLaneInsight} onClose={() => setSelectedLaneInsight(null)} />}
    </div>
  );
}


function DeleteConfirmModal({ item, onCancel, onConfirm }) {
  if (!item) return null;
  const itemLabel = item.type === "activity" ? "actividad" : "subproceso";
  const itemTitle = item.type === "activity" ? "Actividad" : "Subproceso";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="bg-[#071226] px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
            ConfirmaciÃ³n requerida
          </div>
          <div className="mt-1 text-xl font-black text-white">
            Eliminar {itemLabel}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
              AcciÃ³n irreversible
            </div>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
              Vas a eliminar permanentemente esta {itemLabel} de Supabase. Esta accion no se puede deshacer.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              {itemTitle}
            </div>
            <div className="mt-1 text-base font-black text-[#0f172a]">
              {item.name}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[11px] font-black text-gray-500 hover:border-gray-300 hover:text-[#0f172a]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-[11px] font-black text-white hover:bg-red-700"
            >
              Eliminar definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function CapacityModule() {
  const [processData, setProcessData] = useState(ventasProcesses);
  const [laneOptions, setLaneOptions] = useState(processLanes);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedSubprocess, setSelectedSubprocess] = useState(null);
  const [showGeneralData, setShowGeneralData] = useState(false);
  const [subprocessTraceability, setSubprocessTraceability] = useState([]);
  const [showLaneForm, setShowLaneForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [roleCatalogError, setRoleCatalogError] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [processFilter, setProcessFilter] = useState("Ventas");
  const loadedProcessRef = useRef("");
  const previousProcessFilterRef = useRef(processFilter);

  const reloadDesignData = useCallback(async () => {
    try {
      const { processes, roles, subprocesses, activities } = await getOrganizationalDesignData();
      const mapped = mapSupabaseDesignData({ processes, roles, subprocesses, activities });

      if (mapped.processes.length > 0) {
        setProcessData(mapped.processes);
        setLaneOptions(mapped.lanes.length > 0 ? mapped.lanes : processLanes);
        setSelectedProcess((current) => (current ? mapped.processes.find((process) => process.id === current.id) || current : current));
      }
    } catch (error) {
      console.error("Error cargando DiseÃ±o Organizacional desde Supabase:", error);
    }
  }, []);

  const reloadSelectedProcessData = useCallback(async (processName) => {
    if (!processName) return;

    try {
      const { roles = [], roleCatalog = [], roleCatalogError = null, subprocesses = [], activities = [] } = await getProcessDesignData(processName);
      setRoleCatalogError(roleCatalogError);

      console.log("selectedProcess:", processName);
      console.log("roles cargados:", roles);
      console.log("catalogo de roles cargado:", roleCatalog);
      console.log("subprocesos cargados:", subprocesses);
      console.log("actividades cargadas:", activities);

      const mappedRoleCatalog = (roleCatalog || [])
        .filter((role) => normalizeBoolean(firstValue(role, ["activo", "active"], true), true))
        .sort((a, b) => toNumber(firstValue(a, ["orden", "id"], 0), 0) - toNumber(firstValue(b, ["orden", "id"], 0), 0))
        .map((role, index) => ({
          ...role,
          id: firstValue(role, ["id"], index + 1),
          roleName: String(firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "")).trim(),
          rol: String(firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "")).trim(),
          riesgo: String(firstValue(role, ["riesgo", "risk"], "")).trim(),
          oportunidad: String(firstValue(role, ["oportunidad", "opportunity"], "")).trim(),
          fromCatalog: true,
        }));

      const mappedSubprocesses = (subprocesses || [])
        .sort((a, b) => toNumber(firstValue(a, ["orden", "orden_flujo", "id"], 0), 0) - toNumber(firstValue(b, ["orden", "orden_flujo", "id"], 0), 0))
        .map((subprocess, index) => {
          const id = toNumber(firstValue(subprocess, ["id"], index + 1), index + 1);
          const code = String(firstValue(subprocess, ["codigo", "codigo_subproceso", "code"], ""));
          const responsible = String(firstValue(subprocess, ["responsable", "responsible", "rol", "role"], "Subprocesos"));

          return {
            ...subprocess,
            id,
            subproceso_id: id,
            codigo_subproceso: code,
            code,
            name: String(firstValue(subprocess, ["nombre", "name", "subproceso"], `Subproceso ${index + 1}`)),
            rol: responsible,
            lane: responsible,
            responsible,
            position: String(firstValue(subprocess, ["puesto", "position"], responsible)),
            processName,
            description: String(firstValue(subprocess, ["objetivo", "descripcion", "description"], "")),
            criticality: String(firstValue(subprocess, ["criticidad", "criticality"], "medium")),
            load: toNumber(firstValue(subprocess, ["carga", "load", "carga_horas"], 0), 0),
            active: normalizeBoolean(firstValue(subprocess, ["activo", "active"], true), true),
            status: normalizeBoolean(firstValue(subprocess, ["activo", "active"], true), true)
              ? String(firstValue(subprocess, ["status", "estado"], "default"))
              : "inactive",
            order: toNumber(firstValue(subprocess, ["orden", "orden_flujo", "secuencia", "id"], index), index),
            impact: String(firstValue(subprocess, ["impacto", "impact", "objetivo", "descripcion"], "")),
            benefit: String(firstValue(subprocess, ["beneficio", "benefit"], "")),
            aiAutomation: String(firstValue(subprocess, ["automatizacion_ia", "aiAutomation"], "")),
            isSubprocess: true,
          };
        });

      const mappedActivities = (activities || [])
        .sort((a, b) => toNumber(firstValue(a, ["orden_flujo", "orden", "secuencia", "id"], 0), 0) - toNumber(firstValue(b, ["orden_flujo", "orden", "secuencia", "id"], 0), 0))
        .map((activity, index) => {
          const durationMinutes = toNumber(firstValue(activity, ["duracion_minutos", "durationMinutes"], 60), 60);
          const roleName = String(firstValue(activity, ["rol", "role", "carril", "puesto", "responsable"], "Responsable"));

          return {
            ...activity,
            id: toNumber(firstValue(activity, ["id"], index + 1), index + 1),
            dbId: firstValue(activity, ["dbId", "supabaseId", "id"], null),
            supabaseId: firstValue(activity, ["dbId", "supabaseId", "id"], null),
            name: String(firstValue(activity, ["actividad", "nombre_actividad", "titulo", "nombre", "name"], `Actividad ${index + 1}`)),
            rol: roleName,
            lane: roleName,
            responsible: String(firstValue(activity, ["responsable", "responsible"], roleName)),
            position: String(firstValue(activity, ["puesto", "position"], roleName)),
            proceso_rol_id: firstValue(activity, ["proceso_rol_id", "rol_id", "role_id", "proceso_roles_id"], null),
            processName: processName,
            subproceso_id: firstValue(activity, ["subproceso_id"], null),
            codigo_subproceso: String(firstValue(activity, ["codigo_subproceso"], "")),
            subproceso: String(firstValue(activity, ["subproceso", "codigo_subproceso"], "")),
            fase: String(firstValue(activity, ["fase"], "")),
            description: String(firstValue(activity, ["descripcion", "description"], "")),
            criticality: String(firstValue(activity, ["criticidad", "criticality"], "medium")),
            load: toNumber(firstValue(activity, ["carga", "load", "carga_horas"], 0), 0),
            active: normalizeBoolean(firstValue(activity, ["activa", "activo", "active"], true), true),
            status: String(firstValue(activity, ["status", "estado"], "default")),
            automated: normalizeBoolean(firstValue(activity, ["automatizada", "automated"], false), false),
            timeHours: Number((durationMinutes / 60).toFixed(2)),
            durationMinutes,
            frequencyType: String(firstValue(activity, ["frecuencia", "frequencyType"], "monthly")),
            frequencyValue: toNumber(firstValue(activity, ["frequencyValue", "frecuencia_valor"], 1), 1),
            typicalDay: String(firstValue(activity, ["dia_tipico", "typicalDay"], "Lunes")),
            order: toNumber(firstValue(activity, ["orden_flujo", "orden", "secuencia"], index), index),
            impact: String(firstValue(activity, ["impacto", "impact", "descripcion"], "")),
            benefit: String(firstValue(activity, ["beneficio", "benefit"], "")),
            aiAutomation: String(firstValue(activity, ["automatizacion_ia", "aiAutomation"], "")),
            criticidad: String(firstValue(activity, ["criticidad", "criticality"], "medium")),
            estado: String(firstValue(activity, ["estado", "status"], "default")),
            automatizada: normalizeBoolean(firstValue(activity, ["automatizada", "automated"], false), false),
            impacto: String(firstValue(activity, ["impacto", "impact", "descripcion"], "")),
            beneficio: String(firstValue(activity, ["beneficio", "benefit"], "")),
            automatizacion_ia: String(firstValue(activity, ["automatizacion_ia", "aiAutomation"], "")),
            carga_horas: toNumber(firstValue(activity, ["carga_horas", "load"], 0), 0),
            frecuencia: String(firstValue(activity, ["frecuencia", "frequencyType"], "monthly")),
            frecuencia_valor: toNumber(firstValue(activity, ["frecuencia_valor", "frequencyValue"], 1), 1),
          };
        });

      setProcessData((current) => {
        const next = current.map((process) =>
          process.name === processName
            ? { ...process, roles: mappedRoleCatalog, processRoles: roles, subprocesses: mappedSubprocesses, activities: mappedActivities }
            : process
        );

        const updatedSelected = next.find((process) => process.name === processName) || null;
        setSelectedProcess(updatedSelected);

        return next;
      });
    } catch (error) {
      console.error("Error cargando proceso seleccionado desde Supabase:", error);
    }
  }, []);

  useEffect(() => {
    reloadDesignData();
  }, [reloadDesignData]);

  useEffect(() => {
    if (processData.length > 0 && !processData.some((process) => process.name === processFilter)) {
      setProcessFilter(processData[0].name);
      return;
    }

    const processChanged = previousProcessFilterRef.current !== processFilter;
    previousProcessFilterRef.current = processFilter;

    const nextProcess = processData.find((process) => process.name === processFilter) || null;

    setSelectedProcess(nextProcess);

    if (processChanged) {
      setSelectedActivity(null);
      setSelectedSubprocess(null);
      setShowGeneralData(false);
    }

    if (nextProcess && loadedProcessRef.current !== nextProcess.name) {
      loadedProcessRef.current = nextProcess.name;
      reloadSelectedProcessData(nextProcess.name);
    }
  }, [processData, processFilter, reloadSelectedProcessData]);

  const metrics = useMemo(() => {
    const criticalProcesses = processData.filter((process) => process.status === "critical").length;
    const criticalRoles = processData.flatMap((process) => process.activities || []).filter((activity) => activity.load > 120).length;
    const selected = processData.find((process) => process.name === processFilter);
    const subprocessCount = selected?.subprocesses?.length || 0;
    return { processCount: subprocessCount || processData.length, criticalProcesses, coverage: "82%", criticalRoles };
  }, [processData]);

  const processOptions = useMemo(() => {
    const options = processData.map((process) => process.name).filter(Boolean);
    return options.length > 0 ? options : processFilterOptions.filter((option) => option !== "Todos los procesos");
  }, [processData]);

  const selectedProcessLanes = useMemo(() => {
    if (!selectedProcess) return [];

    const subprocesses = selectedProcess.subprocesses || [];
    const roles = selectedProcess.processRoles || [];

    const normalizeLaneName = (value) => String(value || "").trim();
    const getRoleName = (role) => normalizeLaneName(role.roleName || role.rol || role.nombre || role.name || "");
    const roleNames = new Set(roles.map(getRoleName).filter(Boolean));
    const hiddenRoleNames = new Set(
      roles
        .filter((role) => {
          const order = firstValue(role, ["orden", "order"], null);
          return order === null || order === undefined || String(order).trim() === "";
        })
        .map(getRoleName)
        .filter(Boolean)
    );
    const roleByResponsible = new Map(
      roles
        .map((role) => [normalizeLaneName(role.responsable || role.responsible), getRoleName(role)])
        .filter(([responsible, roleName]) => responsible && roleName)
    );
    const getSubprocessLaneName = (subprocess) => {
      const explicitLane = normalizeLaneName(subprocess.rol || subprocess.lane || subprocess.carril);
      if (roleNames.has(explicitLane)) return explicitLane;

      const responsible = normalizeLaneName(subprocess.responsible || subprocess.responsable || explicitLane);
      return roleByResponsible.get(responsible) || explicitLane;
    };

    const seenRoleLanes = new Set();
    const roleLanes = roles.map((role, index) => {
      const lane = getRoleName(role);
      const order = firstValue(role, ["orden", "order"], null);
      const hasOrder = order !== null && order !== undefined && String(order).trim() !== "";
      return {
        id: role.id,
        lane,
        roleId: role.id,
        orden: order,
        order,
        isExplicitLane: hasOrder,
        active: role.activo !== false && role.active !== false,
        blocks: subprocesses.filter((subprocess) => getSubprocessLaneName(subprocess) === lane),
      };
    }).filter((lane) => {
      const key = lane.lane.toLowerCase();
      if (!key || seenRoleLanes.has(key) || !lane.isExplicitLane) return false;
      seenRoleLanes.add(key);
      return true;
    });

    const roleLaneNames = new Set(roleLanes.map((lane) => lane.lane));
    const lanesFromSubprocesses = Array.from(new Set(subprocesses.map((subprocess) => getSubprocessLaneName(subprocess)).filter(Boolean)))
      .filter((lane) => !roleLaneNames.has(lane))
      .filter((lane) => !hiddenRoleNames.has(lane))
      .map((lane) => ({
        lane,
        active: true,
        blocks: subprocesses.filter((subprocess) => getSubprocessLaneName(subprocess) === lane),
      }));

    const lanes = [...roleLanes, ...lanesFromSubprocesses].filter((lane) => lane.lane);

    return lanes;
  }, [selectedProcess]);

  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
  const macroStorageKey = `capacity_process_${selectedProcess?.id || processFilter}_flow_v1`;
  const macroHiddenLaneStorageKey = `${macroStorageKey}_hidden_lanes`;

  const laneDiagnostics = useMemo(() => {
    if (!isLocalhost || !selectedProcess) return [];

    const processRoles = selectedProcess.processRoles || [];
    const selectedLaneKeys = new Set(
      selectedProcessLanes.map((lane) => {
        const laneId = lane?.roleId || lane?.id;
        const laneName = String(lane?.lane || lane?.rol || lane?.name || lane?.responsable || "").trim().toLowerCase();
        return laneId ? `id:${laneId}` : `name:${laneName}`;
      })
    );
    const selectedLaneNames = new Set(
      selectedProcessLanes
        .map((lane) => String(lane?.lane || lane?.rol || lane?.name || lane?.responsable || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const hiddenLaneKeys = (() => {
      if (typeof window === "undefined") return [];
      try {
        const parsed = JSON.parse(window.localStorage.getItem(macroHiddenLaneStorageKey) || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    })();
    const seenRoleNames = new Set();

    return processRoles.map((role) => {
      const roleName = String(role.roleName || role.rol || role.nombre || role.name || "").trim();
      const normalizedRoleName = roleName.toLowerCase();
      const laneKey = role.id ? `id:${role.id}` : `name:${normalizedRoleName}`;
      const order = firstValue(role, ["orden", "order"], null);
      const hasOrder = order !== null && order !== undefined && String(order).trim() !== "";
      const active = role.activo !== false && role.active !== false && role.activa !== false;
      const reservedName = ["seleccionar rol", "responsable", "subprocesos"].includes(normalizedRoleName);
      const isNewRole = normalizedRoleName.startsWith("nuevo rol");
      const duplicate = normalizedRoleName ? seenRoleNames.has(normalizedRoleName) : false;
      if (normalizedRoleName) seenRoleNames.add(normalizedRoleName);

      const inSelectedProcessLanes = selectedLaneKeys.has(laneKey) || selectedLaneNames.has(normalizedRoleName);
      const hiddenLocal = hiddenLaneKeys.includes(laneKey) || hiddenLaneKeys.includes(`name:${normalizedRoleName}`);
      const inVisibleLanes = Boolean(
        roleName &&
        !reservedName &&
        !isNewRole &&
        active &&
        !hiddenLocal &&
        inSelectedProcessLanes
      );

      let reason = "Visible";
      if (!roleName) reason = "Rol sin nombre";
      else if (reservedName) reason = "Nombre reservado";
      else if (isNewRole) reason = "Nombre temporal";
      else if (!active) reason = "Rol inactivo";
      else if (!hasOrder) reason = "Sin orden";
      else if (duplicate && !inSelectedProcessLanes) reason = "Duplicado por nombre";
      else if (!inSelectedProcessLanes) reason = "No entra a selectedProcessLanes";
      else if (hiddenLocal) reason = "Oculto en localStorage";

      return {
        id: role.id,
        rol: roleName,
        responsable: role.responsable || role.responsible || "",
        orden: order,
        activo: active,
        inSelectedProcessLanes,
        inVisibleLanes,
        hiddenLocal,
        reason,
      };
    });
  }, [isLocalhost, selectedProcess, selectedProcessLanes, macroHiddenLaneStorageKey]);

  const clearHiddenLanesForCurrentProcess = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(macroHiddenLaneStorageKey);
    window.location.reload();
  };

  const selectedSubprocessActivities = useMemo(() => {
    if (!selectedProcess || !selectedSubprocess) return [];

    const subprocessId = selectedSubprocess.subproceso_id || selectedSubprocess.id;

    return (selectedProcess.activities || [])
      .filter((activity) => {
        const activitySubprocessId = activity.subproceso_id;

        return subprocessId && activitySubprocessId && String(activitySubprocessId) === String(subprocessId);
      })
      .sort(
        (a, b) =>
          Number(a.orden_flujo ?? a.order ?? a.id ?? 0) -
          Number(b.orden_flujo ?? b.order ?? b.id ?? 0)
      )
      .map((activity) => ({
        ...activity,
      }));
  }, [selectedProcess, selectedSubprocess]);

  const selectedSubprocessLanes = useMemo(() => {
    if (!selectedSubprocess) return [];

    const activities = selectedSubprocessActivities || [];
    const roles = selectedProcess?.processRoles || [];

    const normalizeLaneName = (value) => String(value || "").trim();

    const getActivityLaneName = (activity) =>
      normalizeLaneName(
        activity.rol ||
          activity.lane ||
          activity.responsible ||
          activity.responsable ||
          activity.position ||
          activity.puesto ||
          "Responsable"
      );

    const seenRoleLanes = new Set();
    const roleLanes = roles.map((role) => {
      const lane = normalizeLaneName(role.roleName || role.rol || role.nombre || role.name || role.responsable || "");
      const order = firstValue(role, ["orden", "order"], null);
      return {
        id: role.id,
        lane,
        roleId: role.id,
        orden: order,
        order,
        isExplicitLane: order !== null && order !== undefined && String(order).trim() !== "",
        active: role.activo !== false && role.active !== false,
        blocks: activities.filter((activity) => getActivityLaneName(activity) === lane),
      };
    }).filter((lane) => {
      const key = lane.lane.toLowerCase();
      if (!key || seenRoleLanes.has(key)) return false;
      seenRoleLanes.add(key);
      return true;
    });

    const roleLaneNames = new Set(roleLanes.map((lane) => lane.lane));
    const lanesFromActivities = Array.from(
      new Set(
        activities
          .map((activity) => getActivityLaneName(activity))
          .filter(Boolean)
      )
    )
      .filter((lane) => !roleLaneNames.has(lane))
      .map((lane) => ({
        lane,
        active: true,
        blocks: activities.filter((activity) => getActivityLaneName(activity) === lane),
      }));

    const lanes = [...roleLanes, ...lanesFromActivities];

    return lanes;
  }, [selectedProcess, selectedSubprocess, selectedSubprocessActivities]);

 const selectedAvailableRoles = useMemo(() => {
  const baseRoles = [
    ...(selectedProcess?.roles || []),
    ...(selectedProcess?.processRoles || []),
    { rol: "Planificador de Producción", roleName: "Planificador de Producción", activo: true },
  ];

  const seen = new Set();

  return baseRoles.filter((role) => {
    const roleName = String(
      firstValue(role, ["rol", "roleName", "nombre", "name", "responsable"], "") || ""
    ).trim();

    const key = roleName.toLowerCase();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}, [selectedProcess]);

  const saveProcessChanges = (updatedFields) => {
    setProcessData((current) => current.map((process) => (process.id === selectedProcess?.id ? { ...process, ...updatedFields } : process)));
    setSelectedProcess((current) => (current ? { ...current, ...updatedFields } : current));
  };

  const saveSubprocessGeneralChanges = async (updatedFields) => {
    if (!selectedSubprocess?.id) return;

    const subprocessId = selectedSubprocess.subproceso_id || selectedSubprocess.id;
    const nextActive = updatedFields.active !== false;

    try {
 const savedSubprocess = await updateSubprocess(subprocessId, {
  proceso: selectedProcessName,
  codigo: updatedFields.code,
  nombre: updatedFields.name ?? updatedFields.nombre ?? updatedFields.subproceso ?? updatedFields.titulo,
  objetivo: updatedFields.objective,
  responsable: updatedFields.owner,
  carril:
    selectedSubprocess.lane ||
    selectedSubprocess.rol ||
    updatedFields.owner ||
    selectedSubprocess.responsable ||
    "",
  impacto: updatedFields.impact,
  beneficio: updatedFields.benefit,
  activo: nextActive,
});
      const updatedSubprocess = {
        ...selectedSubprocess,
        ...savedSubprocess,
        code: savedSubprocess.codigo ?? updatedFields.code,
        codigo: savedSubprocess.codigo ?? updatedFields.code,
        codigo_subproceso: savedSubprocess.codigo ?? updatedFields.code,
        name: savedSubprocess.nombre ?? updatedFields.name,
        nombre: savedSubprocess.nombre ?? updatedFields.name,
        objective: savedSubprocess.objetivo ?? updatedFields.objective,
        objetivo: savedSubprocess.objetivo ?? updatedFields.objective,
        description: savedSubprocess.objetivo ?? updatedFields.objective,
        responsible: savedSubprocess.responsable ?? updatedFields.owner,
        responsable: savedSubprocess.responsable ?? updatedFields.owner,
        owner: savedSubprocess.responsable ?? updatedFields.owner,
        impact: savedSubprocess.impacto ?? updatedFields.impact,
        impacto: savedSubprocess.impacto ?? updatedFields.impact,
        benefit: savedSubprocess.beneficio ?? updatedFields.benefit,
        beneficio: savedSubprocess.beneficio ?? updatedFields.benefit,
      
        active: savedSubprocess.activo ?? nextActive,
        activo: savedSubprocess.activo ?? nextActive,
        status: (savedSubprocess.activo ?? nextActive)
          ? selectedSubprocess.status || "default"
          : "inactive",
      };

      setSelectedSubprocess(updatedSubprocess);

      setProcessData((current) =>
        current.map((process) =>
          process.name === selectedProcessName
            ? {
                ...process,
                subprocesses: (process.subprocesses || []).map((subprocess) =>
                  Number(subprocess.id) === Number(subprocessId)
                    ? updatedSubprocess
                    : subprocess
                ),
              }
            : process
        )
      );

      setSelectedProcess((current) =>
        current
          ? {
              ...current,
              subprocesses: (current.subprocesses || []).map((subprocess) =>
                Number(subprocess.id) === Number(subprocessId)
                  ? updatedSubprocess
                  : subprocess
              ),
            }
          : current
      );
    } catch (error) {
      console.error("Error guardando datos generales del subproceso:", error);
      alert(
        `No se pudo guardar el subproceso: ${
          error.message || "revisa permisos de Supabase"
        }`
      );
    }
  };

  const saveActivityChanges = async (updatedActivity) => {
    let savedActivity = updatedActivity;
    const processNameForSave = selectedProcess?.name || selectedProcessName || updatedActivity.proceso || updatedActivity.processName;
    const activityDbId =
    
    
      updatedActivity.dbId || updatedActivity.supabaseId || updatedActivity.id;

    console.log("ActivityModal payload:", updatedActivity);
    console.log("ActivityModal save target:", { id: activityDbId, visualId: updatedActivity?.id, processName: processNameForSave });

    if (activityDbId) {
      savedActivity = await updateActivity(activityDbId, {
        actividad: updatedActivity.name,
        responsable: updatedActivity.responsible,
        puesto: updatedActivity.responsible,
        duracion_minutos:
          updatedActivity.durationMinutes ||
          Math.round(Number(updatedActivity.timeHours || 1) * 60),
        frecuencia: updatedActivity.frecuencia || updatedActivity.frequencyType || "Mensual",
        frecuencia_valor: updatedActivity.frecuencia_valor ?? updatedActivity.frequencyValue ?? 1,
        dia_tipico: updatedActivity.typicalDay || "Lunes",
        orden_flujo: updatedActivity.order,
        rol:
          updatedActivity.rol ||
          updatedActivity.role ||
          updatedActivity.lane ||
          updatedActivity.puesto ||
          updatedActivity.position ||
          updatedActivity.responsible ||
          null,
        fase: updatedActivity.fase,
        descripcion: updatedActivity.description || updatedActivity.impact,
        criticidad: updatedActivity.criticidad || updatedActivity.criticality,
        estado: updatedActivity.estado || updatedActivity.status,
        automatizada: updatedActivity.automatizada ?? updatedActivity.automated,
        impacto: updatedActivity.impacto ?? updatedActivity.impact,
        beneficio: updatedActivity.beneficio ?? updatedActivity.benefit,
        automatizacion_ia: updatedActivity.automatizacion_ia ?? updatedActivity.aiAutomation,
        carga_horas: updatedActivity.carga_horas ?? updatedActivity.monthlyHours,
        active: updatedActivity.active,
        proceso: processNameForSave,
        processName: processNameForSave,
      });

      console.log("ActivityModal saved from Supabase:", savedActivity);

      savedActivity = {
        ...savedActivity,
        dbId: savedActivity.id || activityDbId,
        supabaseId: savedActivity.id || activityDbId,
        name: savedActivity.actividad || updatedActivity.name,
        responsible: savedActivity.responsable || updatedActivity.responsible,
        position: savedActivity.puesto || updatedActivity.position,
        criticality: savedActivity.criticidad || updatedActivity.criticality,
        status: savedActivity.estado || updatedActivity.status,
        automated: savedActivity.automatizada ?? updatedActivity.automated,
        impact: savedActivity.impacto ?? updatedActivity.impact,
        benefit: savedActivity.beneficio ?? updatedActivity.benefit,
        aiAutomation: savedActivity.automatizacion_ia ?? updatedActivity.aiAutomation,
        frequencyType: savedActivity.frecuencia || updatedActivity.frequencyType,
        frequencyValue: savedActivity.frecuencia_valor ?? updatedActivity.frequencyValue,
        timeHours: savedActivity.duracion_minutos ? Number((savedActivity.duracion_minutos / 60).toFixed(2)) : updatedActivity.timeHours,
        durationMinutes: savedActivity.duracion_minutos || updatedActivity.durationMinutes,
        load: savedActivity.carga_horas ?? updatedActivity.load,
        active: savedActivity.activa ?? updatedActivity.active,
      };

      if (processNameForSave) {
        loadedProcessRef.current = "";
        await reloadSelectedProcessData(processNameForSave);
      }
    } else {
      throw new Error("La actividad no tiene id real de Supabase.");
    }

    setProcessData((current) =>
      current.map((process) =>
        process.name === processNameForSave
          ? {
              ...process,
              activities: (process.activities || []).map((activity) =>
                (activity.dbId || activity.supabaseId || activity.id) === activityDbId ? { ...updatedActivity, ...savedActivity } : activity
              ),
            }
          : process
      )
    );

    setSelectedProcess((current) =>
      current
        ? {
            ...current,
            activities: (current.activities || []).map((activity) =>
              (activity.dbId || activity.supabaseId || activity.id) === activityDbId ? { ...updatedActivity, ...savedActivity } : activity
            ),
          }
        : current
    );

    setSelectedActivity({ ...updatedActivity, ...savedActivity });
  };

  const confirmDeleteSubprocess = async () => {
    if (!deleteConfirm?.id) return;

    try {
      if (deleteConfirm.type === "activity") {
        await deleteActivity(deleteConfirm.id);
      } else {
        await deleteSubprocess(deleteConfirm.id);
      }

      if (deleteConfirm.type !== "activity" && Number(selectedSubprocess?.id) === Number(deleteConfirm.id)) {
        setSelectedSubprocess(null);
      }

      setDeleteConfirm(null);
      await reloadSelectedProcessData(selectedProcessName);
    } catch (error) {
      console.error("Error eliminando registro en Supabase:", error);
      alert(
        `No se pudo eliminar el registro: ${
          error.message || "revisa permisos de Supabase"
        }`
      );
    }
  };

  const selectedProcessName = selectedProcess?.name || processFilter;
  const nextLaneOrder = selectedProcessLanes.length;
  const nextBlockOrder = (selectedProcess?.activities || []).length;

  const addSupabaseRole = async (laneName, order) => {
    if (!selectedProcessName) return null;

    const normalizeLaneName = (value) => String(value || "").trim();
    const nextOrder = Number(order ?? selectedProcessLanes.length ?? 0) + 1;
    const finalLaneName = normalizeLaneName(laneName) || `Nuevo carril ${nextOrder}`;

    try {
      const existingLane = (selectedProcess?.processRoles || []).find((role) => {
        const roleName = normalizeLaneName(role.rol || role.roleName || role.nombre || role.name || role.responsable);
        return roleName.toLowerCase() === finalLaneName.toLowerCase();
      });

      if (existingLane) {
        const existingOrder = firstValue(existingLane, ["orden", "order"], null);
        const needsActivation = existingLane.activo === false || existingLane.active === false;
        const needsOrder = existingOrder === null || existingOrder === undefined || String(existingOrder).trim() === "";
        let savedLane = existingLane;

        if (needsActivation || needsOrder) {
          savedLane = await updateRole(existingLane.id, {
            rol: finalLaneName,
            responsable: existingLane.responsable || finalLaneName,
            orden: needsOrder ? nextOrder : existingOrder,
            activo: true,
          });
        }

        await reloadSelectedProcessData(selectedProcessName);
        setRoleCatalogError(null);
        return {
          lane: finalLaneName,
          roleId: savedLane?.id || existingLane.id,
          orden: savedLane?.orden ?? (needsOrder ? nextOrder : existingOrder),
          active: true,
          blocks: [],
        };
      }

      const created = await createRole({
        proceso: selectedProcessName,
        rol: finalLaneName,
        responsable: finalLaneName,
        orden: nextOrder,
      });

      const createdLane = {
        lane: created.rol || finalLaneName,
        roleId: created.id,
        orden: created.orden ?? nextOrder,
        active: created.activo !== false,
        blocks: [],
      };

      await reloadSelectedProcessData(selectedProcessName);
      setRoleCatalogError(null);
      return createdLane;
    } catch (error) {
      console.error("Error creando carril en Supabase:", error);
      alert(`No se pudo crear el carril: ${error.message || "revisa permisos de Supabase"}`);
      return null;
    }
  };

  const saveSupabaseRole = async (draft) => {
    if (!selectedProcessName) return;
    try {
      await createRole({
        proceso: selectedProcessName,
        rol: draft.rol,
        responsable: draft.responsable,
        orden: draft.orden,
      });
      setShowLaneForm(false);
      await reloadSelectedProcessData(selectedProcessName);
    } catch (error) {
      console.error("Error creando carril en Supabase:", error);
      alert(`No se pudo crear el carril: ${error.message || "revisa permisos de Supabase"}`);
    }
  };

  const addSupabaseSubprocess = async (block) => {
    if (!selectedProcessName) return null;

    const laneName = block?.lane || block?.responsible || selectedProcess?.owner || "Subprocesos";
    const currentSubprocessCount = selectedProcess?.subprocesses?.length || 0;
    const nextOrder = currentSubprocessCount + 1;

    try {
      const created = await createSubprocess({
        proceso: selectedProcessName,
        nombre: block?.name || `Nuevo subproceso ${nextOrder}`,
        responsable: laneName,
        carril: laneName,
        orden: nextOrder,
        activo: true,
      });

      const createdBlock = {
        ...created,
        id: created.id,
        subproceso_id: created.id,
        codigo_subproceso: created.codigo || created.codigo_subproceso || "",
        code: created.codigo || created.codigo_subproceso || "",
        name: created.nombre || created.name || `Nuevo subproceso ${nextOrder}`,
        rol: created.responsable || laneName,
        lane: created.responsable || laneName,
        responsible: created.responsable || laneName,
        position: created.puesto || created.responsable || laneName,
        processName: selectedProcessName,
        description: created.descripcion || "",
        criticality: created.criticidad || "medium",
        load: Number(created.carga || created.carga_horas || 0),
        active: created.activo !== false,
        status: created.estado || created.status || "default",
        order: Number(created.orden_flujo ?? created.orden ?? nextOrder),
        displayNumber: nextOrder,
        impact: created.impacto || "",
        benefit: created.beneficio || "",
        aiAutomation: created.automatizacion_ia || "",
        isSubprocess: true,
      };

      await reloadSelectedProcessData(selectedProcessName);
      return createdBlock;
    } catch (error) {
      console.error("Error creando subproceso en Supabase:", error);
      alert(`No se pudo crear el subproceso: ${error.message || "revisa permisos de Supabase"}`);
      return null;
    }
  };

 const addSupabaseActivity = async (block) => {
  if (!selectedProcessName || !selectedSubprocess) return null;

  const laneName =
    block?.lane ||
    block?.responsible ||
    "Responsable";

  const nextOrder =
    selectedSubprocessActivities.length + 1;

  try {
    const created = await createActivity({
      proceso: selectedProcessName,
      actividad: block?.name || `Nueva actividad ${nextOrder}`,
      responsable: laneName,
      rol: laneName,
      puesto: laneName,
      subproceso_id:
        selectedSubprocess.subproceso_id ||
        selectedSubprocess.id,
      codigo_subproceso:
        selectedSubprocess.codigo_subproceso ||
        selectedSubprocess.codigo ||
        selectedSubprocess.code ||
        null,
      duracion_minutos: 60,
      frecuencia: "Mensual",
      dia_tipico: "Lunes",
      orden_flujo: nextOrder,
    });

    const createdBlock = {
      ...created,
      id: created.id,
      dbId: created.id,
      supabaseId: created.id,
      name: created.actividad || `Nueva actividad ${nextOrder}`,
      rol: created.rol || laneName,
      lane: created.rol || laneName,
      responsible: created.responsable || laneName,
      position: created.puesto || laneName,
      processName: selectedProcessName,
      subproceso_id: created.subproceso_id,
      codigo_subproceso: created.codigo_subproceso,
      subproceso: created.subproceso,
      active: created.activo !== false,
      status: "default",
      order: created.orden_flujo ?? nextOrder,
      displayNumber: nextOrder,
      criticality: "medium",
      load: 0,
      timeHours: 1,
      durationMinutes: 60,
      frequencyType: "monthly",
      frequencyValue: 1,
      typicalDay: "Lunes",
      impact: created.descripcion || "",
      benefit: "",
      aiAutomation: "",
    };

    await reloadSelectedProcessData(selectedProcessName);
    return createdBlock;
  } catch (error) {
    console.error("Error creando actividad en Supabase:", error);
    alert(`No se pudo crear la actividad: ${error.message || "revisa permisos de Supabase"}`);
    return null;
  }
};

  const saveSupabaseActivity = async (draft) => {
    if (!selectedProcessName) return;
    try {
      await createActivity({
        proceso: selectedProcessName,
        subproceso_id: selectedSubprocess?.subproceso_id || selectedSubprocess?.id || draft.subproceso_id,
        codigo_subproceso: selectedSubprocess?.codigo_subproceso || selectedSubprocess?.codigo || selectedSubprocess?.code || draft.codigo_subproceso,
        ...draft,
      });
      setShowBlockForm(false);
      await reloadSelectedProcessData(selectedProcessName);
    } catch (error) {
      console.error("Error creando bloque en Supabase:", error);
      alert(`No se pudo crear el bloque: ${error.message || "revisa permisos de Supabase"}`);
    }
  };

  const updateSupabaseActivityInline = (blockId, updates) => {
    if (!selectedProcess?.id || !blockId) return;

    const cleanUpdates = { ...updates };
    delete cleanUpdates.id;
    delete cleanUpdates.displayNumber;

    updateActivity(blockId, {
      ...cleanUpdates,
      orden_flujo: updates.orden_flujo ?? updates.order,
      proceso: selectedProcess.name,
      processName: selectedProcess.name,
    })
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error actualizando bloque en Supabase:", error));
  };

  const removeSupabaseActivity = (blockId, block) => {
    if (!blockId) return;

    setDeleteConfirm({
      type: "activity",
      id: blockId,
      name:
        block?.actividad ||
        block?.name ||
        block?.titulo ||
        `Actividad ${blockId}`,
    });
  };

  const removeSupabaseRole = (lane) => {
    if (!lane?.roleId) return;
    updateRole(lane.roleId, { orden: null, activo: true })
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error quitando carril del macroproceso:", error));
  };

  const updateSupabaseRoleInline = (lane, updates) => {
    if (!lane?.roleId) return;

    updateRole(lane.roleId, {
      ...updates,
      rol: updates.rol || updates.lane || lane.lane,
      responsable: updates.responsable || updates.lane || lane.lane,
    })
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error actualizando carril en Supabase:", error));
  };

  const saveSupabaseLaneOrder = async (orderedLanes) => {
    const updates = (orderedLanes || [])
      .map((lane, index) => ({
        id: lane?.id || lane?.roleId,
        orden: index + 1,
      }))
      .filter((row) => row.id);

    if (!updates.length) return;

    try {
      await Promise.all(
        updates.map((row) =>
          updateRole(row.id, {
            orden: row.orden,
          })
        )
      );

      loadedProcessRef.current = "";
      await reloadSelectedProcessData(selectedProcessName);
    } catch (error) {
      console.error("Error guardando orden de carriles en Supabase:", error);
      alert(`No se pudo guardar el orden de carriles: ${error.message || "revisa permisos de Supabase"}`);
    }
  };

  const updateSupabaseSubprocessInline = (blockId, updates) => {
    if (!blockId) return;

    updateSubprocess(blockId, {
      ...updates,
      nombre: updates.name ?? updates.nombre ?? updates.subproceso ?? updates.titulo,
      responsable: updates.responsible || updates.responsable || updates.rol || updates.lane,
      carril: updates.lane || updates.rol || updates.responsible || updates.responsable,
      orden_flujo: updates.orden_flujo ?? updates.order,
      proceso: selectedProcessName,
    })
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error actualizando subproceso en Supabase:", error));
  };

  const removeSupabaseSubprocess = (blockId, block) => {
    if (!blockId) return;

    setDeleteConfirm({
      type: "subprocess",
      id: blockId,
      name:
        block?.nombre ||
        block?.name ||
        block?.subproceso ||
        `Subproceso ${blockId}`,
    });
  };

  const moveSupabaseSubprocess = (blockId, order, roleId, laneName, orderedBlocks = []) => {
    if (!blockId) return;

    const fallbackOrder = Number.isFinite(Number(order)) ? Number(order) + 1 : 1;
    const updates = orderedBlocks.length
      ? orderedBlocks
      : [{ id: blockId, order: fallbackOrder, roleId, lane: laneName }];

    Promise.all(
      updates
        .filter((item) => item?.id)
        .map((item) => updateSubprocessOrder(item.id, item.order, item.lane || laneName))
    )
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error moviendo subproceso:", error));
  };

  const moveSupabaseActivity = (blockId, order, roleId, laneName, orderedBlocks = []) => {
    if (!blockId) return;

    const fallbackOrder = Number.isFinite(Number(order)) ? Number(order) + 1 : 1;
    const updates = orderedBlocks.length
      ? orderedBlocks
      : [{ id: blockId, order: fallbackOrder, roleId, lane: laneName }];

    Promise.all(
      updates
        .filter((item) => item?.id)
        .map((item) => updateActivityOrder(item.id, item.order, item.roleId || roleId, item.lane || laneName))
    )
      .then(() => reloadSelectedProcessData(selectedProcessName))
      .catch((error) => console.error("Error actualizando orden de flujo:", error));
  };

  if (selectedSubprocess) {
    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-[#071226] px-5 py-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">Vista detallada del subproceso</div>
              <div className="mt-1 truncate text-lg font-black text-white">{selectedSubprocess.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowGeneralData(true)} className="rounded-xl bg-white/10 px-4 py-1.5 text-[11px] font-black text-white hover:bg-white/20">Datos generales</button>
              <button onClick={() => { setSelectedSubprocess(null); setSelectedActivity(null); setShowGeneralData(false); }} className="rounded-xl bg-white/10 px-4 py-1.5 text-[11px] font-black text-white hover:bg-white/20">&larr; Volver al macro</button>
            </div>
          </div>
          <div className="bg-slate-50/40 p-4">
            <VisualGridMap
              title="Actividades del subproceso"
              initialLanes={selectedSubprocessLanes}
              blockKey="blocks"
              storageKey={`capacity_subprocess_${selectedSubprocess.id || selectedSubprocess.name}_flow_v1`}
              onSelectBlock={setSelectedActivity}
              addBlockLabel="+ Actividad"
              createBlock={(nextId, laneName) => ({
                id: nextId,
                name: `Nueva actividad ${nextId}`,
                responsible: laneName,
                rol: laneName,
                lane: laneName,
                subproceso_id: selectedSubprocess.subproceso_id || selectedSubprocess.id,
                codigo_subproceso: selectedSubprocess.codigo_subproceso || selectedSubprocess.codigo || selectedSubprocess.code || null,
                subproceso: selectedSubprocess.name,
                criticality: "medium",
                load: 0,
                active: true,
                status: "default",
                time: "",
                timeHours: 0,
                frequencyType: "monthly",
                frequencyValue: 1,
                frequencyMonthly: 1,
                weeklyHours: 0,
                monthlyHours: 0,
                automated: false,
                impact: "",
                benefit: "",
                aiAutomation: "",
              })}
              onAddLane={addSupabaseRole}
              onAddBlock={addSupabaseActivity}
              onUpdateBlock={updateSupabaseActivityInline}
              onRemoveBlock={removeSupabaseActivity}
              onMoveBlock={moveSupabaseActivity}
              onRemoveLane={undefined}
              onUpdateLane={updateSupabaseRoleInline}
              onSaveLaneOrder={saveSupabaseLaneOrder}
              availableRoles={selectedAvailableRoles}
              roleCatalogError={roleCatalogError}
            />
          </div>
        </section>
        {showGeneralData && selectedSubprocess && <GeneralDataModal process={selectedSubprocess} onSave={saveSubprocessGeneralChanges} onClose={() => setShowGeneralData(false)} availableRoles={selectedProcess?.processRoles || []} />}
        {showLaneForm && <LaneFormModal processName={selectedProcessName} nextOrder={nextLaneOrder} onSave={saveSupabaseRole} onClose={() => setShowLaneForm(false)} />}
        {showBlockForm && <BlockFormModal processName={selectedProcessName} roles={selectedAvailableRoles} nextOrder={nextBlockOrder} onSave={saveSupabaseActivity} onClose={() => setShowBlockForm(false)} />}
{selectedActivity && (
  <ActivityModal
    activity={selectedActivity}
    onSave={saveActivityChanges}
    onClose={() => setSelectedActivity(null)}
    availableRoles={selectedAvailableRoles}
  />
)}

{deleteConfirm && (
  <DeleteConfirmModal
    item={deleteConfirm}
    onCancel={() => setDeleteConfirm(null)}
    onConfirm={confirmDeleteSubprocess}
  />
)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2">
        <div className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Filtrar por proceso:</div>
        <select value={processFilter} onChange={(event) => setProcessFilter(event.target.value)} className="h-8 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-[#0f172a] outline-none focus:border-red-300">
          {processOptions.map((option) => (<option key={option}>{option}</option>))}
        </select>
        <button onClick={() => setShowVideo(true)} className="h-8 rounded-xl bg-red-600 px-3 text-[11px] font-black text-white shadow-sm hover:bg-red-700">▶ Ver video</button>
        <button
          type="button"
          onClick={() => window.open("/manuales/Manual_Organizational_Design.pdf", "_blank")}
          className="h-8 rounded-xl border border-gray-200 bg-white px-4 text-[11px] font-black text-gray-500 hover:border-red-200 hover:text-red-500"
        >
          📄 Manual
        </button>
      </section>

      <section className="grid grid-cols-4 gap-1.5">
        <MiniMetric title="Subprocesos" value={metrics.processCount} note="Activos" />
        <MiniMetric title="Capacidad" value={metrics.coverage} note="Disponible" yellow />
        <MiniMetric title="Procesos crÃ­ticos" value={metrics.criticalProcesses} note="Requieren atenciÃ³n" red />
        <MiniMetric title="Roles crÃ­ticos" value={metrics.criticalRoles} note="Saturados" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
        <div className="bg-[#071226] px-5 py-2">
          <div className="text-lg font-black text-white">MACROPROCESO {selectedProcess?.name || processFilter}</div>
          <div className="text-[11px] text-gray-400">Flujo horizontal por carriles de rol. Selecciona un bloque para abrir su vista detallada.</div>
        </div>
        <VisualGridMap
          title="Editor visual del macroproceso"
          initialLanes={selectedProcessLanes}
          blockKey="blocks"
          storageKey={`capacity_process_${selectedProcess?.id || processFilter}_flow_v1`}
          onSelectBlock={setSelectedSubprocess}
          addBlockLabel="+ Subproceso"
          createBlock={(nextId, laneName) => ({
            id: nextId,
            name: `Nuevo subproceso ${nextId}`,
            responsible: laneName,
            rol: laneName,
            lane: laneName,
            criticality: "medium",
            load: 0,
            active: true,
            status: "default",
            order: nextId,
            displayNumber: nextId,
            impact: "",
            benefit: "",
            aiAutomation: "",
            isSubprocess: true,
          })}
          onAddLane={addSupabaseRole}
          onAddBlock={addSupabaseSubprocess}
          onUpdateBlock={updateSupabaseSubprocessInline}
          onRemoveBlock={removeSupabaseSubprocess}
          onMoveBlock={moveSupabaseSubprocess}
          onRemoveLane={removeSupabaseRole}
          onUpdateLane={updateSupabaseRoleInline}
          onSaveLaneOrder={saveSupabaseLaneOrder}
          availableRoles={selectedAvailableRoles}
          roleCatalogError={roleCatalogError}
        />
        {isLocalhost && (
          <div className="border-t border-gray-200 bg-slate-50/60 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">Diagnóstico de carriles</div>
                <div className="mt-1 text-[11px] font-semibold text-gray-500">Visible solo en localhost. Revisa en qué filtro se queda cada rol.</div>
              </div>
              <button
                type="button"
                onClick={clearHiddenLanesForCurrentProcess}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black text-gray-500 hover:border-red-200 hover:text-red-600"
              >
                Limpiar carriles ocultos de este proceso
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-gray-50 text-[9px] uppercase tracking-[0.16em] text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Responsable</th>
                    <th className="px-3 py-2">Orden</th>
                    <th className="px-3 py-2">Activo</th>
                    <th className="px-3 py-2">En selectedProcessLanes</th>
                    <th className="px-3 py-2">En visibleLanes</th>
                    <th className="px-3 py-2">Oculto local</th>
                    <th className="px-3 py-2">Motivo de exclusión</th>
                  </tr>
                </thead>
                <tbody>
                  {laneDiagnostics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-3 text-center font-semibold text-gray-400">Sin roles cargados para diagnosticar.</td>
                    </tr>
                  ) : (
                    laneDiagnostics.map((item) => (
                      <tr key={item.id || item.rol} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-black text-[#0f172a]">{item.rol || "-"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.responsable || "-"}</td>
                        <td className="px-3 py-2 font-bold text-gray-600">{item.orden ?? "-"}</td>
                        <td className="px-3 py-2">{item.activo ? "Sí" : "No"}</td>
                        <td className="px-3 py-2">{item.inSelectedProcessLanes ? "Sí" : "No"}</td>
                        <td className="px-3 py-2">{item.inVisibleLanes ? "Sí" : "No"}</td>
                        <td className="px-3 py-2">{item.hiddenLocal ? "Sí" : "No"}</td>
                        <td className="px-3 py-2 font-semibold text-gray-600">{item.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      {showGeneralData && selectedProcess && <GeneralDataModal process={selectedProcess} onSave={saveProcessChanges} onClose={() => setShowGeneralData(false)} />}
      {showLaneForm && <LaneFormModal processName={selectedProcessName} nextOrder={nextLaneOrder} onSave={saveSupabaseRole} onClose={() => setShowLaneForm(false)} />}
      {showBlockForm && <BlockFormModal processName={selectedProcessName} roles={selectedAvailableRoles} nextOrder={nextBlockOrder} onSave={saveSupabaseActivity} onClose={() => setShowBlockForm(false)} />}
{selectedActivity && (
  <ActivityModal
    activity={selectedActivity}
    onSave={saveActivityChanges}
    onClose={() => setSelectedActivity(null)}
    availableRoles={selectedAvailableRoles}
  />
)}

{deleteConfirm && (
  <DeleteConfirmModal
    item={deleteConfirm}
    onCancel={() => setDeleteConfirm(null)}
    onConfirm={confirmDeleteSubprocess}
  />
)}
{showVideo && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
    <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white text-gray-800 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-gray-400">Video de apoyo</div>
          <div className="font-black">Video Diseño Organizacional</div>
        </div>
        <button
          type="button"
          onClick={() => setShowVideo(false)}
          className="h-10 w-10 rounded-xl bg-red-600 text-xl font-black text-white transition hover:bg-red-700"
          aria-label="Cerrar video"
        >
          ×
        </button>
      </div>

      <div className="aspect-video bg-black">
        <iframe
          src={organizationalDesignVideoUrl}
          title="Video Diseño Organizacional"
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  </div>
)}
</div>

  );
}





