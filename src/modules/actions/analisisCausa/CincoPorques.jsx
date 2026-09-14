import { useEffect, useState } from "react";
import { formatDate } from "../actionsHelpers";

// Un color por profundidad — de "recién detectado" (azul) a "cerca de la
// raíz" (rojo) — para que el degradado transmita visualmente que cada
// "¿por qué?" acerca más a la causa real, no solo que son 5 cajas iguales.
const NIVEL_COLOR = ["#2a78d6", "#4a3aa7", "#eda100", "#eb6834", "#e34948"];

// Trazabilidad por renglón: cada nivel guarda quién lo escribió, no solo el
// texto — varias personas pueden tener permiso de editar el mismo análisis
// (creador, responsable de análisis, dueño del proceso, equipo estratégico),
// así que sin esto no se podía saber quién aportó cada "por qué". Los datos
// guardados antes de este cambio son strings sueltos; se normalizan aquí en
// vez de migrarlos, así no se pierde nada de lo ya capturado.
function normalizeNivel(n) {
  if (typeof n === "string") return { texto: n, personaId: null, nombre: null, fecha: null };
  return { texto: n?.texto || "", personaId: n?.personaId ?? null, nombre: n?.nombre || null, fecha: n?.fecha || null };
}

export default function CincoPorques({ analisis, onSave, canEdit, currentUser }) {
  const [niveles, setNiveles] = useState((analisis?.contenido?.niveles?.length ? analisis.contenido.niveles : [""]).map(normalizeNivel));
  const [causaRaiz, setCausaRaiz] = useState(analisis?.conclusion_causa_raiz || "");

  useEffect(() => {
    setNiveles((analisis?.contenido?.niveles?.length ? analisis.contenido.niveles : [""]).map(normalizeNivel));
    setCausaRaiz(analisis?.conclusion_causa_raiz || "");
  }, [analisis]);

  function updateNivel(index, value) {
    setNiveles((current) => current.map((n, i) => (i === index ? { ...n, texto: value } : n)));
  }
  function addNivel() {
    if (niveles.length >= 5) return;
    setNiveles((current) => [...current, normalizeNivel("")]);
  }
  function removeNivel(index) {
    setNiveles((current) => current.filter((_, i) => i !== index));
  }
  function handleGuardar() {
    const previos = (analisis?.contenido?.niveles || []).map(normalizeNivel);
    const nombreActor = currentUser?.nombre || currentUser?.usuario || "";
    const ahora = new Date().toISOString();
    const estampados = niveles.map((n, i) => {
      const texto = n.texto.trim();
      if (!texto) return { texto: "", personaId: null, nombre: null, fecha: null };
      // Si el texto no cambió respecto a lo ya guardado, se conserva la
      // autoría original en vez de atribuírselo a quien solo dio "Guardar".
      if (previos[i] && previos[i].texto === n.texto) return previos[i];
      return { texto: n.texto, personaId: currentUser?.persona_id ?? null, nombre: nombreActor, fecha: ahora };
    });
    setNiveles(estampados);
    onSave({ contenido: { niveles: estampados }, conclusionCausaRaiz: causaRaiz });
  }

  const respondidos = niveles.filter((n) => n.texto.trim()).length;

  return (
    <div className="space-y-1">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px]">🔻</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">5 Porqués — de la superficie a la raíz</p>
        </div>
        <div className="flex items-center gap-2">
          {analisis?.updated_by_nombre && (
            <span className="text-[9px] font-semibold text-slate-400">Última edición: {analisis.updated_by_nombre} · {formatDate(analisis.updated_at)}</span>
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: i < respondidos ? NIVEL_COLOR[i] : "#e2e8f0" }} />
              ))}
            </div>
            <span className="text-[9px] font-black text-slate-400">{respondidos}/5</span>
          </div>
        </div>
      </div>
      <p className="mb-2 text-[9px] font-semibold leading-tight text-slate-400">Pregunta "¿por qué?" sobre la respuesta anterior, no sobre el problema original — así cada nivel te acerca más a la causa real y no te quedas en el síntoma.</p>

      {niveles.map((nivel, index) => (
        <div key={index} className="relative flex items-start gap-2 pb-1">
          {index < niveles.length - 1 && (
            <span className="absolute left-[15px] top-9 h-full w-0.5" style={{ background: `linear-gradient(${NIVEL_COLOR[index]}, ${NIVEL_COLOR[Math.min(index + 1, 4)]})` }} />
          )}
          <div
            className="relative z-10 mt-5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white shadow-sm"
            style={{ background: NIVEL_COLOR[index] }}
          >
            {index + 1}
          </div>
          <div className="flex-1 rounded-xl border p-2" style={{ borderColor: `${NIVEL_COLOR[index]}40`, background: `${NIVEL_COLOR[index]}12` }}>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: NIVEL_COLOR[index] }}>¿Por qué? — nivel {index + 1}</p>
            {index > 0 && niveles[index - 1]?.texto.trim() && (
              <p className="mt-0.5 truncate text-[9px] font-semibold italic text-slate-400">↳ Porque: "{niveles[index - 1].texto}"</p>
            )}
            <textarea
              disabled={!canEdit}
              value={nivel.texto}
              onChange={(event) => updateNivel(index, event.target.value)}
              rows={1}
              placeholder={index === 0 ? "Describe el problema tal como se detectó" : "¿Por qué pasó eso que escribiste arriba?"}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
            />
            {nivel.personaId && (
              <p className="mt-0.5 text-[8px] font-bold text-slate-400">— {nivel.nombre}{nivel.fecha ? ` · ${formatDate(nivel.fecha)}` : ""}</p>
            )}
          </div>
          {canEdit && niveles.length > 1 && (
            <button type="button" onClick={() => removeNivel(index)} className="mt-6 text-[12px] font-black text-slate-300 hover:text-red-500">×</button>
          )}
        </div>
      ))}

      {canEdit && niveles.length < 5 && (
        <button type="button" onClick={addNivel} className="ml-9 rounded-lg border border-dashed border-slate-300 px-3 py-1 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600">
          + Por qué
        </button>
      )}

      <div className="ml-9 mt-2 flex items-start gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/70 p-2.5">
        <span className="mt-0.5 text-[15px]">🎯</span>
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Causa raíz identificada</p>
          <textarea
            disabled={!canEdit}
            value={causaRaiz}
            onChange={(event) => setCausaRaiz(event.target.value)}
            rows={2}
            placeholder="Conclusión de la causa raíz"
            className="mt-1 w-full resize-none rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none"
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={handleGuardar} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
        </div>
      )}
    </div>
  );
}
