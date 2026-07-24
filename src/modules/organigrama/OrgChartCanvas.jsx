import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeLayout,
  getAncestorChain,
  getChildren,
  hasChildren,
  getVisibleNodos,
  getDisplayName,
  getDisplayTitle,
  NIVEL_COLORS,
  NIVEL_LABELS,
} from "./organigramaLayout";

// En Catálogo Organizacional los nombres van "APELLIDO APELLIDO NOMBRE" —
// en la caja solo se quiere mostrar el nombre de pila (última palabra), no
// los apellidos. Los nombres cargados directo en el organigrama (ya sin
// apellidos, ej. "Sajid") quedan igual porque son una sola palabra.
function firstNameOnly(fullName) {
  if (!fullName) return fullName;
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

const BOX_WIDTH = 176;
const BOX_HEIGHT = 80;
const PADDING = 60;
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.5;
// Nunca se auto-reduce por debajo de esto: mejor scroll que letras
// ilegibles. El ajuste a pantalla solo encoge hasta aquí.
const MIN_READABLE_FIT = 0.65;

const DRAG_THRESHOLD_PX = 4;

export default function OrgChartCanvas({ nodos, selectedId, onSelectNode, onMoveNode, onCreateNodeAt, canEdit, personasCatalogo = [], puestosCatalogo = [], conexiones = [], onCreateConexion, onDeleteConexion }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const pendingRef = useRef(null); // posible arrastre de movimiento aún sin confirmar (antes de cruzar el umbral)
  const justDraggedRef = useRef(false); // evita que el clic que sigue a un arrastre real abra el panel
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY, x, y }
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [manualScale, setManualScale] = useState(null); // null = ajustar a pantalla automáticamente
  const [collapsedIds, setCollapsedIds] = useState(null); // null = aún no se definió el default

  // Por default se colapsan las ramas debajo de Jefatura (Supervisión y
  // Operativo) para que el organigrama completo se lea de un vistazo; cada
  // quien puede expandir la rama que le interese.
  useEffect(() => {
    if (collapsedIds === null && nodos.length > 0) {
      const defaults = new Set(
        nodos.filter((nodo) => nodo.nivel === "Jefatura" && hasChildren(nodos, nodo.id)).map((nodo) => nodo.id)
      );
      setCollapsedIds(defaults);
    }
  }, [nodos, collapsedIds]);

  const effectiveCollapsed = collapsedIds || new Set();
  const visibleNodos = useMemo(() => getVisibleNodos(nodos, effectiveCollapsed), [nodos, effectiveCollapsed]);

  function toggleCollapse(id) {
    setCollapsedIds((current) => {
      const next = new Set(current || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const layout = useMemo(() => computeLayout(visibleNodos), [visibleNodos]);
  const canvasWidth = layout.width + PADDING * 2;
  const canvasHeight = layout.height + PADDING * 2 + BOX_HEIGHT + 16;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rawFit = viewportSize.width > 0 && canvasWidth > 0
    ? Math.min(1, viewportSize.width / canvasWidth, viewportSize.height / canvasHeight)
    : 1;
  const fitScale = Math.max(MIN_READABLE_FIT, rawFit);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, manualScale ?? fitScale));

  // Línea de mando hacia arriba (a quién reporta, incluyéndose a sí mismo).
  const ancestorIds = useMemo(() => {
    if (!selectedId) return new Set();
    return new Set(getAncestorChain(nodos, selectedId).map((nodo) => nodo.id));
  }, [nodos, selectedId]);
  // Quiénes le reportan directamente (un nivel hacia abajo).
  const directReportIds = useMemo(() => {
    if (!selectedId) return new Set();
    return new Set(getChildren(nodos, selectedId).map((nodo) => nodo.id));
  }, [nodos, selectedId]);

  const boxes = visibleNodos
    .map((nodo) => {
      const pos = layout.positions.get(nodo.id);
      if (!pos) return null;
      return {
        nodo,
        left: pos.x - BOX_WIDTH / 2 + PADDING,
        top: pos.y + PADDING,
      };
    })
    .filter(Boolean);

  // Clic normal en la caja = seleccionarla (ver perfil). Si esa misma caja
  // se arrastra (moverla) primero, no queremos que el clic al soltar abra
  // el panel — por eso empieza como "pendiente" y solo se vuelve un
  // arrastre real al cruzar unos pocos pixeles de movimiento.
  function handleBoxMouseDown(event, nodo) {
    if (!canEdit || !canvasRef.current) return;
    const box = boxes.find((b) => b.nodo.id === nodo.id);
    const rect = canvasRef.current.getBoundingClientRect();
    pendingRef.current = {
      id: nodo.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: (event.clientX - rect.left) / scale - (box?.left ?? 0),
      offsetY: (event.clientY - rect.top) / scale - (box?.top ?? 0),
    };
  }

  function moveDrag(event) {
    if (!canvasRef.current) return;
    if (dragging?.mode === "move") {
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (event.clientX - rect.left) / scale - dragging.offsetX;
      const rawY = (event.clientY - rect.top) / scale - dragging.offsetY;
      setDragging((current) => ({ ...current, x: rawX, y: rawY }));
      return;
    }
    if (pendingRef.current && !dragging) {
      const dx = event.clientX - pendingRef.current.startClientX;
      const dy = event.clientY - pendingRef.current.startClientY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = (event.clientX - rect.left) / scale - pendingRef.current.offsetX;
        const rawY = (event.clientY - rect.top) / scale - pendingRef.current.offsetY;
        setDragging({ id: pendingRef.current.id, mode: "move", offsetX: pendingRef.current.offsetX, offsetY: pendingRef.current.offsetY, x: rawX, y: rawY });
      }
    }
  }

  // Libertad total: el bloque se queda exactamente en el pixel donde lo
  // sueltes, sin ajustarse a ninguna cuadrícula ni evitar encimarse con
  // otros — así se puede acomodar a mano tal cual se quiera.
  function stopDrag() {
    if (dragging?.mode === "move") {
      // Nunca en negativo: el lienzo se mide desde (0,0) sin desplazarse
      // (ver organigramaLayout.computeLayout) — una posición negativa
      // quedaría fuera de ese cuadro y volvería a "flotar" con cada
      // recálculo.
      const posX = Math.max(0, dragging.x + BOX_WIDTH / 2 - PADDING);
      const posY = Math.max(0, dragging.y - PADDING);
      onMoveNode(dragging.id, posX, posY);
      justDraggedRef.current = true;
    } else if (dragging?.mode === "connect" && dragging.hoverTargetId && dragging.hoverTargetId !== dragging.id) {
      onCreateConexion(dragging.id, dragging.hoverTargetId);
    }
    pendingRef.current = null;
    setDragging(null);
  }

  function handleBoxClick(nodo) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onSelectNode(nodo.id);
  }

  // Doble clic en un espacio vacío del lienzo: crea un puesto nuevo justo
  // ahí, tipo Visio (doble clic en blanco → figura nueva lista para editar).
  function handleCanvasDoubleClick(event) {
    if (!canEdit || !canvasRef.current || event.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / scale;
    const rawY = (event.clientY - rect.top) / scale;
    const posX = Math.max(0, rawX - PADDING);
    const posY = Math.max(0, rawY - PADDING - BOX_HEIGHT / 2);
    onCreateNodeAt(posX, posY);
  }

  function startConnect(event, nodo) {
    if (!canEdit || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging({ id: nodo.id, mode: "connect", hoverTargetId: null });
  }

  function moveConnect(event) {
    if (!dragging || dragging.mode !== "connect" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / scale;
    const rawY = (event.clientY - rect.top) / scale;
    const hit = boxes.find((box) => rawX >= box.left && rawX <= box.left + BOX_WIDTH && rawY >= box.top && rawY <= box.top + BOX_HEIGHT);
    setDragging((current) => ({ ...current, hoverTargetId: hit && hit.nodo.id !== current.id ? hit.nodo.id : null, cursorX: rawX, cursorY: rawY }));
  }

  // Centro actual de un puesto en el lienzo, siguiendo el arrastre en vivo
  // si se está moviendo (para que las conexiones sueltas también "sigan al
  // cursor" como las de la línea de mando).
  function getRenderedCenter(nodeId) {
    if (dragging?.mode === "move" && dragging.id === nodeId) {
      return { x: dragging.x + BOX_WIDTH / 2, y: dragging.y + BOX_HEIGHT / 2 };
    }
    const box = boxes.find((b) => b.nodo.id === nodeId);
    if (!box) return null;
    return { x: box.left + BOX_WIDTH / 2, y: box.top + BOX_HEIGHT / 2 };
  }

  function zoomBy(factor) {
    setManualScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor)));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canEdit && (
          <p className="text-[9px] font-bold text-slate-400">
            Arrastra un puesto para moverlo · doble clic en un espacio vacío para agregar uno nuevo · 🔗 para conectar dos puestos
          </p>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => zoomBy(1 / 1.15)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 hover:bg-slate-50">－</button>
          <span className="min-w-[3.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-[10px] font-black text-slate-500">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.15)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 hover:bg-slate-50">＋</button>
          <button type="button" onClick={() => setManualScale(null)} className="ml-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">⤢ Ajustar a pantalla</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-auto rounded-2xl border border-slate-200 bg-slate-50/60"
        style={{ height: "min(75vh, 720px)" }}
        onMouseMove={(event) => { moveDrag(event); moveConnect(event); }}
        onMouseUp={stopDrag}
        onMouseLeave={() => dragging && stopDrag()}
      >
        {/* Este div reserva exactamente el tamaño ya escalado, para que el
            scroll del contenedor no deje espacio en blanco de más (transform:
            scale no reduce el tamaño de layout, solo el visual). */}
        <div style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
          <div
            ref={canvasRef}
            onDoubleClick={handleCanvasDoubleClick}
            className="relative origin-top-left"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
              cursor: canEdit ? "copy" : "default",
              backgroundImage: "radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)",
              backgroundSize: "24px 24px",
            }}
          >
          <svg className="pointer-events-none absolute inset-0" width={canvasWidth} height={canvasHeight}>
            <defs>
              <filter id="orgLineGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
              </filter>
            </defs>
            {visibleNodos.map((nodo) => {
              if (!nodo.reporta_a_id) return null;
              const childPos = layout.positions.get(nodo.id);
              const parentPos = layout.positions.get(nodo.reporta_a_id);
              if (!childPos || !parentPos) return null;
              // Si uno de los dos extremos se está arrastrando, la línea
              // sigue al cursor en vivo (como en Visio) en vez de quedarse
              // pegada a la posición anterior.
              const parentDragged = dragging?.mode === "move" && dragging.id === nodo.reporta_a_id;
              const childDragged = dragging?.mode === "move" && dragging.id === nodo.id;
              const px = (parentDragged ? dragging.x - PADDING + BOX_WIDTH / 2 : parentPos.x) + PADDING;
              const py = (parentDragged ? dragging.y - PADDING : parentPos.y) + PADDING + BOX_HEIGHT;
              const cx = (childDragged ? dragging.x - PADDING + BOX_WIDTH / 2 : childPos.x) + PADDING;
              const cy = (childDragged ? dragging.y - PADDING : childPos.y) + PADDING;
              const midY = (py + cy) / 2;
              const isChainOfCommand = ancestorIds.has(nodo.id) && ancestorIds.has(nodo.reporta_a_id);
              const isDirectReportEdge = selectedId && nodo.reporta_a_id === selectedId && directReportIds.has(nodo.id);
              const isEmphasized = isChainOfCommand || isDirectReportEdge;
              const strokeColor = isChainOfCommand ? "#dc2626" : isDirectReportEdge ? "#10b981" : "#94a3b8";
              return (
                <g key={nodo.id} filter={isEmphasized ? "url(#orgLineGlow)" : undefined}>
                  <path
                    d={`M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isEmphasized ? 3.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={nodo.tipo_linea === "punteada" ? "6,5" : undefined}
                  />
                  <circle cx={px} cy={py} r={isEmphasized ? 4 : 3} fill={strokeColor} />
                  <circle cx={cx} cy={cy} r={isEmphasized ? 4 : 3} fill={strokeColor} />
                </g>
              );
            })}

            {/* Conexiones sueltas (apoyo/coordinación): no forman parte del
                árbol jerárquico, se dibujan aparte y sí reciben clic para
                poder quitarlas directamente en el lienzo. */}
            {conexiones.map((conexion) => {
              const a = getRenderedCenter(conexion.nodo_a_id);
              const b = getRenderedCenter(conexion.nodo_b_id);
              if (!a || !b) return null;
              return (
                <line
                  key={conexion.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="3,7"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => onDeleteConexion(conexion.id)}
                >
                  <title>Conexión de apoyo — clic para quitarla</title>
                </line>
              );
            })}

            {/* Vista previa en vivo mientras arrastras el icono 🔗 hacia otro puesto. */}
            {dragging?.mode === "connect" && (() => {
              const from = getRenderedCenter(dragging.id);
              if (!from) return null;
              const to = dragging.hoverTargetId ? getRenderedCenter(dragging.hoverTargetId) : { x: dragging.cursorX, y: dragging.cursorY };
              if (!to) return null;
              return (
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#8b5cf6" strokeWidth={3} strokeDasharray="3,7" strokeLinecap="round" />
              );
            })()}
          </svg>

          {boxes.map(({ nodo, left, top }) => {
            const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;
            const isDragged = dragging?.mode === "move" && dragging.id === nodo.id;
            const isConnectSource = dragging?.mode === "connect" && dragging.id === nodo.id;
            const isConnectTarget = dragging?.mode === "connect" && dragging.hoverTargetId === nodo.id;
            const isSelected = selectedId === nodo.id;
            const isAncestor = !isSelected && ancestorIds.has(nodo.id);
            const isDirectReport = !isSelected && directReportIds.has(nodo.id);
            const boxLeft = isDragged ? dragging.x : left;
            const boxTop = isDragged ? dragging.y : top;
            const relationRing = isConnectTarget || isConnectSource
              ? "ring-[3px] ring-violet-500"
              : isSelected
                ? "ring-[3px] ring-[#001225]"
                : isAncestor
                  ? "ring-[3px] ring-red-400"
                  : isDirectReport
                    ? "ring-[3px] ring-emerald-400"
                    : "";
            const childCount = getChildren(nodos, nodo.id).length;

            return (
              <div
                key={nodo.id}
                onMouseDown={(event) => handleBoxMouseDown(event, nodo)}
                onClick={() => handleBoxClick(nodo)}
                className={`group absolute flex select-none flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-center shadow-sm transition-shadow ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} hover:shadow-md hover:ring-2 hover:ring-slate-300 ${colors.bg} ${colors.border} ${colors.text} ${
                  isDragged ? "z-30 shadow-xl" : "z-10"
                } ${relationRing}`}
                style={{ left: boxLeft, top: boxTop, width: BOX_WIDTH, height: BOX_HEIGHT }}
                title={`${NIVEL_LABELS[nodo.nivel] || nodo.nivel} · clic para ver perfil, arrastra para mover`}
              >
                {canEdit && (
                  <span
                    onMouseDown={(event) => startConnect(event, nodo)}
                    onClick={(event) => event.stopPropagation()}
                    title="Arrastrar hacia otro puesto para crear una conexión de apoyo/coordinación"
                    className="absolute -left-1.5 -top-1.5 flex h-6 w-6 cursor-crosshair items-center justify-center rounded-full border border-violet-300 bg-white text-xs opacity-70 shadow-sm hover:opacity-100"
                  >
                    🔗
                  </span>
                )}
                <p className="line-clamp-2 text-[12px] font-black uppercase leading-tight tracking-wide">{getDisplayTitle(nodo, puestosCatalogo)}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold opacity-80">{firstNameOnly(getDisplayName(nodo, personasCatalogo)) || "Sin asignar"}</p>
                <span className="pointer-events-none absolute bottom-1 right-1.5 text-[10px] font-black opacity-0 group-hover:opacity-60">ⓘ</span>

                {childCount > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleCollapse(nodo.id);
                    }}
                    title={effectiveCollapsed.has(nodo.id) ? `Mostrar ${childCount} subordinado(s)` : "Ocultar subordinados"}
                    className="absolute -bottom-3 left-1/2 z-20 flex h-6 min-w-[24px] -translate-x-1/2 items-center justify-center rounded-full border border-slate-300 bg-white px-1 text-[10px] font-black text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    {effectiveCollapsed.has(nodo.id) ? `+${childCount}` : "－"}
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
