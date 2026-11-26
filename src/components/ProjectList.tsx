import { useEffect, useRef, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import {
  createProject,
  deleteProject,
  exportProject,
  importProject,
  updateProject,
  watchProjects,
  type Backup,
} from '../data'
import type { Project } from '../types'
import SyncBadge from './SyncBadge'

interface Props {
  user: User
  onOpen: (p: Project) => void
}

export default function ProjectList({ user, onOpen }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => watchProjects(user.uid, setProjects), [user.uid])

  const create = () => {
    const title = prompt('Titel des neuen Projekts:', 'Mein Roman')
    if (!title?.trim()) return
    createProject(user.uid, title.trim())
  }

  const rename = (p: Project) => {
    const title = prompt('Neuer Titel:', p.title)
    if (title?.trim() && title.trim() !== p.title) updateProject(user.uid, p.id, { title: title.trim() })
  }

  const remove = (p: Project) => {
    const answer = prompt(
      `Projekt „${p.title}“ mit allen Texten endgültig löschen?\nZur Bestätigung den Titel eintippen:`,
    )
    if (answer === p.title) deleteProject(user.uid, p.id)
  }

  const backup = async (p: Project) => {
    setBusy(p.id)
    try {
      const data = await exportProject(user.uid, p.id)
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safe = p.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Projekt'
      a.href = url
      a.download = `${safe} – Backup ${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      alert('Backup fehlgeschlagen: ' + (e as Error).message)
    }
    setBusy(null)
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Backup
      importProject(user.uid, data)
      alert(`„${data.project.title}“ wurde als neues Projekt wiederhergestellt.`)
    } catch (e) {
      alert('Die Datei konnte nicht eingespielt werden: ' + (e as Error).message)
    }
  }

  return (
    <div className="projects">
      <header className="topbar">
        <strong>✒️ Schreibwerkstatt</strong>
        <span className="grow" />
        <SyncBadge />
        <span className="muted user">{user.displayName ?? user.email}</span>
        <button className="ghost" onClick={() => signOut(auth)}>
          Abmelden
        </button>
      </header>
      <main className="projects-main">
        <div className="projects-head">
          <h1>Deine Projekte</h1>
          <div className="row-gap">
            <button onClick={() => fileRef.current?.click()} title="Backup-Datei (.json) als neues Projekt einspielen">
              Backup einspielen
            </button>
            <button className="primary" onClick={create}>
              ＋ Neues Projekt
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              restore(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        {projects === null && <p className="muted">Lade …</p>}
        {projects?.length === 0 && (
          <p className="muted">Noch keine Projekte. Leg dein erstes an!</p>
        )}
        <div className="project-grid">
          {projects?.map((p) => (
            <div key={p.id} className="project-card" onClick={() => onOpen(p)}>
              <h3>{p.title}</h3>
              <p className="muted">
                Zuletzt bearbeitet {new Date(p.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <div className="project-actions" onClick={(e) => e.stopPropagation()}>
                <button className="link" onClick={() => rename(p)}>
                  Umbenennen
                </button>
                <button className="link" onClick={() => backup(p)} disabled={busy === p.id}>
                  {busy === p.id ? 'Sichere …' : 'Backup'}
                </button>
                <button className="link danger" onClick={() => remove(p)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
