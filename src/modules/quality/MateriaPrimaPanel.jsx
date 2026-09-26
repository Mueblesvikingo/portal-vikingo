import { useEffect, useState } from "react";
import {
  getPuntosControl,
  getRecorridos,
  createRecorrido,
  cerrarRecorrido,
  getInspecciones,
  createInspeccion,
  deleteInspeccion,
  deleteRecorrido,
  sugerirMuestreo,
} from "../../services/calidadService";
import EvidenciaUploader from "./EvidenciaUploader";
import HelpTip from "./HelpTip";
import { cardClass, btnPrimaryClass, btnSecondaryClass, btnGhostClass, statusBadgeClass } from "./coreliTheme";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}
const MES_LABEL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function agruparPorMes(recorridos) {
  const grupos = new Map();
  for (const r of recorridos) {
    const [anio, mes] = r.fecha.split("-").map(Number);
    const key = `${anio}-${mes}`;
    if (!grupos.has(key)) grupos.set(key, { label: `${MES_LABEL[mes - 1]} ${anio}`, items: [] });
    grupos.get(key).items.push(r);
  }
  return Array.from(grupos.values());
}

const INSPECCION_VACIA = {
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

function PuntoControlChip({ letra, valor, onChange }) {
  const opciones = [
    { key: "C", label: "C", active: "border-green-500 bg-green-500 text-white", idle: "border-green-200 text-green-700 bg-white" },
    { key: "NC", label: "NC", active: "border-red-500 bg-red-500 text-white", idle: "border-red-200 text-red-600 bg-white" },
    { key: "NA", label: "NA", active: "border-slate-400 bg-slate-400 text-white", idle: "border-[#edf0f4] text-[#5b6472] bg-white" },
  ];
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 text-[11px] font-bold text-[#94a3b8]">{letra}</span>
      {opciones.map((o) => {
        const active = valor === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(active ? null : o.key)}
            className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold transition active:scale-95 ${active ? o.active : o.idle}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Sección desplegable — para ir llenando la inspección por partes en vez de
// un formulario largo de un jalón (pedido explícito, pensado para celular).
// Solo una sección abierta a la vez, misma regla que ya se usa para el
// detalle de inspecciones en la lista.
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

function NuevaInspeccionForm({ puntos, onSave, onCancel }) {
  const [form, setForm] = useState(INSPECCION_VACIA);
  const [valoresPuntos, setValoresPuntos] = useState({});
  const [saving, setSaving] = useState(false);
  const [clasificacion, setClasificacion] = useState("");
  const [openSection, setOpenSection] = useState("identificacion");
  const sugerencia = sugerirMuestreo(form.cantidad);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function toggle(section) {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  const puntosMarcados = Object.keys(valoresPuntos).filter((k) => valoresPuntos[k]).length;
  const hayNC = Object.values(valoresPuntos).includes("NC");
  const resultado = hayNC ? "No Conforme" : "Conforme";

  async function handleSave() {
    setSaving(true);
    const puntosPayload = puntos.map((p) => ({ punto_control_id: p.id, valor: valoresPuntos[p.id] || null }));
    await onSave(
      { ...form, cantidad: form.cantidad || null, muestra: form.muestra || sugerencia?.muestra || null, resultado, clasificacion: hayNC ? clasificacion || "Menor" : null },
      puntosPayload
    );
    setSaving(false);
  }

  return (
    <div className={`${cardClass} p-3`}>
      <p className="mb-3 px-1 text-sm font-bold text-[#0f1f3d]">✍️ Nueva inspección</p>

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
                <PuntoControlChip letra="" valor={valoresPuntos[p.id]} onChange={(v) => setValoresPuntos((cur) => ({ ...cur, [p.id]: v }))} />
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
          subtitle={form.observacion || form.accion_reinspeccion ? "Con observación / acción capturada" : "Clasificación, observación, acción/reinspección"}
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
          <p className="mt-2 text-[11px] text-[#94a3b8]">La foto de evidencia se agrega después de guardar, desde la lista de inspecciones.</p>
        </AccordionSection>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className={`flex-1 sm:flex-none ${btnPrimaryClass}`}>
          {saving ? "Guardando…" : "Guardar inspección"}
        </button>
        <button type="button" onClick={onCancel} className={btnGhostClass}>Cancelar</button>
      </div>
    </div>
  );
}

function InspeccionRow({ inspeccion, currentUser, onDelete, onEvidenciaChange, canEdit, expanded, onToggle }) {
  const esConforme = inspeccion.resultado !== "No Conforme";

  return (
    <div className="p-3.5">
      <div role="button" tabIndex={0} onClick={onToggle} className="flex cursor-pointer items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${esConforme ? "bg-green-50" : "bg-red-50"}`}>
          {esConforme ? "✅" : "⚠️"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0f1f3d]">{inspeccion.producto_texto || "Sin especificar"}</p>
          <p className="text-xs text-[#5b6472]">{inspeccion.hora} · {inspeccion.proveedor || "—"} · Lote {inspeccion.lote_identificacion || "—"}</p>
        </div>
        <span className={`shrink-0 ${statusBadgeClass(inspeccion.clasificacion || inspeccion.resultado)}`}>{inspeccion.clasificacion || inspeccion.resultado}</span>
        <span className={`shrink-0 text-[#94a3b8] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 rounded-xl bg-[#f7f7f4] p-3 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">OC / Lote</p><p className="text-[#0f1f3d]">{inspeccion.oc_lote || "—"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Cant. / Muestra</p><p className="text-[#0f1f3d]">{inspeccion.cantidad ?? "—"} / {inspeccion.muestra ?? "—"}</p></div>
          </div>
          {inspeccion.observacion && (
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Observación</p><p className="text-[#0f1f3d]">{inspeccion.observacion}</p></div>
          )}
          {inspeccion.accion_reinspeccion && (
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Acción / Reinspección</p><p className="text-[#0f1f3d]">{inspeccion.accion_reinspeccion}</p></div>
          )}
          <div className="border-t border-[#edf0f4] pt-2">
            <EvidenciaUploader
              inspeccionId={inspeccion.id}
              evidencias={inspeccion.calidad_evidencias || []}
              currentUser={currentUser}
              onChange={onEvidenciaChange}
              canEdit={canEdit}
            />
          </div>
          {canEdit && (
            <div className="flex justify-end border-t border-[#edf0f4] pt-2">
              <button type="button" onClick={() => onDelete(inspeccion.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Eliminar inspección</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MateriaPrimaPanel({ currentUser, canEdit = true }) {
  const [puntos, setPuntos] = useState([]);
  const [recorridos, setRecorridos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [inspecciones, setInspecciones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedInspeccionId, setExpandedInspeccionId] = useState(null);
  const [cierreForm, setCierreForm] = useState({ dictamen: "", observacion_general: "", responsable_area_nombre: "", firmado: false });

  async function loadRecorridos() {
    const result = await getRecorridos("Materia Prima");
    if (result.ok) setRecorridos(result.data);
  }

  async function loadInspecciones(recorridoId) {
    const result = await getInspecciones(recorridoId);
    if (result.ok) setInspecciones(result.data);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [puntosResult] = await Promise.all([getPuntosControl("Materia Prima"), loadRecorridos()]);
      if (puntosResult.ok) setPuntos(puntosResult.data);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setExpandedInspeccionId(null);
    if (selectedId) loadInspecciones(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleNuevoRecorrido() {
    const result = await createRecorrido("Materia Prima", { fecha: todayISO() }, currentUser);
    if (result.ok) {
      await loadRecorridos();
      setSelectedId(result.data.id);
    }
  }

  async function handleGuardarInspeccion(payload, puntosPayload) {
    await createInspeccion(selectedId, payload, puntosPayload, currentUser);
    setShowForm(false);
    loadInspecciones(selectedId);
  }

  async function handleDeleteInspeccion(id) {
    if (!window.confirm("¿Eliminar esta inspección?")) return;
    await deleteInspeccion(id);
    loadInspecciones(selectedId);
  }

  async function handleDeleteRecorrido(id, event) {
    event?.stopPropagation();
    if (!window.confirm("¿Eliminar esta recepción por completo? Se borran también sus inspecciones y fotos de evidencia. Esta acción no se puede deshacer.")) return;
    const result = await deleteRecorrido(id);
    if (!result.ok) { window.alert("No fue posible eliminar la recepción."); return; }
    if (selectedId === id) setSelectedId(null);
    loadRecorridos();
  }

  async function handleCerrar() {
    if (!cierreForm.dictamen || !cierreForm.firmado) return;
    await cerrarRecorrido(selectedId, cierreForm, currentUser);
    await loadRecorridos();
    setCierreForm({ dictamen: "", observacion_general: "", responsable_area_nombre: "", firmado: false });
  }

  const recorridoActivo = recorridos.find((r) => r.id === selectedId);
  const inputClass = "rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227]";

  if (loading) return <div className="py-10 text-center text-sm font-medium text-[#94a3b8]">Cargando…</div>;

  if (!selectedId) {
    const grupos = agruparPorMes(recorridos);
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
              <HelpTip>Una recepción agrupa todas las inspecciones de materia prima hechas en una jornada (a diferencia de las plantas de producción, aquí no es un recorrido físico sino la revisión de lo que llega). Se cierra con un dictamen (Conforme / Con observación / No conforme) y la firma de la inspectora.</HelpTip>
            </div>
            <p className="text-sm text-[#5b6472]">Recepción de Materia Prima · F-GC-01U</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleNuevoRecorrido}
              className="gc-gold-pulse inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#c9a227] bg-white px-4 py-2.5 text-sm font-semibold text-[#96771a] transition active:scale-[0.98] sm:flex-none"
            >
              📥 + Nueva recepción
            </button>
          )}
        </div>

        {recorridos.length === 0 ? (
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
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(r.id)}
                      className="flex w-full cursor-pointer items-start gap-3 p-4 text-left transition active:bg-[#f7f7f4]/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0f1f3d]">{r.folio}</p>
                        <p className="text-xs text-[#5b6472]">{r.fecha} · {r.inspectora_nombre || "—"} · {r.jornada}</p>
                      </div>
                      <span className={`shrink-0 ${statusBadgeClass(r.dictamen || "Abierto")}`}>{r.dictamen || "Abierto"}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecorrido(r.id, e)}
                          className="shrink-0 rounded-lg p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label="Eliminar recepción"
                        >
                          🗑️
                        </button>
                      )}
                      <span className="shrink-0 text-[#94a3b8]">›</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setSelectedId(null)} className={`${btnGhostClass} -ml-3`}>← Recepciones</button>
        {canEdit && (
          <button type="button" onClick={() => handleDeleteRecorrido(selectedId)} className="text-xs font-medium text-red-500 hover:text-red-600">
            🗑️ Eliminar recepción
          </button>
        )}
      </div>

      <div className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-[#0f1f3d]">{recorridoActivo?.folio}</p>
            <p className="text-xs text-[#5b6472]">{recorridoActivo?.fecha} · Inspectora: {recorridoActivo?.inspectora_nombre || "—"} · {recorridoActivo?.jornada} · Área: {recorridoActivo?.planta}</p>
          </div>
          {recorridoActivo?.dictamen && <span className={statusBadgeClass(recorridoActivo.dictamen)}>{recorridoActivo.dictamen}</span>}
        </div>
      </div>

      {inspecciones.length > 0 && (
        <div className={`${cardClass} divide-y divide-[#edf0f4] overflow-hidden`}>
          {inspecciones.map((insp) => (
            <InspeccionRow
              key={insp.id}
              inspeccion={insp}
              currentUser={currentUser}
              onDelete={handleDeleteInspeccion}
              onEvidenciaChange={() => loadInspecciones(selectedId)}
              canEdit={canEdit && !recorridoActivo?.cerrado_at}
              expanded={expandedInspeccionId === insp.id}
              onToggle={() => setExpandedInspeccionId((cur) => (cur === insp.id ? null : insp.id))}
            />
          ))}
        </div>
      )}

      {canEdit && !recorridoActivo?.cerrado_at && (
        showForm ? (
          <NuevaInspeccionForm puntos={puntos} onSave={handleGuardarInspeccion} onCancel={() => setShowForm(false)} />
        ) : (
          <button type="button" onClick={() => setShowForm(true)} className={`w-full ${btnSecondaryClass} border-dashed`}>
            + Agregar inspección
          </button>
        )
      )}

      {canEdit && !recorridoActivo?.cerrado_at && (
        <div className={`${cardClass} p-4`}>
          <p className="mb-3 text-sm font-bold text-[#0f1f3d]">Cierre / dictamen de la recepción</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Dictamen
              <select value={cierreForm.dictamen} onChange={(e) => setCierreForm((f) => ({ ...f, dictamen: e.target.value }))} className={inputClass}>
                <option value="">Seleccionar…</option>
                <option value="Conforme">Conforme</option>
                <option value="Conforme con observación">Conforme con observación</option>
                <option value="Producto No Conforme">Producto No Conforme</option>
              </select>
            </label>
            <label className={labelClass}>
              Responsable de área
              <input value={cierreForm.responsable_area_nombre} onChange={(e) => setCierreForm((f) => ({ ...f, responsable_area_nombre: e.target.value }))} className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-3 block`}>
            Observación general / pendientes
            <textarea value={cierreForm.observacion_general} onChange={(e) => setCierreForm((f) => ({ ...f, observacion_general: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-[#f7f7f4] p-2.5 text-xs font-medium text-[#0f1f3d]">
            <input type="checkbox" checked={cierreForm.firmado} onChange={(e) => setCierreForm((f) => ({ ...f, firmado: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a227]" />
            Firmo esta inspección como {currentUser?.nombre || currentUser?.usuario || "Inspectora"}
          </label>
          <button type="button" onClick={handleCerrar} disabled={!cierreForm.dictamen || !cierreForm.firmado} className={`mt-3 w-full sm:w-auto ${btnPrimaryClass}`}>Cerrar recepción</button>
        </div>
      )}

      {recorridoActivo?.cerrado_at && (
        <div className={`${cardClass} p-4 text-sm text-[#5b6472]`}>
          Cerrado el {new Date(recorridoActivo.cerrado_at).toLocaleString("es-MX")} · Firma: {recorridoActivo.firma_inspectora || "—"} · Responsable de área: {recorridoActivo.responsable_area_nombre || "—"}
          {recorridoActivo.observacion_general && <p className="mt-1">{recorridoActivo.observacion_general}</p>}
        </div>
      )}
    </div>
  );
}
