import { useEffect, useState } from "react";
import { estadoCorrectivo, hoyISO } from "../../services/controlCorrectivoService";
import { PRIORIDAD_COLOR, cardClass } from "./ccHelpers";

// Gantt de acciones correctivas agrupadas por proceso. Cada barra va de la
// fecha de inicio a la fecha compromiso; el color es la prioridad y el
// relleno sólido es el avance reportado. Mismo diseño de línea de tiempo que
// el Gantt del Tablero de Proyectos (PmoGanttView), de solo lectura.
const DAY_MS = 86400000;
const ROW_H = 38;
const LABEL_W = 250;

const toDate = (iso) => new Date(`${iso}T00:00:00`);
const fmtCorta = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
function lunesDesde(d) {
  const dia = d.getDay();
  return new Date(d.getTime() + (dia === 0 ? 1 : dia === 1 ? 0 : 8 - dia) * DAY_MS);
}

export default function CorrectivoGantt({ items, procesos, nombrePersona, onOpen }) {
  const [hoverId, setHoverId] = useState(null);
  const [anchoDisponible, setAnchoDisponible] = useState(900);
  const [nodo, setNodo] = useState(null);

  // La escala de días se ajusta al ancho disponible para que el Gantt quepa
  // sin scroll cuando el rango de fechas lo permite.
  useEffect(() => {
    if (!nodo || typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(([entrada]) => setAnchoDisponible(entrada.contentRect.width));
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [nodo]);

  const hoyIso = hoyISO();
  const hoy = toDate(hoyIso);

  const conFechas = items.filter((i) => i.fecha_compromiso);
  if (conFechas.length === 0) {
    return (
      <div className={`${cardClass} flex flex-col items-center gap-1 py-12 text-center`}>
        <span className="text-3xl text-slate-200">📅</span>
        <p className="text-sm font-bold text-slate-400">No hay acciones para mostrar en el Gantt</p>
        <p className="max-w-xs text-xs text-slate-400">Crea una acción correctiva o cambia los filtros para verla aquí como barra.</p>
      </div>
    );
  }

  const filas = conFechas.map((i) => ({ i, inicio: toDate(i.fecha_inicio || i.fecha_compromiso), fin: toDate(i.fecha_compromiso) }));
  const minFecha = new Date(Math.min(hoy.getTime(), ...filas.map((f) => f.inicio.getTime())) - 3 * DAY_MS);
  const maxFecha = new Date(Math.max(hoy.getTime(), ...filas.map((f) => f.fin.getTime())) + 7 * DAY_MS);
  const totalDias = Math.max(21, Math.round((maxFecha - minFecha) / DAY_MS) + 1);
  const pxDia = Math.max(5, Math.min(28, Math.floor((anchoDisponible - LABEL_W - 4) / totalDias)));
  const ancho = totalDias * pxDia;
  const desfase = (d) => Math.round((d - minFecha) / DAY_MS);

  const meses = [];
  let cursor = new Date(minFecha.getFullYear(), minFecha.getMonth(), 1);
  while (cursor <= maxFecha) {
    meses.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const paso = pxDia >= 20 ? 1 : 7;
  const marcas = [];
  for (let o = paso === 1 ? 0 : desfase(lunesDesde(minFecha)); o <= totalDias; o += paso) marcas.push(o);
  const periodoPx = paso * pxDia;
  const faseGrid = LABEL_W + (marcas[0] ?? 0) * pxDia;
  const hoyOffset = desfase(hoy);

  // Procesos en el orden del catálogo; solo los que tienen acciones.
  const idsConocidos = new Set(procesos.map((p) => Number(p.id)));
  const grupos = [...procesos, { id: "sin-proceso", nombre: "Sin proceso en el catálogo" }]
    .map((p) => ({
      proceso: p,
      filas: filas
        .filter((f) => (p.id === "sin-proceso" ? !idsConocidos.has(Number(f.i.proceso_id)) : Number(f.i.proceso_id) === Number(p.id)))
        .sort((a, b) => a.fin - b.fin),
    }))
    .filter((g) => g.filas.length > 0);

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0f1f3d]">Gantt por proceso</p>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-[#5b6472]">
          {Object.entries(PRIORIDAD_COLOR).map(([nombre, color]) => (
            <span key={nombre} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{nombre}</span>
          ))}
          <span className="normal-case text-[#94a3b8]">Relleno sólido = avance</span>
        </div>
      </div>

      <div ref={setNodo} className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W + ancho }}>
          <div className="bg-white">
            <div className="flex border-b border-slate-100">
              <div className="sticky left-0 z-30 shrink-0 bg-white px-3 py-1.5" style={{ width: LABEL_W }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Proceso / acción</p>
              </div>
              <div className="relative" style={{ width: ancho, height: 22 }}>
                {meses.map((m, idx) => {
                  const o = desfase(m);
                  if (o < 0) return null;
                  return (
                    <div key={idx} className="absolute bottom-0 top-0 flex items-center border-l border-slate-200 pl-1.5" style={{ left: o * pxDia }}>
                      <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-slate-500">{m.toLocaleDateString("es-MX", { month: "short", year: "2-digit" })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex border-b border-slate-100 bg-slate-50/60">
              <div className="sticky left-0 z-30 shrink-0 bg-slate-50 px-3 py-1" style={{ width: LABEL_W }}>
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-300">{paso === 1 ? "Días" : "Semanas (lunes)"}</p>
              </div>
              <div className="relative" style={{ width: ancho, height: 18 }}>
                {marcas.map((o) => {
                  const d = new Date(minFecha.getTime() + o * DAY_MS);
                  const esHoy = o === hoyOffset;
                  return (
                    <span key={o} className="absolute top-0 whitespace-nowrap text-[9px]" style={{ left: o * pxDia + 2, color: esHoy ? "#ef4444" : "#94a3b8", fontWeight: esHoy ? 900 : 700 }}>{d.getDate()}</span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative" style={{ backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.25) 0, rgba(148,163,184,0.25) 1px, transparent 1px, transparent ${periodoPx}px)`, backgroundPosition: `${faseGrid}px 0` }}>
            {hoyOffset >= 0 && hoyOffset <= totalDias && (
              <div className="pointer-events-none absolute bottom-0 top-0 z-10" style={{ left: LABEL_W + hoyOffset * pxDia }}>
                <div className="h-full w-px bg-red-400" />
                <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded-full bg-red-500 px-1.5 py-px text-[8px] font-black text-white shadow-sm">HOY</span>
              </div>
            )}

            {grupos.map(({ proceso, filas: filasProceso }) => {
              const promedio = Math.round(filasProceso.reduce((s, f) => s + (Number(f.i.avance) || 0), 0) / filasProceso.length);
              return (
                <div key={proceso.id}>
                  <div className="flex items-center border-b border-slate-100 bg-slate-50" style={{ height: 30 }}>
                    <div className="sticky left-0 z-20 flex shrink-0 items-center justify-between gap-2 bg-slate-50 px-3" style={{ width: LABEL_W }}>
                      <span className="truncate text-[11px] font-black uppercase tracking-wide text-[#0f1f3d]" title={proceso.nombre}>{proceso.nombre}</span>
                      <span className="shrink-0 text-[10px] font-bold text-[#5b6472]">{filasProceso.length} · {promedio}%</span>
                    </div>
                  </div>
                  {filasProceso.map(({ i, inicio, fin }) => {
                    const color = PRIORIDAD_COLOR[i.prioridad] || "#64748b";
                    const estado = estadoCorrectivo(i, hoyIso);
                    const avance = Math.max(0, Math.min(100, Number(i.avance) || 0));
                    const left = desfase(inicio) * pxDia;
                    const width = Math.max(pxDia * 1.4, (desfase(fin) - desfase(inicio) + 1) * pxDia);
                    const completa = estado === "Completada";
                    const activo = hoverId === i.id;
                    return (
                      <div key={i.id} className="flex items-stretch border-b border-slate-50 hover:bg-slate-50/60" style={{ height: ROW_H }}>
                        <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-white px-3" style={{ width: LABEL_W }}>
                          {completa ? (
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-black text-white" style={{ background: color }}>✓</span>
                          ) : (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                          )}
                          {/* Nombre y fecha compromiso; el texto completo de la acción queda en el tooltip. */}
                          <div className="min-w-0 leading-tight" title={i.accion_correctiva}>
                            <span className={`block truncate text-[11px] font-semibold ${completa ? "text-slate-300 line-through" : estado === "Vencida" ? "text-red-600" : "text-slate-700"}`}>{i.nombre_accion || i.accion_correctiva}</span>
                            <span className="block text-[9px] font-bold text-slate-400">{fmtCorta(fin)}</span>
                          </div>
                        </div>
                        <div className="relative" style={{ width: ancho, height: ROW_H }}>
                          <button
                            type="button"
                            onClick={() => onOpen(i)}
                            onMouseEnter={() => setHoverId(i.id)}
                            onMouseLeave={() => setHoverId((h) => (h === i.id ? null : h))}
                            className="absolute flex items-center overflow-hidden rounded-full text-left text-[9px] font-black text-white shadow-sm transition-shadow hover:shadow-md"
                            style={{
                              left,
                              width,
                              height: 22,
                              top: (ROW_H - 22) / 2,
                              background: completa ? `${color}88` : `linear-gradient(to right, ${color} 0%, ${color} ${avance}%, ${color}38 ${avance}%, ${color}38 100%)`,
                              boxShadow: estado === "Vencida" ? "0 0 0 2px #fca5a5" : undefined,
                            }}
                          >
                            <span className="truncate px-2 drop-shadow-sm">{avance}%</span>
                          </button>
                          {activo && (
                            <div className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg" style={{ left, top: -6 }}>
                              {i.nombre_accion ? `${i.nombre_accion} · ` : ""}{fmtCorta(inicio)} → {fmtCorta(fin)} · {avance}% · {estado}{i.lider_persona_id ? ` · ${nombrePersona(i.lider_persona_id)}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-[#edf0f4] px-4 py-2 text-[10px] text-[#94a3b8]">Haz clic en una barra para abrir la acción.</p>
    </div>
  );
}
