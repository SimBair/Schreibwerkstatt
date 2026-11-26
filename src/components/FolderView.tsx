import { useState } from 'react'
import type { BinderNode, Label } from '../types'
import { childrenOf, wordsUnder } from '../tree'
import Corkboard from './Corkboard'
import Outliner from './Outliner'
import LabelEditor from './LabelEditor'

interface Props {
  uid: string
  pid: string
  folder: BinderNode
  nodes: BinderNode[]
  labels: Label[]
  characters: BinderNode[]
  onOpen: (id: string) => void
}

export default function FolderView(props: Props) {
  const { folder, nodes } = props
  const [view, setView] = useState<'cork' | 'outline'>(
    () => (localStorage.getItem('folder-view') as 'cork' | 'outline') || 'cork',
  )
  const [editLabels, setEditLabels] = useState(false)
  const choose = (v: 'cork' | 'outline') => {
    setView(v)
    try {
      localStorage.setItem('folder-view', v)
    } catch {
      /* egal */
    }
  }
  return (
    <div className="folder-wrap">
      <div className="folder-head">
        <h2>{folder.title}</h2>
        <span className="muted">
          {childrenOf(nodes, folder.id).length} Einträge · {wordsUnder(nodes, folder.id).toLocaleString('de-DE')}{' '}
          Wörter
        </span>
        <span className="grow" />
        <div className="seg">
          <button className={view === 'cork' ? 'active' : ''} onClick={() => choose('cork')}>
            Pinnwand
          </button>
          <button className={view === 'outline' ? 'active' : ''} onClick={() => choose('outline')}>
            Outliner
          </button>
        </div>
        <button className="ghost small" onClick={() => setEditLabels(true)}>
          Labels …
        </button>
      </div>
      {view === 'cork' ? <Corkboard {...props} /> : <Outliner {...props} />}
      {editLabels && (
        <LabelEditor uid={props.uid} pid={props.pid} labels={props.labels} onClose={() => setEditLabels(false)} />
      )}
    </div>
  )
}
