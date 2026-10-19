import { supabase } from "./supabase";

// Avance de planos 2D y 3D por producto y área (tabla `sig_avance_planos`, ver
// sql/2026-10-sig_avance_planos.sql). Implementación temporal.

export const AREAS_PLANOS = [
  { key: "corte", label: "Corte" },
  { key: "costura", label: "Costura" },
  { key: "carpinteria", label: "Carpintería" },
  { key: "armado", label: "Armado" },
  { key: "tapizado", label: "Tapizado" },
];
export const TIPOS_PLANO = ["2D", "3D"];

const TABLA = "sig_avance_planos";

// La tabla la crea el usuario con un SQL aparte; mientras no exista, el panel
// avisa en vez de mostrar un error técnico.
function esTablaFaltante(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || texto.includes("does not exist") || texto.includes("schema cache");
}

export const claveAvance = (productoId, area, tipo) => `${productoId}|${area}|${tipo}`;

// Catálogo completo de productos terminados (el mismo de Configuración > Productos).
export async function getProductosPlanos() {
  const { data, error } = await supabase.from("calidad_productos").select("id,codigo,nombre").eq("activo", true).order("codigo", { ascending: true });
  if (error) {
    console.error("Error al cargar productos para el avance de planos:", error);
    return [];
  }
  return data || [];
}

// Devuelve un Set con las claves (producto|área|tipo) de las casillas marcadas.
export async function getAvancePlanos() {
  const { data, error } = await supabase.from(TABLA).select("producto_id,area,tipo,completado");
  if (error) {
    if (esTablaFaltante(error)) return { marcadas: new Set(), tablaFaltante: true, error: null };
    console.error("Error al cargar el avance de planos:", error);
    return { marcadas: new Set(), tablaFaltante: false, error };
  }
  const marcadas = new Set((data || []).filter((r) => r.completado).map((r) => claveAvance(r.producto_id, r.area, r.tipo)));
  return { marcadas, tablaFaltante: false, error: null };
}

export async function setAvancePlano({ productoId, area, tipo, completado }, actor) {
  const { error } = await supabase.from(TABLA).upsert(
    {
      producto_id: Number(productoId),
      area,
      tipo,
      completado: Boolean(completado),
      updated_at: new Date().toISOString(),
      updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
      updated_by_nombre: actor?.nombre || actor?.usuario || null,
    },
    { onConflict: "producto_id,area,tipo" },
  );
  if (error) throw error;
}
