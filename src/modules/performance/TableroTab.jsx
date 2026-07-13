import { Fragment, useState } from "react";
import { PieChart, Pie, Cell } from "recharts";
import {
  PERSPECTIVAS,
  PERSPECTIVA_COLOR,
  UNIDAD_OPTIONS,
  TIPO_GRAFICO_OPTIONS,
  PERIODICIDAD_OPTIONS,
  computeCumplimiento,
  getCumplimientoStatus,
  formatKpiValue,
} from "./performanceHelpers";

function EditableText({ value, onSave, canEdit, className = "", placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (!canEdit) {
    return <span className={className}>{value || <span className="text-slate-300">{placeholder}</span>}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        className={`w-full rounded px-1 text-left transition hover:bg-sky-50 ${className}`}
      >
        {value || <span className="text-slate-300">{placeholder || "Clic para editar"}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setDraft(value || ""); setEditing(false); }
      }}
      className="w-full rounded border border-sky-300 bg-white px-1 text-[11px] font-bold text-slate-800 outline-none"
    />
  );
}

function EditableSelect({ value, options, onSave, canEdit, labelFor = (v) => v }) {
  if (!canEdit) return <span>{labelFor(value)}</span>;
  return (
    <select
      value={value || ""}
      onChange={(event) => onSave(event.target.value)}
      className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
      ))}
    </select>
  );
}

function GaugeCard({ label, cumplimiento, color }) {
  const status = getCumplimientoStatus(cumplimiento);
  const value = cumplimiento === null || cumplimiento === undefined ? 0 : Math.min(cumplimiento, 100);
  const data = [{ name: "avance", value }, { name: "resto", value: Math.max(0, 100 - value) }];
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative">
        <PieChart width={120} height={80}>
          <Pie data={data} startAngle={180} endAngle={0} innerRadius={38} outerRadius={54} dataKey="value" stroke="none">
            <Cell fill={color} />
            <Cell fill="#e1e0d9" />
          </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-x-0 top-[38px] text-center">
          <p className="text-lg font-black" style={{ color: status.color }}>{cumplimiento === null ? "—" : `${cumplimiento}%`}</p>
        </div>
      </div>
      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-[9px] font-bold" style={{ color: status.color }}>{status.label}</p>
    </div>
  );
}

export default function TableroTab({ kpis, resultados, anio, scope, canEdit, onUpdateKpi, onCreateKpi, onDeactivateKpi }) {
  const isEstrategico = scope === "ESTRATEGICO";
  const groups = isEstrategico
    ? PERSPECTIVAS.map((p) => ({ label: p, color: PERSPECTIVA_COLOR[p], items: kpis.filter((k) => k.perspectiva === p) }))
    : [{ label: scope, color: PERSPECTIVA_COLOR.Financiera, items: kpis }];

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${isEstrategico ? "md:grid-cols-4" : "md:grid-cols-1"}`}>
        {groups.map((group) => {
          const groupCumplimientos = group.items
            .map((k) => computeCumplimiento(resultados, k.id, anio).cumplimiento)
            .filter((v) => v !== null && v !== undefined);
          const avg = groupCumplimientos.length
            ? Math.round(groupCumplimientos.reduce((a, b) => a + b, 0) / groupCumplimientos.length)
            : null;
          return <GaugeCard key={group.label} label={group.label} cumplimiento={avg} color={group.color} />;
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-3 py-2">Objetivo estratégico</th>
              <th className="px-3 py-2">Indicador</th>
              <th className="px-3 py-2">Fórmula</th>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Periodicidad</th>
              <th className="px-3 py-2">Medida</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Gráfico</th>
              <th className="px-3 py-2 text-right">Real</th>
              <th className="px-3 py-2 text-right">Meta</th>
              <th className="px-3 py-2 text-right">Cumpl.</th>
              {canEdit && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label}>
                {isEstrategico && (
                  <tr key={`${group.label}-header`} className="bg-slate-50/60">
                    <td colSpan={canEdit ? 12 : 11} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: group.color }}>
                      {group.label}
                    </td>
                  </tr>
                )}
                {group.items.map((kpi) => {
                  const { real, meta, cumplimiento } = computeCumplimiento(resultados, kpi.id, anio);
                  const status = getCumplimientoStatus(cumplimiento);
                  return (
                    <tr key={kpi.id} className="border-b border-slate-50 hover:bg-slate-50/40">
                      <td className="px-3 py-1.5"><EditableText value={kpi.objetivo_estrategico} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { objetivo_estrategico: v })} /></td>
                      <td className="px-3 py-1.5 font-black text-slate-800"><EditableText value={kpi.nombre_indicador} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { nombre_indicador: v })} /></td>
                      <td className="px-3 py-1.5 text-slate-500"><EditableText value={kpi.formula_texto} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { formula_texto: v })} /></td>
                      <td className="px-3 py-1.5 text-slate-500"><EditableText value={kpi.fuente_datos} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { fuente_datos: v })} /></td>
                      <td className="px-3 py-1.5"><EditableSelect value={kpi.periodicidad} options={PERIODICIDAD_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { periodicidad: v })} /></td>
                      <td className="px-3 py-1.5"><EditableSelect value={kpi.unidad_medida} options={UNIDAD_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { unidad_medida: v })} /></td>
                      <td className="px-3 py-1.5"><EditableText value={kpi.responsable_rol} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { responsable_rol: v })} /></td>
                      <td className="px-3 py-1.5"><EditableSelect value={kpi.tipo_grafico} options={TIPO_GRAFICO_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { tipo_grafico: v })} /></td>
                      <td className="px-3 py-1.5 text-right font-black text-slate-800">{formatKpiValue(real, kpi.unidad_medida)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{formatKpiValue(meta, kpi.unidad_medida)}</td>
                      <td className="px-3 py-1.5 text-right"><span className="rounded-full border px-2 py-0.5 text-[9px] font-black" style={{ borderColor: status.color, color: status.color }}>{cumplimiento === null ? "—" : `${cumplimiento}%`}</span></td>
                      {canEdit && (
                        <td className="px-3 py-1.5 text-right">
                          <button type="button" onClick={() => onDeactivateKpi(kpi.id)} title="Quitar KPI" className="flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500">×</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {kpis.length === 0 && (
              <tr><td colSpan={canEdit ? 12 : 11} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay KPIs para este tablero.</td></tr>
            )}
          </tbody>
        </table>
        {canEdit && (
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => onCreateKpi({ perspectiva: isEstrategico ? PERSPECTIVAS[0] : null, macroproceso: isEstrategico ? null : scope, ambito: isEstrategico ? "estrategico" : "tactico" })}
              className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
            >
              + Agregar KPI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
