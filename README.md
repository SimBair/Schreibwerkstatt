# ✒️ Schreibwerkstatt

Eine Schreib-App im Stil von Reedsy und Scrivener. Sie läuft als installierbare
Web-App (PWA) auf iPad und PC, funktioniert offline und synchronisiert über Firebase.

## Funktionen

- Anmeldung mit Google; jede Person sieht nur ihre eigenen Daten
- Projektübersicht: anlegen, umbenennen, löschen, **Backup als JSON-Datei** sichern und einspielen
- **Binder** mit Ordnern, Szenen, Figuren 👤 und Orten 📍: Drag & Drop, ⋯-Menü, Papierkorb
- **Editor** (TipTap): Formatierung, Szenentrenner, deutsche Anführungszeichen „…“, automatisches Speichern
- **Details** je Szene: Synopsis, Status, Label (farbig) und POV-Figur
- **Schnappschüsse**: Stände einer Szene sichern, mit dem aktuellen Text vergleichen und wiederherstellen
- **Pinnwand** und **Outliner** für Ordner, mit frei definierbaren Labels
- **Figuren- und Ortsbögen** mit Vorlagenfeldern und Bild; Figuren zeigen ihre POV-Szenen
- **Statistik**: Tagesziel, Wörter pro Tag (30 Tage), Schreibserie, Prognose fürs Wortziel
- **Fokus-Modus** (◎, beenden mit Esc)
- **Offline-Betrieb**: Änderungen werden lokal gespeichert und später synchronisiert

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Produktions-Build nach dist/
```

## Datenmodell (Firestore)

```
users/{uid}/projects/{projectId}                    Projekt-Metadaten
users/{uid}/projects/{projectId}/nodes/{nodeId}     Binder-Einträge (Ordner/Texte)
users/{uid}/projects/{projectId}/contents/{nodeId}  Inhalt (HTML, Bogenfelder, Bild)
users/{uid}/projects/{projectId}/snapshots/{id}     Schnappschüsse
users/{uid}/projects/{projectId}/days/{JJJJ-MM-TT}  geschriebene Wörter pro Tag
```

Die Sicherheitsregeln stehen in `firestore.rules`.

## Deployment

Jeder Push auf `main` baut die App und veröffentlicht sie über GitHub Actions auf GitHub Pages.
Alternativ geht es mit Firebase Hosting: `npx firebase-tools deploy`.
