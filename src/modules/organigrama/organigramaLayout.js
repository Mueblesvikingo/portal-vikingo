// Funciones puras para construir el árbol del organigrama a partir de la
// lista plana de organigrama_nodos (cada nodo solo conoce a su reporta_a_id).
// Sin librerías externas de grafos/diagramas — mismo criterio que el resto
// del portal (diagramas dibujados a mano).

export function getChildren(nodos, parentId) {
  return nodos
    .filter((nodo) => (nodo.reporta_a_id ?? null) === (parentId ?? null))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export function getRoots(nodos) {
  return getChildren(nodos, null);
}

export function getNodoById(nodos, id) {
  return nodos.find((nodo) => String(nodo.id) === String(id)) || null;
}

// Cadena de mando: del nodo hacia arriba hasta la raíz (incluye el propio nodo).
export function getAncestorChain(nodos, nodeId) {
  const chain = [];
  let current = getNodoById(nodos, nodeId);
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.reporta_a_id ? getNodoById(nodos, current.reporta_a_id) : null;
  }

  return chain;
}

export function getDescendantIds(nodos, nodeId) {
  const result = new Set();
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    getChildren(nodos, currentId).forEach((child) => {
      if (!result.has(child.id)) {
        result.add(child.id);
        stack.push(child.id);
      }
    });
  }

  return result;
}

export function hasChildren(nodos, nodeId) {
  return getChildren(nodos, nodeId).length > 0;
}

// Nodos visibles según qué ramas están colapsadas: si un ancestro de un nodo
// está en collapsedIds, ese nodo queda oculto (pero sigue existiendo en la
// jerarquía para efectos de conteo/reasignación).
export function getVisibleNodos(nodos, collapsedIds) {
  if (!collapsedIds || collapsedIds.size === 0) return nodos;
  const hiddenIds = new Set();
  collapsedIds.forEach((id) => {
    getDescendantIds(nodos, id).forEach((descendantId) => hiddenIds.add(descendantId));
  });
  return nodos.filter((nodo) => !hiddenIds.has(nodo.id));
}

// Evita soltar un nodo sobre sí mismo o sobre uno de sus propios subordinados
// (lo que crearía un ciclo en la jerarquía).
export function canReparent(nodos, draggedId, targetId) {
  if (targetId === null) return true;
  if (String(draggedId) === String(targetId)) return false;
  const descendants = getDescendantIds(nodos, draggedId);
  return !descendants.has(Number(targetId));
}

export const ROW_HEIGHT = 150;
export const COLUMN_WIDTH = 190;

// Layout tipo "tidy tree": cada hoja ocupa una columna; un padre queda
// centrado sobre el promedio de sus hijos. Devuelve un Map<id, {x,y,row,col}>
// en px, listo para posicionar cajas de forma absoluta.
export function computeLayout(nodos) {
  const positions = new Map();
  let nextLeaf = 0;

  function visit(node, depth) {
    const children = getChildren(nodos, node.id);
    let x;

    if (children.length === 0) {
      x = nextLeaf;
      nextLeaf += 1;
    } else {
      const childXs = children.map((child) => visit(child, depth + 1));
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }

    const autoX = x * COLUMN_WIDTH;
    const autoY = depth * ROW_HEIGHT;
    // Si el usuario ya arrastró este puesto a una posición manual, se
    // respeta esa posición tal cual (no se recalcula ni se "acomoda solo").
    const hasManualPosition = node.pos_x !== null && node.pos_x !== undefined && node.pos_y !== null && node.pos_y !== undefined;

    positions.set(node.id, {
      row: depth,
      col: x,
      x: hasManualPosition ? Number(node.pos_x) : autoX,
      y: hasManualPosition ? Number(node.pos_y) : autoY,
    });

    return x;
  }

  getRoots(nodos).forEach((root) => visit(root, 0));

  const maxCol = nextLeaf > 0 ? nextLeaf - 1 : 0;
  const maxRow = nodos.reduce((max, nodo) => {
    const pos = positions.get(nodo.id);
    return pos ? Math.max(max, pos.row) : max;
  }, 0);

  return {
    positions,
    width: (maxCol + 1) * COLUMN_WIDTH,
    height: (maxRow + 1) * ROW_HEIGHT,
    columnWidth: COLUMN_WIDTH,
    rowHeight: ROW_HEIGHT,
  };
}

export const NIVEL_COLORS = {
  Direccion: { bg: "bg-red-600", border: "border-red-700", text: "text-white", dot: "bg-red-600" },
  Externo: { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-400" },
  Gerencia: { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-900", dot: "bg-amber-400" },
  Auditoria: { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-900", dot: "bg-sky-400" },
  Jefatura: { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-900", dot: "bg-orange-400" },
  Supervision: { bg: "bg-fuchsia-100", border: "border-fuchsia-300", text: "text-fuchsia-900", dot: "bg-fuchsia-400" },
  Operativo: { bg: "bg-sky-50", border: "border-sky-200", text: "text-slate-700", dot: "bg-sky-200" },
};

export const NIVEL_OPTIONS = [
  "Direccion",
  "Externo",
  "Gerencia",
  "Auditoria",
  "Jefatura",
  "Supervision",
  "Operativo",
];

export const NIVEL_LABELS = {
  Direccion: "Dirección",
  Externo: "Externo / Staff",
  Gerencia: "Gerencia",
  Auditoria: "Auditoría",
  Jefatura: "Jefatura",
  Supervision: "Supervisión",
  Operativo: "Operativo",
};
