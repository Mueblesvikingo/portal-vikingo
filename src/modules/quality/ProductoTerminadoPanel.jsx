import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPuntosControl,
  crearInspeccionUnica,
  getInspeccionesUnica,
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
  PRINT_STYLE_BLOCK, ImprimirModal, ReciboImprimible, DetalleRegistroModal, EXCEL_COLOR,
} from "./shared";

const PLANTA = "Producto Terminado";

// Formato F-GC-05 (Inspección y Liberación de Producto Terminado) — a
// diferencia de Materia Prima/Planta 1/2/3: no tiene selector de Proceso (la
// unidad de liberación es la OP), su tabla principal termina en los puntos
// de control (sin columnas de Resultado/Clasif./Observación/Acción: eso vive
// en su propia sección de "Registro de desviación/reinspección/liberación"),
// y solo firma la Inspectora — el formato original no pide Responsable de
// área ni Gerente de Calidad.
const FORMATO_PT = {
  tituloRecibo: "FORMATO DE INSPECCIÓN Y LIBERACIÓN DE PRODUCTO TERMINADO",
  subtitulo: "FÁBRICA DE MUEBLES VIKINGO  ·  GESTIÓN DE CALIDAD  ·  Código: F-GC-05  ·  Versión 00",
  instrucciones: "Unidad de liberación = OP. Verificar muestra conforme al Plan de Muestreo Vikingo. C = Cumple | NC = No Cumple | NA = No aplica. La etiqueta debe corresponder al producto, OP, terminación y cliente/destino del programa de carga.",
  columnas: ["Hora", "OP", "Código", "Modelo", "Terminación", "Cliente / Destino", "Cant. OP", "Muestra", "Ac", "Re", "NC menor", "NC May/Crit", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J / Dictamen"],
  colAnchos: [3, 5, 7, 9, 6, 10, 3, 3, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8],
  letras: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  renderCeldasAntes: (insp) => [
    { v: insp.op }, { v: insp.producto_texto }, { v: insp.modelo }, { v: insp.terminacion }, { v: insp.cliente_destino },
    { v: insp.cantidad, center: true }, { v: insp.muestra, center: true }, { v: insp.ac, center: true }, { v: insp.re, center: true },
    { v: insp.nc_menor, center: true }, { v: insp.nc_mayor_critico, center: true },
  ],
  // Sin columnas finales: aquí Resultado/Observación/Acción no van en la
  // tabla principal, van en la tabla extra de abajo.
  columnasFinales: [],
  leyenda: [
    ["A = Etiqueta / identificación y trazabilidad", "B = Cliente / destino vs programa de carga"],
    ["C = Apariencia general", "D = Tapicería"],
    ["E = Costuras y acabados", "F = Simetría / alineación"],
    ["G = Funcionalidad", "H = Estabilidad / estructura"],
    ["I = Patas / accesorios", "J = Presentación final / empaque"],
  ],
  criterio: "CRITERIO DE LIBERACIÓN: Cada OP se evalúa como lote independiente. La etiqueta y el cliente/destino deben coincidir con el producto y con el programa de carga. Una NC Mayor o Crítica implica retención/contención y escalamiento conforme al criterio vigente. Los controles definidos al 100% permanecen al 100%.",
  nombreRegistro: "Inspección",
  identificarFoto: (r, insp) => `${insp.modelo || insp.producto_texto || "PT"} · OP ${insp.op || "—"}`,
  tablaExtra: {
    titulo: "REGISTRO DE DESVIACIÓN / REINSPECCIÓN / LIBERACIÓN",
    color: EXCEL_COLOR.sub,
    colorTexto: "#FFFFFF",
    columnas: ["OP", "NC menor", "NC May/Crit", "Descripción de NC / evidencia", "Acción / corrección realizada", "Resultado de reinspección", "Hora de liberación"],
    renderFila: (r, insp) => [
      insp.op || "—",
      insp.nc_menor ?? "—",
      insp.nc_mayor_critico ?? "—",
      insp.observacion || "—",
      insp.accion_reinspeccion || "—",
      insp.resultado_reinspeccion || "—",
      horaCorta(insp.hora_liberacion) || "—",
    ],
  },
  // Solo firma Inspectora en este formato.
  renderFirmas: (r) => <>Inspectora: {r.firma_inspectora || "—"}</>,
};

const FORM_VACIO = {
  hora: nowHHMM(),
  op: "",
  producto_texto: "",
  modelo: "",
  terminacion: "",
  cliente_destino: "",
  cantidad: "",
  muestra: "",
  ac: "",
  re: "",
  nc_menor: "",
  nc_mayor_critico: "",
  observacion: "",
  accion_reinspeccion: "",
  resultado_reinspeccion: "",
  hora_liberacion: "",
};
const CIERRE_VACIO = { dictamen: "", observacion_general: "", firmado: false };

const FILTROS_VACIO = { busqueda: "", dictamen: "", desde: "", hasta: "" };
function camposBusquedaPT(r, insp) {
  return [insp?.op, insp?.producto_texto, insp?.modelo, insp?.terminacion, insp?.cliente_destino, r.inspectora_nombre];
}

// Igual que los demás: registro único autosuficiente. Aquí no hay Proceso ni
// Supervisor de área/Gerente de Calidad — solo la Inspectora firma, tal como
// está en el formato F-GC-05 original.
function NuevaInspeccionForm({ puntos, currentUser, onSave, onCancel }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [valoresPuntos, setValoresPuntos] = useState({});
  const [cierre, setCierre] = useState(CIERRE_VACIO);
  const [fotos, setFotos] = useState([]);
  const [saving, setSaving] = useState(false);
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
      inspeccion: {
        ...form,
        cantidad: form.cantidad || null,
        muestra: form.muestra || sugerencia?.muestra || null,
        ac: form.ac || sugerencia?.ac || null,
        re: form.re || sugerencia?.re || null,
        nc_menor: form.nc_menor || null,
        nc_mayor_critico: form.nc_mayor_critico || null,
        resultado,
      },
      puntos: puntosPayload,
      cierre,
      fotos,
    });
    setSaving(false);
  }

  return (
    <div className={`${cardClass} p-3`}>
      <p className="mb-3 px-1 text-sm font-bold text-[#0f1f3d]">✍️ Nueva inspección</p>

      <div className="space-y-2">
        <AccordionSection
          icon="📋"
          title="Identificación"
          help="Del formato F-GC-05: la unidad de liberación es la OP. La etiqueta debe corresponder al producto, OP, terminación y cliente/destino del programa de carga."
          subtitle={form.op ? `OP ${form.op} · ${form.modelo || "—"}` : "Hora, OP, código, modelo, terminación, cliente/destino…"}
          open={openSection === "identificacion"}
          onToggle={() => toggle("identificacion")}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Hora
              <input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              OP
              <input value={form.op} onChange={(e) => setField("op", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Código
              <input value={form.producto_texto} onChange={(e) => setField("producto_texto", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Modelo
              <input value={form.modelo} onChange={(e) => setField("modelo", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Terminación
              <input value={form.terminacion} onChange={(e) => setField("terminacion", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Cliente / Destino
              <input value={form.cliente_destino} onChange={(e) => setField("cliente_destino", e.target.value)} className={inputClass} />
            </label>
          </div>
        </AccordionSection>

        <AccordionSection
          icon="🔢"
          title="Cantidad, muestra y Ac/Re"
          help="Cant. OP = piezas de la OP a liberar. Muestra, Ac y Re según el Plan de Muestreo Vikingo (ver pestaña Guías)."
          subtitle={form.cantidad ? `Cant. ${form.cantidad} · Muestra ${form.muestra || sugerencia?.muestra || "—"}` : "Tamaño de la OP, muestra, Ac y Re"}
          open={openSection === "cantidad"}
          onToggle={() => toggle("cantidad")}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Cant. OP
              <input type="number" min="0" value={form.cantidad} onChange={(e) => setField("cantidad", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Muestra
              <input type="number" min="0" value={form.muestra} placeholder={sugerencia ? String(sugerencia.muestra) : ""} onChange={(e) => setField("muestra", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Ac
              <input type="number" min="0" value={form.ac} placeholder={sugerencia ? String(sugerencia.ac) : ""} onChange={(e) => setField("ac", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Re
              <input type="number" min="0" value={form.re} placeholder={sugerencia ? String(sugerencia.re) : ""} onChange={(e) => setField("re", e.target.value)} className={inputClass} />
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
          title="Puntos de inspección"
          help="Del formato F-GC-05: marcar cada punto como C = Cumple, NC = No Cumple, o NA = No aplica."
          subtitle={puntosMarcados > 0 ? `${puntosMarcados} de ${puntos.length} marcados · ${resultado}` : `${puntos.length} puntos (A-${puntos[puntos.length - 1]?.letra || "J"})`}
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
            <span className="font-bold text-[#0f1f3d]">Resultado: {resultado}.</span> Una NC Mayor o Crítica implica retención/contención y escalamiento. Los controles definidos al 100% permanecen al 100%.
          </p>
        </AccordionSection>

        <AccordionSection
          icon="📝"
          title="Desviación / reinspección / liberación"
          help="Del formato F-GC-05: si existe NC, registrar cuántas son menores y cuántas mayor/crítica, la descripción y acción/corrección, el resultado de la reinspección y la hora de liberación."
          subtitle={hayNC ? "Con no conformidad — completar desviación" : "Sin no conformidad detectada"}
          open={openSection === "resultado"}
          onToggle={() => toggle("resultado")}
        >
          <div className={`mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${resultado === "Conforme" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {resultado === "Conforme" ? "✅" : "⚠️"} Resultado: {resultado}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              NC menor
              <input type="number" min="0" value={form.nc_menor} onChange={(e) => setField("nc_menor", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              NC Mayor/Crítica
              <input type="number" min="0" value={form.nc_mayor_critico} onChange={(e) => setField("nc_mayor_critico", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-3 block`}>
            Descripción de NC / evidencia
            <textarea value={form.observacion} onChange={(e) => setField("observacion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </label>
          <label className={`${labelClass} mt-3 block`}>
            Acción / corrección realizada
            <textarea value={form.accion_reinspeccion} onChange={(e) => setField("accion_reinspeccion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Resultado de reinspección
              <input value={form.resultado_reinspeccion} onChange={(e) => setField("resultado_reinspeccion", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Hora de liberación
              <input type="time" value={form.hora_liberacion} onChange={(e) => setField("hora_liberacion", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-3 block`}>
            Evidencia fotográfica
            <span className="mt-1 block normal-case">
              <EvidenciaPicker fotos={fotos} onChange={setFotos} />
            </span>
          </label>
        </AccordionSection>

        <AccordionSection
          icon="🖊️"
          title="Cierre y firma"
          help="Del formato F-GC-05: dictamen general, observación y la firma de la Inspectora. Este formato no pide firma de Responsable de área ni Gerente de Calidad."
          subtitle={cierre.dictamen || "Dictamen, observación y firma"}
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

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Firma</p>
          <FirmaCard rol="Inspectora" firmado={cierre.firmado}>
            <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-slate-700">
              <input type="checkbox" checked={cierre.firmado} onChange={(e) => setCierre((c) => ({ ...c, firmado: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
              {cierre.firmado ? <span className="font-bold text-slate-700">{nombreInspectora}</span> : `Firmar como ${nombreInspectora}`}
            </label>
          </FirmaCard>
        </AccordionSection>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving || !puedeGuardar} className={`flex-1 sm:flex-none ${btnPrimaryClass}`}>
          {saving ? "Guardando…" : "Guardar inspección"}
        </button>
        <button type="button" onClick={onCancel} className={btnGhostClass}>Cancelar</button>
      </div>
      {!puedeGuardar && <p className="mt-2 text-[11px] text-[#94a3b8]">Falta el dictamen o la firma de la inspectora para poder guardar.</p>}
    </div>
  );
}

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
        <p className="truncate text-xs font-medium text-[#0f1f3d]">{insp.modelo || insp.producto_texto || "—"}</p>
        <p className="truncate text-[10px] text-[#5b6472]">OP {insp.op || "—"} · {insp.cliente_destino || "—"}</p>
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

function renderIdentificacionPT(insp) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CampoTexto label="OP" value={insp.op} />
      <CampoTexto label="Código" value={insp.producto_texto} />
      <CampoTexto label="Modelo" value={insp.modelo} />
      <CampoTexto label="Terminación" value={insp.terminacion} />
      <div className="col-span-2"><CampoTexto label="Cliente / Destino" value={insp.cliente_destino} /></div>
    </div>
  );
}

function renderCantidadMuestraPT(insp) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CampoTexto label="Cant. OP" value={insp.cantidad} />
      <CampoTexto label="Muestra" value={insp.muestra} />
      <CampoTexto label="Ac" value={insp.ac} />
      <CampoTexto label="Re" value={insp.re} />
    </div>
  );
}

export default function ProductoTerminadoPanel({ currentUser, canEdit = true }) {
  const [puntos, setPuntos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verId, setVerId] = useState(null);
  const [filtros, setFiltros] = useState(() => {
    const hoy = todayISO();
    return { ...FILTROS_VACIO, desde: inicioSemanaISO(hoy), hasta: finSemanaISO(hoy) };
  });
  const [showFiltros, setShowFiltros] = useState(false);
  const [showImprimir, setShowImprimir] = useState(false);
  const [printJob, setPrintJob] = useState(null);

  async function loadRegistros() {
    const result = await getInspeccionesUnica(PLANTA);
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
      const [puntosResult] = await Promise.all([getPuntosControl(PLANTA), loadRegistros()]);
      if (puntosResult.ok) setPuntos(puntosResult.data);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGuardar({ inspeccion, puntos: puntosPayload, cierre, fotos }) {
    const result = await crearInspeccionUnica({ planta: PLANTA, fecha: todayISO(), jornada: "07:00–17:00", inspeccion, puntos: puntosPayload, cierre }, currentUser);
    if (!result.ok) { window.alert("No fue posible guardar la inspección."); return; }
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
    if (!window.confirm("¿Eliminar esta inspección por completo? Se borran también sus puntos de control y fotos de evidencia. Esta acción no se puede deshacer.")) return;
    const result = await deleteRecorrido(id);
    if (!result.ok) { window.alert("No fue posible eliminar la inspección."); return; }
    if (verId === id) setVerId(null);
    loadRegistros();
  }

  if (loading) return <div className="py-10 text-center text-sm font-medium text-[#94a3b8]">Cargando…</div>;

  const registrosFiltrados = aplicarFiltrosRegistros(registros, filtros, camposBusquedaPT);
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
          <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Inspección y liberación de PT</h2>
          <HelpTip>Cada inspección es un registro completo por OP (identificación, puntos de control, desviación/reinspección/liberación y firma de la inspectora) — puede haber varias OPs liberadas el mismo día. Este formato no requiere firma de Supervisor de área ni Gerente de Calidad. Se identifica por fecha, hora e inspectora, no por un folio consecutivo.</HelpTip>
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
            📥 + Nueva inspección
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
                placeholder="OP, código, modelo, cliente/destino, inspectora…"
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
        <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>Aún no hay inspecciones registradas.</div>
      ) : registrosFiltrados.length === 0 ? (
        <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>
          Ninguna inspección coincide con los filtros.{" "}
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
          renderIdentificacion={renderIdentificacionPT}
          renderCantidadMuestra={renderCantidadMuestraPT}
          tituloEliminar="Eliminar inspección"
          mostrarFirmasArea={false}
        />
      )}

      {showImprimir && (
        <ImprimirModal
          registros={registros}
          area="Producto Terminado"
          nombreRegistroSingular="inspección"
          nombreRegistroPlural="inspecciones"
          renderResumenItem={(r, insp) => `${insp?.modelo || insp?.producto_texto || "—"} · OP ${insp?.op || "—"} · ${r.dictamen}`}
          onCancel={() => setShowImprimir(false)}
          onConfirmar={(job) => { setPrintJob(job); setShowImprimir(false); }}
        />
      )}

      {printJob && createPortal(
        <div className="gc-print-portal">
          <ReciboImprimible registros={printJob.registros} puntosCatalogo={puntos} tituloEncabezado={printJob.encabezado} incluirFotos={printJob.incluirFotos} formato={FORMATO_PT} />
        </div>,
        document.body
      )}
    </div>
  );
}
