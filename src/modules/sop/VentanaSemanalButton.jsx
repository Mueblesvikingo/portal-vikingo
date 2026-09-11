import { useEffect, useState } from "react";
import { getVentana, upsertVentana } from "../../services/sopVentanaSemanalService";

// Campos por pestaña — breves, uno por línea, pensados para llenarse en la
// junta de alineación del martes con la visibilidad real que sí se tiene de
// la semana siguiente (no del mes completo).
const CAMPOS_POR_PESTANA = {
  dashboard: {
    titulo: "Resumen semanal — Dashboard",
    campos: [
      { key: "ventas_esperadas", label: "Ventas esperadas (piezas)", tipo: "number" },
      { key: "confianza", label: "Confianza del dato", tipo: "select", opciones: ["Dato duro (pedidos en firme)", "Estimado"] },
      { key: "riesgos", label: "Riesgos / comentario breve", tipo: "textarea" },
    ],
  },
  "plan-venta": {
    titulo: "Compromiso de venta — semana siguiente",
    campos: [
      { key: "piezas_comprometidas", label: "Piezas comprometidas", tipo: "number" },
      { key: "fuente", label: "Fuente del dato", tipo: "select", opciones: ["Pedidos en firme", "Estimado / proyección"] },
      { key: "comentario", label: "Comentario breve", tipo: "textarea" },
    ],
  },
  operacion: {
    titulo: "Capacidad vs. demanda — semana siguiente",
    campos: [
      { key: "capacidad_disponible_horas", label: "Capacidad disponible (h-hombre)", tipo: "number" },
      { key: "carga_comprometida_horas", label: "Carga comprometida (h-hombre)", tipo: "number" },
      { key: "cuellos_botella", label: "Cuellos de botella esperados", tipo: "textarea" },
    ],
  },
  financiero: {
    titulo: "Flujo esperado — semana siguiente",
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

export default function VentanaSemanalButton({ pestana, currentUser }) {
  const config = CAMPOS_POR_PESTANA[pestana];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [valores, setValores] = useState({});

  const lunes = getProximoLunes();
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const semanaLunes = toISODate(lunes);

  useEffect(() => {
    if (!open || !config) return;
    let cancelled = false;
    setLoading(true);
    getVentana(pestana, semanaLunes).then((result) => {
      if (cancelled) return;
      setValores(result?.data?.datos || {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, pestana, semanaLunes, config]);

  if (!config) return null;

  async function handleGuardar() {
    setSaving(true);
    const result = await upsertVentana({ pestana, semanaLunes, datos: valores }, { actor: currentUser });
    setSaving(false);
    if (result?.ok) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Vista rápida de la semana siguiente — junta de alineación S&OP de cada martes"
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100"
      >
        📅 Ventana semanal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-[#001225] px-5 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Semana del {formatFecha(lunes)} al {formatFecha(viernes)}</p>
              <p className="text-sm font-black text-white">{config.titulo}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="text-center text-[11px] font-bold text-slate-300">Cargando…</p>
              ) : (
                config.campos.map((campo) => (
                  <label key={campo.key} className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
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
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cerrar</button>
              <button type="button" disabled={saving || loading} onClick={handleGuardar} className="h-9 rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
