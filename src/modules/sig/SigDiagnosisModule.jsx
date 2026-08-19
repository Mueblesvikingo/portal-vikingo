import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase";
import { isStrategicTeamMember } from "../../services/permissionsService";
import { createWorkloadAssignment } from "../../services/workloadService";
import { getEstados, upsertEstado, getHistorial, getChecks, createCheck } from "../../services/sigService";
import { getPlanMacroprocesos, updatePendienteEstado, getPlanHistorial } from "../../services/sigPlanService";
import { upsertResultado } from "../../services/performanceService";
import { mapProcesses, processLeaders } from "../../services/processCatalog";

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
  "7.3 Conciencia y comunicación": "Fortalecer comunicación y cultura SIG.",
  "7.5 Información documentada": "Controlar documentos y registros del sistema.",
  "8.1 Control operacional": "Controlar actividades críticas de operación.",
  "8.2 Cliente": "Gestionar requisitos y comunicación con clientes.",
  "8.3 Diseño y desarrollo": "Controlar diseño y desarrollo de productos.",
  "8.4 Proveedores externos": "Gestionar proveedores y compras externas.",
  "8.5 Producción controlada": "Asegurar producción bajo control operativo.",
  "8.6 Liberación y no conformes": "Controlar liberaciones y desviaciones.",
  "9.1 Seguimiento y medición": "Medir desempeño y resultados del SIG.",
  "9.1.2 Satisfacción del cliente": "Evaluar percepción y satisfacción del cliente.",
  "9.2 Auditoría interna": "Verificar cumplimiento mediante auditorías.",
  "9.3 Revisión por la dirección": "Evaluar desempeño estratégico del SIG.",
  "10.1 Mejora": "Promover mejora continua del sistema.",
  "10.2 Acción correctiva": "Corregir causas de incumplimientos.",
};

let sigSections = [
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
      { subtitle: "7.1 Recursos", rows: [[1, "La organización determina y proporciona recursos para el SIG", "SIG-F-02 Presupuesto estrategia", "Dirección", 10], [2, "La organización asegura la infraestructura necesaria", "Hojas de vida de activos", "Dirección", 3], [3, "Se define y proporciona el personal necesario para cada proceso", "Análisis de capacidad / Plan de cobertura", "Dirección", 3]] },
      { subtitle: "7.2 Competencias", rows: [[4, "Competencias por rol definidas", "GCO-M-01 Diccionario de competencias", "Todos", 5], [5, "Nivel requerido por proceso determinado", "Matriz de competencia por proceso", "Todos", 0], [6, "Brechas de competencia evaluadas", "Análisis de brechas", "Todos", 0]] },
      { subtitle: "7.3 Conciencia y comunicación", rows: [[7, "Personal conoce políticas del SIG", "Entrevistas / checklist", "Dirección", 5], [8, "Canales de comunicación definidos", "SIG-MA-06 Comunicaciones", "Planeación Estratégica", 5], [9, "Desempeño del SIG comunicado", "Informes / tableros", "Planeación Estratégica", 3]] },
      { subtitle: "7.5 Información documentada", rows: [[10, "Documentación del SIG controlada", "SIG-P-02 Control de información documentada", "Planeación Estratégica", 10], [11, "Lista maestra por proceso", "Lista maestra de documentos por proceso", "Todos", 3], [12, "Accesos y permisos controlados", "Administración de accesos", "Todos", 3]] },
    ],
  },
  {
    numeral: "8",
    title: "Operación",
    percent: 36,
    summary: "Operación, producción y calidad",
    groups: [
      { subtitle: "8.1 Control operacional", rows: [[1, "Procesos operativos planificados", "Plan de producción / programación", "Todos", 3], [2, "Controles operativos establecidos", "Procedimientos / instrucciones", "Todos", 3]] },
      { subtitle: "8.2 Cliente", rows: [[3, "Requisitos del cliente identificados", "Pedido / especificaciones", "Ventas", 5], [4, "Cambios de requisitos gestionados", "Modificación de pedido", "Ventas", 5], [5, "Comunicación con cliente mantenida", "Registros de comunicación", "Ventas", 5]] },
      { subtitle: "8.3 Diseño y desarrollo", rows: [[6, "Diseño planificado", "Plan de diseño / proyecto", "Desarrollo de productos", 5], [7, "Requisitos de diseño identificados", "Planos / fichas técnicas", "Desarrollo de productos", 5], [8, "Cambios de diseño controlados", "Registro de cambios de diseño", "Desarrollo de productos", 3]] },
      { subtitle: "8.4 Proveedores externos", rows: [[9, "Proveedores seleccionados con criterios", "Evaluación de proveedores", "Compras", 3], [10, "Desempeño de proveedores monitoreado", "Seguimiento de proveedores", "Compras", 3], [11, "Requisitos a proveedores comunicados", "Orden de compra / especificación", "Compras", 5]] },
      { subtitle: "8.5 Producción controlada", rows: [[12, "Producción bajo condiciones controladas", "Fichas técnicas / instrucciones", "Planeación producción", 3], [13, "Seguimiento durante producción", "Registros de inspección", "Producción/Calidad", 3], [14, "Recursos y personal competente", "Infraestructura / competencias", "Planeación producción", 5]] },
      { subtitle: "8.6 Liberación y no conformes", rows: [[15, "Productos verificados antes de liberarse", "Registros de inspección", "Calidad", 3], [16, "Liberación autorizada", "Autorización de liberación", "Calidad", 3], [17, "Salidas no conformes controladas", "Registro de no conformidades", "Calidad", 3]] },
    ],
  },
  {
    numeral: "9",
    title: "Evaluación del desempeño",
    percent: 12,
    summary: "Medición, auditorías y seguimiento",
    groups: [
      { subtitle: "9.1 Seguimiento y medición", rows: [[1, "Indicadores del SIG establecidos", "SIG-MA-07 Tablero de control", "Todos", 10], [2, "Datos de desempeño recopilados", "Tableros de control", "Todos", 0], [3, "Periodicidad de seguimiento definida", "Programa de revisión del SIG", "Todos", 0]] },
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
      { subtitle: "10.1 Mejora", rows: [[1, "Oportunidades de mejora determinadas", "Planes de mejora documentados", "Todos", 0], [2, "Mejora continua promovida", "Iniciativas de mejora", "Todos", 0]] },
      { subtitle: "10.2 Acción correctiva", rows: [[3, "Acciones correctivas planteadas", "Plan de acciones", "Todos", 0], [4, "Acciones correctivas implementadas y evaluadas", "Plan de acciones", "Todos", 0], [5, "Causas de no conformidades analizadas", "Análisis de causas", "Todos", 0]] },
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

function cleanSubtitle(subtitle) {
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

function cellStyle(score) {
  if (score >= 10) return "bg-emerald-100 text-emerald-700";
  if (score >= 5) return "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200/60";
  if (score >= 3) return "bg-amber-100/80 text-amber-700 ring-1 ring-amber-200/70";
  return "bg-rose-100 text-rose-700 ring-1 ring-rose-200/70";
}

function scoreMeaning(score) {
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
function resolveProceso(rowResponsible, selectedProcess) {
  if (selectedProcess !== "Todos") return selectedProcess;
  return rowResponsible;
}

function stateKey(groupSubtitle, number, proceso) {
  return `${rowKey(groupSubtitle, number)}::${proceso}`;
}

function getRowScore(statusOverrides, group, row, selectedProcess) {
  const proceso = resolveProceso(row[3], selectedProcess);
  return statusOverrides[stateKey(group.subtitle, row[0], proceso)] ?? row[4];
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
function groupAverageWithOverrides(group, statusOverrides, selectedProcess = "Todos") {
  const rows = selectedProcess === "Todos" ? group.rows : group.rows.filter((row) => processApplies(row[3], selectedProcess));
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + getRowScore(statusOverrides, group, row, selectedProcess), 0);
  return Math.round((total / (rows.length * 10)) * 100);
}

function sectionAverageWithOverrides(section, statusOverrides, selectedProcess = "Todos") {
  const allRows = section.groups.flatMap((group) => group.rows.map((row) => ({ group, row })));
  const rows = selectedProcess === "Todos" ? allRows : allRows.filter((item) => processApplies(item.row[3], selectedProcess));
  const total = rows.reduce((sum, item) => sum + getRowScore(statusOverrides, item.group, item.row, selectedProcess), 0);
  return rows.length ? Math.round((total / (rows.length * 10)) * 100) : 0;
}

// Promedio SIEMPRE en el contexto "Todos" — usado en la calificación global
// fija (no se mueve con el filtro, a diferencia de la barra de progreso).
function globalAverageWithOverrides(sections, statusOverrides) {
  const total = sections.reduce((sum, section) => sum + sectionAverageWithOverrides(section, statusOverrides, "Todos"), 0);
  return sections.length ? Math.round(total / sections.length) : 0;
}

// Promedio de los criterios aplicables a un solo proceso, a través de los 7
// numerales — esto es lo que ve la barra de progreso cuando hay un proceso
// filtrado (distinto de "Todos").
function processAverageWithOverrides(sections, selectedProcess, statusOverrides) {
  if (selectedProcess === "Todos") return globalAverageWithOverrides(sections, statusOverrides);
  const rows = sections.flatMap((section) =>
    section.groups.flatMap((group) => group.rows.filter((row) => processApplies(row[3], selectedProcess)).map((row) => ({ group, row })))
  );
  if (!rows.length) return 0;
  const total = rows.reduce((sum, item) => sum + getRowScore(statusOverrides, item.group, item.row, selectedProcess), 0);
  return Math.round((total / (rows.length * 10)) * 100);
}

function getSectionDelta(section, statusOverrides, selectedProcess = "Todos") {
  const current = sectionAverageWithOverrides(section, statusOverrides, selectedProcess);
  const original = section.percent;
  return current - original;
}

function getDynamicAction(section, selectedProcess, statusOverrides = {}) {
  const sectionRows = section.groups.flatMap((group) => group.rows.filter((row) => processApplies(row[3], selectedProcess)).map((row) => ({ group, row })));
  const processAverage = sectionRows.length ? Math.round(sectionRows.reduce((sum, item) => sum + getRowScore(statusOverrides, item.group, item.row, selectedProcess), 0) / sectionRows.length) : 0;
  const action = processAverage >= 8 ? "Hay que mantener" : processAverage >= 5 ? "Hay que monitorear" : processAverage >= 3 ? "Hay pendientes" : "Hay que empezar";
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

  const totalRows = baseRows.length;
  const strongCount = baseRows.filter((row) => row.score >= 8).length;
  const mediumCount = baseRows.filter((row) => row.score === 5).length;
  const weakCount = baseRows.filter((row) => row.score <= 3).length;
  const criticalCount = baseRows.filter((row) => row.score === 0).length;

  const weakAreas = [...new Set(baseRows.filter((row) => row.score <= 3).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);
  const strongAreas = [...new Set(baseRows.filter((row) => row.score >= 8).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);
  const monitorAreas = [...new Set(baseRows.filter((row) => row.score === 5).map((row) => row.subtitle.split(" ")[0]))].slice(0, 3);

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

  return { strength, weakness, recommendation };
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
  const [sigKpiId, setSigKpiId] = useState(null);

  // Vista discreta: alterna entre el diagnóstico HLS de siempre y el nuevo
  // Plan de implementación — mismo módulo, sin rediseño, solo un toggle.
  const [view, setView] = useState("diagnostico");
  const [planMacroprocesos, setPlanMacroprocesos] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [convertingPendienteId, setConvertingPendienteId] = useState(null);
  const [planHistorialOpen, setPlanHistorialOpen] = useState(false);
  const [planHistorialLoading, setPlanHistorialLoading] = useState(false);
  const [planHistorialEntries, setPlanHistorialEntries] = useState([]);

  const canEdit = isStrategicTeamMember(currentUser);
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
  }

  async function loadPeople() {
    const { data, error } = await supabase.from("personas").select("id,nombre").order("nombre", { ascending: true });
    if (error) { console.error("Error al cargar personas:", error); return; }
    setPeople(data || []);
  }

  async function loadSigKpiId() {
    const { data, error } = await supabase
      .from("desempeno_kpis")
      .select("id")
      .eq("macroproceso", SIG_KPI_MACROPROCESO)
      .eq("nombre_indicador", SIG_KPI_NOMBRE)
      .eq("activo", true)
      .maybeSingle();
    if (error) { console.error("Error al buscar el KPI de avance del SIG:", error); return; }
    if (data) setSigKpiId(data.id);
  }

  // Empuja el % global del SIG (ya con el score recién guardado) al KPI de
  // Desempeño Organizacional — se calcula en el momento (no depende de que
  // React ya haya vuelto a renderizar) para no mandar un valor desfasado.
  async function syncSigKpi(nextStatusOverrides) {
    if (!sigKpiId) return;
    const globalPct = globalAverageWithOverrides(sigSections, nextStatusOverrides);
    const now = new Date();
    const result = await upsertResultado(
      { kpiId: sigKpiId, anio: now.getFullYear(), mes: now.getMonth() + 1, tipo: "real", valor: globalPct / 100 },
      { actor: currentUser }
    );
    if (!result?.ok) console.error("Error al sincronizar el KPI de avance del SIG:", result?.error);
  }

  useEffect(() => {
    loadEstados();
    loadPeople();
    loadSigKpiId();
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
      descripcion: `${dynamic.action}. Avance actual del proceso en este numeral: ${dynamic.processAverage}0%.`,
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
          </div>
          {view === "plan" && (
            <button type="button" onClick={openPlanHistorial} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-slate-700">⏱ Historial del plan</button>
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
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="w-full table-fixed text-[11px]">
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
                        <div className={`flex items-center justify-center gap-1 text-sm font-black ${statusTextColor(sectionPercent)}`}>
                          <span>{sectionPercent}%</span>
                          {getSectionDelta(section, statusOverrides, selectedProcess) !== 0 && (
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
                              <button type="button" onClick={() => setSelectedCell({ section, group, avg, criticalRows, selectedProcess, filteredRows: filteredGroupRows })} className={`mx-auto flex h-8 w-full max-w-[92px] items-center justify-center rounded-xl text-xs font-black transition hover:scale-[1.03] ${cellStyle(avg / 10)} ${appliesToSelectedProcess ? "shadow-sm" : "opacity-25 grayscale"}`} title={cleanSubtitle(group.subtitle)}>
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
        </section>

        {selectedCell ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[6px]">
            <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/40 bg-white/95 shadow-[0_25px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-6 py-5 text-white">
                <div><div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Detalle del criterio</div><div className="mt-1 text-2xl font-black tracking-tight">{selectedCell.section.numeral}. {selectedCell.section.title}</div></div>
                <button type="button" onClick={() => setSelectedCell(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-slate-200 transition hover:bg-white/15 hover:text-white">×</button>
              </div>
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-[1fr_auto] gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-black tracking-tight text-slate-900">{selectedCell.group.subtitle}</div>
                    <div className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{subnumeralDescriptions[selectedCell.group.subtitle]}</div>
                    <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Promedio del criterio: {groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess)}% • {selectedCell.group.rows.filter((row) => getRowScore(statusOverrides, selectedCell.group, row, selectedCell.selectedProcess) <= 3).length} puntos críticos</div>
                  </div>
                  <span className={`rounded-2xl px-5 py-3 text-2xl font-black shadow-sm ${statusBg(groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess))}`}>{groupAverageWithOverrides(selectedCell.group, statusOverrides, selectedCell.selectedProcess)}%</span>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 backdrop-blur-sm"><tr><th className="w-12 px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">#</th><th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Criterio</th><th className="w-[260px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Proceso / responsable</th><th className="w-[180px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Evidencia</th><th className="w-32 px-4 py-3 text-center font-black">Estado</th></tr></thead>
                    <tbody>
                      {(selectedCell.filteredRows?.length ? selectedCell.filteredRows : selectedCell.group.rows).map(([number, requirement, evidence, responsible, score]) => {
                        const responsibleInfo = responsibleLabel(responsible);
                        const proceso = resolveProceso(responsible, selectedCell.selectedProcess);
                        const key = stateKey(selectedCell.group.subtitle, number, proceso);
                        const currentScore = statusOverrides[key] ?? score;
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
                            <td className="w-[180px] px-4 py-3"><div className="group relative max-w-[170px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600 shadow-sm transition hover:border-slate-300"><textarea value={evidenceOverrides[key] ?? evidence} onChange={(event) => updateEvidence(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso, event.target.value)} onBlur={() => commitEvidence(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso)} rows={2} disabled={!canEdit} className={`w-full resize-none bg-transparent pr-5 text-[11px] font-medium leading-relaxed text-slate-600 outline-none ${canEdit ? "cursor-text" : "cursor-default"}`} /><span className={`absolute right-2 top-2 text-[9px] text-slate-400 transition ${canEdit ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}>✎</span></div></td>
                            <td className="px-4 py-3 text-center">
                              <div className="group flex items-center justify-center gap-2"><span className={`inline-flex justify-center rounded-xl px-3 py-1.5 text-[11px] font-black shadow-sm transition-all ${cellStyle(currentScore)}`}>{currentScore} · {scoreMeaning(currentScore)}</span><select aria-label="Actualizar estatus" value={currentScore} onChange={(event) => updateStatus(selectedCell.section.numeral, selectedCell.group.subtitle, number, proceso, event.target.value)} disabled={!canEdit} className={`rounded-md border border-transparent bg-slate-100/70 px-1.5 py-[2px] text-[9px] font-bold text-slate-500 outline-none transition-all hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 ${canEdit ? "opacity-0 group-hover:opacity-100" : "pointer-events-none opacity-0"}`}><option value={10}>10</option><option value={5}>5</option><option value={3}>3</option><option value={0}>0</option></select></div>
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
      </div>
    </div>
  );
}
