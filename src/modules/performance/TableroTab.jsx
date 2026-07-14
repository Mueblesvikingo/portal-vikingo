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
  getPreviousMonthInfo,
  formatKpiValue,
  formatDateTime,
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
    <div
      className="flex flex-col items-center rounded-2xl border p-3 shadow-sm"
      style={{ borderColor: `${color}3d`, background: `linear-gradient(180deg, ${color}14 0%, #ffffff 70%)` }}
    >
      <div className="relative" style={{ width: 132, height: 96 }}>
        <PieChart width={132} height={96}>
          <Pie
            data={data}
            cx="50%"
            cy={80}
            startAngle={180}
            endAngle={0}
            innerRadius={44}
            outerRadius={64}
            dataKey="value"
            stroke="none"
            cornerRadius={6}
          >
            <Cell fill={color} />
            <Cell fill="#e7e5df" />
          </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-x-0 text-center" style={{ top: 46 }}>
          <p className="text-xl font-black leading-none" style={{ color: status.color }}>{cumplimiento === null ? "—" : `${cumplimiento}%`}</p>
        </div>
      </div>
      <p className="mt-1 text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</p>
      <span
        className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
        style={{ backgroundColor: `${status.color}1f`, color: status.color }}
      >
        {status.label}
      </span>
    </div>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      {children}
    </div>
  );
}

export default function TableroTab({ kpis, resultados, anio, scope, canEdit, onUpdateKpi, onDeactivateKpi }) {
  const [openKpiId, setOpenKpiId] = useState(null);
  const isEstrategico = scope === "ESTRATEGICO";
  const mesAnteriorLabel = getPreviousMonthInfo().label;
  const groups = isEstrategico
    ? PERSPECTIVAS.map((p) => ({ label: p, color: PERSPECTIVA_COLOR[p], items: kpis.filter((k) => k.perspectiva === p) }))
    : [{ label: scope, color: PERSPECTIVA_COLOR.Financiera, items: kpis }];
  const colCount = canEdit ? 5 : 4;

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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Indicador</th>
              <th className="px-3 py-2 text-right text-white">Real <span className="font-bold normal-case text-white/40">({mesAnteriorLabel})</span></th>
              <th className="px-3 py-2 text-right">Meta <span className="font-bold normal-case text-white/40">({mesAnteriorLabel})</span></th>
              <th className="px-3 py-2 text-right">Cumpl.</th>
              {canEdit && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label}>
                {isEstrategico && (
                  <tr key={`${group.label}-header`}>
                    <td colSpan={colCount} className="px-3 py-1.5" style={{ background: `${group.color}14` }}>
                      <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: group.color }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                        {group.label}
                      </span>
                    </td>
                  </tr>
                )}
                {group.items.map((kpi) => {
                  const { real, meta, cumplimiento } = computeCumplimiento(resultados, kpi.id, anio);
                  const status = getCumplimientoStatus(cumplimiento);
                  const isOpen = openKpiId === kpi.id;
                  return (
                    <Fragment key={kpi.id}>
                      <tr className="border-b border-slate-50 transition hover:bg-slate-50/70">
                        <td className="px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${group.color}` }}>
                          <button
                            type="button"
                            onClick={() => setOpenKpiId(isOpen ? null : kpi.id)}
                            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left font-black text-slate-800 transition hover:bg-sky-50 hover:text-sky-700"
                          >
                            <span
                              className="inline-block text-[9px] transition-transform"
                              style={{ color: group.color, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                            >
                              ▸
                            </span>
                            {kpi.nombre_indicador}
                          </button>
                        </td>
                        <td className="px-3 py-1.5 text-right font-black text-slate-800">{formatKpiValue(real, kpi.unidad_medida)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{formatKpiValue(meta, kpi.unidad_medida)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-black" style={{ backgroundColor: `${status.color}1f`, color: status.color }}>
                            {cumplimiento === null ? "—" : `${cumplimiento}%`}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => onDeactivateKpi(kpi.id)}
                              title="Eliminar KPI"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                            >
                              ×
                            </button>
                          </td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td colSpan={colCount} className="px-4 py-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <DetailField label="Objetivo estratégico">
                                <EditableText value={kpi.objetivo_estrategico} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { objetivo_estrategico: v })} className="text-slate-700" />
                              </DetailField>
                              <DetailField label="Fórmula">
                                <EditableText value={kpi.formula_texto} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { formula_texto: v })} className="text-slate-700" />
                              </DetailField>
                              <DetailField label="Fuente">
                                <EditableText value={kpi.fuente_datos} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { fuente_datos: v })} className="text-slate-700" />
                              </DetailField>
                              <DetailField label="Responsable">
                                <EditableText value={kpi.responsable_rol} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { responsable_rol: v })} className="text-slate-700" />
                              </DetailField>
                              <DetailField label="Periodicidad">
                                <EditableSelect value={kpi.periodicidad} options={PERIODICIDAD_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { periodicidad: v })} />
                              </DetailField>
                              <DetailField label="Medida">
                                <EditableSelect value={kpi.unidad_medida} options={UNIDAD_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { unidad_medida: v })} />
                              </DetailField>
                              <DetailField label="Gráfico">
                                <EditableSelect value={kpi.tipo_grafico} options={TIPO_GRAFICO_OPTIONS} canEdit={canEdit} onSave={(v) => onUpdateKpi(kpi.id, { tipo_grafico: v })} />
                              </DetailField>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                              <p className="text-[9px] font-bold text-slate-400">
                                {kpi.updated_by_nombre ? `Última edición: ${kpi.updated_by_nombre} · ${formatDateTime(kpi.updated_at)}` : "Sin ediciones registradas"}
                              </p>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onDeactivateKpi(kpi.id)}
                                  className="rounded-lg border border-red-200 px-3 py-1 text-[10px] font-black text-red-500 transition hover:bg-red-50"
                                >
                                  Eliminar KPI
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
            {kpis.length === 0 && (
              <tr><td colSpan={colCount} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay KPIs para este tablero.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
