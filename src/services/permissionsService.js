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

function defaultVisible(user, moduleKey) {
  if (MODULES_HIDDEN_BY_DEFAULT.includes(moduleKey)) return false;

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

// Default de edición: hoy ningún módulo bloquea la edición salvo las reglas
// específicas de Balance de Carga (ver hasWorkloadFullAccess /
// canEditWorkloadPendingActivities más abajo). Para el resto de los módulos,
// "editar" solo cambia de comportamiento si hay un override explícito (de
// usuario o de algún rol aplicable).
export function canEditModule(user, moduleKey) {
  const userOverride = getUserModuleOverride(user, moduleKey);
  if (userOverride && typeof userOverride.editar === "boolean") return userOverride.editar;

  const rolesEditar = getRolesFieldValue(user, moduleKey, "editar");
  if (rolesEditar !== null) return rolesEditar;

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

// Edición del tablero Estratégico de Desempeño Organizacional: decisión
// explícita del usuario de restringirla a estas dos personas puntuales
// (Alejandro García Hernández y Cristian García Hernández), no a un rol —
// el resto del equipo estratégico conserva acceso de solo lectura.
const STRATEGIC_KPI_EDITOR_PERSONA_IDS = [14, 15];

export function canEditStrategicKpis(user) {
  return STRATEGIC_KPI_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Parámetros S&OP, sección "Capacidad y mezcla" / "Factores de consumo de
// tapicería" (lo que alimenta Plan de operación): decisión explícita de
// restringirlo a Director General (Alejandro) y Gerente de Operaciones
// (Hugo), más el equipo estratégico (PM, Coordinador SIG, Analista de
// Procesos, Director General).
const SOP_OPERACION_EDITOR_PERSONA_IDS = [14, 13];

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

// Plan de venta S&OP: solo Director General (Alejandro) y Gerente Comercial
// (Brisa) capturan piezas y precio, más el equipo estratégico (PM,
// Coordinador SIG, Analista de Procesos, Director General) — el resto del
// equipo con acceso a S&OP (Hugo, Beatriz, Kevin, Samantha) ve el módulo
// pero no edita esta pestaña en particular.
const SOP_PLAN_VENTA_EDITOR_PERSONA_IDS = [14, 26];

export function canEditSopPlanVenta(user) {
  if (isStrategicTeamMember(user)) return true;
  return SOP_PLAN_VENTA_EDITOR_PERSONA_IDS.includes(Number(user?.persona_id));
}

// Botón "+ Solicitud" dentro de S&OP: quién puede mandar una solicitud
// directo a la Bandeja del Centro de Decisiones sin tener acceso al módulo
// completo de Centro de Decisiones (que sigue siendo solo equipo estratégico).
const SOP_SOLICITUD_PERSONA_IDS = [13, 7, 26];

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

// Centro de Gestión de Acciones: el nivel de la acción determina quién la
// edita. Estratégica/Táctica → equipo estratégico (Dirección, PM,
// Coordinador SIG, Analista de Procesos — mismos STRATEGIC_TEAM_ROLES ya
// usados en el resto del portal). Operativa → además el responsable real
// del proceso vinculado (mismo criterio que canEditProcess/isProcessOwner
// en Diseño Organizacional). `proceso` es el objeto de procesos (con su
// campo `responsable`) ya cargado por el módulo, no se vuelve a consultar.
export function canEditAccion(user, accion, proceso) {
  if (!accion) return false;
  if (isStrategicTeamMember(user)) return true;
  if (accion.nivel === "Operativa" && proceso) return isProcessOwner(user, proceso);
  return false;
}

// Aprobar una acción (pasar a "Aprobada") es más restrictivo que editarla —
// hoy solo el equipo estratégico, sin importar el nivel (igual que
// canApproveOrAuditProcess para subprocesos).
export function canApproveAction(user) {
  return isStrategicTeamMember(user);
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
  5: ["Auxiliar de Almacén", "Responsable / Encargado de Almacén"], // HERNANDO GONZALEZ KEVYN (Kevin) → persona_roles.rol de Erika y Erick
  3: ["Chofer-Repartidor"], // HERNANDEZ ESCOBEDO EDUARDO (Coordinador de Distribución) → persona_roles.rol de su equipo de reparto
};

// `targetPersonRoles` son los `persona_roles.rol` (activos) de la persona
// cuya carga se quiere editar — ya cargados por WorkloadBalanceModule, no se
// vuelven a consultar aquí.
export function canEditWorkloadForPersonRoles(user, targetPersonRoles = []) {
  const allowedRoles = WORKLOAD_SCOPED_EDITORS[Number(user?.persona_id)];
  if (!allowedRoles) return false;
  return targetPersonRoles.some((rol) => allowedRoles.includes(rol));
}

// Tablero Gerencial de Proyectos (PMO): el equipo estratégico edita
// cualquier fila; el líder de proyecto asignado a esa fila puede editar
// solo la suya (avance, semáforo, etapa, próximo hito, decisión) — mismo
// criterio de "auto-servicio sobre lo propio" que Diagnóstico SIG.
export function canEditPmoProyecto(user, proyecto) {
  if (isStrategicTeamMember(user)) return true;
  if (!proyecto?.lider_proyecto_persona_id) return false;
  return String(user?.persona_id) === String(proyecto.lider_proyecto_persona_id);
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
