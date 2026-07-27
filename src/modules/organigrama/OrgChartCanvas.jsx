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

// Para cuando se agrega un puesto justo debajo de otro y hay que adivinar
// un nivel razonable "un escalón abajo" (Externo/Auditoría son etiquetas
// laterales, no forman parte de esta cadena descendente principal).
const NEXT_LEVEL_DOWN = {
  Direccion: "Gerencia",
  Gerencia: "Jefatura",
  Jefatura: "Supervision",
  Supervision: "Operativo",
  Operativo: "Operativo",
  Externo: "Operativo",
  Auditoria: "Operativo",
};

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
// El ajuste a pantalla nunca encoge por debajo de MIN_READABLE_FIT (mejor
// scroll que letras ilegibles) ni agranda más allá de MAX_READABLE_FIT
// (para no terminar con letras enormes cuando hay pocos puestos visibles).
const MIN_READABLE_FIT = 0.8;
const MAX_READABLE_FIT = 1.1;

const DRAG_THRESHOLD_PX = 4;
const ALIGN_THRESHOLD = 10;
// El conector dobla cerca del puesto que manda (no a la mitad del camino),
// para que la vuelta quede lo antes posible y no cruce por encima de otros
// puestos que estén más abajo, a un lado.
const LINE_BEND_OFFSET = 26;
const NUDGE_STEP = 15;

export default function OrgChartCanvas({ nodos, selectedId, onSelectNode, onMoveNode, onCreateNodeAt, canEdit, personasCatalogo = [], puestosCatalogo = [] }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const pendingRef = useRef(null); // arrastre (uno o varios) aún sin confirmar, antes de cruzar el umbral
  const marqueeRef = useRef(null); // selección por recuadro (arrastrar sobre espacio vacío)
  const justDraggedRef = useRef(false); // evita que el clic que sigue a un arrastre real abra el panel
  const [dragging, setDragging] = useState(null); // { id, ids?, origins?, offsetX, offsetY, x, y, guideX, guideY }
  const [marquee, setMarquee] = useState(null); // { x0, y0, x1, y1 } en coordenadas del lienzo, mientras se dibuja
  const [multiIds, setMultiIds] = useState(new Set());
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [manualScale, setManualScale] = useState(null); // null = ajustar a pantalla automáticamente
  const [collapsedIds, setCollapsedIds] = useState(null); // null = aún no se definió el default
  const [hoveredId, setHoveredId] = useState(null);

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

  // Un puesto "sin nombre y sin persona vinculada" que sí tiene subordinados
  // es un equipo transversal (ej. "Oficina estratégica"): sus integrantes
  // viven dentro de su propio panel de perfil, nunca como cajas sueltas en
  // el lienzo — evita saturar el organigrama con roles que no tienen mando
  // ni son parte de la línea jerárquica principal.
  const { groupContainerIds, groupHiddenIds } = useMemo(() => {
    const containerIds = new Set();
    const hiddenIds = new Set();
    nodos.forEach((nodo) => {
      if (!nodo.persona_id && !nodo.nombre_persona && hasChildren(nodos, nodo.id)) {
        containerIds.add(nodo.id);
        getChildren(nodos, nodo.id).forEach((child) => hiddenIds.add(child.id));
      }
    });
    return { groupContainerIds: containerIds, groupHiddenIds: hiddenIds };
  }, [nodos]);

  const visibleNodos = useMemo(
    () => getVisibleNodos(nodos, effectiveCollapsed).filter((nodo) => !groupHiddenIds.has(nodo.id)),
    [nodos, effectiveCollapsed, groupHiddenIds]
  );

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
  const fitScale = Math.min(MAX_READABLE_FIT, Math.max(MIN_READABLE_FIT, rawFit));
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, manualScale ?? fitScale));

  // Pasar el cursor sobre un puesto resalta lo mismo que seleccionarlo
  // (sin necesidad de hacer clic ni abrir el panel); si además hay uno
  // seleccionado, el resaltado del clic manda.
  const activeHighlightId = selectedId || hoveredId;
  // Línea de mando hacia arriba (a quién reporta, incluyéndose a sí mismo).
  const ancestorIds = useMemo(() => {
    if (!activeHighlightId) return new Set();
    return new Set(getAncestorChain(nodos, activeHighlightId).map((nodo) => nodo.id));
  }, [nodos, activeHighlightId]);
  // Quiénes le reportan directamente (un nivel hacia abajo).
  const directReportIds = useMemo(() => {
    if (!activeHighlightId) return new Set();
    return new Set(getChildren(nodos, activeHighlightId).map((nodo) => nodo.id));
  }, [nodos, activeHighlightId]);

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
  const boxById = new Map(boxes.map((box) => [box.nodo.id, box]));

  // Posición renderizada de un puesto, ya sea que esté quieto, arrastrado
  // solo, o arrastrado como parte de una selección de varios (cada quien se
  // mueve el mismo delta que el puesto "ancla" que agarraste, para que el
  // grupo entero se desplace junto y las líneas se sigan ajustando solas).
  function getRenderPosition(id) {
    const box = boxById.get(id);
    if (!box) return null;
    if (!dragging) return { left: box.left, top: box.top };
    if (dragging.ids) {
      if (!dragging.ids.includes(id)) return { left: box.left, top: box.top };
      const origin = dragging.origins[id];
      const anchorOrigin = dragging.origins[dragging.id];
      const dx = dragging.x - anchorOrigin.left;
      const dy = dragging.y - anchorOrigin.top;
      return { left: origin.left + dx, top: origin.top + dy };
    }
    if (dragging.id === id) return { left: dragging.x, top: dragging.y };
    return { left: box.left, top: box.top };
  }

  // Clic normal en la caja = seleccionarla (ver perfil). Si esa misma caja
  // se arrastra (moverla) primero, no queremos que el clic al soltar abra
  // el panel — por eso empieza como "pendiente" y solo se vuelve un
  // arrastre real al cruzar unos pocos pixeles de movimiento.
  function handleBoxMouseDown(event, nodo) {
    if (!canEdit || !canvasRef.current) return;

    // Mayús+clic: solo agrega/quita del grupo seleccionado, no mueve nada
    // ni abre el perfil — así se arma la selección múltiple.
    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      setMultiIds((current) => {
        const next = new Set(current);
        if (next.has(nodo.id)) next.delete(nodo.id);
        else next.add(nodo.id);
        return next;
      });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const isGroupDrag = multiIds.has(nodo.id) && multiIds.size > 1;

    if (isGroupDrag) {
      const ids = [...multiIds];
      const origins = {};
      ids.forEach((id) => {
        const box = boxById.get(id);
        if (box) origins[id] = { left: box.left, top: box.top };
      });
      const anchorBox = boxById.get(nodo.id);
      pendingRef.current = {
        ids,
        origins,
        id: nodo.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        offsetX: (event.clientX - rect.left) / scale - (anchorBox?.left ?? 0),
        offsetY: (event.clientY - rect.top) / scale - (anchorBox?.top ?? 0),
      };
      return;
    }

    // Clic simple en un puesto fuera del grupo actual: sale del modo
    // multi-selección y arrastra solo ese puesto.
    if (multiIds.size > 0) setMultiIds(new Set());
    const box = boxById.get(nodo.id);
    pendingRef.current = {
      id: nodo.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: (event.clientX - rect.left) / scale - (box?.left ?? 0),
      offsetY: (event.clientY - rect.top) / scale - (box?.top ?? 0),
    };
  }

  // Mousedown sobre el fondo (no una caja): empieza a dibujar el recuadro
  // de selección múltiple (estilo "rubber band" de escritorio).
  function handleCanvasMouseDown(event) {
    if (!canEdit || !canvasRef.current || event.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    marqueeRef.current = { x0: x, y0: y, shiftKey: event.shiftKey };
  }

  function moveDrag(event) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (marqueeRef.current) {
      const x = (event.clientX - rect.left) / scale;
      const y = (event.clientY - rect.top) / scale;
      setMarquee({ x0: marqueeRef.current.x0, y0: marqueeRef.current.y0, x1: x, y1: y });
      return;
    }

    if (dragging) {
      const rawX = (event.clientX - rect.left) / scale - dragging.offsetX;
      const rawY = (event.clientY - rect.top) / scale - dragging.offsetY;

      // Autoalineación: si el centro del puesto "ancla" que arrastras queda
      // cerca del centro horizontal o vertical de otro puesto fuera del
      // grupo que se mueve, se ajusta exacto a esa línea — como las guías
      // de Figma/PowerPoint. Sigue siendo libre: solo "engancha" al
      // acercarte, no fuerza ninguna cuadrícula fija.
      const centerX = rawX + BOX_WIDTH / 2;
      const centerY = rawY + BOX_HEIGHT / 2;
      let snappedCenterX = centerX;
      let snappedCenterY = centerY;
      let guideX = null;
      let guideY = null;
      const excluded = new Set(dragging.ids || [dragging.id]);

      boxes.forEach((box) => {
        if (excluded.has(box.nodo.id)) return;
        const otherCenterX = box.left + BOX_WIDTH / 2;
        const otherCenterY = box.top + BOX_HEIGHT / 2;
        if (guideX === null && Math.abs(centerX - otherCenterX) <= ALIGN_THRESHOLD) {
          snappedCenterX = otherCenterX;
          guideX = otherCenterX;
        }
        if (guideY === null && Math.abs(centerY - otherCenterY) <= ALIGN_THRESHOLD) {
          snappedCenterY = otherCenterY;
          guideY = otherCenterY;
        }
      });

      setDragging((current) => ({
        ...current,
        x: snappedCenterX - BOX_WIDTH / 2,
        y: snappedCenterY - BOX_HEIGHT / 2,
        guideX,
        guideY,
      }));
      return;
    }

    if (pendingRef.current) {
      const dx = event.clientX - pendingRef.current.startClientX;
      const dy = event.clientY - pendingRef.current.startClientY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        const rawX = (event.clientX - rect.left) / scale - pendingRef.current.offsetX;
        const rawY = (event.clientY - rect.top) / scale - pendingRef.current.offsetY;
        setDragging({ ...pendingRef.current, x: rawX, y: rawY });
      }
    }
  }

  // Libertad total: el/los bloque(s) quedan exactamente en el pixel donde
  // los sueltes, sin ajustarse a ninguna cuadrícula ni evitar encimarse con
  // otros — así se puede acomodar a mano tal cual se quiera.
  function stopDrag() {
    if (marqueeRef.current && marquee) {
      // Se guarda en una variable local antes de seguir: marqueeRef.current
      // se limpia a null unas líneas más abajo, pero el callback de
      // setMultiIds corre después (en el siguiente render), así que leerlo
      // directamente ahí ya lo encontraría en null y tronaba la pantalla.
      const wasShiftKey = marqueeRef.current.shiftKey;
      const left = Math.min(marquee.x0, marquee.x1);
      const right = Math.max(marquee.x0, marquee.x1);
      const top = Math.min(marquee.y0, marquee.y1);
      const bottom = Math.max(marquee.y0, marquee.y1);
      const hit = boxes.filter(
        (box) => box.left < right && box.left + BOX_WIDTH > left && box.top < bottom && box.top + BOX_HEIGHT > top
      );
      if (hit.length > 0) {
        setMultiIds((current) => {
          const next = wasShiftKey ? new Set(current) : new Set();
          hit.forEach((box) => next.add(box.nodo.id));
          return next;
        });
      } else if (!wasShiftKey) {
        setMultiIds(new Set());
      }
    }
    marqueeRef.current = null;
    setMarquee(null);

    if (dragging) {
      // Nunca en negativo: el lienzo se mide desde (0,0) sin desplazarse
      // (ver organigramaLayout.computeLayout) — una posición negativa
      // quedaría fuera de ese cuadro y volvería a "flotar" con cada
      // recálculo.
      if (dragging.ids) {
        dragging.ids.forEach((id) => {
          const pos = getRenderPosition(id);
          if (!pos) return;
          onMoveNode(id, Math.max(0, pos.left + BOX_WIDTH / 2 - PADDING), Math.max(0, pos.top - PADDING));
        });
      } else {
        onMoveNode(dragging.id, Math.max(0, dragging.x + BOX_WIDTH / 2 - PADDING), Math.max(0, dragging.y - PADDING));
      }
      justDraggedRef.current = true;
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

  // Flechas del teclado: si hay una selección múltiple, mueve todo el
  // grupo un paso fijo en la dirección presionada (equivalente a arrastrar
  // con el mouse, pero preciso para ajustes finos).
  useEffect(() => {
    if (!canEdit) return undefined;
    function handleKeyDown(event) {
      if (multiIds.size === 0) return;
      const deltas = { ArrowUp: [0, -NUDGE_STEP], ArrowDown: [0, NUDGE_STEP], ArrowLeft: [-NUDGE_STEP, 0], ArrowRight: [NUDGE_STEP, 0] };
      const delta = deltas[event.key];
      if (!delta) return;
      const target = event.target;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      multiIds.forEach((id) => {
        const box = boxById.get(id);
        if (!box) return;
        onMoveNode(id, Math.max(0, box.left + delta[0] + BOX_WIDTH / 2 - PADDING), Math.max(0, box.top + delta[1] - PADDING));
      });
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, multiIds, boxes]);

  // Detecta con qué otros puestos "se relaciona" el punto donde vas a
  // soltar uno nuevo: si queda a la altura de otros (misma línea), se
  // vuelve su hermano (mismo jefe y mismo nivel); si no, pero hay uno
  // claramente arriba y alineado, se vuelve su subordinado (nivel un
  // escalón abajo). Así no hay que ir al panel a capturar "Reporta a" a
  // mano cada vez.
  function detectPlacementContext(posX, posY) {
    const centerX = posX + BOX_WIDTH / 2;
    const sameRow = boxes.find((box) => Math.abs(box.top - posY) <= BOX_HEIGHT * 0.6);
    if (sameRow) {
      return { reportaAId: sameRow.nodo.reporta_a_id ?? null, nivel: sameRow.nodo.nivel };
    }

    const above = boxes
      .filter((box) => Math.abs(box.left + BOX_WIDTH / 2 - centerX) <= BOX_WIDTH && box.top < posY - BOX_HEIGHT * 0.4)
      .sort((a, b) => (posY - a.top) - (posY - b.top))[0];
    if (above) {
      return { reportaAId: above.nodo.id, nivel: NEXT_LEVEL_DOWN[above.nodo.nivel] || "Operativo" };
    }

    return { reportaAId: null, nivel: "Operativo" };
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
    onCreateNodeAt(posX, posY, detectPlacementContext(posX, posY));
  }

  function zoomBy(factor) {
    setManualScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor)));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canEdit && (
          <p className="text-[9px] font-bold text-slate-400">
            Arrastra un puesto para moverlo · arrastra sobre el fondo (o Mayús+clic) para seleccionar varios y moverlos juntos con flechas o arrastre · doble clic en espacio vacío para agregar uno nuevo
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
        onMouseMove={moveDrag}
        onMouseUp={stopDrag}
        onMouseLeave={() => (dragging || marqueeRef.current) && stopDrag()}
      >
        {/* Este div reserva exactamente el tamaño ya escalado, para que el
            scroll del contenedor no deje espacio en blanco de más (transform:
            scale no reduce el tamaño de layout, solo el visual). */}
        <div style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
          <div
            ref={canvasRef}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseDown={handleCanvasMouseDown}
            className="relative origin-top-left"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
              cursor: canEdit ? "crosshair" : "default",
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
              const childPos = getRenderPosition(nodo.id);
              const parentPos = getRenderPosition(nodo.reporta_a_id);
              if (!childPos || !parentPos) return null;
              const px = parentPos.left + BOX_WIDTH / 2;
              const py = parentPos.top + BOX_HEIGHT;
              const cx = childPos.left + BOX_WIDTH / 2;
              const cy = childPos.top;
              const bendY = py + Math.sign(cy - py || 1) * Math.min(LINE_BEND_OFFSET, Math.abs(cy - py) / 2);
              const isChainOfCommand = ancestorIds.has(nodo.id) && ancestorIds.has(nodo.reporta_a_id);
              const isDirectReportEdge = selectedId && nodo.reporta_a_id === selectedId && directReportIds.has(nodo.id);
              const isEmphasized = isChainOfCommand || isDirectReportEdge;
              const strokeColor = isChainOfCommand ? "#dc2626" : isDirectReportEdge ? "#10b981" : "#94a3b8";
              return (
                <g key={nodo.id} filter={isEmphasized ? "url(#orgLineGlow)" : undefined}>
                  <path
                    d={`M ${px} ${py} L ${px} ${bendY} L ${cx} ${bendY} L ${cx} ${cy}`}
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

            {/* Guías de alineación: aparecen mientras arrastras y quedas
                cerca del centro horizontal/vertical de otro puesto. */}
            {dragging?.guideX != null && (
              <line x1={dragging.guideX} y1={0} x2={dragging.guideX} y2={canvasHeight} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,4" />
            )}
            {dragging?.guideY != null && (
              <line x1={0} y1={dragging.guideY} x2={canvasWidth} y2={dragging.guideY} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,4" />
            )}
          </svg>

          {/* Recuadro de selección múltiple mientras se arrastra sobre el fondo. */}
          {marquee && (
            <div
              className="pointer-events-none absolute z-40 border border-blue-500 bg-blue-500/10"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          )}

          {boxes.map(({ nodo, left, top }) => {
            const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;
            const isDragged = dragging && (dragging.ids ? dragging.ids.includes(nodo.id) : dragging.id === nodo.id);
            const isSelected = selectedId === nodo.id;
            const isMultiSelected = multiIds.has(nodo.id);
            const isAncestor = !isSelected && ancestorIds.has(nodo.id);
            const isDirectReport = !isSelected && directReportIds.has(nodo.id);
            const renderPos = getRenderPosition(nodo.id) || { left, top };
            const relationRing = isMultiSelected
              ? "ring-[3px] ring-blue-500"
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
                onMouseEnter={() => setHoveredId(nodo.id)}
                onMouseLeave={() => setHoveredId((current) => (current === nodo.id ? null : current))}
                className={`group absolute flex select-none flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-center shadow-sm transition-shadow ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} hover:shadow-md hover:ring-2 hover:ring-slate-300 ${colors.bg} ${colors.border} ${colors.text} ${
                  isDragged ? "z-30 shadow-xl" : "z-10"
                } ${relationRing}`}
                style={{ left: renderPos.left, top: renderPos.top, width: BOX_WIDTH, height: BOX_HEIGHT }}
                title={`${NIVEL_LABELS[nodo.nivel] || nodo.nivel} · clic para ver perfil, arrastra para mover, Mayús+clic para selección múltiple`}
              >
                <p className="line-clamp-2 text-[12px] font-black uppercase leading-tight tracking-wide">{getDisplayTitle(nodo, puestosCatalogo)}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold opacity-80">{firstNameOnly(getDisplayName(nodo, personasCatalogo)) || "Sin asignar"}</p>
                <span className="pointer-events-none absolute bottom-1 right-1.5 text-[10px] font-black opacity-0 group-hover:opacity-60">ⓘ</span>

                {childCount > 0 && !groupContainerIds.has(nodo.id) && (
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
