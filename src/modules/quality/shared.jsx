import { Fragment, useState } from "react";
import EvidenciaUploader from "./EvidenciaUploader";
import HelpTip from "./HelpTip";
import { cardClass, btnPrimaryClass, btnGhostClass } from "./coreliTheme";
import vikingoLogo from "../../assets/vikingo-logo.png";

// Piezas reutilizadas por los paneles de "registro único autosuficiente"
// (Materia Prima, Planta 1, ...): cada captura es un formulario con
// secciones desplegables + su propio cierre/dictamen/firmas, una tabla
// compacta con botón "Ver", filtros, y un recibo imprimible fiel al Excel
// original de cada formato. Los campos concretos (columnas, leyenda,
// colores del formato) SÍ difieren por planta y viven en cada panel.

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
export function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}
export const MES_LABEL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export function agruparPorMes(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const [anio, mes] = r.fecha.split("-").map(Number);
    const key = `${anio}-${mes}`;
    if (!grupos.has(key)) grupos.set(key, { label: `${MES_LABEL[mes - 1]} ${anio}`, items: [] });
    grupos.get(key).items.push(r);
  }
  return Array.from(grupos.values());
}

// El historial se agrupa por semana (lunes a domingo) en vez de por mes —
// una tabla por semana, cada una con su propia identificación ("Semana
// DD/MM – DD/MM"), apiladas de la más reciente a la más antigua. Los
// registros ya llegan ordenados desc por fecha, así que el primer registro
// de cada semana nueva define el orden de inserción del Map.
export function agruparPorSemana(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const inicio = inicioSemanaISO(r.fecha);
    const fin = finSemanaISO(r.fecha);
    if (!grupos.has(inicio)) grupos.set(inicio, { label: `Semana ${ddmmyyyy(inicio)} – ${ddmmyyyy(fin)}`, items: [] });
    grupos.get(inicio).items.push(r);
  }
  return Array.from(grupos.values());
}

// La columna "hora" en Supabase es tipo `time` y regresa "HH:MM:SS" — en
// pantalla solo queremos "HH:MM".
export function horaCorta(hora) {
  return (hora || "").slice(0, 5);
}
export function dictamenCorto(d) {
  if (d === "Conforme con observación") return "Con obs.";
  if (d === "Producto No Conforme") return "No conforme";
  return d || "—";
}
export function ddmmyyyy(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Rango de fechas para imprimir "varias inspecciones" — semana de lunes a
// domingo (la operación no respeta un calendario laboral fijo).
export function inicioSemanaISO(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  return d.toISOString().slice(0, 10);
}
export function finSemanaISO(fechaISO) {
  const d = new Date(`${inicioSemanaISO(fechaISO)}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
export function finMesISO(fechaISO) {
  const [y, m] = fechaISO.split("-").map(Number);
  return `${fechaISO.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}
export function calcularPeriodo(periodo, fechaRef) {
  if (periodo === "dia") return { desde: fechaRef, hasta: fechaRef, label: `Día ${ddmmyyyy(fechaRef)}` };
  if (periodo === "semana") {
    const desde = inicioSemanaISO(fechaRef);
    const hasta = finSemanaISO(fechaRef);
    return { desde, hasta, label: `Semana ${ddmmyyyy(desde)} – ${ddmmyyyy(hasta)}` };
  }
  const desde = `${fechaRef.slice(0, 7)}-01`;
  const hasta = finMesISO(fechaRef);
  return { desde, hasta, label: `Mes ${MES_LABEL[Number(fechaRef.slice(5, 7)) - 1]} ${fechaRef.slice(0, 4)}` };
}

// Filtro genérico sobre texto libre — cada panel decide qué campos entran a
// la búsqueda (proveedor/OC-lote en Materia Prima, proceso/OP en Planta 1…).
export function aplicarFiltrosRegistros(registros, filtros, extraerCamposBusqueda) {
  const q = filtros.busqueda.trim().toLowerCase();
  return registros.filter((r) => {
    if (filtros.dictamen && r.dictamen !== filtros.dictamen) return false;
    if (filtros.desde && r.fecha < filtros.desde) return false;
    if (filtros.hasta && r.fecha > filtros.hasta) return false;
    if (q) {
      const insp = r.calidad_inspecciones?.[0];
      const campos = extraerCamposBusqueda(r, insp);
      if (!campos.some((c) => (c || "").toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

// Devuelve pares {label, value} en vez de un solo string — en el recibo
// impreso se renderizan como bloques separados (gap real), no como texto
// corrido, aunque el Excel original los junte en una sola celda de texto.
export function construirEncabezadoImpresion(modo, registrosSel, periodoLabel, area) {
  const jornada = registrosSel[0]?.jornada || "07:00–17:00";
  if (modo === "una") {
    const r = registrosSel[0];
    return [
      { label: "Fecha", value: ddmmyyyy(r.fecha) },
      { label: "Inspectora", value: r.inspectora_nombre || "—" },
      { label: "Jornada", value: jornada },
      { label: "Área", value: area },
    ];
  }
  const inspectoras = [...new Set(registrosSel.map((r) => r.inspectora_nombre).filter(Boolean))];
  const inspectoraLabel = inspectoras.length === 0 ? "—" : inspectoras.length === 1 ? inspectoras[0] : "Varias";
  return [
    { label: "Periodo", value: periodoLabel },
    { label: "Inspectora", value: inspectoraLabel },
    { label: "Jornada", value: jornada },
    { label: "Área", value: area },
  ];
}

export function PuntoControlChip({ letra, valor, onChange }) {
  const opciones = [
    { key: "C", label: "C", active: "border-green-500 bg-green-500 text-white", idle: "border-green-200 text-green-700 bg-white" },
    { key: "NC", label: "NC", active: "border-red-500 bg-red-500 text-white", idle: "border-red-200 text-red-600 bg-white" },
    { key: "NA", label: "NA", active: "border-slate-400 bg-slate-400 text-white", idle: "border-[#edf0f4] text-[#5b6472] bg-white" },
  ];
  return (
    <div className="flex items-center gap-1">
      {letra && <span className="w-4 text-[11px] font-bold text-[#94a3b8]">{letra}</span>}
      {opciones.map((o) => {
        const active = valor === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange && onChange(active ? null : o.key)}
            disabled={!onChange}
            className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold transition active:scale-95 ${active ? o.active : o.idle} ${!onChange ? "opacity-40" : ""}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Sección desplegable — para ir llenando el registro por partes en vez de un
// formulario largo de un jalón (pedido explícito, pensado para celular).
// Solo una sección abierta a la vez.
export function AccordionSection({ icon, title, subtitle, help, open, onToggle, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#edf0f4]">
      <div role="button" tabIndex={0} onClick={onToggle} className="flex w-full cursor-pointer items-center gap-2.5 bg-[#f7f7f4] px-3 py-2.5 text-left transition active:bg-[#edf0f4]">
        <span className="text-base">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block text-sm font-semibold text-[#0f1f3d]">{title}</span>
            {help && (
              <span onClick={(e) => e.stopPropagation()}>
                <HelpTip>{help}</HelpTip>
              </span>
            )}
          </span>
          {subtitle && <span className="block text-xs text-[#5b6472]">{subtitle}</span>}
        </span>
        <span className={`shrink-0 text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </div>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

export const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]";
export const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";

export function CampoTexto({ label, value }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-0.5 text-sm text-[#0f1f3d]">{value || "—"}</p>
    </div>
  );
}

// Misma tarjeta de firma que Planes de Auditoría (AuditoriaFichaPanel.jsx /
// SigDiagnosisModule.jsx): rol en mayúsculas + pastilla Firmado/Pendiente
// (verde/ámbar), cuerpo libre por `children` (aquí no hay un botón "Firmar"
// de otro usuario — las 3 firmas se capturan juntas al guardar el registro).
export function FirmaCard({ rol, firmado, children }) {
  return (
    <div className={`rounded-2xl border p-3 ${firmado ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{rol}</div>
        {firmado ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">✓ Firmado</span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">Pendiente</span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// CSS de impresión — aísla el recibo del resto del portal (topbar, sidebar,
// controles del módulo) montándolo vía portal directo a document.body y
// ocultando #root solo en @media print, para no dejar hojas en blanco por el
// alto del resto de la app. Horizontal tamaño carta por default.
export const PRINT_STYLE_BLOCK = `
  .gc-print-portal { display: none; }
  @media print {
    @page { size: letter landscape; margin: 10mm; }
    html, body { height: auto !important; }
    #root { display: none !important; }
    .gc-print-portal {
      display: block !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    .gc-print-portal table { page-break-inside: auto; }
    .gc-print-portal tr, .gc-print-portal .gc-foto-box { page-break-inside: avoid; }
    .gc-print-portal thead { display: table-header-group; }
  }
`;

// Colores tomados directo del archivo Excel real (Interior.Color de cada
// celda de encabezado, vía automatización COM) — el mismo esquema se repite
// en las 4 hojas de FORMATOS DE INSPECCION.xlsx (Materia Prima, Planta 1/2/3).
export const EXCEL_COLOR = {
  titulo: "#2F3E46",
  sub: "#52796F",
  info: "#F1F5F3",
  encabezadoTabla: "#D97706",
  leyendaFondo: "#F8FAF9",
};

// Ventana para elegir qué imprimir: un registro puntual, o varios dentro de
// un período (día/semana/mes). La lista de candidatos siempre usa TODOS los
// registros cargados (no el filtro de búsqueda activo en pantalla), porque
// imprimir es una acción independiente de esa vista.
export function ImprimirModal({ registros, area, nombreRegistroSingular, nombreRegistroPlural, renderResumenItem, onCancel, onConfirmar }) {
  const [modo, setModo] = useState("una");
  const [unaId, setUnaId] = useState(null);
  const [periodo, setPeriodo] = useState("dia");
  const [fechaRef, setFechaRef] = useState(todayISO());
  const [pasoFotos, setPasoFotos] = useState(false);

  const registrosOrdenados = [...registros].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const { label, desde, hasta } = calcularPeriodo(periodo, fechaRef);
  const registrosPeriodo = registros
    .filter((r) => r.fecha >= desde && r.fecha <= hasta)
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      const ha = a.calidad_inspecciones?.[0]?.hora || "";
      const hb = b.calidad_inspecciones?.[0]?.hora || "";
      return ha < hb ? -1 : ha > hb ? 1 : 0;
    });
  const registroUna = registrosOrdenados.find((r) => r.id === unaId) || null;
  const puedeImprimir = modo === "una" ? !!registroUna : registrosPeriodo.length > 0;

  function finalizar(incluirFotos) {
    if (modo === "una") {
      onConfirmar({ registros: [registroUna], encabezado: construirEncabezadoImpresion("una", [registroUna], "", area), incluirFotos });
    } else {
      onConfirmar({ registros: registrosPeriodo, encabezado: construirEncabezadoImpresion("varias", registrosPeriodo, label, area), incluirFotos });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className={`${cardClass} flex max-h-[90vh] w-full flex-col rounded-b-none sm:max-w-md sm:rounded-2xl`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#edf0f4] px-4 py-3">
          <p className="text-sm font-bold text-[#0f1f3d]">Imprimir {nombreRegistroPlural}</p>
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#edf0f4] px-2 py-1 text-xs font-semibold text-[#5b6472]">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {pasoFotos ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
              <p className="text-3xl">📷</p>
              <p className="text-sm font-semibold text-[#0f1f3d]">¿Agregar fotos de evidencia al PDF?</p>
              <p className="max-w-[22rem] text-xs text-[#5b6472]">Se incluirán a tamaño 1/4 de carta, con la fecha, hora e identificación de cada registro.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex rounded-xl border border-[#edf0f4] p-1">
                {[["una", `Una ${nombreRegistroSingular}`], ["varias", `Varias ${nombreRegistroPlural}`]].map(([key, texto]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModo(key)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${modo === key ? "bg-[#0b1f3a] text-white" : "text-[#5b6472]"}`}
                  >
                    {texto}
                  </button>
                ))}
              </div>

              {modo === "una" ? (
                registrosOrdenados.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#94a3b8]">No hay {nombreRegistroPlural} registradas.</p>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {registrosOrdenados.map((r) => {
                      const insp = r.calidad_inspecciones?.[0];
                      const activo = unaId === r.id;
                      return (
                        <div
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setUnaId(r.id)}
                          className={`cursor-pointer rounded-xl border p-2.5 text-xs transition ${activo ? "border-[#c9a227] bg-[#fdf7e6]" : "border-[#edf0f4] bg-white"}`}
                        >
                          <p className="font-semibold text-[#0f1f3d]">{r.fecha} · {horaCorta(insp?.hora)} · {r.inspectora_nombre || "—"}</p>
                          <p className="text-[#5b6472]">{renderResumenItem(r, insp)}</p>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex rounded-xl border border-[#edf0f4] p-1">
                    {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([key, texto]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPeriodo(key)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${periodo === key ? "bg-[#0b1f3a] text-white" : "text-[#5b6472]"}`}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                  <label className={`${labelClass} block`}>
                    Fecha de referencia
                    <input type="date" value={fechaRef} onChange={(e) => setFechaRef(e.target.value)} className={inputClass} />
                  </label>
                  <p className="rounded-lg bg-[#f7f7f4] px-2.5 py-1.5 text-xs font-medium text-[#5b6472]">
                    {label}: {registrosPeriodo.length} {registrosPeriodo.length === 1 ? nombreRegistroSingular : nombreRegistroPlural} encontrada(s).
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[#edf0f4] p-3">
          {pasoFotos ? (
            <>
              <button type="button" onClick={() => finalizar(true)} className={`flex-1 ${btnPrimaryClass}`}>Sí, incluir fotos</button>
              <button type="button" onClick={() => finalizar(false)} className={btnGhostClass}>No</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setPasoFotos(true)} disabled={!puedeImprimir} className={`flex-1 ${btnPrimaryClass}`}>🖨️ Imprimir</button>
              <button type="button" onClick={onCancel} className={btnGhostClass}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Reproduce el formato de inspección tal como está en el Excel original
// (título, encabezado, instrucciones, columnas, leyenda y criterio son texto
// fijo, idéntico al archivo fuente) y llena las filas con los registros
// elegidos en ImprimirModal. `formato` describe lo que cambia por planta —
// ver FORMATO_MP en MateriaPrimaPanel.jsx / FORMATO_PLANTA1 en Planta1Panel.jsx.
export function ReciboImprimible({ registros, puntosCatalogo, tituloEncabezado, incluirFotos, formato }) {
  const {
    tituloRecibo, subtitulo, instrucciones, columnas, colAnchos, letras, renderCeldasAntes, leyenda, leyendaGrupos, criterio, nombreRegistro, identificarFoto,
    // Casi todos los formatos comparten los mismos colores (extraídos del
    // Excel real), pero Planta 3 usa un esquema propio en su hoja fuente —
    // estos overrides opcionales permiten respetarlo sin tocar el resto.
    colorTitulo = EXCEL_COLOR.titulo,
    colorLeyendaTitulo = EXCEL_COLOR.sub,
    colorLeyendaTexto = "#FFFFFF",
    colorCierreTitulo = EXCEL_COLOR.encabezadoTabla,
    // Las 4 columnas finales (Resultado/Clasif./Observación/Acción) y la
    // columna Firmas del cierre son iguales en Materia Prima/Planta 1/2/3 —
    // Producto Terminado (F-GC-05) no las tiene igual (esos datos van en su
    // propia "tablaExtra" de reinspección/liberación, y solo firma la
    // inspectora), así que ambas son configurables con estos defaults.
    columnasFinales = [
      { render: (insp) => insp.resultado },
      { render: (insp) => insp.clasificacion || "" },
      { render: (insp) => insp.observacion },
      { render: (insp) => insp.accion_reinspeccion },
    ],
    renderFirmas = (r) => (
      <>
        Inspectora: {r.firma_inspectora || "—"}<br />
        Resp. área: {r.responsable_area_nombre || "—"}<br />
        Gerente Calidad: {r.gerente_calidad_nombre || "—"}
      </>
    ),
    tablaExtra,
  } = formato;

  // Algunos formatos (Planta 3) tienen más de un juego de puntos de control
  // según el proceso elegido, con la misma letra significando algo distinto
  // en cada uno — por eso se filtra también por insp.proceso. Los formatos
  // con un solo juego (proceso = null en el catálogo) no se ven afectados.
  function valorPorLetra(insp, letra) {
    const punto = puntosCatalogo.find((p) => p.letra === letra && (p.proceso == null || p.proceso === insp.proceso));
    const pp = punto && (insp.calidad_inspeccion_puntos || []).find((x) => x.punto_control_id === punto.id);
    return pp?.valor || "";
  }

  return (
    <div className="text-black" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ background: colorTitulo }}>
        <span className="shrink-0 rounded-md bg-white px-2 py-1">
          <img src={vikingoLogo} alt="Vikingo" className="h-6 w-auto object-contain" />
        </span>
        <p className="flex-1 text-center text-sm font-bold text-white">{tituloRecibo}</p>
        <span className="w-[52px] shrink-0" />
      </div>
      <p className="px-3 py-1 text-center text-[10px] font-bold text-white" style={{ background: EXCEL_COLOR.sub }}>{subtitulo}</p>
      <div className="px-3 py-1.5" style={{ background: EXCEL_COLOR.info }}>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {tituloEncabezado.map((campo) => (
            <span key={campo.label}><span className="font-bold">{campo.label}:</span> {campo.value}</span>
          ))}
        </div>
        <p className="mt-1 text-[9px] italic">{instrucciones}</p>
      </div>

      <table className="mt-2 w-full border-collapse text-[8px]">
        <colgroup>
          {colAnchos.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
        <thead>
          <tr style={{ background: EXCEL_COLOR.encabezadoTabla }}>
            {columnas.map((h) => (
              <th key={h} className="border border-black px-1 py-1 font-bold text-white">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => {
            const insp = r.calidad_inspecciones?.[0];
            if (!insp) return null;
            const celdas = renderCeldasAntes(insp);
            return (
              <tr key={r.id}>
                <td className="border border-black px-1 py-0.5">{horaCorta(insp.hora)}</td>
                {celdas.map((c, i) => (
                  <td key={i} className={`border border-black px-1 py-0.5 ${c.center ? "text-center" : ""}`}>{c.v}</td>
                ))}
                {letras.map((l) => (
                  <td key={l} className="border border-black px-1 py-0.5 text-center">{valorPorLetra(insp, l)}</td>
                ))}
                {columnasFinales.map((col, i) => (
                  <td key={i} className="border border-black px-1 py-0.5">{col.render(insp)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {tablaExtra && (
        <>
          <p className="mt-3 px-2 py-1 text-[9px] font-bold" style={{ background: tablaExtra.color, color: tablaExtra.colorTexto }}>{tablaExtra.titulo}</p>
          <table className="w-full border-collapse text-[8px]">
            <colgroup>
              {tablaExtra.columnas.map((c, i) => <col key={i} style={{ width: `${100 / tablaExtra.columnas.length}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                {tablaExtra.columnas.map((h) => (
                  <th key={h} className="border border-black px-1 py-1 font-bold" style={{ background: EXCEL_COLOR.leyendaFondo }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => {
                const insp = r.calidad_inspecciones?.[0];
                if (!insp) return null;
                return (
                  <tr key={r.id}>
                    {tablaExtra.renderFila(r, insp).map((v, i) => (
                      <td key={i} className="border border-black px-1 py-0.5">{v}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <p className="mt-3 px-2 py-1 text-[9px] font-bold" style={{ background: colorLeyendaTitulo, color: colorLeyendaTexto }}>LEYENDA DE PUNTOS DE CONTROL</p>
      {leyendaGrupos ? (
        leyendaGrupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-2 py-1 text-[9px] font-bold" style={{ background: grupo.color, color: grupo.colorTexto }}>{grupo.titulo}</p>
            <div className="grid grid-cols-2 gap-x-6 px-2 py-1.5 text-[9px]" style={{ background: EXCEL_COLOR.leyendaFondo }}>
              {grupo.pares.map((par, i) => (
                <Fragment key={i}>
                  <p>{par[0]}</p>
                  <p>{par[1] || ""}</p>
                </Fragment>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-2 gap-x-6 px-2 py-1.5 text-[9px]" style={{ background: EXCEL_COLOR.leyendaFondo }}>
          {leyenda.map((par, i) => (
            <Fragment key={i}>
              <p>{par[0]}</p>
              <p>{par[1] || ""}</p>
            </Fragment>
          ))}
        </div>
      )}
      <p className="px-2 py-1.5 text-[9px]">{criterio}</p>

      <p className="mt-3 px-2 py-1 text-[9px] font-bold text-white" style={{ background: colorCierreTitulo }}>CIERRE / DICTAMEN</p>
      <table className="w-full border-collapse text-[8px]">
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "40%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-black px-1 py-1 font-bold" style={{ background: EXCEL_COLOR.leyendaFondo }}>{nombreRegistro}</th>
            <th className="border border-black px-1 py-1 font-bold" style={{ background: EXCEL_COLOR.leyendaFondo }}>Dictamen</th>
            <th className="border border-black px-1 py-1 font-bold" style={{ background: EXCEL_COLOR.leyendaFondo }}>Observación general / pendientes</th>
            <th className="border border-black px-1 py-1 font-bold" style={{ background: EXCEL_COLOR.leyendaFondo }}>Firmas</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td className="border border-black px-1 py-1">{ddmmyyyy(r.fecha)} · {horaCorta(r.calidad_inspecciones?.[0]?.hora)}</td>
              <td className="border border-black px-1 py-1">☑ {r.dictamen || "—"}</td>
              <td className="border border-black px-1 py-1">{r.observacion_general || "—"}</td>
              <td className="border border-black px-1 py-1">{renderFirmas(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {incluirFotos && (() => {
        const fotos = registros.flatMap((r) => {
          const insp = r.calidad_inspecciones?.[0];
          return (insp?.calidad_evidencias || []).map((ev, i) => ({ ev, r, insp, indice: i + 1 }));
        });
        if (fotos.length === 0) {
          return <p className="mt-3 px-2 text-[9px] italic">No hay fotos de evidencia registradas para esta selección.</p>;
        }
        return (
          <div className="mt-3">
            <p className="px-2 py-1 text-[9px] font-bold text-white" style={{ background: colorTitulo, pageBreakAfter: "avoid" }}>EVIDENCIA FOTOGRÁFICA</p>
            <div className="mt-1 flex flex-wrap" style={{ gap: "8px" }}>
              {fotos.map(({ ev, r, insp, indice }) => (
                <div key={ev.id} className="gc-foto-box flex flex-col border border-black" style={{ width: "calc(50% - 4px)", height: "3.5in" }}>
                  <div className="flex-1 overflow-hidden">
                    <img src={ev.url} alt="Evidencia" className="h-full w-full object-contain" />
                  </div>
                  <p className="border-t border-black px-1 py-0.5 text-center text-[9px] font-semibold">
                    {ddmmyyyy(r.fecha)} · {horaCorta(insp.hora)} · {identificarFoto(r, insp)} — Evidencia {indice}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Detalle de un registro ya guardado — reutiliza el mismo formato de
// secciones desplegables que el formulario de captura, en modo lectura, más
// el botón de eliminar y la evidencia fotográfica. `renderIdentificacion` y
// `renderCantidadMuestra` dejan que cada panel arme sus propios campos
// (difieren por planta); Puntos/Resultado/Cierre son 100% genéricos.
function NombreFirma({ nombre, fecha }) {
  return (
    <span className="text-[11px] font-bold text-slate-700">
      {nombre}
      {fecha && <span className="font-medium text-slate-400"> · {new Date(fecha).toLocaleDateString("es-MX")}</span>}
    </span>
  );
}

function BotonRecordatorio({ onEnviar }) {
  const [estado, setEstado] = useState("idle"); // idle | enviando | enviado
  if (estado === "enviado") return <span className="text-[10px] font-semibold text-emerald-600">Enviado ✓</span>;
  return (
    <button
      type="button"
      title="Enviar recordatorio"
      disabled={estado === "enviando"}
      onClick={async () => { setEstado("enviando"); await onEnviar(); setEstado("enviado"); }}
      className="rounded-full border border-[#edf0f4] bg-white px-1.5 py-0.5 text-[11px] transition active:scale-90 disabled:opacity-50"
    >
      🔔
    </button>
  );
}

export function DetalleRegistroModal({ registro, puntosCatalogo, currentUser, canEdit, onClose, onDelete, onEvidenciaChange, renderIdentificacion, renderCantidadMuestra, tituloEliminar = "Eliminar registro", gerenteCalidadPersonaId, onFirmarResponsable, onFirmarGerente, onEnviarRecordatorio, mostrarFirmasArea = true }) {
  const [openSection, setOpenSection] = useState("identificacion");
  const insp = registro.calidad_inspecciones?.[0];
  if (!insp) return null;
  const esConforme = insp.resultado !== "No Conforme";
  const puntosOrdenados = insp.calidad_inspeccion_puntos || [];

  function toggle(section) {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`${cardClass} flex max-h-[92vh] w-full flex-col rounded-b-none sm:max-w-md sm:rounded-2xl`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#edf0f4] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#0f1f3d]">{registro.fecha} · {horaCorta(insp.hora)}</p>
            <p className="truncate text-xs text-[#5b6472]">Inspectora: {registro.inspectora_nombre || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-[#edf0f4] px-2 py-1 text-xs font-semibold text-[#5b6472]">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className={`mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${esConforme ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {esConforme ? "✅" : "⚠️"} Resultado: {insp.resultado}
          </div>

          <div className="space-y-2">
            <AccordionSection icon="📋" title="Identificación" open={openSection === "identificacion"} onToggle={() => toggle("identificacion")}>
              {renderIdentificacion(insp)}
            </AccordionSection>

            <AccordionSection
              icon="🔢"
              title="Cantidad y muestra"
              subtitle={`Cant. ${insp.cantidad ?? "—"} · Muestra ${insp.muestra ?? "—"}`}
              open={openSection === "cantidad"}
              onToggle={() => toggle("cantidad")}
            >
              {renderCantidadMuestra ? renderCantidadMuestra(insp) : (
                <div className="grid grid-cols-2 gap-3">
                  <CampoTexto label="Cantidad" value={insp.cantidad} />
                  <CampoTexto label="Muestra" value={insp.muestra} />
                </div>
              )}
            </AccordionSection>

            <AccordionSection
              icon="✅"
              title="Puntos de control"
              subtitle={`${puntosOrdenados.length} punto(s) registrados`}
              open={openSection === "puntos"}
              onToggle={() => toggle("puntos")}
            >
              <div className="space-y-2">
                {puntosOrdenados.map((pp) => {
                  const punto = puntosCatalogo.find((p) => p.id === pp.punto_control_id);
                  return (
                    <div key={pp.id} className="flex items-start justify-between gap-2 border-b border-[#edf0f4] pb-2 last:border-0 last:pb-0">
                      <p className="min-w-0 flex-1 text-xs text-[#5b6472]"><span className="font-bold text-[#0f1f3d]">{punto?.letra || "?"}.</span> {punto?.descripcion || "Punto de control"}</p>
                      <span className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${pp.valor === "NC" ? "border-red-200 bg-red-50 text-red-600" : pp.valor === "C" ? "border-green-200 bg-green-50 text-green-700" : "border-[#edf0f4] bg-white text-[#5b6472]"}`}>
                        {pp.valor || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </AccordionSection>

            <AccordionSection icon="📝" title="Resultado y observaciones" open={openSection === "resultado"} onToggle={() => toggle("resultado")}>
              {insp.clasificacion && <div className="mb-3"><CampoTexto label="Clasificación de la NC" value={insp.clasificacion} /></div>}
              <CampoTexto label="Observación / evidencia" value={insp.observacion} />
              <div className="mt-3"><CampoTexto label="Acción / Reinspección" value={insp.accion_reinspeccion} /></div>
              <div className="mt-3">
                <p className={labelClass}>Evidencia fotográfica</p>
                <div className="mt-1">
                  <EvidenciaUploader
                    inspeccionId={insp.id}
                    evidencias={insp.calidad_evidencias || []}
                    currentUser={currentUser}
                    onChange={onEvidenciaChange}
                    canEdit={canEdit}
                  />
                </div>
              </div>
            </AccordionSection>

            <AccordionSection icon="🖊️" title="Cierre y firmas" subtitle={registro.dictamen} open={openSection === "cierre"} onToggle={() => toggle("cierre")}>
              <CampoTexto label="Dictamen" value={registro.dictamen} />
              <div className="mt-3"><CampoTexto label="Observación general / pendientes" value={registro.observacion_general} /></div>
              <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Firmas</p>
              <div className={`grid gap-2 ${mostrarFirmasArea ? "sm:grid-cols-3" : ""}`}>
                <FirmaCard rol="Inspectora" firmado={!!registro.firma_inspectora}>
                  {registro.firma_inspectora
                    ? <NombreFirma nombre={registro.firma_inspectora} />
                    : <span className="text-[11px] font-medium text-slate-400">Sin firmar</span>}
                </FirmaCard>

                {mostrarFirmasArea && (
                  <>
                    <FirmaCard rol="Supervisor de área" firmado={!!registro.responsable_area_nombre}>
                      {registro.responsable_area_nombre ? (
                        <NombreFirma nombre={registro.responsable_area_nombre} fecha={registro.responsable_area_firmado_at} />
                      ) : Number(currentUser?.persona_id) === Number(registro.responsable_area_persona_id) ? (
                        <button type="button" onClick={() => onFirmarResponsable(registro)} className="mt-0.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">Firmar</button>
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-medium text-slate-400">Sin firmar</span>
                          {canEdit && registro.responsable_area_persona_id && (
                            <BotonRecordatorio onEnviar={() => onEnviarRecordatorio(registro.responsable_area_persona_id, registro)} />
                          )}
                        </div>
                      )}
                    </FirmaCard>

                    <FirmaCard rol="Gerente de Calidad" firmado={!!registro.gerente_calidad_nombre}>
                      {registro.gerente_calidad_nombre ? (
                        <NombreFirma nombre={registro.gerente_calidad_nombre} fecha={registro.gerente_calidad_firmado_at} />
                      ) : Number(currentUser?.persona_id) === gerenteCalidadPersonaId ? (
                        <button type="button" onClick={() => onFirmarGerente(registro)} className="mt-0.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">Firmar</button>
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-medium text-slate-400">Sin firmar</span>
                          {canEdit && (
                            <BotonRecordatorio onEnviar={() => onEnviarRecordatorio(gerenteCalidadPersonaId, registro)} />
                          )}
                        </div>
                      )}
                    </FirmaCard>
                  </>
                )}
              </div>
            </AccordionSection>
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 justify-end border-t border-[#edf0f4] p-3">
            <button type="button" onClick={() => onDelete(registro.id)} className="text-xs font-medium text-red-500 hover:text-red-600">{tituloEliminar}</button>
          </div>
        )}
      </div>
    </div>
  );
}
