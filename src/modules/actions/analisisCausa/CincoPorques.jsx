import { useEffect, useState } from "react";

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

  return (
    <div className="space-y-2">
      {niveles.map((nivel, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#001225] text-[10px] font-black text-white">{index + 1}</div>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">¿Por qué?</p>
            <textarea
              disabled={!canEdit}
              value={nivel}
              onChange={(event) => updateNivel(index, event.target.value)}
              rows={1}
              placeholder="Escribe la razón de este nivel"
              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
            />
          </div>
          {canEdit && niveles.length > 1 && (
            <button type="button" onClick={() => removeNivel(index)} className="mt-6 text-[12px] font-black text-slate-300 hover:text-red-500">×</button>
          )}
        </div>
      ))}
      {canEdit && niveles.length < 5 && (
        <button type="button" onClick={addNivel} className="ml-8 rounded-lg border border-dashed border-slate-300 px-3 py-1 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600">
          + Por qué
        </button>
      )}
      <div className="ml-8 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Causa raíz identificada</p>
        <textarea
          disabled={!canEdit}
          value={causaRaiz}
          onChange={(event) => setCausaRaiz(event.target.value)}
          rows={2}
          placeholder="Conclusión de la causa raíz"
          className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none"
        />
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={handleGuardar} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
        </div>
      )}
    </div>
  );
}
