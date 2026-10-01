import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPuntosControlPorProceso,
  crearInspeccionUnica,
  getInspeccionesUnica,
  deleteRecorrido,
  sugerirMuestreo,
  subirEvidencia,
  getPersonasActivas,
  firmarComoResponsableArea,
  firmarComoGerenteCalidad,
  createCalidadRecordatorio,
  GERENTE_CALIDAD_PERSONA_ID,
  GERENTE_CALIDAD_NOMBRE,
} from "../../services/calidadService";
import EvidenciaPicker from "./EvidenciaPicker";
import HelpTip from "./HelpTip";
import { cardClass, btnPrimaryClass, btnGhostClass, STATUS_STYLES } from "./coreliTheme";
import imprimirIcon from "../../assets/calidad-imprimir-icon.jpg";
import {
  todayISO, nowHHMM, agruparPorSemana, horaCorta, dictamenCorto,
  inicioSemanaISO, finSemanaISO, aplicarFiltrosRegistros,
  PuntoControlChip, AccordionSection, CampoTexto, FirmaCard, inputClass, labelClass,
  PRINT_STYLE_BLOCK, ImprimirModal, ReciboImprimible, DetalleRegistroModal,
} from "./shared";

const PLANTA = "Planta 3";
const PROCESOS = ["Corte y pegado de hule espuma", "Tapicería", "Empaque"];

// Formato F-GC-04U tal como está en el Excel original — a diferencia de
// Materia Prima/Planta 1/2 (un solo juego de puntos de control), aquí cada
// proceso tiene su PROPIO juego: Corte y pegado de hule espuma = A-H (8),
// Tapicería y Empaque comparten el mismo juego A-I (9). También usa una
// paleta de colores propia (no la ámbar/teal del resto de los formatos).
const FORMATO_PLANTA3 = {
  tituloRecibo: "FORMATO UNIFICADO – PLANTA 3 | CORTE Y PEGADO DE HULE ESPUMA / TAPICERÍA / EMPAQUE",
  subtitulo: "FÁBRICA DE MUEBLES VIKINGO  ·  GESTIÓN DE CALIDAD  ·  PLANTA 3 ASPEL-PROD  ·  Código: F-GC-04U  ·  Versión: 00",
  instrucciones: "Una fila = una inspección realizada. En PROCESO seleccionar: Corte y pegado de hule espuma / Tapicería / Empaque. Una fila = una OP inspeccionada. Marcar puntos: C = Cumple, NC = No Cumple, NA = No aplica. Si existe NC, registrar clasificación, evidencia, acción y reinspección/liberación.",
  columnas: ["Hora", "Proceso", "OP", "Código", "Terminación", "Línea / Operador", "Cant.", "Muestra", "A", "B", "C", "D", "E", "F", "G", "H", "I", "Resultado", "Clasif.", "Observación / evidencia", "Acción / Reinspección"],
  colAnchos: [3, 8, 4, 6, 6, 7, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 4, 22, 12],
  letras: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
  renderCeldasAntes: (insp) => [
    { v: insp.proceso }, { v: insp.op }, { v: insp.producto_texto }, { v: insp.terminacion }, { v: insp.linea_operador },
    { v: insp.cantidad, center: true }, { v: insp.muestra, center: true },
  ],
  leyendaGrupos: [
    {
      titulo: "CORTE Y PEGADO DE HULE ESPUMA",
      color: "#FCE4D6",
      colorTexto: "#9C0006",
      pares: [
        ["A = Grado / densidad conforme a BOM", "B = Dimensiones del corte"],
        ["C = Escuadra / perfil del corte", "D = Superficie de corte"],
        ["E = Aplicación del adhesivo", "F = Tiempo abierto / momento de unión"],
        ["G = Calidad de la unión", "H = Identificación / liberación"],
      ],
    },
    {
      titulo: "TAPICERÍA / EMPAQUE",
      color: "#E2F0D9",
      colorTexto: "#375623",
      pares: [
        ["A = Apariencia general", "B = Centrado / alineación tela"],
        ["C = Tensión tapizado", "D = Costuras / uniones"],
        ["E = Arrugas / pliegues / deformación", "F = Grapado / fijaciones / acabados"],
        ["G = Simetría / dimensiones", "H = Funcionamiento"],
        ["I = Limpieza / identificación / empaque", ""],
      ],
    },
  ],
  criterio: "CRITERIO: La Matriz / plano / ficha técnica vigente establece la aceptación. Ante condición no contemplada: no asumir; documentar y escalar a Gestión de Calidad.",
  nombreRegistro: "Inspección",
  identificarFoto: (r, insp) => `${insp.proceso || "Proceso"} · OP ${insp.op || "—"}`,
  colorTitulo: "#333333",
  colorLeyendaTitulo: "#D9EAF7",
  colorLeyendaTexto: "#1F1F1F",
  colorCierreTitulo: "#333333",
};

const FORM_VACIO = {
  hora: nowHHMM(),
  proceso: "",
  op: "",
  producto_texto: "",
  terminacion: "",
  linea_operador: "",
  cantidad: "",
  muestra: "",
  observacion: "",
  accion_reinspeccion: "",
};
const CIERRE_VACIO = { dictamen: "", responsable_area_persona_id: "", firmado: false };

const FILTROS_VACIO = { busqueda: "", dictamen: "", desde: "", hasta: "" };
function camposBusquedaPlanta3(r, insp) {
  return [insp?.proceso, insp?.op, insp?.producto_texto, insp?.terminacion, insp?.linea_operador, r.inspectora_nombre];
}

// A diferencia de Planta 1/2, aquí `todosPuntos` trae los 3 juegos de puntos
// de control (uno por proceso) — hay que elegir el Proceso primero para
// saber cuál juego usar. `puntosDelProceso` se recalcula cada vez que
// cambia form.proceso.
function NuevaInspeccionForm({ todosPuntos, personas, currentUser, onSave, onCancel }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [valoresPuntos, setValoresPuntos] = useState({});
  const [cierre, setCierre] = useState(CIERRE_VACIO);
  const [fotos, setFotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [clasificacion, setClasificacion] = useState("");
  const [openSection, setOpenSection] = useState("identificacion");
  const sugerencia = sugerirMuestreo(form.cantidad);
  const nombreInspectora = currentUser?.nombre || currentUser?.usuario || "Inspectora";
  const puntosDelProceso = todosPuntos.filter((p) => p.proceso === form.proceso);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function toggle(section) {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  const puntosMarcados = Object.keys(valoresPuntos).filter((k) => valoresPuntos[k]).length;
  const hayNC = Object.values(valoresPuntos).includes("NC");
  const resultado = hayNC ? "No Conforme" : "Conforme";
  const puedeGuardar = cierre.dictamen && cierre.firmado && cierre.responsable_area_persona_id && form.proceso;

  async function handleSave() {
    setSaving(true);
    const puntosPayload = puntosDelProceso.map((p) => ({ punto_control_id: p.id, valor: valoresPuntos[p.id] || null }));
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
      <p className="mb-3 px-1 text-sm font-bold text-[#0f1f3d]">✍️ Nueva inspección</p>

      <div className="space-y-2">
        <AccordionSection
          icon="📋"
          title="Identificación"
          help="Del formato F-GC-04U: seleccionar el Proceso (Corte y pegado de hule espuma / Tapicería / Empaque) y registrar OP, código, terminación y línea/operador. El proceso elegido determina qué puntos de control aplican."
          subtitle={form.op ? `OP ${form.op} · ${form.proceso || "—"}` : "Hora, proceso, OP, código, terminación, línea/operador…"}
          open={openSection === "identificacion"}
          onToggle={() => toggle("identificacion")}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Hora
              <input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Proceso
              <select value={form.proceso} onChange={(e) => setField("proceso", e.target.value)} className={inputClass}>
                <option value="">Seleccionar…</option>
                {PROCESOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              OP
              <input value={form.op} onChange={(e) => setField("op", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Código
              <input value={form.producto_texto} onChange={(e) => setField("producto_texto", e.target.value)} className={inputClass} />
            </label>
            <label className={`${labelClass} col-span-2`}>
              Terminación
              <input value={form.terminacion} onChange={(e) => setField("terminacion", e.target.value)} className={inputClass} />
            </label>
            <label className={`${labelClass} col-span-2`}>
              Línea / Operador
              <input value={form.linea_operador} onChange={(e) => setField("linea_operador", e.target.value)} className={inputClass} />
            </label>
          </div>
        </AccordionSection>

        <AccordionSection
          icon="🔢"
          title="Cantidad y muestra"
          help="Cant. = cantidad de piezas de la OP inspeccionada. Muestra = cuántas piezas revisar, según el Plan de Muestreo Ac/Re (ver pestaña Guías si quieres consultar la tabla completa)."
          subtitle={form.cantidad ? `Cant. ${form.cantidad} · Muestra ${form.muestra || sugerencia?.muestra || "—"}` : "Tamaño de la OP y tamaño de muestra"}
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
          help="Del formato F-GC-04U: cada proceso tiene su propio juego de puntos (Corte y pegado de hule espuma = A-H; Tapicería/Empaque = A-I). Marcar cada punto como C = Cumple, NC = No Cumple, o NA = No aplica."
          subtitle={!form.proceso ? "Selecciona un proceso primero" : puntosMarcados > 0 ? `${puntosMarcados} de ${puntosDelProceso.length} marcados · ${resultado}` : `${puntosDelProceso.length} puntos de ${form.proceso}`}
          open={openSection === "puntos"}
          onToggle={() => toggle("puntos")}
        >
          {!form.proceso ? (
            <p className="rounded-lg bg-[#f7f7f4] px-2.5 py-2 text-xs text-[#5b6472]">Selecciona el Proceso en "Identificación" para ver sus puntos de control.</p>
          ) : (
            <>
              <div className="space-y-2">
                {puntosDelProceso.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 border-b border-[#edf0f4] pb-2 last:border-0 last:pb-0">
                    <p className="min-w-0 flex-1 text-xs text-[#5b6472]"><span className="font-bold text-[#0f1f3d]">{p.letra}.</span> {p.descripcion}</p>
                    <PuntoControlChip valor={valoresPuntos[p.id]} onChange={(v) => setValoresPuntos((cur) => ({ ...cur, [p.id]: v }))} />
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-[#f7f7f4] px-2.5 py-1.5 text-[11px] text-[#5b6472]">
                <span className="font-bold text-[#0f1f3d]">Resultado: {resultado}.</span> La Matriz/plano/ficha técnica vigente establece la aceptación. Ante condición no contemplada: no asumir, documentar y escalar a Gestión de Calidad.
              </p>
            </>
          )}
        </AccordionSection>

        <AccordionSection
          icon="📝"
          title="Resultado y observaciones"
          help="Del formato F-GC-04U: si existe una NC (No Cumple), registrar su clasificación, evidencia, acción y reinspección/liberación."
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
          help="Del formato F-GC-04U (Cierre / dictamen): Conforme, Conforme con observación, o Producto No Conforme, más observación general/pendientes y las firmas de quien inspeccionó, el responsable de área y la fecha/hora de cierre."
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

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Firmas</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <FirmaCard rol="Inspectora" firmado={cierre.firmado}>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-slate-700">
                <input type="checkbox" checked={cierre.firmado} onChange={(e) => setCierre((c) => ({ ...c, firmado: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
                {cierre.firmado ? <span className="font-bold text-slate-700">{nombreInspectora}</span> : `Firmar como ${nombreInspectora}`}
              </label>
            </FirmaCard>
            <FirmaCard rol="Supervisor de área" firmado={false}>
              <select
                value={cierre.responsable_area_persona_id}
                onChange={(e) => setCierre((c) => ({ ...c, responsable_area_persona_id: e.target.value ? Number(e.target.value) : "" }))}
                className="w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none"
              >
                <option value="">Asignar a…</option>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <p className="mt-1 text-[10px] font-medium text-slate-400">Firmará al revisar el registro.</p>
            </FirmaCard>
            <FirmaCard rol="Gerente de Calidad" firmado={false}>
              <p className="text-[11px] font-bold text-slate-700">{GERENTE_CALIDAD_NOMBRE}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">Firmará al revisar el registro.</p>
            </FirmaCard>
          </div>
        </AccordionSection>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving || !puedeGuardar} className={`flex-1 sm:flex-none ${btnPrimaryClass}`}>
          {saving ? "Guardando…" : "Guardar inspección"}
        </button>
        <button type="button" onClick={onCancel} className={btnGhostClass}>Cancelar</button>
      </div>
      {!puedeGuardar && <p className="mt-2 text-[11px] text-[#94a3b8]">Falta el proceso, el dictamen, la firma de la inspectora, o asignar el supervisor de área.</p>}
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
        <p className="truncate text-xs font-medium text-[#0f1f3d]">{insp.proceso || "—"}</p>
        <p className="truncate text-[10px] text-[#5b6472]">OP {insp.op || "—"} · {insp.producto_texto || "—"}</p>
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

function renderIdentificacionPlanta3(insp) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CampoTexto label="Proceso" value={insp.proceso} />
      <CampoTexto label="OP" value={insp.op} />
      <CampoTexto label="Código" value={insp.producto_texto} />
      <CampoTexto label="Terminación" value={insp.terminacion} />
      <div className="col-span-2"><CampoTexto label="Línea / Operador" value={insp.linea_operador} /></div>
    </div>
  );
}

export default function Planta3Panel({ currentUser, canEdit = true, initialVerId = null, returnToAccionId = null, onVolverAAccion }) {
  const [todosPuntos, setTodosPuntos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verId, setVerId] = useState(null);

  // Llegada desde "Ver informe" en Acciones de Mejora (ver QualityModule.jsx,
  // que ya resolvió que este recorrido pertenece a esta planta) — abre el
  // detalle directo, sin que el usuario tenga que buscarlo en la tabla.
  useEffect(() => {
    if (initialVerId) setVerId(initialVerId);
  }, [initialVerId]);
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
      const [puntosResult, personasResult] = await Promise.all([getPuntosControlPorProceso(PLANTA), getPersonasActivas(), loadRegistros()]);
      if (puntosResult.ok) setTodosPuntos(puntosResult.data);
      if (personasResult.ok) setPersonas(personasResult.data);
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
    await loadRegistros();
    // Antes había que ir a Historial y abrir "Ver" para encontrar el botón
    // "Generar Acción de Mejora" de una NC recién capturada — ahora, si la
    // inspección salió No Conforme, su propio detalle se abre solo al
    // guardar (ese botón ya vive en DetalleRegistroModal).
    if (inspeccion.resultado === "No Conforme") setVerId(result.data.id);
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta inspección por completo? Se borran también sus puntos de control y fotos de evidencia. Esta acción no se puede deshacer.")) return;
    const result = await deleteRecorrido(id);
    if (!result.ok) { window.alert("No fue posible eliminar la inspección."); return; }
    if (verId === id) setVerId(null);
    loadRegistros();
  }

  async function handleFirmarResponsable(registro) {
    const result = await firmarComoResponsableArea(registro.id, currentUser);
    if (!result.ok) { window.alert(typeof result.error === "string" ? result.error : "No fue posible firmar."); return; }
    loadRegistros();
  }

  async function handleFirmarGerente(registro) {
    const result = await firmarComoGerenteCalidad(registro.id, currentUser);
    if (!result.ok) { window.alert(typeof result.error === "string" ? result.error : "No fue posible firmar."); return; }
    loadRegistros();
  }

  async function handleEnviarRecordatorio(destinatarioPersonaId, registro) {
    const insp = registro.calidad_inspecciones?.[0];
    const mensaje = `Tienes una firma pendiente en Gestión de Calidad · Planta 3 — inspección del ${registro.fecha}${insp?.op ? " · OP " + insp.op : ""}.`;
    await createCalidadRecordatorio({ recorridoId: registro.id, destinatarioPersonaId, mensaje }, currentUser);
  }

  if (loading) return <div className="py-10 text-center text-sm font-medium text-[#94a3b8]">Cargando…</div>;

  const registrosFiltrados = aplicarFiltrosRegistros(registros, filtros, camposBusquedaPlanta3);
  const grupos = agruparPorSemana(registrosFiltrados);
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
          <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Inspecciones de Planta 3</h2>
          <HelpTip>Cada inspección es un registro completo (identificación, puntos de control y su propio cierre/dictamen con firmas) — puede haber varias OPs inspeccionadas el mismo día. El proceso elegido (Corte y pegado de hule espuma / Tapicería / Empaque) determina qué puntos de control aplican. Se identifica por fecha, hora e inspectora, no por un folio consecutivo.</HelpTip>
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
        <NuevaInspeccionForm todosPuntos={todosPuntos} personas={personas} currentUser={currentUser} onSave={handleGuardar} onCancel={() => setShowForm(false)} />
      )}

      {registros.length > 0 && showFiltros && (
        <div className={`${cardClass} p-3`}>
          <div className="space-y-2.5">
            <label className={`${labelClass} block`}>
              Buscar
              <input
                value={filtros.busqueda}
                onChange={(e) => setFiltros((f) => ({ ...f, busqueda: e.target.value }))}
                placeholder="Proceso, OP, código, línea/operador, inspectora…"
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
          puntosCatalogo={todosPuntos}
          currentUser={currentUser}
          canEdit={canEdit}
          onClose={() => setVerId(null)}
          onDelete={handleDelete}
          onEvidenciaChange={loadRegistros}
          renderIdentificacion={renderIdentificacionPlanta3}
          tituloEliminar="Eliminar inspección"
          gerenteCalidadPersonaId={GERENTE_CALIDAD_PERSONA_ID}
          onFirmarResponsable={handleFirmarResponsable}
          onFirmarGerente={handleFirmarGerente}
          onEnviarRecordatorio={handleEnviarRecordatorio}
          onVolverAAccion={verId === initialVerId && returnToAccionId ? onVolverAAccion : undefined}
        />
      )}

      {showImprimir && (
        <ImprimirModal
          registros={registros}
          area="Planta 3"
          nombreRegistroSingular="inspección"
          nombreRegistroPlural="inspecciones"
          renderResumenItem={(r, insp) => `${insp?.proceso || "—"} · OP ${insp?.op || "—"} · ${r.dictamen}`}
          onCancel={() => setShowImprimir(false)}
          onConfirmar={(job) => { setPrintJob(job); setShowImprimir(false); }}
        />
      )}

      {printJob && createPortal(
        <div className="gc-print-portal">
          <ReciboImprimible registros={printJob.registros} puntosCatalogo={todosPuntos} tituloEncabezado={printJob.encabezado} incluirFotos={printJob.incluirFotos} formato={FORMATO_PLANTA3} />
        </div>,
        document.body
      )}
    </div>
  );
}
