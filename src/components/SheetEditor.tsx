import { useEffect, useRef, useState } from 'react'
import type { BinderNode } from '../types'
import { NODE_ICONS } from '../types'
import { loadContent, saveSheet, updateNodes } from '../data'

interface Props {
  uid: string
  pid: string
  node: BinderNode
  nodes: BinderNode[]
  onOpen: (id: string) => void
}

type Field = { key: string; label: string; long?: boolean; placeholder?: string }

export const SHEET_TEMPLATES: Record<'character' | 'place', Field[]> = {
  character: [
    { key: 'role', label: 'Rolle', placeholder: 'Protagonistin, Antagonist, Mentor …' },
    { key: 'age', label: 'Alter' },
    { key: 'looks', label: 'Aussehen', long: true },
    { key: 'personality', label: 'Persönlichkeit', long: true },
    { key: 'goal', label: 'Ziel & Motivation', long: true, placeholder: 'Was will die Figur – und warum?' },
    { key: 'conflict', label: 'Innerer Konflikt', long: true, placeholder: 'Angst, Lüge, Wunde …' },
    { key: 'backstory', label: 'Hintergrund', long: true },
    { key: 'arc', label: 'Entwicklung (Figurenbogen)', long: true },
    { key: 'relations', label: 'Beziehungen', long: true },
    { key: 'voice', label: 'Sprechweise & Eigenheiten', long: true },
    { key: 'notes', label: 'Notizen', long: true },
  ],
  place: [
    { key: 'kind', label: 'Art des Ortes', placeholder: 'Stadt, Haus, Wald, Raumschiff …' },
    { key: 'location', label: 'Lage' },
    { key: 'description', label: 'Beschreibung', long: true },
    { key: 'senses', label: 'Sinneseindrücke', long: true, placeholder: 'Geräusche, Gerüche, Licht, Temperatur …' },
    { key: 'mood', label: 'Atmosphäre', long: true },
    { key: 'meaning', label: 'Bedeutung für die Geschichte', long: true },
    { key: 'notes', label: 'Notizen', long: true },
  ],
}

/** Bild verkleinern und als JPEG-data:-URL zurückgeben (passt bequem in Firestore) */
async function resizeImage(file: File, max = 600): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Figuren- bzw. Ortsbogen */
export default function SheetEditor({ uid, pid, node, nodes, onOpen }: Props) {
  const kind = node.type === 'place' ? 'place' : 'character'
  const template = SHEET_TEMPLATES[kind]
  const [fields, setFields] = useState<Record<string, string> | null>(null)
  const [image, setImage] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const latest = useRef<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setFields(null)
    loadContent(uid, pid, node.id).then((c) => {
      if (cancelled) return
      latest.current = c.fields ?? {}
      setFields(c.fields ?? {})
      setImage(c.image ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [uid, pid, node.id])

  const saveField = (key: string, value: string) => {
    if ((latest.current[key] ?? '') === value) return
    latest.current = { ...latest.current, [key]: value }
    saveSheet(uid, pid, node.id, { fields: latest.current })
  }

  const pickImage = async (f: File | undefined) => {
    if (!f) return
    try {
      const data = await resizeImage(f)
      setImage(data)
      saveSheet(uid, pid, node.id, { image: data })
    } catch {
      alert('Das Bild konnte nicht gelesen werden.')
    }
  }

  const povScenes =
    kind === 'character' ? nodes.filter((n) => n.pov === node.id && !n.trashed && n.type === 'text') : []

  return (
    <div className="sheet-wrap">
      <div className="sheet">
        <div className="sheet-top">
          <div className="sheet-image" onClick={() => fileRef.current?.click()} title="Bild wählen">
            {image ? <img src={image} alt="" /> : <span>{NODE_ICONS[node.type]}<br />Bild wählen</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pickImage(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="sheet-head">
            <input
              className="doc-title"
              key={node.id + node.title}
              defaultValue={node.title}
              placeholder={kind === 'character' ? 'Name' : 'Name des Ortes'}
              onBlur={(e) => {
                const t = e.target.value.trim()
                if (t && t !== node.title) updateNodes(uid, pid, [{ id: node.id, data: { title: t } }])
              }}
            />
            <textarea
              key={'syn-' + node.id}
              className="sheet-summary"
              placeholder="Kurzbeschreibung in einem Satz (erscheint auf der Pinnwand)"
              defaultValue={node.synopsis}
              onBlur={(e) => {
                if (e.target.value !== node.synopsis)
                  updateNodes(uid, pid, [{ id: node.id, data: { synopsis: e.target.value } }])
              }}
            />
            {image && (
              <button
                className="link danger"
                onClick={() => {
                  setImage('')
                  saveSheet(uid, pid, node.id, { image: null })
                }}
              >
                Bild entfernen
              </button>
            )}
          </div>
        </div>

        {fields === null ? (
          <p className="muted">Lade …</p>
        ) : (
          <div className="sheet-fields" key={node.id}>
            {template.map((f) => (
              <label key={f.key} className={f.long ? 'long' : ''}>
                <span>{f.label}</span>
                {f.long ? (
                  <textarea
                    defaultValue={fields[f.key] ?? ''}
                    placeholder={f.placeholder}
                    rows={3}
                    onBlur={(e) => saveField(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    defaultValue={fields[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onBlur={(e) => saveField(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        )}

        {kind === 'character' && (
          <div className="sheet-scenes">
            <h3>Szenen aus Sicht dieser Figur (POV)</h3>
            {povScenes.length === 0 ? (
              <p className="muted small-text">
                Noch keine. Den POV einer Szene legst du in den „Details“ der Szene oder im Outliner fest.
              </p>
            ) : (
              <ul>
                {povScenes.map((s) => (
                  <li key={s.id}>
                    <button className="link" onClick={() => onOpen(s.id)}>
                      📄 {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
