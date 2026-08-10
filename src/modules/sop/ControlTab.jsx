import { useState } from "react";
import { buildHorizonte } from "./sopHelpers";

const ESTADO_STYLE = {
  Abierto: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cerrado: "border-slate-300 bg-slate-100 text-slate-600",
  Ejecutivo: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function ControlTab({ control, canEdit, onSave }) {
  // El <input type="month"> solo acepta/devuelve "AAAA-MM", pero la columna
  // en Supabase es tipo date ("AAAA-MM-DD") — hay que recortar al mostrar y
  // completar con "-01" al guardar, o el guardado falla (fecha inválida) y
  // el selector se ve en blanco al cargar.
  const [draft, setDraft] = useState(() => ({
    mes_activo: control?.mes_activo?.slice(0, 7) || "",
    horizonte_meses: control?.horizonte_meses || 6,
    estado: control?.estado || "Abierto",
  }));
  const [saving, setSaving] = useState(false);
  const [consultaMes, setConsultaMes] = useState("");

  if (!control) return <div className="p-6 text-center text-[11px] font-bold text-slate-300">Cargando control S&OP...</div>;

  const horizonte = buildHorizonte(draft.mes_activo, draft.horizonte_meses);
  const horizonteConsulta = buildHorizonte(consultaMes, draft.horizonte_meses);
  const dirty =
    draft.mes_activo !== control.mes_activo?.slice(0, 7) ||
    draft.horizonte_meses !== control.horizonte_meses ||
    draft.estado !== control.estado;

  async function handleSave() {
    setSaving(true);
    await onSave(control.id, { ...draft, mes_activo: draft.mes_activo ? `${draft.mes_activo}-01` : null });
    setSaving(false);
  }

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Control del ciclo S&amp;OP — horizonte rolado</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Mes activo (primer mes visible)
            <input
              type="month"
              disabled={!canEdit}
              value={draft.mes_activo}
              onChange={(e) => setDraft((c) => ({ ...c, mes_activo: e.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Horizonte visible (meses)
            <input
              type="number"
              min="1"
              max="12"
              disabled={!canEdit}
              value={draft.horizonte_meses}
              onChange={(e) => setDraft((c) => ({ ...c, horizonte_meses: Number(e.target.value) }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Estado del ciclo
            <select
              disabled={!canEdit}
              value={draft.estado}
              onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            >
              <option value="Abierto">Abierto</option>
              <option value="Cerrado">Cerrado</option>
              <option value="Ejecutivo">Ejecutivo</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${ESTADO_STYLE[control.estado] || ESTADO_STYLE.Abierto}`}>{control.estado}</span>
          {control.ultimo_mes_cerrado && <span>Último mes cerrado: <b className="text-slate-700">{control.ultimo_mes_cerrado}</b></span>}
          {control.usuario_responsable_nombre && <span>Responsable: <b className="text-slate-700">{control.usuario_responsable_nombre}</b></span>}
          {control.fecha_actualizacion && <span>Actualizado: <b className="text-slate-700">{new Date(control.fecha_actualizacion).toLocaleString("es-MX")}</b></span>}
        </div>

        {canEdit && dirty && (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horizonte visible actual</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {horizonte.map((m, i) => (
            <span key={i} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-700">{m.label}</span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consultar otro horizonte</p>
        <p className="mt-1 text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Solo para ver qué meses caerían en el horizonte a partir de otro mes — no cambia el ciclo real ni requiere guardar.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Mes de inicio a consultar
            <input
              type="month"
              value={consultaMes}
              onChange={(e) => setConsultaMes(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
            />
          </label>
          {consultaMes && (
            <button type="button" onClick={() => setConsultaMes("")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">
              Limpiar
            </button>
          )}
        </div>
        {consultaMes && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {horizonteConsulta.map((m, i) => (
              <span key={i} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-700">{m.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
