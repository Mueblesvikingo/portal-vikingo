import { useEffect, useMemo, useState } from "react";
import {
  COLUMNAS_PLANOS,
  claveAvance,
  getProductosPlanos,
  getAvancePlanos,
  setAvancePlano,
} from "../../services/avancePlanosService";

// Avance de planos 2D y 3D por producto y área (Corte, Costura, Carpintería,
// Armado, Tapizado y Espuma; el 3D aplica solo a Armado). Implementación temporal mientras no hay diseñador: solo
// sirve para ir marcando qué planos ya existen. Misma estructura visual que la
// tabla de Madurez Organizacional (encabezado gris, barra oscura, casillas
// verdes y barra de avance azul marino).

const TOTAL_POR_PRODUCTO = COLUMNAS_PLANOS.length;

// Familia = primera palabra del nombre (Base, Cabecera, Sala…); "Par de buros"
// se agrupa como Buros.
function familiaDe(nombre) {
  const n = String(nombre || "").trim();
  if (/^par de buros/i.test(n)) return "Buros";
  return n.split(/\s+/)[0] || "Otros";
}

function Progress({ value }) {
  const seguro = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-[#203f73]" style={{ width: `${seguro}%` }} />
    </div>
  );
}

function CheckCell({ marcada, onToggle, titulo }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={titulo}
      aria-label={titulo}
      aria-pressed={marcada}
      className={`relative w-5 h-5 rounded-md flex items-center justify-center border text-[11px] font-black mx-auto cursor-pointer hover:opacity-80 ${
        marcada ? "bg-green-100 border-green-300 text-green-700" : "bg-white border-gray-200 text-gray-300"
      }`}
    >
      {marcada ? "✓" : ""}
    </button>
  );
}

export default function AvancePlanosPanel({ currentUser }) {
  const [productos, setProductos] = useState([]);
  const [marcadas, setMarcadas] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [tablaFaltante, setTablaFaltante] = useState(false);
  const [message, setMessage] = useState("");
  const [familia, setFamilia] = useState("Todas");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [prods, avance] = await Promise.all([getProductosPlanos(), getAvancePlanos()]);
      if (cancelado) return;
      setProductos(prods);
      setMarcadas(avance.marcadas);
      setTablaFaltante(avance.tablaFaltante);
      if (avance.error) setMessage("No fue posible cargar el avance. Recarga la página.");
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, []);

  const familias = useMemo(() => ["Todas", ...new Set(productos.map((p) => familiaDe(p.nombre)))], [productos]);
  const filtrados = familia === "Todas" ? productos : productos.filter((p) => familiaDe(p.nombre) === familia);

  const hechosDe = (p) => COLUMNAS_PLANOS.filter((c) => marcadas.has(claveAvance(p.id, c.area, c.tipo))).length;

  async function alternar(producto, area, tipo) {
    if (tablaFaltante) return;
    const clave = claveAvance(producto.id, area, tipo);
    const nuevo = !marcadas.has(clave);
    setMarcadas((actual) => {
      const copia = new Set(actual);
      if (nuevo) copia.add(clave); else copia.delete(clave);
      return copia;
    });
    try {
      await setAvancePlano({ productoId: producto.id, area, tipo, completado: nuevo }, currentUser);
    } catch (err) {
      console.error("Error al guardar el avance de planos:", err);
      setMarcadas((actual) => {
        const copia = new Set(actual);
        if (nuevo) copia.delete(clave); else copia.add(clave);
        return copia;
      });
      setMessage("No fue posible guardar el cambio.");
    }
  }

  // Total de casillas marcadas por columna (sobre los productos que se ven).
  const totalColumna = (area, tipo) => filtrados.filter((p) => marcadas.has(claveAvance(p.id, area, tipo))).length;

  return (
    <div className="space-y-5">
      {message && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

      {tablaFaltante && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Falta crear la tabla de esta pestaña en Supabase. Ejecuta una vez el archivo <span className="font-bold">sql/2026-10-sig_avance_planos.sql</span> en el SQL Editor y recarga la página.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-11 bg-[#111827] text-white px-4 flex items-center justify-between text-sm font-black">
          <div>AVANCE DE PLANOS POR PRODUCTO</div>
          <select
            aria-label="Filtrar por familia de producto"
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            className="bg-white text-gray-700 text-[10px] rounded-md px-1.5 py-0.5 border border-gray-300 font-semibold h-6"
          >
            {familias.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-10 text-center text-[11px] font-bold text-gray-300">Cargando…</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-black text-gray-500">N°</th>
                  <th className="text-left px-3 py-2 font-black text-gray-500">Producto</th>
                  {COLUMNAS_PLANOS.map((c, ci) => (
                    <th key={c.area} className={`text-center px-[2px] py-1 font-black w-[84px] text-gray-500 border-l border-gray-200 ${ci % 2 === 1 ? "bg-gray-100/60" : ""}`}>
                      <div className="text-[9px] leading-tight uppercase">{c.label}</div>
                      <div className="text-[11px] mt-[2px] leading-none font-black text-[#203f73]">{c.tipo}</div>
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 font-black text-gray-500 min-w-[120px] border-l border-gray-200">Avance</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filtrados.map((producto, index) => {
                  const hechos = hechosDe(producto);
                  const pct = Math.round((hechos / TOTAL_POR_PRODUCTO) * 100);
                  return (
                    <tr key={producto.id} className="border-b border-gray-100 hover:bg-red-50 transition-all">
                      <td className="px-3 py-2 font-bold text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2 min-w-[210px]">
                        <div className="font-black leading-tight text-[10px]">{producto.nombre}</div>
                        {producto.codigo && <div className="text-[9px] font-semibold text-gray-400">{producto.codigo}</div>}
                      </td>
                      {COLUMNAS_PLANOS.map((c, ci) => (
                        <td key={c.area} className={`px-1 py-1 text-center border-l border-gray-200 ${ci % 2 === 1 ? "bg-gray-100/40" : ""}`}>
                          <CheckCell
                            marcada={marcadas.has(claveAvance(producto.id, c.area, c.tipo))}
                            onToggle={() => alternar(producto, c.area, c.tipo)}
                            titulo={`${producto.nombre} · ${c.label} · plano ${c.tipo}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 border-l border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><Progress value={pct} /></div>
                          <span className={`w-9 text-right font-black ${pct === 100 ? "text-green-700" : "text-gray-600"}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-black text-gray-500">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-[10px] uppercase">Total marcados</td>
                  {COLUMNAS_PLANOS.map((c) => (
                    <td key={c.area} className="px-1 py-2 text-center border-l border-gray-200">{totalColumna(c.area, c.tipo)}</td>
                  ))}
                  <td className="px-3 py-2 border-l border-gray-200 text-[10px]">de {filtrados.length} productos</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
