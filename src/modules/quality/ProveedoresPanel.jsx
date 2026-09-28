import { useEffect, useState } from "react";
import { getProveedores, createProveedor } from "../../services/calidadService";
import { cardClass, btnPrimaryClass, btnGhostClass } from "./coreliTheme";

// Catálogo real de proveedores de Materia Prima — reemplaza el marcador de
// posición de Configuración. Por ahora es lista + alta rápida (nombre); la
// clave se asigna sola (siguiente número). Cuando se defina qué materiales
// se le compran a cada uno, esa relación se agrega aquí mismo.
export default function ProveedoresPanel({ onBack }) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const result = await getProveedores();
    if (result.ok) setProveedores(result.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleAgregar() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    setGuardando(true);
    const result = await createProveedor(nombre);
    setGuardando(false);
    if (result.ok) {
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
          <h2 className="truncate text-lg font-bold tracking-tight text-[#0f1f3d]">Proveedores</h2>
          <p className="text-xs text-[#5b6472]">Catálogo usado en las inspecciones de Materia Prima.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className={btnPrimaryClass}>+ Agregar</button>
      </div>

      {showForm && (
        <div className={`${cardClass} flex items-center gap-2 p-3`}>
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre del proveedor"
            className="flex-1 rounded-lg border border-[#edf0f4] px-3 py-2 text-sm"
            autoFocus
          />
          <button type="button" onClick={handleAgregar} disabled={!nombreNuevo.trim() || guardando} className={btnPrimaryClass}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => { setShowForm(false); setNombreNuevo(""); }} className={btnGhostClass}>Cancelar</button>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#94a3b8]">Cargando…</p>
      ) : proveedores.length === 0 ? (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin proveedores registrados.</p>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-14" />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-[#f7f7f4] text-[9px] font-semibold uppercase tracking-wide text-[#5b6472]">
                <th className="px-2.5 py-2">Clave</th>
                <th className="px-2.5 py-2">Nombre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f4]">
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td className="px-2.5 py-1.5 text-[#5b6472]">{p.clave ?? "—"}</td>
                  <td className="px-2.5 py-1.5 font-medium text-[#0f1f3d]">{p.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#94a3b8]">{proveedores.length} proveedor(es) activo(s).</p>
    </div>
  );
}
