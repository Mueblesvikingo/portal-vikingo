import { useEffect, useState } from "react";
import {
  getPuntosControl,
  getRecorridos,
  createRecorrido,
  cerrarRecorrido,
  getInspecciones,
  createInspeccion,
  deleteInspeccion,
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

function NuevaInspeccionForm({ puntos, onSave, onCancel }) {
  const [form, setForm] = useState(INSPECCION_VACIA);
  const [valoresPuntos, setValoresPuntos] = useState({});
  const [saving, setSaving] = useState(false);
  const sugerencia = sugerirMuestreo(form.cantidad);
  const [clasificacion, setClasificacion] = useState("");

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const hayNC = Object.values(valoresPuntos).includes("NC");

  async function handleSave() {
    setSaving(true);
    const resultado = hayNC ? "No Conforme" : "Conforme";
    const puntosPayload = puntos.map((p) => ({ punto_control_id: p.id, valor: valoresPuntos[p.id] || null }));
    await onSave(
      { ...form, cantidad: form.cantidad || null, muestra: form.muestra || sugerencia?.muestra || null, resultado, clasificacion: hayNC ? clasificacion || "Menor" : null },
      puntosPayload
    );
    setSaving(false);
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]";
  const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";

  return (
    <div className={`${cardClass} p-4`}>
      <p className="mb-3 text-sm font-bold text-[#0f1f3d]">✍️ Nueva inspección</p>
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
        <label className={labelClass}>
          MP a inspeccionar
          <input value={form.producto_texto} onChange={(e) => setField("producto_texto", e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Lote / Identificación
          <input value={form.lote_identificacion} onChange={(e) => setField("lote_identificacion", e.target.value)} className={inputClass} />
        </label>
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
          Plan de muestreo: muestra {sugerencia.muestra} · Ac {sugerencia.ac} · Re {sugerencia.re}. 1 Mayor/Crítica → contener y ampliar a 100%.
        </p>
      )}

      <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Puntos de control</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[#f7f7f4] p-3 sm:grid-cols-3">
        {puntos.map((p) => (
          <div key={p.id} title={p.descripcion}>
            <PuntoControlChip letra={p.letra} valor={valoresPuntos[p.id]} onChange={(v) => setValoresPuntos((cur) => ({ ...cur, [p.id]: v }))} />
          </div>
        ))}
      </div>

      {hayNC && (
        <label className={`${labelClass} mt-3 block text-red-600`}>
          Clasificación de la NC
          <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value)} className={`${inputClass} border-red-200`}>
            <option value="">Seleccionar…</option>
            <option value="Menor">Menor</option>
            <option value="Mayor">Mayor</option>
            <option value="Crítico">Crítico</option>
          </select>
        </label>
      )}

      <label className={`${labelClass} mt-3 block`}>
        Observación / evidencia
        <textarea value={form.observacion} onChange={(e) => setField("observacion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      </label>
      <label className={`${labelClass} mt-3 block`}>
        Acción / Reinspección
        <textarea value={form.accion_reinspeccion} onChange={(e) => setField("accion_reinspeccion", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      </label>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className={btnPrimaryClass}>
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
      <div role="button" tabIndex={0} onClick={onToggle} className="flex cursor-pointer items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${esConforme ? "bg-green-50" : "bg-red-50"}`}>
          {esConforme ? "✅" : "⚠️"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0f1f3d]">{inspeccion.producto_texto || "Sin especificar"}</p>
          <p className="truncate text-xs text-[#5b6472]">{inspeccion.hora} · {inspeccion.proveedor || "—"} · Lote {inspeccion.lote_identificacion || "—"}</p>
        </div>
        <span className={statusBadgeClass(inspeccion.clasificacion || inspeccion.resultado)}>{inspeccion.clasificacion || inspeccion.resultado}</span>
        <span className={`text-[#94a3b8] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
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
  const [cierreForm, setCierreForm] = useState({ dictamen: "", observacion_general: "", responsable_area_nombre: "" });

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

  async function handleCerrar() {
    if (!cierreForm.dictamen) return;
    await cerrarRecorrido(selectedId, cierreForm, currentUser);
    await loadRecorridos();
    setCierreForm({ dictamen: "", observacion_general: "", responsable_area_nombre: "" });
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
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-xl font-bold tracking-tight text-[#0f1f3d]">Recorridos de inspección</h2>
              <HelpTip>Un recorrido agrupa todas las inspecciones de materia prima hechas en una jornada. Se cierra con un dictamen (Conforme / Con observación / No conforme) y la firma de la inspectora.</HelpTip>
            </div>
            <p className="truncate text-sm text-[#5b6472]">Recepción de Materia Prima · F-GC-01U</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleNuevoRecorrido}
              className="gc-gold-pulse inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#c9a227] bg-white px-4 py-2.5 text-sm font-semibold text-[#96771a] transition active:scale-[0.98] sm:flex-none"
            >
              📥 + Nuevo recorrido
            </button>
          )}
        </div>

        {recorridos.length === 0 ? (
          <div className={`${cardClass} py-10 text-center text-sm font-medium text-[#94a3b8]`}>Aún no hay recorridos registrados.</div>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => (
              <div key={grupo.label} className={`${cardClass} overflow-hidden`}>
                <div className="flex items-center justify-between bg-[#f7f7f4] px-4 py-2">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#5b6472]">{grupo.label}</p>
                  <span className="shrink-0 text-[11px] font-semibold text-[#94a3b8]">{grupo.items.length}</span>
                </div>
                <div className="divide-y divide-[#edf0f4]">
                  {grupo.items.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="flex w-full items-center gap-3 p-4 text-left transition active:bg-[#f7f7f4]/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0f1f3d]">{r.folio}</p>
                        <p className="truncate text-xs text-[#5b6472]">{r.fecha} · {r.inspectora_nombre || "—"} · {r.jornada}</p>
                      </div>
                      <span className={statusBadgeClass(r.dictamen || "Abierto")}>{r.dictamen || "Abierto"}</span>
                      <span className="shrink-0 text-[#94a3b8]">›</span>
                    </button>
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
      <button type="button" onClick={() => setSelectedId(null)} className={`${btnGhostClass} -ml-3`}>← Recorridos</button>

      <div className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-[#0f1f3d]">{recorridoActivo?.folio}</p>
            <p className="text-xs text-[#5b6472]">{recorridoActivo?.fecha} · Inspectora: {recorridoActivo?.inspectora_nombre || "—"} · {recorridoActivo?.jornada}</p>
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
          <p className="mb-3 text-sm font-bold text-[#0f1f3d]">Cierre / dictamen del recorrido</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={cierreForm.dictamen} onChange={(e) => setCierreForm((f) => ({ ...f, dictamen: e.target.value }))} className={inputClass}>
              <option value="">Dictamen…</option>
              <option value="Conforme">Conforme</option>
              <option value="Conforme con observación">Conforme con observación</option>
              <option value="Producto No Conforme">Producto No Conforme</option>
            </select>
            <input placeholder="Responsable de área" value={cierreForm.responsable_area_nombre} onChange={(e) => setCierreForm((f) => ({ ...f, responsable_area_nombre: e.target.value }))} className={inputClass} />
            <button type="button" onClick={handleCerrar} disabled={!cierreForm.dictamen} className={btnPrimaryClass}>Cerrar recorrido</button>
          </div>
          <textarea placeholder="Observación general / pendientes" value={cierreForm.observacion_general} onChange={(e) => setCierreForm((f) => ({ ...f, observacion_general: e.target.value }))} rows={2} className={`${inputClass} mt-2 w-full resize-none`} />
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
