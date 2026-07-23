import { useEffect, useMemo, useRef, useState } from "react";
import { computeLayout, canReparent, getAncestorChain, getChildren, NIVEL_COLORS, NIVEL_LABELS } from "./organigramaLayout";

const BOX_WIDTH = 168;
const BOX_HEIGHT = 74;
const PADDING = 50;
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.5;

export default function OrgChartCanvas({ nodos, selectedId, onSelectNode, onReparent, canEdit }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY, x, y }
  const [hoverTargetId, setHoverTargetId] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [manualScale, setManualScale] = useState(null); // null = ajustar a pantalla automáticamente

  const layout = useMemo(() => computeLayout(nodos), [nodos]);
  const canvasWidth = layout.width + PADDING * 2;
  const canvasHeight = layout.height + PADDING * 2 + BOX_HEIGHT;

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

  const fitScale = viewportSize.width > 0 && canvasWidth > 0
    ? Math.min(1, viewportSize.width / canvasWidth, viewportSize.height / canvasHeight)
    : 1;
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
    const box = boxes.find((b) => b.nodo.id === nodo.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({
      id: nodo.id,
      offsetX: (event.clientX - rect.left) / scale - (box?.left ?? 0),
      offsetY: (event.clientY - rect.top) / scale - (box?.top ?? 0),
      x: box?.left ?? 0,
      y: box?.top ?? 0,
    });
  }

  function moveDrag(event) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / scale - dragging.offsetX;
    const rawY = (event.clientY - rect.top) / scale - dragging.offsetY;
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

  function zoomBy(factor) {
    setManualScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => zoomBy(1 / 1.15)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 hover:bg-slate-50">－</button>
        <span className="min-w-[3.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-[10px] font-black text-slate-500">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.15)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 hover:bg-slate-50">＋</button>
        <button type="button" onClick={() => setManualScale(null)} className="ml-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">⤢ Ajustar a pantalla</button>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-auto rounded-2xl border border-slate-200 bg-slate-50/60"
        style={{ height: "min(70vh, 640px)" }}
        onMouseMove={moveDrag}
        onMouseUp={stopDrag}
        onMouseLeave={() => dragging && stopDrag()}
      >
        <div
          ref={canvasRef}
          className="relative origin-top-left"
          style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${scale})` }}
        >
          <svg className="pointer-events-none absolute inset-0" width={canvasWidth} height={canvasHeight}>
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
              const isChainOfCommand = ancestorIds.has(nodo.id) && ancestorIds.has(nodo.reporta_a_id);
              const isDirectReportEdge = selectedId && nodo.reporta_a_id === selectedId && directReportIds.has(nodo.id);
              const strokeColor = isChainOfCommand ? "#dc2626" : isDirectReportEdge ? "#10b981" : "#cbd5e1";
              return (
                <path
                  key={nodo.id}
                  d={`M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isChainOfCommand || isDirectReportEdge ? 2.5 : 1.5}
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
            const isAncestor = !isSelected && ancestorIds.has(nodo.id);
            const isDirectReport = !isSelected && directReportIds.has(nodo.id);
            const boxLeft = isDragged ? dragging.x : left;
            const boxTop = isDragged ? dragging.y : top;
            const relationRing = isSelected
              ? "ring-2 ring-[#001225]"
              : isAncestor
                ? "ring-2 ring-red-400"
                : isDirectReport
                  ? "ring-2 ring-emerald-400"
                  : "";

            return (
              <div
                key={nodo.id}
                onClick={() => onSelectNode(nodo.id)}
                className={`group absolute flex select-none flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center shadow-sm transition-shadow cursor-pointer hover:shadow-md hover:ring-2 hover:ring-slate-300 ${colors.bg} ${colors.border} ${colors.text} ${
                  isDragged ? "z-30 shadow-xl" : "z-10"
                } ${isDropTarget ? "ring-2 ring-emerald-500" : ""} ${relationRing}`}
                style={{ left: boxLeft, top: boxTop, width: BOX_WIDTH, height: BOX_HEIGHT }}
                title={`${NIVEL_LABELS[nodo.nivel] || nodo.nivel} · clic para ver perfil de puesto`}
              >
                {canEdit && (
                  <span
                    onMouseDown={(event) => startDrag(event, nodo)}
                    onClick={(event) => event.stopPropagation()}
                    title="Arrastrar para cambiar de jefe"
                    className="absolute -right-1 -top-1 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-black text-slate-400 opacity-0 shadow-sm group-hover:opacity-100 active:cursor-grabbing"
                  >
                    ✥
                  </span>
                )}
                <p className="line-clamp-2 text-[10px] font-black uppercase tracking-wide leading-tight">{nodo.titulo_puesto}</p>
                <p className="mt-0.5 truncate text-[9px] font-bold opacity-80">{nodo.nombre_persona || "Sin asignar"}</p>
                <span className="pointer-events-none absolute bottom-1 right-1.5 text-[9px] font-black opacity-0 group-hover:opacity-60">ⓘ</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
