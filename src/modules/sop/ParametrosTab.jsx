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

const TONE = {
  sky: { border: "border-sky-200", header: "bg-sky-50/60", dot: "bg-sky-400", title: "text-sky-700", input: "border-sky-200 bg-sky-50/40 focus:border-sky-400" },
  violet: { border: "border-violet-200", header: "bg-violet-50/60", dot: "bg-violet-400", title: "text-violet-700", input: "border-violet-200 bg-violet-50/40 focus:border-violet-400" },
  emerald: { border: "border-emerald-200", header: "bg-emerald-50/60", dot: "bg-emerald-400", title: "text-emerald-700", input: "border-emerald-200 bg-emerald-50/40 focus:border-emerald-400" },
};

function inputClass(tone) {
  return `mt-1 h-10 w-full rounded-xl border ${TONE[tone].input} px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none transition disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`;
}

function Section({ tone, title, subtitle, children }) {
  const t = TONE[tone];
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${t.border}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${t.header}`}>
        <span className={`h-2 w-2 rounded-full ${t.dot}`} />
        <p className={`text-[10px] font-black uppercase tracking-widest ${t.title}`}>{title}</p>
      </div>
      <div className="p-4">
        {subtitle && <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">{subtitle}</p>}
        <div className="mt-2 grid gap-3 md:grid-cols-3">{children}</div>
      </div>
    </div>
  );
}

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

      <Section tone="sky" title="Capacidad y mezcla" subtitle="Alimenta Plan de operación — solo Director General y Gerente de Operaciones pueden editar esta sección.">
        <Field label="Escenario de capacidad">
          <select disabled={!canEditOperacion} value={draft.escenario_capacidad} onChange={(e) => set("escenario_capacidad", e.target.value)} className={inputClass("sky")}>
            <option value="1 turno">1 turno</option>
            <option value="2 turnos">2 turnos</option>
          </select>
        </Field>
        <Field label="Capacidad tapicería 1 turno (pzas/mes)">
          <input type="number" disabled={!canEditOperacion} value={draft.capacidad_tapiceria_1_turno ?? ""} onChange={(e) => set("capacidad_tapiceria_1_turno", Number(e.target.value))} className={inputClass("sky")} />
        </Field>
        <Field label="Capacidad tapicería 2 turnos (pzas/mes)">
          <input type="number" disabled={!canEditOperacion} value={draft.capacidad_tapiceria_2_turnos ?? ""} placeholder="Pendiente de confirmar" onChange={(e) => set("capacidad_tapiceria_2_turnos", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("sky")} />
        </Field>
        <Field label="Escenario de mezcla comercial activo">
          <input disabled={!canEditOperacion} value={draft.escenario_mezcla ?? ""} onChange={(e) => set("escenario_mezcla", e.target.value)} className={inputClass("sky")} />
        </Field>
        <Field label="% Salas objetivo según mezcla activa">
          <input type="number" step="0.01" disabled={!canEditOperacion} value={draft.pct_salas_objetivo ?? ""} onChange={(e) => set("pct_salas_objetivo", Number(e.target.value))} className={inputClass("sky")} />
        </Field>
        <Field label="Escenario de venta activo" note="Determina qué escenario (Base/Objetivo) alimenta el Dashboard.">
          <select disabled={!canEditOperacion} value={draft.escenario_venta} onChange={(e) => set("escenario_venta", e.target.value)} className={inputClass("sky")}>
            <option value="Base">Base</option>
            <option value="Objetivo">Objetivo</option>
          </select>
        </Field>
        <Field label="Días hábiles del mes" note="Se usa para calcular capacidad de mano de obra e infraestructura en Plan de operación.">
          <input type="number" step="1" disabled={!canEditOperacion} value={draft.dias_habiles_mes ?? ""} placeholder="Ej. 24" onChange={(e) => set("dias_habiles_mes", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("sky")} />
        </Field>
        <Field label="Horas-hombre por unidad de complejidad" note="Estimación: cuántas horas-hombre toma fabricar 1 unidad de complejidad (≈ una Base Oslo Matrimonial).">
          <input type="number" step="0.1" disabled={!canEditOperacion} value={draft.horas_por_unidad_complejidad ?? ""} placeholder="Ej. 2.5" onChange={(e) => set("horas_por_unidad_complejidad", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("sky")} />
        </Field>
      </Section>

      <Section tone="violet" title="Precio promedio de referencia (por línea)" subtitle="Solo referencia rápida para estimaciones — no reemplaza el precio por SKU que se captura en Plan de venta. Solo Finanzas (Samantha) puede editar esta sección.">
        <Field label="Precio promedio — Bases">
          <input type="number" step="1" disabled={!canEditFinanciero} value={draft.precio_promedio_bases ?? ""} onChange={(e) => set("precio_promedio_bases", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("violet")} />
        </Field>
        <Field label="Precio promedio — Recámaras">
          <input type="number" step="1" disabled={!canEditFinanciero} value={draft.precio_promedio_recamaras ?? ""} onChange={(e) => set("precio_promedio_recamaras", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("violet")} />
        </Field>
        <Field label="Precio promedio — Salas">
          <input type="number" step="1" disabled={!canEditFinanciero} value={draft.precio_promedio_salas ?? ""} onChange={(e) => set("precio_promedio_salas", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("violet")} />
        </Field>
      </Section>

      <Section tone="emerald" title="Márgenes y finanzas" subtitle="Alimenta Plan financiero — solo Finanzas (Samantha) puede editar esta sección.">
        <Field label="Margen bruto Salas">
          <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_salas ?? ""} onChange={(e) => set("margen_bruto_salas", Number(e.target.value))} className={inputClass("emerald")} />
        </Field>
        <Field label="Margen bruto Bases">
          <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_bases ?? ""} onChange={(e) => set("margen_bruto_bases", Number(e.target.value))} className={inputClass("emerald")} />
        </Field>
        <Field label="Margen bruto Recámaras" note="Sin dato oficial — usar referencia de Contabilidad.">
          <input type="number" step="0.001" disabled={!canEditFinanciero} value={draft.margen_bruto_recamaras ?? ""} placeholder="Pendiente" onChange={(e) => set("margen_bruto_recamaras", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("emerald")} />
        </Field>
        <Field label="Gastos fijos mensuales">
          <input type="number" disabled={!canEditFinanciero} value={draft.gastos_fijos_mensuales ?? ""} onChange={(e) => set("gastos_fijos_mensuales", Number(e.target.value))} className={inputClass("emerald")} />
        </Field>
        <Field label="Meta estratégica de venta anual" note="Debe coincidir con la meta vigente en Despliegue Estratégico (objetivo Ventas).">
          <input type="number" disabled={!canEditFinanciero} value={draft.meta_venta_anual ?? ""} placeholder="Ej. 74000000" onChange={(e) => set("meta_venta_anual", e.target.value === "" ? null : Number(e.target.value))} className={inputClass("emerald")} />
        </Field>
      </Section>

      {(canEditOperacion || canEditFinanciero) && dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white transition hover:bg-[#001a38] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando..." : "Guardar parámetros"}
          </button>
        </div>
      )}
    </div>
  );
}
