import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPuntosControl,
  crearInspeccionMP,
  getInspeccionesMP,
  deleteRecorrido,
  sugerirMuestreo,
  subirEvidencia,
} from "../../services/calidadService";
import EvidenciaPicker from "./EvidenciaPicker";
import HelpTip from "./HelpTip";
import { cardClass, btnPrimaryClass, btnGhostClass, STATUS_STYLES } from "./coreliTheme";
import imprimirIcon from "../../assets/calidad-imprimir-icon.jpg";
import {
  todayISO, nowHHMM, agruparPorMes, horaCorta, dictamenCorto,
  inicioSemanaISO, finSemanaISO, aplicarFiltrosRegistros,
  PuntoControlChip, AccordionSection, CampoTexto, FirmaCard, inputClass, labelClass,
  PRINT_STYLE_BLOCK, ImprimirModal, ReciboImprimible, DetalleRegistroModal,
} from "./shared";

// Formato F-GC-01U tal como está en el Excel original (RECEPCIÓN DE MATERIA
// PRIMA) — colores, columnas, leyenda y criterio extraídos directo del
// archivo fuente. Ver ReciboImprimible en shared.jsx.
const FORMATO_MP = {
  tituloRecibo: "RECEPCIÓN DE MATERIA PRIMA",
  subtitulo: "FÁBRICA DE MUEBLES VIKINGO  ·  GESTIÓN DE CALIDAD  ·  Código: F-GC-01U  ·  Versión: 00",
  instrucciones: "Una fila = una inspección realizada. Marcar puntos: C = Cumple, NC = No Cumple, NA = No aplica. Si existe NC, registrar clasificación, evidencia, acción y reinspección/liberación.",
  columnas: ["Hora", "OC / Lote", "Proveedor", "MP a inspeccionar", "Lote / Identificación", "Cant.", "Muestra", "A", "B", "C", "D", "E", "F", "G", "Resultado", "Clasif.", "Observación / evidencia", "Acción / Reinspección"],
  colAnchos: [4, 7, 7, 9, 9, 4, 4, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 6, 5, 17.5, 10],
  letras: ["A", "B", "C", "D", "E", "F", "G"],
  renderCeldasAntes: (insp) => [
    { v: insp.oc_lote }, { v: insp.proveedor }, { v: insp.producto_texto }, { v: insp.lote_identificacion },
    { v: insp.cantidad, center: true }, { v: insp.muestra, center: true },
  ],
  leyenda: [
    ["A = Identificación / material vs OC", "B = Cantidad / presentación"],
    ["C = Dimensión / calibre / espesor", "D = Condición física / integridad"],
    ["E = Humedad / contaminación", "F = Color / tono / apariencia"],
    ["G = Criterio técnico específico", ""],
  ],
  criterio: "CRITERIO: La Matriz / plano / ficha técnica vigente establece la aceptación. Ante condición no contemplada: no asumir; documentar y escalar a Gestión de Calidad.",
  nombreRegistro: "Recepción",
  identificarFoto: (r, insp) => insp.producto_texto || "MP",
};

const FORM_VACIO = {
  hora: nowHHMM(),
  oc_lote: "",
  proveedor: "",
  producto_texto: "",
  lote_identificacion: "",
  cantidad: "",
  muestra: "",
  observacion: "",
  accion_reinspeccion: "",
};
const CIERRE_VACIO = { dictamen: "", observacion_general: "", responsable_area_nombre: "", gerente_calidad_nombre: "", firmado: false };

// Filtros sobre texto libre (proveedor, MP, OC/Lote, inspectora) — no sobre
// catálogos, porque Proveedores/Colaboradores/Productos aún no existen como
// tablas propias. En cuanto se suban esos catálogos, "Proveedor" puede pasar
// de texto libre a un select sin cambiar el resto de este filtro.
const FILTROS_VACIO = { busqueda: "", dictamen: "", desde: "", hasta: "" };
function camposBusquedaMP(r, insp) {
  return [insp?.proveedor, insp?.producto_texto, insp?.oc_lote, insp?.lote_identificacion, r.inspectora_nombre];
}

// Cada captura de Materia Prima es un registro completo y autosuficiente —
// incluye su propio cierre/dictamen/firmas al final, en vez de depender de
// un "recorrido" que agrupe varias inspecciones (eso sí aplica a Planta
// 1/2/3, donde hay un recorrido físico por la planta; aquí puede haber
// varias recepciones el mismo día — cada entrega es su propio registro).
function NuevaInspeccionForm({ puntos, currentUser, onSave, onCancel }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [valoresPuntos, setValoresPuntos] = useState({});
  const [cierre, setCierre] = useState(CIERRE_VACIO);
  const [fotos, setFotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [clasificacion, setClasificacion] = useState("");
  const [openSection, setOpenSection] = useState("identificacion");
  const sugerencia = sugerirMuestreo(form.cantidad);
  const nombreInspectora = currentUser?.nombre || currentUser?.usuario || "Inspectora";

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function toggle(section) {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  const puntosMarcados = Object.keys(valoresPuntos).filter((k) => valoresPuntos[k]).length;
  const hayNC = Object.values(valoresPuntos).includes("NC");
  const resultado = hayNC ? "No Conforme" : "Conforme";
  const puedeGuardar = cierre.dictamen && cierre.firmado;

  async function handleSave() {
    setSaving(true);
    const puntosPayload = puntos.map((p) => ({ punto_control_id: p.id, valor: valoresPuntos[p.id] || null }));
    await onSave({
      inspeccion: { ...form, cantidad: form.cantidad || null, muestra: form.muestra || sugerencia?.muestra || null, resultado, clasificacion: hayNC ? clasificacion || "Menor" : null },
      puntos: puntosPayload,
      cierre,
      fotos,
    });
    setSaving(false);
  }

  return (
    <div className={`${cardClass} p-3`}>
      <p className="mb-3 px-1 text-sm font-bold text-[#0f1f3d]">✍️ Nueva recepción</p>

      <div className="space-y-2">
        <AccordionSection
          icon="📋"
          title="Identificación"
          help="Del formato F-GC-01U: seleccionar la MP a inspeccionar y registrar OC/Lote, proveedor y lote/identificación."
          subtitle={form.producto_texto || "Hora, OC/Lote, proveedor, MP, lote…"}
          open={openSection === "identificacion"}
          onToggle={() => toggle("identificacion")}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Hora
              <input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              OC / Lote
              <input value={form.oc_lote} onChange={(e) => setField("oc_lote", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Proveedor
              <input value={form.proveedor} onChange={(e) => setField("proveedor", e.target.value)} className={inputClass} />
            </label>
            <label className={`${labelClass} col-span-2`}>
              MP a inspeccionar
              <input value={form.producto_texto} onChange={(e) => setField("producto_texto", e.target.value)} className={inputClass} />
            </label>
            <label className={`${labelClass} col-span-2`}>
              Lote / Identificación
              <input value={form.lote_identificacion} onChange={(e) => setField("lote_identificacion", e.target.value)} className={inputClass} />
            </label>
          </div>
        </AccordionSection>

        <AccordionSection
          icon="🔢"
          title="Cantidad y muestra"
          help="Cant. = tamaño del lote recibido. Muestra = cuántas piezas revisar, según el Plan de Muestreo Ac/Re del formato (ver pestaña Guías si quieres consultar la tabla completa)."
          subtitle={form.cantidad ? `Cant. ${form.cantidad} · Muestra ${form.muestra || sugerencia?.muestra || "—"}` : "Tamaño de lote y tamaño de muestra"}
          open={openSection === "cantidad"}
          onToggle={() => toggle("cantidad")}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Cant.
              <input type="number" min="0" value={form.cantidad} onChange={(e) => setField("cantidad", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Muestra
              <input type="number" min="0" value={form.muestra} placeholder={sugerencia ? String(sugerencia.muestra) : ""} onChange={(e) => setField("muestra", e.target.value)} className={inputClass} />
            </label>
          </div>
          {sugerencia && (
            <p className="mt-2 rounded-lg bg-[#fdf7e6] px-2.5 py-1.5 text-[11px] font-medium text-[#96771a]">
              Plan de muestreo: muestra {sugerencia.muestra} · Ac {sugerencia.ac} · Re {sugerencia.re} (no conformidades menores). 1 Mayor/Crítica → contener y ampliar a 100%.
            </p>
          )}
        </AccordionSection>

        <AccordionSection
          icon="✅"
          title="Puntos de control"
          help="Del formato F-GC-01U: marcar cada punto como C = Cumple, NC = No Cumple, o NA = No aplica. La Matriz/plano/ficha técnica vigente establece la aceptación de cada uno."
          subtitle={puntosMarcados > 0 ? `${puntosMarcados} de ${puntos.length} marcados · ${resultado}` : `${puntos.length} puntos (A-${puntos[puntos.length - 1]?.letra || "G"})`}
          open={openSection === "puntos"}
          onToggle={() => toggle("puntos")}
        >
          <div className="space-y-2">
            {puntos.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2 border-b border-[#edf0f4] pb-2 last:border-0 last:pb-0">
                <p className="min-w-0 flex-1 text-xs text-[#5b6472]"><span className="font-bold text-[#0f1f3d]">{p.letra}.</span> {p.descripcion}</p>
                <PuntoControlChip valor={valoresPuntos[p.id]} onChange={(v) => setValoresPuntos((cur) => ({ ...cur, [p.id]: v }))} />
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-[#f7f7f4] px-2.5 py-1.5 text-[11px] text-[#5b6472]">
            <span className="font-bold text-[#0f1f3d]">Resultado: {resultado}.</span> La Matriz/plano/ficha técnica vigente establece la aceptación. Ante condición no contemplada: no asumir, documentar y escalar a Gestión de Calidad.
          </p>
        </AccordionSection>

        <AccordionSection
          icon="📝"
          title="Resultado y observaciones"
          help="Del formato F-GC-01U: si existe una NC (No Cumple), registrar su clasificación, evidencia, acción y reinspección/liberación."
          subtitle={fotos.length > 0 ? `${fotos.length} foto(s) de evidencia` : (form.observacion || form.accion_reinspeccion ? "Con observación / acción capturada" : "Clasificación, observación, acción/reinspección, evidencia")}
          open={openSection === "resultado"}
          onToggle={() => toggle("resultado")}
        >
          <div className={`mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${resultado === "Conforme" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {resultado === "Conforme" ? "✅" : "⚠️"} Resultado: {resultado}
          </div>
          {hayNC && (
            <label className={`${labelClass} mb-3 block text-red-600`}>
              Clasificación de la NC
              <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value)} className={`${inputClass} border-red-200`}>
                <option value="">Seleccionar…</option>
                <option value="Menor">Menor</option>
                <option value="Mayor">Mayor</option>
                <option value="Crítico">Crítico</option>
              </select>
            </label>
          )}
          <label className={`${labelClass} block`}>
            Observación / evidencia
            <textarea value={form.observacion} onChange={(e) => setField("observacion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </label>
          <label className={`${labelClass} mt-3 block`}>
            Acción / Reinspección
            <textarea value={form.accion_reinspeccion} onChange={(e) => setField("accion_reinspeccion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </label>
          <label className={`${labelClass} mt-3 block`}>
            Evidencia fotográfica
            <span className="mt-1 block normal-case">
              <EvidenciaPicker fotos={fotos} onChange={setFotos} />
            </span>
          </label>
        </AccordionSection>

        <AccordionSection
          icon="🖊️"
          title="Cierre y firmas"
          help="Del formato F-GC-01U (Cierre / dictamen): Conforme, Conforme con observación, o Producto No Conforme, más observación general/pendientes y las firmas de quien inspeccionó, el responsable de área y la fecha/hora de cierre."
          subtitle={cierre.dictamen || "Dictamen, observación general y firmas"}
          open={openSection === "cierre"}
          onToggle={() => toggle("cierre")}
        >
          <label className={`${labelClass} block`}>
            Dictamen
            <select value={cierre.dictamen} onChange={(e) => setCierre((c) => ({ ...c, dictamen: e.target.value }))} className={inputClass}>
              <option value="">Seleccionar…</option>
              <option value="Conforme">Conforme</option>
              <option value="Conforme con observación">Conforme con observación</option>
              <option value="Producto No Conforme">Producto No Conforme</option>
            </select>
          </label>
          <label className={`${labelClass} mt-3 block`}>
            Observación general / pendientes
            <textarea value={cierre.observacion_general} onChange={(e) => setCierre((c) => ({ ...c, observacion_general: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
          </label>

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Firmas</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <FirmaCard rol="Inspectora" firmado={cierre.firmado}>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-slate-700">
                <input type="checkbox" checked={cierre.firmado} onChange={(e) => setCierre((c) => ({ ...c, firmado: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
                {cierre.firmado ? <span className="font-bold text-slate-700">{nombreInspectora}</span> : `Firmar como ${nombreInspectora}`}
              </label>
            </FirmaCard>
            <FirmaCard rol="Supervisor de área" firmado={!!cierre.responsable_area_nombre}>
              <input
                value={cierre.responsable_area_nombre}
                onChange={(e) => setCierre((c) => ({ ...c, responsable_area_nombre: e.target.value }))}
                placeholder="Nombre de quien da el visto"
                className="w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
            </FirmaCard>
            <FirmaCard rol="Gerente de Calidad" firmado={!!cierre.gerente_calidad_nombre}>
              <input
                value={cierre.gerente_calidad_nombre}
                onChange={(e) => setCierre((c) => ({ ...c, gerente_calidad_nombre: e.target.value }))}
                placeholder="Nombre de quien da el visto"
                className="w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
            </FirmaCard>
          </div>
        </AccordionSection>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving || !puedeGuardar} className={`flex-1 sm:flex-none ${btnPrimaryClass}`}>
          {saving ? "Guardando…" : "Guardar recepción"}
        </button>
        <button type="button" onClick={onCancel} className={btnGhostClass}>Cancelar</button>
      </div>
      {!puedeGuardar && <p className="mt-2 text-[11px] text-[#94a3b8]">Falta el dictamen y la firma de la inspectora para poder guardar.</p>}
    </div>
  );
}

// Fila compacta de la tabla — el detalle completo vive en DetalleRegistroModal,
// abierto con el botón "Ver".
function RegistroFila({ registro, onVer }) {
  const insp = registro.calidad_inspecciones?.[0];
  if (!insp) return null;
  const [, mes, dia] = registro.fecha.split("-");

  return (
    <tr className="border-t border-[#edf0f4] first:border-0">
      <td className="px-2 py-2 align-top">
        <p className="text-xs font-semibold text-[#0f1f3d]">{dia}/{mes}</p>
        <p className="text-[10px] text-[#94a3b8]">{horaCorta(insp.hora)}</p>
      </td>
      <td className="px-2 py-2 align-top">
        <p className="truncate text-xs font-medium text-[#0f1f3d]">{registro.inspectora_nombre || "—"}</p>
        <p className="truncate text-[10px] text-[#5b6472]">{insp.producto_texto || "—"}</p>
      </td>
      <td className="px-2 py-2 align-top">
        <span className={`inline-block rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[registro.dictamen] || "border-[#edf0f4] bg-[#f7f7f4] text-[#0f1f3d]"}`}>
          {dictamenCorto(registro.dictamen)}
        </span>
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          type="button"
          onClick={() => onVer(registro)}
          className="rounded-lg border border-[#edf0f4] bg-white px-2 py-1 text-[10px] font-semibold text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.06)] transition active:scale-95"
        >
          👁 Ver
        </button>
      </td>
    </tr>
  );
}

function renderIdentificacionMP(insp) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CampoTexto label="OC / Lote" value={insp.oc_lote} />
      <CampoTexto label="Proveedor" value={insp.proveedor} />
      <div className="col-span-2"><CampoTexto label="MP inspeccionada" value={insp.producto_texto} /></div>
      <div className="col-span-2"><CampoTexto label="Lote / Identificación" value={insp.lote_identificacion} /></div>
    </div>
  );
}

export default function MateriaPrimaPanel({ currentUser, canEdit = true }) {
  const [puntos, setPuntos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verId, setVerId] = useState(null);
  // Por default el filtro arranca acotado a la semana actual (lunes a
  // domingo) — "Limpiar filtros" sí quita esta acotación por completo.
  const [filtros, setFiltros] = useState(() => {
    const hoy = todayISO();
    return { ...FILTROS_VACIO, desde: inicioSemanaISO(hoy), hasta: finSemanaISO(hoy) };
  });
  const [showFiltros, setShowFiltros] = useState(false);
  const [showImprimir, setShowImprimir] = useState(false);
  const [printJob, setPrintJob] = useState(null);

  async function loadRegistros() {
    const result = await getInspeccionesMP();
    if (result.ok) setRegistros(result.data);
  }

  useEffect(() => {
    if (!printJob) return;
    let cancelado = false;
    async function irAImprimir() {
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (printJob.incluirFotos) {
        const imgs = Array.from(document.querySelectorAll(".gc-print-portal img"));
        await Promise.all(
          imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })))
        );
      }
      if (!cancelado) window.print();
    }
    irAImprimir();
    return () => { cancelado = true; };
  }, [printJob]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [puntosResult] = await Promise.all([getPuntosControl("Materia Prima"), loadRegistros()]);
      if (puntosResult.ok) setPuntos(puntosResult.data);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGuardar({ inspeccion, puntos: puntosPayload, cierre, fotos }) {
    const result = await crearInspeccionMP({ fecha: todayISO(), jornada: "07:00–17:00", inspeccion, puntos: puntosPayload, cierre }, currentUser);
    if (!result.ok) { window.alert("No fue posible guardar la recepción."); return; }
    const inspeccionId = result.data?.calidad_inspecciones?.[0]?.id;
    if (inspeccionId && fotos?.length) {
      for (const foto of fotos) {
        await subirEvidencia(inspeccionId, foto.blob, currentUser);
      }
    }
    setShowForm(false);
    loadRegistros();
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta recepción por completo? Se borran también su inspección y fotos de evidencia. Esta acción no se puede deshacer.")) return;
    const result = await deleteRecorrido(id);
    if (!result.ok) { window.alert("No fue posible eliminar la recepción."); return; }
    if (verId === id) setVerId(null);
    loadRegistros();
  }

  if (loading) return <div className="py-10 text-center text-sm font-medium text-[#94a3b8]">Cargando…</div>;

  const registrosFiltrados = aplicarFiltrosRegistros(registros, filtros, camposBusquedaMP);
  const grupos = agruparPorMes(registrosFiltrados);
  const filtrosActivos = Object.values(filtros).filter(Boolean).length;
  const verRegistro = registros.find((r) => r.id === verId) || null;

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes gcGoldPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,162,39,0.35); } 50% { box-shadow: 0 0 0 7px rgba(201,162,39,0.10); } }
        .gc-gold-pulse { animation: gcGoldPulse 2.8s ease-in-out infinite; }
        ${PRINT_STYLE_BLOCK}
      `}</style>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Recepciones de materia prima</h2>
          <HelpTip>Cada recepción es un registro completo (identificación, puntos de control y su propio cierre/dictamen con firmas) — puede haber varias el mismo día, una por cada entrega que llegue. Se identifica por fecha, hora e inspectora, no por un folio consecutivo.</HelpTip>
        </div>
        {filtrosActivos > 0 && (
          <p className="text-xs text-[#94a3b8]">Mostrando {registrosFiltrados.length} de {registros.length}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="gc-gold-pulse flex-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-[#c9a227] bg-white px-2 py-2 text-xs font-semibold text-[#96771a] transition active:scale-[0.98] sm:text-sm"
          >
            📥 + Nueva recepción
          </button>
        )}
        {registros.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFiltros((v) => !v)}
            className="inline-flex w-20 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-[#edf0f4] bg-white px-1.5 py-2 text-xs font-semibold text-[#0f1f3d] transition active:scale-[0.98]"
          >
            🔍 Filtros
            {filtrosActivos > 0 && <span className="rounded-full bg-[#c9a227] px-1.5 py-0.5 text-[10px] font-bold text-white">{filtrosActivos}</span>}
          </button>
        )}
        {registros.length > 0 && (
          <button
            type="button"
            onClick={() => setShowImprimir(true)}
            title="Imprimir"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#edf0f4] bg-white transition active:scale-95"
          >
            <img src={imprimirIcon} alt="Imprimir" className="h-6 w-6 object-contain" />
          </button>
        )}
      </div>

      {showForm && (
        <NuevaInspeccionForm puntos={puntos} currentUser={currentUser} onSave={handleGuardar} onCancel={() => setShowForm(false)} />
      )}

      {registros.length > 0 && showFiltros && (
        <div className={`${cardClass} p-3`}>
          <div className="space-y-2.5">
            <label className={`${labelClass} block`}>
              Buscar
              <input
                value={filtros.busqueda}
                onChange={(e) => setFiltros((f) => ({ ...f, busqueda: e.target.value }))}
                placeholder="Proveedor, MP, OC/Lote, inspectora…"
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className={labelClass}>
                Desde
                <input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} className={inputClass} />
              </label>
              <label className={labelClass}>
                Hasta
                <input type="date" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} className={inputClass} />
              </label>
            </div>
            <label className={`${labelClass} block`}>
              Dictamen
              <select value={filtros.dictamen} onChange={(e) => setFiltros((f) => ({ ...f, dictamen: e.target.value }))} className={inputClass}>
                <option value="">Todos</option>
                <option value="Conforme">Conforme</option>
                <option value="Conforme con observación">Conforme con observación</option>
                <option value="Producto No Conforme">Producto No Conforme</option>
              </select>
            </label>
            {filtrosActivos > 0 && (
              <button type="button" onClick={() => setFiltros(FILTROS_VACIO)} className="text-xs font-medium text-red-500 hover:text-red-600">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {registros.length === 0 ? (
        <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>Aún no hay recepciones registradas.</div>
      ) : registrosFiltrados.length === 0 ? (
        <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>
          Ninguna recepción coincide con los filtros.{" "}
          <button type="button" onClick={() => setFiltros(FILTROS_VACIO)} className="font-semibold text-[#96771a] underline">Limpiar filtros</button>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => (
            <div key={grupo.label} className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-2 bg-[#f7f7f4] px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6472]">{grupo.label}</p>
                <span className="shrink-0 text-[11px] font-semibold text-[#94a3b8]">{grupo.items.length}</span>
              </div>
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[38%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <tbody>
                  {grupo.items.map((r) => (
                    <RegistroFila key={r.id} registro={r} onVer={(reg) => setVerId(reg.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {verRegistro && (
        <DetalleRegistroModal
          registro={verRegistro}
          puntosCatalogo={puntos}
          currentUser={currentUser}
          canEdit={canEdit}
          onClose={() => setVerId(null)}
          onDelete={handleDelete}
          onEvidenciaChange={loadRegistros}
          renderIdentificacion={renderIdentificacionMP}
          tituloEliminar="Eliminar recepción"
        />
      )}

      {showImprimir && (
        <ImprimirModal
          registros={registros}
          area="Materia Prima"
          nombreRegistroSingular="recepción"
          nombreRegistroPlural="recepciones"
          renderResumenItem={(r, insp) => `${insp?.producto_texto || "—"} · ${r.dictamen}`}
          onCancel={() => setShowImprimir(false)}
          onConfirmar={(job) => { setPrintJob(job); setShowImprimir(false); }}
        />
      )}

      {printJob && createPortal(
        <div className="gc-print-portal">
          <ReciboImprimible registros={printJob.registros} puntosCatalogo={puntos} tituloEncabezado={printJob.encabezado} incluirFotos={printJob.incluirFotos} formato={FORMATO_MP} />
        </div>,
        document.body
      )}
    </div>
  );
}
