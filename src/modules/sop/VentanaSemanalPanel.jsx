import { useEffect, useState } from "react";
import { getVentana, upsertVentana } from "../../services/sopVentanaSemanalService";

// Campos por pestaña — breves, pensados para llenarse en la junta de
// alineación S&OP de cada martes con la visibilidad real que sí se tiene de
// la semana siguiente (no del mes completo, mientras el ciclo mensual madura).
const CAMPOS_POR_PESTANA = {
  dashboard: {
    titulo: "Resumen semanal",
    campos: [
      { key: "ventas_esperadas", label: "Ventas esperadas (piezas)", tipo: "number" },
      { key: "confianza", label: "Confianza del dato", tipo: "select", opciones: ["Dato duro (pedidos en firme)", "Estimado"] },
      { key: "riesgos", label: "Riesgos / comentario breve", tipo: "textarea" },
    ],
  },
  "plan-venta": {
    titulo: "Compromiso de venta",
    campos: [
      { key: "piezas_comprometidas", label: "Piezas comprometidas", tipo: "number" },
      { key: "fuente", label: "Fuente del dato", tipo: "select", opciones: ["Pedidos en firme", "Estimado / proyección"] },
      { key: "comentario", label: "Comentario breve", tipo: "textarea" },
    ],
  },
  operacion: {
    titulo: "Capacidad vs. demanda",
    campos: [
      { key: "capacidad_disponible_horas", label: "Capacidad disponible (h-hombre)", tipo: "number" },
      { key: "carga_comprometida_horas", label: "Carga comprometida (h-hombre)", tipo: "number" },
      { key: "cuellos_botella", label: "Cuellos de botella esperados", tipo: "textarea" },
    ],
  },
  financiero: {
    titulo: "Flujo esperado",
    campos: [
      { key: "flujo_esperado", label: "Flujo de efectivo esperado ($)", tipo: "number" },
      { key: "gasto_comprometido", label: "Gasto comprometido ($)", tipo: "number" },
      { key: "comentario", label: "Comentario breve", tipo: "textarea" },
    ],
  },
  decisiones: {
    titulo: "Decisiones pendientes para la junta",
    campos: [
      { key: "decision_pendiente", label: "Decisión / acuerdo a resolver", tipo: "textarea" },
      { key: "responsable", label: "Responsable", tipo: "text" },
      { key: "urgencia", label: "Urgencia", tipo: "select", opciones: ["Alta", "Media", "Baja"] },
    ],
  },
};

function getProximoLunes() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=domingo ... 1=lunes ... 6=sábado
  const diasHastaLunes = dia === 1 ? 7 : ((8 - dia) % 7) || 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diasHastaLunes);
  return lunes;
}

function formatFecha(date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Reemplaza, mientras está activa la "Vista semanal" del módulo, el
// contenido normal (mensual) de la pestaña — no se muestran ambos a la vez,
// para no duplicar el dato mientras el ciclo mensual sigue incompleto.
export default function VentanaSemanalPanel({ pestana, currentUser }) {
  const config = CAMPOS_POR_PESTANA[pestana];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState(null);
  const [valores, setValores] = useState({});

  const lunes = getProximoLunes();
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const semanaLunes = toISODate(lunes);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVentana(pestana, semanaLunes).then((result) => {
      if (cancelled) return;
      setValores(result?.data?.datos || {});
      setGuardadoEn(result?.data?.updated_at || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [pestana, semanaLunes]);

  if (!config) return null;

  async function handleGuardar() {
    setSaving(true);
    const result = await upsertVentana({ pestana, semanaLunes, datos: valores }, { actor: currentUser });
    setSaving(false);
    if (result?.ok) setGuardadoEn(result.data?.updated_at || new Date().toISOString());
  }

  return (
    <div className="p-3">
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-600 px-4 py-2.5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Vista semanal · semana del {formatFecha(lunes)} al {formatFecha(viernes)}</p>
            <p className="text-sm font-black text-white">{config.titulo}</p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white">
            Junta de alineación · martes
          </span>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {loading ? (
            <p className="text-[11px] font-bold text-slate-300">Cargando…</p>
          ) : (
            config.campos.map((campo) => (
              <label
                key={campo.key}
                className={`text-[10px] font-black uppercase tracking-widest text-slate-400 ${campo.tipo === "textarea" ? "md:col-span-3" : ""}`}
              >
                {campo.label}
                {campo.tipo === "textarea" ? (
                  <textarea
                    value={valores[campo.key] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.key]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-[11px] font-semibold normal-case tracking-normal text-slate-700 outline-none"
                  />
                ) : campo.tipo === "select" ? (
                  <select
                    value={valores[campo.key] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.key]: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                  >
                    <option value="">Selecciona…</option>
                    {campo.opciones.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                ) : (
                  <input
                    type={campo.tipo === "number" ? "number" : "text"}
                    value={valores[campo.key] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.key]: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                  />
                )}
              </label>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
          {guardadoEn && <span className="text-[9px] font-bold text-slate-300">Guardado</span>}
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleGuardar}
            className="h-9 rounded-lg bg-[#001225] px-4 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
