// Reglas de rol existentes, centralizadas aquí para que Sidebar.jsx, AppRouter.jsx
// y WorkloadBalanceModule.jsx dejen de mantener cada una su propia copia.
//
// Un usuario puede tener varios "roles aplicables" a la vez:
//   - su `rol_organizacional` (texto libre en la cuenta de login), y
//   - todos los `persona_roles.rol` activos de la persona real vinculada
//     (columna `usuarios.persona_id`), ya que una persona puede desempeñar
//     varios roles operativos en distintos procesos.
// Un módulo se considera visible/editable si CUALQUIERA de esos roles lo
// permite explícitamente en `roles_permisos` (más permisivo gana). Si ningún
// rol aplicable tiene una regla explícita, se cae en las reglas de fábrica.
//
// Además, `permisos_custom` (columna jsonb en `usuarios`) permite anular todo
// lo anterior para un usuario puntual, con la misma forma de JSON:
//   { "<moduleKey>": { "visible": true|false, "editar": true|false } }

import { supabase } from "./supabase";

const RESTRICTED_MENU_ROLES = ["PM", "Analista de Procesos"];

// Módulos que están OCULTOS por defecto para cualquier rol, salvo que ese rol
// tenga una excepción explícita "visible: true" en roles_permisos (ver
// Catálogo Organizacional → Usuarios → Permisos → "Roles de este usuario").
const MODULES_HIDDEN_BY_DEFAULT = ["organization-catalog"];

const MODULES_VISIBLE_FOR_RESTRICTED_ROLES = [
  "strategic-followup",
  "capacity",
  "organigrama",
  "organization-catalog",
  "workload-balance",
  "maturity",
  "sig",
  "performance",
  "acciones",
];

// Supervisores, auxiliares e inspectores de calidad (cualquier rol que
// empiece con estas palabras, de cualquier proceso) ven Organigrama, Balance
// de Carga y Acciones de Mejora — este último se abrió después a pedido
// explícito del usuario para que cualquiera pueda ver/reportar acciones
// correctivas; quién puede EDITAR cada acción lo sigue decidiendo
// canEditAccion/esParticipanteAccion (creador, responsable, dueño del
// proceso o equipo estratégico), no la visibilidad del módulo.
// "Inspector de Calidad" se agregó a pedido explícito para restringir a
// Laura/Sulidey/Ofelia (únicos 3 usuarios con ese rol) antes de repartirles
// sus claves de acceso — antes solo Supervisor/Auxiliar quedaban acotados,
// por eso seguían viendo el tablero completo.
const OPERATIVE_ROLE_PREFIXES = ["Supervisor", "Auxiliar", "Inspector de Calidad"];
const MODULES_VISIBLE_FOR_OPERATIVE_ROLES = ["organigrama", "workload-balance", "acciones", "operational-performance"];

export function isOperativeRole(user) {
  return getApplicableRoles(user).some((role) =>
    OPERATIVE_ROLE_PREFIXES.some((prefix) => role.startsWith(prefix))
  );
}

const WORKLOAD_FULL_ACCESS_ROLES = [
  "Director",
  "PM",
  "Coordinador SIG",
  "Analista de Procesos",
  "Administrador Operativo",
  "Administrador",
  "Estrategia",
];

const WORKLOAD_PENDING_ACTIVITY_EDIT_ROLES = [
  "Director",
  "Coordinador SIG",
  "Analista de Procesos",
  "PM",
  "Administrador",
  "Administrador Operativo",
  "Líder de proceso",
];

// Equipo estratégico: los únicos roles que, por defecto, pueden aprobar y
// auditar subprocesos en Diseño Organizacional (independiente de si son
// responsables/dueños del proceso). Igual que el resto de permisos, se puede
// dar/quitar esta capacidad a un rol o usuario puntual desde Catálogo
// Organizacional → Usuarios → Permisos (módulo "capacity", campo "aprobar").
const STRATEGIC_TEAM_ROLES = ["PM", "Coordinador SIG", "Analista de Procesos", "Director General"];

// Módulos visibles SOLO para el equipo estratégico (STRATEGIC_TEAM_ROLES),
// sin importar si el usuario es de rol restringido o no. Igual que el resto
// de permisos, se puede dar acceso puntual desde Catálogo Organizacional →
// Usuarios → Permisos (override por usuario o por rol).
const STRATEGIC_TEAM_ONLY_MODULES = ["decision-center"];

// Módulo S&OP: visible para el equipo estratégico (por rol) más un grupo
// puntual de gerencias que participan en el ciclo (Hugo Terrones, Beatriz
// Ruiz, Kevyn "Kevin" Hernando, Samantha Huerta), identificadas por
// persona_id porque no comparten un rol en común — no un default abierto.
const SOP_SCOPED_PERSONA_IDS = [13, 11, 5, 7, 26];
const MODULES_VISIBLE_FOR_STRATEGIC_TEAM_PLUS_PERSONAS = { sop: SOP_SCOPED_PERSONA_IDS };

let rolePermissionsCache = {};
let personaRolesCache = {};

// Se llama una vez por sesión (ver App.jsx) para no consultar Supabase en
// cada chequeo de permiso. Si falla o no se ha llamado todavía, las funciones
// de abajo simplemente caen en las reglas "de fábrica" — nunca rompe nada.
export async function loadRolePermissionDefaults() {
  try {
    const [rolesPermisosResult, personaRolesResult] = await Promise.all([
      supabase.from("roles_permisos").select("rol,permisos"),
      supabase.from("persona_roles").select("persona_id,rol,activo"),
    ]);

    if (rolesPermisosResult.error) {
      console.error("SUPABASE roles_permisos ERROR:", rolesPermisosResult.error);
    }
    if (personaRolesResult.error) {
      console.error("SUPABASE persona_roles ERROR:", personaRolesResult.error);
    }

    const roleMap = {};
    (rolesPermisosResult.data || []).forEach((row) => {
      if (row?.rol) {
        roleMap[row.rol] = row.permisos && typeof row.permisos === "object" ? row.permisos : {};
      }
    });
    rolePermissionsCache = roleMap;

    const personaMap = {};
    (personaRolesResult.data || []).forEach((row) => {
      if (!row?.persona_id || row.activo === false) return;

      const rol = String(row.rol || "").trim();
      if (!rol) return;

      const key = String(row.persona_id);
      if (!personaMap[key]) personaMap[key] = [];
      if (!personaMap[key].includes(rol)) personaMap[key].push(rol);
    });
    personaRolesCache = personaMap;
  } catch (err) {
    console.error("Error inesperado cargando permisos por rol:", err);
    rolePermissionsCache = {};
    personaRolesCache = {};
  }
}

function normalizeRoleText(value) {
  return String(value || "").trim().toLowerCase();
}

function getPrimaryRole(user) {
  return user?.rol_organizacional || user?.rol_sistema || user?.role || "";
}

// Todos los roles que aplican a este usuario: su rol de cuenta más, si tiene
// una persona real vinculada (`persona_id`), todos los roles operativos que
// esa persona tiene en persona_roles.
function getApplicableRoles(user) {
  const roles = new Set();

  [user?.rol_organizacional, user?.rol_sistema, user?.role].filter(Boolean).forEach((role) => roles.add(role));
  (Array.isArray(user?.roles) ? user.roles : []).filter(Boolean).forEach((role) => roles.add(role));

  const personaId = user?.persona_id;
  if (personaId) {
    (personaRolesCache[String(personaId)] || []).forEach((role) => roles.add(role));
  }

  return Array.from(roles);
}

function getModuleOverride(permisos, moduleKey) {
  if (!permisos || typeof permisos !== "object") return null;

  const override = permisos[moduleKey];
  return override && typeof override === "object" ? override : null;
}

function getUserModuleOverride(user, moduleKey) {
  return getModuleOverride(user?.permisos_custom, moduleKey);
}

// Combina la regla de todos los roles aplicables para un campo (visible/editar)
// del módulo dado: si cualquier rol dice explícitamente "sí", gana el "sí". Si
// ninguno dice "sí" pero al menos uno dice explícitamente "no", gana el "no".
// Si ningún rol aplicable tiene una regla explícita, devuelve null (sin dato).
function getRolesFieldValue(user, moduleKey, field) {
  const values = getApplicableRoles(user)
    .map((role) => getModuleOverride(rolePermissionsCache[role], moduleKey)?.[field])
    .filter((value) => typeof value === "boolean");

  if (values.length === 0) return null;
  return values.some(Boolean);
}

// TEMPORAL (pedido explícito del usuario, 23-sep-2026): mientras se sigue
// puliendo Desempeño Operativo, solo el Coordinador SIG debe verlo — ni
// siquiera los supervisores de área para quienes se construyó, ni el resto
// del equipo estratégico. Quitar este bloque (y el `return` que lo usa en
// defaultVisible) para restaurar la visibilidad normal cuando esté listo.
const DESEMPENO_OPERATIVO_WIP_ROLES = ["Coordinador SIG"];

function defaultVisible(user, moduleKey) {
  if (MODULES_HIDDEN_BY_DEFAULT.includes(moduleKey)) return false;

  if (moduleKey === "operational-performance") {
    return getApplicableRoles(user).some((role) => DESEMPENO_OPERATIVO_WIP_ROLES.includes(role));
  }

  if (isOperativeRole(user)) {
    return MODULES_VISIBLE_FOR_OPERATIVE_ROLES.includes(moduleKey);
  }

  if (STRATEGIC_TEAM_ONLY_MODULES.includes(moduleKey)) {
    const roles = getApplicableRoles(user);
    return roles.some((role) => STRATEGIC_TEAM_ROLES.includes(role));
  }

  const scopedPersonaIds = MODULES_VISIBLE_FOR_STRATEGIC_TEAM_PLUS_PERSONAS[moduleKey];
  if (scopedPersonaIds) {
    if (isStrategicTeamMember(user)) return true;
    return scopedPersonaIds.includes(Number(user?.persona_id));
  }

  const role = getPrimaryRole(user);
  if (!RESTRICTED_MENU_ROLES.includes(role)) return true;

  return MODULES_VISIBLE_FOR_RESTRICTED_ROLES.includes(moduleKey);
}

export function canViewModule(user, moduleKey) {
  const userOverride = getUserModuleOverride(user, moduleKey);
  if (userOverride && typeof userOverride.visible === "boolean") return userOverride.visible;

  const rolesVisible = getRolesFieldValue(user, moduleKey, "visible");
  if (rolesVisible !== null) return rolesVisible;

  return defaultVisible(user, moduleKey);
}

// Módulos donde, a falta de un override explícito, solo el equipo
// estratégico puede editar (todos pueden verlos, pero no modificarlos) —
// Organigrama por pedido explícito del usuario: cualquiera puede consultarlo,
// solo Director/PM/Coordinador SIG/Analista de Procesos lo modifica.
const STRATEGIC_TEAM_ONLY_EDIT_MODULES = ["organigrama"];

// Default de edición: hoy ningún módulo bloquea la edición salvo las reglas
// específicas de Balance de Carga (ver hasWorkloadFullAccess /
// canEditWorkloadPendingActivities más abajo) y los módulos listados arriba.
// Para el resto, "editar" solo cambia de comportamiento si hay un override
// explícito (de usuario o de algún rol aplicable).
export function canEditModule(user, moduleKey) {
  const userOverride = getUserModuleOverride(user, moduleKey);
  if (userOverride && typeof userOverride.editar === "boolean") return userOverride.editar;

  const rolesEditar = getRolesFieldValue(user, moduleKey, "editar");
  if (rolesEditar !== null) return rolesEditar;

  if (STRATEGIC_TEAM_ONLY_EDIT_MODULES.includes(moduleKey)) return isStrategicTeamMember(user);

  return true;
}

// Diseño Organizacional: si el usuario/rol tiene una excepción explícita de
// "editar" (por usuario o por rol), esa excepción manda para TODOS los
// procesos (permite dar acceso total a alguien, ej. Administrador). Si no hay
// ninguna excepción explícita, el default deja de ser "editar todo" — pasa a
// ser "solo puede editar el/los procesos de los que es responsable/dueño",
// y ve el resto en modo lectura.
export function canEditProcess(user, process) {
  const userOverride = getUserModuleOverride(user, "capacity");
  if (userOverride && typeof userOverride.editar === "boolean") return userOverride.editar;

  const rolesEditar = getRolesFieldValue(user, "capacity", "editar");
  if (rolesEditar !== null) return rolesEditar;

  return isProcessOwner(user, process);
}

// Aprobar/auditar un subproceso es distinto de poder editarlo: un
// responsable de proceso puede editar sus propios subprocesos, pero solo el
// equipo estratégico valida (aprueba/audita) el diseño, sin importar de
// quién sea el proceso.
export function canApproveOrAuditProcess(user) {
  const userOverride = getUserModuleOverride(user, "capacity");
  if (userOverride && typeof userOverride.aprobar === "boolean") return userOverride.aprobar;

  const rolesAprobar = getRolesFieldValue(user, "capacity", "aprobar");
  if (rolesAprobar !== null) return rolesAprobar;

  const roles = getApplicableRoles(user);
  return roles.some((role) => STRATEGIC_TEAM_ROLES.includes(role));
}

// Compara nombres de persona tolerando diferencias de orden y acentos: en
// Supabase el mismo Cristian aparece como "Cristian García Hernández"
// (procesos.responsable) y como "GARCIA HERNANDEZ CRISTIAN" (personas.nombre).
// Se compara por el conjunto de palabras normalizado, no por igualdad exacta.
function normalizeNameWords(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function isProcessOwner(user, process) {
  const ownerName = normalizeNameWords(process?.owner || process?.responsable || process?.responsible);
  if (!ownerName) return false;

  const candidateNames = [user?.persona_nombre, user?.nombre].filter(Boolean).map(normalizeNameWords);
  return candidateNames.includes(ownerName);
}

// Pertenencia al equipo estratégico (PM, Coordinador SIG, Analista de
// Procesos, Director General), sin overrides — para decisiones simples como
// qué recurso (video/manual) mostrarle a un usuario según su rol.
export function isStrategicTeamMember(user) {
  const roles = getApplicableRoles(user);
  return roles.some((role) => STRATEGIC_TEAM_ROLES.includes(role));
}

// Usado solo para decidir a dónde aterriza cada quien al entrar al portal
// (ver AppRouter): Centro de Decisiones es la vista de arranque exclusiva de
// Director General, el resto del equipo estratégico entra por Balance de
// Carga.
export function isDirectorGeneral(user) {
  const roles = getApplicableRoles(user);
  return roles.includes("Director General");
}

// Edición del tablero Estratégico de Desempeño Organizacional: decisión
// explícita del usuario de restringirla a estas dos personas puntuales
// (Alejandro García Hernández y Cristian García Hernández), no a un rol —
// el resto del equipo estratégico conserva acceso de solo lectura.
const STRATEGIC_KPI_EDITOR_PERSONA_IDS = [14, 15];

export function canEditStrategicKpis(user) {
  return STRATEGIC_KPI_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Permisos por pestaña de S&OP — un solo dueño por pestaña (además del
// equipo estratégico, que siempre ve y edita todo vía isStrategicTeamMember
// arriba de cada función). Decisión explícita: Ventas = solo Brisa,
// Operaciones y MPS = solo Hugo, Inventarios = solo Kevin (Coordinador de
// Inventarios), Financiero = solo Samantha. El resto de las pestañas del
// módulo (Dashboard, Control S&OP, Acuerdos S&OP, Prioridades, Histórico)
// quedan de solo lectura para cualquiera fuera del equipo estratégico —
// ver SopModule.jsx, variable canEditGeneral.
const SOP_OPERACION_EDITOR_PERSONA_IDS = [13];

export function canEditSopOperacionParams(user) {
  if (isStrategicTeamMember(user)) return true;
  return SOP_OPERACION_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Parámetros S&OP, sección "Márgenes y finanzas" (lo que alimenta Plan
// financiero): Samantha (Finanzas) más el equipo estratégico.
const SOP_FINANCIERO_EDITOR_PERSONA_IDS = [7];

export function canEditSopFinancieroParams(user) {
  if (isStrategicTeamMember(user)) return true;
  return SOP_FINANCIERO_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Plan de venta S&OP: solo Gerente Comercial (Brisa) captura piezas y
// precio, más el equipo estratégico.
const SOP_PLAN_VENTA_EDITOR_PERSONA_IDS = [26];

export function canEditSopPlanVenta(user) {
  if (isStrategicTeamMember(user)) return true;
  return SOP_PLAN_VENTA_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Inventarios S&OP: solo Kevin (Coordinador de Inventarios) captura el
// saldo, más el equipo estratégico.
const SOP_INVENTARIOS_EDITOR_PERSONA_IDS = [5];

export function canEditSopInventarios(user) {
  if (isStrategicTeamMember(user)) return true;
  return SOP_INVENTARIOS_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Botón "+ Solicitud" dentro de S&OP: quién puede mandar una solicitud
// directo a la Bandeja del Centro de Decisiones sin tener acceso al módulo
// completo de Centro de Decisiones (que sigue siendo solo equipo estratégico).
const SOP_SOLICITUD_PERSONA_IDS = [13, 7, 26, 5];

export function canCreateSopSolicitud(user) {
  return SOP_SOLICITUD_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Firmas del ciclo S&OP (VEN-SP-03): quién puede aprobar/rechazar cada una
// de las 4 etapas del BPMN. Reutiliza los mismos IDs por rol que ya se usan
// en Parámetros/Plan de venta — "ejecutivo" (Dirección) es solo Alejandro,
// igual que el resto de las decisiones exclusivas de Dirección en el portal.
const SOP_ETAPA_EDITOR_PERSONA_IDS = {
  comercial: SOP_PLAN_VENTA_EDITOR_PERSONA_IDS,
  operativo: SOP_OPERACION_EDITOR_PERSONA_IDS,
  financiero: SOP_FINANCIERO_EDITOR_PERSONA_IDS,
  ejecutivo: [14],
};

export function canApproveSopEtapa(user, etapa) {
  if (isStrategicTeamMember(user)) return true;
  const ids = SOP_ETAPA_EDITOR_PERSONA_IDS[etapa] || [];
  return ids.includes(Number(user?.persona_id));
}

// Acciones de Mejora: el nivel de la acción determina quién la
// edita. Estratégica/Táctica → equipo estratégico (Dirección, PM,
// Coordinador SIG, Analista de Procesos — mismos STRATEGIC_TEAM_ROLES ya
// usados en el resto del portal). Operativa → además el responsable real
// del proceso vinculado (mismo criterio que canEditProcess/isProcessOwner
// en Diseño Organizacional). Y, sin importar el nivel, quien planteó el
// problema (created_by_persona_id) siempre puede seguir editándolo y hacer
// su propio análisis de causa — la idea es que el análisis lo genere quien
// vivió el problema, no solo quien tenga un permiso más amplio. Además,
// quien creó la acción puede asignar a alguien más como responsable de
// participar en el análisis (analisis_responsable_persona_id) — pensado
// para casos donde dos áreas tienen versiones distintas de la misma causa
// (ej. RH y Producción) y ambas necesitan poder escribir en el mismo
// Ishikawa, no solo quien lo creó. `proceso` es el objeto de procesos (con
// su campo `responsable`) ya cargado por el módulo, no se vuelve a
// consultar.
function esResponsableAnalisis(user, accion) {
  const ids = Array.isArray(accion?.analisis_responsable_persona_id) ? accion.analisis_responsable_persona_id : [];
  return ids.map(Number).includes(Number(user?.persona_id));
}

// Auxiliares y supervisores pueden REPORTAR ("+ Reportar problema") pero su
// alcance termina ahí — no siguen el análisis de causa ni el plan de acción
// aunque hayan sido quienes la crearon. Por diseño explícito: el módulo no
// es un buzón de quejas donde el mismo reportante empuja el caso, sino que
// el análisis y la resolución los lleva quien tiene el proceso a su cargo o
// el equipo estratégico. Para cualquier otro rol, quien creó el reporte sí
// puede seguir editándolo (ver nota arriba de esResponsableAnalisis).
export function canEditAccion(user, accion, proceso) {
  if (!accion) return false;
  if (isStrategicTeamMember(user)) return true;
  const puedeSeguirPorHaberlaCreado = Number(user?.persona_id) === Number(accion.created_by_persona_id) && !isOperativeRole(user);
  if (puedeSeguirPorHaberlaCreado) return true;
  if (esResponsableAnalisis(user, accion)) return true;
  if (accion.nivel === "Operativa" && proceso) return isProcessOwner(user, proceso);
  return false;
}

// Aprobar una acción (pasar a "Aprobada") queda reservado al Director
// General — es la firma de que la acción propuesta, ya con su causa raíz
// identificada, se autoriza a convertirse en proyecto o asignación real.
export function canApproveAction(user) {
  return isDirectorGeneral(user);
}

// "¿Esto me toca a mí?" — más amplio que canEditAccion (que además admite
// operativa+dueño de proceso como regla de edición, e ignora nivel para el
// creador). Aquí no se decide permiso de edición sino pertenencia: alimenta
// el toggle "Mis acciones" de ActionsModule.jsx para que un líder vea de
// entrada lo suyo — lo que creó, lo que le asignaron como responsable (de
// ejecución o de participar en el análisis), o lo que le compete por ser
// dueño del proceso afectado — aunque alguien más lo haya levantado.
export function esParticipanteAccion(user, accion, proceso) {
  if (!accion) return false;
  if (Number(user?.persona_id) === Number(accion.created_by_persona_id)) return true;
  if (Number(user?.persona_id) === Number(accion.responsable_persona_id)) return true;
  if (esResponsableAnalisis(user, accion)) return true;
  if (proceso && isProcessOwner(user, proceso)) return true;
  return false;
}

export function hasWorkloadFullAccess(user) {
  const userOverride = getUserModuleOverride(user, "workload-balance");
  if (userOverride && typeof userOverride.editar === "boolean") return userOverride.editar;

  const rolesEditar = getRolesFieldValue(user, "workload-balance", "editar");
  if (rolesEditar !== null) return rolesEditar;

  const roles = getApplicableRoles(user);
  return roles.some((role) => WORKLOAD_FULL_ACCESS_ROLES.includes(role));
}

// Balance de Carga: excepción puntual para que Beatriz (Gerente de Calidad,
// persona_id 11) pueda editar la carga de trabajo de las Inspectoras de
// Calidad (sus subordinadas directas) sin darle acceso total a la carga de
// todas las personas de la organización. Decisión explícita del usuario,
// igual criterio que STRATEGIC_KPI_EDITOR_PERSONA_IDS más arriba: una
// excepción por persona, no un rol general de "supervisor edita a su equipo".
const WORKLOAD_SCOPED_EDITORS = {
  11: ["Inspector de Calidad"], // RUIZ CARREON BEATRIZ → persona_roles.rol de Laura y Sulidey
  5: ["Supervisor de Almacén"], // HERNANDO GONZALEZ KEVYN (Kevin) → persona_roles.rol de Erika y Erick (unificado 01/09/2026, antes eran 2 roles distintos)
  3: ["Chofer-Repartidor"], // HERNANDEZ ESCOBEDO EDUARDO (Coordinador de Distribución) → persona_roles.rol de su equipo de reparto
  13: ["Supervisor de Área"], // TERRONES TAPIA HUGO (Gerente de operaciones) → persona_roles.rol de sus supervisores de "Planeación y control de la producción" (Martín Cisneros, José Guadalupe Hernández, Sandra Neri, Joseline Orduña); ese texto de rol solo existe en ese proceso (07/09/2026)
};

// Respaldo por persona_id (no por texto de rol) para quien no tiene ningún
// persona_roles activo que matchear — ej. Laura, que se quedó sin rol de
// Diseño Organizacional a propósito (ver AccionesModule/WorkloadBalance) y
// cuya carga real se captura como bloques manuales. El texto de un rol
// puede cambiar (como ya pasó arriba con Kevin) y romper el permiso sin
// avisar; esto no depende de ese texto.
const WORKLOAD_SCOPED_EDITOR_PERSONAS = {
  5: [23], // Kevin → Laura Alvarado Sámano
  13: [29], // Hugo Terrones → Sofía Benítez Chávez (Auxiliar de Embalaje), sin persona_roles activo que matchear
};

// `targetPersonRoles` son los `persona_roles.rol` (activos) de la persona
// cuya carga se quiere editar — ya cargados por WorkloadBalanceModule, no se
// vuelven a consultar aquí. `targetPersonId` es opcional, para el respaldo
// por persona cuando no hay rol activo que matchear.
export function canEditWorkloadForPersonRoles(user, targetPersonRoles = [], targetPersonId = null) {
  const userId = Number(user?.persona_id);
  const allowedRoles = WORKLOAD_SCOPED_EDITORS[userId];
  if (allowedRoles && targetPersonRoles.some((rol) => allowedRoles.includes(rol))) return true;
  const allowedPersonas = WORKLOAD_SCOPED_EDITOR_PERSONAS[userId];
  if (allowedPersonas && targetPersonId != null && allowedPersonas.includes(Number(targetPersonId))) return true;
  return false;
}

// Desempeño Operativo: cada área la edita únicamente su propio supervisor
// (identificado por persona_id — su puesto real es "Supervisor de costura/
// Carpintería/tapicería" en Catálogo Organizacional), más Hugo Terrones
// como Coordinador de Producción sobre las 3 áreas, más el equipo
// estratégico como respaldo. Confirmado explícitamente por el usuario
// (23/09/2026).
const DESEMPENO_OPERATIVO_AREA_OWNERS = {
  27: "Corte y costura de tela", // ORDUÑA PEÑA JOSELINE — Supervisor de costura
  2: "Carpintería y armado de madera", // HERNÁNDEZ DURÁN JOSE GUADALUPE — Supervisor de Carpintería
  8: "Tapicería", // NERI HERNANDEZ SANDRA EVELYN — Supervisor de tapicería
};
const DESEMPENO_OPERATIVO_COORDINADOR_IDS = [13]; // TERRONES TAPIA HUGO — Coordinador de Producción

export function canEditDesempenoOperativoArea(user, area) {
  if (isStrategicTeamMember(user)) return true;
  const personaId = Number(user?.persona_id);
  if (DESEMPENO_OPERATIVO_COORDINADOR_IDS.includes(personaId)) return true;
  return DESEMPENO_OPERATIVO_AREA_OWNERS[personaId] === area;
}

// Área por defecto al abrir el módulo para un supervisor (no equipo
// estratégico ni Hugo, que ven todas): su propia área, si tiene una.
export function getOwnDesempenoOperativoArea(user) {
  return DESEMPENO_OPERATIVO_AREA_OWNERS[Number(user?.persona_id)] || null;
}

// Tablero Gerencial de Proyectos (PMO): por pedido explícito, solo PM y
// Director General pueden editar — el resto del equipo estratégico
// (Coordinador SIG, Analista de Procesos) y el líder de proyecto asignado a
// su propia fila ya NO tienen edición, solo lectura. `proyecto` se conserva
// en la firma sin usarse para no tener que tocar cada sitio donde se llama.
const PMO_PROYECTOS_EDIT_ROLES = ["PM", "Director General"];
export function canEditPmoProyecto(user, _proyecto) {
  const roles = getApplicableRoles(user);
  return roles.some((role) => PMO_PROYECTOS_EDIT_ROLES.includes(role));
}

// Control de Cambios SIG (SIG-P-03): cualquier usuario logueado puede
// levantar una solicitud (colaborador o líder de proceso, según el
// procedimiento) — no se gatea la creación. Evaluar el impacto y resolver
// la aprobación sí quedan reservados al equipo estratégico (que incluye a
// Coordinador SIG y Director General). Implementar/dar seguimiento lo hace
// el equipo estratégico o la persona asignada como responsable de
// implementación de ese cambio puntual.
export function canEvaluateCambio(user) {
  return isStrategicTeamMember(user);
}

export function canApproveCambio(user) {
  return isStrategicTeamMember(user);
}

export function canImplementCambio(user, cambio) {
  if (isStrategicTeamMember(user)) return true;
  if (!cambio?.responsable_implementacion_persona_id) return false;
  return String(user?.persona_id) === String(cambio.responsable_implementacion_persona_id);
}

export function canEditWorkloadPendingActivities(user) {
  const userOverride = getUserModuleOverride(user, "workload-balance");
  if (userOverride && typeof userOverride.editar === "boolean") return userOverride.editar;

  const rolesEditar = getRolesFieldValue(user, "workload-balance", "editar");
  if (rolesEditar !== null) return rolesEditar;

  const roles = getApplicableRoles(user);
  return roles.some((role) =>
    WORKLOAD_PENDING_ACTIVITY_EDIT_ROLES.some(
      (allowedRole) => normalizeRoleText(allowedRole) === normalizeRoleText(role)
    )
  );
}
