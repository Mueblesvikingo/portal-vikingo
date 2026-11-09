import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_ANIOS,
  PLANTILLAS,
  anios as fmtAnios,
  costoPorUnidad,
  equilibrioReferencia,
  equilibrioVolumen,
  evaluar,
  moneda,
  num,
  numero,
  porcentaje,
  sensibilidad,
} from "./simuladorInversion";
import { deleteSimulacion, getSimulaciones, saveSimulacion } from "../../services/simuladorService";
import SimuladorGuia from "./SimuladorGuia";

// Simulador financiero (Diagnóstico SIG). Solo lo ven el Coordinador SIG y el Director General.
// Tablero interactivo: mueve cualquier control y todo se recalcula al momento. Sirve para cualquier evaluación de inversión
// (equipo contra servicio externo, nuevo producto o línea, etc.): hasta 3 alternativas frente a una referencia por unidad,
// resultados después de impuestos. Los escenarios se guardan en Supabase (tabla sig_simulaciones) y los comparten el Coordinador SIG y el Director; sin la tabla, solo en el navegador.

const CLAVE_ACTUAL = "vikingo_simulador_actual_v1";
const CLAVE_ESCENARIOS = "vikingo_simulador_escenarios_v1";
const COLORES = ["#203f73", "#d97706", "#0f766e"];
const FACTORES_VOLUMEN = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const FACTORES_REFERENCIA = [0.6, 0.8, 1, 1.2, 1.5];

const leer = (clave, def) => { try { const t = window.localStorage.getItem(clave); return t ? JSON.parse(t) : def; } catch { return def; } };
const guardar = (clave, valor) => { try { window.localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: el simulador sigue funcionando */ } };
const clonar = (x) => JSON.parse(JSON.stringify(x));
const corto = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${Math.round(a)}`;
};
// Tope "redondo" (1, 2, 5 × 10^k) para que el deslizador se ajuste a lo capturado sin saltos
const topeRedondo = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

// Tono sobrio: el color solo marca estado (verde = conviene, rojo = no conviene) y la
// identidad de cada alternativa en la gráfica; controles y tarjetas van en neutro.
const COLOR_CONTROL = "#0f1f3d";
const PASTILLA_CONTROL = "#eef1f5";

// Ayuda corta: se lee al pasar el cursor, sin ocupar una línea bajo cada control.
const Ayuda = ({ texto }) => (texto ? <span title={texto} aria-label={texto} className="ml-1 cursor-help text-[11px] font-black text-slate-300 hover:text-slate-500">ⓘ</span> : null);

// Botón "?" de cada sección: abre un recuadro con la explicación (funciona con clic y en celular, a
// diferencia del ⓘ que solo se ve al pasar el cursor). `lado`: hacia dónde abre el recuadro.
function AyudaBloque({ titulo, lado = "izquierda", children }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Ayuda: ${titulo}`}
        aria-expanded={abierto}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierto((v) => !v); }}
        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-black transition ${abierto ? "border-[#0f1f3d] bg-[#0f1f3d] text-white" : "border-slate-300 bg-white text-slate-500 hover:border-slate-500 hover:text-slate-800"}`}
      >
        ?
      </button>
      {abierto && (
        <span role="dialog" className={`absolute top-6 z-30 block w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-600 shadow-xl ${lado === "derecha" ? "right-0" : "left-0"}`}>
          <span className="mb-1 block text-[11px] font-black text-slate-800">{titulo}</span>
          {children}
        </span>
      )}
    </span>
  );
}
const Linea = ({ termino, children }) => <span className="mt-1 block"><b className="text-slate-800">{termino}:</b> {children}</span>;

function Control({ etiqueta, valor, onChange, min = 0, minTope = 100, max, paso = 1, prefijo, sufijo, ayuda, color = COLOR_CONTROL, pastilla = PASTILLA_CONTROL }) {
  const v = num(valor);
  const tope = max ?? topeRedondo(Math.max(minTope, v));
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-slate-700">{etiqueta}<Ayuda texto={ayuda} /></span>
        <span className="flex items-center rounded-full px-2.5 py-0.5" style={{ background: pastilla }}>
          {prefijo && <span className="mr-0.5 text-[11px] font-black" style={{ color }}>{prefijo}</span>}
          <input
            type="text"
            inputMode="decimal"
            aria-label={etiqueta}
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-[88px] bg-transparent text-right text-[12px] font-black outline-none"
            style={{ color }}
          />
          {sufijo && <span className="ml-1 whitespace-nowrap text-[10px] font-black" style={{ color }}>{sufijo}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={`${etiqueta} (deslizador)`}
        min={min}
        max={tope}
        step={paso}
        value={Math.min(tope, Math.max(min, v))}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/10"
        style={{ accentColor: color }}
      />
    </div>
  );
}

function Tarjeta({ titulo, accion, ayuda, children, className = "" }) {
  return (
    <section className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{titulo}{ayuda}</div>
        {accion}
      </div>
      {children}
    </section>
  );
}

// Indicador neutro; `estado` (bien | mal) pinta número y borde para que se lea sin interpretar.
function Kpi({ etiqueta, valor, sub, estado, ayuda }) {
  const caja = estado === "bien" ? "border-emerald-200 bg-emerald-50" : estado === "mal" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white";
  const numero = estado === "bien" ? "text-emerald-700" : estado === "mal" ? "text-red-600" : "text-slate-900";
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${caja}`}>
      <div className="flex items-start justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400"><span>{etiqueta}</span>{ayuda}</div>
      <div className={`mt-1 text-[24px] font-black leading-none ${numero}`}>{valor}</div>
      <div className="mt-1.5 text-[11px] leading-tight text-slate-500">{sub}</div>
    </div>
  );
}

function Grafica({ series, anios, barras, colorBarras }) {
  const W = 640, H = 230, pl = 56, pr = 16, pt = 14, pb = 28;
  const todos = [...series.flatMap((s) => s.puntos), ...barras, 0];
  let mn = Math.min(...todos), mx = Math.max(...todos);
  if (mx - mn < 1) { mx += 1; mn -= 1; }
  const holgura = (mx - mn) * 0.08; mn -= holgura; mx += holgura;
  const paso = (W - pl - pr) / Math.max(1, anios + 1);
  const x = (t) => pl + paso * (t + 0.5);
  const y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const marcas = [mn + holgura, 0, mx - holgura].filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < (mx - mn) * 0.07) === i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Flujo de caja por año y acumulado por alternativa">
      {marcas.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#64748b" : "#e2e8f0"} strokeWidth={v === 0 ? 1.3 : 0.8} strokeDasharray={v === 0 ? "4 3" : undefined} />
          <text x={pl - 7} y={y(v) + 3} fontSize="10" fill="#64748b" textAnchor="end">{corto(v)}</text>
        </g>
      ))}
      {barras.map((v, t) => (
        <rect key={t} x={x(t) - paso * 0.28} width={paso * 0.56} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx="3" fill={colorBarras} opacity="0.22">
          <title>{t === 0 ? "Año 0 (compra)" : `Año ${t}`}: {moneda(v)}</title>
        </rect>
      ))}
      {Array.from({ length: anios + 1 }, (_, t) => (
        <text key={t} x={x(t)} y={H - 9} fontSize="10" fill="#64748b" textAnchor="middle">{t === 0 ? "Compra" : `Año ${t}`}</text>
      ))}
      {series.map((s) => (
        <g key={s.nombre}>
          <polyline fill="none" stroke={s.color} strokeWidth="2.6" strokeLinejoin="round" points={s.puntos.map((v, t) => `${x(t)},${y(v)}`).join(" ")} />
          {s.puntos.map((v, t) => (
            <circle key={t} cx={x(t)} cy={y(v)} r="3.4" fill="#fff" stroke={s.color} strokeWidth="2">
              <title>{s.nombre} · {t === 0 ? "Compra" : `Año ${t}`}: acumulado {moneda(v)}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

export default function SimuladorPanel({ currentUser }) {
  const [estado, setEstado] = useState(() => {
    const previo = leer(CLAVE_ACTUAL, null);
    // El análisis anterior de dos plotters (importado vs. Epson) se reemplaza por la plantilla del Jet Lux Plus 185;
    // cualquier otro análisis en pantalla se respeta. Los escenarios guardados no se tocan.
    const esPlotterAnterior = previo?.plantillaId === "plotter" && (previo.alternativas || []).some((a) => /Epson SureColor|Plotter de patrones 1\.8 m/.test(a?.nombre || ""));
    return previo && !esPlotterAnterior ? previo : { ...clonar(PLANTILLAS[0].datos), plantillaId: PLANTILLAS[0].id };
  });
  const [locales, setLocales] = useState(() => leer(CLAVE_ESCENARIOS, []));
  const [remotos, setRemotos] = useState([]);
  const [tablaFaltante, setTablaFaltante] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [abierto, setAbierto] = useState(null); // escenario guardado que está en pantalla {id, nombre}
  const [vista, setVista] = useState(-1); // -1 = la alternativa con más valor presente
  const [editando, setEditando] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [nombreEscenario, setNombreEscenario] = useState("");
  const [verEscenarios, setVerEscenarios] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pestana, setPestana] = useState("grafica"); // grafica | flujo | sensibilidad
  const [verGuia, setVerGuia] = useState(false);

  useEffect(() => { guardar(CLAVE_ACTUAL, estado); }, [estado]);
  useEffect(() => {
    let cancelado = false;
    getSimulaciones().then((r) => {
      if (cancelado) return;
      setRemotos(r.filas); setTablaFaltante(r.tablaFaltante); setCargandoLista(false);
      if (r.error) setAviso("No fue posible cargar los escenarios guardados. Recargue la página.");
    });
    return () => { cancelado = true; };
  }, []);
  useEffect(() => {
    if (editando >= estado.alternativas.length) setEditando(0);
    if (vista >= estado.alternativas.length) setVista(-1);
  }, [estado.alternativas.length, editando, vista]);

  const g = estado.general;
  const esAhorro = estado.modo === "ahorro";
  const unidad = estado.unidad || "unidad";
  const anios = Math.min(MAX_ANIOS, Math.max(1, Math.round(num(g.anios, 5))));
  const tasa = num(g.tasa);
  const lista = tablaFaltante
    ? locales.map((e) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, autor: "", resumen: e.resumen, datos: e.datos }))
    : remotos.map((e) => ({ id: e.id, nombre: e.nombre, fecha: e.updated_at || e.created_at, autor: e.updated_by_nombre || e.created_by_nombre || "", resumen: e.resumen, datos: e.datos }));

  const setGeneral = (campo, valor) => setEstado((e) => ({ ...e, general: { ...e.general, [campo]: valor } }));
  const setDep = (i, valor) => setEstado((e) => { const dep = Array.from({ length: MAX_ANIOS }, (_, k) => e.general.depreciacion?.[k] ?? 0); dep[i] = valor; return { ...e, general: { ...e.general, depreciacion: dep } }; });
  const setAlt = (i, campo, valor) => setEstado((e) => ({ ...e, alternativas: e.alternativas.map((a, k) => (k === i ? { ...a, [campo]: valor } : a)) }));
  const agregarAlt = () => setEstado((e) => {
    if (e.alternativas.length >= 3) return e;
    setEditando(e.alternativas.length);
    return { ...e, alternativas: [...e.alternativas, { nombre: `Alternativa ${e.alternativas.length + 1}`, inversion: 0, costoVariable: 0, costoFijo: 0, rescate: 0, nota: "" }] };
  });
  const quitarAlt = (i) => { setEstado((e) => (e.alternativas.length <= 1 ? e : { ...e, alternativas: e.alternativas.filter((_, k) => k !== i) })); setEditando(0); setVista(-1); };

  const resultados = useMemo(() => estado.alternativas.map((a) => ({
    alt: a,
    r: evaluar(a, g),
    eqVolumen: equilibrioVolumen(a, g),
    eqReferencia: equilibrioReferencia(a, g),
    costoUnidad: costoPorUnidad(a, g),
  })), [estado.alternativas, g]);

  const mejor = useMemo(() => {
    let idx = -1;
    resultados.forEach((x, i) => { if (idx < 0 || x.r.vpn > resultados[idx].r.vpn) idx = i; });
    return idx;
  }, [resultados]);
  const hayGanadora = mejor >= 0 && resultados[mejor].r.vpn > 0;

  const foco = vista >= 0 ? Math.min(vista, resultados.length - 1) : Math.max(0, mejor);
  const F = resultados[foco];
  const vol = num(g.volumen);
  const matriz = useMemo(() => sensibilidad(estado.alternativas[foco], g, FACTORES_VOLUMEN, FACTORES_REFERENCIA), [estado.alternativas, foco, g]);
  const ed = Math.min(editando, estado.alternativas.length - 1);
  const altEd = estado.alternativas[ed];

  const cargarPlantilla = (id) => {
    const p = PLANTILLAS.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm("Cargar la plantilla reemplaza lo que está en pantalla. Si quiere conservarlo, guárdelo antes como escenario. ¿Continuar?")) return;
    setEstado({ ...clonar(p.datos), plantillaId: p.id }); setEditando(0); setVista(-1); setAviso(p.ejemplo ? `Plantilla cargada: ${p.descripcion}` : "");
  };
  const reiniciar = () => cargarPlantilla(estado.plantillaId || PLANTILLAS[0].id);

  const armarResumen = () => {
    const m = resultados[Math.max(0, mejor)];
    return { mejor: m.alt.nombre, vpn: Math.round(m.r.vpn), tir: m.r.tir, payback: m.r.payback, alternativas: resultados.length, volumen: num(g.volumen), unidad };
  };
  const guardarEscenario = async (comoNuevo = false) => {
    const nombre = nombreEscenario.trim() || (abierto && !comoNuevo ? abierto.nombre : estado.titulo) || "Escenario";
    setOcupado(true);
    try {
      if (tablaFaltante) {
        const nuevo = { id: Date.now(), nombre, fecha: new Date().toISOString(), datos: clonar(estado), resumen: armarResumen() };
        const lst = [nuevo, ...locales].slice(0, 30);
        setLocales(lst); guardar(CLAVE_ESCENARIOS, lst); setAbierto({ id: nuevo.id, nombre });
        setAviso(`Escenario "${nombre}" guardado solo en este navegador.`);
      } else {
        const fila = await saveSimulacion({ id: comoNuevo ? null : abierto?.id ?? null, nombre, datos: clonar(estado), resumen: armarResumen() }, currentUser);
        setRemotos((prev) => [fila, ...prev.filter((x) => x.id !== fila.id)]); setAbierto({ id: fila.id, nombre: fila.nombre });
        setAviso(`Escenario "${fila.nombre}" ${comoNuevo || !abierto ? "guardado" : "actualizado"} y disponible para el director.`);
      }
      setGuardando(false); setNombreEscenario("");
    } catch (err) {
      console.error("Error al guardar el escenario:", err);
      setAviso("No fue posible guardar el escenario. Intente de nuevo.");
    } finally { setOcupado(false); }
  };
  const cargarEscenario = (e) => { setEstado(clonar(e.datos)); setAbierto({ id: e.id, nombre: e.nombre }); setNombreEscenario(e.nombre); setEditando(0); setVista(-1); setVerEscenarios(false); setAviso(`Escenario "${e.nombre}" abierto.`); };
  const borrarEscenario = async (e) => {
    if (!window.confirm(`¿Borrar el escenario "${e.nombre}"? No se puede deshacer.`)) return;
    try {
      if (tablaFaltante) { const lst = locales.filter((x) => x.id !== e.id); setLocales(lst); guardar(CLAVE_ESCENARIOS, lst); }
      else { await deleteSimulacion(e.id); setRemotos((prev) => prev.filter((x) => x.id !== e.id)); }
      if (abierto?.id === e.id) setAbierto(null);
    } catch (err) { console.error("Error al borrar el escenario:", err); setAviso("No fue posible borrar el escenario."); }
  };

  const exportarCsv = () => {
    const f = (t) => `"${String(t).replace(/"/g, '""')}"`;
    const filas = [
      [f("Análisis"), f(estado.titulo)], [f("Tipo"), f(esAhorro ? "Ahorro frente a la opción actual" : "Ingresos por venta")], [f("Unidad"), f(unidad)],
      [f("Unidades al año"), num(g.volumen)], [f(esAhorro ? "Costo de la opción actual por unidad" : "Precio de venta por unidad"), num(g.referencia)],
      [f("Tasa de descuento %"), num(g.tasa)], [f("ISR %"), num(g.isr)], [f("Horizonte (años)"), anios], [f("Crecimiento anual de unidades %"), num(g.crecimiento)], [],
      [f("Alternativa"), f("Inversión"), f("Costo variable/unidad"), f("Costos fijos/año"), f("Rescate %"), f("VPN"), f("TIR"), f("Recuperación (años)"), f("Equilibrio (unidades/año)")],
      ...resultados.map((x) => [f(x.alt.nombre), num(x.alt.inversion), num(x.alt.costoVariable), num(x.alt.costoFijo), num(x.alt.rescate), Math.round(x.r.vpn), x.r.tir == null ? "" : (x.r.tir * 100).toFixed(1), x.r.payback == null ? "" : x.r.payback.toFixed(2), x.eqVolumen == null ? "" : Math.round(x.eqVolumen)]), [],
      [f("Flujo de caja después de impuestos"), ...Array.from({ length: anios + 1 }, (_, t) => f(t === 0 ? "Año 0" : `Año ${t}`))],
      ...resultados.map((x) => [f(x.alt.nombre), ...x.r.flujos.map((v) => Math.round(v))]),
    ];
    const blob = new Blob(["﻿" + filas.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `Simulador - ${(estado.titulo || "analisis").replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, "")}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  // Lectura en lenguaje claro del resultado
  const lectura = (() => {
    if (!F) return "";
    const eq = F.eqVolumen;
    if (hayGanadora && vista < 0 && resultados.length > 1) {
      return `${F.alt.nombre} es la que más valor deja: VPN ${moneda(F.r.vpn)} y se recupera en ${fmtAnios(F.r.payback)}. ${eq == null ? "" : `Necesita ${numero(eq)} ${unidad} al año para empatar y hoy se capturan ${numero(vol)}.`}`;
    }
    if (F.r.vpn > 0) return `${F.alt.nombre} supera la tasa de descuento: VPN ${moneda(F.r.vpn)}, recuperación en ${fmtAnios(F.r.payback)}. ${eq == null ? "" : `Empata con ${numero(eq)} ${unidad} al año.`}`;
    return `${F.alt.nombre} no supera la tasa de descuento con ${numero(vol)} ${unidad} al año (VPN ${moneda(F.r.vpn)}). ${eq == null ? "Con estos costos no alcanza a empatar." : `Necesitaría al menos ${numero(eq)} ${unidad} al año.`}`;
  })();

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-3xl bg-[#07162b] px-5 py-4 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0" /></svg>
            </span>
            <div>
              <h2 className="text-[18px] font-black leading-tight">Simulador financiero</h2>
              <p className="mt-0.5 text-[12px] text-slate-300">Mueve cualquier control y todo se recalcula al momento.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase">
            <button type="button" onClick={() => setVerGuia(true)} className="flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-400/15 px-3 py-1.5 text-amber-200 hover:bg-amber-400/25"><span aria-hidden="true">?</span> Guía</button>
            <select aria-label="Plantilla" value="" onChange={(e) => e.target.value && cargarPlantilla(e.target.value)} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-white outline-none">
              <option value="" className="text-slate-900">Plantilla…</option>
              {PLANTILLAS.map((p) => <option key={p.id} value={p.id} className="text-slate-900">{p.nombre}</option>)}
            </select>
            <button type="button" onClick={() => { setGuardando((v) => !v); setVerEscenarios(false); }} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">Guardar</button>
            <button type="button" onClick={() => { setVerEscenarios((v) => !v); setGuardando(false); }} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">Consultar ({lista.length})</button>
            <button type="button" onClick={reiniciar} title="Volver a la plantilla inicial" aria-label="Reiniciar" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[14px] hover:bg-white/20">↺</button>
            <button type="button" onClick={exportarCsv} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[#07162b] hover:bg-slate-100"><span aria-hidden="true">▤</span> Excel</button>
          </div>
        </div>
      </div>

      {verGuia && <SimuladorGuia onClose={() => setVerGuia(false)} />}

      {tablaFaltante && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-800">
          Para guardar y consultar escenarios entre usted y el director, ejecute una vez <span className="font-black">sql/2026-11-sig_simulaciones.sql</span> en el SQL Editor de Supabase y recargue. Mientras tanto se guardan solo en este navegador.
        </div>
      )}
      {guardando && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <label className="min-w-[240px] flex-1"><span className="text-[10px] font-black uppercase text-slate-400">Nombre del escenario</span>
            <input value={nombreEscenario} onChange={(e) => setNombreEscenario(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-400" />
          </label>
          {abierto && !tablaFaltante && <button type="button" disabled={ocupado} onClick={() => guardarEscenario(false)} className="rounded-full bg-[#07162b] px-4 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-50">Actualizar «{abierto.nombre}»</button>}
          <button type="button" disabled={ocupado} onClick={() => guardarEscenario(true)} className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase disabled:opacity-50 ${abierto && !tablaFaltante ? "border border-slate-300 text-slate-700" : "bg-[#07162b] text-white"}`}>{abierto && !tablaFaltante ? "Guardar como nuevo" : "Guardar escenario"}</button>
          <button type="button" onClick={() => setGuardando(false)} className="rounded-full border border-slate-200 px-4 py-1.5 text-[10px] font-black uppercase text-slate-500">Cancelar</button>
        </div>
      )}
      {verEscenarios && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="pt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{tablaFaltante ? "Guardados en este navegador" : "Escenarios guardados · compartidos con el director"}</div>
          {cargandoLista ? <div className="py-3 text-center text-[12px] font-bold text-slate-300">Cargando…</div> : lista.length === 0 ? <div className="py-3 text-center text-[12px] font-bold text-slate-300">Todavía no hay escenarios guardados.</div> : (
            <ul className="divide-y divide-slate-100">
              {lista.map((e) => (
                <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${abierto?.id === e.id ? "bg-amber-50/50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate text-[12px] font-black text-slate-800">{e.nombre}</span>{abierto?.id === e.id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700">Abierto</span>}</div>
                    <div className="text-[10px] text-slate-400">{e.autor ? `${e.autor} · ` : ""}{new Date(e.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}{e.resumen ? ` · Mejor: ${e.resumen.mejor} (VPN ${moneda(e.resumen.vpn)})` : ""}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => cargarEscenario(e)} className="rounded-full border border-slate-200 px-3 py-0.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50">Abrir</button>
                    <button type="button" onClick={() => borrarEscenario(e)} className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-[10px] font-black uppercase text-red-600 hover:bg-red-100">Borrar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {aviso &&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-800">{aviso}</div>}

      <div className="grid items-start gap-4 lg:grid-cols-[370px_1fr]">
        {/* ======= Controles ======= */}
        <div className="space-y-3">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Análisis
              <AyudaBloque titulo="Tipo de análisis">
                <Linea termino="Ahorro vs. opción actual">comparas comprar contra lo que pagas hoy, por ejemplo un servicio externo.</Linea>
                <Linea termino="Ingresos por venta">para un producto nuevo: comparas contra el precio al que lo vendes.</Linea>
                <Linea termino="Unidad">en qué se mide todo: metro lineal, pieza, juego.</Linea>
              </AyudaBloque>
            </div>
            <label className="block"><span className="text-[11px] font-bold text-slate-600">Nombre</span>
              <input value={estado.titulo} onChange={(e) => setEstado((x) => ({ ...x, titulo: e.target.value }))} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-400" />
            </label>
            <div>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-[11px] font-black">
                {[["ahorro", "Ahorro vs. opción actual"], ["ingreso", "Ingresos por venta"]].map(([k, t]) => (
                  <button key={k} type="button" aria-pressed={estado.modo === k} onClick={() => setEstado((e) => ({ ...e, modo: k }))} className={`rounded-full px-2 py-1.5 transition ${estado.modo === k ? "bg-[#07162b] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
                ))}
              </div>
              <div className="mt-1 text-[10px] leading-tight text-slate-400">{esAhorro ? "Compara cada alternativa contra lo que cuesta hoy la opción actual (por ejemplo, pagar un servicio externo)." : "Compara cada alternativa por el margen que deja cada unidad vendida."}</div>
            </div>
            <label className="block"><span className="text-[11px] font-bold text-slate-600">Unidad de medida</span>
              <input value={estado.unidad} onChange={(e) => setEstado((x) => ({ ...x, unidad: e.target.value }))} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-400" />
            </label>
          </section>

          <Tarjeta
            titulo={`Volumen y ${esAhorro ? "costo actual" : "precio"}`}
            ayuda={(
              <AyudaBloque titulo="La situación de hoy">
                <Linea termino="Volumen al año">cuántas unidades haces o usas en un año.</Linea>
                <Linea termino={esAhorro ? "Costo actual" : "Precio de venta"}>{esAhorro ? "lo que pagas hoy por cada unidad." : "lo que cobras por cada unidad."}</Linea>
                <Linea termino="Crecimiento">si cada año harás más (+) o menos (−).</Linea>
                <Linea termino="Horizonte">cuántos años evalúas; normalmente la vida útil del equipo (5 años).</Linea>
              </AyudaBloque>
            )}
          >
            <Control etiqueta="Volumen al año" valor={g.volumen} onChange={(v) => setGeneral("volumen", v)} minTope={5000} paso={10} sufijo={unidad} />
            <Control etiqueta={esAhorro ? `Costo actual por ${unidad}` : `Precio de venta por ${unidad}`} valor={g.referencia} onChange={(v) => setGeneral("referencia", v)} minTope={100} paso={0.5} prefijo="$" />
            <Control etiqueta="Crecimiento del volumen por año" valor={g.crecimiento} onChange={(v) => setGeneral("crecimiento", v)} min={-20} max={30} paso={1} sufijo="%" />
            <Control etiqueta="Horizonte" valor={anios} onChange={(v) => setGeneral("anios", Math.min(MAX_ANIOS, Math.max(1, Math.round(num(v, 5)))))} min={1} max={MAX_ANIOS} paso={1} sufijo={anios === 1 ? "año" : "años"} />
          </Tarjeta>

          {/* Supuestos financieros: se capturan una vez; plegados para no alargar la columna */}
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Supuestos financieros
                <AyudaBloque titulo="Supuestos financieros">
                  <Linea termino="Tasa de descuento">lo mínimo que esperas que rinda tu dinero, o lo que te cuesta un préstamo. Más alta = más exigente.</Linea>
                  <Linea termino="ISR">el impuesto que se paga sobre los ahorros.</Linea>
                  <Linea termino="Depreciación">la parte del equipo que deduces de impuestos cada año. La confirma el contador.</Linea>
                </AyudaBloque>
              </span>
              <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600">Tasa {numero(tasa, 1)}% · ISR {numero(num(g.isr), 0)}%<span className="text-slate-400 transition group-open:rotate-90">▸</span></span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-3.5 pb-3.5 pt-3">
              <Control etiqueta="Tasa de descuento" valor={g.tasa} onChange={(v) => setGeneral("tasa", v)} max={50} paso={0.5} sufijo="%" ayuda="Su costo de capital o el rendimiento mínimo que espera." />
              <Control etiqueta="ISR" valor={g.isr} onChange={(v) => setGeneral("isr", v)} max={50} paso={1} sufijo="%" />
              <div>
                <div className="text-[12px] font-bold text-slate-700">Depreciación fiscal por año <span className="text-[10px] font-semibold text-slate-400">(% de la inversión)</span><Ayuda texto="La tasa de depreciación y el IVA acreditable los confirma el contador." /></div>
                <div className="mt-1 grid grid-cols-5 gap-1.5">
                  {Array.from({ length: anios }, (_, i) => (
                    <label key={i} className="block">
                      <span className="block text-center text-[9px] font-black text-slate-400">AÑO {i + 1}</span>
                      <input type="text" inputMode="decimal" value={g.depreciacion?.[i] ?? 0} onChange={(e) => setDep(i, e.target.value)} aria-label={`Depreciación del año ${i + 1}`} className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-[11px] font-black text-slate-800 outline-none focus:border-slate-400" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <Tarjeta
            titulo={<span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORES[ed] }} />Alternativa {String.fromCharCode(65 + ed)}</span>}
            ayuda={(
              <AyudaBloque titulo="La opción a evaluar">
                <Linea termino="Inversión">precio sin IVA, más instalación, capacitación y mesa.</Linea>
                <Linea termino="Costo variable">insumos de cada unidad (papel, tinta, material).</Linea>
                <Linea termino="Costos fijos">lo que pagas al año aunque no la uses: mantenimiento, póliza.</Linea>
                <Linea termino="Rescate">lo que valdría al venderla al final.</Linea>
                <span className="mt-1 block text-slate-500">Con “+ Agregar” comparas hasta 3 opciones.</span>
              </AyudaBloque>
            )}
            accion={estado.alternativas.length < 3 && <button type="button" onClick={agregarAlt} className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-[10px] font-black text-slate-500 hover:border-slate-500 hover:text-slate-700">+ Agregar</button>}
          >
            <label className="block"><span className="text-[11px] font-bold text-slate-600">Nombre</span>
              <input value={altEd.nombre} onChange={(e) => setAlt(ed, "nombre", e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-400" />
            </label>
            <Control etiqueta="Inversión inicial" valor={altEd.inversion} onChange={(v) => setAlt(ed, "inversion", v)} minTope={500000} paso={1000} prefijo="$" ayuda="Equipo, instalación, software y capacitación, sin IVA." />
            <Control etiqueta={`Costo variable por ${unidad}`} valor={altEd.costoVariable} onChange={(v) => setAlt(ed, "costoVariable", v)} minTope={100} paso={0.5} prefijo="$" ayuda="Materiales, mano de obra y todo lo que crece con cada unidad." />
            <Control etiqueta="Costos fijos al año" valor={altEd.costoFijo} onChange={(v) => setAlt(ed, "costoFijo", v)} minTope={50000} paso={500} prefijo="$" />
            <Control etiqueta="Valor de rescate" valor={altEd.rescate} onChange={(v) => setAlt(ed, "rescate", v)} max={100} paso={1} sufijo="%" ayuda="Lo que vale el equipo al final; el último año lo suma neto de impuestos." />
            <label className="block"><span className="text-[11px] font-bold text-slate-600">Nota / origen del dato</span>
              <textarea value={altEd.nota || ""} onChange={(e) => setAlt(ed, "nota", e.target.value)} rows={2} className="mt-0.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-slate-400" />
            </label>
            {estado.alternativas.length > 1 && <button type="button" onClick={() => quitarAlt(ed)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-700">Quitar esta alternativa</button>}
          </Tarjeta>
        </div>

        {/* ======= Tablero ======= */}
        <div className="min-w-0 space-y-4">
          {/* Comparativo de alternativas: es también el único selector (muestra y edita la que se pulsa) */}
          <div className="-mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {resultados.length > 1 ? "Opciones" : "Opción"} · valor presente neto
            <AyudaBloque titulo="Comparativo de opciones">
              <span className="block">Cada tarjeta es una opción con su ganancia total (VPN).</span>
              <Linea termino="Verde">conviene. <b className="text-slate-800">Rojo:</b> no conviene con estos datos.</Linea>
              <span className="mt-1 block">Haz clic en una tarjeta para ver sus números abajo y editarla a la izquierda.</span>
            </AyudaBloque>
          </div>
          <div className={`grid gap-3 ${resultados.length === 1 ? "" : resultados.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {resultados.map((x, i) => {
              const activo = foco === i;
              return (
                <button key={i} type="button" onClick={() => { setVista(i); setEditando(i); }} aria-pressed={activo} className={`rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition hover:shadow ${activo ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-6 w-1 rounded-full" style={{ background: COLORES[i] }} />
                    <div className="min-w-0 flex-1 truncate text-[12px] font-black text-slate-800">{x.alt.nombre}</div>
                    {mejor === i && hayGanadora && resultados.length > 1 && <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-700">✓ Mejor</span>}
                  </div>
                  <div className={`mt-1 text-[20px] font-black leading-tight ${x.r.vpn > 0 ? "text-emerald-700" : "text-red-600"}`}>{moneda(x.r.vpn)}</div>
                  <div className="text-[10px] text-slate-400">VPN · {x.r.vpn > 0 ? "conviene" : "no conviene"} · inversión {moneda(num(x.alt.inversion))}</div>
                </button>
              );
            })}
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-[12px] leading-snug ${F.r.vpn > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <span className="font-black">{F.r.vpn > 0 ? "Lectura: " : "Ojo: "}</span>{lectura}
            {!hayGanadora && resultados.length > 1 && vista < 0 && <span> Ninguna alternativa supera la tasa de descuento con estos supuestos.</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi etiqueta="Valor presente neto" valor={moneda(F.r.vpn)} sub={`a ${anios} ${anios === 1 ? "año" : "años"} · tasa ${numero(tasa, 1)}%`} estado={F.r.vpn > 0 ? "bien" : "mal"}
              ayuda={<AyudaBloque titulo="¿Cuánto gano?" lado="derecha">La ganancia total en pesos de hoy, ya descontada la compra. <b className="text-slate-800">Mayor que $0 = conviene.</b></AyudaBloque>} />
            <Kpi etiqueta="Tasa interna de retorno" valor={porcentaje(F.r.tir)} sub={`contra ${numero(tasa, 1)}% de descuento`}
              ayuda={<AyudaBloque titulo="¿Qué tan rentable es?" lado="derecha">El rendimiento anual de tu dinero en esta inversión. <b className="text-slate-800">Si es mayor que tu tasa de descuento ({numero(tasa, 1)}%), conviene.</b></AyudaBloque>} />
            <Kpi etiqueta="Recuperación" valor={F.r.payback == null ? "—" : `${F.r.payback.toFixed(1)} años`} sub={F.r.payback == null ? `no se recupera en ${anios} ${anios === 1 ? "año" : "años"}` : "para recuperar la inversión"}
              ayuda={<AyudaBloque titulo="¿Cuándo regresa mi dinero?" lado="derecha">Los años que tardan los ahorros en pagar la compra. <b className="text-slate-800">Menos años = menos riesgo.</b></AyudaBloque>} />
            <Kpi etiqueta="Punto de equilibrio" valor={F.eqVolumen == null ? "—" : numero(F.eqVolumen)} sub={F.eqVolumen == null ? "no alcanza a empatar" : vol > 0 ? `${unidad} al año · hoy ${numero(vol)} (${Math.round((vol / Math.max(1, F.eqVolumen)) * 100)}%)` : `${unidad} al año`}
              ayuda={<AyudaBloque titulo="¿Cuánto debo usarla?" lado="derecha">Las {unidad} al año a partir de las cuales comprar conviene más que seguir como hoy. El % compara tu volumen contra ese mínimo: <b className="text-slate-800">arriba de 100% conviene.</b></AyudaBloque>} />
          </div>
          <div className="-mt-1 px-1 text-[11px] text-slate-500">
            {esAhorro
              ? <>Costo propio por {unidad}: <span className="font-black text-slate-700">{F.costoUnidad == null ? "—" : `$${numero(F.costoUnidad, 1)}`}</span> contra ${numero(num(g.referencia), 1)} de la opción actual</>
              : <>Margen por {unidad}: <span className="font-black text-slate-700">${numero(num(g.referencia) - num(F.alt.costoVariable), 1)}</span> (precio ${numero(num(g.referencia), 1)} − costo ${numero(num(F.alt.costoVariable), 1)})</>}
            {" · "}Beneficio año 1: <span className="font-black text-slate-700">{moneda(F.r.beneficios[0])}</span> antes de impuestos
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-1 rounded-full bg-slate-100 p-1 text-[10px] font-black uppercase tracking-wide sm:inline-flex">
              {[["grafica", "Gráfica"], ["flujo", "Flujo de caja"], ["sensibilidad", "Sensibilidad"]].map(([k, t]) => (
                <button key={k} type="button" aria-pressed={pestana === k} onClick={() => setPestana(k)} className={`rounded-full px-3 py-1.5 transition ${pestana === k ? "bg-[#07162b] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
              ))}
              <span className="flex items-center px-1.5">
                {pestana === "grafica" && (
                  <AyudaBloque titulo="Cómo leer la gráfica">
                    <Linea termino="Barras">lo que entra (o sale) cada año.</Linea>
                    <Linea termino="Línea">lo que llevas acumulado. Cuando cruza $0, ya recuperaste la inversión.</Linea>
                  </AyudaBloque>
                )}
                {pestana === "flujo" && (
                  <AyudaBloque titulo="Cómo leer el flujo de caja">
                    <Linea termino="Beneficio antes de impuestos">lo que ahorras en el año menos los costos.</Linea>
                    <Linea termino="Flujo después de impuestos">lo que de verdad queda, con ISR y depreciación.</Linea>
                    <Linea termino="Acumulado">la suma desde la compra; en verde ya recuperaste.</Linea>
                  </AyudaBloque>
                )}
                {pestana === "sensibilidad" && (
                  <AyudaBloque titulo="Qué pasaría si…">
                    <span className="block">El VPN si el volumen (filas) o el {esAhorro ? "costo actual" : "precio"} (columnas) fueran distintos.</span>
                    <Linea termino="Verde">sigue conviniendo. <b className="text-slate-800">Rojo:</b> ya no.</Linea>
                    <span className="mt-1 block">El recuadro marca tu caso actual. Si casi todo es verde, la decisión es segura.</span>
                  </AyudaBloque>
                )}
              </span>
            </div>

            {pestana === "grafica" && (<>
            <div className="mb-2 text-[13px] font-black text-slate-800">Año por año: lo que entra y lo que acumulas</div>
            <Grafica anios={anios} barras={F.r.flujos} colorBarras={COLORES[foco]} series={resultados.map((x, i) => ({ nombre: x.alt.nombre, color: COLORES[i], puntos: x.r.acumulado }))} />
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600">
              {resultados.map((x, i) => <span key={i} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded" style={{ background: COLORES[i] }} />{x.alt.nombre} (acumulado)</span>)}
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm opacity-30" style={{ background: COLORES[foco] }} />Flujo del año de {F.alt.nombre}</span>
              <Ayuda texto="La línea cruza el cero cuando la inversión se recupera. Pase el cursor por un punto o una barra para ver el monto." />
            </div>
            </>)}

            {pestana === "flujo" && (<>
              <div className="mb-2 text-[13px] font-black text-slate-800">Flujo de caja · {F.alt.nombre}<Ayuda texto="El último año incluye el valor de rescate neto de impuestos." /></div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-slate-200 text-right text-[9px] font-black uppercase text-slate-400"><th className="px-2 py-1 text-left">Año</th><th className="px-2 py-1">Beneficio antes de imp.</th><th className="px-2 py-1">Flujo después de imp.</th><th className="px-2 py-1">Acumulado</th></tr></thead>
                  <tbody>
                    {F.r.flujos.map((f, t) => (
                      <tr key={t} className="border-b border-slate-100 text-right font-semibold text-slate-700">
                        <td className="px-2 py-1 text-left font-black">{t === 0 ? "0 · compra" : t}</td>
                        <td className="px-2 py-1">{t === 0 ? "—" : moneda(F.r.beneficios[t - 1])}</td>
                        <td className={`px-2 py-1 ${f >= 0 ? "text-emerald-700" : "text-red-600"}`}>{moneda(f)}</td>
                        <td className={`px-2 py-1 font-black ${F.r.acumulado[t] >= 0 ? "text-emerald-700" : "text-red-600"}`}>{moneda(F.r.acumulado[t])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>)}

            {pestana === "sensibilidad" && (<>
              <div className="text-[13px] font-black text-slate-800">¿Y si cambia el volumen o el {esAhorro ? "costo actual" : "precio"}?</div>
              <div className="mb-2 text-[10px] text-slate-400">VPN de {F.alt.nombre}. Verde: conviene. Rojo: no conviene. El recuadro es el caso capturado.</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] border-separate border-spacing-0.5 text-center">
                  <thead>
                    <tr>
                      <th className="px-1 py-1 text-left text-[9px] font-black uppercase text-slate-400">Volumen \ {esAhorro ? "costo" : "precio"}</th>
                      {FACTORES_REFERENCIA.map((f) => <th key={f} className="px-1 py-1 text-[10px] font-black text-slate-600">${numero(num(g.referencia) * f, 1)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {matriz.map((fila, j) => (
                      <tr key={j}>
                        <td className="px-1 py-1 text-left text-[10px] font-black text-slate-600">{numero(fila.volumen)}</td>
                        {fila.celdas.map((c, i) => {
                          const base = FACTORES_VOLUMEN[j] === 1 && FACTORES_REFERENCIA[i] === 1;
                          return <td key={i} className={`rounded-md px-1 py-1 text-[10px] font-black ${c.vpn > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"} ${base ? "ring-2 ring-slate-800" : ""}`}>{corto(c.vpn)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>)}
          </section>

          <p className="px-1 text-[10px] leading-relaxed text-slate-400">
            Estimaciones con los supuestos capturados: no sustituyen una cotización ni la opinión del contador; los datos de las plantillas son de ejemplo. Para compartir lo que está en pantalla con el director, use Guardar.
          </p>
        </div>
      </div>
    </div>
  );
}
