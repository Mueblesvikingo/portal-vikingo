import React, { useEffect, useState } from "react";
import {
  updateAuditoria, getHallazgos, upsertHallazgo, downloadFichaAuditoriaPdf, FICHA_FIRMAS_CLEAR,
  firmarFichaComoCoordinador, firmarFichaComoDirector, firmarFichaComoAuditado,
} from "../../services/auditoriasService";
import { isDirectorGeneral } from "../../services/permissionsService";
import { sigSections, cellStyle, scoreMeaning, cleanSubtitle, resolveProceso, COORDINADOR_SIG_PERSONA_ID } from "./SigDiagnosisModule";

const DECLARACIONES = ["Cumple", "Cumple parcialmente", "No cumple"];
const NIVELES = [0, 3, 5, 10];

function findCriterioTexto(numeral, subtitulo, numero) {
  const section = sigSections.find((s) => s.numeral === numeral);
  const group = section?.groups.find((g) => g.subtitle === subtitulo);
  const row = group?.rows.find((r) => r[0] === numero);
  if (!row) return { texto: "Criterio no encontrado en el catálogo actual.", evidenciaEsperada: "", proceso: "" };
  return { texto: row[1], evidenciaEsperada: row[2], proceso: row[3] };
}

export default function AuditoriaFichaPanel({ auditoria, currentUser, canEdit, onUpdated }) {
  const [hallazgos, setHallazgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cierre, setCierre] = useState({
    conclusiones: auditoria.conclusiones || "",
    declaracion_cumplimiento: auditoria.declaracion_cumplimiento || "",
    opiniones_divergentes: auditoria.opiniones_divergentes || "",
    plan_seguimiento: auditoria.plan_seguimiento || "",
    fecha_seguimiento_sugerida: auditoria.fecha_seguimiento_sugerida || "",
  });
  const [savingHallazgoKey, setSavingHallazgoKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHallazgos(auditoria.id).then((data) => {
      if (!cancelled) { setHallazgos(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [auditoria.id]);

  const criterios = (auditoria.criterios || []).map((c) => {
    const { texto, evidenciaEsperada, proceso } = findCriterioTexto(c.numeral, c.subtitulo, c.numero);
    const hallazgo = hallazgos.find((h) => h.numeral === c.numeral && h.subtitulo === c.subtitulo && h.numero === c.numero);
    return {
      ...c,
      tag: `${c.subtitulo.split(" ")[0]} · #${c.numero}`,
      texto,
      evidenciaEsperada,
      proceso: resolveProceso(proceso, auditoria.macroproceso),
      nivelConfirmado: hallazgo?.nivel_confirmado ?? null,
      evidenciaObservada: hallazgo?.evidencia_observada || "",
    };
  });

  async function handleNivel(criterio, nivel) {
    const key = `${criterio.numeral}::${criterio.subtitulo}::${criterio.numero}`;
    setSavingHallazgoKey(key);
    const result = await upsertHallazgo(
      auditoria.id,
      { numeral: criterio.numeral, subtitulo: criterio.subtitulo, numero: criterio.numero, proceso: criterio.proceso },
      { nivel, evidencia: criterio.evidenciaObservada },
      currentUser
    );
    setSavingHallazgoKey(null);
    if (!result.ok) { console.error(result.error); alert("No fue posible guardar el hallazgo."); return; }
    setHallazgos((current) => {
      const otros = current.filter((h) => !(h.numeral === criterio.numeral && h.subtitulo === criterio.subtitulo && h.numero === criterio.numero));
      return [...otros, result.data];
    });
  }

  async function handleEvidenciaBlur(criterio, value) {
    if (value === (criterio.evidenciaObservada || "")) return;
    const result = await upsertHallazgo(
      auditoria.id,
      { numeral: criterio.numeral, subtitulo: criterio.subtitulo, numero: criterio.numero, proceso: criterio.proceso },
      { nivel: criterio.nivelConfirmado, evidencia: value },
      currentUser
    );
    if (!result.ok) { console.error(result.error); return; }
    setHallazgos((current) => {
      const otros = current.filter((h) => !(h.numeral === criterio.numeral && h.subtitulo === criterio.subtitulo && h.numero === criterio.numero));
      return [...otros, result.data];
    });
  }

  async function handleCierreBlur(field, value) {
    if (value === (auditoria[field] || "")) return;
    const result = await updateAuditoria(auditoria.id, { [field]: value || null, ...FICHA_FIRMAS_CLEAR });
    if (!result.ok) { console.error(result.error); return; }
    onUpdated(result.data);
  }

  function handlePlanFieldBlur(field, value) {
    if (value === (auditoria[field] || "")) return;
    updateAuditoria(auditoria.id, { [field]: value || null, ...FICHA_FIRMAS_CLEAR }).then((result) => {
      if (!result.ok) { console.error(result.error); return; }
      onUpdated(result.data);
    });
  }

  async function handleFirmar(firmarFn) {
    const result = await firmarFn(auditoria.id, currentUser);
    if (!result.ok) { console.error(result.error); alert(typeof result.error === "string" ? result.error : "No fue posible registrar la firma."); return; }
    onUpdated(result.data);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-800">Ficha de auditoría — {auditoria.macroproceso}</div>
        <button type="button" onClick={() => downloadFichaAuditoriaPdf(auditoria, criterios)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 hover:border-slate-300">↓ PDF</button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Auditado
          <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">{auditoria.auditado?.nombre || "Sin asignar"}</div>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Modalidad y lugar
          <input
            type="text"
            defaultValue={auditoria.modalidad_lugar || ""}
            disabled={!canEdit}
            onBlur={(e) => handlePlanFieldBlur("modalidad_lugar", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50"
          />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Auditor líder
          <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">{auditoria.auditor_lider?.nombre || "Sin asignar"}</div>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-3">
          Alcance
          <textarea
            rows={2}
            defaultValue={auditoria.alcance || ""}
            disabled={!canEdit}
            onBlur={(e) => handlePlanFieldBlur("alcance", e.target.value)}
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50"
          />
        </label>
      </div>

      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Criterios y hallazgos (ISO 19011 §6.5 f-g)</div>
        {loading ? (
          <div className="mt-2 text-[11px] font-bold text-slate-400">Cargando hallazgos…</div>
        ) : criterios.length === 0 ? (
          <div className="mt-2 text-[11px] font-bold text-slate-300">Esta auditoría no tiene criterios seleccionados.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {criterios.map((c) => {
              const key = `${c.numeral}::${c.subtitulo}::${c.numero}`;
              return (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="max-w-[520px] text-[11px] font-semibold text-slate-700">
                      <span className="font-black text-slate-500">{cleanSubtitle(c.subtitulo)} · #{c.numero}</span> — {c.texto}
                      <div className="mt-0.5 text-[10px] font-medium italic text-slate-400">Evidencia esperada: {c.evidenciaEsperada || "—"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {NIVELES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={!canEdit || savingHallazgoKey === key}
                          onClick={() => handleNivel(c, n)}
                          className={`h-7 w-9 rounded-lg text-[11px] font-black transition ${c.nivelConfirmado === n ? cellStyle(n) + " ring-2 ring-offset-1 ring-slate-300" : "bg-white text-slate-400 ring-1 ring-slate-200 hover:bg-slate-100"}`}
                          title={scoreMeaning(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    defaultValue={c.evidenciaObservada}
                    disabled={!canEdit}
                    placeholder="Evidencia observada durante la auditoría..."
                    onBlur={(e) => handleEvidenciaBlur(c, e.target.value)}
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 outline-none disabled:bg-slate-50"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Conclusiones (h)
          <textarea rows={2} defaultValue={cierre.conclusiones} disabled={!canEdit} onBlur={(e) => { setCierre((c) => ({ ...c, conclusiones: e.target.value })); handleCierreBlur("conclusiones", e.target.value); }} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Declaración del grado de cumplimiento (i)
          <select defaultValue={cierre.declaracion_cumplimiento} disabled={!canEdit} onChange={(e) => { setCierre((c) => ({ ...c, declaracion_cumplimiento: e.target.value })); handleCierreBlur("declaracion_cumplimiento", e.target.value); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50">
            <option value="">Sin definir</option>
            {DECLARACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Opiniones divergentes no resueltas (j)
          <textarea rows={2} defaultValue={cierre.opiniones_divergentes} disabled={!canEdit} placeholder="Ninguna" onBlur={(e) => { setCierre((c) => ({ ...c, opiniones_divergentes: e.target.value })); handleCierreBlur("opiniones_divergentes", e.target.value); }} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Plan de seguimiento (k)
          <textarea rows={2} defaultValue={cierre.plan_seguimiento} disabled={!canEdit} onBlur={(e) => { setCierre((c) => ({ ...c, plan_seguimiento: e.target.value })); handleCierreBlur("plan_seguimiento", e.target.value); }} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Fecha sugerida de seguimiento
          <input type="date" defaultValue={cierre.fecha_seguimiento_sugerida} disabled={!canEdit} onChange={(e) => { setCierre((c) => ({ ...c, fecha_seguimiento_sugerida: e.target.value })); handleCierreBlur("fecha_seguimiento_sugerida", e.target.value); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:bg-slate-50" />
        </label>
      </div>

      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firmas</div>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {[
            {
              rol: "Coordinador SIG",
              nombre: auditoria.firmado_coordinador_nombre,
              fecha: auditoria.firmado_coordinador_at,
              puedeFirmar: Number(currentUser?.persona_id) === COORDINADOR_SIG_PERSONA_ID,
              onFirmar: () => handleFirmar(firmarFichaComoCoordinador),
            },
            {
              rol: "Director General",
              nombre: auditoria.firmado_director_nombre,
              fecha: auditoria.firmado_director_at,
              puedeFirmar: isDirectorGeneral(currentUser),
              onFirmar: () => handleFirmar(firmarFichaComoDirector),
            },
            {
              rol: "Auditado",
              nombre: auditoria.firmado_auditado_nombre,
              fecha: auditoria.firmado_auditado_at,
              puedeFirmar: Boolean(auditoria.auditado_persona_id) && Number(currentUser?.persona_id) === Number(auditoria.auditado_persona_id),
              onFirmar: () => handleFirmar(firmarFichaComoAuditado),
            },
          ].map((f) => (
            <div key={f.rol} className={`rounded-2xl border p-3 ${f.nombre ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.rol}</div>
                {f.nombre ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">✓ Firmado</span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">Pendiente</span>
                )}
              </div>
              {f.nombre ? (
                <div className="mt-1 text-[11px] font-bold text-slate-700">
                  {f.nombre} <span className="font-medium text-slate-400">· {new Date(f.fecha).toLocaleDateString("es-MX")}</span>
                </div>
              ) : f.puedeFirmar ? (
                <button type="button" onClick={f.onFirmar} className="mt-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">Firmar</button>
              ) : (
                <div className="mt-1 text-[11px] font-medium text-slate-400">Sin firmar</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
