import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { watchProjects } from './data'
import type { Project } from './types'
import Login from './components/Login'
import ProjectList from './components/ProjectList'
import Workspace from './components/Workspace'

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [projects, setProjects] = useState<Project[]>([])
  const [openId, setOpenId] = useState<string | null>(() => localStorage.getItem('open-project'))

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => (user ? watchProjects(user.uid, setProjects) : undefined), [user])

  const open = (id: string | null) => {
    setOpenId(id)
    try {
      if (id) localStorage.setItem('open-project', id)
      else localStorage.removeItem('open-project')
    } catch {
      /* egal */
    }
  }

  if (user === undefined) return <div className="muted center full">Lade …</div>
  if (!user) return <Login />

  const project = projects.find((p) => p.id === openId)
  if (project) return <Workspace key={project.id} uid={user.uid} project={project} onBack={() => open(null)} />
  return <ProjectList user={user} onOpen={(p) => open(p.id)} />
}
