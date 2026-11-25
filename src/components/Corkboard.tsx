import type { BinderNode } from '../types'
import { childrenOf, wordsUnder } from '../tree'
import { updateNodes } from '../data'

interface Props {
  uid: string
  pid: string
  folder: BinderNode
  nodes: BinderNode[]
  onOpen: (id: string) => void
}

/** Pinnwand: Karteikarten mit Titel und Synopsis der Einträge eines Ordners */
export default function Corkboard({ uid, pid, folder, nodes, onOpen }: Props) {
  const kids = childrenOf(nodes, folder.id)
  return (
    <div className="corkboard-wrap">
      <div className="corkboard-head">
        <h2>{folder.title}</h2>
        <span className="muted">
          {kids.length} Einträge · {wordsUnder(nodes, folder.id).toLocaleString('de-DE')} Wörter
        </span>
      </div>
      {kids.length === 0 && (
        <p className="muted">Dieser Ordner ist leer. Lege links über „＋ Szene“ etwas an.</p>
      )}
      <div className="corkboard">
        {kids.map((k) => (
          <div key={k.id} className="card">
            <div className="card-title" onClick={() => onOpen(k.id)}>
              {k.type === 'folder' ? '📁 ' : ''}
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
              {(k.type === 'folder' ? wordsUnder(nodes, k.id) : k.wordCount).toLocaleString('de-DE')} Wörter
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
