import { useMemo, useState } from "react";
import { buildHorizonte, ETAPAS_CICLO, getFechaLimite, formatMoney, LINEAS } from "./sopHelpers";
import { canApproveSopEtapa, isStrategicTeamMember } from "../../services/permissionsService";

const ESTADO_STYLE = {
  Abierto: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", card: "border-emerald-200", header: "bg-emerald-50/60", dot: "bg-emerald-400" },
  Cerrado: { badge: "border-slate-300 bg-slate-100 text-slate-600", card: "border-slate-200", header: "bg-slate-50", dot: "bg-slate-400" },
  Ejecutivo: { badge: "border-amber-200 bg-amber-50 text-amber-700", card: "border-amber-200", header: "bg-amber-50/60", dot: "bg-amber-400" },
};

const FIRMA_STYLE = {
  Pendiente: { badge: "border-slate-300 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  Aprobado: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  Rechazado: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

// Una etapa se habilita cuando la anterior quedó Aprobada — así el flujo
// respeta el orden del BPMN VEN-SP-03 (Comercial → Operativo → Financiero →
// Ejecutivo) sin necesitar un motor de estados aparte: simplemente no se
// deja aprobar una etapa fuera de turno.
function isHabilitada(etapaKey, firmasPorEtapa) {
  if (etapaKey === "comercial") return true;
  if (etapaKey === "operativo") return firmasPorEtapa.comercial?.estado === "Aprobado";
  if (etapaKey === "financiero") return firmasPorEtapa.operativo?.estado === "Aprobado";
  if (etapaKey === "ejecutivo") {
    return ["comercial", "operativo", "financiero"].every((k) => firmasPorEtapa[k]?.estado === "Aprobado");
  }
  return false;
}

function AlertaLiderForm({ etapa, personasCatalogo, onEnviar, onCancel }) {
  const [personaId, setPersonaId] = useState("");
  const [mensaje, setMensaje] = useState(`Falta información o una acción pendiente en ${etapa.label.toLowerCase()} del ciclo S&OP.`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleEnviar() {
    if (!personaId) {
      setError("Selecciona a quién se le avisa.");
      return;
    }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onEnviar({ personaId: Number(personaId), personaNombre: persona?.nombre || "", mensaje });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
      <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none">
        <option value="">Selecciona a quién avisar...</option>
        {personasCatalogo.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>
      <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={handleEnviar} className="rounded-lg bg-sky-600 px-3 py-1 text-[9px] font-black text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Enviando..." : "Enviar a asignaciones"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[9px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="text-[9px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

function FirmaCard({ etapa, firma, habilitada, canApprove, onAction, isEquipoEstrategico, personasCatalogo, onAlertaLider }) {
  const estado = firma?.estado || "Pendiente";
  const estilo = FIRMA_STYLE[estado];
  const fechaLimite = getFechaLimite(firma?.anio, firma?.mes, etapa.key);
  const hoy = new Date();
  const vencido = estado !== "Aprobado" && fechaLimite && hoy > fechaLimite;
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [alertando, setAlertando] = useState(false);

  return (
    <div className={`rounded-xl border p-3 ${vencido ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{etapa.label}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${estilo.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${estilo.dot}`} />
          {estado}
        </span>
      </div>
      <p className="mt-1.5 text-[9px] font-bold normal-case tracking-normal text-slate-400">
        Límite: <b className="text-slate-600">{fechaLimite ? fechaLimite.toLocaleDateString("es-MX") : "—"}</b>
        {vencido && <span className="ml-1 font-black text-red-600">VENCIDO</span>}
      </p>
      {firma?.fecha && (
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          {estado === "Rechazado" ? "Rechazado" : "Aprobado"} el {new Date(firma.fecha).toLocaleDateString("es-MX")} por <b className="text-slate-600">{firma.usuario_nombre || "—"}</b>
        </p>
      )}
      {firma?.comentario && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-[9px] font-bold normal-case tracking-normal text-red-600">{firma.comentario}</p>}

      {!habilitada && estado !== "Aprobado" && (
        <p className="mt-2 text-[9px] font-bold normal-case tracking-normal text-slate-300">Se habilita cuando la etapa anterior esté aprobada.</p>
      )}

      {canApprove && habilitada && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {!comentando ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => onAction("Aprobado", "")} className="rounded-lg bg-emerald-600 px-3 py-1 text-[9px] font-black text-white hover:bg-emerald-700">
                Aprobar
              </button>
              <button type="button" onClick={() => setComentando(true)} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-[9px] font-black text-red-600 hover:bg-red-50">
                Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Motivo de la corrección solicitada..."
                rows={2}
                className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAction("Rechazado", comentario);
                    setComentando(false);
                    setComentario("");
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1 text-[9px] font-black text-white hover:bg-red-700"
                >
                  Confirmar rechazo
                </button>
                <button type="button" onClick={() => setComentando(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[9px] font-black text-slate-500">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isEquipoEstrategico && estado !== "Aprobado" && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {!alertando ? (
            <button type="button" onClick={() => setAlertando(true)} className="text-[9px] font-black text-sky-600 hover:underline">
              Enviar alerta a un líder →
            </button>
          ) : (
            <AlertaLiderForm etapa={etapa} personasCatalogo={personasCatalogo} onEnviar={onAlertaLider} onCancel={() => setAlertando(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// Primer elemento del flujo S&OP: de dónde parte todo el ciclo. La meta de
// venta ya se captura en Parámetros (meta_venta_anual) y se compara aquí
// contra lo ya cerrado en Histórico + lo planeado en el horizonte vigente
// para el año en curso — mismo cálculo que la tarjeta de Dashboard, para no
// mostrar dos números distintos del mismo dato. La meta de margen operativo
// es nueva (meta_margen_operativo_pct) y se compara contra el margen
// proyectado con los supuestos vigentes de Parámetros.
function MetasEstrategicasSection({ control, parametros, planVenta, productos, historico }) {
  const anioActual = new Date().getFullYear();
  const horizonte = buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6);
  const escenarioActivo = parametros?.escenario_venta || "Base";
  const productoMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const { ventaHorizonteTotal, porLineaMonto } = useMemo(() => {
    let total = 0;
    const porLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
    for (const row of planVenta) {
      if (row.escenario !== escenarioActivo) continue;
      const monthIndex = horizonte.findIndex((m) => m.anio === row.anio && m.mes === row.mes);
      if (monthIndex === -1) continue;
      const producto = productoMap.get(row.producto_id);
      if (!producto) continue;
      const monto = Number(row.piezas || 0) * Number(producto.precio || 0);
      total += monto;
      porLinea[producto.linea] += monto;
    }
    return { ventaHorizonteTotal: total, porLineaMonto: porLinea };
  }, [planVenta, escenarioActivo, horizonte, productoMap]);

  const ventaHorizonteAnio = useMemo(
    () => horizonte.reduce((sum, m, i) => {
      if (m.anio !== anioActual) return sum;
      let montoMes = 0;
      for (const row of planVenta) {
        if (row.escenario !== escenarioActivo || row.anio !== m.anio || row.mes !== m.mes) continue;
        const producto = productoMap.get(row.producto_id);
        if (!producto) continue;
        montoMes += Number(row.piezas || 0) * Number(producto.precio || 0);
      }
      return sum + montoMes;
    }, 0),
    [horizonte, planVenta, escenarioActivo, productoMap, anioActual]
  );
  const ventaCerradaAnio = historico
    .filter((h) => h.mes && Number(h.mes.slice(0, 4)) === anioActual)
    .reduce((sum, h) => sum + Number(h.venta_real || 0), 0);
  const ventaComprometidaAnio = ventaCerradaAnio + ventaHorizonteAnio;
  const metaVenta = Number(parametros?.meta_venta_anual || 0);
  const avanceVentaPct = metaVenta > 0 ? (ventaComprometidaAnio / metaVenta) * 100 : null;

  const margenBrutoMonto =
    Number(parametros?.margen_bruto_salas || 0) * porLineaMonto.Salas +
    Number(parametros?.margen_bruto_bases || 0) * porLineaMonto.Bases +
    Number(parametros?.margen_bruto_recamaras || 0) * porLineaMonto["Recámaras"];
  const gastosFijosTotal = Number(parametros?.gastos_fijos_mensuales || 0) * horizonte.length;
  const utilidadOperativaPct = ventaHorizonteTotal > 0 ? (margenBrutoMonto - gastosFijosTotal) / ventaHorizonteTotal : null;
  const metaMargen = parametros?.meta_margen_operativo_pct != null ? Number(parametros.meta_margen_operativo_pct) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#001225] bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-[#001225] px-4 py-2.5">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">Paso 1</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-white">Metas estratégicas — punto de partida del ciclo S&amp;OP</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Meta de venta {anioActual}</p>
          <p className="mt-1 text-lg font-black text-slate-900">{metaVenta > 0 ? formatMoney(metaVenta) : "Sin definir"}</p>
          {metaVenta > 0 ? (
            <p className="mt-0.5 text-[10px] font-bold text-slate-500">
              Comprometido: <b className="text-slate-700">{formatMoney(ventaComprometidaAnio)}</b> ({avanceVentaPct.toFixed(1)}%)
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] font-bold text-slate-400">Captúrala en Parámetros → Márgenes y finanzas.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Meta de margen operativo</p>
          <p className="mt-1 text-lg font-black text-slate-900">{metaMargen != null ? `${(metaMargen * 100).toFixed(1)}%` : "Sin definir"}</p>
          {metaMargen != null && utilidadOperativaPct != null ? (
            <p className="mt-0.5 text-[10px] font-bold text-slate-500">
              Proyectado con supuestos vigentes: <b className={utilidadOperativaPct >= metaMargen ? "text-emerald-600" : "text-red-600"}>{(utilidadOperativaPct * 100).toFixed(1)}%</b>
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] font-bold text-slate-400">Captúrala en Parámetros → Márgenes y finanzas.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CicloFirmasSection({ control, firmas, currentUser, personasCatalogo, onUpsertFirma, onResetFirmas, onAlertaLider }) {
  const anio = control?.mes_activo ? Number(control.mes_activo.slice(0, 4)) : null;
  const mes = control?.mes_activo ? Number(control.mes_activo.slice(5, 7)) : null;
  const equipoEstrategico = isStrategicTeamMember(currentUser);
  const [resetting, setResetting] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);

  const firmasPorEtapa = Object.fromEntries(ETAPAS_CICLO.map((e) => [e.key, { ...firmas.find((f) => f.etapa === e.key), anio, mes }]));

  async function handleReset() {
    setResetting(true);
    await onResetFirmas(anio, mes);
    setResetting(false);
    setConfirmandoReset(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 bg-amber-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Ciclo de firmas del mes activo (VEN-SP-03)</p>
        </div>
        {equipoEstrategico && anio && mes && (
          confirmandoReset ? (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-amber-700">¿Reiniciar las 4 etapas a Pendiente?</span>
              <button type="button" disabled={resetting} onClick={handleReset} className="rounded-lg bg-red-600 px-2.5 py-1 text-[9px] font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {resetting ? "Reiniciando..." : "Confirmar"}
              </button>
              <button type="button" onClick={() => setConfirmandoReset(false)} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[9px] font-black text-amber-700">Cancelar</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmandoReset(true)} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[9px] font-black text-amber-700 hover:bg-amber-100">
              Reiniciar ciclo de firmas
            </button>
          )
        )}
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Validación secuencial Comercial → Operativa → Financiera → Alineación integral, con fecha límite por etapa. Si Dirección rechaza la reunión ejecutiva, las tres validaciones vuelven a Pendiente para reajustar la propuesta.
          {equipoEstrategico && " El reinicio (solo equipo estratégico) limpia las 4 etapas a Pendiente y deja listo el ciclo del mes siguiente en el sistema."}
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {ETAPAS_CICLO.map((etapa) => (
            <FirmaCard
              key={etapa.key}
              etapa={etapa}
              firma={firmasPorEtapa[etapa.key]}
              habilitada={isHabilitada(etapa.key, firmasPorEtapa)}
              canApprove={anio && mes && canApproveSopEtapa(currentUser, etapa.key)}
              onAction={(estado, comentario) => onUpsertFirma(anio, mes, etapa.key, estado, comentario)}
              isEquipoEstrategico={equipoEstrategico}
              personasCatalogo={personasCatalogo}
              onAlertaLider={(payload) => onAlertaLider(etapa, payload, currentUser)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ControlTab({
  control,
  canEdit,
  onSave,
  firmas = [],
  currentUser,
  personasCatalogo = [],
  onUpsertFirma,
  onResetFirmas,
  onAlertaLider,
  parametros,
  planVenta = [],
  productos = [],
  historico = [],
}) {
  // El <input type="month"> solo acepta/devuelve "AAAA-MM", pero la columna
  // en Supabase es tipo date ("AAAA-MM-DD") — hay que recortar al mostrar y
  // completar con "-01" al guardar, o el guardado falla (fecha inválida) y
  // el selector se ve en blanco al cargar.
  const [draft, setDraft] = useState(() => ({
    mes_activo: control?.mes_activo?.slice(0, 7) || "",
    horizonte_meses: control?.horizonte_meses || 6,
    estado: control?.estado || "Abierto",
  }));
  const [saving, setSaving] = useState(false);

  if (!control) return <div className="p-6 text-center text-[11px] font-bold text-slate-300">Cargando control S&OP...</div>;

  const horizonte = buildHorizonte(draft.mes_activo, draft.horizonte_meses);
  const dirty =
    draft.mes_activo !== control.mes_activo?.slice(0, 7) ||
    draft.horizonte_meses !== control.horizonte_meses ||
    draft.estado !== control.estado;
  const estilo = ESTADO_STYLE[control.estado] || ESTADO_STYLE.Abierto;

  // Solo se mandan los campos que realmente cambiaron en ESTA sesion (no
  // todo el draft): si esta pestana quedo abierta con datos viejos en cache
  // y se guarda un cambio que no toca mes_activo, no queremos pisar el mes
  // activo real con el valor viejo que traia el draft desde que cargo la
  // pagina. Ya paso varias veces por accidente.
  async function handleSave() {
    setSaving(true);
    const payload = {};
    if (draft.mes_activo !== control.mes_activo?.slice(0, 7)) {
      payload.mes_activo = draft.mes_activo ? `${draft.mes_activo}-01` : null;
    }
    if (draft.horizonte_meses !== control.horizonte_meses) payload.horizonte_meses = draft.horizonte_meses;
    if (draft.estado !== control.estado) payload.estado = draft.estado;
    await onSave(control.id, payload);
    setSaving(false);
  }

  return (
    <div className="space-y-3 p-3">
      <MetasEstrategicasSection control={control} parametros={parametros} planVenta={planVenta} productos={productos} historico={historico} />

      <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${estilo.card}`}>
        <div className={`flex items-center gap-2 px-4 py-2.5 ${estilo.header}`}>
          <span className={`h-2 w-2 rounded-full ${estilo.dot}`} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Control del ciclo S&amp;OP — horizonte rolado</p>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Mes activo (primer mes visible)
              <input
                type="month"
                disabled={!canEdit}
                value={draft.mes_activo}
                onChange={(e) => setDraft((c) => ({ ...c, mes_activo: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-sky-200 bg-sky-50/40 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-sky-400 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Horizonte visible (meses)
              <input
                type="number"
                min="1"
                max="12"
                disabled={!canEdit}
                value={draft.horizonte_meses}
                onChange={(e) => setDraft((c) => ({ ...c, horizonte_meses: Number(e.target.value) }))}
                className="mt-1 h-10 w-full rounded-xl border border-sky-200 bg-sky-50/40 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-sky-400 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Estado del ciclo
              <select
                disabled={!canEdit}
                value={draft.estado}
                onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-sky-200 bg-sky-50/40 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-sky-400 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="Abierto">Abierto</option>
                <option value="Cerrado">Cerrado</option>
                <option value="Ejecutivo">Ejecutivo</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${estilo.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${estilo.dot}`} />
              {control.estado}
            </span>
            {control.ultimo_mes_cerrado && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Último mes cerrado: <b className="text-slate-700">{control.ultimo_mes_cerrado}</b></span>
            )}
            {control.usuario_responsable_nombre && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Responsable: <b className="text-slate-700">{control.usuario_responsable_nombre}</b></span>
            )}
            {control.fecha_actualizacion && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Actualizado: <b className="text-slate-700">{new Date(control.fecha_actualizacion).toLocaleString("es-MX")}</b></span>
            )}
          </div>

          {canEdit && dirty && (
            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white transition hover:bg-[#001a38] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </div>

      <CicloFirmasSection
        control={control}
        firmas={firmas}
        currentUser={currentUser}
        personasCatalogo={personasCatalogo}
        onUpsertFirma={onUpsertFirma}
        onResetFirmas={onResetFirmas}
        onAlertaLider={onAlertaLider}
      />

      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-sky-50/60 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Horizonte visible actual</p>
        </div>
        <div className="flex flex-wrap gap-1.5 p-4">
          {horizonte.map((m, i) => (
            <span key={i} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-700">{m.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
