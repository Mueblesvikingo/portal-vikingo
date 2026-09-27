import { useEffect, useState } from "react";
import {
  getPuntosControl,
  crearInspeccionMP,
  getInspeccionesMP,
  deleteRecorrido,
  sugerirMuestreo,
  subirEvidencia,
} from "../../services/calidadService";
import EvidenciaUploader from "./EvidenciaUploader";
import EvidenciaPicker from "./EvidenciaPicker";
import HelpTip from "./HelpTip";
import { cardClass, btnPrimaryClass, btnGhostClass, STATUS_STYLES } from "./coreliTheme";
import imprimirIcon from "../../assets/calidad-imprimir-icon.jpg";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}
const MES_LABEL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function agruparPorMes(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const [anio, mes] = r.fecha.split("-").map(Number);
    const key = `${anio}-${mes}`;
    if (!grupos.has(key)) grupos.set(key, { label: `${MES_LABEL[mes - 1]} ${anio}`, items: [] });
    grupos.get(key).items.push(r);
  }
  return Array.from(grupos.values());
}

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
function aplicarFiltros(registros, filtros) {
  const q = filtros.busqueda.trim().toLowerCase();
  return registros.filter((r) => {
    if (filtros.dictamen && r.dictamen !== filtros.dictamen) return false;
    if (filtros.desde && r.fecha < filtros.desde) return false;
    if (filtros.hasta && r.fecha > filtros.hasta) return false;
    if (q) {
      const insp = r.calidad_inspecciones?.[0];
      const campos = [insp?.proveedor, insp?.producto_texto, insp?.oc_lote, insp?.lote_identificacion, r.inspectora_nombre];
      if (!campos.some((c) => (c || "").toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

function PuntoControlChip({ letra, valor, onChange }) {
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
function AccordionSection({ icon, title, subtitle, help, open, onToggle, children }) {
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

const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";

// Etiqueta corta para la columna Dictamen de la tabla (el texto completo se
// ve igual en el modal de detalle, aquí solo hay que caber en la columna).
// La columna "hora" en Supabase es tipo `time` y regresa "HH:MM:SS" — en
// pantalla solo queremos "HH:MM".
function horaCorta(hora) {
  return (hora || "").slice(0, 5);
}

function dictamenCorto(d) {
  if (d === "Conforme con observación") return "Con obs.";
  if (d === "Producto No Conforme") return "No conforme";
  return d || "—";
}

function CampoTexto({ label, value }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-0.5 text-sm text-[#0f1f3d]">{value || "—"}</p>
    </div>
  );
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
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-[#f7f7f4] p-2.5 text-xs font-medium text-[#0f1f3d]">
            <input type="checkbox" checked={cierre.firmado} onChange={(e) => setCierre((c) => ({ ...c, firmado: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a227]" />
            Firmo esta inspección como {nombreInspectora} (Inspectora)
          </label>
          <label className={`${labelClass} mt-2 block`}>
            Supervisor de área
            <input value={cierre.responsable_area_nombre} onChange={(e) => setCierre((c) => ({ ...c, responsable_area_nombre: e.target.value }))} placeholder="Nombre de quien da el visto" className={inputClass} />
          </label>
          <label className={`${labelClass} mt-3 block`}>
            Gerente de Calidad
            <input value={cierre.gerente_calidad_nombre} onChange={(e) => setCierre((c) => ({ ...c, gerente_calidad_nombre: e.target.value }))} placeholder="Nombre de quien da el visto" className={inputClass} />
          </label>
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

// Fila compacta de la tabla — el detalle completo vive en DetalleInspeccionModal,
// abierto con el botón "Ver" (pedido explícito: tabla de pocas columnas en vez
// de la fila expandible anterior).
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
      <td className="gc-no-print px-2 py-2 text-right align-top">
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

// Detalle de una recepción ya guardada — reutiliza el mismo formato de
// secciones desplegables que NuevaInspeccionForm (pedido explícito: "que
// abra la inspección completa con el formato que tiene al crearla"), pero
// en modo lectura, más el botón de eliminar y la evidencia fotográfica.
function DetalleInspeccionModal({ registro, puntosCatalogo, currentUser, canEdit, onClose, onDelete, onEvidenciaChange }) {
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
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto label="OC / Lote" value={insp.oc_lote} />
                <CampoTexto label="Proveedor" value={insp.proveedor} />
                <div className="col-span-2"><CampoTexto label="MP inspeccionada" value={insp.producto_texto} /></div>
                <div className="col-span-2"><CampoTexto label="Lote / Identificación" value={insp.lote_identificacion} /></div>
              </div>
            </AccordionSection>

            <AccordionSection
              icon="🔢"
              title="Cantidad y muestra"
              subtitle={`Cant. ${insp.cantidad ?? "—"} · Muestra ${insp.muestra ?? "—"}`}
              open={openSection === "cantidad"}
              onToggle={() => toggle("cantidad")}
            >
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto label="Cantidad" value={insp.cantidad} />
                <CampoTexto label="Muestra" value={insp.muestra} />
              </div>
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
              <div className="space-y-2">
                <CampoTexto label="Inspectora" value={registro.firma_inspectora} />
                <CampoTexto label="Supervisor de área" value={registro.responsable_area_nombre} />
                <CampoTexto label="Gerente de Calidad" value={registro.gerente_calidad_nombre} />
              </div>
            </AccordionSection>
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 justify-end border-t border-[#edf0f4] p-3">
            <button type="button" onClick={() => onDelete(registro.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Eliminar recepción</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MateriaPrimaPanel({ currentUser, canEdit = true }) {
  const [puntos, setPuntos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verId, setVerId] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [showFiltros, setShowFiltros] = useState(false);

  async function loadRegistros() {
    const result = await getInspeccionesMP();
    if (result.ok) setRegistros(result.data);
  }

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

  const registrosFiltrados = aplicarFiltros(registros, filtros);
  const grupos = agruparPorMes(registrosFiltrados);
  const filtrosActivos = Object.values(filtros).filter(Boolean).length;
  const verRegistro = registros.find((r) => r.id === verId) || null;

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes gcGoldPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,162,39,0.35); } 50% { box-shadow: 0 0 0 7px rgba(201,162,39,0.10); } }
        .gc-gold-pulse { animation: gcGoldPulse 2.8s ease-in-out infinite; }
        @media print {
          .gc-no-print { display: none !important; }
        }
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

      <div className="gc-no-print flex items-center gap-2">
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="gc-gold-pulse flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#c9a227] bg-white px-2 py-2 text-xs font-semibold text-[#96771a] transition active:scale-[0.98] sm:text-sm"
          >
            📥 + Nueva recepción
          </button>
        )}
        {registros.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFiltros((v) => !v)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#edf0f4] bg-white px-2 py-2 text-xs font-semibold text-[#0f1f3d] transition active:scale-[0.98] sm:text-sm"
          >
            🔍 Filtros
            {filtrosActivos > 0 && <span className="rounded-full bg-[#c9a227] px-1.5 py-0.5 text-[10px] font-bold text-white">{filtrosActivos}</span>}
            <span className={`text-[#94a3b8] transition-transform ${showFiltros ? "rotate-180" : ""}`}>⌄</span>
          </button>
        )}
        {registros.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            title="Imprimir"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#edf0f4] bg-white transition active:scale-95"
          >
            <img src={imprimirIcon} alt="Imprimir" className="h-6 w-6 object-contain" />
          </button>
        )}
      </div>

      {showForm && (
        <div className="gc-no-print">
          <NuevaInspeccionForm puntos={puntos} currentUser={currentUser} onSave={handleGuardar} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {registros.length > 0 && showFiltros && (
        <div className={`${cardClass} gc-no-print p-3`}>
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
        <DetalleInspeccionModal
          registro={verRegistro}
          puntosCatalogo={puntos}
          currentUser={currentUser}
          canEdit={canEdit}
          onClose={() => setVerId(null)}
          onDelete={handleDelete}
          onEvidenciaChange={loadRegistros}
        />
      )}
    </div>
  );
}
