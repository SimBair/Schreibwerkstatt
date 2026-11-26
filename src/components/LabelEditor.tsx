import { useState } from 'react'
import type { Label } from '../types'
import { updateProject } from '../data'
import Modal from './Modal'

const COLORS = ['#c0504d', '#4f81bd', '#7a9a3a', '#e08a2c', '#8064a2', '#4bacc6', '#b5651d', '#d4a017', '#6d6d6d']

export default function LabelEditor({
  uid,
  pid,
  labels,
  onClose,
}: {
  uid: string
  pid: string
  labels: Label[]
  onClose: () => void
}) {
  const [list, setList] = useState<Label[]>(labels)
  const set = (i: number, data: Partial<Label>) => setList(list.map((l, k) => (k === i ? { ...l, ...data } : l)))
  const save = () => {
    updateProject(uid, pid, { labels: list.filter((l) => l.name.trim()) })
    onClose()
  }
  return (
    <Modal title="Labels bearbeiten" onClose={onClose}>
      <p className="muted small-text">
        Labels markieren Szenen farbig, z. B. nach Handlungsstrang. Sie erscheinen im Binder, auf der Pinnwand und im
        Outliner.
      </p>
      <div className="label-list">
        {list.map((l, i) => (
          <div key={l.id} className="label-item">
            <input type="color" value={l.color} onChange={(e) => set(i, { color: e.target.value })} />
            <input value={l.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" />
            <button className="link danger" onClick={() => setList(list.filter((_, k) => k !== i))}>
              Entfernen
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          setList([
            ...list,
            { id: Math.random().toString(36).slice(2, 10), name: '', color: COLORS[list.length % COLORS.length] },
          ])
        }
      >
        ＋ Label
      </button>
      <div className="modal-actions">
        <button onClick={onClose}>Abbrechen</button>
        <button className="primary" onClick={save}>
          Speichern
        </button>
      </div>
    </Modal>
  )
}
