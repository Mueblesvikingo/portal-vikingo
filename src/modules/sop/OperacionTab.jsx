import { useEffect, useMemo, useState } from "react";
import { buildHorizonte, formatFechaCorta, formatNumber, getPiezasProporcionalSemana, LINEAS } from "./sopHelpers";
import SolicitudModal from "./SolicitudModal";
import SolicitarRecursoModal from "./SolicitarRecursoModal";
import { getVentana } from "../../services/sopVentanaSemanalService";

// Orden fijo de estaciones reales (PCP-IF-01 Análisis Planeación
// Producción) — se usa para ordenar filas/columnas consistentemente aunque
// capacidadProcesos venga en otro orden desde Supabase.
const ESTACIONES_ORDEN = ["Corte Madera", "Armado Casco", "Hab. Resorte", "Hab. Esponja", "Corte Tela", "Costura", "Tapiceria", "Empaque"];
const FAMILIAS_ORDEN = ["Base Vinil", "Base Tela", "Cabecera Vinil", "Cabecera Tela", "Converticama", "Sala/Sofa", "Reposet", "Sillon"];
const DIAS_SEMANA = 5;

// Vacantes reales de personal (PCP-MA-02-Infraestructura, auditoría de
// mantenimiento) — a diferencia del equipo fuera de servicio, no hay una
// fila por vacante en sop_capacidad_procesos (esa tabla ya guarda la
// dotación objetivo, vacante incluida), así que se deja como referencia
// fija en vez de inventarle una tabla aparte a un solo dato estático.
const VACANTES_PERSONAL = [
  { puesto: "Armadores de Casco", faltan: 1 },
  { puesto: "Operador de radial", faltan: 1 },
  { puesto: "Operador de banco", faltan: 1 },
  { puesto: "Operadores de Máquinas", faltan: 2 },
  { puesto: "Costureras", faltan: 1 },
];

// Explicación de uso de la pestaña, en una ventana aparte para no saturar
// el encabezado — mismo patrón de modal simple (overlay + tarjeta blanca
// con scroll interno) que el resto del módulo.
function ComoFuncionaOperacionModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-700">Cómo funciona Plan de operación</p>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50">✕</button>
        </div>

        <div className="mt-3 space-y-3 text-[10px] font-semibold leading-relaxed text-slate-600">
          <p>
            Esta pestaña compara lo que <b>Plan de venta</b> proyecta vender (en piezas) contra la <b>capacidad real de las 8 estaciones</b> de producción, para detectar a tiempo dónde se va a saturar la planta.
          </p>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">1. Carga vs. capacidad por estación (% Utilización)</p>
            <p className="mt-1">
              Carga = piezas planeadas × minutos estándar reales de la familia del producto en esa estación. Capacidad = personas × horas de turno × turnos × eficiencia operativa × días. El % es carga ÷ capacidad; debajo de cada badge se muestra el detalle en minutos. La estación con mayor % se marca 🔻 como <b>cuello de botella</b> — es la que realmente limita cuánto se puede producir.
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">2. Por qué una estación puede salir en 0%</p>
            <p className="mt-1">
              No todas las familias de producto pasan por todas las estaciones (ej. una base en vinil no pasa por Costura ni Hab. Esponja). 0% significa que esa estación no participa de lo planeado, no que falte capturar algo.
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">2a. Piezas sin familia clasificada</p>
            <p className="mt-1">
              Si abajo de la tabla aparece un aviso de "piezas no se contaron en esta tabla", significa que esos productos todavía no tienen "Familia" asignada en el catálogo (se asigna en Plan de venta → vista mensual → columna Familia). Sin esa clasificación no hay forma de saber qué tiempo estándar usar, así que esas piezas quedan fuera del cálculo hasta que se clasifiquen.
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">2b. Demanda de la semana (Vista semanal)</p>
            <p className="mt-1">
              En Vista semanal, si un producto todavía no se captura en Plan de venta para esa semana en particular, se usa como estimado su parte proporcional del plan mensual (piezas del mes ÷ semanas del mes) — así no se ve demanda en cero solo por falta de captura. En cuanto se captura la semana real en Plan de venta, ese dato manda sobre el estimado.
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">3. Simulador de mejora</p>
            <p className="mt-1">
              Permite probar, sin guardar nada, qué pasaría si se agregan personas o turnos a una estación. Sirve para confirmar que invertir en el cuello de botella real sube la capacidad de la planta — invertir en una estación que no es el cuello de botella no ayuda (es la lógica de Teoría de Restricciones).
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">4. Capacidad real, tiempos estándar e infraestructura</p>
            <p className="mt-1">
              Las secciones de abajo son donde se captura y mantiene la información que alimenta el cálculo: dotación de personas por estación, minutos estándar por familia/estación, y catálogo de equipos (marcando cuáles están fuera de servicio).
            </p>
          </div>

          <div>
            <p className="font-black uppercase tracking-widest text-slate-400">5. Brechas reales y solicitudes</p>
            <p className="mt-1">
              Muestra vacantes de personal y equipo fuera de servicio detectados. Desde ahí, o desde el botón <b>"Solicitar a Dirección"</b>, se puede enviar una solicitud de recurso/capacidad — cae directo en la Bandeja del Centro de Decisiones para que el Director la apruebe, detenga o rechace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getEstado(utilizacion) {
  if (utilizacion > 1) return { label: "Saturado", tone: "border-red-200 bg-red-50 text-red-700", bar: "bg-red-500" };
  if (utilizacion >= 0.8) return { label: "Atención", tone: "border-amber-200 bg-amber-50 text-amber-700", bar: "bg-amber-400" };
  return { label: "OK", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" };
}

// Numero clicable -> input, mismo patron que EditableCell de PlanVentaTab
// (commit desde blur Y desde Enter, ver comentario original de por que).
function EditableNum({ value, canEdit, onSave, step = 1 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  if (!canEdit) return <span className="text-slate-700">{value ?? "—"}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value ?? ""));
          setEditing(true);
        }}
        className="rounded px-1 text-slate-700 transition hover:bg-sky-50"
      >
        {value ?? "—"}
      </button>
    );
  }

  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n) && n !== Number(value ?? 0)) onSave(n);
  }

  return (
    <input
      autoFocus
      type="number"
      min="0"
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 w-16 rounded border border-sky-300 bg-white px-1 text-center text-[10px] font-bold text-slate-800 outline-none"
    />
  );
}

// Piezas por producto de un mes concreto (para un escenario) — mismo
// insumo que ya usa el resto del módulo, aquí agrupado por producto para
// alimentar el cálculo de carga real por estación.
function piezasPorProductoDelMes(planVenta, escenario, anio, mes) {
  const map = {};
  for (const row of planVenta) {
    if (row.escenario !== escenario || row.anio !== anio || row.mes !== mes) continue;
    map[row.producto_id] = (map[row.producto_id] || 0) + Number(row.piezas || 0);
  }
  return map;
}

// Carga real (minutos requeridos) vs. capacidad real (minutos disponibles)
// por estación — mismo cálculo que la hoja "Carga_vs_Capacidad" de
// PCP-IF-01: piezas × tiempo estándar (familia × estación) da la carga;
// operarios × horas turno × turnos × eficiencia × días da la capacidad.
// Los productos sin familia clasificada no participan (no se inventa su
// tiempo estándar) y se reportan aparte para que quede claro qué falta.
function calcularCargaEstaciones(piezasPorProducto, { productoFamilia, tiempoMap, capacidadProcesos, eficiencia, dias }) {
  const cargaPorEstacion = {};
  let piezasSinClasificar = 0;
  for (const [productoId, piezas] of Object.entries(piezasPorProducto)) {
    const cantidad = Number(piezas || 0);
    if (!cantidad) continue;
    const familia = productoFamilia.get(Number(productoId));
    if (!familia) {
      piezasSinClasificar += cantidad;
      continue;
    }
    for (const proc of capacidadProcesos) {
      const min = tiempoMap.get(`${familia}|${proc.proceso}`);
      if (min) cargaPorEstacion[proc.proceso] = (cargaPorEstacion[proc.proceso] || 0) + cantidad * min;
    }
  }
  const filas = capacidadProcesos.map((p) => {
    const capacidadMin = Number(p.operarios || 0) * Number(p.horas_turno || 0) * Number(p.turnos_activos || 0) * 60 * eficiencia * dias;
    const cargaMin = cargaPorEstacion[p.proceso] || 0;
    const utilizacion = capacidadMin > 0 ? cargaMin / capacidadMin : 0;
    return { estacion: p.proceso, cargaMin, capacidadMin, utilizacion };
  });
  const cuelloBotella = filas.reduce((max, f) => (!max || f.utilizacion > max.utilizacion ? f : max), null);
  return { filas, cuelloBotella, piezasSinClasificar };
}

function ordenarEstaciones(filas) {
  return [...filas].sort((a, b) => ESTACIONES_ORDEN.indexOf(a.estacion) - ESTACIONES_ORDEN.indexOf(b.estacion));
}

// Tabla compartida por la vista mensual (varias columnas, una por mes) y la
// semanal (una sola columna) — misma forma que ya usa el resto del módulo
// para demanda/capacidad, ahora con estaciones reales en las filas.
function TablaCargaCapacidad({ columnas }) {
  const estaciones = ESTACIONES_ORDEN.filter((e) => columnas[0]?.filas.some((f) => f.estacion === e));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
            <th className="px-3 py-2 text-white">Estación</th>
            {columnas.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estaciones.map((estacion) => (
            <tr key={estacion} className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">{estacion}</td>
              {columnas.map((c) => {
                const fila = c.filas.find((f) => f.estacion === estacion);
                const estado = getEstado(fila?.utilizacion || 0);
                const esCuello = c.cuelloBotella?.estacion === estacion;
                return (
                  <td key={c.key} className="px-2 py-1.5 text-right">
                    <span
                      title={`Carga real: ${formatNumber(fila?.cargaMin || 0)} min necesarios ÷ Capacidad: ${formatNumber(fila?.capacidadMin || 0)} min disponibles`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${estado.tone}`}
                    >
                      {esCuello && "🔻 "}{((fila?.utilizacion || 0) * 100).toFixed(0)}%
                    </span>
                    <p className="mt-0.5 text-[8px] font-semibold normal-case tracking-normal text-slate-400">
                      {formatNumber(fila?.cargaMin || 0)}/{formatNumber(fila?.capacidadMin || 0)} min
                    </p>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-slate-50/60">
            <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Cuello de botella</td>
            {columnas.map((c) => (
              <td key={c.key} className="px-2 py-1.5 text-right text-[9px] font-bold text-slate-600">
                {c.cuelloBotella ? `${c.cuelloBotella.estacion} (${(c.cuelloBotella.utilizacion * 100).toFixed(0)}%)` : "—"}
              </td>
            ))}
          </tr>
          {columnas.some((c) => c.piezasSinClasificar > 0) && (
            <tr>
              <td colSpan={columnas.length + 1} className="px-3 py-1.5 text-[9px] font-semibold normal-case tracking-normal text-amber-600">
                ⚠ {columnas.map((c) => formatNumber(c.piezasSinClasificar)).join(" / ")} pieza(s) planeada(s) no se contaron en esta tabla — son de productos que todavía no tienen "Familia" asignada en el catálogo (Plan de venta → vista mensual → columna Familia). Sin familia no se sabe qué tiempo estándar usar en cada estación, así que no suman carga hasta que se clasifiquen.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Matriz editable de tiempos estándar (familia × estación) — el dato real
// que alimenta la carga de la tabla de arriba. Se cargó inicial con datos
// reales de PCP-IF-01, pero el proceso cambia con el tiempo (mejoras,
// productos nuevos), así que queda editable aquí en vez de fijo.
function TiemposEstandarSection({ tiemposEstandar, canEdit, onUpdateTiempoEstandar, currentUser }) {
  const porFamiliaEstacion = useMemo(() => new Map(tiemposEstandar.map((t) => [`${t.familia}|${t.estacion}`, t])), [tiemposEstandar]);
  const familias = FAMILIAS_ORDEN.filter((f) => tiemposEstandar.some((t) => t.familia === f));

  if (tiemposEstandar.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-sky-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Tiempos estándar (minutos por pieza)</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Minutos que toma cada pieza en cada estación, por familia de producto — de aquí sale la carga real de la tabla de arriba. Edítalos si el proceso mejora o cambia.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-2 py-1.5">Familia</th>
                {ESTACIONES_ORDEN.map((e) => (
                  <th key={e} className="px-2 py-1.5 text-center">{e}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {familias.map((familia) => (
                <tr key={familia} className="border-t border-slate-50">
                  <td className="px-2 py-1 font-bold text-slate-700">{familia}</td>
                  {ESTACIONES_ORDEN.map((estacion) => {
                    const t = porFamiliaEstacion.get(`${familia}|${estacion}`);
                    return (
                      <td key={estacion} className="px-1 py-1 text-center">
                        {t ? (
                          <EditableNum value={t.minutos_por_pieza} canEdit={canEdit} onSave={(n) => onUpdateTiempoEstandar(t.id, n, currentUser)} />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Simulador de mejora de capacidad — Teoría de Restricciones (Theory of
// Constraints): mejorar una estación que no es el cuello de botella no
// aumenta la capacidad real de la planta, solo invertir en la que sí lo es
// mueve la aguja. Deja probar +personas/+turnos por estación sin guardar
// nada, recalcula con el mismo motor real (calcularCargaEstaciones) y
// muestra si el cuello de botella se alivia o se mueve a otra estación.
function SimuladorMejora({ capacidadProcesos, canEdit, calcularColumnas }) {
  const [activo, setActivo] = useState(false);
  const [deltas, setDeltas] = useState({});

  if (!canEdit || capacidadProcesos.length === 0) return null;

  function setDelta(estacion, campo, valor) {
    setDeltas((c) => ({ ...c, [estacion]: { ...c[estacion], [campo]: valor } }));
  }

  const capacidadSimulada = capacidadProcesos.map((p) => ({
    ...p,
    operarios: Number(p.operarios || 0) + Number(deltas[p.proceso]?.operarios || 0),
    turnos_activos: Number(p.turnos_activos || 0) + Number(deltas[p.proceso]?.turnos || 0),
  }));
  const columnasSimuladas = activo ? calcularColumnas(capacidadSimulada) : [];

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">🧪 Simulador de mejora (Teoría de Restricciones)</p>
        <button
          type="button"
          onClick={() => setActivo((v) => !v)}
          className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${activo ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          {activo ? "Ocultar simulación" : "Probar cambios"}
        </button>
      </div>
      {activo && (
        <>
          <p className="mt-1.5 text-[9px] font-semibold normal-case tracking-normal text-slate-400">
            Agrega personas o turnos de prueba (no se guarda nada) y compara contra la tabla real de arriba: mejorar una estación que no es el cuello de botella no sube la capacidad de la planta — solo ayuda invertir en la que sí lo es.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ordenarEstaciones(capacidadProcesos.map((p) => ({ estacion: p.proceso }))).map(({ estacion }) => (
              <div key={estacion} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{estacion}</p>
                <div className="mt-1 flex items-center gap-2">
                  <label className="text-[8px] font-bold text-slate-400">
                    + pers.
                    <input
                      type="number"
                      min="0"
                      value={deltas[estacion]?.operarios || 0}
                      onChange={(e) => setDelta(estacion, "operarios", Number(e.target.value))}
                      className="ml-1 h-6 w-10 rounded border border-slate-200 bg-white px-1 text-center text-[10px] font-bold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="text-[8px] font-bold text-slate-400">
                    + turnos
                    <input
                      type="number"
                      min="0"
                      value={deltas[estacion]?.turnos || 0}
                      onChange={(e) => setDelta(estacion, "turnos", Number(e.target.value))}
                      className="ml-1 h-6 w-10 rounded border border-slate-200 bg-white px-1 text-center text-[10px] font-bold text-slate-700 outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-violet-600">Resultado simulado</p>
            <TablaCargaCapacidad columnas={columnasSimuladas} />
          </div>
        </>
      )}
    </div>
  );
}

function CapacidadRealSection({ capacidadProcesos, canEdit, onCreateProceso, onUpdateProceso, onDeactivateProceso, currentUser }) {
  const [nuevo, setNuevo] = useState({ proceso: "", operarios: 1, horas_turno: 10, turnos_activos: 1 });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!nuevo.proceso.trim()) return;
    setSaving(true);
    const ok = await onCreateProceso(nuevo, currentUser);
    setSaving(false);
    if (ok) setNuevo({ proceso: "", operarios: 1, horas_turno: 10, turnos_activos: 1 });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-emerald-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Capacidad real por estación — dotación</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Capacidad (min) = operarios × horas/turno × turnos × 60 × eficiencia operativa × días — misma fórmula que usa Planeación de Producción en su análisis de carga vs. capacidad. La eficiencia y los días hábiles se capturan en Parámetros.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-2 py-1.5">Estación</th>
                  <th className="px-2 py-1.5 text-center">Personas</th>
                  <th className="px-2 py-1.5 text-center">Horas/turno</th>
                  <th className="px-2 py-1.5 text-center">Turnos</th>
                  {canEdit && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {capacidadProcesos.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-4 text-center text-[10px] font-bold text-slate-300">Aún no hay estaciones capturadas.</td></tr>
                )}
                {ordenarEstaciones(capacidadProcesos.map((p) => ({ estacion: p.proceso, ...p }))).map((p) => (
                  <tr key={p.id} className="border-t border-slate-50">
                    <td className="px-2 py-1 font-bold text-slate-700">{p.proceso}</td>
                    <td className="px-2 py-1 text-center">
                      <EditableNum value={p.operarios} canEdit={canEdit} onSave={(n) => onUpdateProceso(p.id, { operarios: n }, currentUser)} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <EditableNum value={p.horas_turno} canEdit={canEdit} step={0.5} onSave={(n) => onUpdateProceso(p.id, { horas_turno: n }, currentUser)} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <EditableNum value={p.turnos_activos} canEdit={canEdit} onSave={(n) => onUpdateProceso(p.id, { turnos_activos: n }, currentUser)} />
                    </td>
                    {canEdit && (
                      <td className="px-2 py-1 text-right">
                        <button type="button" onClick={() => onDeactivateProceso(p.id, currentUser)} className="text-[9px] font-black text-red-500 hover:underline">Quitar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {canEdit && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Estación
              <input value={nuevo.proceso} onChange={(e) => setNuevo((c) => ({ ...c, proceso: e.target.value }))} placeholder="Ej. Corte Madera" className="mt-1 h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Personas
              <input type="number" min="0" value={nuevo.operarios} onChange={(e) => setNuevo((c) => ({ ...c, operarios: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Horas/turno
              <input type="number" min="0" step="0.5" value={nuevo.horas_turno} onChange={(e) => setNuevo((c) => ({ ...c, horas_turno: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Turnos
              <input type="number" min="0" value={nuevo.turnos_activos} onChange={(e) => setNuevo((c) => ({ ...c, turnos_activos: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <button type="button" disabled={saving} onClick={handleAdd} className="h-8 rounded-lg bg-[#001225] px-3 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? "Guardando..." : "+ Agregar estación"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfraestructuraSection({ infraestructura, canEdit, onCreateInfra, onUpdateInfra, onDeactivateInfra, currentUser }) {
  const [nuevo, setNuevo] = useState({ nombre_equipo: "", proceso: "", cantidad: 1, horas_disponibles_turno: 10, turnos_activos: 1 });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!nuevo.nombre_equipo.trim()) return;
    setSaving(true);
    const ok = await onCreateInfra(nuevo, currentUser);
    setSaving(false);
    if (ok) setNuevo({ nombre_equipo: "", proceso: "", cantidad: 1, horas_disponibles_turno: 10, turnos_activos: 1 });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-violet-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Infraestructura — catálogo de equipo</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Catálogo real de máquinas por estación. Las filas con 0 horas/turno están fuera de servicio (cuentan en el inventario pero no aportan capacidad) — ver también "Brechas reales" abajo.
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-2 py-1.5">Equipo</th>
                  <th className="px-2 py-1.5">Estación</th>
                  <th className="px-2 py-1.5 text-center">Cantidad</th>
                  <th className="px-2 py-1.5 text-center">Horas/turno</th>
                  <th className="px-2 py-1.5 text-center">Turnos</th>
                  {canEdit && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {infraestructura.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-4 text-center text-[10px] font-bold text-slate-300">Aún no hay equipos capturados.</td></tr>
                )}
                {infraestructura.map((e) => {
                  const fueraDeServicio = Number(e.horas_disponibles_turno) === 0;
                  return (
                    <tr key={e.id} className={`border-t border-slate-50 ${fueraDeServicio ? "bg-red-50/40" : ""}`}>
                      <td className="px-2 py-1 font-bold text-slate-700">
                        {e.nombre_equipo}
                        {fueraDeServicio && <span className="ml-1.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-red-600">Fuera de servicio</span>}
                      </td>
                      <td className="px-2 py-1 text-slate-600">{e.proceso || "—"}</td>
                      <td className="px-2 py-1 text-center">
                        <EditableNum value={e.cantidad} canEdit={canEdit} onSave={(n) => onUpdateInfra(e.id, { cantidad: n }, currentUser)} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <EditableNum value={e.horas_disponibles_turno} canEdit={canEdit} step={0.5} onSave={(n) => onUpdateInfra(e.id, { horas_disponibles_turno: n }, currentUser)} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <EditableNum value={e.turnos_activos} canEdit={canEdit} onSave={(n) => onUpdateInfra(e.id, { turnos_activos: n }, currentUser)} />
                      </td>
                      {canEdit && (
                        <td className="px-2 py-1 text-right">
                          <button type="button" onClick={() => onDeactivateInfra(e.id, currentUser)} className="text-[9px] font-black text-red-500 hover:underline">Quitar</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {canEdit && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Equipo
              <input value={nuevo.nombre_equipo} onChange={(e) => setNuevo((c) => ({ ...c, nombre_equipo: e.target.value }))} placeholder="Ej. Mesa de corte" className="mt-1 h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Estación
              <input value={nuevo.proceso} onChange={(e) => setNuevo((c) => ({ ...c, proceso: e.target.value }))} placeholder="Opcional" className="mt-1 h-8 w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Cantidad
              <input type="number" min="0" value={nuevo.cantidad} onChange={(e) => setNuevo((c) => ({ ...c, cantidad: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Horas/turno
              <input type="number" min="0" step="0.5" value={nuevo.horas_disponibles_turno} onChange={(e) => setNuevo((c) => ({ ...c, horas_disponibles_turno: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Turnos
              <input type="number" min="0" value={nuevo.turnos_activos} onChange={(e) => setNuevo((c) => ({ ...c, turnos_activos: Number(e.target.value) }))} className="mt-1 h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <button type="button" disabled={saving} onClick={handleAdd} className="h-8 rounded-lg bg-[#001225] px-3 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? "Guardando..." : "+ Agregar equipo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Brechas reales conocidas (auditoría de mantenimiento PCP-MA-02): vacantes
// de personal (referencia fija, ver comentario de VACANTES_PERSONAL) y
// equipo fuera de servicio (calculado de infraestructura, horas/turno=0).
// Cada una con acceso directo a "Solicitar recurso" para mandarla a
// Dirección sin tener que redactar la solicitud desde cero.
function BrechasRealesSection({ infraestructura, canEdit, currentUser, onSolicitarRecurso }) {
  const [solicitando, setSolicitando] = useState(null);
  const equipoFuera = infraestructura.filter((e) => Number(e.horas_disponibles_turno) === 0);

  if (VACANTES_PERSONAL.length === 0 && equipoFuera.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-red-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Brechas reales de infraestructura</p>
      </div>
      <div className="space-y-3 p-4">
        {VACANTES_PERSONAL.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vacantes de personal</p>
            <div className="mt-1.5 space-y-1">
              {VACANTES_PERSONAL.map((v) => (
                <div key={v.puesto} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-slate-600">{v.puesto} — faltan {v.faltan}</span>
                  {canEdit && (
                    <button type="button" onClick={() => setSolicitando(`Contratación: ${v.puesto} (${v.faltan})`)} className="text-[9px] font-black text-violet-600 hover:underline">🛠 Solicitar recurso</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {equipoFuera.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Equipo fuera de servicio</p>
            <div className="mt-1.5 space-y-1">
              {equipoFuera.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-slate-600">{e.nombre_equipo} ({e.proceso}) — {e.cantidad} fuera de servicio</span>
                  {canEdit && (
                    <button type="button" onClick={() => setSolicitando(`Reparación/reemplazo: ${e.nombre_equipo} (${e.proceso})`)} className="text-[9px] font-black text-violet-600 hover:underline">🛠 Solicitar recurso</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {solicitando && (
        <SolicitarRecursoModal defaultNombre={solicitando} onSubmit={(draft) => onSolicitarRecurso(draft, currentUser)} onClose={() => setSolicitando(null)} />
      )}
    </div>
  );
}

// Vista semanal de Plan de operación — mismo cálculo real (carga vs.
// capacidad por estación) que la vista mensual, pero para una sola semana:
// la demanda sale del compromiso de piezas ya capturado en Plan de venta
// (sop_ventana_semanal, pestaña "plan-venta") y los días son 5 (semana
// laboral completa, igual que el análisis real de Planeación de Producción).
function OperacionSemanalView({ productos, planVenta, escenarioActivo, parametros, capacidadProcesos, tiemposEstandar, semanaLunes, canEdit, currentUser, onSolicitarRecurso }) {
  const [loading, setLoading] = useState(true);
  const [capturaSemana, setCapturaSemana] = useState({});
  const [showSolicitarRecurso, setShowSolicitarRecurso] = useState(false);
  const [showComoFunciona, setShowComoFunciona] = useState(false);

  const lunes = new Date(`${semanaLunes}T00:00:00`);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVentana("plan-venta", semanaLunes).then((result) => {
      if (cancelled) return;
      setCapturaSemana(result?.data?.datos?.piezasPorProducto || {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [semanaLunes]);

  const proporcionalMes = useMemo(() => getPiezasProporcionalSemana(planVenta, escenarioActivo, semanaLunes), [planVenta, escenarioActivo, semanaLunes]);

  // Un producto ya capturado esa semana (aunque sea en 0) manda sobre el
  // estimado; uno que nunca se ha tocado toma su parte proporcional del
  // plan mensual, para no mostrar demanda en cero solo porque nadie lo ha
  // capturado todavía esa semana en particular.
  const piezasPorProducto = useMemo(() => {
    const map = { ...proporcionalMes };
    for (const [productoId, piezas] of Object.entries(capturaSemana)) {
      map[productoId] = Number(piezas || 0);
    }
    return map;
  }, [proporcionalMes, capturaSemana]);
  const hayEstimado = Object.keys(proporcionalMes).some((id) => !(id in capturaSemana));

  const productoLinea = useMemo(() => new Map(productos.map((p) => [p.id, p.linea])), [productos]);
  const productoFamilia = useMemo(() => new Map(productos.map((p) => [p.id, p.familia || null])), [productos]);
  const tiempoMap = useMemo(() => new Map(tiemposEstandar.map((t) => [`${t.familia}|${t.estacion}`, Number(t.minutos_por_pieza || 0)])), [tiemposEstandar]);
  const eficiencia = parametros?.eficiencia_operativa != null ? Number(parametros.eficiencia_operativa) : 1;

  const porLinea = useMemo(() => {
    const map = Object.fromEntries(LINEAS.map((l) => [l, 0]));
    for (const [productoId, piezas] of Object.entries(piezasPorProducto)) {
      const linea = productoLinea.get(Number(productoId));
      if (!linea || !Number(piezas)) continue;
      map[linea] += Number(piezas);
    }
    return map;
  }, [piezasPorProducto, productoLinea]);
  const totalPiezas = LINEAS.reduce((s, l) => s + porLinea[l], 0);

  const { filas, cuelloBotella, piezasSinClasificar } = useMemo(
    () => calcularCargaEstaciones(piezasPorProducto, { productoFamilia, tiempoMap, capacidadProcesos, eficiencia, dias: DIAS_SEMANA }),
    [piezasPorProducto, productoFamilia, tiempoMap, capacidadProcesos, eficiencia]
  );
  const faltaConfig = capacidadProcesos.length === 0 || tiemposEstandar.length === 0;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
          Vista semanal · del {formatFechaCorta(lunes)} al {formatFechaCorta(viernes)} — carga real por estación, demanda de Plan de venta
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowComoFunciona(true)}
            className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
          >
            Cómo funciona
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSolicitarRecurso(true)}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50"
            >
              🛠 Solicitar recurso
            </button>
          )}
        </div>
      </div>

      {showComoFunciona && <ComoFuncionaOperacionModal onClose={() => setShowComoFunciona(false)} />}

      {hayEstimado && !loading && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold text-slate-400">
          Los productos que aún no se capturan esta semana en Plan de venta usan como estimado su parte proporcional del plan mensual (piezas del mes ÷ semanas del mes). En cuanto se capture la semana en Plan de venta, ese dato real toma prioridad.
        </p>
      )}

      {showSolicitarRecurso && (
        <SolicitarRecursoModal onSubmit={(draft) => onSolicitarRecurso(draft, currentUser)} onClose={() => setShowSolicitarRecurso(false)} />
      )}

      {loading ? (
        <p className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[320px] border-collapse text-[10px]">
              <thead>
                <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
                  <th className="px-3 py-2 text-white">Línea</th>
                  <th className="px-2 py-2 text-right">Piezas (semana)</th>
                </tr>
              </thead>
              <tbody>
                {LINEAS.map((linea) => (
                  <tr key={linea} className="border-b border-slate-50">
                    <td className="px-3 py-1.5 font-bold text-slate-700">{linea}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600">{formatNumber(porLinea[linea])}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/60">
                  <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Total piezas</td>
                  <td className="px-2 py-1.5 text-right font-black text-slate-700">{formatNumber(totalPiezas)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {faltaConfig ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">
              Falta capturar la dotación por estación (abajo) para calcular carga vs. capacidad real.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-3">
                <p className="mb-2 text-[9px] font-semibold normal-case tracking-normal text-slate-400">
                  % Utilización = carga real (piezas de la semana × minutos estándar de su familia en esa estación) ÷ capacidad real (personas × horas × turnos × eficiencia × 5 días). El detalle en minutos aparece debajo de cada %.
                </p>
                <TablaCargaCapacidad columnas={[{ key: "semana", label: "% Utilización", filas, cuelloBotella, piezasSinClasificar }]} />
                <SimuladorMejora
                  capacidadProcesos={capacidadProcesos}
                  canEdit={canEdit}
                  calcularColumnas={(capSim) => {
                    const sim = calcularCargaEstaciones(piezasPorProducto, { productoFamilia, tiempoMap, capacidadProcesos: capSim, eficiencia, dias: DIAS_SEMANA });
                    return [{ key: "semana-sim", label: "% Utilización (simulado)", ...sim }];
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OperacionTab({
  productos,
  planVenta,
  control,
  parametros,
  capacidadProcesos = [],
  infraestructura = [],
  tiemposEstandar = [],
  canEdit = false,
  currentUser,
  onCreateProceso,
  onUpdateProceso,
  onDeactivateProceso,
  onCreateInfra,
  onUpdateInfra,
  onDeactivateInfra,
  onSolicitarCapacidad,
  onSolicitarRecurso,
  onUpdateTiempoEstandar,
  vistaSemanal,
  semanaLunes,
}) {
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [showComoFunciona, setShowComoFunciona] = useState(false);

  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const productoLinea = useMemo(() => new Map(productos.map((p) => [p.id, p.linea])), [productos]);
  const productoFamilia = useMemo(() => new Map(productos.map((p) => [p.id, p.familia || null])), [productos]);
  const tiempoMap = useMemo(() => new Map(tiemposEstandar.map((t) => [`${t.familia}|${t.estacion}`, Number(t.minutos_por_pieza || 0)])), [tiemposEstandar]);
  const eficiencia = parametros?.eficiencia_operativa != null ? Number(parametros.eficiencia_operativa) : 1;
  const diasHabilesMes = Number(parametros?.dias_habiles_mes || 0);
  const faltaConfig = capacidadProcesos.length === 0 || tiemposEstandar.length === 0 || !diasHabilesMes;

  const demandaPorMes = useMemo(() => {
    return horizonte.map((m) => {
      const porLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
      for (const row of planVenta) {
        if (row.escenario !== escenarioActivo || row.anio !== m.anio || row.mes !== m.mes) continue;
        const linea = productoLinea.get(row.producto_id);
        if (!linea) continue;
        porLinea[linea] += Number(row.piezas || 0);
      }
      const totalPiezas = LINEAS.reduce((s, l) => s + porLinea[l], 0);
      return { ...m, porLinea, totalPiezas };
    });
  }, [horizonte, planVenta, escenarioActivo, productoLinea]);

  const porMesEstaciones = useMemo(() => {
    if (faltaConfig) return [];
    return horizonte.map((m) => {
      const piezasMes = piezasPorProductoDelMes(planVenta, escenarioActivo, m.anio, m.mes);
      const { filas, cuelloBotella, piezasSinClasificar } = calcularCargaEstaciones(piezasMes, {
        productoFamilia,
        tiempoMap,
        capacidadProcesos,
        eficiencia,
        dias: diasHabilesMes,
      });
      return { key: `${m.anio}-${m.mes}`, label: m.label, filas, cuelloBotella, piezasSinClasificar };
    });
  }, [horizonte, planVenta, escenarioActivo, productoFamilia, tiempoMap, capacidadProcesos, eficiencia, diasHabilesMes, faltaConfig]);

  const mesesSaturados = porMesEstaciones.filter((m) => m.cuelloBotella && m.cuelloBotella.utilizacion > 1);

  // Sugerencia editable, no texto forzado: si hay meses con cuello de
  // botella saturado se arma un resumen como punto de partida, pero el
  // título y la descripción se pueden reescribir por completo en
  // SolicitudModal antes de enviar.
  const solicitudInicial = {
    titulo: mesesSaturados.length > 0 ? `Restricción de capacidad — ${mesesSaturados.map((m) => m.label).join(", ")}` : "",
    descripcion:
      mesesSaturados.length > 0
        ? mesesSaturados
            .map((m) => `${m.label}: cuello de botella en ${m.cuelloBotella.estacion} — ${(m.cuelloBotella.utilizacion * 100).toFixed(0)}% de utilización (carga ${formatNumber(m.cuelloBotella.cargaMin)} min vs. capacidad ${formatNumber(m.cuelloBotella.capacidadMin)} min).`)
            .join("\n")
        : "",
    riesgo: mesesSaturados.length > 0 ? "Alto" : "Moderado",
  };

  async function handleEnviarSolicitud(draft) {
    const ok = await onSolicitarCapacidad(draft, currentUser);
    return ok;
  }

  if (vistaSemanal) {
    return (
      <>
        <OperacionSemanalView
          productos={productos}
          planVenta={planVenta}
          escenarioActivo={escenarioActivo}
          parametros={parametros}
          capacidadProcesos={capacidadProcesos}
          tiemposEstandar={tiemposEstandar}
          semanaLunes={semanaLunes}
          canEdit={canEdit}
          currentUser={currentUser}
          onSolicitarRecurso={onSolicitarRecurso}
        />
        <div className="space-y-3 p-3 pt-0">
          <CapacidadRealSection
            capacidadProcesos={capacidadProcesos}
            canEdit={canEdit}
            onCreateProceso={onCreateProceso}
            onUpdateProceso={onUpdateProceso}
            onDeactivateProceso={onDeactivateProceso}
            currentUser={currentUser}
          />
          <InfraestructuraSection
            infraestructura={infraestructura}
            canEdit={canEdit}
            onCreateInfra={onCreateInfra}
            onUpdateInfra={onUpdateInfra}
            onDeactivateInfra={onDeactivateInfra}
            currentUser={currentUser}
          />
          <TiemposEstandarSection tiemposEstandar={tiemposEstandar} canEdit={canEdit} onUpdateTiempoEstandar={onUpdateTiempoEstandar} currentUser={currentUser} />
          <BrechasRealesSection infraestructura={infraestructura} canEdit={canEdit} currentUser={currentUser} onSolicitarRecurso={onSolicitarRecurso} />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        <span>
          Escenario de venta activo: <b>{escenarioActivo}</b> · Capacidad real de 8 estaciones (Planeación de Producción) · Eficiencia operativa: <b>{(eficiencia * 100).toFixed(0)}%</b>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowComoFunciona(true)}
            className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
          >
            Cómo funciona
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSolicitud(true)}
              className="rounded-lg bg-[#001225] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-[#001a38]"
            >
              Solicitar a Dirección
            </button>
          )}
        </div>
      </div>

      {showComoFunciona && <ComoFuncionaOperacionModal onClose={() => setShowComoFunciona(false)} />}

      {showSolicitud && (
        <SolicitudModal initialDraft={solicitudInicial} onSubmit={handleEnviarSolicitud} onClose={() => setShowSolicitud(false)} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Demanda por línea (piezas)</th>
              {horizonte.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="px-2 py-2 text-right">{m.label}</th>
              ))}
              <th className="px-2 py-2 text-right">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {LINEAS.map((linea) => (
              <tr key={linea} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-bold text-slate-700">{linea}</td>
                {demandaPorMes.map((m, i) => (
                  <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(m.porLinea[linea])}</td>
                ))}
                <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                  {formatNumber(demandaPorMes.reduce((s, m) => s + m.porLinea[linea], 0) / (demandaPorMes.length || 1))}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/60">
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Total piezas demandadas</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{formatNumber(m.totalPiezas)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.totalPiezas, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Carga vs. capacidad real por estación</p>
        </div>
        <div className="p-3">
          {faltaConfig ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">
              Falta capturar: {capacidadProcesos.length === 0 && "dotación por estación (abajo). "}{!diasHabilesMes && "días hábiles del mes (Parámetros). "}{tiemposEstandar.length === 0 && "tiempos estándar por familia (catálogo interno)."}
            </p>
          ) : (
            <>
              <TablaCargaCapacidad columnas={porMesEstaciones} />
              <SimuladorMejora
                capacidadProcesos={capacidadProcesos}
                canEdit={canEdit}
                calcularColumnas={(capSim) =>
                  horizonte.map((m) => {
                    const piezasMes = piezasPorProductoDelMes(planVenta, escenarioActivo, m.anio, m.mes);
                    const sim = calcularCargaEstaciones(piezasMes, { productoFamilia, tiempoMap, capacidadProcesos: capSim, eficiencia, dias: diasHabilesMes });
                    return { key: `${m.anio}-${m.mes}`, label: m.label, ...sim };
                  })
                }
              />
            </>
          )}
        </div>
      </div>

      <CapacidadRealSection
        capacidadProcesos={capacidadProcesos}
        canEdit={canEdit}
        onCreateProceso={onCreateProceso}
        onUpdateProceso={onUpdateProceso}
        onDeactivateProceso={onDeactivateProceso}
        currentUser={currentUser}
      />

      <InfraestructuraSection
        infraestructura={infraestructura}
        canEdit={canEdit}
        onCreateInfra={onCreateInfra}
        onUpdateInfra={onUpdateInfra}
        onDeactivateInfra={onDeactivateInfra}
        currentUser={currentUser}
      />

      <TiemposEstandarSection tiemposEstandar={tiemposEstandar} canEdit={canEdit} onUpdateTiempoEstandar={onUpdateTiempoEstandar} currentUser={currentUser} />

      <BrechasRealesSection infraestructura={infraestructura} canEdit={canEdit} currentUser={currentUser} onSolicitarRecurso={onSolicitarRecurso} />
    </div>
  );
}
