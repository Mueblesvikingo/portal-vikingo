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
   Nota: password_hash se guarda tal cual se recibe (sin hashear en cliente),
   igual que ya está guardada la de los usuarios existentes en esta tabla.
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
        password_hash: payload.password_hash || null,
        persona_id: payload.persona_id || null,
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
        permisos_custom: payload.permisos_custom,
        password_hash: payload.password_hash,
        persona_id: payload.persona_id,
      })
    )
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Excepciones de permisos por usuario puntual (columna jsonb `permisos_custom`).
// NULL/{} = usar la lógica de permisos por rol existente (ver permissionsService.js).
export async function updateUsuarioPermisos(id, permisosCustom) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ permisos_custom: permisosCustom })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   ROLES Y PERMISOS
   Permisos por defecto de cada rol organizacional (tabla roles_permisos).
   Ver src/services/permissionsService.js para cómo se consumen.
========================= */

export async function getRolesPermisos() {
  const { data, error } = await supabase
    .from("roles_permisos")
    .select("*")
    .order("rol", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createRolPermisos(rol) {
  const cleanRol = String(rol || "").trim();
  if (!cleanRol) throw new Error("El nombre del rol no puede estar vacío.");

  const { data, error } = await supabase
    .from("roles_permisos")
    .insert([{ rol: cleanRol, permisos: {} }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRolPermisos(id, permisos) {
  const { data, error } = await supabase
    .from("roles_permisos")
    .update({ permisos, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRolPermisos(id) {
  const { error } = await supabase.from("roles_permisos").delete().eq("id", id);

  if (error) throw error;
  return true;
}