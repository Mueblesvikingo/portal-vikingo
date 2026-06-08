import { useState } from "react";
import { useNavigate } from "react-router-dom";

const priorityItems = [
  {
    title: "Capacidad insuficiente en procesos críticos",
    impact: "Puede afectar cumplimiento, entregas y seguimiento operativo.",
    level: "Alta",
    route: "/process-view",
    responsible: "Gerencia de Operaciones",
    summary:
      "La capacidad actual no cubre todas las actividades críticas que requiere la operación para sostener el desempeño esperado.",
    cause:
      "Actividades diseñadas no se ejecutan al 100% por falta de personal, tiempo o automatización.",
    consequence:
      "Puede generar retrasos, saturación, incumplimientos y pérdida de control operativo.",
    financialImpact:
      "Costo oculto por retrabajos, entregas tardías y capacidad mal utilizada.",
    suggestedAction:
      "Priorizar actividades críticas y definir si la brecha se resuelve con personal, redistribución o automatización.",
  },
  {
    title: "Decisiones abiertas sin cierre",
    impact: "Requieren intervención directiva para evitar retrasos.",
    level: "Media",
    route: "/decision-center",
    responsible: "Dirección",
    summary:
      "Existen decisiones sin cierre formal, responsable confirmado o fecha de seguimiento validada.",
    cause:
      "La rutina de cierre posterior a sesiones ejecutivas aún no está institucionalizada.",
    consequence:
      "Puede generar duplicidad de acuerdos, retrasos y pérdida de trazabilidad.",
    financialImpact:
      "Costo oculto por decisiones tardías, reprocesos o iniciativas detenidas.",
    suggestedAction:
      "Confirmar responsable, fecha de cierre y criterio de éxito para cada decisión abierta.",
  },
  {
    title: "Seguimiento estratégico pendiente",
    impact: "Existen acuerdos que necesitan actualización.",
    level: "Media",
    route: "/strategic-followup",
    responsible: "Coordinación SIG/Estrategia",
    summary:
      "Hay acuerdos estratégicos sin actualización reciente, lo que limita la lectura real del avance.",
    cause:
      "Algunos responsables no han registrado avances, evidencias o bloqueos.",
    consequence:
      "Dirección no cuenta con información completa para decidir oportunamente.",
    financialImpact:
      "Riesgo de desviaciones no detectadas a tiempo y correcciones tardías.",
    suggestedAction:
      "Actualizar acuerdos críticos y clasificarlos por impacto, responsable y fecha compromiso.",
  },
];

const executiveCards = [
  {
    label: "Desempeño general",
    value: "82%",
    note: "Estado estable con puntos críticos bajo seguimiento.",
    route: "/performance",
    status: "Estable",
    trend: "+4%",
    interpretation:
      "La organización mantiene avance favorable, aunque requiere atención en capacidad y seguimiento.",
  },
  {
    label: "Diseño organizacional",
    value: "61%",
    note: "Capacidad limitada frente al proceso diseñado.",
    route: "/capacity",
    status: "Limitada",
    trend: "-8%",
    interpretation:
      "La capacidad disponible no alcanza para ejecutar todas las actividades críticas del sistema.",
  },
  {
    label: "Decisiones abiertas",
    value: "7",
    note: "Decisiones requieren seguimiento y cierre.",
    route: "/decision-center",
    status: "Pendiente",
    trend: "+2",
    interpretation:
      "Existen decisiones sin cierre que pueden retrasar acuerdos, iniciativas o ajustes críticos.",
  },
  {
    label: "Seguimiento crítico",
    value: "14",
    note: "Acciones pendientes con impacto organizacional.",
    route: "/strategic-followup",
    status: "Atención",
    trend: "+5",
    interpretation:
      "Hay acciones pendientes que requieren actualización para mantener trazabilidad ejecutiva.",
  },
];

export default function ExecutiveHome() {
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden h-[340px] flex flex-col">
          <div className="h-12 bg-[#071226] text-white px-6 flex items-center font-black text-sm tracking-wide">
            PRIORIDADES ORGANIZACIONALES
          </div>

          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            {priorityItems.map((item) => (
              <div
                key={item.title}
                onClick={() => setSelectedPriority(item)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 cursor-pointer hover:border-red-300 hover:bg-red-50 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-black text-[#0f172a] text-sm">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      {item.impact}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      item.level === "Alta"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {item.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 h-[340px] flex flex-col">
          <div className="text-[11px] uppercase tracking-wide font-black text-gray-400">
            IA Vikingo
          </div>

          <h3 className="mt-2 text-2xl font-black text-[#0f172a]">
            Lectura ejecutiva
          </h3>

          <p className="mt-3 text-sm text-gray-500 leading-relaxed flex-1">
            La organización mantiene avance general, pero la capacidad limitada
            y los seguimientos abiertos pueden afectar el desempeño si no se
            priorizan decisiones.
          </p>

          <button className="w-full rounded-2xl bg-red-600 text-white py-3 font-black hover:bg-red-700 transition-all">
            Ver sugerencias
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {executiveCards.map((card) => (
          <div
            key={card.label}
            onClick={() => setSelectedCard(card)}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm cursor-pointer hover:border-red-300 hover:bg-red-50 transition-all"
          >
            <div className="text-xs uppercase tracking-wide font-black text-gray-400">
              {card.label}
            </div>

            <div className="mt-2 text-3xl font-black text-[#0f172a]">
              {card.value}
            </div>

            <p className="mt-2 text-sm text-gray-500">{card.note}</p>
          </div>
        ))}
      </section>

      {selectedPriority && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-[#071226] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[3px] text-gray-300 font-black">
                  Detalle ejecutivo
                </div>

                <h2 className="mt-1 text-2xl font-black leading-tight">
                  {selectedPriority.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedPriority(null)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                  Resumen ejecutivo
                </div>

                <p className="mt-1 text-sm text-gray-600 leading-snug">
                  {selectedPriority.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                    Causa probable
                  </div>

                  <p className="mt-1 text-xs text-gray-600 leading-snug">
                    {selectedPriority.cause}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                    Consecuencia
                  </div>

                  <p className="mt-1 text-xs text-gray-600 leading-snug">
                    {selectedPriority.consequence}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                    Responsable
                  </div>

                  <div className="mt-1 text-sm font-black text-[#0f172a]">
                    {selectedPriority.responsible}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                    Prioridad
                  </div>

                  <div className="mt-1 text-sm font-black text-red-600">
                    {selectedPriority.level}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase font-black tracking-wide text-gray-400">
                    Impacto económico
                  </div>

                  <p className="mt-1 text-xs text-gray-600 leading-snug">
                    {selectedPriority.financialImpact}
                  </p>
                </div>
              </div>

              <div className="bg-red-50 rounded-xl border border-red-100 p-3">
                <div className="text-[10px] uppercase font-black tracking-wide text-red-500">
                  Acción sugerida
                </div>

                <p className="mt-1 text-sm text-gray-700 leading-snug font-semibold">
                  {selectedPriority.suggestedAction}
                </p>
              </div>

              <button
                onClick={() => navigate(selectedPriority.route)}
                className="w-full rounded-xl bg-red-600 text-white py-2.5 font-black hover:bg-red-700 transition-all"
              >
                Ir al módulo relacionado
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCard && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-[#071226] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[3px] text-gray-300 font-black">
                  Lectura rápida
                </div>

                <h2 className="mt-1 text-2xl font-black leading-tight">
                  {selectedCard.label}
                </h2>
              </div>

              <button
                onClick={() => setSelectedCard(null)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="text-[10px] uppercase font-black text-gray-400">
                    Valor
                  </div>

                  <div className="mt-1 text-3xl font-black text-[#0f172a]">
                    {selectedCard.value}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="text-[10px] uppercase font-black text-gray-400">
                    Estado
                  </div>

                  <div className="mt-2 text-lg font-black text-red-600">
                    {selectedCard.status}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="text-[10px] uppercase font-black text-gray-400">
                    Tendencia
                  </div>

                  <div className="mt-2 text-lg font-black text-[#0f172a]">
                    {selectedCard.trend}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div className="text-[10px] uppercase font-black text-gray-400">
                  Qué significa
                </div>

                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {selectedCard.interpretation}
                </p>
              </div>

              <button
                onClick={() => navigate(selectedCard.route)}
                className="w-full rounded-xl bg-red-600 text-white py-2.5 font-black hover:bg-red-700 transition-all"
              >
                Ver módulo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}