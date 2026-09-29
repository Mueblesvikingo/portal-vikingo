import { useEffect, useState } from "react";
import { getProductos, createProducto } from "../../services/calidadService";
import { cardClass, btnPrimaryClass, btnGhostClass } from "./coreliTheme";

// Catálogo real de productos terminados — reemplaza el marcador de posición
// de Configuración. Mismo patrón que ProveedoresPanel: lista + alta rápida.
export default function ProductosPanel({ onBack }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const result = await getProductos();
    if (result.ok) setProductos(result.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleAgregar() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    setGuardando(true);
    const result = await createProducto({ codigo: codigoNuevo ? Number(codigoNuevo) : null, nombre });
    setGuardando(false);
    if (result.ok) {
      setCodigoNuevo("");
      setNombreNuevo("");
      setShowForm(false);
      cargar();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6472]">← Volver</button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold tracking-tight text-[#0f1f3d]">Productos</h2>
          <p className="text-xs text-[#5b6472]">Catálogo de productos terminados.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={btnPrimaryClass}>+ Agregar</button>
      </div>

      {showForm && (
        <div className={`${cardClass} space-y-2 p-3`}>
          <div className="flex items-center gap-2">
            <input value={codigoNuevo} onChange={(e) => setCodigoNuevo(e.target.value)} placeholder="Código" type="number" className="w-24 shrink-0 rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" />
            <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre del producto" className="flex-1 rounded-lg border border-[#edf0f4] px-3 py-2 text-sm" autoFocus />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAgregar} disabled={!nombreNuevo.trim() || guardando} className={`flex-1 ${btnPrimaryClass}`}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setCodigoNuevo(""); setNombreNuevo(""); }} className={btnGhostClass}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#94a3b8]">Cargando…</p>
      ) : productos.length === 0 ? (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin productos registrados.</p>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-16" />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-[#f7f7f4] text-[9px] font-semibold uppercase tracking-wide text-[#5b6472]">
                <th className="px-2.5 py-2">Código</th>
                <th className="px-2.5 py-2">Producto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {productos.map((p) => (
                <tr key={p.id}>
                  <td className="px-2.5 py-1.5 text-[#5b6472]">{p.codigo ?? "—"}</td>
                  <td className="truncate px-2.5 py-1.5 font-medium text-[#0f1f3d]">{p.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#94a3b8]">{productos.length} producto(s) activo(s).</p>
    </div>
  );
}
