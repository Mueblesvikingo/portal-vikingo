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

const DICTAMEN_BADGE = {
  "Conforme": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Conforme con observación": "border-amber-200 bg-amber-50 text-amber-700",
  "Producto No Conforme": "border-red-200 bg-red-50 text-red-700",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
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
    { key: "C", label: "C", tone: "emerald" },
    { key: "NC", label: "NC", tone: "red" },
    { key: "NA", label: "NA", tone: "slate" },
  ];
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 text-[10px] font-black text-slate-400">{letra}</span>
      {opciones.map((o) => {
        const active = valor === o.key;
        const toneClasses = {
          emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-200 text-emerald-600",
          red: active ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-500",
          slate: active ? "bg-slate-500 text-white border-slate-500" : "border-slate-200 text-slate-400",
        };
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(active ? null : o.key)}
            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black transition ${toneClasses[o.tone]}`}
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

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const hayNC = Object.values(valoresPuntos).includes("NC");
  const [clasificacion, setClasificacion] = useState("");

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

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
      <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-sky-700">Nueva inspección</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Hora
          <input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          OC / Lote
          <input value={form.oc_lote} onChange={(e) => setField("oc_lote", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Proveedor
          <input value={form.proveedor} onChange={(e) => setField("proveedor", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-500 sm:col-span-1">
          MP a inspeccionar
          <input value={form.producto_texto} onChange={(e) => setField("producto_texto", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Lote / Identificación
          <input value={form.lote_identificacion} onChange={(e) => setField("lote_identificacion", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Cant.
          <input type="number" min="0" value={form.cantidad} onChange={(e) => setField("cantidad", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Muestra
          <input type="number" min="0" value={form.muestra} placeholder={sugerencia ? String(sugerencia.muestra) : ""} onChange={(e) => setField("muestra", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </label>
      </div>
      {sugerencia && (
        <p className="mt-1.5 text-[9px] font-bold text-slate-400">
          Plan de muestreo sugiere: muestra {sugerencia.muestra} · Ac {sugerencia.ac} · Re {sugerencia.re} (no conformidades menores). 1 Mayor/Crítica → conten y amplía a 100%.
        </p>
      )}

      <p className="mb-1.5 mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Puntos de control</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {puntos.map((p) => (
          <div key={p.id} title={p.descripcion}>
            <PuntoControlChip letra={p.letra} valor={valoresPuntos[p.id]} onChange={(v) => setValoresPuntos((cur) => ({ ...cur, [p.id]: v }))} />
          </div>
        ))}
      </div>

      {hayNC && (
        <label className="mt-2 block text-[9px] font-black uppercase tracking-widest text-red-600">
          Clasificación de la NC
          <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value)} className="mt-1 w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none">
            <option value="">Seleccionar…</option>
            <option value="Menor">Menor</option>
            <option value="Mayor">Mayor</option>
            <option value="Crítico">Crítico</option>
          </select>
        </label>
      )}

      <label className="mt-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
        Observación / evidencia
        <textarea value={form.observacion} onChange={(e) => setField("observacion", e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
      </label>
      <label className="mt-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
        Acción / Reinspección
        <textarea value={form.accion_reinspeccion} onChange={(e) => setField("accion_reinspeccion", e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
      </label>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white transition disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar inspección"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
    </div>
  );
}

function InspeccionCard({ inspeccion, currentUser, onDelete, onEvidenciaChange, canEdit }) {
  const resultadoBadge = inspeccion.resultado === "No Conforme"
    ? "border-red-200 bg-red-50 text-red-600"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-slate-800">{inspeccion.producto_texto || "—"}</p>
          <p className="text-[9px] font-bold text-slate-400">
            {inspeccion.hora} · OC/Lote: {inspeccion.oc_lote || "—"} · Proveedor: {inspeccion.proveedor || "—"} · Lote/Id: {inspeccion.lote_identificacion || "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${resultadoBadge}`}>{inspeccion.resultado}</span>
          {inspeccion.clasificacion && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">{inspeccion.clasificacion}</span>
          )}
          {canEdit && (
            <button type="button" onClick={() => onDelete(inspeccion.id)} className="text-[9px] font-black text-slate-300 hover:text-red-500">✕</button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[9px] font-bold text-slate-400">Cant. {inspeccion.cantidad ?? "—"} · Muestra {inspeccion.muestra ?? "—"}</p>
      {inspeccion.observacion && <p className="mt-1 text-[10px] text-slate-600">{inspeccion.observacion}</p>}
      {inspeccion.accion_reinspeccion && <p className="mt-1 text-[10px] text-slate-500"><span className="font-black text-slate-400">ACCIÓN · </span>{inspeccion.accion_reinspeccion}</p>}
      <div className="mt-2">
        <EvidenciaUploader
          inspeccionId={inspeccion.id}
          evidencias={inspeccion.calidad_evidencias || []}
          currentUser={currentUser}
          onChange={onEvidenciaChange}
          canEdit={canEdit}
        />
      </div>
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

  if (loading) return <div className="py-10 text-center text-[11px] font-bold text-slate-300">Cargando…</div>;

  if (!selectedId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Recorridos de inspección</p>
          {canEdit && (
            <button type="button" onClick={handleNuevoRecorrido} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">+ Nuevo recorrido</button>
          )}
        </div>
        <div className="space-y-2">
          {recorridos.length === 0 && <p className="py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay recorridos registrados.</p>}
          {recorridos.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-sky-200"
            >
              <div>
                <p className="text-[11px] font-black text-slate-800">{r.folio}</p>
                <p className="text-[9px] font-bold text-slate-400">{r.fecha} · {r.inspectora_nombre || "—"} · {r.jornada}</p>
              </div>
              {r.dictamen ? (
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${DICTAMEN_BADGE[r.dictamen]}`}>{r.dictamen}</span>
              ) : (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-black text-sky-700">Abierto</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setSelectedId(null)} className="text-[10px] font-black text-slate-400 hover:text-slate-600">← Recorridos</button>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-black text-slate-800">{recorridoActivo?.folio}</p>
            <p className="text-[9px] font-bold text-slate-400">{recorridoActivo?.fecha} · Inspectora: {recorridoActivo?.inspectora_nombre || "—"} · Jornada: {recorridoActivo?.jornada}</p>
          </div>
          {recorridoActivo?.dictamen && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${DICTAMEN_BADGE[recorridoActivo.dictamen]}`}>{recorridoActivo.dictamen}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {inspecciones.map((insp) => (
          <InspeccionCard
            key={insp.id}
            inspeccion={insp}
            currentUser={currentUser}
            onDelete={handleDeleteInspeccion}
            onEvidenciaChange={() => loadInspecciones(selectedId)}
            canEdit={canEdit && !recorridoActivo?.cerrado_at}
          />
        ))}
      </div>

      {canEdit && !recorridoActivo?.cerrado_at && (
        showForm ? (
          <NuevaInspeccionForm puntos={puntos} onSave={handleGuardarInspeccion} onCancel={() => setShowForm(false)} />
        ) : (
          <button type="button" onClick={() => setShowForm(true)} className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-[10px] font-black text-slate-400 hover:border-sky-300 hover:text-sky-600">
            + Agregar inspección
          </button>
        )
      )}

      {canEdit && !recorridoActivo?.cerrado_at && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Cierre / dictamen del recorrido</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={cierreForm.dictamen} onChange={(e) => setCierreForm((f) => ({ ...f, dictamen: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none">
              <option value="">Dictamen…</option>
              <option value="Conforme">Conforme</option>
              <option value="Conforme con observación">Conforme con observación</option>
              <option value="Producto No Conforme">Producto No Conforme</option>
            </select>
            <input placeholder="Responsable de área" value={cierreForm.responsable_area_nombre} onChange={(e) => setCierreForm((f) => ({ ...f, responsable_area_nombre: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
            <button type="button" onClick={handleCerrar} disabled={!cierreForm.dictamen} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40">Cerrar recorrido</button>
          </div>
          <textarea placeholder="Observación general / pendientes" value={cierreForm.observacion_general} onChange={(e) => setCierreForm((f) => ({ ...f, observacion_general: e.target.value }))} rows={2} className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none" />
        </div>
      )}

      {recorridoActivo?.cerrado_at && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[10px] font-bold text-slate-500">
          Cerrado el {new Date(recorridoActivo.cerrado_at).toLocaleString("es-MX")} · Firma: {recorridoActivo.firma_inspectora || "—"} · Responsable de área: {recorridoActivo.responsable_area_nombre || "—"}
          {recorridoActivo.observacion_general && <p className="mt-1">{recorridoActivo.observacion_general}</p>}
        </div>
      )}
    </div>
  );
}
