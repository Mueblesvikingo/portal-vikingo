import { useEffect, useMemo, useState } from "react";
import {
  estadoCorrectivo,
  hoyISO,
  getCorrectivos,
  getProcesosCorrectivo,
  getPersonasCorrectivo,
  getDirectricesCorrectivo,
  probarColumnasNuevas,
  probarColumnasMultiples,
  probarNotificaciones,
  destinatariosCorrectivo,
  notificarCorrectivo,
  procesosDe,
  lideresDe,
  supervisoresDe,
  getAvisadosPorCorrectivo,
  getAlertasNuevaAccion,
  getAvancesEquipo,
  reportarAvanceEquipo,
  getDirectricesPropias,
  createDirectrizPropia,
  createCorrectivo,
  updateCorrectivo,
  deactivateCorrectivo,
} from "../../services/controlCorrectivoService";
import { canEditModule, isStrategicTeamMember } from "../../services/permissionsService";
import {
  cardClass,
  inputClass,
  btnPrimaryClass,
  btnGhostClass,
  PRIORIDAD_BADGE,
  PRIORIDAD_COLOR,
  ESTADO_BADGE,
  BRECHA_BADGE,
  fmtFecha,
  iniciales,
  textoVencimiento,
} from "./ccHelpers";
import AvanceSlider from "./AvanceSlider";
import CorrectivoFormModal from "./CorrectivoFormModal";
import CorrectivoGantt from "./CorrectivoGantt";
import AvanceEquipoModal from "./AvanceEquipoModal";
import { PM_PERSONA_ID } from "../../services/pmoService";

const FILTROS_VACIO = { proceso: "" };
const ESTADOS = ["En curso", "Vencida", "Completada"];

const selectFiltroClass = `${inputClass} mt-0 py-1.5 text-xs`;

function Badge({ clase, children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${clase}`}>{children}</span>;
}

// Avatar con iniciales + nombre y rol; "Sin asignar" cuando no hay persona.
function Persona({ nombre, suave = false }) {
  const asignada = nombre && nombre !== "—";
  return (
    <div className="flex items-center gap-2">
      <span className={`flex shrink-0 items-center justify-center rounded-full font-black ${suave ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]"} ${asignada ? (suave ? "bg-[#e5e9f0] text-[#5b6472]" : "bg-[#0f1f3d] text-white") : "border border-dashed border-[#cbd5e1] text-[#cbd5e1]"}`}>
        {asignada ? iniciales(nombre) : "?"}
      </span>
      <span className={`min-w-0 leading-tight ${suave ? "text-[11px] font-medium" : "text-xs font-semibold"} ${asignada ? (suave ? "text-[#5b6472]" : "text-[#0f1f3d]") : "text-[#b6bfcc]"}`}>{asignada ? nombre : "Sin asignar"}</span>
    </div>
  );
}

export default function ControlCorrectivoModule({ currentUser }) {
  const [items, setItems] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [personas, setPersonas] = useState({ personas: [], lideres: [], supervisores: [], porProceso: new Map() });
  const [loading, setLoading] = useState(true);
  const [tablaFaltante, setTablaFaltante] = useState(false);
  const [directrices, setDirectrices] = useState([]);
  const [extendido, setExtendido] = useState(false);
  const [directricesPropias, setDirectricesPropias] = useState([]);
  const [propiasDisponible, setPropiasDisponible] = useState(false); // sql/2026-10-control_correctivo_v3.sql // ya existen las columnas de sql/2026-10-control_correctivo_v2.sql
  const [multiples, setMultiples] = useState(false); // sql/2026-10-control_correctivo_v4.sql: varios procesos, líderes y supervisores
  const [alertasDisponibles, setAlertasDisponibles] = useState(false); // sql/2026-10-control_correctivo_v4.sql: control_correctivo_notificaciones
  const [avisados, setAvisados] = useState(new Map()); // correctivo_id → personas que recibieron la alerta (involucrados)
  const [vistos, setVistos] = useState(new Map()); // correctivo_id → (persona_id → cuándo vio la alerta | null)
  const [probando, setProbando] = useState(false);
  const [avances, setAvances] = useState([]); // reportes de avance de los involucrados
  const [avancesDisponible, setAvancesDisponible] = useState(false); // sql/2026-10-control_correctivo_v5.sql
  const [equipoItem, setEquipoItem] = useState(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [vista, setVista] = useState("tablero");
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [abierto, setAbierto] = useState(null);
  const [modal, setModal] = useState(null);
  const [aviso, setAviso] = useState("");

  const puedeEditar = isStrategicTeamMember(currentUser) && canEditModule(currentUser, "control-correctivo");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [correctivos, procs, pers, dirs, columnasNuevas, propias, columnasMultiples, notificaciones, avisadosMapa, avancesRes, vistosMapa] = await Promise.all([getCorrectivos(), getProcesosCorrectivo(), getPersonasCorrectivo(), getDirectricesCorrectivo(), probarColumnasNuevas(), getDirectricesPropias(), probarColumnasMultiples(), probarNotificaciones(), getAvisadosPorCorrectivo(), getAvancesEquipo(), getAlertasNuevaAccion()]);
      if (cancelado) return;
      setAvisados(avisadosMapa);
      setVistos(vistosMapa);
      setAvances(avancesRes.data);
      setAvancesDisponible(avancesRes.disponible);
      setMultiples(columnasMultiples);
      setAlertasDisponibles(notificaciones);
      setItems(correctivos.data);
      setTablaFaltante(correctivos.tablaFaltante);
      setErrorCarga(Boolean(correctivos.error));
      setProcesos(procs);
      setPersonas(pers);
      setDirectrices(dirs);
      setExtendido(columnasNuevas);
      setDirectricesPropias(propias.data);
      setPropiasDisponible(propias.disponible);
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, []);

  const personaPorId = useMemo(() => new Map(personas.personas.map((p) => [Number(p.id), p.nombre])), [personas]);
  const procesoPorId = useMemo(() => new Map(procesos.map((p) => [Number(p.id), p.nombre])), [procesos]);
  const propiaPorId = useMemo(() => new Map(directricesPropias.map((d) => [Number(d.id), d.nombre])), [directricesPropias]);
  const directrizPorId = useMemo(() => new Map(directrices.map((d) => [Number(d.id), d])), [directrices]);
  const nombrePersona = (id) => (id != null ? personaPorId.get(Number(id)) || "—" : "—");

  // Involucrados de una acción: líderes, supervisores y quienes recibieron la alerta.
  const involucradosDe = (i) => [...new Set([...lideresDe(i), ...supervisoresDe(i), ...(avisados.get(Number(i.id)) || [])])];
  const avancesPorItem = useMemo(() => {
    const mapa = new Map();
    avances.forEach((r) => {
      const id = Number(r.correctivo_id);
      if (!mapa.has(id)) mapa.set(id, []);
      mapa.get(id).push(r);
    });
    return mapa;
  }, [avances]);

  // Fuera del equipo estratégico solo se ven las acciones donde la persona está involucrada.
  const verTodo = isStrategicTeamMember(currentUser);
  const miPersonaId = currentUser?.persona_id != null ? Number(currentUser.persona_id) : null;
  const hoy = hoyISO();
  const conEstado = useMemo(
    () => items
      .filter((i) => verTodo || (miPersonaId != null && involucradosDe(i).includes(miPersonaId)))
      .map((i) => ({ ...i, estado: estadoCorrectivo(i, hoy) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, hoy, verTodo, miPersonaId, avisados],
  );

  const filtrados = useMemo(() => {
    const lista = conEstado.filter((i) => (
      !filtros.proceso || procesosDe(i).map(String).includes(filtros.proceso) || i.todos_procesos || (i.procesos_involucrados_ids || []).map(String).includes(filtros.proceso)
    ));
    // Pendientes primero por fecha compromiso; las completadas al final.
    return lista.sort((a, b) => {
      const ca = a.estado === "Completada" ? 1 : 0;
      const cb = b.estado === "Completada" ? 1 : 0;
      return ca - cb || String(a.fecha_compromiso).localeCompare(String(b.fecha_compromiso));
    });
  }, [conEstado, filtros]);

  // Tablero agrupado por proceso, en el orden del catálogo.
  const grupos = useMemo(() => {
    const conocidos = new Set(procesos.map((p) => Number(p.id)));
    return [...procesos, { id: "sin-proceso", nombre: "Sin proceso en el catálogo" }]
      .map((p) => ({
        proceso: p,
        filas: filtrados.filter((i) => (p.id === "sin-proceso" ? !conocidos.has(Number(i.proceso_id)) : Number(i.proceso_id) === Number(p.id))),
      }))
      .filter((g) => g.filas.length > 0);
  }, [procesos, filtrados]);

  const conteo = useMemo(() => {
    const base = { "En curso": 0, Vencida: 0, Completada: 0 };
    conEstado.forEach((i) => { base[i.estado] += 1; });
    return base;
  }, [conEstado]);
  const total = conEstado.length;
  const promedioAvance = total ? Math.round(conEstado.reduce((s, i) => s + (Number(i.avance) || 0), 0) / total) : 0;
  const hayFiltros = Object.values(filtros).some(Boolean);

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 4000);
  }

  async function guardarForm(form) {
    let guardado;
    if (modal?.item?.id) {
      guardado = await updateCorrectivo(modal.item.id, form, currentUser, extendido, propiasDisponible, multiples);
      setItems((lista) => lista.map((i) => (i.id === guardado.id ? guardado : i)));
    } else {
      guardado = await createCorrectivo(form, currentUser, extendido, propiasDisponible, multiples);
      setItems((lista) => [...lista, guardado]);
    }
    setModal(null);
    // Ventana emergente + sirena + campanita para líderes, supervisores y gente
    // de los procesos (al editar, solo a quien se agregó). Si falla, la acción
    // ya quedó guardada: solo se avisa.
    if (alertasDisponibles) {
      try {
        await notificarCorrectivo(guardado, destinatariosCorrectivo(guardado, { procesos, ...personas }, currentUser?.persona_id), currentUser);
      } catch (err) {
        console.error("Error al enviar las alertas de Control Correctivo:", err);
        mostrarAviso("La acción se guardó, pero no se pudieron enviar las alertas a las personas.");
      }
    }
  }

  // Al abrir el detalle se vuelve a leer quién ya vio la alerta y qué se ha reportado.
  async function abrirEquipo(item) {
    setEquipoItem(item);
    const [vistosMapa, avancesRes] = await Promise.all([getAlertasNuevaAccion(), getAvancesEquipo()]);
    setVistos(vistosMapa);
    if (avancesRes.disponible) setAvances(avancesRes.data);
  }

  // Prueba de avisos y reportes: crea una acción marcada como PRUEBA y manda la
  // alerta (ventana emergente + sirena) solo a quien pulsa el botón. Desde esa
  // acción puede reportar avance y la PM recibe el aviso en la campanita.
  async function probarAvisos() {
    if (miPersonaId == null) { mostrarAviso("Tu usuario no tiene persona asignada: no se puede hacer la prueba."); return; }
    if (!procesos.length) { mostrarAviso("No hay procesos en el catálogo para crear la prueba."); return; }
    if (!window.confirm("Se creará una acción de PRUEBA y la alerta (ventana emergente con sirena) te llegará solo a ti. Desde ella podrás reportar avance y la PM recibirá el aviso en su campanita. Después la eliminas con el lápiz. ¿Continuar?")) return;
    setProbando(true);
    try {
      const inicio = hoyISO();
      const fin = new Date(); fin.setDate(fin.getDate() + 7);
      const finISO = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
      const form = {
        proceso_id: String(procesos[0].id),
        procesos_ids: [Number(procesos[0].id)],
        tipo_brecha: "Operativa",
        nombre_accion: "PRUEBA · Avisos y reportes",
        todos_procesos: false,
        procesos_involucrados_ids: [],
        directrices_ids: [],
        directrices_propias_ids: [],
        causa_raiz: "Acción de prueba para comprobar las alertas y los reportes de avance.",
        accion_correctiva: "Ver la alerta, reportar avance y confirmar que la PM recibe el aviso. Se puede eliminar al terminar.",
        lider_persona_id: String(miPersonaId),
        supervisor_persona_id: "",
        lideres_ids: [miPersonaId],
        supervisores_ids: [],
        prioridad: "Media",
        fecha_inicio: inicio,
        fecha_compromiso: finISO,
        avance: 0,
        eficiencia_operativa: "",
      };
      const guardado = await createCorrectivo(form, currentUser, extendido, propiasDisponible, multiples);
      setItems((lista) => [...lista, guardado]);
      await notificarCorrectivo(guardado, [miPersonaId], currentUser);
      setAvisados((prev) => { const m = new Map(prev); m.set(Number(guardado.id), new Set([...(m.get(Number(guardado.id)) || []), miPersonaId])); return m; });
      setVistos((prev) => { const m = new Map(prev); m.set(Number(guardado.id), new Map([[miPersonaId, null]])); return m; });
      mostrarAviso("Prueba creada: en unos segundos te llega la alerta (ventana y sirena).");
    } catch (err) {
      console.error("Error al crear la prueba de avisos:", err);
      mostrarAviso("No se pudo crear la prueba. Inténtalo de nuevo.");
    } finally {
      setProbando(false);
    }
  }

  async function reportarAvance(item, reporte) {
    const nuevo = await reportarAvanceEquipo(item, reporte, currentUser, PM_PERSONA_ID);
    setAvances((lista) => [...lista, nuevo]);
  }

  async function crearDirectriz(nombre) {
    const creada = await createDirectrizPropia(nombre, currentUser);
    setDirectricesPropias((lista) => [...lista, creada].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    return creada;
  }

  async function eliminar() {
    if (!modal?.item?.id) return;
    if (!window.confirm("¿Eliminar esta acción correctiva? Se oculta del tablero y del Gantt.")) return;
    try {
      await deactivateCorrectivo(modal.item.id, currentUser);
      setItems((lista) => lista.filter((i) => i.id !== modal.item.id));
      setModal(null);
    } catch (err) {
      console.error("Error al eliminar acción correctiva:", err);
      mostrarAviso("No se pudo eliminar. Inténtalo de nuevo.");
    }
  }

  // El avance se guarda al soltar la barra; si falla, regresa al valor anterior.
  async function guardarAvance(item, avance) {
    const anterior = item.avance;
    setItems((lista) => lista.map((i) => (i.id === item.id ? { ...i, avance } : i)));
    try {
      await updateCorrectivo(item.id, { avance }, currentUser);
    } catch (err) {
      console.error("Error al guardar el avance:", err);
      setItems((lista) => lista.map((i) => (i.id === item.id ? { ...i, avance: anterior } : i)));
      mostrarAviso("No se pudo guardar el avance. Inténtalo de nuevo.");
    }
  }

  const abrirItem = (item) => (puedeEditar ? setModal({ item }) : setAbierto((cur) => (cur === item.id ? null : item.id)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a227]">Seguimiento estratégico</p>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1f3d]">Control Correctivo</h1>
          <p className="text-xs text-[#5b6472]">Acciones correctivas por proceso: causa, responsables, fecha compromiso y avance.</p>
        </div>
        {puedeEditar && !tablaFaltante && (
          <div className="flex flex-wrap items-center gap-2">
            {alertasDisponibles && avancesDisponible && (
              <button type="button" onClick={probarAvisos} disabled={probando} title="Crea una acción de prueba y te manda la alerta solo a ti" className={btnGhostClass}>{probando ? "Creando prueba…" : "🔔 Probar avisos"}</button>
            )}
            <button type="button" onClick={() => setModal({ item: null })} className={btnPrimaryClass}>+ Nueva acción</button>
          </div>
        )}
      </div>

      {tablaFaltante && (
        <div className={`${cardClass} mx-auto flex max-w-xl flex-col items-center gap-2 px-6 py-8 text-center`}>
          <span className="text-3xl">🛠️</span>
          <p className="text-base font-black text-[#0f1f3d]">Falta un paso para activar este módulo</p>
          <p className="text-sm text-[#5b6472]">La tabla donde se guardan las acciones correctivas todavía no existe en Supabase.</p>
          <ol className="mt-1 space-y-1 text-left text-sm text-[#0f1f3d]">
            <li>1. Abre Supabase → <span className="font-semibold">SQL Editor</span>.</li>
            <li>2. Pega y ejecuta el archivo <span className="font-semibold">sql/2026-10-control_correctivo.sql</span>.</li>
            <li>3. Recarga esta página.</li>
          </ol>
        </div>
      )}
      {!tablaFaltante && !loading && !extendido && puedeEditar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Para usar el nombre de la acción, los procesos involucrados y las directrices estratégicas, ejecuta una vez <span className="font-black">sql/2026-10-control_correctivo_v2.sql</span> en el SQL Editor de Supabase y recarga la página.
        </div>
      )}
      {!tablaFaltante && !loading && (!multiples || !alertasDisponibles) && puedeEditar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Para elegir varios procesos, líderes y supervisores, y para que les llegue la alerta con ventana emergente y sonido, ejecuta una vez <span className="font-black">sql/2026-10-control_correctivo_v4.sql</span> en el SQL Editor de Supabase y recarga la página.
        </div>
      )}
      {!tablaFaltante && !loading && multiples && alertasDisponibles && !avancesDisponible && puedeEditar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Para que los involucrados reporten su avance (barra, “mi parte está lista” o archivo), ejecuta una vez <span className="font-black">sql/2026-10-control_correctivo_v5.sql</span> en el SQL Editor de Supabase y recarga la página.
        </div>
      )}
      {errorCarga && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">No se pudieron cargar las acciones. Recarga la página; si sigue igual, avisa a sistemas.</div>
      )}
      {aviso && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{aviso}</div>}

      {!tablaFaltante && (
      <>
      <div className={`${cardClass} flex flex-wrap items-center gap-2 p-3`}>
        <div className="flex gap-1 rounded-xl bg-[#f7f7f4] p-1">
          {[["tablero", "Tablero"], ["gantt", "Gantt"]].map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setVista(clave)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${vista === clave ? "bg-[#0f1f3d] text-white shadow-sm" : "text-[#5b6472] hover:bg-white"}`}
            >
              {texto}
            </button>
          ))}
        </div>
        <select aria-label="Filtrar por proceso" value={filtros.proceso} onChange={(e) => setFiltros({ proceso: e.target.value })} className={`${selectFiltroClass} min-w-[220px] flex-1 sm:max-w-sm`}>
          <option value="">Todos los procesos</option>
          {procesos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {hayFiltros && (
          <button type="button" onClick={() => setFiltros(FILTROS_VACIO)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#5b6472] transition hover:bg-[#f7f7f4]">Limpiar</button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {ESTADOS.map((e) => (
            <span key={e} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${ESTADO_BADGE[e]}`}>{e} · {conteo[e]}</span>
          ))}
          <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-[#5b6472]">Avance promedio {promedioAvance}%</span>
        </div>
      </div>

      {loading ? (
        <div className={`${cardClass} py-12 text-center text-sm text-[#94a3b8]`}>Cargando…</div>
      ) : vista === "gantt" ? (
        <CorrectivoGantt items={filtrados} procesos={procesos} nombrePersona={nombrePersona} onOpen={abrirItem} />
      ) : filtrados.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-center gap-1 py-12 text-center`}>
          <span className="text-3xl text-slate-200">🛠️</span>
          <p className="text-sm font-bold text-slate-400">{conEstado.length === 0 ? (verTodo ? "Aún no hay acciones correctivas" : "No tienes acciones correctivas asignadas") : "Ninguna acción coincide con los filtros"}</p>
          {items.length === 0 && puedeEditar && !tablaFaltante && <p className="text-xs text-slate-400">Usa “+ Nueva acción” para registrar la primera.</p>}
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={`w-full ${avancesDisponible ? "min-w-[1000px]" : "min-w-[860px]"} border-collapse text-left`}>
              <thead>
                <tr className="border-b border-[#edf0f4] text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3">Proceso · brecha</th>
                  <th className="px-3 py-3">Causa raíz · acción correctiva</th>
                  <th className="px-3 py-3">Líder · supervisor</th>
                  <th className="px-3 py-3">Prioridad · compromiso</th>
                  <th className="px-3 py-3">Avance reportado</th>
                  {avancesDisponible && <th className="px-3 py-3">Avance del equipo</th>}
                  <th className="w-10 px-1 py-3" />
                </tr>
              </thead>
              <tbody>
                {grupos.flatMap((g) => g.filas.map((i) => ({ i, proceso: g.proceso }))).map(({ i, proceso }) => {
                  const expandido = abierto === i.id;
                  const alternar = () => setAbierto((cur) => (cur === i.id ? null : i.id));
                  return (
                    <tr key={i.id} className="border-b border-[#f1f3f6] align-top transition last:border-0 hover:bg-[#fafbfc]">
                      <td className="w-[170px] px-4 py-4">
                        <p className="text-[13px] font-bold leading-snug text-[#0f1f3d]">{proceso.nombre}</p>
                        {procesosDe(i).filter((pid) => pid !== Number(proceso.id)).map((pid) => (
                          <p key={pid} className="text-[12px] font-bold leading-snug text-[#0f1f3d]">{procesoPorId.get(pid) || `Proceso ${pid}`}</p>
                        ))}
                        <div className="mt-1.5"><Badge clase={BRECHA_BADGE[i.tipo_brecha]}>{i.tipo_brecha}</Badge></div>
                      </td>
                      <td className="px-3 py-4">
                        <button type="button" onClick={alternar} className="block w-full space-y-3 text-left" title={expandido ? "Ocultar detalle" : "Ver completo"}>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Acción correctiva</p>
                            {i.nombre_accion && <p className="mt-1 text-sm font-black leading-snug text-[#0f1f3d]">{i.nombre_accion}</p>}
                            <p className={`${i.nombre_accion ? "mt-0.5 text-xs font-medium text-[#5b6472]" : "mt-1 text-[13px] font-semibold text-[#0f1f3d]"} leading-relaxed ${expandido ? "" : "line-clamp-2"}`}>{i.accion_correctiva}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Causa raíz</p>
                            <p className={`mt-1 text-xs leading-relaxed text-[#6b7587] ${expandido ? "" : "line-clamp-2"}`}>{i.causa_raiz || "Sin causa raíz"}</p>
                          </div>
                        </button>
                        {(i.directrices_propias_ids || []).length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {(i.directrices_propias_ids || []).length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Directrices</span>
                                {i.directrices_propias_ids.map((did) => <span key={did} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">{propiaPorId.get(Number(did)) || `Directriz ${did}`}</span>)}
                              </div>
                            )}
                          </div>
                        )}
                        {(i.eficiencia_operativa || expandido) && (
                          <p className="mt-2 rounded-lg bg-[#f7f7f4] px-2.5 py-1.5 text-xs leading-snug text-[#5b6472]">
                            <span className="font-bold text-[#0f1f3d]">Eficiencia operativa: </span>
                            {i.eficiencia_operativa || "sin capturar"}
                          </p>
                        )}
                      </td>
                      <td className="w-[170px] px-3 py-4">
                        <div className="space-y-1.5">
                          {(lideresDe(i).length ? lideresDe(i) : [null]).map((pid, n) => <Persona key={pid ?? `l${n}`} nombre={nombrePersona(pid)} />)}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {(supervisoresDe(i).length ? supervisoresDe(i) : [null]).map((pid, n) => <Persona key={pid ?? `s${n}`} nombre={nombrePersona(pid)} suave />)}
                        </div>
                      </td>
                      <td className="w-[130px] px-3 py-4">
                        <Badge clase={PRIORIDAD_BADGE[i.prioridad]}>{i.prioridad}</Badge>
                        <p className="mt-2 text-xs font-semibold text-[#0f1f3d]">{fmtFecha(i.fecha_compromiso)}</p>
                        <p className={`text-[11px] font-semibold ${i.estado === "Vencida" ? "text-red-600" : i.estado === "Completada" ? "text-emerald-600" : "text-[#7b8494]"}`}>{textoVencimiento(i.fecha_compromiso, i.estado, hoy)}</p>
                      </td>
                      <td className="w-[150px] px-3 py-4">
                        <AvanceSlider value={i.avance} prioridad={i.prioridad} disabled={!puedeEditar} onCommit={(v) => guardarAvance(i, v)} compact />
                      </td>
                      {avancesDisponible && (() => {
                        // Resumen: cuántos involucrados reportaron, cuántos ya terminaron su parte y cuántos archivos hay.
                        const involucrados = involucradosDe(i);
                        const reportes = avancesPorItem.get(Number(i.id)) || [];
                        const ultimos = new Map();
                        reportes.forEach((r) => ultimos.set(Number(r.persona_id), r));
                        const listos = [...ultimos.values()].filter((r) => r.listo).length;
                        const archivos = reportes.filter((r) => r.archivo_url).length;
                        const ultimo = reportes[reportes.length - 1];
                        const soyInvolucrado = miPersonaId != null && involucrados.includes(miPersonaId);
                        return (
                          <td className="w-[170px] px-3 py-4">
                            <p className="text-xs font-bold text-[#0f1f3d]">{ultimos.size} de {involucrados.length} reportaron</p>
                            {(listos > 0 || archivos > 0) && (
                              <p className="mt-0.5 text-[11px] font-semibold text-[#5b6472]">
                                {listos > 0 && <span className="text-emerald-700">✓ {listos} lista{listos === 1 ? "" : "s"}</span>}
                                {listos > 0 && archivos > 0 && " · "}
                                {archivos > 0 && <span className="text-sky-700">📎 {archivos}</span>}
                              </p>
                            )}
                            {(() => {
                              const alertados = vistos.get(Number(i.id));
                              if (!alertados || alertados.size === 0) return null;
                              const vieron = [...alertados.values()].filter(Boolean).length;
                              return <p className={`mt-0.5 text-[11px] font-semibold ${vieron === alertados.size ? "text-emerald-700" : "text-amber-700"}`}>{vieron === alertados.size ? "✓ " : ""}{vieron} de {alertados.size} vieron la alerta</p>;
                            })()}
                            {ultimo && <p className="mt-0.5 text-[10px] font-semibold text-[#94a3b8]">Último: {fmtFecha(String(ultimo.created_at).slice(0, 10))}</p>}
                            <button
                              type="button"
                              onClick={() => abrirEquipo(i)}
                              className={`mt-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${soyInvolucrado ? "border-[#c9a227] bg-[#fbf6e3] text-[#7a5f0c] hover:bg-[#f6ecc9]" : "border-[#d9dee6] bg-white text-[#0f1f3d] hover:bg-[#f7f7f4]"}`}
                            >
                              {soyInvolucrado ? "+ Reportar mi avance" : "Ver detalle"}
                            </button>
                          </td>
                        );
                      })()}
                      <td className="px-1 py-4 text-right">
                        {puedeEditar && (
                          <button type="button" onClick={() => setModal({ item: i })} title="Editar" aria-label="Editar acción" className="rounded-lg px-2 py-1 text-sm text-[#94a3b8] transition hover:bg-[#f7f7f4] hover:text-[#0f1f3d]">✏️</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>
      )}

      {equipoItem && (
        <AvanceEquipoModal
          item={equipoItem}
          titulo={equipoItem.nombre_accion || equipoItem.accion_correctiva || "Acción correctiva"}
          color={PRIORIDAD_COLOR[equipoItem.prioridad] || "#64748b"}
          involucrados={involucradosDe(equipoItem)}
          reportes={avancesPorItem.get(Number(equipoItem.id)) || []}
          vistos={vistos.get(Number(equipoItem.id)) || new Map()}
          nombrePersona={nombrePersona}
          miPersonaId={miPersonaId}
          puedeReportar={miPersonaId != null && involucradosDe(equipoItem).includes(miPersonaId)}
          onReportar={(reporte) => reportarAvance(equipoItem, reporte)}
          onClose={() => setEquipoItem(null)}
        />
      )}

      {modal && (
        <CorrectivoFormModal
          item={modal.item}
          procesos={procesos}
          lideres={personas.lideres}
          supervisores={personas.supervisores}
          directrices={directrices}
          extendido={extendido}
          multiples={multiples}
          directricesPropias={directricesPropias}
          propiasDisponible={propiasDisponible}
          onCrearDirectriz={crearDirectriz}
          nombrePersona={nombrePersona}
          onSave={guardarForm}
          onClose={() => setModal(null)}
          onDelete={modal.item ? eliminar : null}
        />
      )}
    </div>
  );
}
