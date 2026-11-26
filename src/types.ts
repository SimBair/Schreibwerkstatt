export interface Label {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  title: string
  wordGoal: number
  dailyGoal?: number
  labels?: Label[]
  createdAt: number
  updatedAt: number
}

export type NodeType = 'folder' | 'text' | 'character' | 'place'

export interface BinderNode {
  id: string
  type: NodeType
  title: string
  parentId: string | null
  order: number
  synopsis: string
  wordCount: number
  trashed: boolean
  updatedAt: number
  status?: string
  label?: string
  /** ID einer Figur (Node vom Typ 'character') */
  pov?: string
}

export interface ContentDoc {
  html: string
  fields?: Record<string, string>
  /** kleines Bild als data:-URL (JPEG, verkleinert) */
  image?: string
}

export interface Snapshot {
  id: string
  nodeId: string
  title: string
  html: string
  wordCount: number
  createdAt: number
}

export interface DayStat {
  /** Datum im Format JJJJ-MM-TT */
  id: string
  words: number
}

export const STATUSES = ['Idee', 'Entwurf', 'Erste Fassung', 'Überarbeitet', 'Fertig']

export const DEFAULT_LABELS: Label[] = [
  { id: 'main', name: 'Haupthandlung', color: '#c0504d' },
  { id: 'sub', name: 'Nebenhandlung', color: '#4f81bd' },
  { id: 'back', name: 'Rückblende', color: '#7a9a3a' },
  { id: 'idea', name: 'Idee', color: '#e08a2c' },
]

export const NODE_ICONS: Record<NodeType, string> = {
  folder: '📁',
  text: '📄',
  character: '👤',
  place: '📍',
}

export const NODE_DEFAULT_TITLES: Record<NodeType, string> = {
  folder: 'Neuer Ordner',
  text: 'Neue Szene',
  character: 'Neue Figur',
  place: 'Neuer Ort',
}

/** Lokales Datum als JJJJ-MM-TT */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
