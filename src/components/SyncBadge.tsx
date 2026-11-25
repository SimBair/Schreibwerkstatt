import { useEffect, useState } from 'react'
import { onSyncChange } from '../data'

export default function SyncBadge() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => onSyncChange(setPending), [])
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  let cls = 'ok'
  let label = 'Synchronisiert'
  if (!online) {
    cls = 'offline'
    label = pending ? 'Offline – lokal gespeichert' : 'Offline'
  } else if (pending) {
    cls = 'pending'
    label = 'Synchronisiere …'
  }
  return (
    <span className={`sync ${cls}`} title={label}>
      <span className="dot" />
      <span className="sync-label">{label}</span>
    </span>
  )
}
