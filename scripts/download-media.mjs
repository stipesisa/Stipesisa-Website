// Lädt alle generierten Bilder und Videos nach public/, damit die App ohne CDN läuft.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MEDIA } from '../src/media.js';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

for (const [localPath, url] of Object.entries(MEDIA)) {
  const target = path.join(PUBLIC_DIR, localPath);
  try {
    await fs.access(target);
    console.log(`✓ ${localPath} (schon vorhanden)`);
    continue;
  } catch {}
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${localPath}: HTTP ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(await res.arrayBuffer()));
  console.log(`↓ ${localPath}`);
}
