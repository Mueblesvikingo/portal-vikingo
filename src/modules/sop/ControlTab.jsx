import { useState } from "react";
import { buildHorizonte, ETAPAS_CICLO, getFechaLimite } from "./sopHelpers";
import { canApproveSopEtapa } from "../../services/permissionsService";

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

function FirmaCard({ etapa, firma, habilitada, canApprove, onAction }) {
  const estado = firma?.estado || "Pendiente";
  const estilo = FIRMA_STYLE[estado];
  const fechaLimite = getFechaLimite(firma?.anio, firma?.mes, etapa.key);
  const hoy = new Date();
  const vencido = estado !== "Aprobado" && fechaLimite && hoy > fechaLimite;
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");

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
    </div>
  );
}

function CicloFirmasSection({ control, firmas, currentUser, onUpsertFirma }) {
  const anio = control?.mes_activo ? Number(control.mes_activo.slice(0, 4)) : null;
  const mes = control?.mes_activo ? Number(control.mes_activo.slice(5, 7)) : null;

  const firmasPorEtapa = Object.fromEntries(ETAPAS_CICLO.map((e) => [e.key, { ...firmas.find((f) => f.etapa === e.key), anio, mes }]));

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-amber-50/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Ciclo de firmas del mes activo (VEN-SP-03)</p>
      </div>
      <div className="p-4">
        <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
          Validación secuencial Comercial → Operativa → Financiera → Alineación integral, con fecha límite por etapa. Si Dirección rechaza la reunión ejecutiva, las tres validaciones vuelven a Pendiente para reajustar la propuesta.
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ControlTab({ control, canEdit, onSave, firmas = [], currentUser, onUpsertFirma }) {
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
  const [consultaMes, setConsultaMes] = useState("");

  if (!control) return <div className="p-6 text-center text-[11px] font-bold text-slate-300">Cargando control S&OP...</div>;

  const horizonte = buildHorizonte(draft.mes_activo, draft.horizonte_meses);
  const horizonteConsulta = buildHorizonte(consultaMes, draft.horizonte_meses);
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

      <CicloFirmasSection control={control} firmas={firmas} currentUser={currentUser} onUpsertFirma={onUpsertFirma} />

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

      <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-violet-50/60 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Consultar otro horizonte</p>
        </div>
        <div className="p-4">
          <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
            Solo para ver qué meses caerían en el horizonte a partir de otro mes — no cambia el ciclo real ni requiere guardar.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Mes de inicio a consultar
              <input
                type="month"
                value={consultaMes}
                onChange={(e) => setConsultaMes(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-violet-200 bg-violet-50/40 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-violet-400"
              />
            </label>
            {consultaMes && (
              <button type="button" onClick={() => setConsultaMes("")} className="h-10 rounded-xl border border-violet-200 bg-white px-3 text-[10px] font-black text-violet-600 hover:bg-violet-50">
                Limpiar
              </button>
            )}
          </div>
          {consultaMes && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-violet-100 pt-3">
              {horizonteConsulta.map((m, i) => (
                <span key={i} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-700">{m.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
