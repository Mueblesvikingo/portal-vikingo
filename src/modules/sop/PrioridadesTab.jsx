import { useMemo, useState } from "react";

const AREAS = [
  { key: "Comercial", tone: "sky" },
  { key: "Operaciones", tone: "emerald" },
  { key: "Finanzas", tone: "violet" },
];

const TONE = {
  sky: { border: "border-sky-200", header: "bg-sky-50/60", dot: "bg-sky-400", title: "text-sky-700" },
  emerald: { border: "border-emerald-200", header: "bg-emerald-50/60", dot: "bg-emerald-400", title: "text-emerald-700" },
  violet: { border: "border-violet-200", header: "bg-violet-50/60", dot: "bg-violet-400", title: "text-violet-700" },
};

const ESTADO_STYLE = {
  "En curso": "border-sky-200 bg-sky-50 text-sky-700",
  Cumplida: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "No cumplida": "border-red-200 bg-red-50 text-red-700",
};

// Semana de referencia dentro del mes en curso (1-4), estimada a partir del
// dia del mes de hoy — solo un punto de partida razonable, el selector deja
// cambiarla a mano.
function semanaActualEstimada() {
  const dia = new Date().getDate();
  return Math.min(4, Math.ceil(dia / 7));
}

function PrioridadCard({ area, prioridad, canEdit, onUpsert, onUpdateEstado, anio, mes, semana }) {
  const tone = TONE[area.tone];
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState({ prioridad: prioridad?.prioridad || "", meta_numerica: prioridad?.meta_numerica || "", responsable: prioridad?.responsable || "" });
  const [saving, setSaving] = useState(false);

  async function handleGuardar() {
    if (!draft.prioridad.trim()) return;
    setSaving(true);
    const ok = await onUpsert({ anio, mes, semana, area: area.key, ...draft });
    setSaving(false);
    if (ok) setEditando(false);
  }

  const mostrarForm = editando || !prioridad;

  return (
    <div className={`flex min-h-[220px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${tone.border}`}>
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${tone.header}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          <p className={`text-[10px] font-black uppercase tracking-widest ${tone.title}`}>{area.key}</p>
        </div>
        {prioridad && canEdit && !editando && (
          <button type="button" onClick={() => setEditando(true)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 hover:underline">
            Editar
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        {mostrarForm ? (
          canEdit ? (
            <div className="space-y-2">
              <textarea
                value={draft.prioridad}
                onChange={(e) => setDraft((c) => ({ ...c, prioridad: e.target.value }))}
                placeholder="¿Cuál es la prioridad de esta semana?"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={draft.meta_numerica}
                  onChange={(e) => setDraft((c) => ({ ...c, meta_numerica: e.target.value }))}
                  placeholder="Meta (opcional)"
                  className="h-9 w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                />
                <input
                  value={draft.responsable}
                  onChange={(e) => setDraft((c) => ({ ...c, responsable: e.target.value }))}
                  placeholder="Responsable (opcional)"
                  className="h-9 w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={handleGuardar} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  {saving ? "Guardando..." : "Guardar prioridad"}
                </button>
                {prioridad && (
                  <button type="button" onClick={() => setEditando(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black text-slate-500">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] font-bold text-slate-300">Sin prioridad definida.</p>
          )
        ) : (
          <>
            <div>
              <p className="text-[13px] font-bold leading-snug text-slate-800">{prioridad.prioridad}</p>
              {prioridad.meta_numerica && <p className="mt-1 text-[10px] font-bold text-slate-500">Meta: {prioridad.meta_numerica}</p>}
              {prioridad.responsable && <p className="text-[10px] font-bold text-slate-500">Responsable: {prioridad.responsable}</p>}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Al cierre de la semana</p>
              {canEdit ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateEstado(prioridad.id, "Cumplida")}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-black uppercase ${prioridad.estado === "Cumplida" ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-emerald-50"}`}
                  >
                    ✓ Cumplida
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEstado(prioridad.id, "No cumplida")}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-black uppercase ${prioridad.estado === "No cumplida" ? "border-red-300 bg-red-100 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:bg-red-50"}`}
                  >
                    ✗ No cumplida
                  </button>
                </div>
              ) : (
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${ESTADO_STYLE[prioridad.estado] || ESTADO_STYLE["En curso"]}`}>{prioridad.estado}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PrioridadesTab({ prioridades, control, canEdit, onUpsert, onUpdateEstado }) {
  const [semana, setSemana] = useState(semanaActualEstimada);

  const anio = control?.mes_activo ? Number(control.mes_activo.slice(0, 4)) : null;
  const mes = control?.mes_activo ? Number(control.mes_activo.slice(5, 7)) : null;

  const prioridadPorArea = useMemo(() => {
    const map = new Map();
    for (const p of prioridades) {
      if (p.anio === anio && p.mes === mes && p.semana === semana) map.set(p.area, p);
    }
    return map;
  }, [prioridades, anio, mes, semana]);

  const historial = useMemo(
    () => [...prioridades].sort((a, b) => b.anio - a.anio || b.mes - a.mes || b.semana - a.semana || a.area.localeCompare(b.area)),
    [prioridades]
  );

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold text-violet-700">
        <span>Una prioridad por área, definida al inicio de la semana del mes activo. Al cerrar la semana se marca cumplida o no cumplida.</span>
        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-violet-700">
          Semana
          <select value={semana} onChange={(e) => setSemana(Number(e.target.value))} className="h-8 rounded-lg border border-violet-200 bg-white px-2 text-[10px] font-bold text-violet-700 outline-none">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {!anio || !mes ? (
        <p className="text-[11px] font-bold text-slate-300">No hay mes activo definido en Control S&OP.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {AREAS.map((area) => (
            <PrioridadCard
              key={area.key}
              area={area}
              prioridad={prioridadPorArea.get(area.key)}
              canEdit={canEdit}
              onUpsert={onUpsert}
              onUpdateEstado={onUpdateEstado}
              anio={anio}
              mes={mes}
              semana={semana}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Histórico de prioridades semanales</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Mes / Semana</th>
              <th className="px-2 py-2">Área</th>
              <th className="px-2 py-2">Prioridad</th>
              <th className="px-2 py-2">Meta</th>
              <th className="px-2 py-2">Responsable</th>
              <th className="px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {historial.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay prioridades semanales registradas.</td></tr>
            )}
            {historial.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-bold text-slate-700">{p.anio}-{String(p.mes).padStart(2, "0")} / S{p.semana}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.area}</td>
                <td className="px-2 py-1.5 text-slate-700">{p.prioridad}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.meta_numerica || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.responsable || "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${ESTADO_STYLE[p.estado] || ESTADO_STYLE["En curso"]}`}>{p.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
