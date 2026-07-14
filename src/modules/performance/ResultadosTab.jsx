import { Fragment, useState } from "react";
import { MESES, PERSPECTIVAS, PERSPECTIVA_COLOR, formatKpiValue, getResultadoRow, formatDateTime } from "./performanceHelpers";

function EditableValue({ kpi, mesIndex, tipo, resultados, anio, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const row = getResultadoRow(resultados, kpi.id, anio, mesIndex + 1, tipo);
  const rawValue = row ? Number(row.valor) : null;
  const [draft, setDraft] = useState(rawValue === null ? "" : String(kpi.unidad_medida === "porcentaje" ? rawValue * 100 : rawValue));
  const traceTitle = row?.updated_by_nombre ? `Capturado por ${row.updated_by_nombre} · ${formatDateTime(row.updated_at)}` : "Sin captura manual registrada";

  if (!canEdit) {
    return <span title={traceTitle} className="text-[10px] font-bold text-slate-600">{formatKpiValue(rawValue, kpi.unidad_medida)}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        title={traceTitle}
        onClick={() => {
          setDraft(rawValue === null ? "" : String(kpi.unidad_medida === "porcentaje" ? rawValue * 100 : rawValue));
          setEditing(true);
        }}
        className="w-full rounded px-1 py-0.5 text-right text-[10px] font-bold text-slate-600 transition hover:bg-sky-50"
      >
        {formatKpiValue(rawValue, kpi.unidad_medida)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft === "") return;
        const num = Number(draft);
        if (!Number.isFinite(num)) return;
        const valor = kpi.unidad_medida === "porcentaje" ? num / 100 : num;
        onSave({ kpiId: kpi.id, anio, mes: mesIndex + 1, tipo, valor });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setEditing(false);
      }}
      className="w-16 rounded border border-sky-300 bg-white px-1 py-0.5 text-right text-[10px] font-bold text-slate-800 outline-none"
    />
  );
}

export default function ResultadosTab({ kpis, resultados, anio, scope, canEdit, onSaveResultado }) {
  const isEstrategico = scope === "ESTRATEGICO";
  const groups = isEstrategico
    ? PERSPECTIVAS.map((p) => ({ label: p, items: kpis.filter((k) => k.perspectiva === p) }))
    : [{ label: scope, items: kpis }];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1100px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
            <th className="sticky left-0 bg-[#001225] px-3 py-2 text-white">KPI</th>
            <th className="px-2 py-2">Tipo</th>
            {MESES.map((m) => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupColor = PERSPECTIVA_COLOR[group.label] || PERSPECTIVA_COLOR.Financiera;
            return (
            <Fragment key={group.label}>
              {isEstrategico && (
                <tr>
                  <td colSpan={14} className="px-3 py-1.5" style={{ background: `${groupColor}14` }}>
                    <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: groupColor }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: groupColor }} />
                      {group.label}
                    </span>
                  </td>
                </tr>
              )}
              {group.items.map((kpi) => (
                <Fragment key={kpi.id}>
                  <tr className="border-b border-slate-50 transition hover:bg-slate-50/70">
                    <td rowSpan={2} className="sticky left-0 bg-white px-3 py-1.5 align-top font-black text-slate-800" style={{ boxShadow: `inset 3px 0 0 ${groupColor}` }}>{kpi.nombre_indicador}</td>
                    <td className="px-2 py-1 text-slate-400">Meta</td>
                    {MESES.map((_, i) => (
                      <td key={i} className="px-2 py-1">
                        <EditableValue kpi={kpi} mesIndex={i} tipo="meta" resultados={resultados} anio={anio} canEdit={canEdit} onSave={onSaveResultado} />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1 text-slate-400">Real</td>
                    {MESES.map((_, i) => (
                      <td key={i} className="px-2 py-1">
                        <EditableValue kpi={kpi} mesIndex={i} tipo="real" resultados={resultados} anio={anio} canEdit={canEdit} onSave={onSaveResultado} />
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </Fragment>
            );
          })}
          {kpis.length === 0 && (
            <tr><td colSpan={14} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay KPIs para capturar resultados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
