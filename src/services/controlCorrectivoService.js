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

// Selección múltiple de proceso, líder y supervisor (sql/2026-10-control_correctivo_v4.sql).
// Mientras no exista, el formulario sigue con un solo valor por campo.
const COLUMNAS_MULTIPLES = "procesos_ids,lideres_ids,supervisores_ids";

export async function probarColumnasMultiples() {
  const { error } = await supabase.from(TABLA).select(COLUMNAS_MULTIPLES).limit(1);
  if (!error) return true;
  if (!esColumnaFaltante(error) && !esTablaFaltante(error)) console.error("Error al comprobar la selección múltiple de Control Correctivo:", error);
  return false;
}

// Listas de una acción; las registradas antes de v4 solo tienen la columna de un valor.
export const procesosDe = (i) => (i?.procesos_ids?.length ? i.procesos_ids : i?.proceso_id != null ? [i.proceso_id] : []).map(Number);
export const lideresDe = (i) => (i?.lideres_ids?.length ? i.lideres_ids : i?.lider_persona_id != null ? [i.lider_persona_id] : []).map(Number);
export const supervisoresDe = (i) => (i?.supervisores_ids?.length ? i.supervisores_ids : i?.supervisor_persona_id != null ? [i.supervisor_persona_id] : []).map(Number);

// Directrices propias (sql/2026-10-control_correctivo_v3.sql): catálogo que se
// llena desde el formulario y se reutiliza entre acciones. Devuelve
// `disponible: false` mientras no exista la tabla o la columna de la acción.
const TABLA_DIRECTRICES = "control_correctivo_directrices";

export async function getDirectricesPropias() {
  const [lista, columna] = await Promise.all([
    supabase.from(TABLA_DIRECTRICES).select("id,nombre").eq("activo", true).order("nombre", { ascending: true }),
    supabase.from(TABLA).select("directrices_propias_ids").limit(1),
  ]);
  const error = lista.error || columna.error;
  if (error) {
    if (!esTablaFaltante(error) && !esColumnaFaltante(error)) console.error("Error al cargar las directrices propias:", error);
    return { data: [], disponible: false };
  }
  return { data: lista.data || [], disponible: true };
}

export async function createDirectrizPropia(nombre, actor) {
  const limpio = String(nombre || "").trim().replace(/\s+/g, " ");
  if (!limpio) throw new Error("Escribe la directriz.");
  const { personaId, nombre: autor } = actorFields(actor);
  const { data, error } = await supabase
    .from(TABLA_DIRECTRICES)
    .insert({ nombre: limpio, created_by_persona_id: personaId, created_by_nombre: autor })
    .select("id,nombre")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Esa directriz ya existe: búscala en la lista.");
    throw error;
  }
  return data;
}

// Objetivos estratégicos = objetivos del Despliegue Estratégico (GLOBAL y OBJ-xx); opcionales.
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

// Nombre de proceso comparable: persona_roles.proceso es texto libre y puede
// diferir de procesos.nombre en acentos o mayúsculas.
const claveProceso = (nombre) => String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Líderes = personas con el rol "Líder de proceso"; supervisores = personas
// cuyo rol empieza con "Supervisor" (Supervisor de Área, de Embalaje, etc.).
// `porProceso` (nombre de proceso normalizado → ids de persona) sirve para
// avisar a la gente de los procesos de una acción.
export async function getPersonasCorrectivo() {
  const [personasRes, rolesRes] = await Promise.all([
    supabase.from("personas").select("id,nombre,activo").order("nombre", { ascending: true }),
    supabase.from("persona_roles").select("persona_id,proceso,rol,activo"),
  ]);
  if (personasRes.error) console.error("Error al cargar personas de Control Correctivo:", personasRes.error);
  if (rolesRes.error) console.error("Error al cargar roles de Control Correctivo:", rolesRes.error);

  // "LIDERES DE PROCESO" es un registro genérico del catálogo, no una persona: no se ofrece como responsable.
  const personas = (personasRes.data || []).filter((p) => p.activo !== false && !/^l[ií]deres de/i.test(String(p.nombre || "").trim())).map((p) => ({ id: p.id, nombre: formatNombre(p.nombre), nombreOriginal: p.nombre }));
  const rolesActivos = (rolesRes.data || []).filter((r) => r.activo !== false);
  const idsLider = new Set(rolesActivos.filter((r) => String(r.rol || "").trim().toLowerCase() === ROL_LIDER.toLowerCase()).map((r) => r.persona_id));
  const idsSupervisor = new Set(rolesActivos.filter((r) => String(r.rol || "").trim().toLowerCase().startsWith("supervisor")).map((r) => r.persona_id));

  const activas = new Set(personas.map((p) => Number(p.id)));
  const porProceso = new Map();
  rolesActivos.forEach((r) => {
    const clave = claveProceso(r.proceso);
    if (!clave || !activas.has(Number(r.persona_id))) return;
    if (!porProceso.has(clave)) porProceso.set(clave, new Set());
    porProceso.get(clave).add(Number(r.persona_id));
  });

  return {
    personas,
    lideres: personas.filter((p) => (idsLider.has(p.id) && !LIDERES_QUITAR_IDS.includes(Number(p.id))) || LIDERES_AGREGAR_IDS.includes(Number(p.id))),
    supervisores: personas.filter((p) => idsSupervisor.has(p.id)),
    porProceso,
  };
}

// Quién recibe la alerta de una acción: sus líderes y supervisores, la gente
// con rol en sus procesos y en los procesos involucrados, y el responsable de
// cada uno de esos procesos. Con "Todos los procesos" solo se suma el
// responsable de cada proceso (no toda la plantilla). Nunca quien la registra.
export function destinatariosCorrectivo(item, { procesos = [], personas = [], porProceso = new Map() } = {}, excluirPersonaId = null) {
  const ids = new Set([...lideresDe(item), ...supervisoresDe(item)]);
  const responsableDe = (proceso) => personas.find((p) => mismaPersona(p.nombreOriginal, proceso?.responsable));
  const conGente = new Set([...procesosDe(item), ...(item?.todos_procesos ? [] : (item?.procesos_involucrados_ids || []).map(Number))]);
  procesos.forEach((proceso) => {
    const id = Number(proceso.id);
    if (conGente.has(id)) (porProceso.get(claveProceso(proceso.nombre)) || []).forEach((pid) => ids.add(pid));
    if (conGente.has(id) || item?.todos_procesos) {
      const responsable = responsableDe(proceso);
      if (responsable) ids.add(Number(responsable.id));
    }
  });
  if (excluirPersonaId != null) ids.delete(Number(excluirPersonaId));
  return [...ids].filter((n) => Number.isFinite(n));
}

// ---- Alertas (sql/2026-10-control_correctivo_v4.sql) ----------------------
const TABLA_NOTIF = "control_correctivo_notificaciones";

export async function probarNotificaciones() {
  const { error } = await supabase.from(TABLA_NOTIF).select("id").limit(1);
  if (!error) return true;
  if (!esTablaFaltante(error)) console.error("Error al comprobar las alertas de Control Correctivo:", error);
  return false;
}

// Avisa a quien todavía no tenga aviso de esta acción (al editar, solo a los
// que se agregan). Devuelve cuántos avisos nuevos se crearon.
export async function notificarCorrectivo(item, personaIds, actor) {
  const { personaId, nombre } = actorFields(actor);
  const { data: previos, error: errPrevios } = await supabase.from(TABLA_NOTIF).select("destinatario_persona_id").eq("correctivo_id", item.id).eq("motivo", "nueva_accion");
  if (errPrevios) throw errPrevios;
  const yaAvisados = new Set((previos || []).map((r) => Number(r.destinatario_persona_id)));
  const nuevos = [...new Set(personaIds.map(Number))].filter((id) => !yaAvisados.has(id));
  if (!nuevos.length) return 0;
  const titulo = item.nombre_accion?.trim() || item.accion_correctiva?.trim() || "Acción correctiva";
  const mensaje = `${titulo} — prioridad ${item.prioridad || "Media"}, compromiso ${item.fecha_compromiso}. Te incluyeron en esta acción correctiva.`;
  const filas = nuevos.map((destinatario) => ({
    correctivo_id: item.id,
    destinatario_persona_id: destinatario,
    motivo: "nueva_accion",
    mensaje,
    urgente: true,
    created_by_persona_id: personaId,
    created_by_nombre: nombre,
  }));
  // Insert simple: los ya avisados se filtraron arriba (v5 quitó la restricción
  // única general para permitir varios avisos de avance a la PM).
  const { error } = await supabase.from(TABLA_NOTIF).insert(filas);
  if (error) throw error;
  return filas.length;
}

// Involucrados de cada acción = quienes recibieron la alerta de acción nueva
// (líderes y supervisores se suman aparte con lideresDe/supervisoresDe).
// Devuelve Map correctivo_id → Set de persona_id.
export async function getAvisadosPorCorrectivo() {
  const { data, error } = await supabase.from(TABLA_NOTIF).select("correctivo_id,destinatario_persona_id").eq("motivo", "nueva_accion");
  if (error) {
    if (!esTablaFaltante(error)) console.error("Error al cargar los involucrados de Control Correctivo:", error);
    return new Map();
  }
  const mapa = new Map();
  (data || []).forEach((r) => {
    const id = Number(r.correctivo_id);
    if (!mapa.has(id)) mapa.set(id, new Set());
    mapa.get(id).add(Number(r.destinatario_persona_id));
  });
  return mapa;
}

// Estado de la alerta de acción nueva de cada involucrado: visto_en lleno = ya la vio
// (cerró la ventana emergente). Devuelve Map correctivo_id → Map persona_id → visto_en|null.
export async function getAlertasNuevaAccion() {
  const { data, error } = await supabase.from(TABLA_NOTIF).select("correctivo_id,destinatario_persona_id,visto_en").eq("motivo", "nueva_accion");
  if (error) {
    if (!esTablaFaltante(error)) console.error("Error al cargar el estado de las alertas de Control Correctivo:", error);
    return new Map();
  }
  const mapa = new Map();
  (data || []).forEach((r) => {
    const id = Number(r.correctivo_id);
    if (!mapa.has(id)) mapa.set(id, new Map());
    mapa.get(id).set(Number(r.destinatario_persona_id), r.visto_en || null);
  });
  return mapa;
}

// ---- Reportes de avance de los involucrados (sql/2026-10-control_correctivo_v5.sql)
const TABLA_AVANCES = "control_correctivo_avances";
const BUCKET_AVANCES = "control-correctivo-avances";
export const MAX_ARCHIVO_MB = 15;

export async function getAvancesEquipo() {
  const { data, error } = await supabase.from(TABLA_AVANCES).select("*").order("created_at", { ascending: true });
  if (error) {
    if (!esTablaFaltante(error)) console.error("Error al cargar los avances del equipo:", error);
    return { data: [], disponible: false };
  }
  return { data: data || [], disponible: true };
}

function nombreArchivoSeguro(nombre) {
  const limpio = String(nombre || "archivo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return limpio.slice(-80) || "archivo";
}

// Un reporte puede llevar barra (avance), "mi parte está lista" (listo),
// comentario y/o un archivo. Al guardarlo se avisa a la PM en la campanita
// (sin sirena), salvo que quien reporta sea la propia PM.
export async function reportarAvanceEquipo(item, { avance = null, listo = false, comentario = "", archivo = null }, actor, pmPersonaId) {
  const { personaId, nombre } = actorFields(actor);
  if (personaId == null) throw new Error("Tu usuario no tiene persona asignada: no se puede registrar el avance.");
  const texto = String(comentario || "").trim();
  if (avance == null && !listo && !texto && !archivo) throw new Error("Marca un avance, “mi parte está lista”, un comentario o un archivo.");
  if (archivo && archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_ARCHIVO_MB} MB.`);

  let adjunto = {};
  if (archivo) {
    const path = `correctivo-${item.id}/${personaId}-${Date.now()}-${nombreArchivoSeguro(archivo.name)}`;
    const { error: errSubida } = await supabase.storage.from(BUCKET_AVANCES).upload(path, archivo, { contentType: archivo.type || undefined });
    if (errSubida) throw errSubida;
    const { data: pub } = supabase.storage.from(BUCKET_AVANCES).getPublicUrl(path);
    adjunto = { archivo_url: pub.publicUrl, archivo_nombre: archivo.name, archivo_path: path };
  }

  const { data, error } = await supabase
    .from(TABLA_AVANCES)
    .insert({
      correctivo_id: item.id,
      persona_id: personaId,
      persona_nombre: nombre,
      avance: avance == null ? null : Math.max(0, Math.min(100, Math.round(Number(avance) || 0))),
      listo: Boolean(listo),
      comentario: texto || null,
      ...adjunto,
    })
    .select()
    .single();
  if (error) throw error;

  if (pmPersonaId != null && Number(pmPersonaId) !== Number(personaId)) {
    const titulo = item.nombre_accion?.trim() || item.accion_correctiva?.trim() || "Acción correctiva";
    const partes = [data.avance != null ? `${data.avance}%` : null, data.listo ? "su parte está lista" : null, data.archivo_url ? "adjuntó un archivo" : null].filter(Boolean);
    const { error: errAviso } = await supabase.from(TABLA_NOTIF).insert({
      correctivo_id: item.id,
      destinatario_persona_id: Number(pmPersonaId),
      motivo: "avance",
      mensaje: `${nombre || "Un involucrado"} reportó avance en “${titulo}”${partes.length ? `: ${partes.join(" · ")}` : ""}.`,
      urgente: false,
      created_by_persona_id: personaId,
      created_by_nombre: nombre,
    });
    if (errAviso) console.error("Error al avisar a la PM del avance reportado:", errAviso);
  }
  return data;
}

// Sondeo de la ventana emergente y la campanita. Mientras no exista la tabla
// devuelve [] sin escribir en la consola cada 25 s.
export async function getPendingCorrectivoNotificaciones(personaId) {
  if (!personaId) return [];
  const { data, error } = await supabase
    .from(TABLA_NOTIF)
    .select("*, control_correctivo(nombre_accion, accion_correctiva, prioridad, fecha_compromiso, activo)")
    .eq("destinatario_persona_id", personaId)
    .is("visto_en", null)
    .order("created_at", { ascending: true });
  if (error) {
    if (!esTablaFaltante(error)) console.error("Error al cargar alertas de Control Correctivo:", error);
    return [];
  }
  return (data || []).filter((n) => n.control_correctivo?.activo !== false);
}

export async function marcarCorrectivoNotificacionVista(id) {
  const { error } = await supabase.from(TABLA_NOTIF).update({ visto_en: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("Error al marcar la alerta de Control Correctivo como vista:", error);
    return { ok: false };
  }
  return { ok: true };
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

// `extendido` = ya existen las columnas de v2; `propias` = la de v3;
// `multiples` = las listas de v4. Si no existen, esos campos no se envían.
// Con listas, las columnas de un valor guardan el primero de cada una.
function limpiar(payload, extendido = false, propias = false, multiples = false) {
  const nuevos = extendido
    ? {
        nombre_accion: payload.nombre_accion?.trim() || null,
        todos_procesos: Boolean(payload.todos_procesos),
        procesos_involucrados_ids: payload.todos_procesos ? [] : aIds(payload.procesos_involucrados_ids),
        directrices_ids: aIds(payload.directrices_ids),
      }
    : {};
  if (propias) nuevos.directrices_propias_ids = aIds(payload.directrices_propias_ids);
  if (multiples) {
    nuevos.procesos_ids = aIds(payload.procesos_ids);
    nuevos.lideres_ids = aIds(payload.lideres_ids);
    nuevos.supervisores_ids = aIds(payload.supervisores_ids);
  }
  const primero = (lista, unico) => (multiples ? (aIds(lista)[0] ?? null) : unico ? Number(unico) : null);
  return {
    ...nuevos,
    proceso_id: primero(payload.procesos_ids, payload.proceso_id),
    tipo_brecha: payload.tipo_brecha,
    causa_raiz: payload.causa_raiz?.trim() || null,
    accion_correctiva: payload.accion_correctiva?.trim(),
    lider_persona_id: primero(payload.lideres_ids, payload.lider_persona_id),
    supervisor_persona_id: primero(payload.supervisores_ids, payload.supervisor_persona_id),
    prioridad: payload.prioridad,
    fecha_inicio: payload.fecha_inicio,
    fecha_compromiso: payload.fecha_compromiso,
    avance: Math.max(0, Math.min(100, Math.round(Number(payload.avance) || 0))),
    eficiencia_operativa: payload.eficiencia_operativa?.trim() || null,
  };
}

export async function createCorrectivo(payload, actor, extendido = false, propias = false, multiples = false) {
  const { personaId, nombre } = actorFields(actor);
  const { data, error } = await supabase
    .from(TABLA)
    .insert({ ...limpiar(payload, extendido, propias, multiples), created_by_persona_id: personaId, created_by_nombre: nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `cambios` puede ser parcial (por ejemplo solo { avance } al mover la barra).
export async function updateCorrectivo(id, cambios, actor, extendido = false, propias = false, multiples = false) {
  const { personaId, nombre } = actorFields(actor);
  const completo = Object.keys(cambios).length > 1 || !("avance" in cambios);
  const cuerpo = completo ? limpiar(cambios, extendido, propias, multiples) :{ avance: Math.max(0, Math.min(100, Math.round(Number(cambios.avance) || 0))) };
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
