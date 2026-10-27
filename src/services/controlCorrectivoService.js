import { supabase } from "./supabase";

// Módulo Control Correctivo: seguimiento de acciones correctivas por proceso
// (tabla `control_correctivo`, ver sql/2026-10-control_correctivo.sql).

export const TIPOS_BRECHA = ["Operativa", "Competencias", "Financiera"];
export const PRIORIDADES = ["Alta", "Media", "Baja"];

const TABLA = "control_correctivo";
const ROL_LIDER = "Líder de proceso";

// Líderes de proceso en este módulo: pedido de la PM (26-oct-2026) — Hugo
// Terrones (persona 13) ya no se ofrece y Alejandro García (persona 14), que
// no tiene el rol "Líder de proceso" en persona_roles, sí. Es un ajuste solo de
// este módulo: no toca persona_roles, que usan otros módulos y permisos.
const LIDERES_QUITAR_IDS = [13];
const LIDERES_AGREGAR_IDS = [14];

// Columnas agregadas por sql/2026-10-control_correctivo_v2.sql. Mientras no se
// ejecute ese SQL, el módulo sigue funcionando sin ellas y avisa.
const COLUMNAS_NUEVAS = "nombre_accion,procesos_involucrados_ids,todos_procesos,directrices_ids";

function esColumnaFaltante(error) {
  const texto = `${error?.message || ""}`.toLowerCase();
  return error?.code === "42703" || error?.code === "PGRST204" || (texto.includes("column") && (texto.includes("does not exist") || texto.includes("could not find")));
}

// ¿Ya existen las columnas nuevas (nombre, procesos involucrados, directrices)?
export async function probarColumnasNuevas() {
  const { error } = await supabase.from(TABLA).select(COLUMNAS_NUEVAS).limit(1);
  if (!error) return true;
  if (!esColumnaFaltante(error) && !esTablaFaltante(error)) console.error("Error al comprobar las columnas nuevas de Control Correctivo:", error);
  return false;
}

// Directrices estratégicas = objetivos del Despliegue Estratégico (GLOBAL y OBJ-xx).
export async function getDirectricesCorrectivo() {
  const { data, error } = await supabase
    .from("despliegue_objetivos")
    .select("id,codigo,titulo,perspectiva")
    .eq("activo", true)
    .order("orden", { ascending: true });
  if (error) {
    console.error("Error al cargar las directrices estratégicas:", error);
    return [];
  }
  return data || [];
}

// La tabla la crea el usuario con un SQL aparte; mientras no exista, el módulo
// avisa en vez de mostrar un error técnico.
function esTablaFaltante(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || texto.includes("does not exist") || texto.includes("schema cache");
}

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

export function hoyISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// El estado no es una columna: se calcula con el avance y la fecha compromiso.
export function estadoCorrectivo(item, hoy = hoyISO()) {
  if (Number(item?.avance) >= 100) return "Completada";
  if (item?.fecha_compromiso && item.fecha_compromiso < hoy) return "Vencida";
  return "En curso";
}

// personas.nombre viene como "APELLIDOS NOMBRE" en mayúsculas.
export function formatNombre(nombre) {
  const chicas = ["de", "del", "la", "las", "los", "y"];
  return String(nombre || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && chicas.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function palabrasNormalizadas(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

// "Cristian García Hernández" (catálogo de procesos) y "GARCIA HERNANDEZ
// CRISTIAN" (personas) son la misma persona: se comparan sus palabras sin
// acentos y sin importar el orden.
export function mismaPersona(nombreA, nombreB) {
  const a = palabrasNormalizadas(nombreA);
  return a !== "" && a === palabrasNormalizadas(nombreB);
}

export async function getProcesosCorrectivo() {
  const { data, error } = await supabase
    .from("procesos")
    .select("id,nombre,responsable")
    .eq("activo", true)
    .order("id", { ascending: true });
  if (error) {
    console.error("Error al cargar procesos de Control Correctivo:", error);
    return [];
  }
  return data || [];
}

// Líderes = personas con el rol "Líder de proceso"; supervisores = personas
// cuyo rol empieza con "Supervisor" (Supervisor de Área, de Embalaje, etc.).
export async function getPersonasCorrectivo() {
  const [personasRes, rolesRes] = await Promise.all([
    supabase.from("personas").select("id,nombre,activo").order("nombre", { ascending: true }),
    supabase.from("persona_roles").select("persona_id,rol,activo"),
  ]);
  if (personasRes.error) console.error("Error al cargar personas de Control Correctivo:", personasRes.error);
  if (rolesRes.error) console.error("Error al cargar roles de Control Correctivo:", rolesRes.error);

  // "LIDERES DE PROCESO" es un registro genérico del catálogo, no una persona: no se ofrece como responsable.
  const personas = (personasRes.data || []).filter((p) => p.activo !== false && !/^l[ií]deres de/i.test(String(p.nombre || "").trim())).map((p) => ({ id: p.id, nombre: formatNombre(p.nombre), nombreOriginal: p.nombre }));
  const rolesActivos = (rolesRes.data || []).filter((r) => r.activo !== false);
  const idsLider = new Set(rolesActivos.filter((r) => String(r.rol || "").trim().toLowerCase() === ROL_LIDER.toLowerCase()).map((r) => r.persona_id));
  const idsSupervisor = new Set(rolesActivos.filter((r) => String(r.rol || "").trim().toLowerCase().startsWith("supervisor")).map((r) => r.persona_id));

  return {
    personas,
    lideres: personas.filter((p) => (idsLider.has(p.id) && !LIDERES_QUITAR_IDS.includes(Number(p.id))) || LIDERES_AGREGAR_IDS.includes(Number(p.id))),
    supervisores: personas.filter((p) => idsSupervisor.has(p.id)),
  };
}

export async function getCorrectivos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select("*")
    .eq("activo", true)
    .order("fecha_compromiso", { ascending: true });
  if (error) {
    if (esTablaFaltante(error)) return { data: [], tablaFaltante: true, error: null };
    console.error("Error al cargar acciones correctivas:", error);
    return { data: [], tablaFaltante: false, error };
  }
  return { data: data || [], tablaFaltante: false, error: null };
}

const aIds = (lista) => [...new Set((lista || []).map(Number).filter((n) => Number.isFinite(n)))];

// `extendido` = ya existen las columnas nuevas; si no, esos campos no se envían.
function limpiar(payload, extendido = false) {
  const nuevos = extendido
    ? {
        nombre_accion: payload.nombre_accion?.trim() || null,
        todos_procesos: Boolean(payload.todos_procesos),
        procesos_involucrados_ids: payload.todos_procesos ? [] : aIds(payload.procesos_involucrados_ids),
        directrices_ids: aIds(payload.directrices_ids),
      }
    : {};
  return {
    ...nuevos,
    proceso_id: Number(payload.proceso_id),
    tipo_brecha: payload.tipo_brecha,
    causa_raiz: payload.causa_raiz?.trim() || null,
    accion_correctiva: payload.accion_correctiva?.trim(),
    lider_persona_id: payload.lider_persona_id ? Number(payload.lider_persona_id) : null,
    supervisor_persona_id: payload.supervisor_persona_id ? Number(payload.supervisor_persona_id) : null,
    prioridad: payload.prioridad,
    fecha_inicio: payload.fecha_inicio,
    fecha_compromiso: payload.fecha_compromiso,
    avance: Math.max(0, Math.min(100, Math.round(Number(payload.avance) || 0))),
    eficiencia_operativa: payload.eficiencia_operativa?.trim() || null,
  };
}

export async function createCorrectivo(payload, actor, extendido = false) {
  const { personaId, nombre } = actorFields(actor);
  const { data, error } = await supabase
    .from(TABLA)
    .insert({ ...limpiar(payload, extendido), created_by_persona_id: personaId, created_by_nombre: nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `cambios` puede ser parcial (por ejemplo solo { avance } al mover la barra).
export async function updateCorrectivo(id, cambios, actor, extendido = false) {
  const { personaId, nombre } = actorFields(actor);
  const completo = Object.keys(cambios).length > 1 || !("avance" in cambios);
  const cuerpo = completo ? limpiar(cambios, extendido) : { avance: Math.max(0, Math.min(100, Math.round(Number(cambios.avance) || 0))) };
  const { data, error } = await supabase
    .from(TABLA)
    .update({ ...cuerpo, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// No borra la fila: solo la marca inactiva.
export async function deactivateCorrectivo(id, actor) {
  const { personaId, nombre } = actorFields(actor);
  const { error } = await supabase
    .from(TABLA)
    .update({ activo: false, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
    .eq("id", id);
  if (error) throw error;
}
