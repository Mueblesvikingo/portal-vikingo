import { useEffect, useState } from "react";
import { canEditModule } from "../../services/permissionsService";
import { getPersonas, getPuestos } from "../../services/organizationCatalogService";
import {
  getOrganigramaNodos,
  createNodo,
  updateNodo,
  updateNodoPosition,
  deactivateNodo,
  restoreNodosSnapshot,
  getConexiones,
} from "../../services/organigramaService";
import OrgChartCanvas from "./OrgChartCanvas";
import NodeDetailPanel from "./NodeDetailPanel";
import { NIVEL_COLORS, NIVEL_LABELS, NIVEL_OPTIONS } from "./organigramaLayout";

const EMPTY_NEW_NODO = {
  titulo_puesto: "",
  nombre_persona: "",
  nivel: "Operativo",
  reporta_a_id: "",
  tipo_linea: "solida",
};

export default function OrganigramaModule({ currentUser }) {
  const [nodos, setNodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNodo, setNewNodo] = useState(EMPTY_NEW_NODO);
  const [message, setMessage] = useState("");
  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [puestosCatalogo, setPuestosCatalogo] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [undoing, setUndoing] = useState(false);

  const canEdit = canEditModule(currentUser, "organigrama");

  // Se llama justo ANTES de cualquier acción que cambie un puesto (mover,
  // editar, reasignar jefe, crear, quitar) para poder deshacerla después.
  // Deshacer/rehacer sí se guardan de verdad en Supabase (no es solo un
  // efecto visual que se pierde al recargar).
  function pushHistory() {
    setUndoStack((current) => [...current.slice(-19), nodos]);
    setRedoStack([]);
  }

  async function handleUndo() {
    if (undoStack.length === 0 || undoing) return;
    setUndoing(true);
    const previous = undoStack[undoStack.length - 1];
    const result = await restoreNodosSnapshot(previous, nodos);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible deshacer.");
      setUndoing(false);
      return;
    }
    setRedoStack((current) => [...current.slice(-19), nodos]);
    setUndoStack((current) => current.slice(0, -1));
    await loadNodos();
    setUndoing(false);
  }

  async function handleRedo() {
    if (redoStack.length === 0 || undoing) return;
    setUndoing(true);
    const next = redoStack[redoStack.length - 1];
    const result = await restoreNodosSnapshot(next, nodos);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible rehacer.");
      setUndoing(false);
      return;
    }
    setUndoStack((current) => [...current.slice(-19), nodos]);
    setRedoStack((current) => current.slice(0, -1));
    await loadNodos();
    setUndoing(false);
  }

  async function loadNodos() {
    setLoading(true);
    const data = await getOrganigramaNodos();
    setNodos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadNodos();
    // Catálogo real (personas/puestos de Catálogo Organizacional) para
    // autocompletar nombre y título con lo que ya existe, en vez de texto
    // libre desconectado de la fuente oficial.
    getPersonas().then(setPersonasCatalogo).catch(() => setPersonasCatalogo([]));
    getPuestos().then(setPuestosCatalogo).catch(() => setPuestosCatalogo([]));
    getConexiones().then(setConexiones).catch(() => setConexiones([]));
  }, []);

  // Si el nombre/título capturado coincide exactamente (sin distinguir
  // mayúsculas) con una persona/puesto real del catálogo, se guarda también
  // su id para dejar el vínculo real — así, cuando alguien edite esa
  // persona o puesto en Catálogo Organizacional, el organigrama se
  // actualiza solo (ver getDisplayName/getDisplayTitle en organigramaLayout.js).
  function matchPersonaId(nombre) {
    const match = personasCatalogo.find((persona) => persona.nombre?.trim().toLowerCase() === String(nombre || "").trim().toLowerCase());
    return match ? match.id : null;
  }

  function matchPuestoId(titulo) {
    const match = puestosCatalogo.find((puesto) => puesto.nombre?.trim().toLowerCase() === String(titulo || "").trim().toLowerCase());
    return match ? match.id : null;
  }

  const selectedNodo = nodos.find((nodo) => nodo.id === selectedId) || null;

  async function handleSaveNodo(id, draft) {
    pushHistory();
    const result = await updateNodo(id, {
      ...draft,
      persona_id: matchPersonaId(draft.nombre_persona),
      puesto_id: matchPuestoId(draft.titulo_puesto),
    });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar los cambios.");
      return;
    }
    await loadNodos();
    setMessage("Puesto actualizado.");
  }

  async function handleDeactivateNodo(id) {
    pushHistory();
    const result = await deactivateNodo(id);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar el puesto.");
      return;
    }
    setSelectedId(null);
    await loadNodos();
    setMessage("Puesto quitado del organigrama.");
  }

  async function handleAssignParent(childId, newParentId) {
    pushHistory();
    const result = await updateNodo(childId, { reporta_a_id: newParentId });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar la conexión.");
      return;
    }
    await loadNodos();
    setMessage("Conexión actualizada.");
  }

  async function handleMoveNode(id, posX, posY) {
    pushHistory();
    // Actualización optimista: el bloque ya se ve donde lo soltaste, solo
    // se persiste en segundo plano sin recargar/parpadear todo el árbol.
    setNodos((current) => current.map((nodo) => (nodo.id === id ? { ...nodo, pos_x: posX, pos_y: posY } : nodo)));
    const result = await updateNodoPosition(id, posX, posY);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la posición.");
    }
  }

  // Doble clic en un espacio vacío del lienzo: crea un puesto en blanco
  // justo ahí (sin jefe todavía) y abre su panel para llenarlo al instante,
  // sin pasar por el formulario modal.
  async function handleCreateNodeAt(posX, posY, detected) {
    pushHistory();
    const result = await createNodo({
      titulo_puesto: "Nuevo puesto",
      nivel: detected?.nivel || "Operativo",
      reporta_a_id: detected?.reportaAId ?? null,
      orden: 0,
      pos_x: posX,
      pos_y: posY,
    });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible crear el puesto.");
      return;
    }
    await loadNodos();
    setSelectedId(result.data.id);
  }

  async function handleCreateNodo() {
    if (!newNodo.titulo_puesto.trim()) {
      setMessage("Captura un título de puesto.");
      return;
    }
    const siblingCount = nodos.filter(
      (nodo) => (nodo.reporta_a_id ?? null) === (newNodo.reporta_a_id ? Number(newNodo.reporta_a_id) : null)
    ).length;
    pushHistory();
    const result = await createNodo({
      ...newNodo,
      reporta_a_id: newNodo.reporta_a_id ? Number(newNodo.reporta_a_id) : null,
      persona_id: matchPersonaId(newNodo.nombre_persona),
      puesto_id: matchPuestoId(newNodo.titulo_puesto),
      orden: siblingCount,
    });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible crear el puesto.");
      return;
    }
    setShowAddModal(false);
    setNewNodo(EMPTY_NEW_NODO);
    await loadNodos();
    setMessage("Puesto agregado.");
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#001225] px-4 py-2 text-white">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black uppercase tracking-widest">Organigrama</p>
            <span
              title="Clic: perfil, línea de mando y subordinados. Arrastra un puesto para moverlo — se queda donde lo sueltes. Usa &quot;+ Nuevo puesto&quot; para agregar uno."
              className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 text-[9px] font-black text-white/50 hover:text-white"
            >
              ?
            </span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <div className="flex items-center overflow-hidden rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 || undoing}
                  title="Deshacer"
                  className="px-2 py-1.5 text-[11px] font-black text-white/50 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0 || undoing}
                  title="Rehacer"
                  className="border-l border-white/10 px-2 py-1.5 text-[11px] font-black text-white/50 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↻
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="rounded-xl bg-white/10 px-3 py-1.5 text-[10px] font-black text-white hover:bg-white/20"
              >
                + Nuevo puesto
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          {NIVEL_OPTIONS.map((nivel) => {
            const colors = NIVEL_COLORS[nivel];
            return (
              <span key={nivel} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${colors.border} ${colors.text} ${colors.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} /> {NIVEL_LABELS[nivel]}
              </span>
            );
          })}
          <span className="ml-auto flex items-center gap-3 text-[9px] font-bold text-slate-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-full bg-red-400" /> A quién reporta</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-full bg-emerald-400" /> Quién le reporta</span>
          </span>
        </div>

        {message && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[10px] font-bold text-emerald-700">{message}</div>
        )}

        <div className="p-3">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">Cargando organigrama...</div>
          ) : nodos.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">
              Todavía no hay puestos en el organigrama. {canEdit && 'Usa "+ Nuevo puesto" para empezar.'}
            </div>
          ) : (
            <OrgChartCanvas
              nodos={nodos}
              selectedId={selectedId}
              onSelectNode={setSelectedId}
              onMoveNode={handleMoveNode}
              onCreateNodeAt={handleCreateNodeAt}
              canEdit={canEdit}
              personasCatalogo={personasCatalogo}
              puestosCatalogo={puestosCatalogo}
              conexiones={conexiones}
            />
          )}
        </div>
      </div>

      <NodeDetailPanel
        nodo={selectedNodo}
        nodos={nodos}
        canEdit={canEdit}
        onSave={handleSaveNodo}
        onDeactivate={handleDeactivateNodo}
        onAssignParent={handleAssignParent}
        onClose={() => setSelectedId(null)}
        personasCatalogo={personasCatalogo}
        puestosCatalogo={puestosCatalogo}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
              <p className="text-xs font-black uppercase tracking-widest">Nuevo puesto</p>
              <button type="button" onClick={() => setShowAddModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Título del puesto
                <input
                  list="organigrama-puestos-catalogo"
                  value={newNodo.titulo_puesto}
                  onChange={(event) => setNewNodo((current) => ({ ...current, titulo_puesto: event.target.value }))}
                  placeholder="Elige uno del catálogo o escribe uno nuevo"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                />
                <datalist id="organigrama-puestos-catalogo">
                  {puestosCatalogo.map((puesto) => (
                    <option key={puesto.id} value={puesto.nombre} />
                  ))}
                </datalist>
              </label>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nombre de quien lo ocupa
                <input
                  list="organigrama-personas-catalogo"
                  value={newNodo.nombre_persona}
                  onChange={(event) => setNewNodo((current) => ({ ...current, nombre_persona: event.target.value }))}
                  placeholder="Elige uno del catálogo o deja &quot;Sin asignar&quot;"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                />
                <datalist id="organigrama-personas-catalogo">
                  {personasCatalogo.map((persona) => (
                    <option key={persona.id} value={persona.nombre} />
                  ))}
                </datalist>
              </label>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nivel
                <select
                  value={newNodo.nivel}
                  onChange={(event) => setNewNodo((current) => ({ ...current, nivel: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                >
                  {NIVEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>{NIVEL_LABELS[option]}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Reporta a
                <select
                  value={newNodo.reporta_a_id}
                  onChange={(event) => setNewNodo((current) => ({ ...current, reporta_a_id: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                >
                  <option value="">Nadie (raíz del organigrama)</option>
                  {nodos.map((nodo) => (
                    <option key={nodo.id} value={nodo.id}>{nodo.titulo_puesto}{nodo.nombre_persona ? ` · ${nodo.nombre_persona}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tipo de línea
                <select
                  value={newNodo.tipo_linea}
                  onChange={(event) => setNewNodo((current) => ({ ...current, tipo_linea: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                >
                  <option value="solida">Sólida (mando directo)</option>
                  <option value="punteada">Punteada (asesoría / staff)</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
                <button type="button" onClick={handleCreateNodo} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Agregar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
