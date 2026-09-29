import { useEffect, useState } from "react";
import { getColaboradores, createColaborador, deactivateColaborador } from "../../services/calidadService";
import { cardClass, btnPrimaryClass, btnGhostClass } from "./coreliTheme";

const FORM_VACIO = { numero_empleado: "", nombre: "", area: "", puesto: "" };

// Catálogo real de colaboradores operativos — cargado desde la nómina,
// omitiendo a propósito administrativos, gerencias, supervisores y jefes
// (pedido explícito: solo personal de piso). Mismo patrón que
// ProveedoresPanel: lista + alta rápida.
export default function ColaboradoresPanel({ onBack }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const result = await getColaboradores();
    if (result.ok) setColaboradores(result.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAgregar() {
    if (!form.nombre.trim()) return;
    setGuardando(true);
    const result = await createColaborador({ ...form, numero_empleado: form.numero_empleado ? Number(form.numero_empleado) : null });
    setGuardando(false);
    if (result.ok) {
      setForm(FORM_VACIO);
      setShowForm(false);
      cargar();
    }
  }

  async function handleQuitar(c) {
    if (!window.confirm(`¿Quitar "${c.nombre}" de colaboradores?`)) return;
    const result = await deactivateColaborador(c.id);
    if (result.ok) cargar();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6472]">← Volver</button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold tracking-tight text-[#0f1f3d]">Colaboradores</h2>
          <p className="text-xs text-[#5b6472]">Personal operativo (piso), sin administrativos ni mandos.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={btnPrimaryClass}>+ Agregar</button>
      </div>

      {showForm && (
        <div className={`${cardClass} space-y-2 p-3`}>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.numero_empleado} onChange={(e) => setField("numero_empleado", e.target.value)} placeholder="N° Empleado" type="number" className="rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" />
            <input value={form.area} onChange={(e) => setField("area", e.target.value)} placeholder="Área" className="rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" />
          </div>
          <input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} placeholder="Nombre" className="w-full rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" autoFocus />
          <input value={form.puesto} onChange={(e) => setField("puesto", e.target.value)} placeholder="Puesto" className="w-full rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={handleAgregar} disabled={!form.nombre.trim() || guardando} className={`flex-1 ${btnPrimaryClass}`}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(FORM_VACIO); }} className={btnGhostClass}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#94a3b8]">Cargando…</p>
      ) : colaboradores.length === 0 ? (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin colaboradores registrados.</p>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[420px] table-fixed text-left text-xs">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr className="bg-[#f7f7f4] text-[9px] font-semibold uppercase tracking-wide text-[#5b6472]">
                <th className="px-2.5 py-2">N° Emp.</th>
                <th className="px-2.5 py-2">Nombre</th>
                <th className="px-2.5 py-2">Área</th>
                <th className="px-2.5 py-2">Puesto</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {colaboradores.map((c) => (
                <tr key={c.id}>
                  <td className="px-2.5 py-1.5 text-[#5b6472]">{c.numero_empleado ?? "—"}</td>
                  <td className="truncate px-2.5 py-1.5 font-medium text-[#0f1f3d]">{c.nombre}</td>
                  <td className="truncate px-2.5 py-1.5 text-[#5b6472]">{c.area || "—"}</td>
                  <td className="truncate px-2.5 py-1.5 text-[#5b6472]">{c.puesto || "—"}</td>
                  <td className="px-1 py-1.5 text-center">
                    <button type="button" onClick={() => handleQuitar(c)} title="Quitar" className="text-[#c9c9c9] transition hover:text-red-500 active:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#94a3b8]">{colaboradores.length} colaborador(es) activo(s).</p>
    </div>
  );
}
