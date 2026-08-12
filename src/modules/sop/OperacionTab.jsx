import { useMemo, useState } from "react";
import { buildHorizonte, formatNumber, LINEAS } from "./sopHelpers";
import SolicitudModal from "./SolicitudModal";

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

const CAPACIDAD_TOTAL = (procesos) => procesos.reduce((s, p) => s + Number(p.operarios || 0) * Number(p.horas_turno || 0) * Number(p.turnos_activos || 0), 0);

function ManoDeObraSection({
  horizonte,
  planVenta,
  escenarioActivo,
  productoPeso,
  parametros,
  capacidadProcesos,
  canEdit,
  onCreateProceso,
  onUpdateProceso,
  onDeactivateProceso,
  currentUser,
}) {
  const [nuevo, setNuevo] = useState({ proceso: "", operarios: 1, horas_turno: 8, turnos_activos: 1 });
  const [saving, setSaving] = useState(false);

  const diasHabiles = Number(parametros?.dias_habiles_mes || 0);
  const horasPorComplejidad = Number(parametros?.horas_por_unidad_complejidad || 0);
  const faltaConfig = !diasHabiles || !horasPorComplejidad || capacidadProcesos.length === 0;

  // Eficiencia operativa (OEE simplificado): sin capturarla se asume 100% de
  // aprovechamiento — optimista, pero no bloquea el calculo como si lo hacen
  // dias_habiles_mes/horas_por_unidad_complejidad, que son indispensables.
  const eficiencia = parametros?.eficiencia_operativa != null ? Number(parametros.eficiencia_operativa) : 1;
  const horasHombreDisponibles = CAPACIDAD_TOTAL(capacidadProcesos) * diasHabiles * eficiencia;

  const demandaHoras = useMemo(() => {
    return horizonte.map((m) => {
      let unidadesComplejidad = 0;
      for (const row of planVenta) {
        if (row.escenario !== escenarioActivo || row.anio !== m.anio || row.mes !== m.mes) continue;
        const peso = productoPeso.get(row.producto_id);
        if (peso == null) continue;
        unidadesComplejidad += Number(row.piezas || 0) * peso;
      }
      const horasRequeridas = unidadesComplejidad * horasPorComplejidad;
      const utilizacion = horasHombreDisponibles > 0 ? horasRequeridas / horasHombreDisponibles : 0;
      return { ...m, horasRequeridas, utilizacion, gap: horasHombreDisponibles - horasRequeridas };
    });
  }, [horizonte, planVenta, escenarioActivo, productoPeso, horasPorComplejidad, horasHombreDisponibles]);

  async function handleAdd() {
    if (!nuevo.proceso.trim()) return;
    setSaving(true);
    const ok = await onCreateProceso(nuevo, currentUser);
    setSaving(false);
    if (ok) setNuevo({ proceso: "", operarios: 1, horas_turno: 8, turnos_activos: 1 });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-emerald-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Mano de obra</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Horas-hombre requeridas = Σ (piezas del mes × peso de complejidad del producto) × horas por unidad de complejidad. Horas-hombre disponibles = Σ de los procesos capturados abajo (operarios × horas/turno × turnos) × días hábiles del mes × eficiencia operativa.
          Es capacidad de planta agregada, no por estación individual — no hay dato de qué % de cada pieza pasa por cada proceso.
        </p>
        {faltaConfig && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-700">
            Falta capturar: {!diasHabiles && "días hábiles del mes (Parámetros). "}{!horasPorComplejidad && "horas-hombre por unidad de complejidad (Parámetros). "}{capacidadProcesos.length === 0 && "al menos un proceso con su dotación (abajo)."}
          </p>
        )}
        {!faltaConfig && (
          <p className="mt-2 text-[9px] font-bold normal-case tracking-normal text-slate-400">
            Eficiencia operativa aplicada: <b className="text-slate-600">{(eficiencia * 100).toFixed(0)}%</b>
            {parametros?.eficiencia_operativa == null && " (sin capturar, se asume 100% — captúrala en Parámetros para un cálculo más realista)."}
          </p>
        )}

        {!faltaConfig && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[10px]">
              <thead>
                <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
                  <th className="px-3 py-2 text-white">Concepto</th>
                  {demandaHoras.map((m) => (
                    <th key={`${m.anio}-${m.mes}`} className="px-2 py-2 text-right">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-700">Horas-hombre requeridas</td>
                  {demandaHoras.map((m, i) => (
                    <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(m.horasRequeridas)}</td>
                  ))}
                </tr>
                <tr className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-700">Horas-hombre disponibles</td>
                  {demandaHoras.map((_, i) => (
                    <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(horasHombreDisponibles)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">% Utilización</td>
                  {demandaHoras.map((m, i) => {
                    const estado = getEstado(m.utilizacion);
                    return (
                      <td key={i} className="px-2 py-1.5 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${estado.tone}`}>
                          {(m.utilizacion * 100).toFixed(0)}% {estado.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dotación por proceso</p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-2 py-1.5">Proceso</th>
                  <th className="px-2 py-1.5 text-center">Operarios</th>
                  <th className="px-2 py-1.5 text-center">Horas/turno</th>
                  <th className="px-2 py-1.5 text-center">Turnos</th>
                  <th className="px-2 py-1.5 text-right">Horas-hombre/mes</th>
                  {canEdit && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {capacidadProcesos.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-4 text-center text-[10px] font-bold text-slate-300">Aún no hay procesos capturados.</td></tr>
                )}
                {capacidadProcesos.map((p) => (
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
                    <td className="px-2 py-1 text-right text-slate-600">{formatNumber(Number(p.operarios || 0) * Number(p.horas_turno || 0) * Number(p.turnos_activos || 0) * diasHabiles)}</td>
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

          {canEdit && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Proceso
                <input value={nuevo.proceso} onChange={(e) => setNuevo((c) => ({ ...c, proceso: e.target.value }))} placeholder="Ej. Tapicería" className="mt-1 h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Operarios
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
                {saving ? "Guardando..." : "+ Agregar proceso"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfraestructuraSection({ infraestructura, parametros, canEdit, onCreateInfra, onUpdateInfra, onDeactivateInfra, currentUser }) {
  const [nuevo, setNuevo] = useState({ nombre_equipo: "", proceso: "", cantidad: 1, horas_disponibles_turno: 8, turnos_activos: 1 });
  const [saving, setSaving] = useState(false);
  const diasHabiles = Number(parametros?.dias_habiles_mes || 0);

  async function handleAdd() {
    if (!nuevo.nombre_equipo.trim()) return;
    setSaving(true);
    const ok = await onCreateInfra(nuevo, currentUser);
    setSaving(false);
    if (ok) setNuevo({ nombre_equipo: "", proceso: "", cantidad: 1, horas_disponibles_turno: 8, turnos_activos: 1 });
  }

  const capacidadTotal = infraestructura.reduce(
    (s, e) => s + Number(e.cantidad || 0) * Number(e.horas_disponibles_turno || 0) * Number(e.turnos_activos || 0) * diasHabiles,
    0
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-violet-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Infraestructura</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Catálogo de equipos/máquinas críticas y su capacidad instalada. No se compara contra demanda todavía — falta el dato de cuántas horas-máquina consume cada producto, no lo vamos a inventar.
          {!diasHabiles && " Falta capturar días hábiles del mes en Parámetros para calcular horas/mes."}
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-2 py-1.5">Equipo</th>
                <th className="px-2 py-1.5">Proceso</th>
                <th className="px-2 py-1.5 text-center">Cantidad</th>
                <th className="px-2 py-1.5 text-center">Horas/turno</th>
                <th className="px-2 py-1.5 text-center">Turnos</th>
                <th className="px-2 py-1.5 text-right">Horas-máquina/mes</th>
                {canEdit && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {infraestructura.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-[10px] font-bold text-slate-300">Aún no hay equipos capturados.</td></tr>
              )}
              {infraestructura.map((e) => (
                <tr key={e.id} className="border-t border-slate-50">
                  <td className="px-2 py-1 font-bold text-slate-700">{e.nombre_equipo}</td>
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
                  <td className="px-2 py-1 text-right text-slate-600">{formatNumber(Number(e.cantidad || 0) * Number(e.horas_disponibles_turno || 0) * Number(e.turnos_activos || 0) * diasHabiles)}</td>
                  {canEdit && (
                    <td className="px-2 py-1 text-right">
                      <button type="button" onClick={() => onDeactivateInfra(e.id, currentUser)} className="text-[9px] font-black text-red-500 hover:underline">Quitar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {infraestructura.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-100 bg-slate-50/60">
                  <td colSpan={5} className="px-2 py-1.5 text-right font-black uppercase text-[9px] text-slate-500">Capacidad instalada total</td>
                  <td className="px-2 py-1.5 text-right font-black text-slate-700">{formatNumber(capacidadTotal)}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {canEdit && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Equipo
              <input value={nuevo.nombre_equipo} onChange={(e) => setNuevo((c) => ({ ...c, nombre_equipo: e.target.value }))} placeholder="Ej. Mesa de corte" className="mt-1 h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Proceso
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

export default function OperacionTab({
  productos,
  planVenta,
  control,
  parametros,
  capacidadProcesos = [],
  infraestructura = [],
  canEdit = false,
  currentUser,
  onCreateProceso,
  onUpdateProceso,
  onDeactivateProceso,
  onCreateInfra,
  onUpdateInfra,
  onDeactivateInfra,
  onSolicitarCapacidad,
}) {
  const [showSolicitud, setShowSolicitud] = useState(false);

  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const productoLinea = useMemo(() => new Map(productos.map((p) => [p.id, p.linea])), [productos]);
  const productoPeso = useMemo(() => new Map(productos.map((p) => [p.id, p.peso_complejidad != null ? Number(p.peso_complejidad) : null])), [productos]);

  const capacidadDisponible =
    parametros?.escenario_capacidad === "2 turnos" && parametros?.capacidad_tapiceria_2_turnos
      ? Number(parametros.capacidad_tapiceria_2_turnos)
      : Number(parametros?.capacidad_tapiceria_1_turno || 0);

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
      const utilizacion = capacidadDisponible > 0 ? totalPiezas / capacidadDisponible : 0;
      const gap = capacidadDisponible - totalPiezas;
      return { ...m, porLinea, totalPiezas, utilizacion, gap };
    });
  }, [horizonte, planVenta, escenarioActivo, productoLinea, capacidadDisponible]);

  const promedioUtilizacion = demandaPorMes.length
    ? demandaPorMes.reduce((s, m) => s + m.utilizacion, 0) / demandaPorMes.length
    : 0;

  const mesesSaturados = demandaPorMes.filter((m) => getEstado(m.utilizacion).label === "Saturado");

  // Sugerencia editable, no texto forzado: si hay meses saturados se arma un
  // resumen como punto de partida, pero el título y la descripción se pueden
  // reescribir por completo antes de enviar — la solicitud puede ser por
  // cualquier tema de capacidad, no solo saturación de piezas.
  const solicitudInicial = {
    titulo: mesesSaturados.length > 0 ? `Restricción de capacidad — ${mesesSaturados.map((m) => m.label).join(", ")}` : "",
    descripcion:
      mesesSaturados.length > 0
        ? mesesSaturados
            .map((m) => `${m.label}: demanda ${formatNumber(m.totalPiezas)} pzas vs. capacidad ${formatNumber(capacidadDisponible)} pzas/mes — excedente de ${formatNumber(m.totalPiezas - capacidadDisponible)} pzas.`)
            .join("\n")
        : "",
    riesgo: mesesSaturados.length > 0 ? "Alto" : "Moderado",
  };

  async function handleEnviarSolicitud(draft) {
    const ok = await onSolicitarCapacidad(draft, currentUser);
    return ok;
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        <span>
          Escenario de venta activo: <b>{escenarioActivo}</b> · Capacidad disponible: <b>{formatNumber(capacidadDisponible)} pzas/mes</b> ({parametros?.escenario_capacidad}) · La capacidad se edita en Parámetros.
        </span>
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

      {showSolicitud && (
        <SolicitudModal initialDraft={solicitudInicial} onSubmit={handleEnviarSolicitud} onClose={() => setShowSolicitud(false)} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Concepto</th>
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
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Total piezas demandadas</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{formatNumber(m.totalPiezas)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.totalPiezas, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Capacidad disponible</td>
              {demandaPorMes.map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(capacidadDisponible)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-bold text-slate-700">{formatNumber(capacidadDisponible)}</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Gap (piezas)</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className={`px-2 py-1.5 text-right font-bold ${m.gap < 0 ? "text-red-600" : "text-slate-600"}`}>{formatNumber(m.gap)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.gap, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">% Utilización</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{(m.utilizacion * 100).toFixed(1)}%</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-700">{(promedioUtilizacion * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Estado</td>
              {demandaPorMes.map((m, i) => {
                const estado = getEstado(m.utilizacion);
                return (
                  <td key={i} className="px-2 py-1.5 text-right">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${estado.tone}`}>{estado.label}</span>
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {demandaPorMes.map((m, i) => {
          const estado = getEstado(m.utilizacion);
          return (
            <div key={i} className={`rounded-xl border p-3 ${estado.tone}`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest">{m.label}</p>
                <span className="text-[9px] font-black uppercase">{estado.label}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/60">
                <div className={`h-full rounded-full ${estado.bar}`} style={{ width: `${Math.min(m.utilizacion * 100, 140)}%` }} />
              </div>
              <p className="mt-1 text-[9px] font-bold">{formatNumber(m.totalPiezas)} / {formatNumber(capacidadDisponible)} pzas ({(m.utilizacion * 100).toFixed(0)}%)</p>
            </div>
          );
        })}
      </div>

      <ManoDeObraSection
        horizonte={horizonte}
        planVenta={planVenta}
        escenarioActivo={escenarioActivo}
        productoPeso={productoPeso}
        parametros={parametros}
        capacidadProcesos={capacidadProcesos}
        canEdit={canEdit}
        onCreateProceso={onCreateProceso}
        onUpdateProceso={onUpdateProceso}
        onDeactivateProceso={onDeactivateProceso}
        currentUser={currentUser}
      />

      <InfraestructuraSection
        infraestructura={infraestructura}
        parametros={parametros}
        canEdit={canEdit}
        onCreateInfra={onCreateInfra}
        onUpdateInfra={onUpdateInfra}
        onDeactivateInfra={onDeactivateInfra}
        currentUser={currentUser}
      />
    </div>
  );
}
