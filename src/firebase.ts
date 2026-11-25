import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Öffentliche Web-Konfiguration – kein Geheimnis. Der Schutz der Daten
// erfolgt über die Firestore-Sicherheitsregeln (firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyBDLJFx-tNYLl7UU5O3Tfe9zz8TRn1rkos',
  authDomain: 'schreibwerkstatt-3dcd9.firebaseapp.com',
  projectId: 'schreibwerkstatt-3dcd9',
  storageBucket: 'schreibwerkstatt-3dcd9.firebasestorage.app',
  messagingSenderId: '544996882282',
  appId: '1:544996882282:web:d3471be3d2a6ac88f61713',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Offline-Cache in IndexedDB: Die App funktioniert ohne Netz und
// synchronisiert automatisch, sobald wieder eine Verbindung besteht.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
