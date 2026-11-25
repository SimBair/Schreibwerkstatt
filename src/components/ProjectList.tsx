import { useEffect, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { createProject, deleteProject, updateProject, watchProjects } from '../data'
import type { Project } from '../types'
import SyncBadge from './SyncBadge'

interface Props {
  user: User
  onOpen: (p: Project) => void
}

export default function ProjectList({ user, onOpen }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null)
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
          <button className="primary" onClick={create}>
            ＋ Neues Projekt
          </button>
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
