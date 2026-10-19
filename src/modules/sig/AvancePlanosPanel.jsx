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

// Familias que no entran en este seguimiento (siguen en el catálogo de productos).
const FAMILIAS_EXCLUIDAS = ["Buros", "Tocador"];

// Tampoco entran las bases de tela (todas): se sigue el avance de las demás bases.
const esBaseDeTela = (p) => familiaDe(p.nombre) === "Base" && /tela/i.test(p.nombre);
const esExcluido = (p) => FAMILIAS_EXCLUIDAS.includes(familiaDe(p.nombre)) || esBaseDeTela(p);

// Filas alternadas: blanco y un solo tono rojo claro.
const COLOR_FILA_ALTERNA = "#fdecec";

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
    <div className="h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
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
      className={`relative w-4 h-4 rounded flex items-center justify-center border text-[10px] leading-none font-black mx-auto cursor-pointer hover:opacity-80 ${
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
  const [familia, setFamilia] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [prods, avance] = await Promise.all([getProductosPlanos(), getAvancePlanos()]);
      if (cancelado) return;
      setProductos(prods.filter((p) => !esExcluido(p)));
      setMarcadas(avance.marcadas);
      setTablaFaltante(avance.tablaFaltante);
      if (avance.error) setMessage("No fue posible cargar el avance. Recarga la página.");
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, []);

  // Familias en el orden del catálogo (Bases, Cabeceras, Buros…), cada una con su conteo.
  const familias = useMemo(() => {
    const conteo = new Map();
    productos.forEach((p) => { const fam = familiaDe(p.nombre); conteo.set(fam, (conteo.get(fam) || 0) + 1); });
    return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total }));
  }, [productos]);
  // Mientras no se elija una, se muestra la primera: así la tabla cabe sin scroll vertical.
  const familiaActiva = familia || familias[0]?.nombre || "";
  const filtrados = familiaActiva === "Todas" ? productos : productos.filter((p) => familiaDe(p.nombre) === familiaActiva);

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
          <div className="text-[10px] font-bold text-gray-400">{filtrados.length} productos</div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5">
          <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">Familia</span>
          {[...familias, { nombre: "Todas", total: productos.length }].map((fam) => (
            <button
              key={fam.nombre}
              type="button"
              onClick={() => setFamilia(fam.nombre)}
              aria-pressed={familiaActiva === fam.nombre}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black transition ${
                familiaActiva === fam.nombre ? "border-[#111827] bg-[#111827] text-white" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {fam.nombre} <span className={familiaActiva === fam.nombre ? "text-gray-400" : "text-gray-300"}>{fam.total}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 text-center text-[11px] font-bold text-gray-300">Cargando…</div>
        ) : (
          <div className="overflow-auto max-h-[78vh]">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-2 py-1 font-black text-gray-500 w-8">N°</th>
                  <th className="text-left px-2 py-1 font-black text-gray-500">Producto</th>
                  {COLUMNAS_PLANOS.map((c) => (
                    <th key={c.area} className="text-center px-[2px] py-0.5 font-black w-[84px] text-gray-500 border-l border-gray-200">
                      <div className="text-[9px] leading-tight uppercase">{c.label}</div>
                      <div className="text-[10px] leading-none font-black text-[#203f73]">{c.tipo}</div>
                    </th>
                  ))}
                  <th className="text-left px-2 py-1 font-black text-gray-500 min-w-[120px] border-l border-gray-200">Avance</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((producto, index) => {
                  const hechos = hechosDe(producto);
                  const pct = Math.round((hechos / TOTAL_POR_PRODUCTO) * 100);
                  return (
                    <tr key={producto.id} style={{ backgroundColor: index % 2 === 1 ? COLOR_FILA_ALTERNA : "#ffffff" }} className="border-b border-gray-100 transition-all hover:brightness-[0.97]">
                      <td className="px-2 py-[3px] font-bold text-gray-400 text-[10px]">{index + 1}</td>
                      <td className="px-2 py-[3px] min-w-[210px] whitespace-nowrap">
                        <span className="font-black text-[10px]">{producto.nombre}</span>
                        {producto.codigo && <span className="ml-1.5 text-[9px] font-semibold text-gray-400">{producto.codigo}</span>}
                      </td>
                      {COLUMNAS_PLANOS.map((c) => (
                        <td key={c.area} className="px-1 py-[3px] text-center border-l border-gray-100">
                          <CheckCell
                            marcada={marcadas.has(claveAvance(producto.id, c.area, c.tipo))}
                            onToggle={() => alternar(producto, c.area, c.tipo)}
                            titulo={`${producto.nombre} · ${c.label} · plano ${c.tipo}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-[3px] border-l border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><Progress value={pct} /></div>
                          <span className={`w-8 text-right text-[10px] font-black ${pct === 100 ? "text-green-700" : "text-gray-600"}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-black text-gray-500">
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1 text-[10px] uppercase">Total marcados</td>
                  {COLUMNAS_PLANOS.map((c) => (
                    <td key={c.area} className="px-1 py-1 text-center border-l border-gray-200">{totalColumna(c.area, c.tipo)}</td>
                  ))}
                  <td className="px-2 py-1 border-l border-gray-200 text-[10px]">de {filtrados.length} productos</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
