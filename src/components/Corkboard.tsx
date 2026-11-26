import type { BinderNode, Label } from '../types'
import { NODE_ICONS } from '../types'
import { childrenOf, wordsUnder } from '../tree'
import { updateNodes } from '../data'

interface Props {
  uid: string
  pid: string
  folder: BinderNode
  nodes: BinderNode[]
  labels: Label[]
  onOpen: (id: string) => void
}

/** Pinnwand: Karteikarten mit Titel und Synopsis der Einträge eines Ordners */
export default function Corkboard({ uid, pid, folder, nodes, labels, onOpen }: Props) {
  const kids = childrenOf(nodes, folder.id)
  if (kids.length === 0)
    return <p className="muted">Dieser Ordner ist leer. Lege links über „＋ Neu“ etwas an.</p>
  return (
    <div className="corkboard">
      {kids.map((k) => {
        const label = labels.find((l) => l.id === k.label)
        const pov = k.pov ? nodes.find((n) => n.id === k.pov) : null
        return (
          <div key={k.id} className="card" style={{ borderTopColor: label?.color ?? 'transparent' }}>
            <div className="card-title" onClick={() => onOpen(k.id)}>
              {k.type !== 'text' ? NODE_ICONS[k.type] + ' ' : ''}
              {k.title}
            </div>
            <textarea
              key={k.id + k.synopsis}
              defaultValue={k.synopsis}
              placeholder="Synopsis …"
              onBlur={(e) => {
                if (e.target.value !== k.synopsis)
                  updateNodes(uid, pid, [{ id: k.id, data: { synopsis: e.target.value } }])
              }}
            />
            <div className="card-foot muted">
              <span>
                {k.type === 'folder' || k.type === 'text'
                  ? `${(k.type === 'folder' ? wordsUnder(nodes, k.id) : k.wordCount).toLocaleString('de-DE')} Wörter`
                  : ''}
                {pov ? ` · 👤 ${pov.title}` : ''}
              </span>
              {k.status && <span className="stamp">{k.status}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
