import { useEffect, useMemo, useState } from 'react'
import type { BinderNode, DayStat, Project } from '../types'
import { DEFAULT_LABELS, today } from '../types'
import { watchDays, watchNodes } from '../data'
import Binder from './Binder'
import Editor from './Editor'
import FolderView from './FolderView'
import SheetEditor from './SheetEditor'
import StatsDialog from './StatsDialog'
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
  const [days, setDays] = useState<DayStat[]>([])
  const selKey = `selected-${project.id}`
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(selKey))
  const [sidebar, setSidebar] = useState(() => !isNarrow())
  const [focusMode, setFocusMode] = useState(false)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => watchNodes(uid, project.id, setNodes), [uid, project.id])
  useEffect(() => watchDays(uid, project.id, setDays), [uid, project.id])

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [focusMode])

  // Gezählt wird der Ordner „Manuskript“ (wie der Entwurfsordner in Scrivener), sonst alles
  const manuscriptWords = useMemo(() => {
    if (!nodes) return 0
    const ms = nodes.find((n) => n.parentId === null && !n.trashed && n.title === 'Manuskript')
    if (ms) return wordsUnder(nodes, ms.id)
    return nodes.filter((n) => !n.trashed).reduce((s, n) => s + (n.wordCount || 0), 0)
  }, [nodes])

  const characters = useMemo(
    () =>
      (nodes ?? [])
        .filter((n) => n.type === 'character' && !n.trashed)
        .sort((a, b) => a.title.localeCompare(b.title, 'de')),
    [nodes],
  )
  const labels = project.labels ?? DEFAULT_LABELS

  const dailyGoal = project.dailyGoal ?? 500
  const todayWords = Math.max(0, days.find((d) => d.id === today())?.words ?? 0)
  const pct = dailyGoal ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0

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
          <button className="goal" onClick={() => setShowStats(true)} title="Schreibstatistik">
            <span className={`goal-bar${pct >= 100 ? ' done' : ''}`}>
              <span style={{ width: pct + '%' }} />
            </span>
            Heute {todayWords.toLocaleString('de-DE')}
            <span className="goal-of"> / {dailyGoal.toLocaleString('de-DE')}</span>
            {pct >= 100 ? ' ✓' : ''}
          </button>
          <SyncBadge />
        </header>
      )}
      <div className="main">
        {showSidebar && (
          <>
            <aside className="sidebar">
              {nodes ? (
                <Binder
                  uid={uid}
                  pid={project.id}
                  nodes={nodes}
                  labels={labels}
                  selectedId={selectedId}
                  onSelect={select}
                />
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
              labels={labels}
              characters={characters}
              focusMode={focusMode}
              onToggleFocus={() => setFocusMode(!focusMode)}
            />
          )}
          {selected?.type === 'folder' && nodes && (
            <FolderView
              uid={uid}
              pid={project.id}
              folder={selected}
              nodes={nodes}
              labels={labels}
              characters={characters}
              onOpen={select}
            />
          )}
          {(selected?.type === 'character' || selected?.type === 'place') && nodes && (
            <SheetEditor uid={uid} pid={project.id} node={selected} nodes={nodes} onOpen={select} />
          )}
          {!selected && nodes && <p className="muted center">Wähle links eine Szene aus oder lege eine neue an.</p>}
        </section>
      </div>
      {showStats && (
        <StatsDialog
          uid={uid}
          project={project}
          days={days}
          manuscriptWords={manuscriptWords}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  )
}
