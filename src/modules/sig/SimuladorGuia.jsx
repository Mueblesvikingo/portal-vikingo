// Guía breve del Simulador ("Evaluación y análisis de inversiones"): manual de uso visual, con poco texto,
// que se abre desde el botón "Guía" del encabezado. Solo presentación: no lee ni cambia el análisis en pantalla.

const PASOS = [
  { n: 1, titulo: "Describe la situación", texto: "Cuántas unidades haces al año y cuánto te cuesta hoy cada una.", icono: "📋" },
  { n: 2, titulo: "Captura la opción", texto: "Lo que cuesta comprarla y lo que cuesta usarla cada año.", icono: "🏷️" },
  { n: 3, titulo: "Lee el resultado", texto: "Verde: conviene. Rojo: no conviene, con estos datos.", icono: "🚦" },
  { n: 4, titulo: "Prueba y guarda", texto: "Mueve los controles para ver qué pasaría y guarda el escenario.", icono: "💾" },
];

// Mini dibujos de cada indicador (SVG simple, colores sobrios)
function DibujoVpn() {
  return (
    <svg viewBox="0 0 160 70" className="h-16 w-full" aria-hidden="true">
      <rect x="10" y="10" width="34" height="50" rx="4" fill="#d1fae5" stroke="#10b981" />
      <text x="27" y="40" fontSize="9" textAnchor="middle" fill="#047857" fontWeight="700">Ahorro</text>
      <text x="56" y="40" fontSize="16" textAnchor="middle" fill="#64748b" fontWeight="700">−</text>
      <rect x="68" y="30" width="34" height="30" rx="4" fill="#fee2e2" stroke="#ef4444" />
      <text x="85" y="49" fontSize="9" textAnchor="middle" fill="#b91c1c" fontWeight="700">Compra</text>
      <text x="114" y="40" fontSize="16" textAnchor="middle" fill="#64748b" fontWeight="700">=</text>
      <rect x="124" y="30" width="30" height="30" rx="4" fill="#0f1f3d" />
      <text x="139" y="49" fontSize="10" textAnchor="middle" fill="#fff" fontWeight="800">VPN</text>
    </svg>
  );
}
function DibujoTir() {
  return (
    <svg viewBox="0 0 160 70" className="h-16 w-full" aria-hidden="true">
      <rect x="10" y="30" width="140" height="10" rx="5" fill="#e2e8f0" />
      <rect x="10" y="30" width="112" height="10" rx="5" fill="#0f1f3d" />
      <line x1="60" y1="20" x2="60" y2="50" stroke="#d97706" strokeWidth="2" strokeDasharray="3 2" />
      <text x="60" y="15" fontSize="9" textAnchor="middle" fill="#b45309" fontWeight="700">Tasa mínima</text>
      <text x="122" y="60" fontSize="9" textAnchor="middle" fill="#0f1f3d" fontWeight="700">TIR</text>
    </svg>
  );
}
function DibujoRecuperacion() {
  return (
    <svg viewBox="0 0 160 70" className="h-16 w-full" aria-hidden="true">
      <line x1="10" y1="38" x2="150" y2="38" stroke="#94a3b8" strokeDasharray="3 2" />
      <polyline points="14,58 46,44 78,30 110,18 146,8" fill="none" stroke="#0f1f3d" strokeWidth="2.5" />
      <circle cx="58" cy="38" r="5" fill="#10b981" />
      <text x="66" y="54" fontSize="9" fill="#047857" fontWeight="700">aquí ya recuperaste</text>
      <text x="14" y="68" fontSize="8" fill="#64748b">compra</text>
      <text x="146" y="68" fontSize="8" textAnchor="end" fill="#64748b">años →</text>
    </svg>
  );
}
function DibujoEquilibrio() {
  return (
    <svg viewBox="0 0 160 70" className="h-16 w-full" aria-hidden="true">
      <rect x="10" y="30" width="56" height="12" rx="3" fill="#fee2e2" />
      <rect x="66" y="30" width="84" height="12" rx="3" fill="#d1fae5" />
      <line x1="66" y1="20" x2="66" y2="52" stroke="#0f1f3d" strokeWidth="2" />
      <text x="66" y="15" fontSize="9" textAnchor="middle" fill="#0f1f3d" fontWeight="700">mínimo</text>
      <text x="38" y="62" fontSize="8" textAnchor="middle" fill="#b91c1c">no conviene</text>
      <text x="108" y="62" fontSize="8" textAnchor="middle" fill="#047857">conviene</text>
    </svg>
  );
}

const INDICADORES = [
  { nombre: "Valor presente neto (VPN)", pregunta: "¿Cuánto gano?", texto: "Lo que ahorras en los años del análisis, en pesos de hoy, menos lo que pagas por la compra.", regla: "Mayor que $0 → conviene", Dibujo: DibujoVpn },
  { nombre: "Tasa interna de retorno (TIR)", pregunta: "¿Qué tan rentable es?", texto: "El rendimiento anual de tu dinero dentro de esta inversión.", regla: "Mayor que tu tasa mínima → conviene", Dibujo: DibujoTir },
  { nombre: "Recuperación", pregunta: "¿Cuándo regresa mi dinero?", texto: "Los años que tardan los ahorros en pagar la compra.", regla: "Menos años → menos riesgo", Dibujo: DibujoRecuperacion },
  { nombre: "Punto de equilibrio", pregunta: "¿Cuánto debo usarla?", texto: "Las unidades al año a partir de las cuales comprar sale mejor que seguir como hoy.", regla: "Tu volumen arriba del mínimo → conviene", Dibujo: DibujoEquilibrio },
];

export default function SimuladorGuia({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Guía del simulador">
        <div className="flex items-start justify-between gap-3 bg-[#07162b] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Guía de uso</p>
            <p className="text-lg font-black leading-tight">Evaluación y análisis de inversiones</p>
            <p className="mt-0.5 text-[12px] text-slate-300">Antes de comprar, mira si la inversión se paga sola.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar guía" className="rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[#fbfbf9] p-4 sm:p-5">
          {/* Qué resuelve */}
          <section className="grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
              <div className="text-xl" aria-hidden="true">🏢</div>
              <div className="text-[11px] font-black uppercase text-slate-500">Como hoy</div>
              <div className="text-[12px] font-semibold text-slate-700">Pagar un servicio externo cada vez</div>
            </div>
            <div className="text-center text-[11px] font-black uppercase text-slate-400">contra</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
              <div className="text-xl" aria-hidden="true">⚙️</div>
              <div className="text-[11px] font-black uppercase text-slate-500">Invertir</div>
              <div className="text-[12px] font-semibold text-slate-700">Comprar el equipo y hacerlo en casa</div>
            </div>
          </section>

          {/* Pasos */}
          <section>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Cómo se usa · 4 pasos</p>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map((p) => (
                <li key={p.n} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f1f3d] text-[11px] font-black text-white">{p.n}</span>
                    <span className="text-lg" aria-hidden="true">{p.icono}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] font-black text-slate-800">{p.titulo}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{p.texto}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Indicadores */}
          <section>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Cómo leer el resultado · 4 indicadores</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {INDICADORES.map(({ nombre, pregunta, texto, regla, Dibujo }) => (
                <div key={nombre} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{nombre}</p>
                  <p className="text-[14px] font-black text-slate-900">{pregunta}</p>
                  <Dibujo />
                  <p className="text-[11px] leading-snug text-slate-600">{texto}</p>
                  <p className="mt-1.5 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{regla}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Semáforo */}
          <section className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-[12px] leading-snug text-emerald-800"><span className="font-black">VPN en verde:</span> la inversión se paga y deja ganancia. Confirma los datos y decide.</p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-red-500" />
              <p className="text-[12px] leading-snug text-red-800"><span className="font-black">VPN en rojo:</span> con estos datos no conviene. Revisa el volumen, el precio o espera.</p>
            </div>
          </section>

          {/* Buenas prácticas */}
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Para decidir con confianza</p>
            <ul className="grid gap-1.5 text-[11px] text-slate-600 sm:grid-cols-3">
              <li className="flex gap-1.5"><span aria-hidden="true">✔️</span><span>Usa cotizaciones reales, no estimados.</span></li>
              <li className="flex gap-1.5"><span aria-hidden="true">📊</span><span>Revisa la pestaña <b>Sensibilidad</b>: ¿sigue en verde si usas menos?</span></li>
              <li className="flex gap-1.5"><span aria-hidden="true">🤝</span><span>Usa <b>Guardar</b> para compartirlo con Dirección.</span></li>
            </ul>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <p className="text-[10px] text-slate-400">Es una estimación: no sustituye la opinión del contador.</p>
          <button type="button" onClick={onClose} className="rounded-full bg-[#07162b] px-4 py-1.5 text-[11px] font-black uppercase text-white hover:bg-[#0f2a4d]">Entendido</button>
        </div>
      </div>
    </div>
  );
}
