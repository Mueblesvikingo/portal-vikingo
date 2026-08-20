import { Fragment, useState } from "react";
import {
  MESES, PERSPECTIVAS, PERSPECTIVA_COLOR, formatKpiValue, getResultadoRow, formatDateTime,
  getWeeksInMonth, getMonthlyRealValue, getResultadoValue, getCumplimientoStatus,
} from "./performanceHelpers";

function EditableValue({ kpi, mesIndex, tipo, semana = null, resultados, anio, canEdit, onSave, compact = false }) {
  const [editing, setEditing] = useState(false);
  const row = getResultadoRow(resultados, kpi.id, anio, mesIndex + 1, tipo, semana);
  const rawValue = row ? Number(row.valor) : null;
  const [draft, setDraft] = useState(rawValue === null ? "" : String(kpi.unidad_medida === "porcentaje" ? rawValue * 100 : rawValue));
  const traceTitle = row?.updated_by_nombre ? `Capturado por ${row.updated_by_nombre} · ${formatDateTime(row.updated_at)}` : "Sin captura manual registrada";
  const sizeClass = compact ? "text-[8px] py-0" : "text-[10px] py-0.5";

  if (!canEdit) {
    return <span title={traceTitle} className={`font-bold text-slate-600 ${sizeClass}`}>{formatKpiValue(rawValue, kpi.unidad_medida)}</span>;
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
        className={`w-full rounded px-1 text-right font-bold text-slate-600 transition hover:bg-sky-50 ${sizeClass}`}
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
        onSave({ kpiId: kpi.id, anio, mes: mesIndex + 1, semana, tipo, valor });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setEditing(false);
      }}
      className={`w-full rounded border border-sky-300 bg-white px-1 text-right font-bold text-slate-800 outline-none ${sizeClass}`}
    />
  );
}

// Un KPI de captura semanal muestra una mini-celda por cada semana del mes
// (4 o 5 según corresponda — ver getWeeksInMonth) en vez de un solo valor.
// El "Real" mensual que ve el gauge es el promedio de esas semanas; aquí
// además se muestra ese % contra la Meta mensual, para no tener que ir a
// otra pantalla a ver si el mes va bien.
function WeeklyRealCells({ kpi, mesIndex, resultados, anio, canEdit, onSave }) {
  const mes = mesIndex + 1;
  const totalSemanas = getWeeksInMonth(anio, mes);
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1);
  const real = getMonthlyRealValue(resultados, kpi, anio, mes);
  const meta = getResultadoValue(resultados, kpi.id, anio, mes, "meta");
  const pct = real !== null && meta ? Math.round((real / meta) * 100) : null;
  const status = getCumplimientoStatus(pct);

  return (
    <div>
      <div className="grid grid-cols-2 gap-0.5">
        {semanas.map((semana) => (
          <div key={semana} className="flex items-center gap-0.5">
            <span className="text-[7px] font-black text-slate-300">S{semana}</span>
            <EditableValue kpi={kpi} mesIndex={mesIndex} tipo="real" semana={semana} resultados={resultados} anio={anio} canEdit={canEdit} onSave={onSave} compact />
          </div>
        ))}
      </div>
      {pct !== null && (
        <div title={`Real ${real.toFixed(1)} vs Meta ${meta} · ${status.label}`} className="mt-0.5 rounded px-1 py-0 text-center text-[8px] font-black" style={{ color: status.color, background: `${status.color}18` }}>
          {pct}%
        </div>
      )}
    </div>
  );
}

// La tabla de captura ya no necesita Ene-Jul: por pedido explícito, solo se
// captura de Agosto en adelante. El resto del módulo (cumplimiento, gráficas,
// mes anterior) sigue usando MESES completo — esto solo acorta lo que se
// muestra/edita aquí.
const VISIBLE_MESES = MESES.map((label, index) => ({ label, index })).slice(7);

export default function ResultadosTab({ kpis, resultados, anio, scope, canEdit, canEditKpi = () => canEdit, onSaveResultado }) {
  const isEstrategico = scope === "ESTRATEGICO";
  const groups = isEstrategico
    ? PERSPECTIVAS.map((p) => ({ label: p, items: kpis.filter((k) => k.perspectiva === p) }))
    : [
      { label: "Tácticos", items: kpis.filter((k) => k.ambito === "tactico") },
      { label: "Operativos", items: kpis.filter((k) => k.ambito === "operativo") },
    ].filter((group) => group.items.length > 0);
  const showGroupHeader = isEstrategico || groups.length > 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
            <th className="sticky left-0 bg-[#001225] px-3 py-2 text-white">KPI</th>
            <th className="px-2 py-2">Tipo</th>
            {VISIBLE_MESES.map(({ label }) => <th key={label} className="px-2 py-2 text-right">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupColor = PERSPECTIVA_COLOR[group.label] || (group.label === "Operativos" ? "#4a3aa7" : "#203f73");
            return (
            <Fragment key={group.label}>
              {showGroupHeader && (
                <tr>
                  <td colSpan={2 + VISIBLE_MESES.length} className="px-3 py-1.5" style={{ background: `${groupColor}14` }}>
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
                    <td rowSpan={2} className="sticky left-0 bg-white px-3 py-1.5 align-top font-black text-slate-800" style={{ boxShadow: `inset 3px 0 0 ${groupColor}` }}>
                      {kpi.nombre_indicador}
                      {kpi.periodicidad === "Semanal" && (
                        <span className="ml-1.5 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0 text-[8px] font-black uppercase tracking-wide text-violet-600">Semanal</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-slate-400">Meta</td>
                    {VISIBLE_MESES.map(({ index }) => (
                      <td key={index} className="px-2 py-1">
                        <EditableValue kpi={kpi} mesIndex={index} tipo="meta" resultados={resultados} anio={anio} canEdit={canEditKpi(kpi)} onSave={onSaveResultado} />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1 text-slate-400">Real</td>
                    {VISIBLE_MESES.map(({ index }) => (
                      <td key={index} className="px-2 py-1">
                        {kpi.periodicidad === "Semanal" ? (
                          <WeeklyRealCells kpi={kpi} mesIndex={index} resultados={resultados} anio={anio} canEdit={canEditKpi(kpi)} onSave={onSaveResultado} />
                        ) : (
                          <EditableValue kpi={kpi} mesIndex={index} tipo="real" resultados={resultados} anio={anio} canEdit={canEditKpi(kpi)} onSave={onSaveResultado} />
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </Fragment>
            );
          })}
          {kpis.length === 0 && (
            <tr><td colSpan={2 + VISIBLE_MESES.length} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay KPIs para capturar resultados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
