import { useEffect, useMemo, useState } from "react";
import {
  COLUMNAS_PLANOS,
  ESTADO_HECHO,
  ESTADO_VALIDADO,
  ESTADO_NO_APLICA,
  claveAvance,
  getProductosPlanos,
  getAvancePlanos,
  setAvancePlano,
} from "../../services/avancePlanosService";

// Avance de planos 2D y 3D por producto y área (Corte, Costura, Carpintería,
// Armado y Espuma; el 3D aplica solo a Armado). Implementación temporal
// mientras no hay diseñador: solo sirve para ir marcando qué planos ya existen.
// Misma estructura visual que la tabla de Madurez Organizacional (encabezado
// gris, barra oscura, casillas verdes y barra de avance azul marino).
// Cada casilla se cicla con clic: vacía → ✓ verde (terminado) → ✓ dorado (validado) → N/A → vacía.

// Familias que no entran en este seguimiento (siguen en el catálogo de productos).
const FAMILIAS_EXCLUIDAS = ["Buros", "Tocador"];

// Tampoco entran las bases de tela (todas): se sigue el avance de las demás bases.
const esBaseDeTela = (p) => familiaDe(p.nombre) === "Base" && /tela/i.test(p.nombre);
const esExcluido = (p) => FAMILIAS_EXCLUIDAS.includes(familiaDe(p.nombre)) || esBaseDeTela(p);

// Casillas que nunca aplican: ninguna base lleva plano de espuma. Se calculan por
// regla (no se guardan en la base) y no se pueden cambiar.
const REGLAS_NO_APLICA = [{ familia: "Base", area: "espuma" }];
const esNoAplicaFijo = (producto, columna) => REGLAS_NO_APLICA.some((r) => r.familia === familiaDe(producto.nombre) && r.area === columna.area);

// Filas alternadas: blanco y un solo tono rojo claro.
const COLOR_FILA_ALTERNA = "#fdecec";

// Familia = primera palabra del nombre (Base, Cabecera, Sala…); "Par de buros"
// se agrupa como Buros.
function familiaDe(nombre) {
  const n = String(nombre || "").trim();
  if (/^par de buros/i.test(n)) return "Buros";
  return n.split(/\s+/)[0] || "Otros";
}

// Una sola barra: azul = planos terminados, dorado encima (desde la izquierda) =
// planos validados (los validados también están terminados).
function Progress({ value, validado = 0 }) {
  const acotar = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : 0);
  const terminado = acotar(value);
  const validadoPct = Math.min(acotar(validado), terminado);
  return (
    <div className="relative h-1.5 bg-gray-200/80 rounded-full overflow-hidden" title={`Terminado ${terminado}% · Validado ${validadoPct}%`}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-[#203f73]" style={{ width: `${terminado}%` }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400" style={{ width: `${validadoPct}%` }} />
    </div>
  );
}

function CheckCell({ estado, fijo, onCycle, titulo }) {
  const clases =
    estado === ESTADO_VALIDADO
      ? "bg-amber-100 border-amber-400 text-amber-500"
      : estado === ESTADO_HECHO
        ? "bg-green-100 border-green-300 text-green-700"
        : estado === ESTADO_NO_APLICA
          ? "bg-gray-100 border-gray-300 text-gray-500"
          : "bg-white border-gray-200 text-gray-300";
  return (
    <button
      type="button"
      onClick={fijo ? undefined : onCycle}
      title={fijo ? `${titulo} · no aplica` : `${titulo} · clic: ✓ terminado → ✓ validado → N/A → vacío`}
      aria-label={titulo}
      aria-pressed={estado !== "no"}
      className={`relative w-5 h-4 rounded flex items-center justify-center border leading-none font-black mx-auto ${fijo ? "cursor-default" : "cursor-pointer hover:opacity-80"} ${clases} ${
        estado === ESTADO_NO_APLICA ? "text-[7px] tracking-tighter" : "text-[10px]"
      }`}
    >
      {estado === ESTADO_HECHO || estado === ESTADO_VALIDADO ? "✓" : estado === ESTADO_NO_APLICA ? "N/A" : ""}
    </button>
  );
}

export default function AvancePlanosPanel({ currentUser }) {
  const [productos, setProductos] = useState([]);
  const [estados, setEstados] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [tablaFaltante, setTablaFaltante] = useState(false);
  const [naDisponible, setNaDisponible] = useState(true);
  const [validadoDisponible, setValidadoDisponible] = useState(true);
  const [message, setMessage] = useState("");
  const [familia, setFamilia] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [prods, avance] = await Promise.all([getProductosPlanos(), getAvancePlanos()]);
      if (cancelado) return;
      setProductos(prods.filter((p) => !esExcluido(p)));
      setEstados(avance.estados);
      setTablaFaltante(avance.tablaFaltante);
      setNaDisponible(avance.naDisponible);
      setValidadoDisponible(avance.validadoDisponible);
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

  // En la vista de Bases no se muestra la columna de espuma (ninguna base la lleva).
  const columnas = COLUMNAS_PLANOS.filter((c) => !(familiaActiva === "Base" && REGLAS_NO_APLICA.some((r) => r.familia === "Base" && r.area === c.area)));

  const estadoDe = (p, c) => (esNoAplicaFijo(p, c) ? ESTADO_NO_APLICA : estados.get(claveAvance(p.id, c.area, c.tipo)) || "no");

  async function ciclar(producto, columna) {
    if (tablaFaltante || esNoAplicaFijo(producto, columna)) return;
    const clave = claveAvance(producto.id, columna.area, columna.tipo);
    const anterior = estados.get(clave) || "no";
    // vacía → terminado → validado → N/A → vacía (se omiten los pasos cuya columna aún no existe)
    const ciclo = ["no", ESTADO_HECHO, ...(validadoDisponible ? [ESTADO_VALIDADO] : []), ...(naDisponible ? [ESTADO_NO_APLICA] : [])];
    const siguiente = ciclo[(Math.max(0, ciclo.indexOf(anterior)) + 1) % ciclo.length];
    const poner = (valor) => setEstados((actual) => {
      const copia = new Map(actual);
      if (valor === "no") copia.delete(clave); else copia.set(clave, valor);
      return copia;
    });
    poner(siguiente);
    try {
      await setAvancePlano({ productoId: producto.id, area: columna.area, tipo: columna.tipo, estado: siguiente }, currentUser, { na: naDisponible, va: validadoDisponible });
    } catch (err) {
      console.error("Error al guardar el avance de planos:", err);
      poner(anterior);
      setMessage("No fue posible guardar el cambio.");
    }
  }

  // Avance general sobre todos los productos del seguimiento (no solo la familia que
  // se ve) y solo las casillas que aplican: planos terminados (verde; incluye los
  // validados) y planos validados (dorado).
  let aplicablesGeneral = 0;
  let terminadosGeneral = 0;
  let validadosGeneral = 0;
  productos.forEach((p) => COLUMNAS_PLANOS.forEach((c) => {
    const e = estadoDe(p, c);
    if (e === ESTADO_NO_APLICA) return;
    aplicablesGeneral += 1;
    if (e === ESTADO_HECHO || e === ESTADO_VALIDADO) terminadosGeneral += 1;
    if (e === ESTADO_VALIDADO) validadosGeneral += 1;
  }));
  const avanceGeneral = aplicablesGeneral ? Math.round((terminadosGeneral / aplicablesGeneral) * 100) : 0;
  const validadoGeneral = aplicablesGeneral ? Math.round((validadosGeneral / aplicablesGeneral) * 100) : 0;

  // Total de casillas hechas por columna (sobre los productos que se ven).
  const totalColumna = (c) => filtrados.filter((p) => [ESTADO_HECHO, ESTADO_VALIDADO].includes(estadoDe(p, c))).length;

  return (
    <div className="space-y-5">
      {message && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

      {tablaFaltante && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Falta crear la tabla de esta pestaña en Supabase. Ejecuta una vez el archivo <span className="font-bold">sql/2026-10-sig_avance_planos.sql</span> en el SQL Editor y recarga la página.
        </div>
      )}

      {!tablaFaltante && !naDisponible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Para poder marcar N/A en las casillas ejecuta una vez <span className="font-black">sql/2026-10-sig_avance_planos_na.sql</span> en el SQL Editor y recarga la página.
        </div>
      )}

      {!tablaFaltante && !validadoDisponible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Para poder marcar planos como validados (paloma dorada) ejecuta una vez <span className="font-black">sql/2026-10-sig_avance_planos_validado.sql</span> en el SQL Editor y recarga la página.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-11 bg-[#111827] text-white px-4 flex items-center justify-between text-sm font-black">
          <div className="flex items-center gap-3">
            <span>AVANCE DE PLANOS POR PRODUCTO</span>
            <span title="Planos terminados (todos los productos)" className="rounded-md bg-white/10 px-2 py-0.5 text-sm leading-none font-black text-green-300">{avanceGeneral}%</span>
            <span title="Planos validados (todos los productos)" className="rounded-md bg-white/10 px-2 py-0.5 text-sm leading-none font-black text-amber-300">{validadoGeneral}%</span>
          </div>
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
                  {columnas.map((c) => (
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
                  const estadosFila = COLUMNAS_PLANOS.map((c) => estadoDe(producto, c));
                  const aplicables = estadosFila.filter((e) => e !== ESTADO_NO_APLICA).length;
                  const hechos = estadosFila.filter((e) => e === ESTADO_HECHO || e === ESTADO_VALIDADO).length;
                  const pct = aplicables ? Math.round((hechos / aplicables) * 100) : 100;
                  const pctValidado = aplicables ? Math.round((estadosFila.filter((e) => e === ESTADO_VALIDADO).length / aplicables) * 100) : 0;
                  return (
                    <tr key={producto.id} style={{ backgroundColor: index % 2 === 1 ? COLOR_FILA_ALTERNA : "#ffffff" }} className="border-b border-gray-100 transition-all hover:brightness-[0.97]">
                      <td className="px-2 py-[3px] font-bold text-gray-400 text-[10px]">{index + 1}</td>
                      <td className="px-2 py-[3px] min-w-[210px] whitespace-nowrap">
                        <span className="font-black text-[10px]">{producto.nombre}</span>
                        {producto.codigo && <span className="ml-1.5 text-[9px] font-semibold text-gray-400">{producto.codigo}</span>}
                      </td>
                      {columnas.map((c) => (
                        <td key={c.area} className="px-1 py-[3px] text-center border-l border-gray-100">
                          <CheckCell
                            estado={estadoDe(producto, c)}
                            fijo={esNoAplicaFijo(producto, c)}
                            onCycle={() => ciclar(producto, c)}
                            titulo={`${producto.nombre} · ${c.label} · plano ${c.tipo}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-[3px] border-l border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><Progress value={pct} validado={pctValidado} /></div>
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
                  {columnas.map((c) => (
                    <td key={c.area} className="px-1 py-1 text-center border-l border-gray-200">{totalColumna(c)}</td>
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
