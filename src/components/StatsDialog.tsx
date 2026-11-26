import { useState } from 'react'
import type { DayStat, Project } from '../types'
import { today } from '../types'
import { updateProject } from '../data'
import Modal from './Modal'

interface Props {
  uid: string
  project: Project
  days: DayStat[]
  manuscriptWords: number
  onClose: () => void
}

const de = (n: number) => n.toLocaleString('de-DE')

function lastNDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d)
    x.setDate(d.getDate() - i)
    out.push(today(x))
  }
  return out
}

/** Aufeinanderfolgende Tage (bis heute bzw. gestern), an denen das Tagesziel erreicht wurde */
export function streak(byDay: Map<string, number>, goal: number): number {
  const reached = (k: string) => (byDay.get(k) ?? 0) >= Math.max(1, goal)
  const d = new Date()
  if (!reached(today(d))) d.setDate(d.getDate() - 1) // heute zählt erst, wenn erreicht
  let n = 0
  while (reached(today(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export default function StatsDialog({ uid, project, days, manuscriptWords, onClose }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const goal = project.dailyGoal ?? 500
  const byDay = new Map(days.map((d) => [d.id, d.words]))
  const range = lastNDays(30)
  const values = range.map((k) => Math.max(0, byDay.get(k) ?? 0))
  const todayWords = Math.max(0, byDay.get(today()) ?? 0)
  const week = values.slice(-7).reduce((a, b) => a + b, 0)
  const month = values.reduce((a, b) => a + b, 0)
  const avg = month / 30
  const best = days.reduce((m, d) => (d.words > m.words ? d : m), { id: '', words: 0 })
  const s = streak(byDay, goal)
  const remaining = Math.max(0, (project.wordGoal || 0) - manuscriptWords)
  const finish =
    remaining > 0 && avg > 0
      ? new Date(Date.now() + (remaining / avg) * 86400000).toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null

  const max = Math.max(goal, ...values, 1)
  const pct = goal ? Math.min(100, Math.round((todayWords / goal) * 100)) : 0

  const editNumber = (label: string, current: number, key: 'dailyGoal' | 'wordGoal') => {
    const v = prompt(label, String(current))
    if (v === null) return
    const n = parseInt(v.replace(/\D/g, ''), 10)
    if (!isNaN(n)) updateProject(uid, project.id, { [key]: n })
  }

  const hovered = hover ? { day: hover, words: Math.max(0, byDay.get(hover) ?? 0) } : null

  return (
    <Modal title="Schreibstatistik" onClose={onClose} wide>
      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Heute</div>
          <div className="tile-value">{de(todayWords)}</div>
          <div className="tile-bar">
            <span style={{ width: pct + '%' }} />
          </div>
          <button className="link" onClick={() => editNumber('Tagesziel (Wörter):', goal, 'dailyGoal')}>
            Ziel: {de(goal)} ✎
          </button>
        </div>
        <div className="tile">
          <div className="tile-label">Serie</div>
          <div className="tile-value">
            {s} {s === 1 ? 'Tag' : 'Tage'} {s >= 3 ? '🔥' : ''}
          </div>
          <div className="muted small-text">Tage in Folge mit erreichtem Tagesziel</div>
        </div>
        <div className="tile">
          <div className="tile-label">Letzte 7 Tage</div>
          <div className="tile-value">{de(week)}</div>
          <div className="muted small-text">Ø {de(Math.round(week / 7))} pro Tag</div>
        </div>
        <div className="tile">
          <div className="tile-label">Manuskript</div>
          <div className="tile-value">{de(manuscriptWords)}</div>
          <button
            className="link"
            onClick={() => editNumber('Wortziel für das Projekt:', project.wordGoal || 0, 'wordGoal')}
          >
            von {de(project.wordGoal || 0)} ✎
          </button>
        </div>
      </div>

      <div className="chart-head">
        <strong>Wörter pro Tag – letzte 30 Tage</strong>
        <span className="muted small-text">
          {hovered
            ? `${new Date(hovered.day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}: ${de(hovered.words)} Wörter`
            : `Gestrichelt: Tagesziel (${de(goal)})`}
        </span>
      </div>
      <div className="chart" role="img" aria-label="Balkendiagramm der geschriebenen Wörter pro Tag">
        {goal > 0 && <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }} />}
        {range.map((k, i) => (
          <div
            key={k}
            className={`bar-slot${hover === k ? ' hover' : ''}`}
            onMouseEnter={() => setHover(k)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === k ? null : k)}
          >
            <div
              className={`bar${values[i] >= goal && goal > 0 ? ' reached' : ''}`}
              style={{ height: `${(values[i] / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="chart-axis muted small-text">
        <span>{new Date(range[0] + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>
        <span>heute</span>
      </div>

      <ul className="facts">
        <li>
          Letzte 30 Tage: <strong>{de(month)}</strong> Wörter (Ø {de(Math.round(avg))} pro Tag)
        </li>
        {best.words > 0 && (
          <li>
            Bester Tag: <strong>{de(best.words)}</strong> Wörter am{' '}
            {new Date(best.id + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </li>
        )}
        {finish && (
          <li>
            Bei diesem Tempo erreichst du dein Wortziel voraussichtlich am <strong>{finish}</strong>.
          </li>
        )}
        {remaining === 0 && project.wordGoal > 0 && <li>🎉 Wortziel erreicht!</li>}
      </ul>
      <p className="muted small-text">
        Gezählt wird die Netto-Änderung aller Texte pro Tag (Geschriebenes minus Gelöschtes).
      </p>
    </Modal>
  )
}
