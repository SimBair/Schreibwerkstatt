import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { auth } from '../firebase'

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const login = async () => {
    setBusy(true)
    setError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
        return
      }
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(
          code === 'auth/unauthorized-domain'
            ? 'Diese Domain ist in Firebase noch nicht freigegeben (Authentication → Einstellungen → Autorisierte Domains).'
            : `Anmeldung fehlgeschlagen (${code ?? 'unbekannt'}).`,
        )
      }
    }
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="logo">✒️</div>
        <h1>Schreibwerkstatt</h1>
        <p className="muted">Deine Texte – auf iPad und PC, immer synchron.</p>
        <button className="primary" onClick={login} disabled={busy}>
          {busy ? 'Anmelden …' : 'Mit Google anmelden'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
