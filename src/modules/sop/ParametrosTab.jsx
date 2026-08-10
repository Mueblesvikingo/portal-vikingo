import { useState } from "react";

function Field({ label, children, note }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
      {children}
      {note && <span className="mt-1 block text-[9px] font-bold normal-case tracking-normal text-slate-400">{note}</span>}
    </label>
  );
}

const inputClass = "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400";

export default function ParametrosTab({ parametros, canEditOperacion, canEditFinanciero, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...parametros }));
  const [saving, setSaving] = useState(false);

  if (!parametros) return <div className="p-6 text-center text-[11px] font-bold text-slate-300">Cargando parámetros...</div>;

  function set(field, value) {
    setDraft((c) => ({ ...c, [field]: value }));
  }

  const dirty = Object.keys(draft).some((key) => String(draft[key] ?? "") !== String(parametros[key] ?? ""));

  async function handleSave() {
    setSaving(true);
    await onSave(parametros.id, draft);
    setSaving(false);
  }

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold text-amber-700">
        Panel de control único: aquí se fijan las palancas vigentes del ciclo. El Dashboard y el Plan de venta se calculan a partir de estos valores.
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capacidad y mezcla</p>
        <p className="mt-1 text-[9px] font-bold normal-case tracking-normal text-slate-400">Alimenta Plan de operación — solo Director General y Gerente de Operaciones pueden editar esta sección.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="Escenario de capacidad">
            <select disabled={!canEditOperacion} value={draft.escenario_capacidad} onChange={(e) => set("escenario_capacidad", e.target.value)} className={inputClass}>
              <option value="1 turno">1 turno</option>
              <option value="2 turnos">2 turnos</option>
            </select>
          </Field>
          <Field label="Capacidad tapicería 1 turno (pzas/mes)">
            <input type="number" disabled={!canEditOperacion} value={draft.capacidad_tapiceria_1_turno ?? ""} onChange={(e) => set("capacidad_tapiceria_1_turno", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Capacidad tapicería 2 turnos (pzas/mes)">
            <input type="number" disabled={!canEditOperacion} value={draft.capacidad_tapiceria_2_turnos ?? ""} placeholder="Pendiente de confirmar" onChange={(e) => set("capacidad_tapiceria_2_turnos", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Escenario de mezcla comercial activo">
            <input disabled={!canEditOperacion} value={draft.escenario_mezcla ?? ""} onChange={(e) => set("escenario_mezcla", e.target.value)} className={inputClass} />
          </Field>
          <Field label="% Salas objetivo según mezcla activa">
            <input type="number" step="0.01" disabled={!canEditOperacion} value={draft.pct_salas_objetivo ?? ""} onChange={(e) => set("pct_salas_objetivo", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Escenario de venta activo" note="Determina qué escenario (Base/Objetivo) alimenta el Dashboard.">
            <select disabled={!canEditOperacion} value={draft.escenario_venta} onChange={(e) => set("escenario_venta", e.target.value)} className={inputClass}>
              <option value="Base">Base</option>
              <option value="Objetivo">Objetivo</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Factores de consumo de tapicería</p>
        <p className="mt-1 text-[9px] font-bold normal-case tracking-normal text-slate-400">Unidades de tapicería por pieza vendida, por línea — alimentan la carga de Plan de operación. Solo Director General y Gerente de Operaciones pueden editar esta sección.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="Factor — Bases">
            <input type="number" step="0.01" disabled={!canEditOperacion} value={draft.factor_consumo_bases ?? ""} onChange={(e) => set("factor_consumo_bases", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Factor — Recámaras">
            <input type="number" step="0.01" disabled={!canEditOperacion} value={draft.factor_consumo_recamaras ?? ""} onChange={(e) => set("factor_consumo_recamaras", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Factor — Salas">
            <input type="number" step="0.01" disabled={!canEditOperacion} value={draft.factor_consumo_salas ?? ""} onChange={(e) => set("factor_consumo_salas", Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Márgenes y finanzas</p>
        <p className="mt-1 text-[9px] font-bold normal-case tracking-normal text-slate-400">Alimenta Plan financiero — solo Finanzas (Samantha) puede editar esta sección.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="Margen bruto Salas">
            <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_salas ?? ""} onChange={(e) => set("margen_bruto_salas", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Margen bruto Bases">
            <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_bases ?? ""} onChange={(e) => set("margen_bruto_bases", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Margen bruto Recámaras" note="Sin dato oficial — usar referencia de Contabilidad.">
            <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_recamaras ?? ""} placeholder="Pendiente" onChange={(e) => set("margen_bruto_recamaras", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Gastos fijos mensuales">
            <input type="number" disabled={!canEditFinanciero} value={draft.gastos_fijos_mensuales ?? ""} onChange={(e) => set("gastos_fijos_mensuales", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Liquidez meta (días de cobertura)">
            <input type="number" disabled={!canEditFinanciero} value={draft.liquidez_meta_dias ?? ""} onChange={(e) => set("liquidez_meta_dias", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Liquidez meta (% sobre ventas)">
            <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.liquidez_meta_pct ?? ""} onChange={(e) => set("liquidez_meta_pct", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Meta concentración 2 clientes principales">
            <input type="number" disabled={!canEditFinanciero} value={draft.meta_concentracion_2_clientes ?? ""} onChange={(e) => set("meta_concentracion_2_clientes", Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
      </div>

      {(canEditOperacion || canEditFinanciero) && dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando..." : "Guardar parámetros"}
          </button>
        </div>
      )}
    </div>
  );
}
