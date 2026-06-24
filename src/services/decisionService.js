import { supabase } from "./supabase";

export async function createStrategicDecision(data) {
  const { data: insertedData, error } = await supabase
    .from("decisiones_estrategicas")
    .insert([
      {
        titulo_de_decision: data.title,
        responsable: data.owner,
        riesgo: data.risk,
        estado: data.status,
        execution_type: data.executionType,
        fecha_compromiso: data.dueDate || null,
        consecuencia: data.consequence,
        recomendacion: data.recommendation,
        wrap_options: data.wrap.options,
        wrap_evidence: data.wrap.evidence,
        wrap_distance: data.wrap.distance,
        wrap_prepare: data.wrap.prevention,
        decision_final: data.wrap.finalDecision,
        proceso: data.process || "Gestion Estrategica",
      },
    ])
    .select();

  if (error) {
    console.error("SUPABASE ERROR:", error);
    throw error;
  }

  console.log("INSERTADO EN SUPABASE:", insertedData);

  return insertedData;
}
export async function getStrategicDecisions() {
  const { data, error } = await supabase
    .from("decisiones_estrategicas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("SUPABASE READ ERROR:", error);
    throw error;
  }

  return data;
}
export async function updateStrategicDecision(id, updates) {
  const { data, error } = await supabase
    .from("decisiones_estrategicas")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error("SUPABASE UPDATE ERROR:", error);
    throw error;
  }

  return data;
}

export async function deleteStrategicDecision(id) {
  const { data, error } = await supabase
    .from("decisiones_estrategicas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("SUPABASE DELETE ERROR:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("No se eliminó ningún registro. Revisa permisos de eliminación en Supabase.");
  }

  return data;
}

