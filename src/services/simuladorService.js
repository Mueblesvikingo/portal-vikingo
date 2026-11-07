import { supabase } from "./supabase";

// Escenarios guardados del Simulador de Diagnóstico SIG (tabla `sig_simulaciones`, ver sql/2026-11-sig_simulaciones.sql).
// Los ven y editan el Coordinador SIG y el Director General. Mientras la tabla no exista, el panel avisa y guarda
// solo en el navegador (localStorage).

const TABLA = "sig_simulaciones";
const COLUMNAS = "id,nombre,resumen,datos,created_by_nombre,updated_by_nombre,created_at,updated_at";

function esTablaFaltante(error) {
  const texto = `${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || texto.includes("schema cache") || (texto.includes("relation") && texto.includes("does not exist"));
}

const nombreDe = (actor) => actor?.persona_nombre || actor?.nombre || actor?.usuario || null;

export async function getSimulaciones() {
  const { data, error } = await supabase.from(TABLA).select(COLUMNAS).order("updated_at", { ascending: false }).limit(100);
  if (error) {
    if (esTablaFaltante(error)) return { filas: [], tablaFaltante: true, error: null };
    console.error("Error al cargar las simulaciones guardadas:", error);
    return { filas: [], tablaFaltante: false, error };
  }
  return { filas: data || [], tablaFaltante: false, error: null };
}

// Sin id crea un escenario nuevo; con id actualiza el existente.
export async function saveSimulacion({ id, nombre, datos, resumen }, actor) {
  const ahora = new Date().toISOString();
  if (id != null) {
    const { data, error } = await supabase
      .from(TABLA)
      .update({ nombre, datos, resumen, updated_at: ahora, updated_by_nombre: nombreDe(actor) })
      .eq("id", id)
      .select(COLUMNAS)
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      nombre,
      datos,
      resumen,
      created_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
      created_by_nombre: nombreDe(actor),
      updated_by_nombre: nombreDe(actor),
    })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return data;
}

// Si la base no deja borrar, PostgREST responde sin error y sin filas: se detecta y se avisa.
export async function deleteSimulacion(id) {
  const { data, error } = await supabase.from(TABLA).delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se pudo borrar el escenario");
}
