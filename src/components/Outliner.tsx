import type { BinderNode, Label } from '../types'
import { NODE_ICONS } from '../types'
import { childrenOf, wordsUnder } from '../tree'
import { updateNodes } from '../data'
import MetaFields from './MetaFields'

interface Props {
  uid: string
  pid: string
  folder: BinderNode
  nodes: BinderNode[]
  labels: Label[]
  characters: BinderNode[]
  onOpen: (id: string) => void
}

/** Outliner: alle Einträge unterhalb eines Ordners als Tabelle mit Metadaten */
export default function Outliner({ uid, pid, folder, nodes, labels, characters, onOpen }: Props) {
  const rows: { node: BinderNode; depth: number }[] = []
  const walk = (pid: string, depth: number) => {
    for (const n of childrenOf(nodes, pid)) {
      rows.push({ node: n, depth })
      walk(n.id, depth + 1)
    }
  }
  walk(folder.id, 0)

  if (!rows.length) return <p className="muted">Dieser Ordner ist leer.</p>

  return (
    <div className="outliner-scroll">
      <table className="outliner">
        <thead>
          <tr>
            <th>Titel</th>
            <th className="col-syn">Synopsis</th>
            <th>Status</th>
            <th>Label</th>
            <th>POV</th>
            <th className="num">Wörter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node: n, depth }) => {
            const isScene = n.type === 'text'
            const label = labels.find((l) => l.id === n.label)
            return (
              <tr key={n.id} className={n.type === 'folder' ? 'is-folder' : ''}>
                <td style={{ paddingLeft: 8 + depth * 18 }}>
                  <span className="label-bar" style={{ background: label?.color ?? 'transparent' }} />
                  <button className="link title-link" onClick={() => onOpen(n.id)}>
                    {NODE_ICONS[n.type]} {n.title}
                  </button>
                </td>
                <td className="col-syn">
                  <textarea
                    key={n.id + n.synopsis}
                    defaultValue={n.synopsis}
                    rows={1}
                    placeholder="…"
                    onBlur={(e) => {
                      if (e.target.value !== n.synopsis)
                        updateNodes(uid, pid, [{ id: n.id, data: { synopsis: e.target.value } }])
                    }}
                  />
                </td>
                <td>
                  <MetaFields uid={uid} pid={pid} node={n} labels={labels} characters={characters} compact only={['status']} />
                </td>
                <td>
                  <MetaFields uid={uid} pid={pid} node={n} labels={labels} characters={characters} compact only={['label']} />
                </td>
                <td>
                  {isScene && (
                    <MetaFields uid={uid} pid={pid} node={n} labels={labels} characters={characters} compact only={['pov']} />
                  )}
                </td>
                <td className="num">
                  {(n.type === 'folder' ? wordsUnder(nodes, n.id) : n.wordCount).toLocaleString('de-DE')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
