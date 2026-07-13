import React, { useEffect, useMemo, useState } from "react";
import { isStrategicTeamMember } from "../services/permissionsService";
import {
  getObjetivos,
  getKpisTacticos,
  createObjetivo,
  updateObjetivo,
  deactivateObjetivo,
  createKpiTactico,
  updateKpiTactico,
  deactivateKpiTactico,
} from "../services/strategicDeploymentService";

const COLORS = {
  Financiera: "#b88a00",
  Clientes: "#3f5f2f",
  Procesos: "#203f73",
  Desarrollo: "#c96d1a",
};

const STORAGE = {
  darkMode: "vikingo_darkMode",
  activeObjective: "vikingo_activeObjective",
  admin: "vikingo_admin",
  siteAccess: "vikingo_siteAccess",
};

const PROCESS_TYPE_STYLES = {
  "Procesos estratégicos": { color: "#991b1b", bg: "#fee2e2", border: "#fecaca" },
  "Procesos operativos": { color: "#203f73", bg: "#dbeafe", border: "#bfdbfe" },
  "Procesos de apoyo": { color: "#c96d1a", bg: "#ffedd5", border: "#fed7aa" },
};

const processMap = [
  {
    type: "Procesos estratégicos",
    processes: [
      { name: "Planeación estratégica del SIG", owner: "Coordinador Estratégico/SIG" },
      { name: "Planeación financiera", owner: "Finanzas" },
      { name: "Gestión de competencias", owner: "Analista de talento" },
      { name: "Evaluación desempeño del SIG", owner: "Coordinador Estratégico/SIG" },
    ],
  },
  {
    type: "Procesos operativos",
    processes: [
      { name: "Ventas", owner: "Director general" },
      { name: "Ingeniería / Desarrollo de productos", owner: "Ingeniero de producto" },
      { name: "Compras", owner: "Gerente Operaciones" },
      { name: "Planeación y control de la producción", owner: "Gerente Operaciones" },
      { name: "Gestión de inventarios", owner: "Gerente Operaciones" },
      { name: "Control de almacenes", owner: "Gerente Operaciones" },
      { name: "Distribución", owner: "Gerente Operaciones" },
      { name: "Gestión de calidad", owner: "Coordinador de Calidad" },
    ],
  },
  {
    type: "Procesos de apoyo",
    processes: [
      { name: "Recursos humanos", owner: "Recursos humanos" },
      { name: "Gestión de Seguridad y Salud laboral", owner: "Coordinador SST" },
      { name: "Transformación Digital y Automatización", owner: "Analista de procesos" },
      { name: "Contabilidad y Cumplimiento Fiscal", owner: "Finanzas" },
    ],
  },
];

const processAliases = {
  "Planeación y control de la producción": ["Planeación y control producción"],
  "Gestión de inventarios": ["Gestión inventarios"],
  "Gestión de calidad": ["Gestión calidad"],
  "Ingeniería / Desarrollo de productos": ["Ingeniería/Desarrollo de productos"],
  "Gestión de Seguridad y Salud laboral": ["SST"],
};

const objectiveVideos = {
  "OBJ-01": "https://youtu.be/ndeqEw-MFz0",
  "OBJ-02": "https://youtu.be/gny8eK2USik",
  "OBJ-03": "https://youtu.be/JpubXoDE_XM",
  "OBJ-04": "https://youtu.be/Bk024nv73ho",
  "OBJ-05": "https://youtu.be/W6WJ3mgeAj4",
  "OBJ-06": "https://youtu.be/RLXFxM_DS_0",
  "OBJ-07": "https://youtu.be/IgqcrbXObnU",
  "OBJ-08": "https://youtu.be/0RNtvtEBqyA",
  "OBJ-09": "https://youtu.be/9lX0VkI0KwA",
  "OBJ-10": "https://youtu.be/EknVnuOfZb8",
  "OBJ-11": "https://youtu.be/uUodXdPMjQM",
  "OBJ-12": "https://youtu.be/kztLczDY6_o",
  "OBJ-13": "https://youtu.be/z2T1hP_FAJI",
  "OBJ-14": "https://youtu.be/3RUQA3s2Jpk",
};
const strategicKpiNames = {
  GLOBAL: "% desempeño estratégico",
  "OBJ-01": "Margen neto",
  "OBJ-02": "Ventas mensuales",
  "OBJ-03": "Flujo positivo de caja",
  "OBJ-04": "Desviación presupuestal",
  "OBJ-05": "% clientes rentables",
  "OBJ-06": "OTIF",
  "OBJ-07": "CSAT",
  "OBJ-08": "Volumen de producción",
  "OBJ-09": "Exactitud forecast",
  "OBJ-10": "% pedidos con margen validado",
  "OBJ-11": "% procesos estandarizados",
  "OBJ-12": "Índice compromiso organizacional",
  "OBJ-13": "% cumplimiento competencias",
  "OBJ-14": "% operación digitalizada",
};

// La cadena causa-efecto no se hizo editable (no se pidió); sigue siendo
// contenido estático por código de objetivo. Un objetivo nuevo creado desde
// la app simplemente no tiene entrada aquí (la tarjeta muestra un estado vacío).
const CHAIN_BY_CODE = {
  GLOBAL: [
    { element: "Seguimiento estratégico", meaning: "Monitorear periódicamente el comportamiento de los indicadores estratégicos organizacionales.", contribution: "Permite detectar desviaciones y priorizar acciones estratégicas." },
    { element: "Control organizacional", meaning: "Mantener visibilidad integral del desempeño de los objetivos estratégicos.", contribution: "Favorece la toma de decisiones basada en información." },
    { element: "Alineación estratégica", meaning: "Asegurar coherencia entre procesos, responsables y resultados estratégicos.", contribution: "Fortalece el cumplimiento organizacional." },
    { element: "Desempeño estratégico global ≥80%", meaning: "Mantener un nivel global de cumplimiento estratégico organizacional igual o superior al 80%.", contribution: "Representa estabilidad y madurez del sistema de gestión estratégica." },
  ],
  "OBJ-01": [
    { element: "Gestión rentable de pedidos", meaning: "Asegurar que los pedidos generen margen y puedan cumplirse operativamente.", contribution: "Evita ventas no rentables y costos ocultos." },
    { element: "Operación estandarizada", meaning: "Ejecutar procesos con orden, control y menor variabilidad operacional.", contribution: "Reduce errores, retrabajos y desperdicio." },
    { element: "Clientes rentables", meaning: "Desarrollar relaciones comerciales sostenibles y rentables.", contribution: "Prioriza clientes que generan valor." },
    { element: "Rentabilidad ≥15%", meaning: "Lograr una utilidad mínima del 15% para asegurar crecimiento, reinversión y estabilidad financiera.", contribution: "Resultado financiero esperado." },
  ],
  "OBJ-02": [
    { element: "Capacidad productiva escalable", meaning: "Desarrollar una operación capaz de incrementar producción manteniendo control, cumplimiento y estabilidad operacional.", contribution: "Permite crecer sin generar saturación, retrasos ni desorden operativo." },
    { element: "Clientes rentables", meaning: "Enfocar ventas en clientes que generan margen, volumen y continuidad comercial.", contribution: "Evita crecer con clientes que consumen recursos sin aportar rentabilidad." },
    { element: "Confiabilidad de entrega", meaning: "Cumplir fechas y condiciones acordadas con el cliente.", contribution: "Fortalece recompra, confianza y relación comercial." },
    { element: "Satisfacción del cliente", meaning: "Medir y mejorar la percepción del cliente sobre producto, servicio y cumplimiento.", contribution: "Aumenta fidelidad, recomendación y permanencia." },
    { element: "Venta anual ≥74 MDP", meaning: "Alcanzar la meta anual de ventas definida por Dirección.", contribution: "Representa crecimiento comercial esperado para el año." },
  ],
  "OBJ-03": [
    { element: "Disciplina presupuestal", meaning: "Controlar gastos y ejecutar compras conforme al presupuesto autorizado.", contribution: "Reduce desviaciones y protege el flujo operativo." },
    { element: "Control del flujo de efectivo", meaning: "Monitorear ingresos, egresos y disponibilidad financiera de manera continua.", contribution: "Permite anticipar riesgos de liquidez y tomar decisiones oportunas." },
    { element: "Liquidez operativa", meaning: "Mantener capacidad financiera suficiente para sostener la operación diaria.", contribution: "Evita afectaciones operativas por falta de efectivo." },
    { element: "Liquidez ≥5% sobre ventas", meaning: "Mantener un nivel mínimo de liquidez respecto al volumen de ventas.", contribution: "Asegura estabilidad financiera y capacidad de respuesta operativa." },
  ],
  "OBJ-04": [
    { element: "Operación estandarizada", meaning: "Ejecutar procesos con orden, control y menor variabilidad operacional.", contribution: "Reduce desperdicios, errores y desviaciones operativas." },
    { element: "Planeación operativa", meaning: "Coordinar compras, producción y recursos conforme a la demanda y capacidad.", contribution: "Evita gastos no planificados y compras urgentes." },
    { element: "Control presupuestal", meaning: "Dar seguimiento continuo al comportamiento financiero y contra el presupuesto definido.", contribution: "Permite detectar desviaciones y tomar acciones oportunas." },
    { element: "Disciplina presupuestal ≤5%", meaning: "Mantener las desviaciones presupuestales dentro del límite definido por Dirección.", contribution: "Protege estabilidad financiera y sostenibilidad operativa." },
  ],
  "OBJ-05": [
    { element: "Gestión rentable de pedidos", meaning: "Validar margen, capacidad y viabilidad operativa antes de aceptar pedidos.", contribution: "Evita ventas que generan pérdidas o desorden operacional." },
    { element: "Confiabilidad de entrega", meaning: "Cumplir consistentemente fechas y condiciones acordadas con el cliente.", contribution: "Fortalece relaciones comerciales sostenibles." },
    { element: "Satisfacción del cliente", meaning: "Mejorar percepción del cliente respecto al servicio y cumplimiento.", contribution: "Incrementa permanencia y recompra." },
    { element: "Relación comercial sostenible", meaning: "Desarrollar relaciones comerciales estables, rentables y de largo plazo.", contribution: "Favorece crecimiento rentable y estabilidad financiera." },
  ],
  "OBJ-06": [
    { element: "Alineación demanda-capacidad", meaning: "Coordinar ventas, producción y recursos conforme a la capacidad real de operación.", contribution: "Reduce saturación, urgencias y reprogramaciones." },
    { element: "Capacidad productiva escalable", meaning: "Mantener una operación capaz de responder al crecimiento sin perder control operativo.", contribution: "Permite cumplir producción y entregas de manera estable." },
    { element: "Operación estandarizada", meaning: "Ejecutar procesos bajo estándares definidos y controlados.", contribution: "Reduce errores, retrasos y variabilidad operacional." },
    { element: "Cumplimiento operacional", meaning: "Ejecutar la operación de forma coordinada y conforme a lo planeado.", contribution: "Asegura entregas consistentes y fortalece la confianza del cliente." },
  ],
  "OBJ-07": [
    { element: "Operación estandarizada", meaning: "Ejecutar procesos bajo estándares definidos y controlados.", contribution: "Reduce errores, variabilidad y fallas percibidas por el cliente." },
    { element: "Confiabilidad de entrega", meaning: "Cumplir fechas y condiciones acordadas de manera consistente.", contribution: "Genera confianza y estabilidad en la relación comercial." },
    { element: "Atención y respuesta al cliente", meaning: "Dar seguimiento oportuno a necesidades, dudas y problemas del cliente.", contribution: "Mejora la experiencia y percepción del servicio." },
    { element: "Experiencia positiva del cliente", meaning: "Lograr que el cliente perciba valor, cumplimiento y confianza en la empresa.", contribution: "Incrementa satisfacción, permanencia y recomendación comercial." },
  ],
  "OBJ-08": [
    { element: "Validación comercial", meaning: "Revisar condiciones comerciales, margen y viabilidad antes de aceptar pedidos.", contribution: "Evita ventas no rentables o inviables operativamente." },
    { element: "Alineación demanda-capacidad", meaning: "Coordinar pedidos con capacidad real de producción y entrega.", contribution: "Reduce saturación, urgencias y retrasos." },
    { element: "Control operacional", meaning: "Ejecutar pedidos con seguimiento, control y coordinación entre procesos.", contribution: "Reduce desviaciones, errores y costos ocultos." },
    { element: "Protección del margen", meaning: "Mantener equilibrio entre ventas, costos y capacidad operativa.", contribution: "Favorece estabilidad financiera y crecimiento rentable." },
  ],
  "OBJ-09": [
    { element: "Integración comercial-operativa", meaning: "Coordinar ventas, producción y abastecimiento bajo una visión compartida de demanda y capacidad.", contribution: "Reduce decisiones aisladas y conflictos operativos." },
    { element: "Planeación sincronizada", meaning: "Balancear demanda, materiales, capacidad y entregas conforme a prioridades del negocio.", contribution: "Evita saturación, urgencias y desabasto." },
    { element: "Capacidad operativa controlada", meaning: "Mantener visibilidad y control sobre la capacidad real de operación.", contribution: "Permite responder al crecimiento sin perder estabilidad." },
    { element: "Ejecución coordinada", meaning: "Ejecutar la operación conforme a lo planeado entre áreas clave.", contribution: "Mejora cumplimiento, estabilidad y eficiencia operacional." },
  ],
  "OBJ-10": [
    { element: "Operación estandarizada", meaning: "Ejecutar procesos productivos bajo estándares definidos y controlados.", contribution: "Reduce variabilidad y facilita crecimiento ordenado." },
    { element: "Planeación sincronizada", meaning: "Coordinar demanda, producción, materiales y capacidad operativa.", contribution: "Evita saturación y desbalance operativo." },
    { element: "Recursos operativos disponibles", meaning: "Asegurar disponibilidad de personal, materiales, maquinaria y capacidad instalada.", contribution: "Permite sostener incremento de producción sin interrupciones." },
    { element: "Escalabilidad operacional", meaning: "Incrementar capacidad manteniendo control, estabilidad y cumplimiento operacional.", contribution: "Favorece crecimiento sostenible y cumplimiento de producción." },
  ],
  "OBJ-11": [
    { element: "Gestión por procesos", meaning: "Definir y gestionar la operación mediante procesos claramente estructurados e interrelacionados.", contribution: "Permite controlar la organización de forma integral y alineada." },
    { element: "Información documentada", meaning: "Mantener procesos, responsabilidades y controles formalmente documentados y disponibles.", contribution: "Facilita claridad, trazabilidad y continuidad operacional." },
    { element: "Aplicación de estándares", meaning: "Ejecutar actividades conforme a lineamientos, procedimientos y controles definidos.", contribution: "Reduce variabilidad y fortalece estabilidad operacional." },
    { element: "Institucionalización operacional", meaning: "Consolidar una operación basada en procesos, control y mejora continua organizacional.", contribution: "Favorece crecimiento sostenible, control y madurez organizacional." },
  ],
  "OBJ-12": [
    { element: "Disciplina operativa", meaning: "Fortalecer ejecución, seguimiento y cumplimiento dentro de la operación organizacional.", contribution: "Mejora alineación, estabilidad y control operativo." },
    { element: "Participación organizacional", meaning: "Involucrar al personal en objetivos, procesos y mejora continua.", contribution: "Incrementa compromiso y sentido de pertenencia." },
    { element: "Cultura de ejecución", meaning: "Promover disciplina, responsabilidad y cumplimiento en la operación diaria.", contribution: "Favorece estabilidad y desempeño organizacional." },
    { element: "Alineación organizacional", meaning: "Mantener al personal orientado a los objetivos estratégicos y operativos de la empresa.", contribution: "Fortalece ejecución, coordinación y sostenibilidad organizacional." },
  ],
  "OBJ-13": [
    { element: "Competencias definidas", meaning: "Establecer conocimientos, habilidades y responsabilidades requeridas para cada proceso y puesto.", contribution: "Permite alinear capacidades con necesidades operativas y estratégicas." },
    { element: "Desarrollo de competencias", meaning: "Fortalecer capacidades técnicas, operativas y de gestión conforme a los procesos organizacionales.", contribution: "Mejora desempeño y capacidad de ejecución." },
    { element: "Evaluación del desempeño", meaning: "Verificar aplicación efectiva de competencias en la operación diaria.", contribution: "Permite detectar brechas y oportunidades de mejora." },
    { element: "Capacidad organizacional", meaning: "Mantener personal competente y alineado a la estrategia del negocio.", contribution: "Sostiene crecimiento, estabilidad y mejora continua." },
  ],
  "OBJ-14": [
    { element: "Captura digital de información", meaning: "Registrar datos operativos y estratégicos de forma digital y estructurada.", contribution: "Reduce errores, pérdida de información y retrabajos administrativos." },
    { element: "Trazabilidad operacional", meaning: "Mantener seguimiento y visibilidad de la información a lo largo de los procesos.", contribution: "Facilita control, análisis y toma de decisiones." },
    { element: "Integración de sistemas", meaning: "Conectar herramientas, procesos y fuentes de información organizacional.", contribution: "Evita duplicidad y mejora coordinación entre áreas." },
    { element: "Gestión basada en datos", meaning: "Utilizar información confiable para seguimiento, control y toma de decisiones.", contribution: "Mejora capacidad de respuesta y control organizacional." },
  ],
};

function safeGetBoolean(key, fallback = false) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) === "true";
}

function safeGetString(key, fallback) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function groupByPerspective(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.perspective]) acc[item.perspective] = [];
    acc[item.perspective].push(item);
    return acc;
  }, {});
}

function getProcessNamesForMatch(selectedProcess) {
  return [selectedProcess, ...(processAliases[selectedProcess] || [])];
}

function getRelationType(dep, selectedProcess, owner) {
  if (dep.process === "Todos los procesos") return "Proceso transversal";
  if (dep.owner === owner) return "Proceso líder";
  return "Proceso de soporte";
}

function extractGoal(title) {
  return title.match(/(≥|≤|=).*$/)?.[0] || title;
}

function statusClasses(status) {
  if (status === "Activo") return "bg-green-100 text-green-700";
  if (status === "Atención") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

function Badge({ children, className = "" }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-black ${className}`}>{children}</span>;
}

function KpiTypeBadge({ strategic = false, global = false }) {
  const className = global ? "bg-[#b88a00]" : strategic ? "bg-red-600" : "bg-[#203f73]";
  const label = global ? "KPI Global" : strategic ? "KPI Estratégico" : "KPI Táctico";
  return <div className={`px-2 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</div>;
}

function RelationBadge({ relation }) {
  const styles = {
    "Proceso líder": "bg-red-100 text-red-700",
    "Proceso de soporte": "bg-blue-100 text-blue-700",
    "Proceso transversal": "bg-amber-100 text-amber-700",
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${styles[relation] || "bg-gray-100 text-gray-700"}`}>{relation}</span>;
}

function EditableText({ value, onSave, canEdit, darkMode, className = "", placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (!canEdit) {
    return <span className={className}>{value || <span className="text-gray-400">{placeholder}</span>}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        className={`w-full rounded px-1 text-left transition ${darkMode ? "hover:bg-white/10" : "hover:bg-sky-50"} ${className}`}
      >
        {value || <span className="text-gray-400">{placeholder || "Clic para editar"}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setDraft(value || ""); setEditing(false); }
      }}
      className={`w-full rounded border px-1 outline-none ${className} ${darkMode ? "bg-[#0b1120] border-white/20 text-white" : "bg-white border-sky-300 text-gray-800"}`}
    />
  );
}

function EditableSelect({ value, options, onSave, canEdit, darkMode, className = "" }) {
  if (!canEdit) return <span className={className}>{value}</span>;
  return (
    <select
      value={value || ""}
      onChange={(event) => onSave(event.target.value)}
      className={`rounded border px-1 py-0.5 outline-none ${className} ${darkMode ? "bg-[#0b1120] border-white/20 text-white" : "bg-white border-sky-300 text-gray-700"}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function getYouTubeEmbedUrl(url) {
  const match = url.match(/(?:youtu\.be\/|v=)([^&]+)/);
  const id = match ? match[1] : "";
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&vq=hd720`;
}
function KpiCard({ dep, darkMode, strong, muted, relation, canEdit, onUpdate, onDelete, processOptions }) {
  const isGlobal = dep.kpi === "% desempeño estratégico";
  const strategic = dep.strategic !== undefined ? dep.strategic : dep.process === "Todos los procesos";

  return (
    <div className={`${darkMode ? "bg-[#0b1120]" : "bg-gray-50"} rounded-2xl p-4`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs uppercase font-black text-gray-400">KPI</div>
          {canEdit ? (
            <EditableSelect
              value={dep.process}
              options={processOptions}
              canEdit={canEdit}
              darkMode={darkMode}
              className="text-xs font-black"
              onSave={(v) => onUpdate({ proceso: v })}
            />
          ) : (
            <div className="text-xs uppercase font-black text-gray-400">{dep.process}</div>
          )}
          <KpiTypeBadge strategic={strategic} global={isGlobal} />
          {relation && <RelationBadge relation={relation} />}
        </div>
        {canEdit && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar KPI táctico"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-100 hover:text-red-600"
          >
            ×
          </button>
        )}
      </div>
      <div className={`mt-2 font-black ${strong}`}>
        <EditableText value={dep.kpi} canEdit={canEdit} darkMode={darkMode} onSave={(v) => onUpdate({ kpi: v })} />
      </div>
      <div className={`mt-2 text-xs ${muted}`}>
        <EditableText value={dep.impact} canEdit={canEdit} darkMode={darkMode} onSave={(v) => onUpdate({ impacto: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <div className="text-xs uppercase font-black text-gray-400">Meta 2026</div>
          <div className={`font-bold ${strong}`}>
            <EditableText value={dep.goal} canEdit={canEdit} darkMode={darkMode} onSave={(v) => onUpdate({ meta: v })} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase font-black text-gray-400">Responsable</div>
          <div className={`font-bold ${strong}`}>
            <EditableText value={dep.owner} canEdit={canEdit} darkMode={darkMode} onSave={(v) => onUpdate({ responsable: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}


export default function StrategicDeploymentModule({ currentUser }) {
  const canEdit = isStrategicTeamMember(currentUser);
  const [objetivosRaw, setObjetivosRaw] = useState([]);
  const [kpisTacticosRaw, setKpisTacticosRaw] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [darkMode, setDarkMode] = useState(() => safeGetBoolean(STORAGE.darkMode));
  const [isAdmin, setIsAdmin] = useState(() => safeGetBoolean(STORAGE.admin));
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [activeId, setActiveId] = useState(() => {
    const stored = safeGetString(STORAGE.activeObjective, "OBJ-05");
    return stored === "GLOBAL" ? "OBJ-05" : stored;
  });
  const [activeView, setActiveView] = useState("Despliegue estratégico");
  const [previousView, setPreviousView] = useState(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [activePdf, setActivePdf] = useState(null);
const [activePdfTitle, setActivePdfTitle] = useState("");
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [siteUnlocked, setSiteUnlocked] = useState(true);
  const [sitePassword, setSitePassword] = useState("");
  const [siteAccessError, setSiteAccessError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoadingData(true);
      const [objetivosData, kpisData] = await Promise.all([getObjetivos(), getKpisTacticos()]);
      if (cancelled) return;
      setObjetivosRaw(objetivosData);
      setKpisTacticosRaw(kpisData);
      setLoadingData(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const objectives = useMemo(() => {
    return objetivosRaw.map((o) => ({
      id: o.codigo,
      dbId: o.id,
      title: o.titulo,
      perspective: o.perspectiva,
      owner: o.responsable,
      risk: o.riesgo,
      purpose: o.proposito,
      strategicStatus: o.estado_estrategico,
      chain: CHAIN_BY_CODE[o.codigo] || [],
      deployment: kpisTacticosRaw
        .filter((k) => k.objetivo_id === o.id)
        .map((k) => ({
          dbId: k.id,
          process: k.proceso,
          kpi: k.kpi,
          goal: k.meta,
          impact: k.impacto,
          owner: k.responsable,
          strategic: k.estrategico,
        })),
    }));
  }, [objetivosRaw, kpisTacticosRaw]);

  const strategicObjectives = useMemo(() => objectives.filter((item) => item.id !== "GLOBAL"), [objectives]);
  const perspectiveGroups = useMemo(() => groupByPerspective(strategicObjectives), [strategicObjectives]);
  const responsibleCards = useMemo(() => {
    const owners = objectives.flatMap((item) => [item.owner, ...item.deployment.map((dep) => dep.owner)]);
    return [...new Set(owners.filter((owner) => owner && owner !== "Ventas" && owner !== "Planeación"))];
  }, [objectives]);
  const processCards = useMemo(() => {
    return processMap
      .flatMap((group) => group.processes.map((process) => process.name))
      .filter((process) => process !== "Contabilidad y Cumplimiento Fiscal");
  }, []);
  const [selectedResponsible, setSelectedResponsible] = useState(responsibleCards[0] || "");
  const [selectedProcess, setSelectedProcess] = useState(processCards[0] || "");

  const activeObjective = strategicObjectives.find((item) => item.id === activeId) || strategicObjectives[0];

  const selectedProcessData = useMemo(() => {
    return processMap
      .flatMap((group) => group.processes.map((process) => ({ ...process, type: group.type })))
      .find((process) => process.name === selectedProcess);
  }, [selectedProcess]);

  const responsibleObjectives = useMemo(() => {
    return objectives.filter((objective) =>
      objective.owner === selectedResponsible ||
      (objective.id === "GLOBAL" && selectedResponsible === "Director general") ||
      objective.deployment.some(
        (dep) => dep.owner === selectedResponsible || (dep.process === "Todos los procesos" && selectedResponsible !== "Finanzas")
      )
    );
  }, [selectedResponsible, objectives]);

  const processObjectives = useMemo(() => {
    const processNames = getProcessNamesForMatch(selectedProcess);

    return strategicObjectives
      .map((objective) => ({
        ...objective,
        deployment: objective.deployment.filter((dep) =>
          processNames.includes(dep.process) || dep.process === "Todos los procesos"
        ),
      }))
      .filter((objective) => objective.deployment.length > 0);
  }, [selectedProcess, strategicObjectives]);

  const processContributionMap = {
    "Ventas": "Conecta la demanda comercial con la estrategia financiera y el crecimiento rentable del negocio.",
    "Ingeniería / Desarrollo de productos": "Asegura productos viables, estandarizados y compatibles con la capacidad operativa.",
    "Compras": "Garantiza abastecimiento estratégico y estabilidad operativa conforme a la planeación.",
    "Planeación y control de la producción": "Sincroniza capacidad, demanda y ejecución operativa para cumplir objetivos estratégicos.",
    "Gestión de inventarios": "Mantiene disponibilidad y control de materiales para asegurar continuidad operativa.",
    "Control de almacenes": "Fortalece exactitud y confiabilidad de inventarios dentro de la operación.",
    "Distribución": "Asegura cumplimiento logístico y confiabilidad en las entregas al cliente.",
    "Gestión de calidad": "Garantiza cumplimiento de estándares y reducción de desviaciones operativas.",
    "Planeación estratégica del SIG": "Alinea procesos, indicadores y estrategia organizacional mediante el SIG.",
    "Planeación financiera": "Controla estabilidad financiera y disciplina presupuestal organizacional.",
    "Gestión de competencias": "Fortalece capacidades organizacionales y desarrollo del talento.",
    "Evaluación desempeño del SIG": "Monitorea el cumplimiento y madurez del sistema estratégico organizacional.",
    "Recursos humanos": "Impulsa estabilidad organizacional mediante gestión y permanencia del talento.",
    "Gestión de Seguridad y Salud laboral": "Protege la continuidad operativa mediante condiciones seguras de trabajo.",
    "Transformación Digital y Automatización": "Integra herramientas digitales para mejorar trazabilidad y control operativo.",
  };

  const activeColor = COLORS[activeObjective.perspective] || "#111827";
  const card = darkMode ? "bg-[#111827] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800";
  const muted = darkMode ? "text-gray-400" : "text-gray-500";
  const strong = darkMode ? "text-white" : "text-gray-800";

  useEffect(() => {
    window.localStorage.setItem(STORAGE.darkMode, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.admin, String(isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.siteAccess, String(siteUnlocked));
  }, [siteUnlocked]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.activeObjective, activeId === "GLOBAL" ? "OBJ-05" : activeId);
  }, [activeId]);

  const unlockSite = () => {
    if (sitePassword.trim() === "vikingo2026") {
      setSiteUnlocked(true);
      setSitePassword("");
      setSiteAccessError("");
    } else {
      setSiteAccessError("Contraseña incorrecta");
    }
  };

  const login = () => {
    if (user.trim() === "admin" && password === "vikingo") {
      setIsAdmin(true);
      setShowLogin(false);
      setUser("");
      setPassword("");
    }
  };

  const openDashboardObjective = (id) => {
    if (id === "GLOBAL") return;
    setPreviousView(activeView);
    setActiveId(id);
    setActiveView("Dashboard");
  };

  const openProcessView = (processName) => {
    if (processName === "Contabilidad y Cumplimiento Fiscal") return;
    setPreviousView(activeView);
    setSelectedProcess(processName);
    setActiveView("Vista proceso");
  };

  const openObjectiveVideo = () => {
    const videoUrl = objectiveVideos[activeObjective.id];
    if (!videoUrl) return;
    setActiveVideoUrl(videoUrl);
    setActiveVideoTitle(`${activeObjective.id} | ${activeObjective.title}`);
  };
  const openPdf = (title, url) => {
  setActivePdfTitle(title);
  setActivePdf(url);
};

  async function handleUpdateObjetivo(dbId, updates) {
    const result = await updateObjetivo(dbId, updates);
    if (!result?.ok) { console.error(result?.error); return; }
    setObjetivosRaw((current) => current.map((o) => (o.id === dbId ? { ...o, ...result.data } : o)));
  }

  async function handleCreateObjetivo() {
    const usedNumbers = objetivosRaw
      .map((o) => Number(o.codigo?.match(/^OBJ-(\d+)$/)?.[1]))
      .filter((n) => Number.isFinite(n));
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
    const codigo = `OBJ-${String(nextNumber).padStart(2, "0")}`;
    const result = await createObjetivo({ codigo, orden: objetivosRaw.length + 1 });
    if (!result?.ok) { console.error(result?.error); return; }
    setObjetivosRaw((current) => [...current, result.data]);
    setActiveId(result.data.codigo);
  }

  async function handleDeleteObjetivo(dbId, codigo) {
    if (!window.confirm("¿Eliminar este objetivo estratégico?")) return;
    const result = await deactivateObjetivo(dbId);
    if (!result?.ok) { console.error(result?.error); return; }
    setObjetivosRaw((current) => current.filter((o) => o.id !== dbId));
    if (activeId === codigo) setActiveId("OBJ-05");
  }

  async function handleUpdateKpiTactico(dbId, updates) {
    const result = await updateKpiTactico(dbId, updates);
    if (!result?.ok) { console.error(result?.error); return; }
    setKpisTacticosRaw((current) => current.map((k) => (k.id === dbId ? { ...k, ...result.data } : k)));
  }

  async function handleCreateKpiTactico(objetivoDbId) {
    const orden = kpisTacticosRaw.filter((k) => k.objetivo_id === objetivoDbId).length + 1;
    const result = await createKpiTactico({ objetivoId: objetivoDbId, orden });
    if (!result?.ok) { console.error(result?.error); return; }
    setKpisTacticosRaw((current) => [...current, result.data]);
  }

  async function handleDeleteKpiTactico(dbId) {
    if (!window.confirm("¿Eliminar este KPI táctico?")) return;
    const result = await deactivateKpiTactico(dbId);
    if (!result?.ok) { console.error(result?.error); return; }
    setKpisTacticosRaw((current) => current.filter((k) => k.id !== dbId));
  }

  const visibleDeploymentsForResponsible = (objective) =>
    objective.deployment.filter((dep) => {
      const appliesByOwner = dep.owner === selectedResponsible;
      const appliesByTransversal = dep.process === "Todos los procesos" && selectedResponsible !== "Finanzas";
      const hideCoordinatorSigTactical =
        selectedResponsible === "Coordinador Estratégico/SIG" &&
        objective.id === "OBJ-11" &&
        dep.kpi === "% diagnóstico implementación SIG";
      return (appliesByOwner || appliesByTransversal) && !hideCoordinatorSigTactical;
    });

  if (!siteUnlocked) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-[#111827] px-8 py-8 text-white">
            <div className="text-3xl font-black tracking-wide">VIKIN<span className="text-red-500">GO</span></div>
            <div className="mt-2 text-lg font-semibold">Portal Estratégico</div>
            <div className="text-sm text-gray-400 mt-1">Acceso privado</div>
          </div>

          <div className="p-8 space-y-5">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Ingresar al portal</h1>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Este sitio es privado. Ingresa la contraseña para visualizar el contenido estratégico.
              </p>
            </div>

            <input
              type="password"
              placeholder="Contraseña"
              value={sitePassword}
              onChange={(event) => setSitePassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlockSite();
              }}
              className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800"
            />

            {siteAccessError && (
              <div className="text-sm font-bold text-red-600">{siteAccessError}</div>
            )}

            <button
              onClick={unlockSite}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black shadow-lg transition-all"
            >
              Acceder
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingData || !activeObjective) {
    return (
      <div className={`w-full min-h-[60vh] flex items-center justify-center ${darkMode ? "bg-[#0b1120] text-white" : "bg-[#f4f5f7] text-gray-800"}`}>
        <div className="text-sm font-bold text-gray-400">Cargando despliegue estratégico…</div>
      </div>
    );
  }

  return (
    <div className={`w-full transition-all ${darkMode ? "bg-[#0b1120] text-white" : "bg-[#f4f5f7] text-gray-800"}`}>
      <aside className="hidden">
        <div>
          <div className="px-8 py-8 border-b border-white/10">
            <div className="text-3xl font-black tracking-wide">VIKIN<span className="text-red-500">GO</span></div>
            <div className="mt-2 text-lg font-semibold">Portal Estratégico</div>
            <div className="text-sm text-gray-400 mt-1">Muebles Vikingo</div>
          </div>
          <nav className="px-4 py-6 space-y-2">
           {[
  "Despliegue estratégico",
   "Madurez organizacional",
    "Diagnóstico SIG",
  "Vista responsable",
  "Vista proceso",
  "Captura estratégica"
 
].map((item) => (
              <button
                key={item}
                onClick={() => setActiveView(item)}
                className={`w-full text-left px-5 py-3 rounded-2xl transition-all font-medium ${activeView === item ? "bg-red-600 shadow-lg" : "text-gray-300 hover:bg-white/10"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-5 border-t border-white/10 space-y-3">
          <button onClick={() => (isAdmin ? setIsAdmin(false) : setShowLogin(true))} className="w-full bg-red-600 hover:bg-red-700 rounded-2xl py-3 font-semibold">
            {isAdmin ? "🔓 Cerrar admin" : "🔐 Acceso admin"}
          </button>
          <button onClick={() => setDarkMode((value) => !value)} className="w-full bg-white/10 hover:bg-white/20 rounded-2xl py-3 font-semibold text-gray-200">
            {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          </button>
        </div>
      </aside>

{activePdf && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className={`${darkMode ? "bg-[#111827] text-white" : "bg-white text-gray-800"} w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-white/10`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20">
        <div>
          <div className="text-xs uppercase tracking-wide font-black text-gray-400">
            Documento PDF
          </div>
          <div className="font-black">{activePdfTitle}</div>
        </div>

        <button
          onClick={() => setActivePdf(null)}
          className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black transition-all"
        >
          ×
        </button>
      </div>

      <iframe
        src={activePdf}
        title={activePdfTitle}
        className="w-full h-[calc(90vh-73px)]"
      />
    </div>
  </div>
)}
 {activeVideoUrl && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className={`${darkMode ? "bg-[#111827] text-white" : "bg-white text-gray-800"} w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-white/10`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20">
        <div>
          <div className="text-xs uppercase tracking-wide font-black text-gray-400">Video estratégico</div>
          <div className="font-black">{activeVideoTitle}</div>
        </div>
        <button
          onClick={() => setActiveVideoUrl(null)}
          className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black transition-all"
        >
          ×
        </button>
      </div>

      <div className="aspect-video bg-black">
        <iframe
          src={getYouTubeEmbedUrl(activeVideoUrl)}
          title={activeVideoTitle}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  </div>
)}

      {showLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-[420px] text-gray-800">
            <div className="text-3xl font-black mb-2">Acceso estratégico</div>
            <div className="text-gray-500 mb-8">Portal Estratégico Vikingo</div>
            <div className="space-y-5">
              <input placeholder="Usuario" value={user} onChange={(event) => setUser(event.target.value)} className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20" />
              <input type="password" placeholder="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500/20" />
              <button onClick={login} className="w-full bg-[#111827] hover:bg-black text-white py-4 rounded-2xl font-black shadow-lg">INGRESAR</button>
              <button onClick={() => setShowLogin(false)} className="w-full text-gray-500 font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full min-w-0">
        <header className="hidden">
          <div>
            <h1 className={`text-2xl lg:text-3xl font-black tracking-tight ${strong}`}>DESEMPEÑO ORGANIZACIONAL</h1>
            <p className={`mt-1 ${muted} font-medium text-sm lg:text-base`}>Estrategia → Indicadores → SIG y Procesos → Responsables</p>
          </div>
          <div className={`${darkMode ? "bg-white/20 text-white" : "bg-white/80 text-gray-700"} rounded-2xl px-5 py-3 text-sm font-bold shadow-sm`}>09 Mayo 2026</div>
        </header>

        <section className="space-y-8">
          {activeView === "Despliegue estratégico" && (
            <div className="space-y-8">
              {previousView && (
                <button
                  onClick={() => setActiveView(previousView)}
                  className={`${darkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800"} px-5 py-3 rounded-2xl font-black transition-all`}
                >
                  ← Volver a {previousView}
                </button>
              )}
              <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
                <div className="p-5 lg:p-6 grid grid-cols-1 xl:grid-cols-[1.6fr_.75fr] gap-4 items-center">
                  <div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Objetivo estratégico</div>
{objectiveVideos[activeObjective.id] ? (
  <div className="flex items-center gap-2 flex-wrap">
    <button
      onClick={openObjectiveVideo}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black px-3 py-2 rounded-xl shadow-md transition-all"
    >
      <span className="text-xs">▶</span>
      Ver video
    </button>

    <button
      onClick={() =>
        openPdf(
          "Mapa Estratégico",
          "/pdf/mapa-estrategico.pdf"
        )
      }
      className="px-4 py-2 rounded-xl bg-[#111827] text-white text-[11px] font-black hover:bg-black transition-all"
    >
      🗺️ Ver mapa estratégico
    </button>
  </div>             
                       
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-2 bg-gray-400 cursor-not-allowed text-white text-[11px] font-black px-3 py-2 rounded-xl shadow-md transition-all"
                        >
                          <span className="text-xs">▶</span>
                          Video pendiente
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select value={activeId} onChange={(event) => setActiveId(event.target.value)} className={`flex-1 text-xl lg:text-2xl font-black rounded-2xl border px-4 py-3 outline-none ${darkMode ? "bg-[#0b1120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
                        {strategicObjectives.map((item) => (
                          <option key={item.id} value={item.id}>{item.id} | {item.title}</option>
                        ))}
                      </select>
                      {!canEdit && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">Modo solo lectura</span>
                      )}
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={handleCreateObjetivo}
                            title="Nuevo objetivo"
                            className="shrink-0 rounded-2xl border border-dashed border-sky-300 px-4 py-3 text-xs font-black text-sky-600 transition hover:bg-sky-50"
                          >
                            + Nuevo objetivo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteObjetivo(activeObjective.dbId, activeObjective.id)}
                            title="Eliminar objetivo"
                            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 text-red-500 transition hover:bg-red-50"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-4" style={{ backgroundColor: `${activeColor}18` }}>
                    <div className={`text-xs uppercase font-black ${muted}`}>Perspectiva estratégica</div>
                    <div className="font-black mt-1 text-xl" style={{ color: activeColor }}>{activeObjective.perspective}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 flex items-center px-6 text-white font-black" style={{ backgroundColor: activeColor }}>OBJETIVO</div>
                  <div className="p-7 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className={`text-sm font-black ${muted}`}>{activeObjective.id}</div>
                        <h2 className={`text-2xl font-black mt-1 ${strong}`}>
                          <EditableText
                            value={activeObjective.title}
                            canEdit={canEdit}
                            darkMode={darkMode}
                            onSave={(v) => handleUpdateObjetivo(activeObjective.dbId, { titulo: v })}
                          />
                        </h2>
                      </div>
                      <Badge className={statusClasses(activeObjective.status || "Activo")}>{activeObjective.status || "Activo"}</Badge>
                    </div>
                    <div>
                      <h3 className={`font-black mb-2 ${strong}`}>Propósito</h3>
                      <p className={`${muted} leading-relaxed`}>
                        <EditableText
                          value={activeObjective.purpose}
                          canEdit={canEdit}
                          darkMode={darkMode}
                          onSave={(v) => handleUpdateObjetivo(activeObjective.dbId, { proposito: v })}
                        />
                      </p>
                    </div>
                    <div>
                      <h3 className={`font-black mb-2 ${strong}`}>Riesgo crítico</h3>
                      <p className={`${muted} leading-relaxed`}>
                        <EditableText
                          value={activeObjective.risk}
                          canEdit={canEdit}
                          darkMode={darkMode}
                          onSave={(v) => handleUpdateObjetivo(activeObjective.dbId, { riesgo: v })}
                        />
                      </p>
                    <div className="mt-4">
  <div className={`text-[11px] uppercase tracking-wide font-black mb-2 ${strong}`}>
    Estado
  </div>

  <div
    className={`
      inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-black
      ${
        activeObjective.strategicStatus === "Consolidado"
          ? "bg-green-100 text-green-700"
          : activeObjective.strategicStatus === "En ejecución"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700"
      }
    `}
  >
    <div
      className={`
        w-2.5 h-2.5 rounded-full
        ${
          activeObjective.strategicStatus === "Consolidado"
            ? "bg-green-500"
            : activeObjective.strategicStatus === "En ejecución"
            ? "bg-yellow-500"
            : "bg-red-500"
        }
      `}
    />

    {activeObjective.strategicStatus}
  </div>
  {canEdit && (
    <select
      value={activeObjective.strategicStatus || ""}
      onChange={(event) => handleUpdateObjetivo(activeObjective.dbId, { estado_estrategico: event.target.value })}
      className={`ml-2 rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${darkMode ? "bg-[#0b1120] border-white/20 text-white" : "bg-white border-gray-200 text-gray-700"}`}
    >
      {["Sin atención", "En ejecución", "Consolidado"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )}
</div>

                    </div>

                  </div>
                </div>

                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#203f73] flex items-center px-6 text-white font-black">CADENA CAUSA-EFECTO</div>
                  <div className="p-6 flex flex-col gap-3">
                    {activeObjective.chain.length === 0 && (
                      <div className={`text-xs italic ${muted}`}>Cadena causa-efecto no definida todavía para este objetivo.</div>
                    )}
                    {activeObjective.chain.map((node, index) => (
                      <div key={`${node.element}-${index}`} className="flex flex-col items-center gap-3">
                        <div className={`w-full rounded-2xl p-4 border ${index === activeObjective.chain.length - 1 ? "text-white" : darkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`} style={index === activeObjective.chain.length - 1 ? { backgroundColor: activeColor, borderColor: activeColor } : undefined}>
                          <div className="font-black text-center">{node.element}</div>
                          <div className={`mt-2 text-xs leading-relaxed ${index === activeObjective.chain.length - 1 ? "text-white/90" : muted}`}>{node.meaning}</div>
                          <div className={`mt-2 text-xs font-semibold ${index === activeObjective.chain.length - 1 ? "text-white/90" : muted}`}>{node.contribution}</div>
                        </div>
                        {index !== activeObjective.chain.length - 1 && <div className="text-2xl text-gray-400">↓</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${card} xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#111827] flex items-center px-6 text-white font-black">DESPLIEGUE ESTRATÉGICO</div>
                  <div className="p-6 space-y-4 max-h-[720px] overflow-auto">
                    {activeObjective.deployment.map((item) => (
                      <div key={item.dbId} className={`${darkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"} border rounded-3xl p-5 shadow-sm`}>
                        <KpiCard
                          dep={item}
                          darkMode={darkMode}
                          strong={strong}
                          muted={muted}
                          canEdit={canEdit}
                          processOptions={["Todos los procesos", ...processCards]}
                          onUpdate={(updates) => handleUpdateKpiTactico(item.dbId, updates)}
                          onDelete={() => handleDeleteKpiTactico(item.dbId)}
                        />
                      </div>
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleCreateKpiTactico(activeObjective.dbId)}
                        className={`w-full rounded-2xl border border-dashed px-4 py-3 text-xs font-black transition ${darkMode ? "border-white/20 text-white/60 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-sky-300 hover:text-sky-600"}`}
                      >
                        + Agregar KPI táctico
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "Mapa estratégico" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-16 bg-[#111827] flex items-center px-8 text-white font-black text-xl">MAPA ESTRATÉGICO</div>
              <div className="p-8 space-y-8">
                {["Financiera", "Clientes", "Procesos", "Desarrollo"].map((perspective) => (
                  <div key={perspective}>
                    <div className="mb-4 inline-flex px-4 py-2 rounded-full font-black text-sm uppercase" style={{ backgroundColor: `${COLORS[perspective]}20`, color: COLORS[perspective] }}>{perspective}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {(perspectiveGroups[perspective] || []).map((item) => (
                        <button key={item.id} onClick={() => openDashboardObjective(item.id)} className="transition-all border rounded-2xl p-5 text-left font-bold shadow-sm hover:text-white" style={{ backgroundColor: `${COLORS[perspective]}10`, borderColor: `${COLORS[perspective]}35` }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = COLORS[perspective]; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = `${COLORS[perspective]}10`; }}>
                          <div className="text-xs opacity-80">{item.id}</div>
                          <div className="mt-1">{item.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "Mapa de procesos" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-16 bg-[#111827] flex items-center px-8 text-white font-black text-xl">MAPA DE PROCESOS</div>
              <div className="p-8 space-y-8">
                <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-white border-gray-200"} border rounded-3xl p-6`}>
                  <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Entrada</div>
                  <div className={`mt-1 text-xl font-black ${strong}`}>Requisitos de las partes interesadas</div>
                </div>

                {processMap.map((group) => {
                  const style = PROCESS_TYPE_STYLES[group.type];
                  return (
                    <div key={group.type} className="rounded-3xl border p-6" style={{ backgroundColor: `${style.bg}55`, borderColor: style.border }}>
                      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                        <div>
                          <div className="text-xs uppercase tracking-wide font-black" style={{ color: style.color }}>Tipo de proceso</div>
                          <div className="text-2xl font-black" style={{ color: style.color }}>{group.type}</div>
                        </div>
                        <div className="px-4 py-2 rounded-full text-xs font-black uppercase" style={{ backgroundColor: style.bg, color: style.color }}>
                          {group.processes.length} procesos
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {group.processes.map((process) => (
                          <button
                            key={process.name}
                            onClick={() => openProcessView(process.name)}
                            className={`${darkMode ? "bg-[#111827] border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-50"} border rounded-2xl p-5 shadow-sm text-left transition-all`}
                          >
                            <div className="text-xs uppercase font-black text-gray-400">Proceso</div>
                            <div className={`mt-2 text-lg font-black ${strong}`}>{process.name}</div>
                            <div className="mt-4 pt-4 border-t border-gray-200/30">
                              <div className="text-xs uppercase font-black text-gray-400">Dueño del proceso</div>
                              <div className={`mt-1 font-bold ${strong}`}>{process.owner}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-white border-gray-200"} border rounded-3xl p-6`}>
                  <div className={`text-xs uppercase tracking-wide font-black ${muted}`}>Salida</div>
                  <div className={`mt-1 text-xl font-black ${strong}`}>Satisfacción de las partes interesadas</div>
                </div>
              </div>
            </div>
          )}


          {activeView === "Vista proceso" && (
            <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
              <div className="h-14 bg-[#203f73] flex items-center px-6 text-white font-black">VISTA POR PROCESO</div>
              <div className="p-6 border-b border-gray-200">
                <div className={`text-xs uppercase tracking-wide font-black mb-2 ${muted}`}>Seleccionar proceso</div>
                <select value={selectedProcess} onChange={(event) => setSelectedProcess(event.target.value)} className={`w-full text-lg font-black rounded-2xl border px-5 py-4 outline-none ${darkMode ? "bg-[#0b1120] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
                  {processCards.map((process) => (
                    <option key={process} value={process}>{process}</option>
                  ))}
                </select>
              </div>

              <div className="p-6 space-y-6 overflow-auto">
                <div className={`${darkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"} border rounded-3xl overflow-hidden`}>
                  <div className="p-5 border-b border-gray-200/20 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs uppercase font-black text-gray-400">Proceso organizacional</div>
                      <div className={`mt-1 text-2xl font-black ${strong}`}>{selectedProcess}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: selectedProcessData?.type === "Procesos estratégicos" ? "#991b1b20" : selectedProcessData?.type === "Procesos operativos" ? "#203f7320" : "#c96d1a20", color: selectedProcessData?.type === "Procesos estratégicos" ? "#991b1b" : selectedProcessData?.type === "Procesos operativos" ? "#203f73" : "#c96d1a" }}>
                        {selectedProcessData?.type}
                      </div>
                      <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-gray-50 border-gray-200"} border rounded-2xl px-4 py-3`}>
                        <div className="text-[10px] uppercase font-black text-gray-400">Dueño del proceso</div>
                        <div className={`font-black ${strong}`}>{selectedProcessData?.owner}</div>
                      </div>
                    </div>
                  </div>

                  <div className={`mx-5 mb-2 mt-5 ${darkMode ? "bg-[#0b1120] border-white/10" : "bg-[#f8fafc] border-gray-200"} border rounded-2xl p-5`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="text-xs uppercase font-black text-gray-400">Aporte estratégico del proceso</div>
                        <div className={`mt-2 text-sm leading-relaxed font-medium ${muted}`}>
                          {processContributionMap[selectedProcess] || "Este proceso contribuye al cumplimiento estratégico mediante control y soporte operacional."}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 min-w-[320px]">
                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">Perspectivas</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{[...new Set(processObjectives.map((o) => o.perspective))].length}</div>
                        </div>

                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">Objetivos</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{processObjectives.length}</div>
                        </div>

                        <div className={`${darkMode ? "bg-white/5" : "bg-white"} rounded-2xl p-3 border border-gray-200/20`}>
                          <div className="text-[10px] uppercase font-black text-gray-400">KPIs</div>
                          <div className={`mt-1 text-lg font-black ${strong}`}>{processObjectives.reduce((acc, objective) => acc + objective.deployment.length, 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {processObjectives.map((objective) => (
                      <button
                        key={objective.id}
                        onClick={() => openDashboardObjective(objective.id)}
                        className={`${darkMode ? "bg-[#0b1120] border-white/10 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-white"} border rounded-2xl p-5 text-left transition-all`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-xs uppercase font-black text-gray-400">Objetivo conectado</div>
                            <div className={`mt-1 text-lg font-black ${strong}`}>{objective.id}</div>
                          </div>

                          <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase" style={{ backgroundColor: `${COLORS[objective.perspective]}20`, color: COLORS[objective.perspective] }}>
                            {objective.perspective}
                          </div>
                        </div>

                        <div className={`mt-3 text-sm leading-relaxed ${muted}`}>{objective.title}</div>

                        <div className="mt-4 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-black text-gray-400">KPIs conectados</div>
                            <div className={`font-black ${strong}`}>{objective.deployment.length}</div>
                          </div>

                          <div className="text-xs font-black text-[#203f73]">Ver detalle →</div>
                        </div>
                      </button>
                    ))}

                    {processObjectives.length === 0 && (
                      <div className={`${darkMode ? "bg-[#0b1120] border-white/10" : "bg-gray-50 border-gray-200"} border rounded-2xl p-6`}>
                        <div className={`text-lg font-black ${strong}`}>Proceso en construcción estratégica</div>
                        <div className={`mt-2 text-sm leading-relaxed ${muted}`}>Este proceso aún no tiene objetivos estratégicos o KPIs vinculados directamente dentro del despliegue estratégico actual.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "Captura estratégica" && (
            <div>
              {isAdmin ? (
                <div className={`${card} rounded-3xl shadow-sm border overflow-hidden`}>
                  <div className="h-14 bg-[#b88a00] flex items-center px-6 text-white font-black">CAPTURA ESTRATÉGICA MENSUAL</div>
                  <div className="p-8 space-y-4">
                    {Object.keys(COLORS).map((perspective) => (
                      <div key={perspective} className={`${darkMode ? "border-white/10" : "border-gray-200"} grid grid-cols-1 lg:grid-cols-4 gap-4 items-center border rounded-2xl p-4`}>
                        <div className={`font-bold ${strong}`}>{perspective}</div>
                        <div className={`${muted} font-semibold`}>Meta mensual</div>
                        <input defaultValue="90%" className="border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none text-gray-800 focus:ring-2 focus:ring-[#111827]/20" />
                        <div className={`font-black ${strong}`}>90%</div>
                      </div>
                    ))}
                    <div className="pt-4 flex justify-end"><button className="bg-[#111827] hover:bg-black text-white px-8 py-4 rounded-2xl font-black shadow-xl">GUARDAR RESULTADOS</button></div>
                  </div>
                </div>
              ) : (
                <div className={`${card} rounded-3xl shadow-sm border p-8 text-center`}>
                  <div className={`text-2xl font-black ${strong}`}>Acceso restringido</div>
                  <p className={`mt-2 ${muted}`}>Inicia sesión como Analista Estratégico para capturar resultados.</p>
                  <button onClick={() => setShowLogin(true)} className="mt-6 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg">🔐 Acceso admin</button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
