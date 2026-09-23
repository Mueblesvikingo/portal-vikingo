import { Fragment, useState } from "react";
import {
  MESES, PERSPECTIVAS, PERSPECTIVA_COLOR, formatKpiValue, getResultadoRow, formatDateTime,
  getWeeksInMonth, getMonthlyRealValue, getResultadoValue, getCumplimientoStatus, computeCumplimientoValue,
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
  const pct = computeCumplimientoValue(real, meta, kpi.sentido);
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
        <div title={`Promedio mensual: ${formatKpiValue(real, kpi.unidad_medida)} · Meta: ${formatKpiValue(meta, kpi.unidad_medida)} · Cumplimiento: ${status.label}`} className="mt-0.5 rounded px-1 py-0.5 text-center" style={{ background: `${status.color}18` }}>
          <p className="text-[7px] font-bold leading-tight text-slate-500">Prom. {formatKpiValue(real, kpi.unidad_medida)}</p>
          <p className="text-[8px] font-black leading-tight" style={{ color: status.color }}>Cumpl. {pct}%</p>
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

// Color de fondo por fila de KPI: puramente para no "perder" la fila al leer
// una tabla ancha — no es un estado (eso ya lo codifica el cumplimiento), así
// que la paleta es deliberadamente pastel/discreta. Cada usuario elige su
// propio color por KPI; se guarda en localStorage (por navegador, no en
// Supabase) para no mezclar preferencia visual de una persona con el dato
// real que sí deben compartir todos.
const ROW_COLOR_PALETTE = [
  { key: "sky", hex: "#E3EEFB" },
  { key: "mint", hex: "#E1F5EC" },
  { key: "peach", hex: "#FDECDD" },
  { key: "lavender", hex: "#EFE6FB" },
  { key: "sand", hex: "#F7F1E3" },
  { key: "rose", hex: "#FBE7EE" },
];
const ROW_COLOR_STORAGE_KEY = "portalVikingo.resultadosRowColors.v1";

function loadRowColors(namespace) {
  try {
    const all = JSON.parse(localStorage.getItem(ROW_COLOR_STORAGE_KEY) || "{}");
    return all[namespace] || {};
  } catch {
    return {};
  }
}

function saveRowColor(namespace, kpiId, colorKey) {
  try {
    const all = JSON.parse(localStorage.getItem(ROW_COLOR_STORAGE_KEY) || "{}");
    const scoped = { ...(all[namespace] || {}) };
    if (colorKey) scoped[kpiId] = colorKey;
    else delete scoped[kpiId];
    localStorage.setItem(ROW_COLOR_STORAGE_KEY, JSON.stringify({ ...all, [namespace]: scoped }));
  } catch {
    // localStorage no disponible (privado/bloqueado) — la elección solo dura la sesión en memoria.
  }
}

function RowColorPicker({ colorKey, onPick }) {
  const [open, setOpen] = useState(false);
  const current = ROW_COLOR_PALETTE.find((c) => c.key === colorKey);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        title="Color de la fila"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full border border-slate-300"
        style={{ background: current ? current.hex : "transparent" }}
      />
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-4 z-20 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-md">
            {ROW_COLOR_PALETTE.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.key === colorKey ? "Quitar color" : "Elegir este color"}
                onClick={() => { onPick(c.key === colorKey ? null : c.key); setOpen(false); }}
                className="h-3.5 w-3.5 rounded-full border transition"
                style={{ background: c.hex, borderColor: c.key === colorKey ? "#64748b" : "#e2e8f0" }}
              />
            ))}
          </span>
        </>
      )}
    </span>
  );
}

export default function ResultadosTab({ kpis, resultados, anio, scope, canEdit, canEditKpi = () => canEdit, onSaveResultado, namespace = "org" }) {
  const [rowColors, setRowColors] = useState(() => loadRowColors(namespace));
  const setRowColor = (kpiId, colorKey) => {
    setRowColors((prev) => {
      const next = { ...prev };
      if (colorKey) next[kpiId] = colorKey;
      else delete next[kpiId];
      return next;
    });
    saveRowColor(namespace, kpiId, colorKey);
  };
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
              {group.items.map((kpi) => {
                const rowColorHex = ROW_COLOR_PALETTE.find((c) => c.key === rowColors[kpi.id])?.hex || null;
                return (
                <Fragment key={kpi.id}>
                  <tr className="border-b border-slate-50 transition hover:bg-slate-50/70" style={rowColorHex ? { background: rowColorHex } : undefined}>
                    <td rowSpan={2} className={`sticky left-0 px-3 py-1.5 align-top font-black text-slate-800 ${rowColorHex ? "" : "bg-white"}`} style={{ boxShadow: `inset 3px 0 0 ${groupColor}`, background: rowColorHex || undefined }}>
                      {kpi.nombre_indicador}
                      {kpi.periodicidad === "Semanal" && (
                        <span className="ml-1.5 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0 text-[8px] font-black uppercase tracking-wide text-violet-600">Semanal</span>
                      )}
                      <RowColorPicker colorKey={rowColors[kpi.id]} onPick={(colorKey) => setRowColor(kpi.id, colorKey)} />
                    </td>
                    <td className="px-2 py-1 text-slate-400">Meta</td>
                    {VISIBLE_MESES.map(({ index }) => (
                      <td key={index} className="px-2 py-1">
                        <EditableValue kpi={kpi} mesIndex={index} tipo="meta" resultados={resultados} anio={anio} canEdit={canEditKpi(kpi)} onSave={onSaveResultado} />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100" style={rowColorHex ? { background: rowColorHex } : undefined}>
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
                );
              })}
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
