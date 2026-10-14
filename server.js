import path from 'node:path';
import { openDatabase } from './src/db.js';
import { createApp, ensureAdmin } from './src/app.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(import.meta.dirname, 'data', 'stipezcutz.db');

const db = openDatabase(DB_FILE);

const admin = ensureAdmin(db, {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD,
});
if (admin?.generated) {
  console.log(`\nAdmin-Konto angelegt: ${admin.username} / ${admin.password}`);
  console.log('Bitte nach dem ersten Login das Passwort im Profil ändern.\n');
} else if (admin) {
  console.log(`Admin-Konto angelegt: ${admin.username}`);
}

const app = createApp({ db, secureCookies: process.env.COOKIE_SECURE === '1' });
app.listen(PORT, () => console.log(`StipezCutz Rewards läuft auf http://localhost:${PORT}`));
