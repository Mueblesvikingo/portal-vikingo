import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeLayout,
  getAncestorChain,
  getChildren,
  hasChildren,
  getVisibleNodos,
  NIVEL_COLORS,
  NIVEL_LABELS,
} from "./organigramaLayout";

const BOX_WIDTH = 176;
const BOX_HEIGHT = 80;
const PADDING = 60;
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.5;
// Nunca se auto-reduce por debajo de esto: mejor scroll que letras
// ilegibles. El ajuste a pantalla solo encoge hasta aquí.
const MIN_READABLE_FIT = 0.65;

export default function OrgChartCanvas({ nodos, selectedId, onSelectNode, onMoveNode, canEdit }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
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
    setDragging((current) => ({ ...current, x: rawX, y: rawY }));
  }

  // Al soltar, el bloque se queda exactamente donde lo pusiste — sin
  // reasignar jefe ni reordenar nada más. "Reporta a" se cambia desde el
  // panel de perfil de puesto (selector explícito), no arrastrando.
  function stopDrag() {
    if (dragging) {
      const posX = dragging.x + BOX_WIDTH / 2 - PADDING;
      const posY = dragging.y - PADDING;
      onMoveNode(dragging.id, posX, posY);
    }
    setDragging(null);
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
        style={{ height: "min(75vh, 720px)" }}
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
            {visibleNodos.map((nodo) => {
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
                  strokeWidth={isChainOfCommand || isDirectReportEdge ? 3 : 1.5}
                  strokeDasharray={nodo.tipo_linea === "punteada" ? "5,4" : undefined}
                />
              );
            })}
          </svg>

          {boxes.map(({ nodo, left, top }) => {
            const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;
            const isDragged = dragging?.id === nodo.id;
            const isSelected = selectedId === nodo.id;
            const isAncestor = !isSelected && ancestorIds.has(nodo.id);
            const isDirectReport = !isSelected && directReportIds.has(nodo.id);
            const boxLeft = isDragged ? dragging.x : left;
            const boxTop = isDragged ? dragging.y : top;
            const relationRing = isSelected
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
                onClick={() => onSelectNode(nodo.id)}
                className={`group absolute flex select-none flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-center shadow-sm transition-shadow cursor-pointer hover:shadow-md hover:ring-2 hover:ring-slate-300 ${colors.bg} ${colors.border} ${colors.text} ${
                  isDragged ? "z-30 shadow-xl" : "z-10"
                } ${relationRing}`}
                style={{ left: boxLeft, top: boxTop, width: BOX_WIDTH, height: BOX_HEIGHT }}
                title={`${NIVEL_LABELS[nodo.nivel] || nodo.nivel} · clic para ver perfil de puesto`}
              >
                {canEdit && (
                  <span
                    onMouseDown={(event) => startDrag(event, nodo)}
                    onClick={(event) => event.stopPropagation()}
                    title="Arrastrar para moverlo — se queda donde lo sueltes"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-black text-slate-500 opacity-0 shadow-sm group-hover:opacity-100 active:cursor-grabbing"
                  >
                    ✥
                  </span>
                )}
                <p className="line-clamp-2 text-[12px] font-black uppercase leading-tight tracking-wide">{nodo.titulo_puesto}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold opacity-80">{nodo.nombre_persona || "Sin asignar"}</p>
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
  );
}
