import { useEffect, useMemo, useState } from "react";
import {
  AREAS_PLANOS,
  TIPOS_PLANO,
  claveAvance,
  getProductosPlanos,
  getAvancePlanos,
  setAvancePlano,
} from "../../services/avancePlanosService";

// Avance de planos 2D y 3D por producto y área (Corte, Costura, Carpintería,
// Armado, Tapizado). Implementación temporal mientras no hay diseñador: solo
// sirve para ir marcando qué planos ya existen. Misma estructura visual que la
// tabla de Madurez Organizacional (encabezado gris, barra oscura, casillas
// verdes y barra de avance azul marino).

const TOTAL_POR_PRODUCTO = AREAS_PLANOS.length * TIPOS_PLANO.length;

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

  const hechosDe = (p) => AREAS_PLANOS.reduce((s, a) => s + TIPOS_PLANO.filter((t) => marcadas.has(claveAvance(p.id, a.key, t))).length, 0);

  const resumen = useMemo(() => {
    const total = productos.length * TOTAL_POR_PRODUCTO;
    let hechos = 0;
    let hechos2d = 0;
    let hechos3d = 0;
    let completos = 0;
    productos.forEach((p) => {
      let h = 0;
      AREAS_PLANOS.forEach((a) => TIPOS_PLANO.forEach((t) => {
        if (marcadas.has(claveAvance(p.id, a.key, t))) {
          h += 1;
          if (t === "2D") hechos2d += 1; else hechos3d += 1;
        }
      }));
      hechos += h;
      if (h === TOTAL_POR_PRODUCTO) completos += 1;
    });
    const porTipo = productos.length * AREAS_PLANOS.length;
    return {
      total,
      hechos,
      global: total ? Math.round((hechos / total) * 100) : 0,
      pct2d: porTipo ? Math.round((hechos2d / porTipo) * 100) : 0,
      pct3d: porTipo ? Math.round((hechos3d / porTipo) * 100) : 0,
      completos,
    };
  }, [productos, marcadas]);

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
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 relative text-center">
          <span className="absolute left-3 top-2.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">Implementación temporal</span>
          <div className="text-lg font-black tracking-tight">Avance de planos 2D y 3D</div>
          <div className="text-[11px] text-gray-500 font-semibold">Avance global: {resumen.global}% · {resumen.hechos} de {resumen.total} planos</div>
        </div>
        <div className="grid grid-cols-3 text-center">
          <div className="py-2 border-r border-gray-200">
            <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">Planos 2D</div>
            <div className="text-2xl font-black text-[#203f73]">{resumen.pct2d}%</div>
          </div>
          <div className="py-2 border-r border-gray-200">
            <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">Planos 3D</div>
            <div className="text-2xl font-black text-[#203f73]">{resumen.pct3d}%</div>
          </div>
          <div className="py-2">
            <div className="text-[9px] font-black uppercase tracking-wide text-gray-400">Productos completos</div>
            <div className="text-2xl font-black text-green-700">{resumen.completos}<span className="text-sm text-gray-400">/{productos.length}</span></div>
          </div>
        </div>
      </div>

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
                  {AREAS_PLANOS.flatMap((a, ai) => TIPOS_PLANO.map((t, ti) => (
                    <th key={`${a.key}${t}`} className={`text-center px-[2px] py-1 font-black w-[58px] text-gray-500 ${ti === 0 ? "border-l border-gray-200" : ""} ${ai % 2 === 1 ? "bg-gray-100/60" : ""}`}>
                      <div className="text-[9px] leading-tight uppercase">{a.label}</div>
                      <div className="text-[11px] mt-[2px] leading-none font-black text-[#203f73]">{t}</div>
                    </th>
                  )))}
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
                      {AREAS_PLANOS.flatMap((a, ai) => TIPOS_PLANO.map((t, ti) => (
                        <td key={`${a.key}${t}`} className={`px-1 py-1 text-center ${ti === 0 ? "border-l border-gray-200" : ""} ${ai % 2 === 1 ? "bg-gray-100/40" : ""}`}>
                          <CheckCell
                            marcada={marcadas.has(claveAvance(producto.id, a.key, t))}
                            onToggle={() => alternar(producto, a.key, t)}
                            titulo={`${producto.nombre} · ${a.label} · plano ${t}`}
                          />
                        </td>
                      )))}
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
                  {AREAS_PLANOS.flatMap((a) => TIPOS_PLANO.map((t, ti) => (
                    <td key={`${a.key}${t}`} className={`px-1 py-2 text-center ${ti === 0 ? "border-l border-gray-200" : ""}`}>{totalColumna(a.key, t)}</td>
                  )))}
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
