import { useState } from "react";

// Diagrama de Gantt del Tablero de Proyectos — mismo diseño y mecánica de
// línea de tiempo que el Gantt de metas de portal-crisali (src/modules/goals/GanttView.jsx),
// adaptado a los datos reales de pmo_proyectos: no hay fecha_inicio en el
// catálogo (solo fecha_hito), así que cada proyecto se dibuja como un
// bloque de un solo día sobre su fecha de hito — igual que el propio
// GanttView de origen hace cuando a una meta le falta start_date. Versión
// de solo lectura (sin arrastrar/redimensionar) por pedido explícito.
const DAY_MS = 86400000;
const ROW_H = 40;
const SEMAFORO_COLOR = { Verde: "#10b981", Amarillo: "#f59e0b", Rojo: "#ef4444" };
const DEFAULT_COLOR = "#64748b";

function toDate(s) {
  return new Date(`${s}T00:00:00`);
}
function addDays(d, n) {
  return new Date(d.getTime() + n * DAY_MS);
}
function fmtShort(d) {
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}
function mondayOnOrAfter(d) {
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  return new Date(d.getTime() + diff * DAY_MS);
}

export default function PmoGanttView({ proyectos }) {
  const [openId, setOpenId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const dated = (proyectos || []).filter((p) => p.fecha_hito);
  const undated = (proyectos || []).filter((p) => !p.fecha_hito);

  const rows = dated.map((p) => {
    const end = toDate(p.fecha_hito);
    return { p, start: end, end };
  });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
        <span className="text-3xl text-slate-200">📅</span>
        <p className="text-sm font-bold text-slate-400">Sin proyectos con fecha de hito todavía</p>
        <p className="max-w-xs text-xs text-slate-400">Captúrale una "Fecha" (próximo hito) a los proyectos del tablero para verlos aquí como barras.</p>
      </div>
    );
  }

  let minDate = new Date(Math.min(...rows.map((r) => r.start.getTime())));
  let maxDate = new Date(Math.max(...rows.map((r) => r.end.getTime())));
  minDate = new Date(minDate.getTime() - 2 * DAY_MS);
  maxDate = new Date(maxDate.getTime() + 5 * DAY_MS);
  const totalDays = Math.max(14, Math.round((maxDate - minDate) / DAY_MS) + 1);
  const pxPerDay = totalDays > 150 ? 10 : totalDays > 90 ? 14 : totalDays > 45 ? 20 : 28;
  const timelineWidth = totalDays * pxPerDay;
  const dayOffset = (d) => Math.round((d - minDate) / DAY_MS);

  const months = [];
  let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = dayOffset(today);
  const showToday = todayOffset >= 0 && todayOffset <= totalDays;

  const gridStepDays = pxPerDay >= 20 ? 1 : 7;
  const dayTicks = [];
  if (gridStepDays === 1) {
    for (let i = 0; i <= totalDays; i++) dayTicks.push(i);
  } else {
    let offset = dayOffset(mondayOnOrAfter(minDate));
    while (offset <= totalDays) {
      dayTicks.push(offset);
      offset += gridStepDays;
    }
  }
  const gridPeriodPx = gridStepDays * pxPerDay;
  const gridPhasePx = 220 + (dayTicks[0] ?? 0) * pxPerDay;

  rows.sort((a, b) => a.start - b.start);
  const counts = { Verde: 0, Amarillo: 0, Rojo: 0 };
  dated.forEach((p) => { if (counts[p.semaforo] !== undefined) counts[p.semaforo] += 1; });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl bg-gradient-to-br from-sky-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-sky-500">✨</span>
          <p className="text-sm font-black text-slate-900">Diagrama de Gantt</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Verde", "Amarillo", "Rojo"].filter((k) => counts[k] > 0).map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `${SEMAFORO_COLOR[k]}18`, color: SEMAFORO_COLOR[k] }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEMAFORO_COLOR[k] }} />
              {k} · {counts[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-visible">
        <div style={{ minWidth: 220 + timelineWidth }}>
          <div className="sticky top-0 z-20 bg-white">
            <div className="flex border-b border-slate-100">
              <div className="sticky left-0 z-30 w-[220px] shrink-0 bg-white px-3 pb-1 pt-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Proyecto</p>
              </div>
              <div className="relative" style={{ width: timelineWidth, height: 22 }}>
                {months.map((mo, i) => {
                  const offset = dayOffset(mo);
                  if (offset < 0) return null;
                  return (
                    <div key={i} className="absolute top-0 bottom-0 flex items-center border-l border-slate-200 pl-1.5" style={{ left: offset * pxPerDay }}>
                      <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-slate-500">{mo.toLocaleDateString("es", { month: "short", year: "2-digit" })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex border-b border-slate-100 bg-slate-50/60">
              <div className="sticky left-0 z-30 w-[220px] shrink-0 bg-slate-50/60 px-3 py-1">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-300">{gridStepDays === 1 ? "Días" : "Semanas (lunes)"}</p>
              </div>
              <div className="relative" style={{ width: timelineWidth, height: 18 }}>
                {dayTicks.map((offset) => {
                  const d = new Date(minDate.getTime() + offset * DAY_MS);
                  const isToday = offset === todayOffset;
                  return (
                    <span key={offset} className="absolute top-0 whitespace-nowrap text-[9px] font-bold" style={{ left: offset * pxPerDay + 2, color: isToday ? "#ef4444" : "#94a3b8", fontWeight: isToday ? 900 : 700 }}>
                      {d.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative" style={{ backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.3) 0, rgba(148,163,184,0.3) 1px, transparent 1px, transparent ${gridPeriodPx}px)`, backgroundPosition: `${gridPhasePx}px 0` }}>
            {showToday && (
              <div className="pointer-events-none absolute top-0 bottom-0 z-10" style={{ left: 220 + todayOffset * pxPerDay }}>
                <div className="h-full w-px bg-red-400" style={{ boxShadow: "0 0 10px #f8717188" }} />
                <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded-full bg-red-500 px-1.5 py-[1px] text-[8px] font-black text-white shadow-sm">HOY</span>
              </div>
            )}

            {rows.map(({ p, start, end }, rowIndex) => {
              const stripe = rowIndex % 2 === 1;
              const barColor = SEMAFORO_COLOR[p.semaforo] || DEFAULT_COLOR;
              const isOpen = openId === p.id;
              const isHovered = hoveredId === p.id;
              const startOffset = dayOffset(start);
              const endOffset = dayOffset(end);
              const left = startOffset * pxPerDay;
              const width = Math.max(pxPerDay * 1.4, (endOffset - startOffset + 1) * pxPerDay + 40);
              const daysLeft = Math.round((end - today) / DAY_MS);
              const done = Number(p.avance_porcentaje) >= 100 || p.cerrado;
              const dueSoon = !done && daysLeft >= 0 && daysLeft <= 3;
              const progressPct = done ? 100 : Math.max(0, Math.min(100, Number(p.avance_porcentaje) || 0));

              return (
                <div key={p.id}>
                  <div
                    className="flex items-stretch border-b border-slate-50 hover:bg-slate-50/60"
                    style={{ height: ROW_H, background: stripe ? "#eef2f9" : undefined }}
                  >
                    <div className="sticky left-0 z-10 flex w-[220px] min-w-0 shrink-0 items-center gap-1.5 px-3" style={{ background: stripe ? "#eef2f9" : "#fff" }}>
                      <button type="button" onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))} className="shrink-0" title={done ? "Cerrado / 100% avance" : "En curso"}>
                        {done ? (
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white" style={{ background: barColor }}>✓</span>
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                        )}
                      </button>
                      <span className={`truncate text-[11px] font-bold ${done ? "text-slate-300 line-through" : "text-slate-700"}`} title={p.nombre}>{p.nombre}</span>
                    </div>
                    <div className="relative" style={{ width: timelineWidth, height: ROW_H }}>
                      {dueSoon && <span className="absolute animate-pulse rounded-full" style={{ left, width: 26, height: 26, top: (ROW_H - 26) / 2, background: `${barColor}33` }} />}
                      <button
                        type="button"
                        onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
                        onMouseEnter={() => setHoveredId(p.id)}
                        onMouseLeave={() => setHoveredId((h) => (h === p.id ? null : h))}
                        className="group/bar absolute flex items-center overflow-visible rounded-full text-left text-[9px] font-black text-white shadow-sm transition-shadow hover:shadow-lg"
                        style={{
                          left,
                          width,
                          height: 24,
                          top: (ROW_H - 24) / 2,
                          background: done ? `linear-gradient(135deg, ${barColor}70, ${barColor}45)` : `linear-gradient(to right, ${barColor} 0%, ${barColor} ${progressPct}%, ${barColor}38 ${progressPct}%, ${barColor}38 100%)`,
                          outline: isOpen ? `2px solid ${barColor}` : "none",
                          outlineOffset: 1,
                          transform: `scale(${isHovered ? 1.04 : 1})`,
                          zIndex: isHovered || isOpen ? 5 : 1,
                        }}
                      >
                        <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-full bg-white/30" />
                        <span className="truncate px-2">{p.etapa || `${progressPct}%`}</span>
                      </button>
                      {isHovered && (
                        <div className="pointer-events-none absolute -top-8 z-20 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-bold text-white shadow-lg" style={{ left, background: "#0f172a" }}>
                          {fmtShort(start)}{p.proximo_hito ? ` · ${p.proximo_hito}` : ""} · {progressPct}% avance
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-50 bg-slate-50/70 px-3 py-2" style={{ paddingLeft: 232 }}>
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Hito: <span className="font-bold normal-case text-slate-600">{fmtShort(end)}</span></span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Avance: <span className="font-bold normal-case text-slate-600">{progressPct}%</span></span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Etapa: <span className="font-bold normal-case text-slate-600">{p.etapa || "—"}</span></span>
                      {p.lider_proyecto?.nombre && <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Líder: <span className="font-bold normal-case text-slate-600">{p.lider_proyecto.nombre}</span></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Sin fecha de hito (agrégale una para verlo en el Gantt)</p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">{p.nombre}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
