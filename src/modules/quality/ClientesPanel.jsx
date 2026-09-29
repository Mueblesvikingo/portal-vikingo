import { useEffect, useState } from "react";
import { getClientes, createCliente, deactivateCliente } from "../../services/calidadService";
import { cardClass, btnPrimaryClass, btnGhostClass } from "./coreliTheme";

// Catálogo real de clientes — destino de los productos en Producto
// Terminado. Mismo patrón que ProveedoresPanel/ProductosPanel: lista + alta
// rápida + tache discreto para quitar (baja lógica).
export default function ClientesPanel({ onBack }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [folioNuevo, setFolioNuevo] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const result = await getClientes();
    if (result.ok) setClientes(result.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleAgregar() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    setGuardando(true);
    const result = await createCliente({ folio: folioNuevo ? Number(folioNuevo) : null, nombre });
    setGuardando(false);
    if (result.ok) {
      setFolioNuevo("");
      setNombreNuevo("");
      setShowForm(false);
      cargar();
    }
  }

  async function handleQuitar(c) {
    if (!window.confirm(`¿Quitar "${c.nombre}" de clientes?`)) return;
    const result = await deactivateCliente(c.id);
    if (result.ok) cargar();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6472]">← Volver</button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold tracking-tight text-[#0f1f3d]">Clientes</h2>
          <p className="text-xs text-[#5b6472]">Destino de los productos en Producto Terminado.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={btnPrimaryClass}>+ Agregar</button>
      </div>

      {showForm && (
        <div className={`${cardClass} space-y-2 p-3`}>
          <div className="flex items-center gap-2">
            <input value={folioNuevo} onChange={(e) => setFolioNuevo(e.target.value)} placeholder="Folio" type="number" className="w-24 shrink-0 rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" />
            <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre del cliente" className="flex-1 rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" autoFocus />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAgregar} disabled={!nombreNuevo.trim() || guardando} className={`flex-1 ${btnPrimaryClass}`}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFolioNuevo(""); setNombreNuevo(""); }} className={btnGhostClass}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#94a3b8]">Cargando…</p>
      ) : clientes.length === 0 ? (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin clientes registrados.</p>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr className="bg-[#f7f7f4] text-[9px] font-semibold uppercase tracking-wide text-[#5b6472]">
                <th className="px-2.5 py-2">Folio</th>
                <th className="px-2.5 py-2">Nombre</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="px-2.5 py-1.5 text-[#5b6472]">{c.folio ?? "—"}</td>
                  <td className="truncate px-2.5 py-1.5 font-medium text-[#0f1f3d]">{c.nombre}</td>
                  <td className="px-1 py-1.5 text-center">
                    <button type="button" onClick={() => handleQuitar(c)} title="Quitar" className="text-[#c9c9c9] transition hover:text-red-500 active:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#94a3b8]">{clientes.length} cliente(s) activo(s).</p>
    </div>
  );
}
