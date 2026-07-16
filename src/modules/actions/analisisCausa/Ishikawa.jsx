import { useEffect, useState } from "react";

const CATEGORIAS = [
  { key: "Método", color: "#2a78d6" },
  { key: "Mano de obra", color: "#1baf7a" },
  { key: "Materiales", color: "#eda100" },
  { key: "Maquinaria", color: "#4a3aa7" },
  { key: "Medición", color: "#e34948" },
  { key: "Medio ambiente", color: "#eb6834" },
];

export default function Ishikawa({ analisis, onSave, canEdit }) {
  const [problema, setProblema] = useState(analisis?.contenido?.problema || "");
  const [causas, setCausas] = useState(analisis?.contenido?.causas || {});
  const [draftInputs, setDraftInputs] = useState({});
  const [causaRaiz, setCausaRaiz] = useState(analisis?.conclusion_causa_raiz || "");

  useEffect(() => {
    setProblema(analisis?.contenido?.problema || "");
    setCausas(analisis?.contenido?.causas || {});
    setCausaRaiz(analisis?.conclusion_causa_raiz || "");
  }, [analisis]);

  function addCausa(categoria) {
    const texto = (draftInputs[categoria] || "").trim();
    if (!texto) return;
    setCausas((current) => ({ ...current, [categoria]: [...(current[categoria] || []), texto] }));
    setDraftInputs((current) => ({ ...current, [categoria]: "" }));
  }
  function removeCausa(categoria, index) {
    setCausas((current) => ({ ...current, [categoria]: (current[categoria] || []).filter((_, i) => i !== index) }));
  }
  function handleGuardar() {
    onSave({ contenido: { problema, causas }, conclusionCausaRaiz: causaRaiz });
  }

  const totalCausas = Object.values(causas).reduce((sum, list) => sum + (list?.length || 0), 0);

  return (
    <div className="space-y-3">
      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
        Efecto / Problema
        <input
          disabled={!canEdit}
          value={problema}
          onChange={(event) => setProblema(event.target.value)}
          placeholder="¿Cuál es el problema a analizar?"
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
        />
      </label>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-2">
        <svg viewBox="0 0 640 220" className="h-[150px] w-full min-w-[560px]">
          <line x1="20" y1="110" x2="560" y2="110" stroke="#334155" strokeWidth="2" />
          <polygon points="560,100 590,110 560,120" fill="#334155" />
          <rect x="480" y="85" width="110" height="50" rx="10" fill="#001225" />
          <text x="535" y="115" textAnchor="middle" fill="white" fontSize="10" fontWeight="900">{totalCausas} causas</text>
          {CATEGORIAS.map((cat, index) => {
            const isTop = index % 2 === 0;
            const x = 80 + Math.floor(index / 2) * 150;
            const yLabel = isTop ? 18 : 205;
            return (
              <g key={cat.key}>
                <line x1={x} y1={isTop ? yLabel + 10 : yLabel - 10} x2={x + 60} y2="110" stroke={cat.color} strokeWidth="2" />
                <text x={x} y={yLabel} textAnchor="middle" fill={cat.color} fontSize="10" fontWeight="900">{cat.key}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIAS.map((cat) => (
          <div key={cat.key} className="rounded-xl border p-2" style={{ borderColor: `${cat.color}40`, background: `${cat.color}0a` }}>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: cat.color }}>{cat.key}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(causas[cat.key] || []).map((causa, index) => (
                <span key={index} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600" style={{ borderColor: `${cat.color}50` }}>
                  {causa}
                  {canEdit && <button type="button" onClick={() => removeCausa(cat.key, index)} className="text-slate-300 hover:text-red-500">×</button>}
                </span>
              ))}
              {(causas[cat.key] || []).length === 0 && <span className="text-[9px] font-bold text-slate-300">Sin causas</span>}
            </div>
            {canEdit && (
              <div className="mt-1.5 flex gap-1">
                <input
                  value={draftInputs[cat.key] || ""}
                  onChange={(event) => setDraftInputs((current) => ({ ...current, [cat.key]: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === "Enter") addCausa(cat.key); }}
                  placeholder="+ causa"
                  className="h-7 flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-700 outline-none"
                />
                <button type="button" onClick={() => addCausa(cat.key)} className="rounded-md bg-[#001225] px-2 text-[9px] font-black text-white">OK</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Causa raíz identificada</p>
        <textarea
          disabled={!canEdit}
          value={causaRaiz}
          onChange={(event) => setCausaRaiz(event.target.value)}
          rows={2}
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
