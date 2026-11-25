import { useEffect, useMemo, useState } from 'react'
import type { BinderNode, Project } from '../types'
import { updateProject, watchNodes } from '../data'
import Binder from './Binder'
import Editor from './Editor'
import Corkboard from './Corkboard'
import SyncBadge from './SyncBadge'
import { flattenTexts, wordsUnder } from '../tree'

interface Props {
  uid: string
  project: Project
  onBack: () => void
}

const isNarrow = () => window.matchMedia('(max-width: 800px)').matches

export default function Workspace({ uid, project, onBack }: Props) {
  const [nodes, setNodes] = useState<BinderNode[] | null>(null)
  const selKey = `selected-${project.id}`
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(selKey))
  const [sidebar, setSidebar] = useState(() => !isNarrow())
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => watchNodes(uid, project.id, setNodes), [uid, project.id])

  const select = (id: string) => {
    setSelectedId(id)
    try {
      localStorage.setItem(selKey, id)
    } catch {
      /* egal */
    }
    if (isNarrow()) setSidebar(false)
  }

  const selected = nodes?.find((n) => n.id === selectedId && !n.trashed) ?? null

  // Ohne gültige Auswahl: ersten Text öffnen
  useEffect(() => {
    if (nodes && !selected) {
      const first = flattenTexts(nodes)[0]
      if (first) setSelectedId(first.id)
    }
  }, [nodes, selected])

  // Gezählt wird der Ordner „Manuskript“ (wie der Entwurfsordner in Scrivener), sonst alles
  const manuscriptWords = useMemo(() => {
    if (!nodes) return 0
    const ms = nodes.find((n) => n.parentId === null && !n.trashed && n.title === 'Manuskript')
    if (ms) return wordsUnder(nodes, ms.id)
    return nodes.filter((n) => !n.trashed).reduce((s, n) => s + (n.wordCount || 0), 0)
  }, [nodes])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [focusMode])
  const goal = project.wordGoal || 0
  const pct = goal ? Math.min(100, Math.round((manuscriptWords / goal) * 100)) : 0

  const editGoal = () => {
    const v = prompt('Wortziel für dieses Projekt:', String(goal))
    if (v === null) return
    const n = parseInt(v.replace(/\D/g, ''), 10)
    if (!isNaN(n)) updateProject(uid, project.id, { wordGoal: n })
  }

  const showSidebar = sidebar && !focusMode

  return (
    <div className={`workspace${focusMode ? ' focus-mode' : ''}`}>
      {!focusMode && (
        <header className="topbar">
          <button className="ghost" onClick={() => setSidebar(!sidebar)} title="Binder ein-/ausblenden">
            ☰
          </button>
          <button className="ghost" onClick={onBack} title="Alle Projekte">
            ‹ Projekte
          </button>
          <strong className="project-title">{project.title}</strong>
          <span className="grow" />
          <button className="goal" onClick={editGoal} title="Wortziel ändern">
            <span className="goal-bar">
              <span style={{ width: pct + '%' }} />
            </span>
            {manuscriptWords.toLocaleString('de-DE')}
            {goal ? ` / ${goal.toLocaleString('de-DE')}` : ''} Wörter
          </button>
          <SyncBadge />
        </header>
      )}
      <div className="main">
        {showSidebar && (
          <>
            <aside className="sidebar">
              {nodes ? (
                <Binder uid={uid} pid={project.id} nodes={nodes} selectedId={selectedId} onSelect={select} />
              ) : (
                <p className="muted center">Lade …</p>
              )}
            </aside>
            <div className="scrim" onClick={() => setSidebar(false)} />
          </>
        )}
        <section className="content">
          {selected?.type === 'text' && (
            <Editor
              uid={uid}
              pid={project.id}
              node={selected}
              focusMode={focusMode}
              onToggleFocus={() => setFocusMode(!focusMode)}
            />
          )}
          {selected?.type === 'folder' && nodes && (
            <Corkboard uid={uid} pid={project.id} folder={selected} nodes={nodes} onOpen={select} />
          )}
          {!selected && nodes && <p className="muted center">Wähle links eine Szene aus oder lege eine neue an.</p>}
        </section>
      </div>
    </div>
  )
}
