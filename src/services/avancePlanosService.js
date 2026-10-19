import { supabase } from "./supabase";

// Avance de planos por producto y área (tabla `sig_avance_planos`, ver
// sql/2026-10-sig_avance_planos.sql y sql/2026-10-sig_avance_planos_na.sql).
// Implementación temporal.

// Cada área lleva UN solo tipo de plano: el 3D aplica solo a Armado, y el 2D de
// Armado es el de Carpintería, por eso Armado no tiene casilla 2D. Tapizado no
// lleva planos propios, por eso no es una columna.
export const COLUMNAS_PLANOS = [
  { area: "corte", label: "Corte", tipo: "2D" },
  { area: "costura", label: "Costura", tipo: "2D" },
  { area: "carpinteria", label: "Carpintería", tipo: "2D" },
  { area: "armado", label: "Armado", tipo: "3D" },
  { area: "espuma", label: "Espuma", tipo: "2D" },
];

// Cada casilla puede estar vacía (pendiente), hecha ("si") o no aplicar ("na").
export const ESTADO_HECHO = "si";
export const ESTADO_NO_APLICA = "na";

const TABLA = "sig_avance_planos";

// La tabla (y la columna no_aplica) las crea el usuario con un SQL aparte;
// mientras no existan, el panel avisa en vez de mostrar un error técnico.
function esTablaFaltante(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || texto.includes("does not exist") || texto.includes("schema cache");
}

function esColumnaFaltante(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.code === "42703" || texto.includes("no_aplica");
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

// Devuelve un Map clave(producto|área|tipo) → "si" | "na" para las casillas
// que no están vacías. `naDisponible` es falso mientras no exista la columna
// no_aplica en la tabla.
export async function getAvancePlanos() {
  let naDisponible = true;
  let { data, error } = await supabase.from(TABLA).select("producto_id,area,tipo,completado,no_aplica");
  if (error && esColumnaFaltante(error) && !esTablaFaltante({ ...error, message: "" })) {
    naDisponible = false;
    ({ data, error } = await supabase.from(TABLA).select("producto_id,area,tipo,completado"));
  }
  if (error) {
    if (esTablaFaltante(error)) return { estados: new Map(), tablaFaltante: true, naDisponible: false, error: null };
    console.error("Error al cargar el avance de planos:", error);
    return { estados: new Map(), tablaFaltante: false, naDisponible, error };
  }
  const estados = new Map();
  (data || []).forEach((r) => {
    if (r.no_aplica) estados.set(claveAvance(r.producto_id, r.area, r.tipo), ESTADO_NO_APLICA);
    else if (r.completado) estados.set(claveAvance(r.producto_id, r.area, r.tipo), ESTADO_HECHO);
  });
  return { estados, tablaFaltante: false, naDisponible, error: null };
}

// estado: "si" (hecho), "na" (no aplica) o "no" (vacío/pendiente).
export async function setAvancePlano({ productoId, area, tipo, estado }, actor, naDisponible = true) {
  const fila = {
    producto_id: Number(productoId),
    area,
    tipo,
    completado: estado === ESTADO_HECHO,
    updated_at: new Date().toISOString(),
    updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
    updated_by_nombre: actor?.nombre || actor?.usuario || null,
  };
  if (naDisponible) fila.no_aplica = estado === ESTADO_NO_APLICA;
  const { error } = await supabase.from(TABLA).upsert(fila, { onConflict: "producto_id,area,tipo" });
  if (error) throw error;
}
