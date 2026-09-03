import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { isStrategicTeamMember } from "../../services/permissionsService";
import { createWorkloadAssignment } from "../../services/workloadService";
import { getEstados, upsertEstado, getHistorial, getChecks, createCheck } from "../../services/sigService";
import { getPlanMacroprocesos, updatePendienteEstado, getPlanHistorial } from "../../services/sigPlanService";
import { upsertResultado } from "../../services/performanceService";
import { mapProcesses, processLeaders } from "../../services/processCatalog";
import {
  getCambios, createCambio, updateCambio, sendToDecisionCenter,
  createAccionCorrectivaPorCambio, getHistorial as getCambiosHistorial,
} from "../../services/cambiosService";
import { canEvaluateCambio, canApproveCambio, canImplementCambio, isDirectorGeneral } from "../../services/permissionsService";
import {
  getAuditorias, createAuditoria, updateAuditoria, deleteAuditoria, createAccionDesdeHallazgo,
  getProgramas, createPrograma, updatePrograma, aprobarPrograma, downloadProgramaPdf,
  firmarProgramaComoCoordinador, firmarProgramaComoPM, esAuditadoDeAlguna, enviarFichaParaFirma,
} from "../../services/auditoriasService";
import { getAcciones } from "../../services/accionesService";
import { PM_PERSONA_ID } from "../../services/pmoService";
import AuditoriaFichaPanel from "./AuditoriaFichaPanel";

const ESTADOS_AUDITORIA = ["Programada", "En curso", "Cerrada"];
const AUDITORIA_ESTADO_BADGE = {
  Programada: "border-slate-200 bg-slate-50 text-slate-500",
  "En curso": "border-amber-200 bg-amber-50 text-amber-700",
  Cerrada: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

// El equipo auditor se restringe a este grupo por pedido explícito:
// Alejandro, Jacqueline, Elizabeth.
const AUDITORIA_EQUIPO_PERSONA_IDS = [14, 12, 1];
// El auditor líder puede ser cualquiera del equipo anterior, más Cristian
// (Coordinador SIG) — también por pedido explícito.
export const COORDINADOR_SIG_PERSONA_ID = 15;
const AUDITORIA_LIDER_PERSONA_IDS = [...AUDITORIA_EQUIPO_PERSONA_IDS, COORDINADOR_SIG_PERSONA_ID];

// Nombre/macroproceso del KPI en Desempeño Organizacional que refleja el
// avance global del SIG — ya existía, no se crea uno nuevo. Se busca por
// nombre en vez de id fijo por si el id difiere entre entornos.
const SIG_KPI_MACROPROCESO = "Planeación estratégica del SIG";
const SIG_KPI_NOMBRE = "% diagnóstico implementación SIG";

let subnumeralDescriptions = {
  "4.1 Comprensión de la organización y su contexto": "Analizar entorno, riesgos y situación actual de la empresa.",
  "4.2 Partes interesadas": "Identificar clientes, proveedores y actores relevantes.",
  "4.3 Alcance del SIG": "Definir qué cubre oficialmente el sistema.",
  "4.4 Procesos del SIG": "Gestionar procesos y su interacción dentro del SIG.",
  "5.1 Liderazgo y compromiso": "Impulsar el compromiso de la dirección con el SIG.",
  "5.1.2 Enfoque al cliente": "Asegurar satisfacción y cumplimiento al cliente.",
  "5.2 Política": "Comunicar compromisos y dirección estratégica.",
  "5.3 Roles y responsabilidades": "Definir responsabilidades y autoridades.",
  "6.1 Riesgos y oportunidades": "Gestionar riesgos y oportunidades del sistema.",
  "6.2 Objetivos del SIG": "Establecer metas y seguimiento del SIG.",
  "6.3 Cambios": "Controlar cambios organizacionales y operativos.",
  "7.1 Recursos": "Asegurar recursos necesarios para operar.",
  "7.2 Competencias": "Desarrollar capacidades y habilidades requeridas.",
  "7.3 Toma de conciencia": "Fortalecer la cultura y el conocimiento del SIG en el personal.",
  "7.4 Comunicación": "Definir qué, cuándo, a quién y cómo comunicar sobre el SIG.",
  "7.5 Información documentada": "Controlar documentos y registros del sistema.",
  "8.1 Control operacional": "Controlar actividades críticas de operación.",
  "8.2 Cliente": "Gestionar requisitos y comunicación con clientes.",
  "8.3 Diseño y desarrollo": "Controlar diseño y desarrollo de productos.",
  "8.4 Proveedores externos": "Gestionar proveedores y compras externas.",
  "8.5 Producción controlada": "Asegurar producción bajo control operativo.",
  "8.6 Liberación": "Controlar la liberación de productos y servicios.",
  "8.7 Control de las salidas no conformes": "Identificar y controlar salidas que no cumplen los requisitos.",
  "8.8 Cliente interno": "Asegurar que cada proceso atiende bien a quien recibe su trabajo, no solo al cliente externo.",
  "9.1 Seguimiento y medición": "Medir desempeño y resultados del SIG.",
  "9.1.2 Satisfacción del cliente": "Evaluar percepción y satisfacción del cliente.",
  "9.2 Auditoría interna": "Verificar cumplimiento mediante auditorías.",
  "9.3 Revisión por la dirección": "Evaluar desempeño estratégico del SIG.",
  "10.1 Mejora": "Promover mejora continua del sistema.",
  "10.2 Acción correctiva": "Corregir causas de incumplimientos.",
  "10.3 Mejora continua": "Buscar mejorar continuamente la eficacia del SIG.",
};

export let sigSections = [
  {
    numeral: "4",
    title: "Contexto de la organización",
    percent: 85,
    summary: "Entender empresa, alcance y procesos",
    groups: [
      {
        subtitle: "4.1 Comprensión de la organización y su contexto",
        rows: [
          [1, "La organización ha identificado factores internos que afectan su estrategia", "SIG-PL-01 Planeación estratégica / FODA", "Planeación Estratégica", 10],
          [2, "La organización ha identificado factores externos del entorno", "SIG-PL-01 Planeación estratégica / PESTEL", "Planeación Estratégica", 10],
          [3, "Estos factores se revisan periódicamente", "Revisión por la dirección / Actualización", "Dirección", 10],
        ],
      },
      {
        subtitle: "4.2 Partes interesadas",
        rows: [
          [4, "Las partes interesadas del SIG están identificadas", "SIG-MA-07 Partes interesadas", "Planeación Estratégica", 10],
          [5, "Se han identificado sus necesidades y requisitos", "SIG-MA-07 Partes interesadas", "Planeación Estratégica", 10],
          [6, "Se determina cuáles requisitos son obligatorios para el SIG", "SIG-MA-07 Partes interesadas", "Planeación Estratégica", 5],
        ],
      },
      {
        subtitle: "4.3 Alcance del SIG",
        rows: [
          [7, "El alcance del SIG está documentado", "SIG-PL-01 Planeación estratégica / Alcance", "Planeación Estratégica", 10],
          [8, "El alcance considera productos y servicios", "SIG-PL-01 Planeación estratégica / Alcance", "Planeación Estratégica", 10],
        ],
      },
      {
        subtitle: "4.4 Procesos del SIG",
        rows: [
          [9, "Se cuenta con un procedimiento estándar para la gestión de procesos", "SIG-P-01 Gestión por procesos", "Planeación Estratégica", 10],
          [10, "Se han definido entradas, salidas, criterios y controles para cada proceso", "Caracterizaciones / Modelado de procesos", "Todos", 3],
          [11, "Cada proceso cuenta con sus respectivas matrices de cumplimiento", "Matrices de cumplimiento", "Todos", 3],
        ],
      },
    ],
  },
  {
    numeral: "5",
    title: "Liderazgo",
    percent: 44,
    summary: "Compromiso, clientes y responsabilidades",
    groups: [
      { subtitle: "5.1 Liderazgo y compromiso", rows: [[1, "La alta dirección demuestra compromiso con el SIG", "Revisión por la dirección", "Dirección", 3], [2, "El SIG está alineado con la estrategia organizacional", "SIG-PL-01H Planeación estratégica / Análisis", "Dirección", 10], [3, "Se promueve el enfoque a procesos", "Aprobación final de proceso a líderes", "Dirección", 3]] },
      { subtitle: "5.1.2 Enfoque al cliente", rows: [[4, "Se garantiza que los requisitos de los clientes se determinan y cumplen", "Pedidos / KPI cumplimiento", "Ventas", 3], [5, "Se gestionan riesgos que afectan la satisfacción del cliente", "Matriz gestión de riesgos", "Ventas", 0], [6, "Se monitorea la satisfacción del cliente", "Encuestas / Quejas atendidas", "Ventas", 0]] },
      { subtitle: "5.2 Política", rows: [[7, "Existe una política integral y está en un documento controlado", "SIG-PO-01 Política integral", "Planeación Estratégica", 10], [8, "La política se tiene disponible y está comunicada a las partes interesadas", "Acuse de recepción / Recurso visual", "Planeación Estratégica", 5], [9, "Se promueve la alineación de la política con la cultura organizacional", "Cumplimiento de compromisos", "Dirección", 3]] },
      { subtitle: "5.3 Roles y responsabilidades", rows: [[10, "Se han definido roles claros y su objetivo dentro de cada proceso/subproceso", "Caracterizaciones / Modelado de procesos", "Todos", 3], [11, "Las autoridades necesarias para gestionar los procesos están establecidas", "Caracterizaciones / Modelado de procesos", "Todos", 3]] },
    ],
  },
  {
    numeral: "6",
    title: "Planificación",
    percent: 52,
    summary: "Riesgos, metas y cambios",
    groups: [
      { subtitle: "6.1 Riesgos y oportunidades", rows: [[1, "Se identifican riesgos y oportunidades del SIG", "SIG-MA-05 Riesgos y oportunidades", "Todos", 5], [2, "Se planifican acciones para tratar riesgos y oportunidades", "SIG-MA-05 Riesgos y oportunidades", "Todos", 3], [3, "Las acciones se integran dentro de los procesos", "Caracterizaciones / Modelado de procesos", "Todos", 3]] },
      { subtitle: "6.2 Objetivos del SIG", rows: [[4, "Existen objetivos del SIG", "SIG-MP-01 Mapa estratégico", "Planeación Estratégica", 10], [5, "Se han planificado acciones para lograr los objetivos", "Iniciativas gestionadas como proyecto", "Dirección", 3], [6, "Existe registro del seguimiento de objetivos", "SIG-TC-01 Tablero de control", "Dirección", 10]] },
      { subtitle: "6.3 Cambios", rows: [[7, "Existe un proceso definido para gestionar los cambios del SIG", "SIG-P-02 Gestión de cambios", "Planeación Estratégica", 10], [8, "Se evalúan riesgos antes de implementar cambios", "Análisis de impactos", "Planeación Estratégica", 3], [9, "Se mantiene registro de los cambios", "Control de cambios", "Planeación Estratégica", 0]] },
    ],
  },
  {
    numeral: "7",
    title: "Apoyo",
    percent: 36,
    summary: "Recursos, capacitación y documentos",
    groups: [
      { subtitle: "7.1 Recursos", rows: [[1, "La organización determina y proporciona recursos para el SIG", "SIG-F-02 Presupuesto estrategia", "Dirección", 10], [2, "La organización asegura la infraestructura necesaria", "Hojas de vida de activos", "Dirección", 3], [3, "Se define y proporciona el personal necesario para cada proceso", "Análisis de capacidad / Plan de cobertura", "Dirección", 3], [13, "El conocimiento crítico del proceso está identificado y protegido ante la salida de personal clave", "Documentación de know-how / respaldo de conocimiento", "Todos", 0]] },
      { subtitle: "7.2 Competencias", rows: [[4, "Competencias por rol definidas", "GCO-M-01 Diccionario de competencias", "Todos", 5], [5, "Nivel requerido por proceso determinado", "Matriz de competencia por proceso", "Todos", 0], [6, "Brechas de competencia evaluadas", "Análisis de brechas", "Todos", 0]] },
      { subtitle: "7.3 Toma de conciencia", rows: [[7, "Personal conoce políticas del SIG", "Entrevistas / checklist", "Dirección", 5]] },
      { subtitle: "7.4 Comunicación", rows: [[8, "Canales de comunicación definidos", "SIG-MA-06 Comunicaciones", "Planeación Estratégica", 5], [9, "Desempeño del SIG comunicado", "Informes / tableros", "Planeación Estratégica", 3]] },
      { subtitle: "7.5 Información documentada", rows: [[10, "Documentación del SIG controlada", "SIG-P-02 Control de información documentada", "Planeación Estratégica", 10], [11, "Lista maestra por proceso", "Lista maestra de documentos por proceso", "Todos", 3], [12, "Accesos y permisos controlados", "Administración de accesos", "Todos", 3]] },
    ],
  },
  {
    numeral: "8",
    title: "Operación",
    percent: 36,
    summary: "Operación, producción y calidad",
    groups: [
      { subtitle: "8.1 Control operacional", rows: [[1, "Procesos operativos planificados", "Planes / programación", "Todos", 3], [2, "Controles operativos establecidos", "Procedimientos / instrucciones", "Todos", 3]] },
      { subtitle: "8.2 Cliente", rows: [[3, "Requisitos del cliente identificados", "Pedido / especificaciones", "Ventas", 5], [4, "Cambios de requisitos gestionados", "Modificación de pedido", "Ventas", 5], [5, "Comunicación con cliente mantenida", "Registros de comunicación", "Ventas", 5]] },
      { subtitle: "8.3 Diseño y desarrollo", rows: [[6, "Diseño planificado", "Plan de diseño / proyecto", "Desarrollo de productos", 5], [7, "Requisitos de diseño identificados", "Planos / fichas técnicas", "Desarrollo de productos", 5], [8, "Cambios de diseño controlados", "Registro de cambios de diseño", "Desarrollo de productos", 3]] },
      { subtitle: "8.4 Proveedores externos", rows: [[9, "Proveedores seleccionados con criterios", "Evaluación de proveedores", "Compras", 3], [10, "Desempeño de proveedores monitoreado", "Seguimiento de proveedores", "Compras", 3], [11, "Requisitos a proveedores comunicados", "Orden de compra / especificación", "Compras", 5]] },
      { subtitle: "8.5 Producción controlada", rows: [[12, "Producción bajo condiciones controladas", "Fichas técnicas / instrucciones", "Planeación producción", 3], [13, "Seguimiento durante producción", "Registros de inspección", "Producción/Calidad", 3], [14, "Recursos y personal competente", "Infraestructura / competencias", "Planeación producción", 5]] },
      { subtitle: "8.6 Liberación", rows: [[15, "Productos verificados antes de liberarse", "Registros de inspección", "Calidad", 3], [16, "Liberación autorizada", "Autorización de liberación", "Calidad", 3]] },
      { subtitle: "8.7 Control de las salidas no conformes", rows: [[17, "Salidas no conformes controladas", "Registro de no conformidades", "Calidad", 3]] },
      { subtitle: "8.8 Cliente interno", rows: [[18, "Se ha identificado quién recibe el resultado del proceso (cliente interno) y qué espera de él", "Caracterizaciones / Mapa de procesos (entradas-salidas)", "Todos", 0], [19, "Se da seguimiento a si el cliente interno recibe lo que necesita, a tiempo y con la calidad esperada", "Retroalimentación / quejas internas registradas", "Todos", 0]] },
    ],
  },
  {
    numeral: "9",
    title: "Evaluación del desempeño",
    percent: 12,
    summary: "Medición, auditorías y seguimiento",
    groups: [
      { subtitle: "9.1 Seguimiento y medición", rows: [[1, "Indicadores del SIG establecidos", "SIG-MA-07 Tablero de control", "Todos", 10], [2, "Datos de desempeño recopilados", "Tableros de control", "Todos", 0], [3, "Periodicidad de seguimiento definida", "Programa de revisión del SIG", "Todos", 0], [10, "Los datos recopilados se analizan y se usan para tomar decisiones, no solo se registran", "Análisis de indicadores / actas de revisión", "Todos", 0]] },
      { subtitle: "9.1.2 Satisfacción del cliente", rows: [[4, "Necesidades y expectativas del cliente monitoreadas", "Encuestas / reclamos", "Ventas", 3]] },
      { subtitle: "9.2 Auditoría interna", rows: [[5, "Programa de auditoría establecido", "Programas de auditoría", "Evaluación desempeño", 0], [6, "Criterios y alcance definidos", "Planes de auditoría", "Evaluación desempeño", 0], [7, "Informes de auditoría generados", "Informes de auditoría", "Evaluación desempeño", 0]] },
      { subtitle: "9.3 Revisión por la dirección", rows: [[8, "Revisión del SIG planificada", "Acta de revisión", "Dirección", 0], [9, "Decisiones y acciones generadas", "Informe de decisiones", "Dirección", 0]] },
    ],
  },
  {
    numeral: "10",
    title: "Mejora continua",
    percent: 0,
    summary: "Corrección y mejora continua",
    groups: [
      { subtitle: "10.1 Mejora", rows: [[1, "Oportunidades de mejora determinadas", "Planes de mejora documentados", "Todos", 0]] },
      { subtitle: "10.2 Acción correctiva", rows: [[3, "Acciones correctivas planteadas", "Plan de acciones", "Todos", 0], [4, "Acciones correctivas implementadas y evaluadas", "Plan de acciones", "Todos", 0], [5, "Causas de no conformidades analizadas", "Análisis de causas", "Todos", 0]] },
      { subtitle: "10.3 Mejora continua", rows: [[2, "Mejora continua promovida", "Iniciativas de mejora", "Todos", 0]] },
    ],
  },
];

let processAliases = {
  "Planeación estratégica del SIG": ["Planeación Estratégica", "Todos"],
  "Planeación financiera": ["Todos"],
  "Gestión de competencias": ["Gestión competencias", "Todos"],
  "Evaluación desempeño del SIG": ["Evaluación desempeño", "Todos"],
  Ventas: ["Ventas", "Todos"],
  "Ingeniería / Desarrollo de productos": ["Desarrollo de productos", "Todos"],
  Compras: ["Compras", "Todos"],
  "Planeación y control de la producción": ["Planeación producción", "Producción/Calidad", "Todos"],
  "Gestión de inventarios": ["Todos"],
  "Control de almacenes": ["Todos"],
  Distribución: ["Todos"],
  "Gestión de calidad": ["Calidad", "Producción/Calidad", "Todos"],
  "Recursos humanos": ["Todos"],
  "Gestión de Seguridad y Salud laboral": ["Todos"],
  "Transformación Digital y Automatización": ["Todos"],
  "Contabilidad y Cumplimiento Fiscal": ["Todos"],
};

function processApplies(rowProcess, selectedProcess) {
  if (selectedProcess === "Todos") return true;
  return (processAliases[selectedProcess] || [selectedProcess, "Todos"]).includes(rowProcess);
}

export function cleanSubtitle(subtitle) {
  return subtitle.replace(/^\d+(\.\d+)*\s*/, "");
}

function responsibleLabel(processName) {
  const info = processLeaders[processName] || { role: "Por asignar", person: "Sin responsable" };
  return { process: processName, role: info.role, person: info.person };
}

function statusTextColor(percent) {
  if (percent >= 80) return "text-emerald-600";
  if (percent >= 50) return "text-amber-600";
  if (percent > 0) return "text-red-600";
  return "text-slate-500";
}

function statusBg(percent) {
  if (percent >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (percent >= 50) return "bg-amber-50 border-amber-200 text-amber-700";
  if (percent > 0) return "bg-red-50 border-red-200 text-red-700";
  return "bg-slate-100 border-slate-200 text-slate-500";
}

export function cellStyle(score) {
  if (score === null || score === undefined) return "bg-slate-100 text-slate-400 ring-1 ring-slate-200";
  if (score >= 10) return "bg-emerald-100 text-emerald-700";
  if (score >= 5) return "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200/60";
  if (score >= 3) return "bg-amber-100/80 text-amber-700 ring-1 ring-amber-200/70";
  return "bg-rose-100 text-rose-700 ring-1 ring-rose-200/70";
}

export function scoreMeaning(score) {
  if (score === null || score === undefined) return "Sin evaluar";
  if (score >= 10) return "Estandarizado";
  if (score >= 5) return "Implementado";
  if (score >= 3) return "En desarrollo";
  return "No implementado";
}

function implementationStatus(percent) {
  if (percent >= 80) return "Sistema consolidado";
  if (percent >= 50) return "Implementación parcial";
  return "Implementación inicial";
}

function rowKey(groupSubtitle, number) {
  return `${groupSubtitle}-${number}`;
}

// Score y evidencia son independientes por proceso: un criterio transversal
// ("Todos") lo puede ver Ventas, Compras, etc., cada uno con su propio
// avance — no comparten el mismo registro. Si hay un proceso filtrado, se
// usa ese; si se está viendo "Todos" y el criterio es específico de un solo
// proceso, se usa ese proceso (no hay ambigüedad); si es transversal Y se
// está viendo "Todos", se usa un cajón general propio ("Todos"), separado
// de cualquier proceso puntual.
export function resolveProceso(rowResponsible, selectedProcess) {
  if (selectedProcess !== "Todos") return selectedProcess;
  return rowResponsible;
}

function stateKey(groupSubtitle, number, proceso) {
  return `${rowKey(groupSubtitle, number)}::${proceso}`;
}

// Devuelve null cuando el criterio nunca se ha evaluado para este proceso
// (no existe fila en sig_diagnostico_estados) — antes caía en row[4], el
// valor semilla del checklist, indistinguible en pantalla de una evaluación
// real. null es la señal explícita de "sin evaluar" en todo el módulo.
function getRowScore(statusOverrides, group, row, selectedProcess) {
  const proceso = resolveProceso(row[3], selectedProcess);
  const key = stateKey(group.subtitle, row[0], proceso);
  return key in statusOverrides ? statusOverrides[key] : null;
}

function groupAverage(group) {
  const total = group.rows.reduce((sum, row) => sum + row[4], 0);
  return Math.round((total / (group.rows.length * 10)) * 100);
}

// Al filtrar por un proceso específico, solo deben promediarse los
// criterios que realmente le aplican (los suyos + los transversales
// "Todos") — antes se promediaban TODAS las filas de la sección/subnumeral
// sin filtrar, así que criterios de otros procesos (ej. Ventas, Compras)
// diluían el % con su valor base fijo (row[4]) y el número se sentía
// "pegado" sin importar qué proceso se seleccionara.
// null = ningún criterio del grupo tiene evaluación real todavía (distinto
// de 0%, que significaría "evaluado y en No implementado"). Los criterios
// sin evaluar se excluyen del promedio, no cuentan como 0.
function groupAverageWithOverrides(group, statusOverrides, selectedProcess = "Todos") {
  const rows = selectedProcess === "Todos" ? group.rows : group.rows.filter((row) => processApplies(row[3], selectedProcess));
  const scores = rows.map((row) => getRowScore(statusOverrides, group, row, selectedProcess)).filter((score) => score !== null);
  if (!scores.length) return null;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / (scores.length * 10)) * 100);
}

function sectionAverageWithOverrides(section, statusOverrides, selectedProcess = "Todos") {
  const allRows = section.groups.flatMap((group) => group.rows.map((row) => ({ group, row })));
  const rows = selectedProcess === "Todos" ? allRows : allRows.filter((item) => processApplies(item.row[3], selectedProcess));
  const scores = rows.map((item) => getRowScore(statusOverrides, item.group, item.row, selectedProcess)).filter((score) => score !== null);
  if (!scores.length) return null;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / (scores.length * 10)) * 100);
}

// Promedio SIEMPRE en el contexto "Todos" — usado en la calificación global
// fija (no se mueve con el filtro, a diferencia de la barra de progreso).
function globalAverageWithOverrides(sections, statusOverrides) {
  const values = sections.map((section) => sectionAverageWithOverrides(section, statusOverrides, "Todos")).filter((value) => value !== null);
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

// Promedio de los criterios aplicables a un solo proceso, a través de los 7
// numerales — esto es lo que ve la barra de progreso cuando hay un proceso
// filtrado (distinto de "Todos").
function processAverageWithOverrides(sections, selectedProcess, statusOverrides) {
  if (selectedProcess === "Todos") return globalAverageWithOverrides(sections, statusOverrides);
  const rows = sections.flatMap((section) =>
    section.groups.flatMap((group) => group.rows.filter((row) => processApplies(row[3], selectedProcess)).map((row) => ({ group, row })))
  );
  const scores = rows.map((item) => getRowScore(statusOverrides, item.group, item.row, selectedProcess)).filter((score) => score !== null);
  if (!scores.length) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / (scores.length * 10)) * 100);
}

function getSectionDelta(section, statusOverrides, selectedProcess = "Todos") {
  const current = sectionAverageWithOverrides(section, statusOverrides, selectedProcess);
  if (current === null) return null;
  const original = section.percent;
  return current - original;
}

function getDynamicAction(section, selectedProcess, statusOverrides = {}) {
  const sectionRows = section.groups.flatMap((group) => group.rows.filter((row) => processApplies(row[3], selectedProcess)).map((row) => ({ group, row })));
  const scores = sectionRows.map((item) => getRowScore(statusOverrides, item.group, item.row, selectedProcess)).filter((score) => score !== null);
  if (!scores.length) return { action: "Sin evaluar", processAverage: null };
  const processAverage = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const action = processAverage >= 10 ? "Hay que mantener" : processAverage >= 5 ? "Hay que monitorear" : processAverage >= 3 ? "Hay pendientes" : "Hay que empezar";
  return { action, processAverage };
}

function getProcessInsights(selectedProcess, statusOverrides = {}) {
  const applicableRows = sigSections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.rows
        .filter((row) => processApplies(row[3], selectedProcess))
        .map((row) => {
          return {
            section: section.title,
            numeral: section.numeral,
            subtitle: group.subtitle,
            score: getRowScore(statusOverrides, group, row, selectedProcess),
            requirement: row[1],
            process: row[3],
          };
        })
    )
  );

  const directRows = applicableRows.filter((row) => row.process !== "Todos");
  const baseRows = directRows.length > 0 ? directRows : applicableRows;

  // score === null significa "nunca evaluado" — se excluye de las 4
  // categorías de madurez (fuerte/medio/débil/crítico) en vez de colar por
  // null <= 3 (true en JS) hacia "débil", que lo haría ver peor de lo que
  // realmente se sabe.
  const evaluatedRows = baseRows.filter((row) => row.score !== null);
  const notEvaluatedCount = baseRows.length - evaluatedRows.length;
  const totalRows = evaluatedRows.length;
  const strongCount = evaluatedRows.filter((row) => row.score >= 8).length;
  const mediumCount = evaluatedRows.filter((row) => row.score === 5).length;
  const weakCount = evaluatedRows.filter((row) => row.score <= 3).length;
  const criticalCount = evaluatedRows.filter((row) => row.score === 0).length;

  const weakAreas = [...new Set(evaluatedRows.filter((row) => row.score <= 3).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);
  const strongAreas = [...new Set(evaluatedRows.filter((row) => row.score >= 8).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);
  const monitorAreas = [...new Set(evaluatedRows.filter((row) => row.score === 5).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);

  let strength = "El proceso aún no demuestra un nivel sólido de madurez operativa ni evidencia consistente del SIG.";

  if (strongCount >= 3) {
    strength = `Se observan controles relativamente estables en ${strongAreas.join(", ")}; sin embargo, todavía deben demostrar sostenibilidad y seguimiento formal.`;
  } else if (strongCount > 0) {
    strength = `Existen avances puntuales en ${strongAreas.join(", ")}, aunque el proceso todavía presenta variabilidad en su implementación.`;
  }

  let weakness = "Persisten debilidades estructurales que limitan la confiabilidad operativa y documental del proceso.";

  if (criticalCount >= 3) {
    weakness = `Se detectan incumplimientos críticos en ${weakAreas.join(", ")}; el proceso no puede considerarse controlado bajo criterios del SIG.`;
  } else if (weakCount > 0) {
    weakness = `Se identifican brechas relevantes en ${weakAreas.join(", ")}; la implementación sigue siendo parcial y con evidencia insuficiente.`;
  }

  let recommendation = "Formalizar controles, responsables, seguimiento y evidencia objetiva antes de considerar el proceso estabilizado.";

  if (criticalCount >= 3) {
    recommendation = `Prioridad alta: intervenir ${weakAreas.join(", ")} mediante acciones correctivas, responsables definidos y seguimiento semanal.`;
  } else if (weakCount > 0) {
    recommendation = `Fortalecer ${weakAreas.join(", ")} y validar evidencia operativa antes de ampliar el alcance del SIG.`;
  } else if (mediumCount > 0) {
    recommendation = `Monitorear ${monitorAreas.join(", ")} para evitar desviaciones y consolidar controles existentes.`;
  } else if (strongCount === totalRows && totalRows > 0) {
    recommendation = "Conservar controles actuales y mantener verificación continua de eficacia y trazabilidad documental.";
  }

  return { strength, weakness, recommendation, notEvaluatedCount };
}

// "Nombre de pila" contra el catálogo de personas (formato "APELLIDOS
// NOMBRE") — mismo criterio que firstNameOnly() en OrgChartCanvas.jsx.
function findPersonaByFirstName(personasCatalogo, firstName) {
  if (!firstName) return null;
  const target = firstName.trim().toLowerCase();
  return personasCatalogo.find((persona) => {
    const parts = String(persona.nombre || "").trim().split(/\s+/);
    return parts[parts.length - 1]?.toLowerCase() === target;
  }) || null;
}

const PLAN_ESTADOS = ["Pendiente", "En progreso", "Completado"];

function nextPlanEstado(estado) {
  const idx = PLAN_ESTADOS.indexOf(estado);
  return PLAN_ESTADOS[(idx + 1) % PLAN_ESTADOS.length];
}

function planEstadoBg(estado) {
  if (estado === "Completado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (estado === "En progreso") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function HistorialTimelineModal({ open, onClose, loading, entries, selectedProcess }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#111827] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Línea de tiempo de hitos</p>
            <p className="text-[10px] font-bold text-slate-300">{selectedProcess === "Todos" ? "Todos los procesos" : selectedProcess}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-4">
          {loading ? (
            <div className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay hitos registrados para este proceso.</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.key} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${entry.type === "check" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                    {entry.type === "check" ? "✓" : "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-800">{entry.title}</span>
                      <span className="text-[9px] font-bold text-slate-400">{formatDateTime(entry.date)}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-500">{entry.detail} · {entry.nombre || "Usuario desconocido"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Formulario compacto para crear la asignación en Balance de Carga —
// mismo patrón que ConvertirEnAsignacionForm en Seguimiento Estratégico /
// Acuerdos S&OP, adaptado a este módulo (persona/rol precargados con el
// líder del proceso filtrado, pero editables antes de confirmar).
function SigAsignacionForm({ colSpan, personasCatalogo, defaultPersonaId, defaultRol, defaultTitulo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState(defaultPersonaId || "");
  const [rol, setRol] = useState(defaultRol || "");
  const [titulo, setTitulo] = useState(defaultTitulo || "");
  const [horas, setHoras] = useState(2);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) { setError("Selecciona a quién se le asigna."); return; }
    if (!titulo.trim()) { setError("El título no puede quedar vacío."); return; }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      rol,
      titulo: titulo.trim(),
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <tr className="border-b border-slate-100 bg-sky-50/50">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Persona
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-56 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="">Selecciona...</option>
              {personasCatalogo.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Título
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Rol
            <input type="text" value={rol} onChange={(e) => setRol(e.target.value)} className="mt-1 h-9 w-40 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Horas estimadas
            <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Fecha límite
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Prioridad
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {saving ? "Enviando..." : "Confirmar asignación"}
          </button>
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
        </div>
        {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

// Misma forma que SigAsignacionForm, pero en tarjeta (div) en vez de fila de
// tabla, para encajar en las tarjetas de macroproceso del Plan de
// implementación.
function PlanAsignacionForm({ personasCatalogo, defaultPersonaId, defaultRol, defaultTitulo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState(defaultPersonaId || "");
  const [rol, setRol] = useState(defaultRol || "");
  const [titulo, setTitulo] = useState(defaultTitulo || "");
  const [horas, setHoras] = useState(2);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) { setError("Selecciona a quién se le asigna."); return; }
    if (!titulo.trim()) { setError("El título no puede quedar vacío."); return; }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      rol,
      titulo: titulo.trim(),
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Persona
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-52 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            <option value="">Selecciona...</option>
            {personasCatalogo.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Título
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Horas estimadas
          <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Fecha límite
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Enviando..." : "Confirmar asignación"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

// Control de Cambios (SIG-P-03): estados en el orden del BPMN del
// procedimiento — se usa para saber qué tramos del formulario ya se
// alcanzaron y mostrarlos como historial aunque ya no sean editables.
const CAMBIO_ESTADO_BADGE = {
  Solicitado: "border-slate-200 bg-slate-100 text-slate-600",
  "En evaluación": "border-sky-200 bg-sky-50 text-sky-700",
  "En aprobación": "border-amber-200 bg-amber-50 text-amber-700",
  Rechazado: "border-red-200 bg-red-50 text-red-700",
  Aprobado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "En implementación": "border-indigo-200 bg-indigo-50 text-indigo-700",
  "En seguimiento": "border-violet-200 bg-violet-50 text-violet-700",
  "Cerrado - Eficaz": "border-emerald-300 bg-emerald-100 text-emerald-800",
  "Cerrado - No eficaz": "border-red-300 bg-red-100 text-red-800",
};
const CAMBIO_ESTADO_ORDER = ["Solicitado", "En evaluación", "En aprobación", "Aprobado", "En implementación", "En seguimiento"];
function getCambioStageIndex(estado) {
  if (estado === "Rechazado") return -1;
  if (estado === "Cerrado - Eficaz" || estado === "Cerrado - No eficaz") return 5;
  return CAMBIO_ESTADO_ORDER.indexOf(estado);
}

function CambioDetailModal({
  cambio, people,
  canEvaluate, canApprove, canImplement,
  onClose, onSaveSolicitud, onIniciarEvaluacion, onGuardarEvaluacion, onEnviarAprobacion,
  onAprobar, onRechazar, onGuardarImplementacion, onPasarASeguimiento, onCerrarSeguimiento, onGenerarAccionCorrectiva,
}) {
  const [solicitudDraft, setSolicitudDraft] = useState({
    descripcion: cambio.descripcion || "", proceso_impactado: cambio.proceso_impactado || "",
    beneficios_esperados: cambio.beneficios_esperados || "", riesgos: cambio.riesgos || "",
  });
  const [evalDraft, setEvalDraft] = useState({
    impacto_objetivos_sig: cambio.impacto_objetivos_sig || "", impacto_legal: cambio.impacto_legal || "",
    impacto_riesgos_oportunidades: cambio.impacto_riesgos_oportunidades || "", recursos_necesarios: cambio.recursos_necesarios || "",
    informe_analisis: cambio.informe_analisis || "",
  });
  const [aprobacionDraft, setAprobacionDraft] = useState({
    responsable_implementacion_persona_id: cambio.responsable_implementacion_persona_id || "",
    plazo_implementacion: cambio.plazo_implementacion || "", recursos_asignados: cambio.recursos_asignados || "",
    rechazo_justificacion: "",
  });
  const [implDraft, setImplDraft] = useState({
    plan_ejecucion: cambio.plan_ejecucion || "", documentacion_actualizada: cambio.documentacion_actualizada || false,
    comunicado: cambio.comunicado || false, documentacion_obsoleta_retirada: cambio.documentacion_obsoleta_retirada || false,
    registrado_en_matriz: cambio.registrado_en_matriz || false,
  });
  const [seguimientoDraft, setSeguimientoDraft] = useState({
    indicadores_verificacion: cambio.indicadores_verificacion || "", decision_seguimiento: cambio.decision_seguimiento || "",
  });

  const estadoIndex = getCambioStageIndex(cambio.estado);
  const isRechazado = cambio.estado === "Rechazado";
  const isCerrado = cambio.estado?.startsWith("Cerrado");
  const inputCls = "mt-1 w-full resize-none rounded-xl border px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#111827] px-5 py-3 text-white">
          <div>
            <p className="text-[9px] font-bold text-slate-300">Control de cambios SIG-P-03</p>
            <p className="text-sm font-black">{cambio.titulo}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${CAMBIO_ESTADO_BADGE[cambio.estado] || ""}`}>{cambio.estado}</span>
            {cambio.proceso_impactado && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">{cambio.proceso_impactado}</span>}
            <span className="text-[10px] font-bold text-slate-400">Solicitó: {cambio.solicitante?.nombre || cambio.solicitante_nombre || "—"}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">1. Solicitud</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                Motivo / descripción
                <textarea rows={2} disabled={cambio.estado !== "Solicitado"} value={solicitudDraft.descripcion} onChange={(e) => setSolicitudDraft((d) => ({ ...d, descripcion: e.target.value }))} className={`${inputCls} border-slate-200 bg-slate-50 disabled:bg-white`} />
              </label>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Proceso impactado
                <select disabled={cambio.estado !== "Solicitado"} value={solicitudDraft.proceso_impactado} onChange={(e) => setSolicitudDraft((d) => ({ ...d, proceso_impactado: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:bg-white">
                  <option value="">Sin definir</option>
                  {mapProcesses.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Beneficios esperados
                <textarea rows={2} disabled={cambio.estado !== "Solicitado"} value={solicitudDraft.beneficios_esperados} onChange={(e) => setSolicitudDraft((d) => ({ ...d, beneficios_esperados: e.target.value }))} className={`${inputCls} border-slate-200 bg-slate-50 disabled:bg-white`} />
              </label>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                Riesgos del cambio
                <textarea rows={2} disabled={cambio.estado !== "Solicitado"} value={solicitudDraft.riesgos} onChange={(e) => setSolicitudDraft((d) => ({ ...d, riesgos: e.target.value }))} className={`${inputCls} border-slate-200 bg-slate-50 disabled:bg-white`} />
              </label>
            </div>
            {cambio.estado === "Solicitado" && (
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => onSaveSolicitud(solicitudDraft)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 hover:bg-slate-50">Guardar</button>
                {canEvaluate && <button type="button" onClick={onIniciarEvaluacion} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Iniciar evaluación →</button>}
              </div>
            )}
          </div>

          {estadoIndex >= 1 && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">2. Evaluación · Coordinador SIG</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {[
                  ["impacto_objetivos_sig", "Impacto en objetivos del SIG"],
                  ["impacto_legal", "Cumplimiento legal / normativo"],
                  ["impacto_riesgos_oportunidades", "Riesgos y oportunidades"],
                  ["recursos_necesarios", "Recursos necesarios"],
                ].map(([field, label]) => (
                  <label key={field} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {label}
                    <textarea rows={2} disabled={!canEvaluate || cambio.estado !== "En evaluación"} value={evalDraft[field]} onChange={(e) => setEvalDraft((d) => ({ ...d, [field]: e.target.value }))} className={`${inputCls} border-sky-100 bg-white disabled:bg-sky-50/60`} />
                  </label>
                ))}
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                  Informe del análisis
                  <textarea rows={2} disabled={!canEvaluate || cambio.estado !== "En evaluación"} value={evalDraft.informe_analisis} onChange={(e) => setEvalDraft((d) => ({ ...d, informe_analisis: e.target.value }))} className={`${inputCls} border-sky-100 bg-white disabled:bg-sky-50/60`} />
                </label>
              </div>
              {canEvaluate && cambio.estado === "En evaluación" && (
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => onGuardarEvaluacion(evalDraft)} className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-[10px] font-black text-sky-700 hover:bg-sky-50">Guardar evaluación</button>
                  <button type="button" onClick={() => onEnviarAprobacion(evalDraft)} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Enviar a Dirección →</button>
                </div>
              )}
            </div>
          )}

          {(estadoIndex >= 2 || isRechazado) && (
            <div className={`rounded-2xl border p-3 ${isRechazado ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isRechazado ? "text-red-700" : "text-amber-700"}`}>3. Aprobación · Director General</p>
              {cambio.decision_id && <p className="mt-1 text-[10px] font-bold text-slate-400">Visible en la Bandeja de Centro de Decisiones.</p>}
              {isRechazado ? (
                <p className="mt-2 text-[11px] font-medium text-slate-700">Justificación del rechazo: {cambio.rechazo_justificacion || "—"}</p>
              ) : cambio.estado === "En aprobación" && canApprove ? (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Responsable de implementación
                      <select value={aprobacionDraft.responsable_implementacion_persona_id} onChange={(e) => setAprobacionDraft((d) => ({ ...d, responsable_implementacion_persona_id: e.target.value }))} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-2 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                        <option value="">Sin asignar</option>
                        {people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Plazo
                      <input type="date" value={aprobacionDraft.plazo_implementacion} onChange={(e) => setAprobacionDraft((d) => ({ ...d, plazo_implementacion: e.target.value }))} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-2 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Recursos asignados
                      <input type="text" value={aprobacionDraft.recursos_asignados} onChange={(e) => setAprobacionDraft((d) => ({ ...d, recursos_asignados: e.target.value }))} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-2 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input type="text" placeholder="Justificación si se rechaza..." value={aprobacionDraft.rechazo_justificacion} onChange={(e) => setAprobacionDraft((d) => ({ ...d, rechazo_justificacion: e.target.value }))} className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none" />
                    <button type="button" onClick={() => onRechazar(aprobacionDraft.rechazo_justificacion)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-50">Rechazar</button>
                    <button type="button" onClick={() => onAprobar(aprobacionDraft)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700">Aprobar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-600">
                  <span>Responsable: {cambio.responsable_implementacion?.nombre || "—"}</span>
                  <span>Plazo: {cambio.plazo_implementacion || "—"}</span>
                  <span>Recursos: {cambio.recursos_asignados || "—"}</span>
                </div>
              )}
            </div>
          )}

          {estadoIndex >= 3 && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">4. Implementación · Líder de proceso</p>
              <label className="mt-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Plan de ejecución
                <textarea rows={2} disabled={!canImplement || !["Aprobado", "En implementación"].includes(cambio.estado)} value={implDraft.plan_ejecucion} onChange={(e) => setImplDraft((d) => ({ ...d, plan_ejecucion: e.target.value }))} className={`${inputCls} border-indigo-100 bg-white disabled:bg-indigo-50/60`} />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  ["documentacion_actualizada", "Documentación actualizada"],
                  ["comunicado", "Cambio comunicado a partes interesadas"],
                  ["documentacion_obsoleta_retirada", "Documentación obsoleta retirada"],
                  ["registrado_en_matriz", "Registrado en Matriz de Control de Cambios"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                    <input type="checkbox" disabled={!canImplement || !["Aprobado", "En implementación"].includes(cambio.estado)} checked={implDraft[field]} onChange={(e) => setImplDraft((d) => ({ ...d, [field]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              {canImplement && ["Aprobado", "En implementación"].includes(cambio.estado) && (
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => onGuardarImplementacion(implDraft)} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-50">Guardar</button>
                  <button type="button" onClick={() => onPasarASeguimiento(implDraft)} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Pasar a seguimiento →</button>
                </div>
              )}
            </div>
          )}

          {estadoIndex >= 4 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">5. Seguimiento y cierre</p>
              <label className="mt-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Indicadores / evidencia de verificación
                <textarea rows={2} disabled={!canImplement || isCerrado} value={seguimientoDraft.indicadores_verificacion} onChange={(e) => setSeguimientoDraft((d) => ({ ...d, indicadores_verificacion: e.target.value }))} className={`${inputCls} border-violet-100 bg-white disabled:bg-violet-50/60`} />
              </label>
              {!isCerrado && canImplement && cambio.estado === "En seguimiento" && (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  <select value={seguimientoDraft.decision_seguimiento} onChange={(e) => setSeguimientoDraft((d) => ({ ...d, decision_seguimiento: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-600 outline-none">
                    <option value="">Si no es eficaz…</option>
                    <option value="Ajustar el cambio">Ajustar el cambio</option>
                    <option value="Revertir al estado anterior">Revertir al estado anterior</option>
                    <option value="Diseñar nuevo plan">Diseñar nuevo plan</option>
                  </select>
                  <button type="button" onClick={() => onCerrarSeguimiento({ ...seguimientoDraft, eficaz: false })} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-50">No fue eficaz</button>
                  <button type="button" onClick={() => onCerrarSeguimiento({ ...seguimientoDraft, eficaz: true })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700">Fue eficaz ✓</button>
                </div>
              )}
              {cambio.estado === "Cerrado - No eficaz" && !cambio.accion_correctiva_id && canImplement && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={onGenerarAccionCorrectiva} className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-red-700">Generar acción correctiva →</button>
                </div>
              )}
              {cambio.accion_correctiva_id && <p className="mt-2 text-[10px] font-bold text-slate-400">Acción correctiva generada en Acciones de Mejora.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Desplegable compacto de selección múltiple para el equipo auditor —
// mismo componente ya usado para participantes de Minutas en
// src/modules/strategic-followup/StrategicFollowupModule.jsx.
function MultiSelectDropdown({ options, selectedIds, onToggle, placeholder = "Selecciona..." }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
      >
        <span className="truncate">{selected.length ? `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}` : placeholder}</span>
        <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((p) => (
            <span key={p.id} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">{p.nombre}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {options.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold normal-case tracking-normal text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => onToggle(p.id)} />
              {p.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Botón compacto para apartar el tiempo de una auditoría como asignación
// real en Balance de Carga — mismo patrón visual que AsignacionButton en
// src/modules/strategic-followup/StrategicFollowupModule.jsx.
function AuditoriaAsignacionButton({ onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Convertir en asignación de Balance de Carga"
      className={`text-sm font-black leading-none transition ${active ? "text-amber-600" : "text-slate-300 hover:text-amber-600"}`}
    >
      ◆
    </button>
  );
}

// Dispara la notificación + alerta a pantalla completa del auditado
// (MeetingAttendanceAlarm.jsx sondea getPendingFichasParaFirmar). Clic de
// nuevo mientras está en amarillo = reenviar (útil si el auditado la cerró
// o pospuso sin firmar).
function AuditoriaEnviarFirmaButton({ auditoria, onClick, sending }) {
  if (!auditoria.auditado_persona_id) return null;
  const firmado = Boolean(auditoria.firmado_auditado_nombre);
  const enviado = Boolean(auditoria.enviado_auditado_at) && !firmado;
  const nombreAuditado = auditoria.auditado?.nombre || "el auditado";
  const destinatarios = `${nombreAuditado}, Director General y Project Manager`;
  const title = firmado
    ? `${nombreAuditado} ya firmó — clic para reenviar y pedir nueva firma a los 3`
    : enviado
      ? `Enviado a ${destinatarios} — pendiente de firma. Clic para reenviar.`
      : `Enviar a ${destinatarios} para firmar`;
  return (
    <button
      type="button"
      disabled={sending}
      onClick={onClick}
      title={title}
      className={`text-sm font-black leading-none transition disabled:opacity-40 ${firmado ? "text-emerald-600 hover:text-emerald-700" : enviado ? "text-amber-600 hover:text-amber-700" : "text-slate-300 hover:text-sky-600"}`}
    >
      {firmado ? "✓✉" : "✉"}
    </button>
  );
}

// Mismo formulario compacto (persona/horas/fecha límite/prioridad) ya usado
// en Acuerdos S&OP y Seguimiento Estratégico para convertir un renglón en
// una asignación real, adaptado a una fila de auditoría.
function AuditoriaAsignacionForm({ personasCatalogo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState("");
  const [horas, setHoras] = useState(4);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Alta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) { setError("Selecciona a quién se le asigna."); return; }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Persona
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-52 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            <option value="">Selecciona...</option>
            {personasCatalogo.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Horas estimadas
          <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Fecha límite
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Enviando..." : "Confirmar asignación"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

export default function DiagnosticoSIGModule({ currentUser }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState("Todos");
  const [statusOverrides, setStatusOverrides] = useState({});
  const [evidenceOverrides, setEvidenceOverrides] = useState({});
  const [people, setPeople] = useState([]);
  const [lastCheck, setLastCheck] = useState(null);
  const [checkingProcess, setCheckingProcess] = useState(false);
  const [message, setMessage] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialEntries, setHistorialEntries] = useState([]);
  const [convertingSection, setConvertingSection] = useState(null);
  // Mapa macroproceso -> id de su propio KPI "% diagnóstico implementación
  // SIG" (existe uno por cada uno de los 16 procesos, no solo uno global).
  const [sigKpiIds, setSigKpiIds] = useState({});

  // Vista discreta: alterna entre el diagnóstico HLS de siempre y el nuevo
  // Plan de implementación — mismo módulo, sin rediseño, solo un toggle.
  const [view, setView] = useState("diagnostico");
  const [planMacroprocesos, setPlanMacroprocesos] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [convertingPendienteId, setConvertingPendienteId] = useState(null);
  const [planHistorialOpen, setPlanHistorialOpen] = useState(false);
  const [planHistorialLoading, setPlanHistorialLoading] = useState(false);
  const [planHistorialEntries, setPlanHistorialEntries] = useState([]);

  const [cambios, setCambios] = useState(null);
  const [cambiosLoading, setCambiosLoading] = useState(false);
  const [cambiosMessage, setCambiosMessage] = useState("");
  const [cambioCreating, setCambioCreating] = useState(false);
  const [cambioNewDraft, setCambioNewDraft] = useState({ titulo: "", descripcion: "", procesoImpactado: "", beneficiosEsperados: "", riesgos: "" });
  const [selectedCambio, setSelectedCambio] = useState(null);
  const [cambiosHistorialOpen, setCambiosHistorialOpen] = useState(false);
  const [cambiosHistorialLoading, setCambiosHistorialLoading] = useState(false);
  const [cambiosHistorialEntries, setCambiosHistorialEntries] = useState([]);

  const [auditorias, setAuditorias] = useState(null);
  const [auditoriasLoading, setAuditoriasLoading] = useState(false);
  const [auditoriasMessage, setAuditoriasMessage] = useState("");
  const [auditoriaCreating, setAuditoriaCreating] = useState(false);
  const [auditoriaNewDraft, setAuditoriaNewDraft] = useState({ macroproceso: "", fechaProgramada: "", auditorLiderPersonaId: "", equipoPersonaIds: [], reporteUrl: "", notas: "", auditadoPersonaId: "", alcance: "", modalidadLugar: "", criterios: [] });
  const [auditoriaAsignandoId, setAuditoriaAsignandoId] = useState(null);
  const [auditoriaPersonaOptions, setAuditoriaPersonaOptions] = useState([]);
  const [accionesPorAuditoria, setAccionesPorAuditoria] = useState({});
  const [auditoriaAccionFormId, setAuditoriaAccionFormId] = useState(null);
  const [auditoriaAccionDraft, setAuditoriaAccionDraft] = useState({ titulo: "", descripcion: "", responsablePersonaId: "", prioridad: "Alta" });
  const [auditoriaFichaAbiertaId, setAuditoriaFichaAbiertaId] = useState(null);
  const [enviandoFirmaId, setEnviandoFirmaId] = useState(null);

  // Deep-link desde la alerta de "informe pendiente de firmar"
  // (MeetingAttendanceAlarm.jsx → navigate("/sig", { state: { openAuditoriaId } })):
  // al llegar con ese estado, cae directo en Planes con esa ficha ya desplegada.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const openId = location.state?.openAuditoriaId;
    if (!openId) return;
    setView("auditorias");
    setAuditoriasSubTab("planes");
    setAuditoriaFichaAbiertaId(openId);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Quien no es equipo estratégico nunca ve la sub-pestaña "Programas"
  // (se oculta más abajo), así que arranca directo en "Planes" — si no,
  // vería un tab en blanco por defecto.
  const [auditoriasSubTab, setAuditoriasSubTab] = useState(() => (isStrategicTeamMember(currentUser) ? "programas" : "planes"));
  const [programas, setProgramas] = useState(null);
  const [programasLoading, setProgramasLoading] = useState(false);
  // number = fila existente abierta; "new" = formulario de alta; null = nada abierto.
  const [programaExpandedId, setProgramaExpandedId] = useState(null);
  const [programaEditing, setProgramaEditing] = useState(false);
  const [programaMessage, setProgramaMessage] = useState("");
  const PROGRAMA_CAMPOS_VACIOS = { nombre: "Programa 1 de pre-auditorías SIG", objetivos: "", alcance: "", riesgosOportunidades: "", recursosRoles: "", criteriosGenerales: "", enfoqueMetodologico: "", documentosReferencia: "" };
  const [programaDraft, setProgramaDraft] = useState(PROGRAMA_CAMPOS_VACIOS);
  const programaVigente = (programas || []).find((p) => p.estado === "Vigente") || null;
  const programaAbierto = typeof programaExpandedId === "number" ? (programas || []).find((p) => p.id === programaExpandedId) || null : null;

  const canEdit = isStrategicTeamMember(currentUser);
  // La tabla de Planes (auditorías) y su ficha solo las edita el
  // Coordinador SIG — pedido explícito, más restrictivo que canEdit (que
  // cubre a todo el equipo estratégico).
  const canEditPlanes = Number(currentUser?.persona_id) === COORDINADOR_SIG_PERSONA_ID;
  // Programas y Planes de auditoría están ocultos para el resto de la
  // empresa por defecto — solo equipo estratégico, más la excepción
  // puntual de quien sea auditado de alguna sesión (necesita ver y firmar
  // su propia ficha, no el resto del histórico).
  const [esAuditado, setEsAuditado] = useState(false);
  const puedeVerAuditorias = canEdit || esAuditado;
  // Espejo de lo último realmente guardado en Supabase (no lo que se va
  // tecleando) — así commitEvidence puede saber qué cambió de verdad al
  // hacer blur, sin depender del estado de UI que ya se actualizó en vivo.
  const savedEvidenceRef = useRef({});

  async function loadEstados() {
    const estados = await getEstados();
    const nextStatus = {};
    const nextEvidence = {};
    estados.forEach((row) => {
      const key = stateKey(row.subtitulo, row.numero, row.proceso);
      nextStatus[key] = row.score;
      if (row.evidencia != null) nextEvidence[key] = row.evidencia;
    });
    setStatusOverrides(nextStatus);
    setEvidenceOverrides(nextEvidence);
    savedEvidenceRef.current = nextEvidence;
    return nextStatus;
  }

  async function loadPeople() {
    const { data, error } = await supabase.from("personas").select("id,nombre").order("nombre", { ascending: true });
    if (error) { console.error("Error al cargar personas:", error); return; }
    setPeople(data || []);
  }

  // Existe una fila "% diagnóstico implementación SIG" por cada uno de los
  // 16 macroprocesos (mapProcesses), no solo una — antes solo se cargaba (y
  // sincronizaba) la de "Planeación estratégica del SIG", así que era el
  // único tablero que se actualizaba solo; el resto de los líderes se
  // quedaba en "—" para siempre.
  async function loadSigKpiIds() {
    const { data, error } = await supabase
      .from("desempeno_kpis")
      .select("id, macroproceso")
      .eq("nombre_indicador", SIG_KPI_NOMBRE)
      .eq("activo", true);
    if (error) { console.error("Error al buscar los KPIs de avance del SIG:", error); return; }
    const map = {};
    (data || []).forEach((row) => { map[row.macroproceso] = row.id; });
    setSigKpiIds(map);
    return map;
  }

  // Empuja el % recién guardado a cada KPI "% diagnóstico implementación
  // SIG" que exista: el de "Planeación estratégica del SIG" recibe el
  // promedio global (es el tablero del Coordinador SIG, refleja el avance
  // del sistema completo); el resto recibe el promedio de SU PROPIO proceso
  // (processAverageWithOverrides), que es lo que su líder realmente ve en
  // Diagnóstico HLS al filtrar por su proceso. Antes de escribir se compara
  // contra el valor ya guardado ese mes: si no cambió, no se vuelve a
  // guardar (evita entradas de historial falsas). Esto también sirve de
  // reparación automática: se llama al entrar al módulo (no solo al editar
  // un criterio), así que los 15 KPIs que se habían quedado en "—" se
  // corrigen solos la primera vez que cualquiera abra Diagnóstico SIG.
  async function syncSigKpi(nextStatusOverrides, kpiIdsOverride) {
    const ids = kpiIdsOverride || sigKpiIds;
    if (!ids || Object.keys(ids).length === 0) return;
    const now = new Date();
    const anio = now.getFullYear();
    const mes = now.getMonth() + 1;
    const kpiIdList = Object.values(ids);
    const { data: existentes, error: existentesError } = await supabase
      .from("desempeno_resultados")
      .select("kpi_id, valor")
      .in("kpi_id", kpiIdList)
      .eq("anio", anio)
      .eq("mes", mes)
      .eq("tipo", "real")
      .is("semana", null);
    if (existentesError) console.error("Error al leer resultados previos del KPI de avance del SIG:", existentesError);
    const valorPrevioPorKpi = Object.fromEntries((existentes || []).map((r) => [r.kpi_id, r.valor]));

    await Promise.all(
      mapProcesses.map(async (proceso) => {
        const kpiId = ids[proceso];
        if (!kpiId) return;
        const pct = proceso === SIG_KPI_MACROPROCESO
          ? globalAverageWithOverrides(sigSections, nextStatusOverrides)
          : processAverageWithOverrides(sigSections, proceso, nextStatusOverrides);
        const nuevoValor = pct / 100;
        const valorPrevio = valorPrevioPorKpi[kpiId];
        if (valorPrevio != null && Math.abs(Number(valorPrevio) - nuevoValor) < 0.0001) return;
        const result = await upsertResultado(
          { kpiId, anio, mes, tipo: "real", valor: nuevoValor },
          { actor: currentUser, previousValor: valorPrevio }
        );
        if (!result?.ok) console.error(`Error al sincronizar el KPI de avance del SIG (${proceso}):`, result?.error);
      })
    );
  }

  useEffect(() => {
    async function initSigKpiSync() {
      const [nextStatus, kpiIds] = await Promise.all([loadEstados(), loadSigKpiIds()]);
      syncSigKpi(nextStatus, kpiIds);
    }
    initSigKpiSync();
    loadPeople();
    if (currentUser?.persona_id) esAuditadoDeAlguna(currentUser.persona_id).then(setEsAuditado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si quien entra es líder de alguno de los 16 procesos del mapa (según
  // processLeaders), el filtro arranca ya puesto en ese proceso en vez de
  // "Todos" — no bloquea el selector, solo ahorra el primer clic.
  useEffect(() => {
    const fullName = currentUser?.persona_nombre || currentUser?.nombre || "";
    const firstName = fullName.trim().split(/\s+/).pop()?.toLowerCase();
    if (!firstName) return;
    const ownProcess = mapProcesses.find((process) => {
      const leader = processLeaders[process];
      if (!leader) return false;
      return leader.person.split(/\s*\/\s*/).some((name) => name.trim().toLowerCase() === firstName);
    });
    if (ownProcess) setSelectedProcess(ownProcess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.persona_nombre, currentUser?.nombre]);

  useEffect(() => {
    if (selectedProcess === "Todos") { setLastCheck(null); return; }
    getChecks(selectedProcess).then((rows) => setLastCheck(rows[0] || null));
  }, [selectedProcess]);

  async function loadPlan() {
    setPlanLoading(true);
    const data = await getPlanMacroprocesos();
    setPlanMacroprocesos(data);
    setPlanLoading(false);
  }

  // Carga perezosa: solo la primera vez que se entra a la pestaña, no en
  // cada render del módulo.
  useEffect(() => {
    if (view === "plan" && planMacroprocesos === null) loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function loadCambios() {
    setCambiosLoading(true);
    const data = await getCambios();
    setCambios(data);
    setCambiosLoading(false);
  }

  useEffect(() => {
    if (view === "cambios" && cambios === null) loadCambios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function loadAuditorias() {
    setAuditoriasLoading(true);
    const data = await getAuditorias();
    setAuditorias(data);
    setAuditoriasLoading(false);
  }

  // Mismo criterio ya usado para Minutas: solo personas reales y activas
  // (tipo='persona'), no los renglones placeholder de personas (CLIENTE,
  // EXTERNO, etc.) que también viven en la tabla `personas`.
  async function loadAuditoriaPersonaOptions() {
    const { data, error } = await supabase
      .from("personas")
      .select("id,nombre")
      .eq("tipo", "persona")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    if (error) { console.error("Error al cargar personas para auditorías:", error); return; }
    setAuditoriaPersonaOptions(data || []);
  }

  // Una auditoría puede tener varios hallazgos y cada uno su propia Acción
  // Correctiva — se agrupan por origen_id igual que ya hace Control de
  // Cambios con una sola acción, aquí puede haber varias por auditoría.
  async function loadAuditoriaAcciones() {
    const todas = await getAcciones();
    const agrupadas = {};
    (todas || []).forEach((accion) => {
      if (accion.origen_tabla !== "sig_auditorias" || !accion.origen_id) return;
      if (!agrupadas[accion.origen_id]) agrupadas[accion.origen_id] = [];
      agrupadas[accion.origen_id].push(accion);
    });
    setAccionesPorAuditoria(agrupadas);
  }

  async function loadProgramas() {
    setProgramasLoading(true);
    const data = await getProgramas();
    setProgramas(data);
    setProgramasLoading(false);
  }

  useEffect(() => {
    if (view === "auditorias" && auditorias === null) {
      loadAuditorias();
      loadAuditoriaPersonaOptions();
      loadAuditoriaAcciones();
      loadProgramas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Sin `existing` abre el formulario de alta de un programa nuevo; con
  // `existing` prellena el formulario para editar esa fila del histórico.
  function openProgramaEditor(existing) {
    setProgramaDraft(
      existing
        ? {
            nombre: existing.nombre || "",
            objetivos: existing.objetivos || "",
            alcance: existing.alcance || "",
            riesgosOportunidades: existing.riesgos_oportunidades || "",
            recursosRoles: existing.recursos_roles || "",
            criteriosGenerales: existing.criterios_generales || "",
            enfoqueMetodologico: existing.enfoque_metodologico || "",
            documentosReferencia: existing.documentos_referencia || "",
          }
        : PROGRAMA_CAMPOS_VACIOS
    );
    setProgramaMessage("");
    setProgramaExpandedId(existing ? existing.id : "new");
    setProgramaEditing(true);
  }

  async function handleGuardarPrograma() {
    if (!programaDraft.nombre.trim()) { setProgramaMessage("El programa necesita un nombre."); return; }
    const editingId = typeof programaExpandedId === "number" ? programaExpandedId : null;
    const result = editingId
      ? await updatePrograma(editingId, {
          nombre: programaDraft.nombre,
          objetivos: programaDraft.objetivos || null,
          alcance: programaDraft.alcance || null,
          riesgos_oportunidades: programaDraft.riesgosOportunidades || null,
          recursos_roles: programaDraft.recursosRoles || null,
          criterios_generales: programaDraft.criteriosGenerales || null,
          enfoque_metodologico: programaDraft.enfoqueMetodologico || null,
          documentos_referencia: programaDraft.documentosReferencia || null,
        }, currentUser)
      : await createPrograma(programaDraft, currentUser);
    if (!result.ok) { console.error(result.error); setProgramaMessage("No fue posible guardar el programa."); return; }
    setProgramas((current) => {
      const list = current || [];
      return editingId ? list.map((p) => (p.id === result.data.id ? result.data : p)) : [result.data, ...list];
    });
    setProgramaExpandedId(result.data.id);
    setProgramaEditing(false);
  }

  async function handleAprobarPrograma(id) {
    const result = await aprobarPrograma(id, currentUser);
    if (!result.ok) { console.error(result.error); setProgramaMessage("No fue posible registrar el visto bueno."); return; }
    setProgramas((current) => (current || []).map((p) => (p.id === id ? result.data : p)));
  }

  async function handleFirmarProgramaCoordinador(id) {
    const result = await firmarProgramaComoCoordinador(id, currentUser);
    if (!result.ok) { console.error(result.error); setProgramaMessage(typeof result.error === "string" ? result.error : "No fue posible registrar la firma."); return; }
    setProgramas((current) => (current || []).map((p) => (p.id === id ? result.data : p)));
  }

  async function handleFirmarProgramaPM(id) {
    const result = await firmarProgramaComoPM(id, currentUser);
    if (!result.ok) { console.error(result.error); setProgramaMessage(typeof result.error === "string" ? result.error : "No fue posible registrar la firma."); return; }
    setProgramas((current) => (current || []).map((p) => (p.id === id ? result.data : p)));
  }

  function handleDescargarProgramaPdf(p) {
    if (p) downloadProgramaPdf(p);
  }

  // Formulario de alta/edición — mismo JSX para "+ Nuevo programa" (crea)
  // y "Editar" sobre una fila existente (actualiza); el destino real lo
  // decide handleGuardarPrograma() a partir de programaExpandedId.
  function renderProgramaEditForm() {
    return (
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nombre del programa
          <input type="text" value={programaDraft.nombre} onChange={(e) => setProgramaDraft((d) => ({ ...d, nombre: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          {[
            ["objetivos", "Objetivos del programa"],
            ["alcance", "Alcance del programa"],
            ["riesgosOportunidades", "Riesgos y oportunidades"],
            ["recursosRoles", "Recursos y roles"],
            ["criteriosGenerales", "Criterios generales"],
            ["enfoqueMetodologico", "Enfoque metodológico"],
            ["documentosReferencia", "Documentos de referencia"],
          ].map(([field, label]) => (
            <label key={field} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {label}
              <textarea rows={3} value={programaDraft[field]} onChange={(e) => setProgramaDraft((d) => ({ ...d, [field]: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none" />
            </label>
          ))}
        </div>
        {programaMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{programaMessage}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleGuardarPrograma} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Guardar programa</button>
          <button type="button" onClick={() => { setProgramaEditing(false); if (programaExpandedId === "new") setProgramaExpandedId(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
        </div>
      </div>
    );
  }

  // Vista de solo lectura de un programa — tarjetas de color por campo,
  // escala 0/3/5/10 y las dos firmas (Coordinador SIG / Director General).
  function renderProgramaReadView(p) {
    return (
      <div className="space-y-2 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Detalle del programa</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {canEdit && <button type="button" onClick={() => openProgramaEditor(p)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 hover:border-slate-300">Editar</button>}
            <button type="button" onClick={() => handleDescargarProgramaPdf(p)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 hover:border-slate-300">↓ PDF</button>
          </div>
        </div>
        <div className="grid gap-2.5 text-[11px] font-medium text-slate-600 md:grid-cols-2">
          {[
            ["Objetivos", p.objetivos, "🎯", "border-sky-100 bg-sky-50/70 text-sky-700"],
            ["Alcance", p.alcance, "🗺️", "border-indigo-100 bg-indigo-50/70 text-indigo-700"],
            ["Riesgos y oportunidades", p.riesgos_oportunidades, "⚠️", "border-amber-100 bg-amber-50/70 text-amber-700"],
            ["Recursos y roles", p.recursos_roles, "👥", "border-violet-100 bg-violet-50/70 text-violet-700"],
            ["Criterios generales", p.criterios_generales, "📐", "border-emerald-100 bg-emerald-50/70 text-emerald-700"],
            ["Enfoque metodológico", p.enfoque_metodologico, "🧭", "border-teal-100 bg-teal-50/70 text-teal-700"],
            ["Documentos de referencia", p.documentos_referencia, "📎", "border-fuchsia-100 bg-fuchsia-50/70 text-fuchsia-700"],
          ].filter(([, v]) => v).map(([label, v, icon, tint]) => {
            const bullets = v.includes("\n") ? v.split("\n").filter(Boolean) : null;
            return (
              <div key={label} className={`rounded-2xl border p-3 shadow-sm ${tint}`}>
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                  <span className="text-[13px] leading-none">{icon}</span>
                  {label}
                </div>
                {bullets ? (
                  <ul className="mt-1.5 space-y-1 text-slate-700">
                    {bullets.map((line, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-slate-700">{v}</div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Escala de calificación</div>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[0, 3, 5, 10].map((n) => (
              <div key={n} className={`rounded-xl px-2.5 py-2 text-center shadow-sm ${cellStyle(n)}`}>
                <div className="text-base font-black leading-none">{n}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">{scoreMeaning(n)}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Firmas</div>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {[
              {
                rol: "Coordinador SIG",
                nombre: p.firmado_coordinador_nombre,
                fecha: p.firmado_coordinador_at,
                puedeFirmar: Number(currentUser?.persona_id) === COORDINADOR_SIG_PERSONA_ID,
                onFirmar: () => handleFirmarProgramaCoordinador(p.id),
              },
              {
                rol: "Director General",
                nombre: p.aprobado_por_nombre,
                fecha: p.aprobado_at,
                puedeFirmar: isDirectorGeneral(currentUser),
                onFirmar: () => handleAprobarPrograma(p.id),
              },
              {
                rol: "Project Manager",
                nombre: p.firmado_pm_nombre,
                fecha: p.firmado_pm_at,
                puedeFirmar: Number(currentUser?.persona_id) === PM_PERSONA_ID,
                onFirmar: () => handleFirmarProgramaPM(p.id),
              },
            ].map((f) => (
              <div key={f.rol} className={`rounded-2xl border p-3 ${f.nombre ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.rol}</div>
                  {f.nombre ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">✓ Firmado</span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">Pendiente</span>
                  )}
                </div>
                {f.nombre ? (
                  <div className="mt-1 text-[11px] font-bold text-slate-700">
                    {f.nombre} <span className="font-medium text-slate-400">· {new Date(f.fecha).toLocaleDateString("es-MX")}</span>
                  </div>
                ) : f.puedeFirmar ? (
                  <button type="button" onClick={f.onFirmar} className="mt-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">Firmar</button>
                ) : (
                  <div className="mt-1 text-[11px] font-medium text-slate-400">Sin firmar</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function updateAuditoriaLocal(id, patch) {
    setAuditorias((current) => (current || []).map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function handleCreateAuditoria() {
    if (!auditoriaNewDraft.macroproceso) { setAuditoriasMessage("Selecciona el macroproceso a auditar."); return; }
    setAuditoriasMessage("");
    const result = await createAuditoria({ ...auditoriaNewDraft, programaId: programaVigente?.id || null }, currentUser);
    if (!result.ok) { console.error(result.error); setAuditoriasMessage("No fue posible programar la auditoría."); return; }
    // Se recarga la lista completa (en vez de insertar result.data localmente)
    // porque el equipo auditor recién guardado necesita el join con personas
    // que solo trae getAuditorias().
    await loadAuditorias();
    setAuditoriaNewDraft({ macroproceso: "", fechaProgramada: "", auditorLiderPersonaId: "", equipoPersonaIds: [], reporteUrl: "", notas: "", auditadoPersonaId: "", alcance: "", modalidadLugar: "", criterios: [] });
    setAuditoriaCreating(false);
  }

  function toggleAuditoriaCriterio(numeral, subtitulo, numero) {
    setAuditoriaNewDraft((d) => {
      const existe = d.criterios.some((c) => c.numeral === numeral && c.subtitulo === subtitulo && c.numero === numero);
      return {
        ...d,
        criterios: existe
          ? d.criterios.filter((c) => !(c.numeral === numeral && c.subtitulo === subtitulo && c.numero === numero))
          : [...d.criterios, { numeral, subtitulo, numero }],
      };
    });
  }

  function handleAuditoriaFichaUpdated(updated) {
    updateAuditoriaLocal(updated.id, updated);
  }

  async function handleEnviarFirma(auditoria) {
    if (!auditoria.auditado_persona_id || enviandoFirmaId) return;
    setEnviandoFirmaId(auditoria.id);
    const result = await enviarFichaParaFirma(auditoria.id, currentUser);
    setEnviandoFirmaId(null);
    if (!result.ok) { console.error(result.error); alert("No fue posible enviar el aviso de firma."); return; }
    updateAuditoriaLocal(auditoria.id, result.data);
  }

  async function handleCycleAuditoriaEstado(auditoria) {
    const idx = ESTADOS_AUDITORIA.indexOf(auditoria.estado);
    const next = ESTADOS_AUDITORIA[(idx + 1) % ESTADOS_AUDITORIA.length];
    updateAuditoriaLocal(auditoria.id, { estado: next });
    const result = await updateAuditoria(auditoria.id, { estado: next });
    if (!result.ok) { console.error(result.error); updateAuditoriaLocal(auditoria.id, { estado: auditoria.estado }); }
  }

  async function handleSaveAuditoriaField(auditoria, field, value) {
    updateAuditoriaLocal(auditoria.id, { [field]: value });
    const result = await updateAuditoria(auditoria.id, { [field]: value });
    if (!result.ok) console.error(result.error);
  }

  async function handleDeleteAuditoria(id) {
    if (!window.confirm("¿Eliminar esta auditoría programada?")) return;
    const result = await deleteAuditoria(id);
    if (!result.ok) { console.error(result.error); alert("No fue posible eliminar la auditoría."); return; }
    setAuditorias((current) => (current || []).filter((a) => a.id !== id));
  }

  function openAuditoriaAccionForm(auditoria) {
    setAuditoriaAccionFormId((current) => (current === auditoria.id ? null : auditoria.id));
    setAuditoriaAccionDraft({ titulo: `Hallazgo de auditoría — ${auditoria.macroproceso}`, descripcion: "", responsablePersonaId: "", prioridad: "Alta" });
  }

  // Una auditoría puede tener 1 o varios hallazgos, así que este formulario
  // se puede volver a abrir y enviar tantas veces como haga falta sobre la
  // misma auditoría — no se oculta ni se deshabilita después de la primera.
  async function handleCrearAccionAuditoria(auditoria) {
    if (!auditoriaAccionDraft.titulo.trim()) { setAuditoriasMessage("Describe el hallazgo antes de crear la acción."); return; }
    const result = await createAccionDesdeHallazgo(auditoria, auditoriaAccionDraft, currentUser);
    if (!result?.ok) { console.error(result?.error); setAuditoriasMessage("No fue posible crear la acción."); return; }
    setAccionesPorAuditoria((current) => ({ ...current, [auditoria.id]: [...(current[auditoria.id] || []), result.data] }));
    setAuditoriaAccionFormId(null);
    setAuditoriasMessage(`Acción ${result.data.codigo} creada en el Acciones de Mejora.`);
  }

  // Mismo mecanismo que handleConvertToAssignment en
  // src/modules/strategic-followup/StrategicFollowupModule.jsx — aparta el
  // tiempo de la auditoría como una asignación real en Balance de Carga.
  async function handleConvertAuditoriaToAssignment(auditoria, payload) {
    const result = await createWorkloadAssignment({
      persona_id: payload.personaId,
      responsable: payload.personaNombre,
      rol: "Coordinación SIG",
      tipo: "Proyecto",
      prioridad: payload.prioridad || "Alta",
      gestion: "Otro",
      titulo: `Auditoría interna — ${auditoria.macroproceso}`,
      descripcion: auditoria.notas || "",
      revisara: "",
      aprobara: "",
      seguimiento: "",
      carga_horas: payload.horas,
      fecha_limite: payload.fechaLimite || auditoria.fecha_programada || null,
      estado: "Pendiente",
      asigna: currentUser?.nombre || currentUser?.usuario || "",
      asigna_rol: "Coordinación SIG",
      horas_totales: payload.horas,
      origen_estrategico: "Auditoría",
    });
    if (!result.ok) { console.error(result.error); alert("No fue posible crear la asignación."); return false; }
    const upd = await updateAuditoria(auditoria.id, { asignacion_id: result.data?.id || null });
    if (upd.ok) updateAuditoriaLocal(auditoria.id, { asignacion_id: upd.data.asignacion_id });
    alert("Asignación creada en Balance de Carga.");
    return true;
  }

  async function handleCreateCambio() {
    if (!cambioNewDraft.titulo.trim()) { setCambiosMessage("El motivo del cambio no puede quedar vacío."); return; }
    const result = await createCambio(
      { titulo: cambioNewDraft.titulo.trim(), descripcion: cambioNewDraft.descripcion, procesoImpactado: cambioNewDraft.procesoImpactado, beneficiosEsperados: cambioNewDraft.beneficiosEsperados, riesgos: cambioNewDraft.riesgos },
      currentUser
    );
    if (!result.ok) { console.error(result.error); setCambiosMessage("No fue posible crear la solicitud."); return; }
    setCambios((current) => [result.data, ...(current || [])]);
    setCambioCreating(false);
    setCambioNewDraft({ titulo: "", descripcion: "", procesoImpactado: "", beneficiosEsperados: "", riesgos: "" });
  }

  function applyCambioUpdate(result) {
    if (!result.ok) { console.error(result.error); setCambiosMessage("No fue posible guardar el cambio."); return null; }
    setCambios((current) => (current || []).map((item) => (item.id === result.data.id ? result.data : item)));
    setSelectedCambio(result.data);
    return result.data;
  }

  async function handleSaveSolicitud(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, {
      descripcion: draft.descripcion, proceso_impactado: draft.proceso_impactado || null,
      beneficios_esperados: draft.beneficios_esperados, riesgos: draft.riesgos,
    }, { actor: currentUser, previous: cambio }));
  }

  async function handleIniciarEvaluacion(cambio) {
    applyCambioUpdate(await updateCambio(cambio.id, { estado: "En evaluación" }, { actor: currentUser, previous: cambio }));
  }

  async function handleGuardarEvaluacion(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, { ...draft }, { actor: currentUser, previous: cambio }));
  }

  async function handleEnviarAprobacion(cambio, draft) {
    const evaluado = await updateCambio(cambio.id, {
      ...draft, evaluado_por_persona_id: currentUser?.persona_id || null, evaluado_por_nombre: currentUser?.nombre || currentUser?.usuario || null, evaluado_at: new Date().toISOString(),
    }, { actor: currentUser, previous: cambio });
    if (!evaluado.ok) { console.error(evaluado.error); setCambiosMessage("No fue posible guardar la evaluación."); return; }
    const result = await sendToDecisionCenter(evaluado.data, currentUser);
    applyCambioUpdate(result);
    if (result.ok) setCambiosMessage("Solicitud enviada a la Bandeja de Centro de Decisiones.");
  }

  async function handleAprobarCambio(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, {
      estado: "Aprobado",
      responsable_implementacion_persona_id: draft.responsable_implementacion_persona_id ? Number(draft.responsable_implementacion_persona_id) : null,
      plazo_implementacion: draft.plazo_implementacion || null,
      recursos_asignados: draft.recursos_asignados || null,
      aprobado_por_nombre: currentUser?.nombre || currentUser?.usuario || null,
      aprobado_at: new Date().toISOString(),
    }, { actor: currentUser, previous: cambio }));
  }

  async function handleRechazarCambio(cambio, justificacion) {
    applyCambioUpdate(await updateCambio(cambio.id, {
      estado: "Rechazado", rechazo_justificacion: justificacion || null,
      aprobado_por_nombre: currentUser?.nombre || currentUser?.usuario || null, aprobado_at: new Date().toISOString(),
    }, { actor: currentUser, previous: cambio }));
  }

  async function handleGuardarImplementacion(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, {
      ...draft, estado: cambio.estado === "Aprobado" ? "En implementación" : cambio.estado,
    }, { actor: currentUser, previous: cambio }));
  }

  async function handlePasarASeguimiento(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, { ...draft, estado: "En seguimiento" }, { actor: currentUser, previous: cambio }));
  }

  async function handleCerrarSeguimiento(cambio, draft) {
    applyCambioUpdate(await updateCambio(cambio.id, {
      indicadores_verificacion: draft.indicadores_verificacion,
      decision_seguimiento: draft.decision_seguimiento || null,
      eficaz: draft.eficaz,
      estado: draft.eficaz ? "Cerrado - Eficaz" : "Cerrado - No eficaz",
    }, { actor: currentUser, previous: cambio }));
  }

  async function handleGenerarAccionCorrectiva(cambio) {
    const result = await createAccionCorrectivaPorCambio(cambio, currentUser);
    if (!result.ok) { console.error(result.error); setCambiosMessage("No fue posible generar la acción correctiva."); return; }
    setCambios((current) => (current || []).map((item) => (item.id === cambio.id ? { ...item, accion_correctiva_id: result.data.id } : item)));
    setSelectedCambio((current) => (current ? { ...current, accion_correctiva_id: result.data.id } : current));
    alert(`Acción correctiva ${result.data.codigo} creada en el Acciones de Mejora.`);
  }

  async function openCambiosHistorial() {
    setCambiosHistorialOpen(true);
    setCambiosHistorialLoading(true);
    const entries = await getCambiosHistorial();
    const tituloPorId = new Map((cambios || []).map((c) => [c.id, c.titulo]));
    setCambiosHistorialEntries(entries.map((h) => ({
      key: `cambio-hist-${h.id}`,
      type: "score",
      title: `${h.campo}: ${h.valor_anterior ?? "—"} → ${h.valor_nuevo ?? "—"}`,
      detail: tituloPorId.get(h.cambio_id) || "Cambio",
      date: h.created_at,
      nombre: h.nombre,
    })));
    setCambiosHistorialLoading(false);
  }

  const planStats = useMemo(() => {
    const all = (planMacroprocesos || []).flatMap((mp) => mp.pendientes);
    return {
      total: all.length,
      completados: all.filter((p) => p.estado === "Completado").length,
      enProgreso: all.filter((p) => p.estado === "En progreso").length,
      pendientes: all.filter((p) => p.estado === "Pendiente").length,
    };
  }, [planMacroprocesos]);

  const global = useMemo(() => globalAverageWithOverrides(sigSections, statusOverrides), [statusOverrides]);
  // La barra refleja el proceso filtrado (o el global si es "Todos"); la
  // calificación global de la derecha siempre se queda como el SIG completo.
  const displayedPercent = useMemo(
    () => processAverageWithOverrides(sigSections, selectedProcess, statusOverrides),
    [selectedProcess, statusOverrides]
  );
  const maxGroups = useMemo(() => Math.max(...sigSections.map((section) => section.groups.length)), []);
  const processOptions = useMemo(() => ["Todos", ...mapProcesses], []);

  async function updateStatus(numeral, groupSubtitle, number, proceso, nextScore) {
    if (!canEdit) return;
    const key = stateKey(groupSubtitle, number, proceso);
    const previous = { score: statusOverrides[key], evidencia: evidenceOverrides[key] };
    const score = Number(nextScore);
    const nextStatusOverrides = { ...statusOverrides, [key]: score };
    setStatusOverrides(nextStatusOverrides);
    const result = await upsertEstado(
      { subtitulo: groupSubtitle, numero: number, numeral, proceso, score, evidencia: evidenceOverrides[key] ?? "" },
      { actor: currentUser, previous }
    );
    if (!result.ok) { console.error(result.error); setMessage("No fue posible guardar el cambio de estado."); return; }
    syncSigKpi(nextStatusOverrides);
  }

  async function updateEvidence(numeral, groupSubtitle, number, proceso, value) {
    if (!canEdit) return;
    const key = stateKey(groupSubtitle, number, proceso);
    setEvidenceOverrides((current) => ({ ...current, [key]: value }));
  }

  async function commitEvidence(numeral, groupSubtitle, number, proceso) {
    if (!canEdit) return;
    const key = stateKey(groupSubtitle, number, proceso);
    const nextEvidencia = evidenceOverrides[key] ?? "";
    const previousEvidencia = savedEvidenceRef.current[key] ?? "";
    if (previousEvidencia === nextEvidencia) return; // sin cambios reales, no re-guarda ni registra historial
    const result = await upsertEstado(
      { subtitulo: groupSubtitle, numero: number, numeral, proceso, score: statusOverrides[key], evidencia: nextEvidencia },
      { actor: currentUser, previous: { score: statusOverrides[key], evidencia: previousEvidencia } }
    );
    if (!result.ok) { console.error(result.error); setMessage("No fue posible guardar la evidencia."); return; }
    savedEvidenceRef.current = { ...savedEvidenceRef.current, [key]: nextEvidencia };
  }

  async function handleMarcarRevisado() {
    if (!canEdit || selectedProcess === "Todos") return;
    setCheckingProcess(true);
    const result = await createCheck(selectedProcess, currentUser);
    setCheckingProcess(false);
    if (!result.ok) { console.error(result.error); setMessage("No fue posible registrar el check."); return; }
    setLastCheck(result.data);
  }

  async function openHistorial() {
    setHistorialOpen(true);
    setHistorialLoading(true);
    const [historial, checks] = await Promise.all([
      getHistorial(),
      selectedProcess === "Todos" ? Promise.resolve([]) : getChecks(selectedProcess),
    ]);
    const relevantHistorial = selectedProcess === "Todos"
      ? historial
      : historial.filter((entry) => {
        const group = sigSections.flatMap((s) => s.groups).find((g) => g.subtitle === entry.subtitulo);
        const row = group?.rows.find((r) => r[0] === entry.numero);
        return row ? processApplies(row[3], selectedProcess) : false;
      });
    const merged = [
      ...checks.map((c) => ({
        key: `check-${c.id}`,
        type: "check",
        title: "Proceso marcado como revisado",
        detail: c.proceso,
        date: c.checked_at,
        nombre: c.checked_by_nombre,
      })),
      ...relevantHistorial.map((h) => ({
        key: `hist-${h.id}`,
        type: "score",
        title: h.campo === "score" ? `Estado actualizado: ${h.valor_anterior ?? "—"} → ${h.valor_nuevo ?? "—"}` : "Evidencia actualizada",
        detail: cleanSubtitle(h.subtitulo),
        date: h.created_at,
        nombre: h.nombre,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    setHistorialEntries(merged);
    setHistorialLoading(false);
  }

  function getDefaultLeaderPersonaId(section) {
    const leader = processLeaders[selectedProcess] || { role: "Por asignar", person: "" };
    const persona = findPersonaByFirstName(people, leader.person);
    return persona?.id || "";
  }

  async function handleCrearAsignacion(section, payload) {
    if (!canEdit || selectedProcess === "Todos") return false;
    const dynamic = getDynamicAction(section, selectedProcess, statusOverrides);
    const result = await createWorkloadAssignment({
      persona_id: payload.personaId,
      responsable: payload.personaNombre,
      rol: payload.rol,
      tipo: "Mejora",
      prioridad: payload.prioridad,
      gestion: "SIG",
      titulo: payload.titulo,
      descripcion: `${dynamic.action}. Avance actual del proceso en este numeral: ${dynamic.processAverage === null ? "sin evaluar" : `${dynamic.processAverage}0%`}.`,
      revisara: "", aprobara: "", seguimiento: "",
      carga_horas: payload.horas,
      fecha_limite: payload.fechaLimite,
      estado: "Pendiente",
      asigna: currentUser?.nombre || currentUser?.usuario || "",
      asigna_rol: "Coordinador SIG",
      horas_totales: payload.horas,
      origen_estrategico: "SIG",
    });

    if (!result.ok) { console.error(result.error); alert("No fue posible crear la asignación."); return false; }
    alert(`Asignación creada para ${payload.personaNombre} en Balance de Carga.`);
    return true;
  }

  async function handleUpdateEstadoPendiente(pendiente) {
    if (!canEdit) return;
    const next = nextPlanEstado(pendiente.estado);
    const result = await updatePendienteEstado(pendiente.id, next, { actor: currentUser, previousEstado: pendiente.estado });
    if (!result.ok) { console.error(result.error); setMessage("No fue posible actualizar el estado del pendiente."); return; }
    setPlanMacroprocesos((current) => (current || []).map((mp) => ({
      ...mp,
      pendientes: mp.pendientes.map((p) => (p.id === pendiente.id ? { ...p, estado: next } : p)),
    })));
  }

  function getPlanLeaderPersonaId(macroproceso) {
    const firstLeader = (macroproceso.lider || "").split(/\s*\/\s*/)[0].split(/\s*\(/)[0].trim();
    const persona = findPersonaByFirstName(people, firstLeader);
    return persona?.id || "";
  }

  async function handleCrearAsignacionPlan(macroproceso, pendiente, payload) {
    if (!canEdit) return false;
    const result = await createWorkloadAssignment({
      persona_id: payload.personaId,
      responsable: payload.personaNombre,
      rol: payload.rol,
      tipo: "Mejora",
      prioridad: payload.prioridad,
      gestion: "SIG",
      titulo: payload.titulo,
      descripcion: `Plan de implementación SIG — ${macroproceso.nombre}: ${pendiente.titulo}`,
      revisara: "", aprobara: "", seguimiento: "",
      carga_horas: payload.horas,
      fecha_limite: payload.fechaLimite,
      estado: "Pendiente",
      asigna: currentUser?.nombre || currentUser?.usuario || "",
      asigna_rol: "Coordinador SIG",
      horas_totales: payload.horas,
      origen_estrategico: "SIG",
    });
    if (!result.ok) { console.error(result.error); alert("No fue posible crear la asignación."); return false; }
    alert(`Asignación creada para ${payload.personaNombre} en Balance de Carga.`);
    return true;
  }

  async function openPlanHistorial() {
    setPlanHistorialOpen(true);
    setPlanHistorialLoading(true);
    const historial = await getPlanHistorial();
    const pendienteLabels = new Map();
    (planMacroprocesos || []).forEach((mp) => mp.pendientes.forEach((p) => pendienteLabels.set(p.id, `${mp.nombre}${mp.letra || ""} — ${p.titulo}`)));
    const entries = historial.map((h) => ({
      key: `plan-hist-${h.id}`,
      type: "score",
      title: `Estado actualizado: ${h.valor_anterior ?? "—"} → ${h.valor_nuevo ?? "—"}`,
      detail: pendienteLabels.get(h.pendiente_id) || "Pendiente del plan",
      date: h.created_at,
      nombre: h.nombre,
    }));
    setPlanHistorialEntries(entries);
    setPlanHistorialLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] p-5 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado global del Sistema Integrado de Gestión</div>
            <span className={`hidden rounded-xl border px-3 py-1 text-xs font-black md:inline-flex ${statusBg(global)}`}>{implementationStatus(global)}</span>
          </div>

          <div className="grid grid-cols-[4fr_1fr] items-center gap-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500">
                <span>{selectedProcess === "Todos" ? "Progreso global SIG" : `Progreso — ${selectedProcess}`}</span>
                <span />
              </div>
              <div className="relative h-4 w-full overflow-visible rounded-full bg-slate-200/70 shadow-inner ring-1 ring-slate-200">
                <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0.08))]" />
                <div className="absolute inset-y-0 left-1/4 w-px bg-white/80" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
                <div className="absolute inset-y-0 left-3/4 w-px bg-white/80" />
                <div className={`relative h-full rounded-full transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_rgba(15,23,42,0.14)] ${displayedPercent >= 80 ? "bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400" : displayedPercent >= 50 ? "bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400" : displayedPercent > 0 ? "bg-gradient-to-r from-red-800 via-red-600 to-red-500" : "bg-gradient-to-r from-slate-600 to-slate-400"}`} style={{ width: `${displayedPercent}%` }}>
                  <div className="absolute inset-0 rounded-full bg-[linear-gradient(110deg,rgba(255,255,255,0.38),rgba(255,255,255,0.05)_45%,rgba(0,0,0,0.08))]" />
                </div>
                <div className="absolute -top-6 -translate-x-1/2 rounded-md border border-white/40 bg-white/80 px-2 py-[1px] text-[9px] font-bold text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.10)] backdrop-blur-sm" style={{ left: `${displayedPercent}%` }}>{displayedPercent}%</div>
                <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/80 shadow-[0_2px_8px_rgba(15,23,42,0.18)] backdrop-blur-sm ring-2 ring-slate-300/40" style={{ left: `${displayedPercent}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] font-semibold text-slate-400">
                <span>Bajo</span><span>Medio</span><span>Alto</span>
              </div>
            </div>

            <div className="flex h-[68px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-center">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Calificación global</div>
              <div className={`mt-1 text-3xl font-black leading-none ${statusTextColor(global)}`}>{global}%</div>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

        <section className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[10px] font-black uppercase tracking-wide">
            <button type="button" onClick={() => setView("diagnostico")} className={`rounded-md px-3 py-1.5 transition ${view === "diagnostico" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Diagnóstico HLS</button>
            <button type="button" onClick={() => setView("plan")} className={`rounded-md px-3 py-1.5 transition ${view === "plan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Plan de implementación</button>
            <button type="button" onClick={() => setView("cambios")} className={`rounded-md px-3 py-1.5 transition ${view === "cambios" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Control de cambios</button>
            {puedeVerAuditorias && (
              <button type="button" onClick={() => setView("auditorias")} className={`rounded-md px-3 py-1.5 transition ${view === "auditorias" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Programa de auditorías</button>
            )}
          </div>
          {view === "plan" && (
            <button type="button" onClick={openPlanHistorial} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-slate-700">⏱ Historial del plan</button>
          )}
          {view === "cambios" && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={openCambiosHistorial} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-slate-700">⏱ Historial</button>
              <button type="button" onClick={() => setCambioCreating((current) => !current)} className="rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-3 py-1.5 text-[10px] font-black text-sky-700 transition hover:border-sky-400 hover:bg-sky-100">+ Nueva solicitud</button>
            </div>
          )}
          {view === "auditorias" && canEditPlanes && auditoriasSubTab === "planes" && (
            <button type="button" onClick={() => setAuditoriaCreating((current) => !current)} className="rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-3 py-1.5 text-[10px] font-black text-sky-700 transition hover:border-sky-400 hover:bg-sky-100">+ Nueva auditoría</button>
          )}
          {view === "auditorias" && canEdit && auditoriasSubTab === "programas" && (
            <button type="button" onClick={() => openProgramaEditor()} className="rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-3 py-1.5 text-[10px] font-black text-sky-700 transition hover:border-sky-400 hover:bg-sky-100">+ Nuevo programa</button>
          )}
        </section>

        {view === "diagnostico" && (
        <>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Filtro por proceso</div>
            <select aria-label="Filtro por proceso" value={selectedProcess} onChange={(event) => setSelectedProcess(event.target.value)} className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400">
              {processOptions.map((process) => <option key={process} value={process}>{process}</option>)}
            </select>

            {selectedProcess !== "Todos" && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                {lastCheck && (
                  <span className="text-[9px] font-bold text-slate-400" title={formatDateTime(lastCheck.checked_at)}>
                    Última revisión: {lastCheck.checked_by_nombre || "—"} · {formatDateTime(lastCheck.checked_at)}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleMarcarRevisado}
                    disabled={checkingProcess}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    ✓ Marcar revisado
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={openHistorial}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              ⏱ Línea de tiempo
            </button>

            <div className="ml-auto shrink-0">
              {!canEdit && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">Modo solo lectura</span>}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#111827] px-5 py-3 text-white">
            <div>
              <div className="text-sm font-black uppercase tracking-wide">Mapa de diagnóstico - cumplimiento de HLS</div>
              <div className="text-xs font-semibold text-slate-300">Selecciona una celda para ver detalle.</div>
            </div>
            <div className="hidden flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[8px] font-bold uppercase tracking-wide lg:flex">
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded bg-emerald-300" /> Estandarizado</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded bg-yellow-200" /> Implementado</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded bg-amber-300" /> En desarrollo</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded bg-rose-300" /> No implementado</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded bg-slate-300" /> Sin evaluar</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="w-[4%] px-2 py-2 text-left font-black">N°</th>
                  <th className="w-[15%] px-2 py-2 text-left font-black">Numeral</th>
                  <th className="w-[6%] px-2 py-2 text-center font-black">%</th>
                  {Array.from({ length: maxGroups }).map((_, index) => <th key={`group-head-${index}`} className="px-1 py-2 text-center font-black">Sub {index + 1}</th>)}
                  <th className="w-[10%] px-2 py-2 text-center font-black">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sigSections.map((section) => {
                  const dynamic = getDynamicAction(section, selectedProcess, statusOverrides);
                  const sectionPercent = sectionAverageWithOverrides(section, statusOverrides, selectedProcess);
                  const isConverting = convertingSection === section.numeral;
                  return (
                    <React.Fragment key={section.numeral}>
                    <tr className="h-[58px] border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1 align-middle font-black text-slate-500">{section.numeral}</td>
                      <td className="px-2 py-1 align-middle"><div className="cursor-help text-[11px] font-black leading-tight text-slate-900" title={section.summary}>{section.title}</div></td>
                      <td className="px-2 py-1 text-center align-middle">
                        <div className={`flex items-center justify-center gap-1 text-sm font-black ${sectionPercent === null ? "text-slate-400" : statusTextColor(sectionPercent)}`}>
                          <span>{sectionPercent === null ? "Sin evaluar" : `${sectionPercent}%`}</span>
                          {getSectionDelta(section, statusOverrides, selectedProcess) !== null && getSectionDelta(section, statusOverrides, selectedProcess) !== 0 && (
                            <span
                              className={`text-[9px] font-black tracking-tight opacity-70 ${
                                getSectionDelta(section, statusOverrides, selectedProcess) > 0
                                  ? "text-emerald-600"
                                  : "text-rose-500"
                              }`}
                            >
                              {getSectionDelta(section, statusOverrides, selectedProcess) > 0 ? "↑" : "↓"}
                              {Math.abs(getSectionDelta(section, statusOverrides, selectedProcess))}
                            </span>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: maxGroups }).map((_, index) => {
                        const group = section.groups[index];
                        if (!group) return <td key={`${section.numeral}-empty-${index}`} className="px-2 py-2 text-center align-middle"><div className="mx-auto h-7 w-7 rounded-lg bg-slate-50" /></td>;
                        const avg = groupAverageWithOverrides(group, statusOverrides, selectedProcess);
                        const filteredGroupRows = selectedProcess === "Todos" ? group.rows : group.rows.filter((row) => processApplies(row[3], selectedProcess));
                        const appliesToSelectedProcess = selectedProcess === "Todos" || filteredGroupRows.length > 0;
                        const criticalRows = filteredGroupRows.filter((row) => row[4] <= 3).length;
                        return (
                          <td key={`${section.numeral}-${group.subtitle}`} className="px-1 py-1 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <button type="button" onClick={() => setSelectedCell({ section, group, avg, criticalRows, selectedProcess, filteredRows: filteredGroupRows })} className={`mx-auto flex h-8 w-full max-w-[92px] items-center justify-center rounded-xl text-xs font-black transition hover:scale-[1.03] ${cellStyle(avg === null ? null : avg / 10)} ${appliesToSelectedProcess ? "shadow-sm" : "opacity-25 grayscale"}`} title={cleanSubtitle(group.subtitle)}>
                                <span>{group.subtitle.split(" ")[0]}</span>
                              </button>
                              <span className="line-clamp-1 max-w-[96px] text-[7px] font-medium leading-tight text-slate-400">{cleanSubtitle(group.subtitle)}</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`inline-flex rounded-lg px-2 py-[3px] text-[8px] leading-tight font-black ${statusBg(dynamic.processAverage * 10)}`}>{dynamic.action}</span>
                          {canEdit && selectedProcess !== "Todos" && (
                            <button
                              type="button"
                              onClick={() => setConvertingSection((current) => (current === section.numeral ? null : section.numeral))}
                              title={`Enviar a Asignaciones · ${responsibleLabel(selectedProcess).person}`}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${isConverting ? "bg-sky-100 text-sky-600" : "text-slate-300 hover:bg-sky-50 hover:text-sky-600"}`}
                            >
                              ▸
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isConverting && (
                      <SigAsignacionForm
                        colSpan={3 + maxGroups + 1}
                        personasCatalogo={people}
                        defaultPersonaId={getDefaultLeaderPersonaId(section)}
                        defaultRol={responsibleLabel(selectedProcess).role}
                        defaultTitulo={`SIG ${section.numeral}. ${section.title} — ${selectedProcess}`}
                        onCancel={() => setConvertingSection(null)}
                        onConfirm={(payload) => handleCrearAsignacion(section, payload)}
                      />
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          {(() => {
            const insights = getProcessInsights(selectedProcess, statusOverrides);
            return (
              <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:justify-between">
                <div className="flex-1 rounded-2xl border border-slate-300 bg-slate-100/70 px-4 py-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Fortaleza principal</div><div className="mt-1 text-sm leading-relaxed text-slate-700">{insights.strength}</div></div>
                <div className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Brecha principal</div><div className="mt-1 text-sm leading-relaxed text-slate-700">{insights.weakness}</div></div>
                <div className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Acción sugerida</div><div className="mt-1 text-sm leading-relaxed text-slate-100">{insights.recommendation}</div></div>
              </div>
            );
          })()}
          {(() => {
            const { notEvaluatedCount } = getProcessInsights(selectedProcess, statusOverrides);
            if (!notEvaluatedCount) return null;
            return (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-500">
                {notEvaluatedCount} {notEvaluatedCount === 1 ? "criterio nunca se ha evaluado" : "criterios nunca se han evaluado"} para este proceso — no cuentan en el % de arriba, quedan pendientes de auditar.
              </div>
            );
          })()}
        </section>

        {selectedCell ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[6px]">
            <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/40 bg-white/95 shadow-[0_25px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-6 py-5 text-white">
                <div><div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Detalle del criterio</div><div className="mt-1 text-2xl font-black tracking-tight">{selectedCell.section.numeral}. {selectedCell.section.title}</div></div>
                <button type="button" onClick={() => setSelectedCell(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-slate-200 transition hover:bg-white/15 hover:text-white">×</button>
              </div>
              <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
                <div className="grid grid-cols-[1fr_auto] gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-black tracking-tight text-slate-900">{selectedCell.group.subtitle}</div>
                    <div className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{subnumeralDescriptions[selectedCell.group.subtitle]}</div>
                    <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Promedio del criterio: {groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess) === null ? "Sin evaluar" : `${groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess)}%`} • {selectedCell.group.rows.filter((row) => { const s = getRowScore(statusOverrides, selectedCell.group, row, selectedCell.selectedProcess); return s !== null && s <= 3; }).length} puntos críticos</div>
                  </div>
                  <span className={`rounded-2xl px-5 py-3 text-2xl font-black shadow-sm ${statusBg(groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess) ?? 0)}`}>{groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess) === null ? "Sin evaluar" : `${groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess)}%`}</span>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 backdrop-blur-sm"><tr><th className="w-12 px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">#</th><th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Criterio</th><th className="w-[260px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Proceso / responsable</th><th className="w-[180px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Evidencia</th><th className="w-32 px-4 py-3 text-center font-black">Estado</th></tr></thead>
                    <tbody>
                      {(selectedCell.filteredRows?.length ? selectedCell.filteredRows : selectedCell.group.rows).map((row) => {
                        const [number, requirement, evidence, responsible] = row;
                        const responsibleInfo = responsibleLabel(responsible);
                        const proceso = resolveProceso(responsible, selectedCell.selectedProcess);
                        const key = stateKey(selectedCell.group.subtitle, number, proceso);
                        const currentScore = getRowScore(statusOverrides, selectedCell.group, row, selectedCell.selectedProcess);
                        return (
                          <tr key={key} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-black text-slate-500">{number}</td>
                            <td className="px-4 py-2"><div className="max-w-[420px] text-[13px] font-medium leading-relaxed text-slate-700">{requirement}</div></td>
                            <td className="w-[260px] px-4 py-3">
                              <div className="inline-flex min-w-[220px] flex-col gap-1 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-left">
                                <span className="text-[12px] font-semibold text-slate-700">{responsibleInfo.process}</span>
                                <span className="text-[10px] font-medium text-blue-600">{responsibleInfo.role}</span>
                                {responsible === "Todos" && <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Capturando para: {proceso}</span>}
                              </div>
                            </td>
                            <td className="w-[180px] px-4 py-3"><div className="group relative max-w-[170px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600 shadow-sm transition hover:border-slate-300"><textarea value={evidenceOverrides[key] ?? ""} placeholder={evidence} onChange={(event) => updateEvidence(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso, event.target.value)} onBlur={() => commitEvidence(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso)} rows={2} disabled={!canEdit} className={`w-full resize-none bg-transparent pr-5 text-[11px] font-medium leading-relaxed text-slate-600 outline-none placeholder:italic placeholder:text-slate-400 ${canEdit ? "cursor-text" : "cursor-default"}`} /><span className={`absolute right-2 top-2 text-[9px] text-slate-400 transition ${canEdit ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}>✎</span></div></td>
                            <td className="px-4 py-3 text-center">
                              <div className="group flex items-center justify-center gap-2"><span className={`inline-flex justify-center rounded-xl px-3 py-1.5 text-[11px] font-black shadow-sm transition-all ${cellStyle(currentScore)}`}>{currentScore === null ? scoreMeaning(currentScore) : `${currentScore} · ${scoreMeaning(currentScore)}`}</span><select aria-label="Actualizar estatus" value={currentScore ?? ""} onChange={(event) => updateStatus(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso, event.target.value)} disabled={!canEdit} className={`rounded-md border border-transparent bg-slate-100/70 px-1.5 py-[2px] text-[9px] font-bold text-slate-500 outline-none transition-all hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 ${canEdit ? "opacity-0 group-hover:opacity-100" : "pointer-events-none opacity-0"}`}>{currentScore === null && <option value="" disabled>Sin evaluar</option>}<option value={10}>10</option><option value={5}>5</option><option value={3}>3</option><option value={0}>0</option></select></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <HistorialTimelineModal
          open={historialOpen}
          onClose={() => setHistorialOpen(false)}
          loading={historialLoading}
          entries={historialEntries}
          selectedProcess={selectedProcess}
        />
        </>
        )}

        {view === "plan" && (
          <section className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Completados</div>
                <div className="mt-1 text-xl font-black text-emerald-600">{planStats.completados}/{planStats.total}</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">En progreso</div>
                <div className="mt-1 text-xl font-black text-amber-600">{planStats.enProgreso}</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Pendientes</div>
                <div className="mt-1 text-xl font-black text-slate-500">{planStats.pendientes}</div>
              </div>
            </div>

            {planLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-400 shadow-sm">Cargando plan de implementación…</div>
            ) : (
              (planMacroprocesos || []).map((mp) => {
                const completados = mp.pendientes.filter((p) => p.estado === "Completado").length;
                return (
                  <div key={mp.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">{mp.numero}{mp.letra || ""}</span>
                        <div>
                          <div className="text-[11px] font-black text-slate-800">{mp.nombre}</div>
                          <div className="text-[9px] font-bold text-slate-400">{mp.lider}</div>
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black text-slate-500">{completados}/{mp.pendientes.length} completados</span>
                    </div>
                    <div className="space-y-2 px-4 py-3">
                      {mp.pendientes.map((pendiente) => (
                        <div key={pendiente.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-black text-slate-800">{pendiente.titulo}</span>
                                {pendiente.periodicidad && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">{pendiente.periodicidad}</span>}
                              </div>
                              {pendiente.nota && <p className="mt-1 text-[10px] font-medium leading-snug text-slate-500">{pendiente.nota}</p>}
                              {pendiente.responsables?.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {pendiente.responsables.map((r) => (
                                    <span key={r.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${r.apoyo_consultor ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-white text-slate-500"}`}>
                                      {r.nombre}{r.rol ? ` · ${r.rol}` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" disabled={!canEdit} onClick={() => handleUpdateEstadoPendiente(pendiente)} className={`rounded-lg border px-2 py-1 text-[9px] font-black transition ${planEstadoBg(pendiente.estado)} ${canEdit ? "hover:opacity-80" : "cursor-default"}`}>{pendiente.estado}</button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => setConvertingPendienteId((current) => (current === pendiente.id ? null : pendiente.id))}
                                  title="Enviar a Asignaciones"
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${convertingPendienteId === pendiente.id ? "bg-sky-100 text-sky-600" : "text-slate-300 hover:bg-sky-50 hover:text-sky-600"}`}
                                >
                                  ▸
                                </button>
                              )}
                            </div>
                          </div>
                          {convertingPendienteId === pendiente.id && (
                            <PlanAsignacionForm
                              personasCatalogo={people}
                              defaultPersonaId={getPlanLeaderPersonaId(mp)}
                              defaultRol={mp.lider}
                              defaultTitulo={`SIG Plan — ${mp.nombre}: ${pendiente.titulo}`}
                              onCancel={() => setConvertingPendienteId(null)}
                              onConfirm={(payload) => handleCrearAsignacionPlan(mp, pendiente, payload)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            <HistorialTimelineModal
              open={planHistorialOpen}
              onClose={() => setPlanHistorialOpen(false)}
              loading={planHistorialLoading}
              entries={planHistorialEntries}
              selectedProcess="Plan de implementación"
            />
          </section>
        )}

        {view === "cambios" && (
          <section className="space-y-3">
            {cambiosMessage && <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700">{cambiosMessage}</div>}

            {cambioCreating && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                    Motivo del cambio
                    <input type="text" value={cambioNewDraft.titulo} onChange={(e) => setCambioNewDraft((d) => ({ ...d, titulo: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Proceso impactado
                    <select value={cambioNewDraft.procesoImpactado} onChange={(e) => setCambioNewDraft((d) => ({ ...d, procesoImpactado: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                      <option value="">Sin definir</option>
                      {mapProcesses.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Beneficios esperados
                    <input type="text" value={cambioNewDraft.beneficiosEsperados} onChange={(e) => setCambioNewDraft((d) => ({ ...d, beneficiosEsperados: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                    Descripción / riesgos
                    <textarea rows={2} value={cambioNewDraft.descripcion} onChange={(e) => setCambioNewDraft((d) => ({ ...d, descripcion: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={handleCreateCambio} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Crear solicitud</button>
                  <button type="button" onClick={() => setCambioCreating(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
                </div>
              </div>
            )}

            {cambiosLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-400 shadow-sm">Cargando control de cambios…</div>
            ) : (cambios || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-300 shadow-sm">Aún no hay solicitudes de cambio registradas.</div>
            ) : (
              <div className="space-y-2">
                {(cambios || []).map((cambio) => (
                  <button
                    key={cambio.id}
                    type="button"
                    onClick={() => setSelectedCambio(cambio)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-black text-slate-800">{cambio.titulo}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                        {cambio.proceso_impactado || "Proceso sin definir"} · Solicitó {cambio.solicitante?.nombre || cambio.solicitante_nombre || "—"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${CAMBIO_ESTADO_BADGE[cambio.estado] || ""}`}>{cambio.estado}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedCambio && (
              <CambioDetailModal
                cambio={selectedCambio}
                people={people}
                canEvaluate={canEvaluateCambio(currentUser)}
                canApprove={canApproveCambio(currentUser)}
                canImplement={canImplementCambio(currentUser, selectedCambio)}
                onClose={() => setSelectedCambio(null)}
                onSaveSolicitud={(draft) => handleSaveSolicitud(selectedCambio, draft)}
                onIniciarEvaluacion={() => handleIniciarEvaluacion(selectedCambio)}
                onGuardarEvaluacion={(draft) => handleGuardarEvaluacion(selectedCambio, draft)}
                onEnviarAprobacion={(draft) => handleEnviarAprobacion(selectedCambio, draft)}
                onAprobar={(draft) => handleAprobarCambio(selectedCambio, draft)}
                onRechazar={(justificacion) => handleRechazarCambio(selectedCambio, justificacion)}
                onGuardarImplementacion={(draft) => handleGuardarImplementacion(selectedCambio, draft)}
                onPasarASeguimiento={(draft) => handlePasarASeguimiento(selectedCambio, draft)}
                onCerrarSeguimiento={(draft) => handleCerrarSeguimiento(selectedCambio, draft)}
                onGenerarAccionCorrectiva={() => handleGenerarAccionCorrectiva(selectedCambio)}
              />
            )}

            <HistorialTimelineModal
              open={cambiosHistorialOpen}
              onClose={() => setCambiosHistorialOpen(false)}
              loading={cambiosHistorialLoading}
              entries={cambiosHistorialEntries}
              selectedProcess="Control de cambios"
            />
          </section>
        )}

        {view === "auditorias" && puedeVerAuditorias && (
          <section className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400">
              {canEdit
                ? "Programa y plan de cada auditoría se capturan y editan aquí (ISO 19011); la evidencia primaria del auditado sigue viviendo en su estructura de SharePoint. El informe en PDF descargado se archiva ahí como respaldo."
                : "Aquí solo ves el plan de la(s) auditoría(s) donde tú eres el auditado — puedes revisarlo y firmarlo."}
            </p>

            {canEdit && (
              <div className="flex w-fit items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[10px] font-black uppercase tracking-wide">
                <button type="button" onClick={() => setAuditoriasSubTab("programas")} className={`rounded-md px-3 py-1.5 transition ${auditoriasSubTab === "programas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Programas</button>
                <button type="button" onClick={() => setAuditoriasSubTab("planes")} className={`rounded-md px-3 py-1.5 transition ${auditoriasSubTab === "planes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Planes</button>
              </div>
            )}

            {canEdit && auditoriasSubTab === "programas" && (
              <div className="space-y-3">
                {programaExpandedId === "new" && programaEditing && (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">{renderProgramaEditForm()}</div>
                )}

                {programasLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-400 shadow-sm">Cargando programas…</div>
                ) : (programas || []).length === 0 ? (
                  programaExpandedId !== "new" && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-300 shadow-sm">Aún no existe ningún programa de auditoría.</div>
                  )
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <th className="px-3 py-2">Programa</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Coordinador SIG</th>
                          <th className="px-3 py-2">Director General</th>
                          <th className="px-3 py-2">Creado</th>
                          <th className="px-3 py-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programas.map((p) => (
                          <React.Fragment key={p.id}>
                            <tr className="border-b border-slate-50">
                              <td className="px-3 py-2.5 font-bold text-slate-700">{p.nombre}</td>
                              <td className="px-3 py-2.5">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${p.estado === "Vigente" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{p.estado}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                {p.firmado_coordinador_nombre ? <span className="font-bold text-emerald-600">✓ Firmado</span> : <span className="text-slate-400">Pendiente</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {p.aprobado_por_nombre ? <span className="font-bold text-emerald-600">✓ Firmado</span> : <span className="text-slate-400">Pendiente</span>}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-500">{new Date(p.created_at).toLocaleDateString("es-MX")}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => { setProgramaEditing(false); setProgramaExpandedId((current) => (current === p.id ? null : p.id)); }}
                                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition ${programaExpandedId === p.id ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                                  >
                                    {programaExpandedId === p.id ? "Ocultar" : "Ver detalle"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {programaExpandedId === p.id && (
                              <tr>
                                <td colSpan={6} className="bg-slate-50/60 px-3 pb-3">
                                  {programaEditing ? renderProgramaEditForm() : renderProgramaReadView(p)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {auditoriasSubTab === "planes" && (
              <>
            {auditoriasMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{auditoriasMessage}</div>}

            {auditoriaCreating && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Macroproceso
                    <select value={auditoriaNewDraft.macroproceso} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, macroproceso: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                      <option value="">Selecciona...</option>
                      {mapProcesses.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Fecha programada
                    <input type="date" value={auditoriaNewDraft.fechaProgramada} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, fechaProgramada: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Auditor líder
                    <select value={auditoriaNewDraft.auditorLiderPersonaId} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, auditorLiderPersonaId: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                      <option value="">Sin asignar</option>
                      {auditoriaPersonaOptions.filter((p) => AUDITORIA_LIDER_PERSONA_IDS.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Equipo auditor
                    <MultiSelectDropdown
                      options={auditoriaPersonaOptions.filter((p) => AUDITORIA_EQUIPO_PERSONA_IDS.includes(p.id) && String(p.id) !== String(auditoriaNewDraft.auditorLiderPersonaId))}
                      selectedIds={auditoriaNewDraft.equipoPersonaIds}
                      onToggle={(id) => setAuditoriaNewDraft((d) => ({
                        ...d,
                        equipoPersonaIds: d.equipoPersonaIds.includes(id) ? d.equipoPersonaIds.filter((x) => x !== id) : [...d.equipoPersonaIds, id],
                      }))}
                      placeholder="Sin equipo adicional"
                    />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Auditado
                    <select value={auditoriaNewDraft.auditadoPersonaId} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, auditadoPersonaId: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                      <option value="">Sin asignar</option>
                      {auditoriaPersonaOptions.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Modalidad y lugar
                    <input type="text" value={auditoriaNewDraft.modalidadLugar} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, modalidadLugar: e.target.value }))} placeholder="Presencial · Oficina RH" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                    Alcance
                    <textarea rows={2} value={auditoriaNewDraft.alcance} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, alcance: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Reporte (link a SharePoint)
                    <input type="text" value={auditoriaNewDraft.reporteUrl} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, reporteUrl: e.target.value }))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                    Notas
                    <textarea rows={2} value={auditoriaNewDraft.notas} onChange={(e) => setAuditoriaNewDraft((d) => ({ ...d, notas: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none" />
                  </label>
                </div>

                <div className="mt-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Criterios de auditoría ({auditoriaNewDraft.criterios.length} seleccionados)</div>
                  <div className="mt-1 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                    {sigSections.map((section) => (
                      <details key={section.numeral} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wide text-slate-500">{section.numeral}. {section.title}</summary>
                        <div className="mt-1.5 space-y-2 pl-2">
                          {section.groups.map((group) => (
                            <div key={group.subtitle}>
                              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{cleanSubtitle(group.subtitle)}</div>
                              {group.rows.map((row) => {
                                const [numero, texto] = row;
                                const checked = auditoriaNewDraft.criterios.some((c) => c.numeral === section.numeral && c.subtitulo === group.subtitle && c.numero === numero);
                                return (
                                  <label key={numero} className="mt-0.5 flex items-start gap-1.5 text-[11px] font-medium text-slate-600">
                                    <input type="checkbox" checked={checked} onChange={() => toggleAuditoriaCriterio(section.numeral, group.subtitle, numero)} className="mt-0.5" />
                                    <span>{numero} · {texto}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={handleCreateAuditoria} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Programar auditoría</button>
                  <button type="button" onClick={() => setAuditoriaCreating(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
                </div>
              </div>
            )}

            {(() => {
              const auditoriasVisibles = canEdit
                ? (auditorias || [])
                : (auditorias || []).filter((a) => Number(a.auditado_persona_id) === Number(currentUser?.persona_id));
              return auditoriasLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-400 shadow-sm">Cargando programa de auditorías…</div>
            ) : auditoriasVisibles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-[11px] font-bold text-slate-300 shadow-sm">{canEdit ? "Aún no hay auditorías programadas." : "Aún no hay un plan de auditoría asignado a ti."}</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-3 py-2">🗂 Programa</th>
                      <th className="px-3 py-2">🏭 Macroproceso</th>
                      <th className="px-3 py-2">📅 Fecha</th>
                      <th className="px-3 py-2">🚦 Estado</th>
                      <th className="px-3 py-2">🧑‍💼 Auditor líder</th>
                      <th className="px-3 py-2">👥 Equipo</th>
                      <th className="px-3 py-2">✍️ Firmas</th>
                      <th className="px-3 py-2">🔍 Hallazgos</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoriasVisibles.map((auditoria) => {
                      const puedeVerFicha = canEdit || Number(currentUser?.persona_id) === Number(auditoria.auditado_persona_id);
                      const firmasCount = [auditoria.firmado_coordinador_nombre, auditoria.firmado_director_nombre, auditoria.firmado_pm_nombre, auditoria.firmado_auditado_nombre].filter(Boolean).length;
                      return (
                      <React.Fragment key={auditoria.id}>
                        <tr className="border-b border-slate-50 hover:bg-slate-50/40">
                          <td className="px-3 py-2.5">
                            {auditoria.programa?.nombre ? (
                              <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">{auditoria.programa.nombre}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-700">{auditoria.macroproceso}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-500">{auditoria.fecha_programada || "Sin fecha"}</td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              disabled={!canEditPlanes}
                              onClick={() => handleCycleAuditoriaEstado(auditoria)}
                              title={canEditPlanes ? "Clic para avanzar el estado" : ""}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black disabled:cursor-default ${AUDITORIA_ESTADO_BADGE[auditoria.estado] || ""}`}
                            >
                              {auditoria.estado}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-500">{auditoria.auditor_lider?.nombre || "Sin asignar"}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-500">
                            {auditoria.equipo?.length ? auditoria.equipo.map((e) => e.persona?.nombre).filter(Boolean).join(", ") : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${firmasCount === 4 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{firmasCount}/4</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              disabled={!canEditPlanes}
                              value={auditoria.hallazgos ?? 0}
                              onChange={(e) => handleSaveAuditoriaField(auditoria, "hallazgos", Number(e.target.value) || 0)}
                              className="h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              {puedeVerFicha && (
                                <button
                                  type="button"
                                  onClick={() => setAuditoriaFichaAbiertaId((current) => (current === auditoria.id ? null : auditoria.id))}
                                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition ${auditoriaFichaAbiertaId === auditoria.id ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                                >
                                  Ver plan
                                </button>
                              )}
                              {canEditPlanes && (
                                <>
                                  <AuditoriaEnviarFirmaButton
                                    auditoria={auditoria}
                                    sending={enviandoFirmaId === auditoria.id}
                                    onClick={() => handleEnviarFirma(auditoria)}
                                  />
                                  <AuditoriaAsignacionButton
                                    active={Boolean(auditoria.asignacion_id)}
                                    onClick={() => setAuditoriaAsignandoId((current) => (current === auditoria.id ? null : auditoria.id))}
                                  />
                                  <button type="button" onClick={() => handleDeleteAuditoria(auditoria.id)} title="Eliminar" className="text-sm font-black leading-none text-slate-300 transition hover:text-red-600">×</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {auditoriaFichaAbiertaId === auditoria.id && (
                          <tr>
                            <td colSpan={11} className="bg-slate-50/60 px-3 pb-3">
                              <AuditoriaFichaPanel
                                auditoria={auditoria}
                                currentUser={currentUser}
                                canEdit={canEditPlanes}
                                onUpdated={handleAuditoriaFichaUpdated}
                              />
                            </td>
                          </tr>
                        )}
                        {auditoriaAsignandoId === auditoria.id && (
                          <tr>
                            <td colSpan={11} className="px-3 pb-3">
                              <AuditoriaAsignacionForm
                                personasCatalogo={auditoriaPersonaOptions}
                                onConfirm={(payload) => handleConvertAuditoriaToAssignment(auditoria, payload)}
                                onCancel={() => setAuditoriaAsignandoId(null)}
                              />
                            </td>
                          </tr>
                        )}
                        {auditoriaAccionFormId === auditoria.id && (
                          <tr>
                            <td colSpan={11} className="px-3 pb-3">
                              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                                <div className="grid gap-2 md:grid-cols-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                                    Hallazgo / título de la acción
                                    <input type="text" value={auditoriaAccionDraft.titulo} onChange={(e) => setAuditoriaAccionDraft((d) => ({ ...d, titulo: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                                  </label>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Responsable
                                    <select value={auditoriaAccionDraft.responsablePersonaId} onChange={(e) => setAuditoriaAccionDraft((d) => ({ ...d, responsablePersonaId: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                                      <option value="">Sin asignar</option>
                                      {auditoriaPersonaOptions.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                  </label>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Prioridad
                                    <select value={auditoriaAccionDraft.prioridad} onChange={(e) => setAuditoriaAccionDraft((d) => ({ ...d, prioridad: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                                      {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                  </label>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
                                    Descripción del hallazgo
                                    <textarea rows={2} value={auditoriaAccionDraft.descripcion} onChange={(e) => setAuditoriaAccionDraft((d) => ({ ...d, descripcion: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none" />
                                  </label>
                                </div>
                                <div className="mt-2 flex justify-end gap-2">
                                  <button type="button" onClick={() => handleCrearAccionAuditoria(auditoria)} className="rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white">Crear acción</button>
                                  <button type="button" onClick={() => setAuditoriaAccionFormId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
            })()}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
