import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { BinderNode, NodeType, Project } from './types'

/*
 * Datenmodell in Firestore:
 *   users/{uid}/projects/{projectId}                    – Projekt-Metadaten
 *   users/{uid}/projects/{projectId}/nodes/{nodeId}     – Binder-Einträge (Ordner/Texte)
 *   users/{uid}/projects/{projectId}/contents/{nodeId}  – Textinhalt (HTML) je Eintrag
 *
 * Inhalt und Metadaten sind getrennt, damit der Binder leichtgewichtig bleibt
 * und jedes Dokument weit unter der 1-MB-Grenze von Firestore liegt.
 */

const projectsCol = (uid: string) => collection(db, 'users', uid, 'projects')
const nodesCol = (uid: string, pid: string) => collection(db, 'users', uid, 'projects', pid, 'nodes')
const contentsCol = (uid: string, pid: string) =>
  collection(db, 'users', uid, 'projects', pid, 'contents')

// ---------- Sync-Status ----------
// Schreibvorgänge liefern erst dann ein Ergebnis, wenn der Server sie bestätigt
// hat. Offline bleiben sie offen – so wissen wir, ob noch etwas aussteht.

type SyncListener = (pending: number) => void
let pending = 0
const syncListeners = new Set<SyncListener>()

export function onSyncChange(fn: SyncListener): () => void {
  syncListeners.add(fn)
  fn(pending)
  return () => syncListeners.delete(fn)
}

function track(p: Promise<unknown>) {
  pending++
  syncListeners.forEach((l) => l(pending))
  p.catch((e) => console.error('Sync-Fehler', e)).finally(() => {
    pending--
    syncListeners.forEach((l) => l(pending))
  })
}

// ---------- Projekte ----------

export function watchProjects(uid: string, cb: (projects: Project[]) => void): Unsubscribe {
  return onSnapshot(query(projectsCol(uid), orderBy('updatedAt', 'desc')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project))
  })
}

export function createProject(uid: string, title: string): string {
  const now = Date.now()
  const pref = doc(projectsCol(uid))
  const batch = writeBatch(db)
  batch.set(pref, { title, wordGoal: 50000, createdAt: now, updatedAt: now })

  // Startstruktur: Manuskript > Kapitel 1 > Szene 1, dazu Notizen
  const mk = (type: NodeType, title: string, parentId: string | null, order: number) => {
    const ref = doc(nodesCol(uid, pref.id))
    const node: Omit<BinderNode, 'id'> = {
      type,
      title,
      parentId,
      order,
      synopsis: '',
      wordCount: 0,
      trashed: false,
      updatedAt: now,
    }
    batch.set(ref, node)
    return ref.id
  }
  const manuscript = mk('folder', 'Manuskript', null, 0)
  const chapter = mk('folder', 'Kapitel 1', manuscript, 0)
  mk('text', 'Szene 1', chapter, 0)
  mk('folder', 'Figuren', null, 1)
  mk('folder', 'Orte', null, 2)
  mk('folder', 'Notizen', null, 3)

  track(batch.commit())
  return pref.id
}

export function updateProject(uid: string, pid: string, data: Partial<Omit<Project, 'id'>>) {
  const batch = writeBatch(db)
  batch.update(doc(projectsCol(uid), pid), { ...data, updatedAt: Date.now() })
  track(batch.commit())
}

export async function deleteProject(uid: string, pid: string) {
  const [nodes, contents] = await Promise.all([
    getDocs(nodesCol(uid, pid)),
    getDocs(contentsCol(uid, pid)),
  ])
  const refs = [...nodes.docs.map((d) => d.ref), ...contents.docs.map((d) => d.ref)]
  // Firestore-Batches sind auf 500 Operationen begrenzt
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db)
    refs.slice(i, i + 450).forEach((r) => batch.delete(r))
    track(batch.commit())
  }
  const batch = writeBatch(db)
  batch.delete(doc(projectsCol(uid), pid))
  track(batch.commit())
}

// ---------- Binder ----------

export function watchNodes(uid: string, pid: string, cb: (nodes: BinderNode[]) => void): Unsubscribe {
  return onSnapshot(nodesCol(uid, pid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BinderNode))
  })
}

export function addNode(
  uid: string,
  pid: string,
  type: NodeType,
  title: string,
  parentId: string | null,
  order: number,
): string {
  const ref = doc(nodesCol(uid, pid))
  const node: Omit<BinderNode, 'id'> = {
    type,
    title,
    parentId,
    order,
    synopsis: '',
    wordCount: 0,
    trashed: false,
    updatedAt: Date.now(),
  }
  const batch = writeBatch(db)
  batch.set(ref, node)
  batch.update(doc(projectsCol(uid), pid), { updatedAt: Date.now() })
  track(batch.commit())
  return ref.id
}

export function updateNodes(
  uid: string,
  pid: string,
  updates: { id: string; data: Partial<Omit<BinderNode, 'id'>> }[],
) {
  if (!updates.length) return
  const batch = writeBatch(db)
  for (const u of updates) batch.update(doc(nodesCol(uid, pid), u.id), u.data)
  track(batch.commit())
}

export function deleteNodesForever(uid: string, pid: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 200)) {
      batch.delete(doc(nodesCol(uid, pid), id))
      batch.delete(doc(contentsCol(uid, pid), id))
    }
    track(batch.commit())
  }
}

// ---------- Inhalte ----------

export async function loadContent(uid: string, pid: string, nodeId: string): Promise<string> {
  const snap = await getDoc(doc(contentsCol(uid, pid), nodeId))
  return snap.exists() ? ((snap.data().html as string) ?? '') : ''
}

export function saveContent(uid: string, pid: string, nodeId: string, html: string, wordCount: number) {
  const now = Date.now()
  const batch = writeBatch(db)
  batch.set(doc(contentsCol(uid, pid), nodeId), { html, updatedAt: now })
  batch.update(doc(nodesCol(uid, pid), nodeId), { wordCount, updatedAt: now })
  batch.update(doc(projectsCol(uid), pid), { updatedAt: now })
  track(batch.commit())
}
