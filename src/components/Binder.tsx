import { useEffect, useRef, useState } from 'react'
import type { BinderNode, NodeType } from '../types'
import { addNode, deleteNodesForever, updateNodes } from '../data'
import {
  childrenOf,
  descendantIds,
  indent,
  moveTo,
  moveUpDown,
  nextOrder,
  outdent,
  restore,
} from '../tree'

interface Props {
  uid: string
  pid: string
  nodes: BinderNode[]
  selectedId: string | null
  onSelect: (id: string) => void
}

type DropPos = 'before' | 'inside' | 'after'

export default function Binder({ uid, pid, nodes, selectedId, onSelect }: Props) {
  const storageKey = `binder-collapsed-${pid}`
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
    } catch {
      return new Set()
    }
  })
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [drag, setDrag] = useState<{ id: string; over?: string; pos?: DropPos } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...collapsed]))
    } catch {
      /* egal */
    }
  }, [collapsed, storageKey])

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const apply = (u: ReturnType<typeof moveUpDown>) => updateNodes(uid, pid, u)

  const create = (type: NodeType, parentId: string | null, order?: number) => {
    const title = type === 'folder' ? 'Neuer Ordner' : 'Neue Szene'
    const id = addNode(uid, pid, type, title, parentId, order ?? nextOrder(nodes, parentId))
    if (parentId)
      setCollapsed((s) => {
        const n = new Set(s)
        n.delete(parentId)
        return n
      })
    onSelect(id)
    setEditingId(id)
  }

  /** Neuer Eintrag relativ zur Auswahl: in Ordner hinein, sonst direkt dahinter */
  const createNearSelection = (type: NodeType) => {
    const sel = nodes.find((n) => n.id === selectedId && !n.trashed)
    if (!sel) return create(type, null)
    if (sel.type === 'folder') return create(type, sel.id)
    const sibs = childrenOf(nodes, sel.parentId)
    const i = sibs.findIndex((n) => n.id === sel.id)
    const ups = sibs.slice(i + 1).map((n, k) => ({ id: n.id, data: { order: sel.order + 2 + k } }))
    updateNodes(uid, pid, ups)
    create(type, sel.parentId, sel.order + 1)
  }

  const trash = (id: string) => {
    updateNodes(uid, pid, [{ id, data: { trashed: true, updatedAt: Date.now() } }])
  }

  const trashed = nodes.filter((n) => n.trashed).sort((a, b) => b.updatedAt - a.updatedAt)

  const emptyTrash = () => {
    if (!confirm(`${trashed.length} Einträge endgültig löschen? Das kann nicht rückgängig gemacht werden.`))
      return
    const ids = new Set<string>()
    for (const t of trashed) {
      ids.add(t.id)
      descendantIds(nodes, t.id).forEach((d) => ids.add(d))
    }
    deleteNodesForever(uid, pid, [...ids])
  }

  // ---------- Drag & Drop ----------
  const onDragOver = (e: React.DragEvent, n: BinderNode) => {
    if (!drag || drag.id === n.id) return
    e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    const pos: DropPos = n.type === 'folder' && y > 0.3 && y < 0.7 ? 'inside' : y < 0.5 ? 'before' : 'after'
    if (drag.over !== n.id || drag.pos !== pos) setDrag({ ...drag, over: n.id, pos })
  }
  const onDrop = (e: React.DragEvent, n: BinderNode) => {
    e.preventDefault()
    if (!drag || !drag.pos) return
    if (drag.pos === 'inside') {
      apply(moveTo(nodes, drag.id, n.id, Number.MAX_SAFE_INTEGER))
      setCollapsed((s) => {
        const c = new Set(s)
        c.delete(n.id)
        return c
      })
    } else {
      const sibs = childrenOf(nodes, n.parentId).filter((x) => x.id !== drag.id)
      const idx = sibs.findIndex((x) => x.id === n.id) + (drag.pos === 'after' ? 1 : 0)
      apply(moveTo(nodes, drag.id, n.parentId, idx))
    }
    setDrag(null)
  }

  const renderNode = (n: BinderNode, depth: number) => {
    const kids = childrenOf(nodes, n.id)
    const isOpen = !collapsed.has(n.id)
    const dropCls =
      drag?.over === n.id && drag.pos ? ` drop-${drag.pos}` : ''
    return (
      <li key={n.id}>
        <div
          className={`binder-row${selectedId === n.id ? ' selected' : ''}${dropCls}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          draggable={editingId !== n.id}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', n.id)
            setDrag({ id: n.id })
          }}
          onDragEnd={() => setDrag(null)}
          onDragOver={(e) => onDragOver(e, n)}
          onDrop={(e) => onDrop(e, n)}
          onClick={() => onSelect(n.id)}
        >
          {n.type === 'folder' && kids.length > 0 ? (
            <button
              className="twisty"
              aria-label={isOpen ? 'Zuklappen' : 'Aufklappen'}
              onClick={(e) => {
                e.stopPropagation()
                toggle(n.id)
              }}
            >
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="twisty" />
          )}
          <span className="icon">{n.type === 'folder' ? '📁' : '📄'}</span>
          {editingId === n.id ? (
            <input
              className="rename"
              autoFocus
              defaultValue={n.title}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                const t = e.target.value.trim()
                if (t && t !== n.title) updateNodes(uid, pid, [{ id: n.id, data: { title: t } }])
                setEditingId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
          ) : (
            <span className="title" onDoubleClick={() => setEditingId(n.id)}>
              {n.title || 'Ohne Titel'}
            </span>
          )}
          <button
            className="more"
            aria-label="Aktionen"
            onClick={(e) => {
              e.stopPropagation()
              setMenuId(menuId === n.id ? null : n.id)
            }}
          >
            ⋯
          </button>
        </div>
        {menuId === n.id && (
          <NodeMenu
            onClose={() => setMenuId(null)}
            items={[
              ['Umbenennen', () => setEditingId(n.id)],
              ...(n.type === 'folder'
                ? ([
                    ['Neue Szene hier drin', () => create('text', n.id)],
                    ['Neuer Ordner hier drin', () => create('folder', n.id)],
                  ] as [string, () => void][])
                : []),
              ['Nach oben', () => apply(moveUpDown(nodes, n.id, -1))],
              ['Nach unten', () => apply(moveUpDown(nodes, n.id, 1))],
              ['Einrücken (in Ordner darüber)', () => apply(indent(nodes, n.id))],
              ['Ausrücken (eine Ebene höher)', () => apply(outdent(nodes, n.id))],
              ['In den Papierkorb', () => trash(n.id)],
            ]}
          />
        )}
        {n.type === 'folder' && isOpen && kids.length > 0 && (
          <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="binder">
      <div
        className="binder-tree"
        onDragOver={(e) => drag && e.target === e.currentTarget && e.preventDefault()}
        onDrop={(e) => {
          if (drag && e.target === e.currentTarget) {
            apply(moveTo(nodes, drag.id, null, Number.MAX_SAFE_INTEGER))
            setDrag(null)
          }
        }}
      >
        <ul>{childrenOf(nodes, null).map((n) => renderNode(n, 0))}</ul>
      </div>

      <div className="binder-actions">
        <button onClick={() => createNearSelection('text')}>＋ Szene</button>
        <button onClick={() => createNearSelection('folder')}>＋ Ordner</button>
        <button
          className={showTrash ? 'active' : ''}
          onClick={() => setShowTrash(!showTrash)}
          title="Papierkorb"
        >
          🗑 {trashed.length || ''}
        </button>
      </div>

      {showTrash && (
        <div className="trash">
          <div className="trash-head">
            <strong>Papierkorb</strong>
            {trashed.length > 0 && (
              <button className="link danger" onClick={emptyTrash}>
                Leeren
              </button>
            )}
          </div>
          {trashed.length === 0 && <p className="muted">Leer.</p>}
          <ul>
            {trashed.map((t) => (
              <li key={t.id}>
                <span>
                  {t.type === 'folder' ? '📁' : '📄'} {t.title}
                </span>
                <button className="link" onClick={() => apply(restore(nodes, t.id))}>
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NodeMenu({ items, onClose }: { items: [string, () => void][]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // verzögert registrieren, damit der öffnende Klick nicht sofort schließt
    const t = setTimeout(() => document.addEventListener('pointerdown', h), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', h)
    }
  }, [onClose])
  return (
    <div className="menu" ref={ref}>
      {items.map(([label, fn]) => (
        <button
          key={label}
          onClick={() => {
            onClose()
            fn()
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
