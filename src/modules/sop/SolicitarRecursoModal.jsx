import { useState } from "react";

// Formulario compacto para pedir un recurso de infraestructura a Dirección
// — a propósito más angosto que SolicitudModal (solo nombre/fecha/costo,
// sin descripción ni riesgo) porque es justo lo que se necesita para
// justificar una compra, no una decisión estratégica completa.
const PERIODICIDADES = ["Único", "Semanal", "Mensual"];

export default function SolicitarRecursoModal({ onSubmit, onClose, defaultNombre }) {
  const [nombre, setNombre] = useState(defaultNombre || "");
  const [fecha, setFecha] = useState("");
  const [costo, setCosto] = useState("");
  const [periodicidad, setPeriodicidad] = useState("Único");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!nombre.trim()) {
      setError("Captura el nombre del requerimiento.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onSubmit({ nombre: nombre.trim(), fecha: fecha || null, costo: Number(costo) || 0, periodicidad });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-xs font-black uppercase tracking-widest text-slate-700">Solicitar recurso a Dirección</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">Requerimiento de infraestructura — se envía a la Bandeja del Centro de Decisiones.</p>

        <div className="mt-3 space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombre del requerimiento
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Montacargas adicional para almacén"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
            />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Fecha necesaria
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              />
            </label>
            <label className="block flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Costo estimado
              <input
                type="number"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="$"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              />
            </label>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Periodicidad del costo
            <select
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
            >
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
