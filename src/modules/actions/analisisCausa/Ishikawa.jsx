import { useEffect, useState } from "react";

const CATEGORIAS = [
  { key: "Método", color: "#2a78d6", icono: "📋" },
  { key: "Mano de obra", color: "#1baf7a", icono: "🧑" },
  { key: "Materiales", color: "#eda100", icono: "📦" },
  { key: "Maquinaria", color: "#4a3aa7", icono: "⚙️" },
  { key: "Medición", color: "#e34948", icono: "📏" },
  { key: "Medio ambiente", color: "#eb6834", icono: "🌎" },
];

// Geometría fija del diagrama: cada categoría cuelga de un punto sobre la
// espina central, alternando arriba/abajo, con una espina secundaria propia
// donde se van "clavando" ticks — uno por causa capturada — para que el
// diagrama refleje de verdad cuántas causas tiene cada rama, no solo su
// nombre.
const SPINE_Y = 130;
const SPINE_X_START = 30;
const SPINE_X_END = 610;
const HEAD_X = [110, 260, 410];

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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2">
        <svg viewBox="0 0 660 260" className="h-[220px] w-full min-w-[600px]">
          {/* Espina central + cabeza (flecha hacia el problema) */}
          <line x1={SPINE_X_START} y1={SPINE_Y} x2={SPINE_X_END} y2={SPINE_Y} stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <polygon points={`${SPINE_X_END},${SPINE_Y - 12} ${SPINE_X_END + 32},${SPINE_Y} ${SPINE_X_END},${SPINE_Y + 12}`} fill="#334155" />

          {CATEGORIAS.map((cat, index) => {
            const isTop = index % 2 === 0;
            const headX = HEAD_X[Math.floor(index / 2)];
            const spineJoinX = headX + (isTop ? 55 : 55);
            const boneY1 = isTop ? SPINE_Y - 85 : SPINE_Y + 85;
            const labelY = isTop ? boneY1 - 22 : boneY1 + 34;
            const causasCat = causas[cat.key] || [];
            return (
              <g key={cat.key}>
                {/* Espina secundaria de la categoría */}
                <line x1={headX} y1={boneY1} x2={spineJoinX} y2={SPINE_Y} stroke={cat.color} strokeWidth="2.5" strokeLinecap="round" />
                {/* Un tick por causa capturada, distribuido a lo largo del hueso */}
                {causasCat.map((_, i) => {
                  const t = (i + 1) / (causasCat.length + 1);
                  const bx = headX + (spineJoinX - headX) * t;
                  const by = boneY1 + (SPINE_Y - boneY1) * t;
                  const dx = isTop ? -9 : 9;
                  return <line key={i} x1={bx} y1={by} x2={bx + dx} y2={by + (isTop ? -9 : 9)} stroke={cat.color} strokeWidth="1.5" opacity="0.6" />;
                })}
                {/* Icono + etiqueta de la categoría */}
                <text x={headX} y={labelY} textAnchor="middle" fontSize="15">{cat.icono}</text>
                <text x={headX} y={labelY + (isTop ? 13 : -13)} textAnchor="middle" fill={cat.color} fontSize="9.5" fontWeight="900">{cat.key.toUpperCase()}</text>
                <text x={headX} y={labelY + (isTop ? 25 : -25)} textAnchor="middle" fill={cat.color} fontSize="8" fontWeight="700" opacity="0.7">{causasCat.length} causa{causasCat.length === 1 ? "" : "s"}</text>
              </g>
            );
          })}

          {/* Caja de problema al final de la espina */}
          <rect x={SPINE_X_END + 34} y={SPINE_Y - 34} width="150" height="68" rx="12" fill="#001225" />
          <text x={SPINE_X_END + 109} y={SPINE_Y - 8} textAnchor="middle" fill="#fbbf24" fontSize="16">⚠️</text>
          <text x={SPINE_X_END + 109} y={SPINE_Y + 12} textAnchor="middle" fill="white" fontSize="9.5" fontWeight="900">{totalCausas} CAUSAS</text>
          <text x={SPINE_X_END + 109} y={SPINE_Y + 25} textAnchor="middle" fill="white" fontSize="8" fontWeight="700" opacity="0.8">identificadas</text>
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIAS.map((cat) => (
          <div key={cat.key} className="overflow-hidden rounded-xl border" style={{ borderColor: `${cat.color}40` }}>
            <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: `${cat.color}14` }}>
              <span className="text-[13px] leading-none">{cat.icono}</span>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: cat.color }}>{cat.key}</p>
            </div>
            <div className="p-2">
              <div className="flex flex-wrap gap-1">
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
