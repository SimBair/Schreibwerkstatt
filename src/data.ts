import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { BinderNode, ContentDoc, DayStat, NodeType, Project, Snapshot } from './types'
import { DEFAULT_LABELS, today } from './types'

/*
 * Datenmodell in Firestore:
 *   users/{uid}/projects/{pid}                     – Projekt-Metadaten
 *   users/{uid}/projects/{pid}/nodes/{nodeId}      – Binder-Einträge
 *   users/{uid}/projects/{pid}/contents/{nodeId}   – Inhalt (HTML, Felder, Bild) je Eintrag
 *   users/{uid}/projects/{pid}/snapshots/{id}      – Schnappschüsse einzelner Texte
 *   users/{uid}/projects/{pid}/days/{JJJJ-MM-TT}   – geschriebene Wörter pro Tag
 *
 * Inhalt und Metadaten sind getrennt, damit der Binder leichtgewichtig bleibt
 * und jedes Dokument weit unter der 1-MB-Grenze von Firestore liegt.
 */

const projectsCol = (uid: string) => collection(db, 'users', uid, 'projects')
const sub = (uid: string, pid: string, name: string) => collection(db, 'users', uid, 'projects', pid, name)
const nodesCol = (uid: string, pid: string) => sub(uid, pid, 'nodes')
const contentsCol = (uid: string, pid: string) => sub(uid, pid, 'contents')
const snapshotsCol = (uid: string, pid: string) => sub(uid, pid, 'snapshots')
const daysCol = (uid: string, pid: string) => sub(uid, pid, 'days')

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

/**
 * Viele Schreibvorgänge in Batches aufteilen: Firestore erlaubt max. 500
 * Operationen und ca. 10 MB pro Batch – wir bleiben deutlich darunter.
 */
type Op = { ref: DocumentReference; data?: Record<string, unknown> }
function commitOps(ops: Op[]) {
  const MAX_OPS = 400
  const MAX_BYTES = 4_000_000
  let batch = writeBatch(db)
  let count = 0
  let bytes = 0
  for (const op of ops) {
    const size = op.data ? JSON.stringify(op.data).length * 2 : 100
    if (count > 0 && (count >= MAX_OPS || bytes + size > MAX_BYTES)) {
      track(batch.commit())
      batch = writeBatch(db)
      count = 0
      bytes = 0
    }
    if (op.data) batch.set(op.ref, op.data)
    else batch.delete(op.ref)
    count++
    bytes += size
  }
  if (count > 0) track(batch.commit())
}

// ---------- Projekte ----------

export function watchProjects(uid: string, cb: (projects: Project[]) => void): Unsubscribe {
  return onSnapshot(query(projectsCol(uid), orderBy('updatedAt', 'desc')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project))
  })
}

function newNode(type: NodeType, title: string, parentId: string | null, order: number): Omit<BinderNode, 'id'> {
  return { type, title, parentId, order, synopsis: '', wordCount: 0, trashed: false, updatedAt: Date.now() }
}

export function createProject(uid: string, title: string): string {
  const now = Date.now()
  const pref = doc(projectsCol(uid))
  const batch = writeBatch(db)
  batch.set(pref, {
    title,
    wordGoal: 50000,
    dailyGoal: 500,
    labels: DEFAULT_LABELS,
    createdAt: now,
    updatedAt: now,
  })

  // Startstruktur: Manuskript > Kapitel 1 > Szene 1, dazu Recherche-Ordner
  const mk = (type: NodeType, title: string, parentId: string | null, order: number) => {
    const ref = doc(nodesCol(uid, pref.id))
    batch.set(ref, newNode(type, title, parentId, order))
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
  const snaps = await Promise.all(
    ['nodes', 'contents', 'snapshots', 'days'].map((n) => getDocs(sub(uid, pid, n))),
  )
  const ops: Op[] = snaps.flatMap((s) => s.docs.map((d) => ({ ref: d.ref })))
  ops.push({ ref: doc(projectsCol(uid), pid) })
  commitOps(ops)
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
  const batch = writeBatch(db)
  batch.set(ref, newNode(type, title, parentId, order))
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

export async function deleteNodesForever(uid: string, pid: string, ids: string[]) {
  const ops: Op[] = []
  for (const id of ids) {
    ops.push({ ref: doc(nodesCol(uid, pid), id) }, { ref: doc(contentsCol(uid, pid), id) })
  }
  // zugehörige Schnappschüsse ebenfalls entfernen ('in' erlaubt max. 30 Werte)
  for (let i = 0; i < ids.length; i += 30) {
    const s = await getDocs(query(snapshotsCol(uid, pid), where('nodeId', 'in', ids.slice(i, i + 30))))
    s.docs.forEach((d) => ops.push({ ref: d.ref }))
  }
  commitOps(ops)
}

// ---------- Inhalte ----------

export async function loadContent(uid: string, pid: string, nodeId: string): Promise<ContentDoc> {
  const snap = await getDoc(doc(contentsCol(uid, pid), nodeId))
  const d = snap.exists() ? snap.data() : {}
  return { html: (d.html as string) ?? '', fields: d.fields, image: d.image }
}

/**
 * Text speichern. `delta` = Wortdifferenz seit dem letzten Speichern;
 * sie wird in der Tagesstatistik verbucht.
 */
export function saveContent(
  uid: string,
  pid: string,
  nodeId: string,
  html: string,
  wordCount: number,
  delta = 0,
) {
  const now = Date.now()
  const batch = writeBatch(db)
  batch.set(doc(contentsCol(uid, pid), nodeId), { html, updatedAt: now }, { merge: true })
  batch.update(doc(nodesCol(uid, pid), nodeId), { wordCount, updatedAt: now })
  batch.update(doc(projectsCol(uid), pid), { updatedAt: now })
  if (delta) batch.set(doc(daysCol(uid, pid), today()), { words: increment(delta) }, { merge: true })
  track(batch.commit())
}

/** Felder eines Figuren-/Ortsbogens speichern (image: null entfernt das Bild) */
export function saveSheet(
  uid: string,
  pid: string,
  nodeId: string,
  data: { fields?: Record<string, string>; image?: string | null },
) {
  const now = Date.now()
  const batch = writeBatch(db)
  const payload: Record<string, unknown> = { updatedAt: now }
  if (data.fields) payload.fields = data.fields
  if (data.image !== undefined) payload.image = data.image ?? ''
  batch.set(doc(contentsCol(uid, pid), nodeId), payload, { merge: true })
  batch.update(doc(nodesCol(uid, pid), nodeId), { updatedAt: now })
  track(batch.commit())
}

// ---------- Schnappschüsse ----------

export function watchSnapshots(
  uid: string,
  pid: string,
  nodeId: string,
  cb: (s: Snapshot[]) => void,
): Unsubscribe {
  // Nur Gleichheitsfilter → kein zusammengesetzter Index nötig; sortiert wird lokal
  return onSnapshot(query(snapshotsCol(uid, pid), where('nodeId', '==', nodeId)), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Snapshot)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

export function createSnapshot(
  uid: string,
  pid: string,
  nodeId: string,
  title: string,
  html: string,
  wordCount: number,
) {
  const batch = writeBatch(db)
  batch.set(doc(snapshotsCol(uid, pid)), { nodeId, title, html, wordCount, createdAt: Date.now() })
  track(batch.commit())
}

export function deleteSnapshot(uid: string, pid: string, id: string) {
  commitOps([{ ref: doc(snapshotsCol(uid, pid), id) }])
}

// ---------- Statistik ----------

export function watchDays(uid: string, pid: string, cb: (d: DayStat[]) => void): Unsubscribe {
  return onSnapshot(daysCol(uid, pid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, words: (d.data().words as number) ?? 0 })))
  })
}

// ---------- Backup ----------

export interface Backup {
  format: 'schreibwerkstatt-backup'
  version: 1
  exportedAt: string
  project: Omit<Project, 'id'>
  nodes: BinderNode[]
  contents: Record<string, Record<string, unknown>>
  snapshots: Snapshot[]
  days: DayStat[]
}

export async function exportProject(uid: string, pid: string): Promise<Backup> {
  const [p, nodes, contents, snapshots, days] = await Promise.all([
    getDoc(doc(projectsCol(uid), pid)),
    getDocs(nodesCol(uid, pid)),
    getDocs(contentsCol(uid, pid)),
    getDocs(snapshotsCol(uid, pid)),
    getDocs(daysCol(uid, pid)),
  ])
  const project = p.data() as Omit<Project, 'id'>
  return {
    format: 'schreibwerkstatt-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    nodes: nodes.docs.map((d) => ({ id: d.id, ...d.data() }) as BinderNode),
    contents: Object.fromEntries(contents.docs.map((d) => [d.id, d.data()])),
    snapshots: snapshots.docs.map((d) => ({ id: d.id, ...d.data() }) as Snapshot),
    days: days.docs.map((d) => ({ id: d.id, words: d.data().words ?? 0 })),
  }
}

/** Backup als neues Projekt einspielen (bestehende Projekte bleiben unberührt) */
export function importProject(uid: string, b: Backup): string {
  if (b?.format !== 'schreibwerkstatt-backup') throw new Error('Keine gültige Backup-Datei')
  const now = Date.now()
  const pref = doc(projectsCol(uid))
  const ops: Op[] = [
    { ref: pref, data: { ...b.project, title: `${b.project.title} (wiederhergestellt)`, updatedAt: now } },
  ]
  for (const { id, ...n } of b.nodes) ops.push({ ref: doc(nodesCol(uid, pref.id), id), data: n })
  for (const [id, c] of Object.entries(b.contents)) ops.push({ ref: doc(contentsCol(uid, pref.id), id), data: c })
  for (const { id, ...s } of b.snapshots ?? []) ops.push({ ref: doc(snapshotsCol(uid, pref.id), id), data: s })
  for (const { id, words } of b.days ?? []) ops.push({ ref: doc(daysCol(uid, pref.id), id), data: { words } })
  commitOps(ops)
  return pref.id
}
