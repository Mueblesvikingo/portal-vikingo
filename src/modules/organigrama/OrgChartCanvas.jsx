import { useMemo, useRef, useState } from "react";
import { computeLayout, canReparent, getAncestorChain, NIVEL_COLORS, NIVEL_LABELS } from "./organigramaLayout";

const BOX_WIDTH = 168;
const BOX_HEIGHT = 74;
const PADDING = 50;

export default function OrgChartCanvas({ nodos, selectedId, onSelectNode, onReparent, canEdit }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY, x, y }
  const [hoverTargetId, setHoverTargetId] = useState(null);

  const layout = useMemo(() => computeLayout(nodos), [nodos]);
  const highlightedIds = useMemo(() => {
    if (!selectedId) return new Set();
    return new Set(getAncestorChain(nodos, selectedId).map((nodo) => nodo.id));
  }, [nodos, selectedId]);

  const boxes = nodos
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

  function hitTest(rawX, rawY) {
    const hit = boxes.find(
      (box) =>
        rawX >= box.left &&
        rawX <= box.left + BOX_WIDTH &&
        rawY >= box.top &&
        rawY <= box.top + BOX_HEIGHT
    );
    return hit ? hit.nodo.id : null;
  }

  function startDrag(event, nodo) {
    if (!canEdit || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const box = boxes.find((b) => b.nodo.id === nodo.id);
    setDragging({
      id: nodo.id,
      offsetX: event.clientX - rect.left - (box?.left ?? 0),
      offsetY: event.clientY - rect.top - (box?.top ?? 0),
    });
  }

  function moveDrag(event) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = event.clientX - rect.left - dragging.offsetX;
    const rawY = event.clientY - rect.top - dragging.offsetY;
    const centerX = rawX + BOX_WIDTH / 2;
    const centerY = rawY + BOX_HEIGHT / 2;
    const target = hitTest(centerX, centerY);
    setHoverTargetId(target && target !== dragging.id ? target : null);
    setDragging((current) => ({ ...current, x: rawX, y: rawY }));
  }

  function stopDrag() {
    if (dragging && hoverTargetId && canReparent(nodos, dragging.id, hoverTargetId)) {
      const siblingCount = nodos.filter((nodo) => (nodo.reporta_a_id ?? null) === hoverTargetId).length;
      onReparent(dragging.id, hoverTargetId, siblingCount);
    }
    setDragging(null);
    setHoverTargetId(null);
  }

  return (
    <div
      className="relative overflow-auto rounded-2xl border border-slate-200 bg-slate-50/60"
      style={{ height: "70vh" }}
      onMouseMove={moveDrag}
      onMouseUp={stopDrag}
      onMouseLeave={() => dragging && stopDrag()}
    >
      <div
        ref={canvasRef}
        className="relative"
        style={{ width: layout.width + PADDING * 2, height: layout.height + PADDING * 2 + BOX_HEIGHT }}
      >
        <svg className="pointer-events-none absolute inset-0" width="100%" height="100%">
          {nodos.map((nodo) => {
            if (!nodo.reporta_a_id) return null;
            const childPos = layout.positions.get(nodo.id);
            const parentPos = layout.positions.get(nodo.reporta_a_id);
            if (!childPos || !parentPos) return null;
            const px = parentPos.x + PADDING;
            const py = parentPos.y + PADDING + BOX_HEIGHT;
            const cx = childPos.x + PADDING;
            const cy = childPos.y + PADDING;
            const midY = (py + cy) / 2;
            const isHighlighted = highlightedIds.has(nodo.id) && highlightedIds.has(nodo.reporta_a_id);
            return (
              <path
                key={nodo.id}
                d={`M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`}
                fill="none"
                stroke={isHighlighted ? "#dc2626" : "#cbd5e1"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={nodo.tipo_linea === "punteada" ? "5,4" : undefined}
              />
            );
          })}
        </svg>

        {boxes.map(({ nodo, left, top }) => {
          const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;
          const isDragged = dragging?.id === nodo.id;
          const isDropTarget = hoverTargetId === nodo.id;
          const isSelected = selectedId === nodo.id;
          const boxLeft = isDragged ? dragging.x : left;
          const boxTop = isDragged ? dragging.y : top;

          return (
            <div
              key={nodo.id}
              onMouseDown={(event) => startDrag(event, nodo)}
              onClick={() => !isDragged && onSelectNode(nodo.id)}
              className={`absolute flex select-none flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center shadow-sm transition-shadow ${colors.bg} ${colors.border} ${colors.text} ${
                isDragged ? "z-30 cursor-grabbing shadow-xl" : canEdit ? "z-10 cursor-grab hover:shadow-md" : "z-10 cursor-pointer hover:shadow-md"
              } ${isDropTarget ? "ring-2 ring-emerald-500" : ""} ${isSelected ? "ring-2 ring-[#001225]" : ""}`}
              style={{ left: boxLeft, top: boxTop, width: BOX_WIDTH, height: BOX_HEIGHT }}
              title={NIVEL_LABELS[nodo.nivel] || nodo.nivel}
            >
              <p className="line-clamp-2 text-[10px] font-black uppercase tracking-wide leading-tight">{nodo.titulo_puesto}</p>
              <p className="mt-0.5 truncate text-[9px] font-bold opacity-80">{nodo.nombre_persona || "Sin asignar"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
