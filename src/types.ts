export interface Project {
  id: string
  title: string
  wordGoal: number
  createdAt: number
  updatedAt: number
}

export type NodeType = 'folder' | 'text'

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
}
