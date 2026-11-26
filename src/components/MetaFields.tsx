import type { BinderNode, Label } from '../types'
import { STATUSES } from '../types'
import { updateNodes } from '../data'

interface Props {
  uid: string
  pid: string
  node: BinderNode
  labels: Label[]
  characters: BinderNode[]
  /** kompakt = ohne Beschriftungen (für Tabellen) */
  compact?: boolean
  only?: ('status' | 'label' | 'pov')[]
}

/** Status-, Label- und POV-Auswahl für einen Binder-Eintrag */
export default function MetaFields({ uid, pid, node, labels, characters, compact, only }: Props) {
  const set = (data: Partial<BinderNode>) => updateNodes(uid, pid, [{ id: node.id, data }])
  const show = (k: 'status' | 'label' | 'pov') => !only || only.includes(k)
  const label = labels.find((l) => l.id === node.label)

  const wrap = (title: string, el: React.ReactNode) =>
    compact ? (
      el
    ) : (
      <label className="meta-field">
        <span>{title}</span>
        {el}
      </label>
    )

  return (
    <>
      {show('status') &&
        wrap(
          'Status',
          <select value={node.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
            <option value="">–</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
            {node.status && !STATUSES.includes(node.status) && <option>{node.status}</option>}
          </select>,
        )}
      {show('label') &&
        wrap(
          'Label',
          <span className="label-select">
            <span className="label-dot" style={{ background: label?.color ?? 'transparent' }} />
            <select value={node.label ?? ''} onChange={(e) => set({ label: e.target.value })}>
              <option value="">–</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </span>,
        )}
      {show('pov') &&
        wrap(
          'POV',
          <select value={node.pov ?? ''} onChange={(e) => set({ pov: e.target.value })}>
            <option value="">–</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>,
        )}
    </>
  )
}
