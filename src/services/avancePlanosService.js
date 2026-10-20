import { supabase } from "./supabase";

// Avance de planos por producto y área (tabla `sig_avance_planos`, ver
// sql/2026-10-sig_avance_planos.sql, ..._na.sql y ..._validado.sql).
// Implementación temporal.

// Cada área lleva UN solo tipo de plano: el 3D aplica solo a Armado, y el 2D de
// Armado es el de Carpintería, por eso Armado no tiene casilla 2D. Tapizado no
// lleva planos propios, por eso no es una columna.
export const COLUMNAS_PLANOS = [
  { area: "corte", label: "Corte tela", tipo: "2D" },
  { area: "costura", label: "Costura", tipo: "2D" },
  { area: "carpinteria", label: "Carpintería", tipo: "2D" },
  { area: "armado", label: "Armado", tipo: "3D" },
  { area: "espuma", label: "Espuma", tipo: "2D" },
];

// Cada casilla puede estar vacía (pendiente), terminada ("si"), validada ("va":
// terminada y además validada) o no aplicar ("na").
export const ESTADO_HECHO = "si";
export const ESTADO_VALIDADO = "va";
export const ESTADO_NO_APLICA = "na";

const TABLA = "sig_avance_planos";

// La tabla y las columnas no_aplica / validado las crea el usuario con SQL
// aparte; mientras no existan, el panel avisa en vez de mostrar un error técnico.
function esColumnaFaltante(error) {
  const texto = `${error?.message || ""}`.toLowerCase();
  return error?.code === "42703" || (texto.includes("column") && texto.includes("does not exist"));
}

function esTablaFaltante(error) {
  const texto = `${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || texto.includes("schema cache") || (texto.includes("relation") && texto.includes("does not exist"));
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

// Devuelve un Map clave(producto|área|tipo) → "si" | "va" | "na" para las
// casillas que no están vacías, y qué columnas opcionales existen en la tabla
// (`naDisponible`, `validadoDisponible`).
export async function getAvancePlanos() {
  const intentos = [
    { columnas: "producto_id,area,tipo,completado,no_aplica,validado", na: true, va: true },
    { columnas: "producto_id,area,tipo,completado,no_aplica", na: true, va: false },
    { columnas: "producto_id,area,tipo,completado", na: false, va: false },
  ];
  let data = null;
  let error = null;
  let usado = intentos[intentos.length - 1];
  for (const intento of intentos) {
    ({ data, error } = await supabase.from(TABLA).select(intento.columnas));
    usado = intento;
    if (!error || !esColumnaFaltante(error)) break;
  }
  if (error) {
    if (esTablaFaltante(error)) return { estados: new Map(), tablaFaltante: true, naDisponible: false, validadoDisponible: false, error: null };
    console.error("Error al cargar el avance de planos:", error);
    return { estados: new Map(), tablaFaltante: false, naDisponible: usado.na, validadoDisponible: usado.va, error };
  }
  const estados = new Map();
  (data || []).forEach((r) => {
    const clave = claveAvance(r.producto_id, r.area, r.tipo);
    if (r.no_aplica) estados.set(clave, ESTADO_NO_APLICA);
    else if (r.validado) estados.set(clave, ESTADO_VALIDADO);
    else if (r.completado) estados.set(clave, ESTADO_HECHO);
  });
  return { estados, tablaFaltante: false, naDisponible: usado.na, validadoDisponible: usado.va, error: null };
}

// estado: "si" (terminada), "va" (validada), "na" (no aplica) o "no" (vacía).
// Una casilla validada también cuenta como terminada (completado = true).
export async function setAvancePlano({ productoId, area, tipo, estado }, actor, disponibles = { na: true, va: true }) {
  const fila = {
    producto_id: Number(productoId),
    area,
    tipo,
    completado: estado === ESTADO_HECHO || estado === ESTADO_VALIDADO,
    updated_at: new Date().toISOString(),
    updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
    updated_by_nombre: actor?.nombre || actor?.usuario || null,
  };
  if (disponibles.na) fila.no_aplica = estado === ESTADO_NO_APLICA;
  if (disponibles.va) fila.validado = estado === ESTADO_VALIDADO;
  const { error } = await supabase.from(TABLA).upsert(fila, { onConflict: "producto_id,area,tipo" });
  if (error) throw error;
}
