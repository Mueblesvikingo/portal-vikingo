import { useEffect, useState } from "react";

// Un color por profundidad — de "recién detectado" (azul) a "cerca de la
// raíz" (rojo) — para que el degradado transmita visualmente que cada
// "¿por qué?" acerca más a la causa real, no solo que son 5 cajas iguales.
const NIVEL_COLOR = ["#2a78d6", "#4a3aa7", "#eda100", "#eb6834", "#e34948"];

export default function CincoPorques({ analisis, onSave, canEdit }) {
  const [niveles, setNiveles] = useState(analisis?.contenido?.niveles || [""]);
  const [causaRaiz, setCausaRaiz] = useState(analisis?.conclusion_causa_raiz || "");

  useEffect(() => {
    setNiveles(analisis?.contenido?.niveles?.length ? analisis.contenido.niveles : [""]);
    setCausaRaiz(analisis?.conclusion_causa_raiz || "");
  }, [analisis]);

  function updateNivel(index, value) {
    setNiveles((current) => current.map((n, i) => (i === index ? value : n)));
  }
  function addNivel() {
    if (niveles.length >= 5) return;
    setNiveles((current) => [...current, ""]);
  }
  function removeNivel(index) {
    setNiveles((current) => current.filter((_, i) => i !== index));
  }
  function handleGuardar() {
    onSave({ contenido: { niveles }, conclusionCausaRaiz: causaRaiz });
  }

  const respondidos = niveles.filter((n) => n.trim()).length;

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px]">🔻</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">5 Porqués — de la superficie a la raíz</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: i < respondidos ? NIVEL_COLOR[i] : "#e2e8f0" }} />
          ))}
        </div>
      </div>

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
          <div className="flex-1 rounded-xl border p-2" style={{ borderColor: `${NIVEL_COLOR[index]}35`, background: `${NIVEL_COLOR[index]}08` }}>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: NIVEL_COLOR[index] }}>¿Por qué? — nivel {index + 1}</p>
            <textarea
              disabled={!canEdit}
              value={nivel}
              onChange={(event) => updateNivel(index, event.target.value)}
              rows={1}
              placeholder="Escribe la razón de este nivel"
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
            />
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
