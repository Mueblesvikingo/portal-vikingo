import React, { useMemo, useState } from "react";

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
      { subtitle: "6.1 Riesgos y oportunidades", rows: [[1, "Se identifican riesgos y oportunidades del SIG", "SIG-MA-05 Riesgos y oportunidades", "Planeación Estratégica", 5], [2, "Se planifican acciones para tratar riesgos y oportunidades", "SIG-MA-05 Riesgos y oportunidades", "Planeación Estratégica", 3], [3, "Las acciones se integran dentro de los procesos", "Caracterizaciones / Modelado de procesos", "Todos", 3]] },
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
      { subtitle: "7.2 Competencias", rows: [[4, "Competencias por rol definidas", "GCO-M-01 Diccionario de competencias", "Gestión competencias", 5], [5, "Nivel requerido por proceso determinado", "Matriz de competencia por proceso", "Todos", 0], [6, "Brechas de competencia evaluadas", "Análisis de brechas", "Gestión competencias", 0]] },
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
      { subtitle: "8.1 Control operacional", rows: [[1, "Procesos operativos planificados", "Plan de producción / programación", "Planeación producción", 3], [2, "Controles operativos establecidos", "Procedimientos / instrucciones", "Planeación producción", 3]] },
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
      { subtitle: "9.1 Seguimiento y medición", rows: [[1, "Indicadores del SIG establecidos", "SIG-MA-07 Tablero de control", "Evaluación desempeño", 10], [2, "Datos de desempeño recopilados", "Tableros de control", "Todos", 0], [3, "Periodicidad de seguimiento definida", "Programa de revisión del SIG", "Evaluación desempeño", 0]] },
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
      { subtitle: "10.1 Mejora", rows: [[1, "Oportunidades de mejora determinadas", "Planes de mejora documentados", "Evaluación desempeño", 0], [2, "Mejora continua promovida", "Iniciativas de mejora", "Dirección", 0]] },
      { subtitle: "10.2 Acción correctiva", rows: [[3, "Acciones correctivas planteadas", "Plan de acciones", "Evaluación desempeño", 0], [4, "Acciones correctivas implementadas y evaluadas", "Plan de acciones", "Evaluación desempeño", 0], [5, "Causas de no conformidades analizadas", "Análisis de causas", "Evaluación desempeño", 0]] },
    ],
  },
];

let mapProcesses = [
  "Planeación estratégica del SIG", "Planeación financiera", "Gestión de competencias", "Evaluación desempeño del SIG", "Ventas", "Ingeniería / Desarrollo de productos", "Compras", "Planeación y control de la producción", "Gestión de inventarios", "Control de almacenes", "Distribución", "Gestión de calidad", "Recursos humanos", "Gestión de Seguridad y Salud laboral", "Transformación Digital y Automatización", "Contabilidad y Cumplimiento Fiscal",
];

let processLeaders = {
  "Planeación Estratégica": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Planeación estratégica del SIG": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Planeación financiera": { role: "Finanzas", person: "Samantha" },
  "Gestión competencias": { role: "Analista de talento", person: "Jacqueline" },
  "Gestión de competencias": { role: "Analista de talento", person: "Jacqueline" },
  "Evaluación desempeño": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  "Evaluación desempeño del SIG": { role: "Coordinador Estratégico/SIG", person: "Cristian" },
  Ventas: { role: "Director general", person: "Alejandro" },
  "Desarrollo de productos": { role: "Ingeniero de producto", person: "Beatriz" },
  "Ingeniería / Desarrollo de productos": { role: "Ingeniero de producto", person: "Beatriz" },
  Compras: { role: "Gerente Operaciones", person: "Hugo" },
  "Planeación producción": { role: "Gerente Operaciones", person: "Hugo" },
  "Planeación y control de la producción": { role: "Gerente Operaciones", person: "Hugo" },
  "Gestión de inventarios": { role: "Gerente Operaciones", person: "Hugo" },
  "Control de almacenes": { role: "Gerente Operaciones", person: "Hugo" },
  Distribución: { role: "Gerente Operaciones", person: "Hugo" },
  Calidad: { role: "Coordinador de Calidad", person: "Beatriz" },
  "Gestión de calidad": { role: "Coordinador de Calidad", person: "Beatriz" },
  "Producción/Calidad": { role: "Gerente Operaciones / Coordinador de Calidad", person: "Hugo / Beatriz" },
  "Recursos humanos": { role: "Recursos humanos", person: "Aurora" },
  "Gestión de Seguridad y Salud laboral": { role: "Coordinador SST", person: "Aurora" },
  "Transformación Digital y Automatización": { role: "Analista de procesos", person: "Elizabeth" },
  "Contabilidad y Cumplimiento Fiscal": { role: "Finanzas", person: "Samantha" },
  Dirección: { role: "Director general", person: "Dirección" },
  Todos: { role: "Transversal", person: "Multidisciplinario" },
};

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

function groupAverage(group) {
  const total = group.rows.reduce((sum, row) => sum + row[4], 0);
  return Math.round((total / (group.rows.length * 10)) * 100);
}

function groupAverageWithOverrides(group, statusOverrides) {
  const total = group.rows.reduce((sum, row) => sum + (statusOverrides[rowKey(group.subtitle, row[0])] ?? row[4]), 0);
  return Math.round((total / (group.rows.length * 10)) * 100);
}

function sectionAverageWithOverrides(section, statusOverrides) {
  const rows = section.groups.flatMap((group) => group.rows.map((row) => ({ group, row })));
  const total = rows.reduce((sum, item) => sum + (statusOverrides[rowKey(item.group.subtitle, item.row[0])] ?? item.row[4]), 0);
  return rows.length ? Math.round((total / (rows.length * 10)) * 100) : 0;
}

function globalAverageWithOverrides(sections, statusOverrides) {
  const total = sections.reduce((sum, section) => sum + sectionAverageWithOverrides(section, statusOverrides), 0);
  return sections.length ? Math.round(total / sections.length) : 0;
}

function getSectionDelta(section, statusOverrides) {
  const current = sectionAverageWithOverrides(section, statusOverrides);
  const original = section.percent;
  return current - original;
}

function getDynamicAction(section, selectedProcess, statusOverrides = {}) {
  const sectionRows = section.groups.flatMap((group) => group.rows.filter((row) => processApplies(row[3], selectedProcess)).map((row) => ({ group, row })));
  const processAverage = sectionRows.length ? Math.round(sectionRows.reduce((sum, item) => sum + (statusOverrides[rowKey(item.group.subtitle, item.row[0])] ?? item.row[4]), 0) / sectionRows.length) : 0;
  const action = processAverage >= 8 ? "Hay que mantener" : processAverage >= 5 ? "Hay que monitorear" : processAverage >= 3 ? "Hay pendientes" : "Hay que empezar";
  return { action, processAverage };
}

function getProcessInsights(selectedProcess, statusOverrides = {}) {
  const applicableRows = sigSections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.rows
        .filter((row) => processApplies(row[3], selectedProcess))
        .map((row) => {
          const key = rowKey(group.subtitle, row[0]);
          return {
            section: section.title,
            numeral: section.numeral,
            subtitle: group.subtitle,
            score: statusOverrides[key] ?? row[4],
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

function runPreviewTests() {
  console.assert(sigSections.length === 7, "Debe haber 7 numerales del 4 al 10");
  console.assert(sigSections[0].numeral === "4", "El primer numeral debe ser 4");
  console.assert(sigSections[sigSections.length - 1].numeral === "10", "El último numeral debe ser 10");
  console.assert(globalAverageWithOverrides(sigSections, {}) === 38, "El resultado global esperado es 38%");
  console.assert(statusTextColor(85) === "text-emerald-600", "85% debe ser verde");
  console.assert(scoreMeaning(0) === "No implementado", "0 debe mostrarse como no implementado");
  console.assert(scoreMeaning(10) === "Estandarizado", "10 debe mostrarse como estandarizado");
  console.assert(groupAverage(sigSections[0].groups[0]) === 100, "El primer grupo debe estar al 100%");
  console.assert(mapProcesses.length === 16, "El filtro debe incluir los 16 procesos del mapa del SIG");
  console.assert(processApplies("Todos", "Control de almacenes"), "Los requisitos marcados como Todos deben aplicar a Control de almacenes");
  console.assert(responsibleLabel("Ventas").person === "Alejandro", "Ventas debe mostrar a Alejandro como responsable");
  console.assert(getDynamicAction(sigSections[0], "Todos").action === "Hay que mantener", "El numeral 4 debe sugerir mantener");
}

runPreviewTests();

export default function DiagnosticoSIGPreview() {
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState("Todos");
  const [statusOverrides, setStatusOverrides] = useState({});
  const [evidenceOverrides, setEvidenceOverrides] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState("");

  const requestAdminAccess = () => {
    if (adminCode.trim() === "SIG-ADM") {
      setIsAdmin(true);
      setAdminCode("");
    }
  };

  const global = useMemo(() => globalAverageWithOverrides(sigSections, statusOverrides), [statusOverrides]);
  const maxGroups = useMemo(() => Math.max(...sigSections.map((section) => section.groups.length)), []);
  const processOptions = useMemo(() => ["Todos", ...mapProcesses], []);

  const updateStatus = (groupSubtitle, number, nextScore) => {
    if (!isAdmin) return;
    setStatusOverrides((current) => ({ ...current, [rowKey(groupSubtitle, number)]: Number(nextScore) }));
  };

  const updateEvidence = (groupSubtitle, number, value) => {
    if (!isAdmin) return;
    setEvidenceOverrides((current) => ({ ...current, [rowKey(groupSubtitle, number)]: value }));
  };

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
                <span>Progreso global SIG</span>
                <span />
              </div>
              <div className="relative h-4 w-full overflow-visible rounded-full bg-slate-200/70 shadow-inner ring-1 ring-slate-200">
                <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0.08))]" />
                <div className="absolute inset-y-0 left-1/4 w-px bg-white/80" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
                <div className="absolute inset-y-0 left-3/4 w-px bg-white/80" />
                <div className={`relative h-full rounded-full transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_rgba(15,23,42,0.14)] ${global >= 80 ? "bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400" : global >= 50 ? "bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400" : global > 0 ? "bg-gradient-to-r from-red-800 via-red-600 to-red-500" : "bg-gradient-to-r from-slate-600 to-slate-400"}`} style={{ width: `${global}%` }}>
                  <div className="absolute inset-0 rounded-full bg-[linear-gradient(110deg,rgba(255,255,255,0.38),rgba(255,255,255,0.05)_45%,rgba(0,0,0,0.08))]" />
                </div>
                <div className="absolute -top-6 -translate-x-1/2 rounded-md border border-white/40 bg-white/80 px-2 py-[1px] text-[9px] font-bold text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.10)] backdrop-blur-sm" style={{ left: `${global}%` }}>{global}%</div>
                <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/80 shadow-[0_2px_8px_rgba(15,23,42,0.18)] backdrop-blur-sm ring-2 ring-slate-300/40" style={{ left: `${global}%` }} />
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

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
          <div className="flex w-full items-center gap-2">
            <div className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Filtro por proceso</div>
            <div className="whitespace-nowrap text-xs font-semibold text-slate-600">Resalta subnumerales aplicables por proceso.</div>
            <select aria-label="Filtro por proceso" value={selectedProcess} onChange={(event) => setSelectedProcess(event.target.value)} className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400">
              {processOptions.map((process) => <option key={process} value={process}>{process}</option>)}
            </select>
            <div className="ml-2 flex shrink-0 items-center gap-2 border-l border-slate-200 pl-3">
              {isAdmin ? (
                <button type="button" onClick={() => setIsAdmin(false)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white" title="Cerrar modo administrador">Admin activo</button>
              ) : (
                <div className="flex items-center gap-2">
                  <input aria-label="Clave de administrador" type="password" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") requestAdminAccess(); }} placeholder="Clave adm." className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-600 outline-none focus:border-slate-400" />
                  <button type="button" onClick={requestAdminAccess} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50" title="Activar permisos de edición">Editar</button>
                </div>
              )}
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
                  <th className="w-[9%] px-2 py-2 text-center font-black">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sigSections.map((section) => {
                  const dynamic = getDynamicAction(section, selectedProcess, statusOverrides);
                  const sectionPercent = sectionAverageWithOverrides(section, statusOverrides);
                  return (
                    <tr key={section.numeral} className="h-[58px] border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1 align-middle font-black text-slate-500">{section.numeral}</td>
                      <td className="px-2 py-1 align-middle"><div className="cursor-help text-[11px] font-black leading-tight text-slate-900" title={section.summary}>{section.title}</div></td>
                      <td className="px-2 py-1 text-center align-middle">
                        <div className={`flex items-center justify-center gap-1 text-sm font-black ${statusTextColor(sectionPercent)}`}>
                          <span>{sectionPercent}%</span>
                          {getSectionDelta(section, statusOverrides) !== 0 && (
                            <span
                              className={`text-[9px] font-black tracking-tight opacity-70 ${
                                getSectionDelta(section, statusOverrides) > 0
                                  ? "text-emerald-600"
                                  : "text-rose-500"
                              }`}
                            >
                              {getSectionDelta(section, statusOverrides) > 0 ? "↑" : "↓"}
                              {Math.abs(getSectionDelta(section, statusOverrides))}
                            </span>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: maxGroups }).map((_, index) => {
                        const group = section.groups[index];
                        if (!group) return <td key={`${section.numeral}-empty-${index}`} className="px-2 py-2 text-center align-middle"><div className="mx-auto h-7 w-7 rounded-lg bg-slate-50" /></td>;
                        const avg = groupAverageWithOverrides(group, statusOverrides);
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
                      <td className="px-3 py-2 text-center align-middle"><span className={`inline-flex rounded-lg px-2 py-[3px] text-[8px] leading-tight font-black ${statusBg(dynamic.processAverage * 10)}`}>{dynamic.action}</span></td>
                    </tr>
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
                    <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Promedio del criterio: {groupAverageWithOverrides(selectedCell.group, statusOverrides)}% • {selectedCell.group.rows.filter((row) => (statusOverrides[rowKey(selectedCell.group.subtitle, row[0])] ?? row[4]) <= 3).length} puntos críticos</div>
                  </div>
                  <span className={`rounded-2xl px-5 py-3 text-2xl font-black shadow-sm ${statusBg(groupAverageWithOverrides(selectedCell.group, statusOverrides))}`}>{groupAverageWithOverrides(selectedCell.group, statusOverrides)}%</span>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 backdrop-blur-sm"><tr><th className="w-12 px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">#</th><th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Criterio</th><th className="w-[260px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Proceso / responsable</th><th className="w-[180px] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide">Evidencia</th><th className="w-32 px-4 py-3 text-center font-black">Estado</th></tr></thead>
                    <tbody>
                      {(selectedCell.filteredRows?.length ? selectedCell.filteredRows : selectedCell.group.rows).map(([number, requirement, evidence, responsible, score]) => {
                        const responsibleInfo = responsibleLabel(responsible);
                        const key = rowKey(selectedCell.group.subtitle, number);
                        const currentScore = statusOverrides[key] ?? score;
                        return (
                          <tr key={key} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-black text-slate-500">{number}</td>
                            <td className="px-4 py-2"><div className="max-w-[420px] text-[13px] font-medium leading-relaxed text-slate-700">{requirement}</div></td>
                            <td className="w-[260px] px-4 py-3"><div className="inline-flex min-w-[220px] flex-col gap-1 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-left"><span className="text-[12px] font-semibold text-slate-700">{responsibleInfo.process}</span><span className="text-[10px] font-medium text-blue-600">{responsibleInfo.role}</span></div></td>
                            <td className="w-[180px] px-4 py-3"><div className="group relative max-w-[170px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600 shadow-sm transition hover:border-slate-300"><textarea value={evidenceOverrides[key] ?? evidence} onChange={(event) => updateEvidence(selectedCell.group.subtitle, number, event.target.value)} rows={2} disabled={!isAdmin} className={`w-full resize-none bg-transparent pr-5 text-[11px] font-medium leading-relaxed text-slate-600 outline-none ${isAdmin ? "cursor-text" : "cursor-default"}`} /><span className={`absolute right-2 top-2 text-[9px] text-slate-400 transition ${isAdmin ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}>✎</span></div></td>
                            <td className="px-4 py-3 text-center">
                              <div className="group flex items-center justify-center gap-2"><span className={`inline-flex justify-center rounded-xl px-3 py-1.5 text-[11px] font-black shadow-sm transition-all ${cellStyle(currentScore)}`}>{currentScore} · {scoreMeaning(currentScore)}</span><select aria-label="Actualizar estatus" value={currentScore} onChange={(event) => updateStatus(selectedCell.group.subtitle, number, event.target.value)} disabled={!isAdmin} className={`rounded-md border border-transparent bg-slate-100/70 px-1.5 py-[2px] text-[9px] font-bold text-slate-500 outline-none transition-all hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 ${isAdmin ? "opacity-0 group-hover:opacity-100" : "pointer-events-none opacity-0"}`}><option value={10}>10</option><option value={5}>5</option><option value={3}>3</option><option value={0}>0</option></select></div>
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
      </div>
    </div>
  );
}
