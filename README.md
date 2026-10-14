# StipezCutz Rewards

Punkte- und Prämien-Webapp für das StipezCutz Haarstudio.

- **Login nur mit Benutzername + Passwort** (keine E-Mail). Neue Kunden bekommen 25 Willkommenspunkte.
- **Punkte sammeln:** Das Studio bucht Punkte im Bereich *Studio* (Schnellbuttons: Haarschnitt +100, Bart +50 …).
- **Instagram:** Ein Button öffnet [@stipezcutz](https://www.instagram.com/stipezcutz/). Kunden melden ihren Story-Repost in der App; nach Bestätigung im Studio gibt es +50 Punkte (max. einmal pro Tag).
- **Prämien einlösen:** Produkte (L3VEL3 Clay, Powder, Salt Spray) und Services (Bart, Haarschnitt, VIP). Beim Einlösen entsteht ein Code (z. B. `SK-7F3K2Q`), den der Kunde im Studio vorzeigt. Das Studio markiert ihn als ausgegeben oder storniert (Punkte werden erstattet).
- **Rangsystem:** 6 Ränge – Rookie, Silver, Gold, Elite, Diamond, Legend – nach insgesamt gesammelten Punkten, plus Top-10-Rangliste.
- **Medien:** Produkt-, Studio- und Prämienbilder mit GPT Image 2, Produkt- und Hero-Videos mit Seedance 2.0 (Higgsfield).

## Starten

Benötigt Node.js 22.13 oder neuer (nutzt die eingebaute SQLite-Datenbank).

```bash
npm install
ADMIN_USERNAME=stipe ADMIN_PASSWORD='ein-sicheres-passwort' npm start
# → http://localhost:3000
```

Beim ersten Start wird das Admin-Konto angelegt. Ohne `ADMIN_PASSWORD` wird ein zufälliges Passwort erzeugt und in der Konsole ausgegeben.

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `PORT` | Port des Servers | `3000` |
| `DB_FILE` | Pfad zur SQLite-Datei | `data/stipezcutz.db` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Erstes Admin-Konto | `admin` / zufällig |
| `COOKIE_SECURE` | `1` setzen, sobald die Seite über HTTPS läuft | aus |

Tests: `npm test`

## Bilder und Videos

Die generierten Medien liegen auf der Higgsfield-CDN (`src/media.js`). Der Server leitet `/img/...` und `/video/...` dorthin um, solange keine lokale Kopie existiert. Um sie dauerhaft selbst zu hosten:

```bash
npm run media:download
```

Danach liegen alle Dateien in `public/` und werden direkt ausgeliefert.

## Anpassen

- Punkte, Ränge, Schnellbuttons, Instagram-Link: `src/config.js`
- Prämien und Punktepreise: im Studio-Bereich der App (oder Startwerte in `src/config.js`)
- Rang-Abzeichen: `public/img/ranks/`

## Hosting

Jeder Node-Host mit dauerhaftem Speicher funktioniert (z. B. Render, Railway, Fly.io oder ein eigener VPS). Wichtig: `DB_FILE` muss auf ein persistentes Volume zeigen, sonst gehen Konten bei einem Neustart verloren. Hinter HTTPS `COOKIE_SECURE=1` setzen.
