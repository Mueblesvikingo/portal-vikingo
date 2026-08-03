import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getCompetenciaById, getSeguimientoByPersona, upsertSeguimientoNivel } from "../../services/competenciasService";
import { getPersonas } from "../../services/organizationCatalogService";
import { isStrategicTeamMember } from "../../services/permissionsService";

function Bullets({ text }) {
  const items = (text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (items.length === 0) return <p className="text-[11px] font-bold text-slate-300">Sin definir.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-[12px] font-bold leading-snug text-slate-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          {item}
        </li>
      ))}
    </ul>
  );
}

const NIVEL_LABELS = ["Sabe", "Sabe cómo", "Muestra cómo", "Hace"];

export default function CompetenciaDetailPage({ currentUser }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const personaId = searchParams.get("persona") ? Number(searchParams.get("persona")) : null;

  const [competencia, setCompetencia] = useState(null);
  const [persona, setPersona] = useState(null);
  const [nivelActual, setNivelActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [competenciaData, seguimiento, personas] = await Promise.all([
        getCompetenciaById(id),
        personaId ? getSeguimientoByPersona(personaId, id) : Promise.resolve(null),
        personaId ? getPersonas() : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setCompetencia(competenciaData);
      setNivelActual(seguimiento?.nivel_actual || 0);
      setPersona(personaId ? personas.find((p) => p.id === personaId) || null : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, personaId]);

  const canEdit = useMemo(() => {
    if (!personaId) return false;
    if (isStrategicTeamMember(currentUser)) return true;
    return Number(currentUser?.persona_id) === personaId;
  }, [currentUser, personaId]);

  async function handleSetNivel(nextNivel) {
    if (!canEdit || saving) return;
    const target = nextNivel === nivelActual ? nextNivel - 1 : nextNivel;
    setSaving(true);
    setNivelActual(target);
    const result = await upsertSeguimientoNivel(personaId, Number(id), target, currentUser);
    if (!result?.ok) {
      console.error(result?.error);
      setNivelActual(nivelActual);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-[12px] font-bold text-slate-400">Cargando competencia...</div>;
  }

  if (!competencia) {
    return <div className="flex min-h-[60vh] items-center justify-center text-[12px] font-bold text-slate-400">No se encontró la competencia.</div>;
  }

  const niveles = [competencia.nivel_1, competencia.nivel_2, competencia.nivel_3, competencia.nivel_4];
  const progreso = Math.round((nivelActual / 4) * 100);
  const tipoLabel = competencia.tipo === "tecnica" ? "Competencia técnica" : "Competencia blanda";
  const tipoColor = competencia.tipo === "tecnica" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-violet-200 bg-violet-50 text-violet-700";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${tipoColor}`}>{tipoLabel}</span>
        <h1 className="mt-2 text-xl font-black text-slate-900">{competencia.nombre}</h1>
        {competencia.proposito && <p className="mt-2 text-[12px] font-bold leading-relaxed text-slate-500">{competencia.proposito}</p>}
      </div>

      {personaId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seguimiento de cumplimiento</p>
              <p className="text-[13px] font-black text-slate-800">{persona?.nombre || "Persona"}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900">{progreso}%</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Avance</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>

          <div className="mt-4 space-y-2">
            {niveles.map((texto, index) => {
              const nivelNum = index + 1;
              const achieved = nivelActual >= nivelNum;
              return (
                <button
                  key={nivelNum}
                  type="button"
                  disabled={!canEdit || saving || !texto}
                  onClick={() => handleSetNivel(nivelNum)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                    achieved ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                  } ${canEdit && texto ? "cursor-pointer hover:border-emerald-300" : "cursor-default"}`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${
                      achieved ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-slate-400"
                    }`}
                  >
                    {achieved ? "✓" : nivelNum}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Nivel {nivelNum} · {NIVEL_LABELS[index]}
                    </span>
                    <span className="block text-[12px] font-bold leading-snug text-slate-700">{texto || "Sin definir para esta competencia."}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {!canEdit && <p className="mt-3 text-[10px] font-bold text-slate-400">Solo la persona evaluada o el equipo estratégico pueden actualizar el avance.</p>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Criterios observables</p>
          <div className="mt-2">
            <Bullets text={competencia.criterios_observables} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evidencias objetivas aprobadas</p>
          <div className="mt-2">
            <Bullets text={competencia.evidencias} />
          </div>
        </div>
      </div>

      {!personaId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Niveles (Pirámide de Miller)</p>
          <div className="mt-2 space-y-2">
            {niveles.map((texto, index) => (
              <div key={index} className="flex items-start gap-2 text-[12px] font-bold leading-snug text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-black text-slate-400">{index + 1}</span>
                <span>
                  <span className="mr-1 font-black text-slate-500">{NIVEL_LABELS[index]}:</span>
                  {texto || "Sin definir para esta competencia."}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {competencia.alineacion_estrategica && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alineación estratégica</p>
          <p className="mt-1.5 text-[12px] font-bold leading-relaxed text-slate-600">{competencia.alineacion_estrategica}</p>
        </div>
      )}
    </div>
  );
}
