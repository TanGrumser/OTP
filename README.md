# One-Time Pad Verschlüsselungs-Demo

Eine interaktive Webanwendung zur Demonstration des One-Time Pad Verschlüsselungsverfahrens.

## Beschreibung

Diese Anwendung demonstriert das Prinzip der One-Time Pad Verschlüsselung auf eine visuelle und interaktive Weise. Die Schüler können:

- Ein verschlüsseltes Bild sehen
- Eine Maske (One-Time Pad) über das Bild bewegen
- Die Maske in die richtige Position bringen, um das Originalbild zu entschlüsseln
- Hilfestellungen erhalten, wenn sie sich der Lösung nähern

## Technische Details

- Die Anwendung verwendet HTML5 Canvas für die Bildverarbeitung
- Die Pixel sind größer als die Bildschirmpixel für bessere Sichtbarkeit
- Die Maske ist größer als das Bild, um die Suche nach der richtigen Position zu erschweren
- Die Bewegung der Maske ist an ein Pixelraster gebunden
- Ein fester Seed wird verwendet, damit die Demo immer gleich ist

## Installation

1. Laden Sie die Dateien herunter
2. Öffnen Sie die `index.html` in einem modernen Webbrowser

## Verwendung

1. Bewegen Sie die Maske mit der Maus über das verschlüsselte Bild
2. Folgen Sie den Tipps, um die richtige Position zu finden
3. Wenn die Maske korrekt positioniert ist, wird das Originalbild sichtbar
4. Nutzen Sie den "Zurücksetzen"-Button, um von vorne zu beginnen

## Anforderungen

- Ein moderner Webbrowser mit JavaScript-Unterstützung
- Keine zusätzlichen Abhängigkeiten erforderlich 