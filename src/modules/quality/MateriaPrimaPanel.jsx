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
import { cardClass, btnPrimaryClass, btnGhostClass, statusBadgeClass } from "./coreliTheme";

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
function AccordionSection({ icon, title, subtitle, open, onToggle, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#edf0f4]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 bg-[#f7f7f4] px-3 py-2.5 text-left transition active:bg-[#edf0f4]">
        <span className="text-base">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#0f1f3d]">{title}</span>
          {subtitle && <span className="block text-xs text-[#5b6472]">{subtitle}</span>}
        </span>
        <span className={`shrink-0 text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";

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

function RegistroRow({ registro, currentUser, onDelete, onEvidenciaChange, canEdit, expanded, onToggle }) {
  const insp = registro.calidad_inspecciones?.[0];
  if (!insp) return null;
  const esConforme = insp.resultado !== "No Conforme";
  const puntosOrdenados = [...(insp.calidad_inspeccion_puntos || [])];

  return (
    <div className="p-3.5">
      <div role="button" tabIndex={0} onClick={onToggle} className="flex cursor-pointer items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${esConforme ? "bg-green-50" : "bg-red-50"}`}>
          {esConforme ? "✅" : "⚠️"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0f1f3d]">{registro.fecha} · {insp.hora}</p>
          <p className="text-xs text-[#5b6472]">Inspectora: {registro.inspectora_nombre || "—"} · {insp.producto_texto || "MP sin especificar"}</p>
        </div>
        <span className={`shrink-0 ${statusBadgeClass(registro.dictamen)}`}>{registro.dictamen}</span>
        <span className={`shrink-0 text-[#94a3b8] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 rounded-xl bg-[#f7f7f4] p-3 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">OC / Lote</p><p className="text-[#0f1f3d]">{insp.oc_lote || "—"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Proveedor</p><p className="text-[#0f1f3d]">{insp.proveedor || "—"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Lote / Identificación</p><p className="text-[#0f1f3d]">{insp.lote_identificacion || "—"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Cant. / Muestra</p><p className="text-[#0f1f3d]">{insp.cantidad ?? "—"} / {insp.muestra ?? "—"}</p></div>
          </div>

          {puntosOrdenados.length > 0 && (
            <div className="border-t border-[#edf0f4] pt-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Puntos de control</p>
              <div className="flex flex-wrap gap-1">
                {puntosOrdenados.map((pp) => (
                  <span key={pp.id} className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${pp.valor === "NC" ? "border-red-200 bg-red-50 text-red-600" : pp.valor === "C" ? "border-green-200 bg-green-50 text-green-700" : "border-[#edf0f4] bg-white text-[#5b6472]"}`}>
                    {pp.valor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(insp.observacion || insp.accion_reinspeccion) && (
            <div className="border-t border-[#edf0f4] pt-2">
              {insp.observacion && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Observación</p><p className="text-[#0f1f3d]">{insp.observacion}</p></div>}
              {insp.accion_reinspeccion && <div className="mt-1.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Acción / Reinspección</p><p className="text-[#0f1f3d]">{insp.accion_reinspeccion}</p></div>}
            </div>
          )}

          <div className="border-t border-[#edf0f4] pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Cierre y firmas</p>
            {registro.observacion_general && <p className="mb-1 text-[#0f1f3d]">{registro.observacion_general}</p>}
            <p className="text-[#5b6472]">Inspectora: {registro.firma_inspectora || "—"}</p>
            <p className="text-[#5b6472]">Supervisor de área: {registro.responsable_area_nombre || "—"}</p>
            <p className="text-[#5b6472]">Gerente de Calidad: {registro.gerente_calidad_nombre || "—"}</p>
          </div>

          <div className="border-t border-[#edf0f4] pt-2">
            <EvidenciaUploader
              inspeccionId={insp.id}
              evidencias={insp.calidad_evidencias || []}
              currentUser={currentUser}
              onChange={onEvidenciaChange}
              canEdit={canEdit}
            />
          </div>
          {canEdit && (
            <div className="flex justify-end border-t border-[#edf0f4] pt-2">
              <button type="button" onClick={() => onDelete(registro.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Eliminar recepción</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MateriaPrimaPanel({ currentUser, canEdit = true }) {
  const [puntos, setPuntos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

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
    if (expandedId === id) setExpandedId(null);
    loadRegistros();
  }

  if (loading) return <div className="py-10 text-center text-sm font-medium text-[#94a3b8]">Cargando…</div>;

  const grupos = agruparPorMes(registros);

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes gcGoldPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,162,39,0.35); } 50% { box-shadow: 0 0 0 7px rgba(201,162,39,0.10); } }
        .gc-gold-pulse { animation: gcGoldPulse 2.8s ease-in-out infinite; }
      `}</style>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Recepciones de materia prima</h2>
            <HelpTip>Cada recepción es un registro completo (identificación, puntos de control y su propio cierre/dictamen con firmas) — puede haber varias el mismo día, una por cada entrega que llegue. Se identifica por fecha, hora e inspectora, no por un folio consecutivo.</HelpTip>
          </div>
          <p className="text-sm text-[#5b6472]">Recepción de Materia Prima · F-GC-01U</p>
        </div>
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="gc-gold-pulse inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#c9a227] bg-white px-4 py-2.5 text-sm font-semibold text-[#96771a] transition active:scale-[0.98] sm:flex-none"
          >
            📥 + Nueva recepción
          </button>
        )}
      </div>

      {showForm && (
        <NuevaInspeccionForm puntos={puntos} currentUser={currentUser} onSave={handleGuardar} onCancel={() => setShowForm(false)} />
      )}

      {registros.length === 0 ? (
        <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>Aún no hay recepciones registradas.</div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => (
            <div key={grupo.label} className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-2 bg-[#f7f7f4] px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6472]">{grupo.label}</p>
                <span className="shrink-0 text-[11px] font-semibold text-[#94a3b8]">{grupo.items.length}</span>
              </div>
              <div className="divide-y divide-[#edf0f4]">
                {grupo.items.map((r) => (
                  <RegistroRow
                    key={r.id}
                    registro={r}
                    currentUser={currentUser}
                    onDelete={handleDelete}
                    onEvidenciaChange={loadRegistros}
                    canEdit={canEdit}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
