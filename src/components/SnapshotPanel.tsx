import { useEffect, useMemo, useState } from 'react'
import { diffWords } from 'diff'
import type { Editor } from '@tiptap/react'
import type { BinderNode, Snapshot } from '../types'
import { createSnapshot, deleteSnapshot, watchSnapshots } from '../data'

interface Props {
  uid: string
  pid: string
  node: BinderNode
  editor: Editor
  onRestore: (html: string) => void
  onClose: () => void
}

const fmt = (t: number) =>
  new Date(t).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

/** HTML → Klartext mit Absätzen (für den Vergleich) */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = doc.body.querySelectorAll('p, h1, h2, h3, li, blockquote, hr')
  if (!blocks.length) return doc.body.textContent ?? ''
  return [...blocks]
    .filter((b) => !b.querySelector('p, li'))
    .map((b) => (b.tagName === 'HR' ? '⁂' : (b.textContent ?? '')))
    .join('\n\n')
}

export function takeSnapshot(uid: string, pid: string, node: BinderNode, editor: Editor, title?: string) {
  createSnapshot(
    uid,
    pid,
    node.id,
    title ?? `Schnappschuss ${fmt(Date.now())}`,
    editor.getHTML(),
    editor.storage.characterCount.words(),
  )
}

export default function SnapshotPanel({ uid, pid, node, editor, onRestore, onClose }: Props) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'diff'>('diff')

  useEffect(() => {
    setOpenId(null)
    return watchSnapshots(uid, pid, node.id, setSnaps)
  }, [uid, pid, node.id])

  const open = snaps?.find((s) => s.id === openId) ?? null

  const diff = useMemo(() => {
    if (!open || mode !== 'diff') return null
    return diffWords(htmlToText(open.html), htmlToText(editor.getHTML()))
  }, [open, mode, editor])

  const create = () => {
    const title = prompt('Name des Schnappschusses:', `Schnappschuss ${fmt(Date.now())}`)
    if (title === null) return
    takeSnapshot(uid, pid, node, editor, title.trim() || undefined)
  }

  const restore = (s: Snapshot) => {
    if (!confirm(`„${s.title}“ wiederherstellen?\nDer aktuelle Stand wird vorher automatisch als Schnappschuss gesichert.`))
      return
    takeSnapshot(uid, pid, node, editor, `Automatisch vor Wiederherstellung (${fmt(Date.now())})`)
    onRestore(s.html)
    setOpenId(null)
  }

  return (
    <aside className="side-panel">
      <div className="side-head">
        <strong>Schnappschüsse</strong>
        <button className="ghost small" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>

      {!open && (
        <>
          <button className="primary block" onClick={create}>
            📸 Schnappschuss erstellen
          </button>
          <p className="muted small-text">
            Ein Schnappschuss sichert den aktuellen Stand dieser Szene. Du kannst ihn später vergleichen oder
            wiederherstellen.
          </p>
          {snaps === null && <p className="muted">Lade …</p>}
          {snaps?.length === 0 && <p className="muted">Noch keine Schnappschüsse.</p>}
          <ul className="snap-list">
            {snaps?.map((s) => (
              <li key={s.id} onClick={() => setOpenId(s.id)}>
                <div className="snap-title">{s.title}</div>
                <div className="muted small-text">
                  {fmt(s.createdAt)} · {s.wordCount.toLocaleString('de-DE')} Wörter
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && (
        <div className="snap-open">
          <button className="link" onClick={() => setOpenId(null)}>
            ‹ Alle Schnappschüsse
          </button>
          <div className="snap-title">{open.title}</div>
          <div className="muted small-text">{fmt(open.createdAt)}</div>
          <div className="seg">
            <button className={mode === 'diff' ? 'active' : ''} onClick={() => setMode('diff')}>
              Vergleich
            </button>
            <button className={mode === 'view' ? 'active' : ''} onClick={() => setMode('view')}>
              Inhalt
            </button>
          </div>
          {mode === 'diff' && (
            <p className="muted small-text">
              <del>Rot</del> = nur im Schnappschuss, <ins>grün</ins> = neu im aktuellen Text
            </p>
          )}
          <div className="snap-body">
            {mode === 'view' && <div className="prose-mini" dangerouslySetInnerHTML={{ __html: open.html }} />}
            {mode === 'diff' && diff && (
              <div className="diff">
                {diff.map((part, i) =>
                  part.added ? (
                    <ins key={i}>{part.value}</ins>
                  ) : part.removed ? (
                    <del key={i}>{part.value}</del>
                  ) : (
                    <span key={i}>{part.value}</span>
                  ),
                )}
              </div>
            )}
          </div>
          <div className="snap-actions">
            <button className="primary" onClick={() => restore(open)}>
              Wiederherstellen
            </button>
            <button
              className="link danger"
              onClick={() => {
                if (confirm('Diesen Schnappschuss löschen?')) {
                  deleteSnapshot(uid, pid, open.id)
                  setOpenId(null)
                }
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
