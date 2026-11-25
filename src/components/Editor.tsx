import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor as TEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import type { BinderNode } from '../types'
import { loadContent, saveContent, updateNodes } from '../data'

interface Props {
  uid: string
  pid: string
  node: BinderNode
  focusMode: boolean
  onToggleFocus: () => void
}

const SAVE_DELAY = 800

export default function Editor({ uid, pid, node, focusMode, onToggleFocus }: Props) {
  const [loading, setLoading] = useState(true)
  const [showSynopsis, setShowSynopsis] = useState(false)
  const currentId = useRef<string | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)
  const startWords = useRef(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Schreib los …' }),
      CharacterCount,
      // Deutsche Anführungszeichen „…“ und ‚…‘
      Typography.configure({
        openDoubleQuote: '„',
        closeDoubleQuote: '“',
        openSingleQuote: '‚',
        closeSingleQuote: '‘',
      }),
    ],
    editable: false,
    editorProps: { attributes: { class: 'prose', spellcheck: 'true', lang: 'de' } },
    onUpdate: () => {
      dirty.current = true
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flush, SAVE_DELAY)
    },
  })

  // Refs, damit die (einmalig registrierten) Callbacks immer aktuelle Werte sehen
  const ctx = useRef({ editor, uid, pid })
  ctx.current = { editor, uid, pid }

  function flush() {
    window.clearTimeout(saveTimer.current)
    const { editor: ed, uid: u, pid: p } = ctx.current
    if (!ed || !dirty.current || !currentId.current) return
    dirty.current = false
    saveContent(u, p, currentId.current, ed.getHTML(), ed.storage.characterCount.words())
  }

  // Inhalt laden, wenn sich der ausgewählte Text ändert
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    flush()
    currentId.current = null
    setLoading(true)
    editor.setEditable(false)
    loadContent(uid, pid, node.id)
      .catch((e) => {
        console.error(e)
        return ''
      })
      .then((html) => {
        if (cancelled) return
        editor.commands.setContent(html || '', { emitUpdate: false })
        currentId.current = node.id
        startWords.current = editor.storage.characterCount.words()
        editor.setEditable(true)
        setLoading(false)
        // Nicht fokussieren, wenn gerade ein Eingabefeld (z. B. Umbenennen) aktiv ist
        const a = document.activeElement
        if (!(a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement)) editor.commands.focus('end')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.id, uid, pid])

  // Beim Verlassen / Schließen sichern
  useEffect(() => {
    const h = () => flush()
    window.addEventListener('pagehide', h)
    document.addEventListener('visibilitychange', h)
    return () => {
      window.removeEventListener('pagehide', h)
      document.removeEventListener('visibilitychange', h)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const words = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? editor.storage.characterCount.words() : 0),
  })

  return (
    <div className={`editor-wrap${focusMode ? ' focus' : ''}`}>
      <div className="editor-head">
        <input
          className="doc-title"
          key={node.id}
          defaultValue={node.title}
          placeholder="Titel"
          onBlur={(e) => {
            const t = e.target.value.trim()
            if (t && t !== node.title) updateNodes(uid, pid, [{ id: node.id, data: { title: t } }])
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              editor?.commands.focus('start')
            }
          }}
        />
        <button
          className={`ghost small${showSynopsis || node.synopsis ? ' active' : ''}`}
          onClick={() => setShowSynopsis(!showSynopsis)}
          title="Inhaltsangabe (erscheint auf der Pinnwand)"
        >
          Synopsis
        </button>
      </div>
      {showSynopsis && (
        <textarea
          key={'syn-' + node.id}
          className="synopsis"
          placeholder="Kurze Inhaltsangabe dieser Szene …"
          defaultValue={node.synopsis}
          onBlur={(e) => {
            if (e.target.value !== node.synopsis)
              updateNodes(uid, pid, [{ id: node.id, data: { synopsis: e.target.value } }])
          }}
        />
      )}

      {editor && <Toolbar editor={editor} focusMode={focusMode} onToggleFocus={onToggleFocus} />}

      <div className="editor-scroll" onClick={() => editor?.commands.focus()}>
        {loading && <div className="muted center">Lade …</div>}
        <EditorContent editor={editor} className="editor-content" />
      </div>

      <div className="editor-foot">
        <span>{words.toLocaleString('de-DE')} Wörter</span>
        {!loading && words - startWords.current !== 0 && (
          <span className="muted">
            {' '}
            · diese Sitzung {words - startWords.current > 0 ? '+' : ''}
            {(words - startWords.current).toLocaleString('de-DE')}
          </span>
        )}
      </div>
    </div>
  )
}

function Toolbar({
  editor,
  focusMode,
  onToggleFocus,
}: {
  editor: TEditor
  focusMode: boolean
  onToggleFocus: () => void
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      quote: e.isActive('blockquote'),
      ul: e.isActive('bulletList'),
      ol: e.isActive('orderedList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()
  return (
    <div className="toolbar">
      <B label="↶" title="Rückgängig" disabled={!s.canUndo} run={() => c().undo().run()} />
      <B label="↷" title="Wiederholen" disabled={!s.canRedo} run={() => c().redo().run()} />
      <span className="sep" />
      <B on={s.bold} label="F" title="Fett" run={() => c().toggleBold().run()} />
      <B on={s.italic} label="K" title="Kursiv" run={() => c().toggleItalic().run()} />
      <B on={s.underline} label="U" title="Unterstrichen" run={() => c().toggleUnderline().run()} />
      <B on={s.strike} label="S" title="Durchgestrichen" run={() => c().toggleStrike().run()} />
      <span className="sep" />
      <B on={s.h1} label="H1" title="Überschrift 1" run={() => c().toggleHeading({ level: 1 }).run()} />
      <B on={s.h2} label="H2" title="Überschrift 2" run={() => c().toggleHeading({ level: 2 }).run()} />
      <B on={s.h3} label="H3" title="Überschrift 3" run={() => c().toggleHeading({ level: 3 }).run()} />
      <B on={s.quote} label="❝" title="Zitat" run={() => c().toggleBlockquote().run()} />
      <B on={s.ul} label="•" title="Aufzählung" run={() => c().toggleBulletList().run()} />
      <B on={s.ol} label="1." title="Nummerierte Liste" run={() => c().toggleOrderedList().run()} />
      <B label="⁂" title="Szenentrenner" run={() => c().setHorizontalRule().run()} />
      <span className="grow" />
      <B on={focusMode} label="◎" title="Fokus-Modus" run={onToggleFocus} />
    </div>
  )
}

function B(props: { on?: boolean; label: string; title: string; run: () => void; disabled?: boolean }) {
  return (
    <button
      className={props.on ? 'active' : ''}
      title={props.title}
      aria-label={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.run}
    >
      {props.label}
    </button>
  )
}
