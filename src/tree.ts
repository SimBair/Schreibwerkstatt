import type { BinderNode } from './types'

type Update = { id: string; data: Partial<Omit<BinderNode, 'id'>> }

export function childrenOf(nodes: BinderNode[], parentId: string | null): BinderNode[] {
  return nodes
    .filter((n) => n.parentId === parentId && !n.trashed)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

export function descendantIds(nodes: BinderNode[], id: string): string[] {
  const out: string[] = []
  const walk = (pid: string) => {
    for (const n of nodes) {
      if (n.parentId === pid) {
        out.push(n.id)
        walk(n.id)
      }
    }
  }
  walk(id)
  return out
}

/** Alle sichtbaren Texte in Lesereihenfolge (Tiefensuche) */
export function flattenTexts(nodes: BinderNode[], parentId: string | null = null): BinderNode[] {
  const out: BinderNode[] = []
  for (const n of childrenOf(nodes, parentId)) {
    if (n.type === 'text') out.push(n)
    out.push(...flattenTexts(nodes, n.id))
  }
  return out
}

export function wordsUnder(nodes: BinderNode[], id: string): number {
  const ids = new Set([id, ...descendantIds(nodes, id)])
  return nodes.filter((n) => ids.has(n.id) && !n.trashed).reduce((s, n) => s + (n.wordCount || 0), 0)
}

/** Reihenfolge einer Geschwisterliste neu durchnummerieren */
function renumber(list: BinderNode[], extra: Record<string, Partial<BinderNode>> = {}): Update[] {
  return list.map((n, i) => ({ id: n.id, data: { order: i, ...extra[n.id] } }))
}

export function nextOrder(nodes: BinderNode[], parentId: string | null): number {
  const kids = childrenOf(nodes, parentId)
  return kids.length ? kids[kids.length - 1].order + 1 : 0
}

export function moveUpDown(nodes: BinderNode[], id: string, dir: -1 | 1): Update[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return []
  const sibs = childrenOf(nodes, node.parentId)
  const i = sibs.findIndex((n) => n.id === id)
  const j = i + dir
  if (j < 0 || j >= sibs.length) return []
  ;[sibs[i], sibs[j]] = [sibs[j], sibs[i]]
  return renumber(sibs)
}

/** In den vorherigen Ordner verschieben (einrücken) */
export function indent(nodes: BinderNode[], id: string): Update[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return []
  const sibs = childrenOf(nodes, node.parentId)
  const i = sibs.findIndex((n) => n.id === id)
  const target = sibs
    .slice(0, i)
    .reverse()
    .find((n) => n.type === 'folder')
  if (!target) return []
  return [{ id, data: { parentId: target.id, order: nextOrder(nodes, target.id) } }]
}

/** Eine Ebene nach oben verschieben (ausrücken) – direkt hinter den bisherigen Elternordner */
export function outdent(nodes: BinderNode[], id: string): Update[] {
  const node = nodes.find((n) => n.id === id)
  if (!node || node.parentId === null) return []
  const parent = nodes.find((n) => n.id === node.parentId)
  if (!parent) return []
  const sibs = childrenOf(nodes, parent.parentId).filter((n) => n.id !== id)
  const pi = sibs.findIndex((n) => n.id === parent.id)
  sibs.splice(pi + 1, 0, node)
  return renumber(sibs, { [id]: { parentId: parent.parentId } })
}

/** Eintrag an eine neue Position verschieben (für Drag & Drop) */
export function moveTo(
  nodes: BinderNode[],
  id: string,
  newParentId: string | null,
  index: number,
): Update[] {
  if (id === newParentId || (newParentId && descendantIds(nodes, id).includes(newParentId))) return []
  const node = nodes.find((n) => n.id === id)
  if (!node) return []
  const sibs = childrenOf(nodes, newParentId).filter((n) => n.id !== id)
  sibs.splice(Math.max(0, Math.min(index, sibs.length)), 0, node)
  return renumber(sibs, { [id]: { parentId: newParentId } })
}

/** Wiederherstellen aus dem Papierkorb – fehlt der Elternordner, landet der Eintrag oben */
export function restore(nodes: BinderNode[], id: string): Update[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return []
  let parentId = node.parentId
  // Prüfen, ob die Elternkette noch sichtbar ist
  let p = parentId
  while (p) {
    const pn = nodes.find((n) => n.id === p)
    if (!pn || pn.trashed) {
      parentId = null
      break
    }
    p = pn.parentId
  }
  return [{ id, data: { trashed: false, parentId, order: nextOrder(nodes, parentId), updatedAt: Date.now() } }]
}
