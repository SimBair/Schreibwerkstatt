# ✒️ Schreibwerkstatt

Eine Schreib-App im Stil von Reedsy und Scrivener. Sie läuft als installierbare
Web-App (PWA) auf iPad und PC, funktioniert offline und synchronisiert über Firebase.

## Funktionen (Stand Etappe 1+2)

- Anmeldung mit Google; jede Person sieht nur ihre eigenen Daten
- Projektübersicht: anlegen, umbenennen, löschen
- **Binder** mit Ordnern und Szenen: Drag & Drop, ⋯-Menü (verschieben, ein-/ausrücken), Papierkorb
- **Editor** (TipTap): Formatierung, Überschriften, Szenentrenner, deutsche Anführungszeichen „…“, automatisches Speichern
- **Pinnwand**: Ordner zeigen ihre Einträge als Karteikarten mit Synopsis
- **Synopsis** je Szene
- Wortzählung pro Szene, pro Sitzung und für das Manuskript, dazu ein Projekt-Wortziel
- **Fokus-Modus** (◎, beenden mit Esc)
- **Offline-Betrieb**: Änderungen werden lokal gespeichert und später synchronisiert (Statusanzeige oben rechts)

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
users/{uid}/projects/{projectId}/contents/{nodeId}  Textinhalt (HTML)
```

Die Sicherheitsregeln stehen in `firestore.rules`.

## Deployment

Jeder Push auf `main` baut die App und veröffentlicht sie über GitHub Actions auf GitHub Pages.
Alternativ geht es mit Firebase Hosting: `npx firebase-tools deploy`.
