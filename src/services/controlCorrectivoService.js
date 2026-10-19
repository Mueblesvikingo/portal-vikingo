import { supabase } from "./supabase";

// Módulo Control Correctivo: seguimiento de acciones correctivas por proceso
// (tabla `control_correctivo`, ver sql/2026-10-control_correctivo.sql).

export const TIPOS_BRECHA = ["Operativa", "Competencias", "Financiera"];
export const PRIORIDADES = ["Alta", "Media", "Baja"];

const TABLA = "control_correctivo";
const ROL_LIDER = "Líder de proceso";

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
    lideres: personas.filter((p) => idsLider.has(p.id)),
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

function limpiar(payload) {
  return {
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

export async function createCorrectivo(payload, actor) {
  const { personaId, nombre } = actorFields(actor);
  const { data, error } = await supabase
    .from(TABLA)
    .insert({ ...limpiar(payload), created_by_persona_id: personaId, created_by_nombre: nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `cambios` puede ser parcial (por ejemplo solo { avance } al mover la barra).
export async function updateCorrectivo(id, cambios, actor) {
  const { personaId, nombre } = actorFields(actor);
  const completo = Object.keys(cambios).length > 1 || !("avance" in cambios);
  const cuerpo = completo ? limpiar(cambios) : { avance: Math.max(0, Math.min(100, Math.round(Number(cambios.avance) || 0))) };
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
