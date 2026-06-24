import { supabase } from "./supabase";

function cleanPayload(payload) {
  const cleaned = { ...payload };

  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

/* =========================
   PUESTOS
========================= */

export async function getPuestos() {
  const { data, error } = await supabase
    .from("puestos")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPuesto(payload) {
  const { data, error } = await supabase
    .from("puestos")
    .insert([
      cleanPayload({
        nombre: payload.nombre,
        area: payload.area || null,
        proceso: payload.proceso || null,
        nivel: payload.nivel || null,
        activo: payload.activo ?? true,
      }),
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePuesto(id, payload) {
  const { data, error } = await supabase
    .from("puestos")
    .update(
      cleanPayload({
        nombre: payload.nombre,
        area: payload.area,
        proceso: payload.proceso,
        nivel: payload.nivel,
        activo: payload.activo,
      })
    )
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   PERSONAS
========================= */

export async function getPersonas() {
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPersona(payload) {
  const { data, error } = await supabase
    .from("personas")
    .insert([
      cleanPayload({
        nombre: payload.nombre,
        puesto: payload.puesto || null,
        area: payload.area || null,
        proceso: payload.proceso || null,
        tipo: payload.tipo || "persona",
        activo: payload.activo ?? true,
      }),
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePersona(id, payload) {
  const { data, error } = await supabase
    .from("personas")
    .update(
      cleanPayload({
        nombre: payload.nombre,
        puesto: payload.puesto,
        area: payload.area,
        proceso: payload.proceso,
        tipo: payload.tipo,
        activo: payload.activo,
      })
    )
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   ROLES DE PERSONA
========================= */

export async function getPersonaRoles() {
  const { data, error } = await supabase
    .from("persona_roles")
    .select("*")
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPersonaRole(payload) {
  const { data, error } = await supabase
    .from("persona_roles")
    .insert([
      cleanPayload({
        persona_id: payload.persona_id,
        rol: payload.rol,
        proceso: payload.proceso || null,
        activo: payload.activo ?? true,
      }),
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePersonaRole(id, payload) {
  const { data, error } = await supabase
    .from("persona_roles")
    .update(
      cleanPayload({
        persona_id: payload.persona_id,
        rol: payload.rol,
        proceso: payload.proceso,
        activo: payload.activo,
      })
    )
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   USUARIOS
   Nota: no editamos password_hash aquí todavía.
========================= */

export async function getUsuarios() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("usuario", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createUsuario(payload) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert([
      cleanPayload({
        usuario: payload.usuario,
        nombre: payload.nombre || null,
        puesto: payload.puesto || null,
        rol_sistema: payload.rol_sistema || "Usuario",
        rol_organizacional: payload.rol_organizacional || null,
        activo: payload.activo ?? true,
      }),
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUsuario(id, payload) {
  const { data, error } = await supabase
    .from("usuarios")
    .update(
      cleanPayload({
        usuario: payload.usuario,
        nombre: payload.nombre,
        puesto: payload.puesto,
        rol_sistema: payload.rol_sistema,
        rol_organizacional: payload.rol_organizacional,
        activo: payload.activo,
      })
    )
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}