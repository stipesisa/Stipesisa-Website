// Mit GPT Image 2 und Seedance 2.0 (Higgsfield) erzeugte Medien.
// Der Server liefert die lokale Datei aus public/, sobald sie dort liegt
// (`npm run media:download`). Fehlt sie, leitet er auf die Higgsfield-CDN um.

export const MEDIA_CDN = 'https://d8j0ntlcm91z4.cloudfront.net';
const BASE = `${MEDIA_CDN}/user_3KgGyIE2aRTQ2gaEdIiukINwFE0`;

export const MEDIA = {
  '/img/hero.png': `${BASE}/hf_20261014_112927_c36c421c-414f-4e61-8c3e-2c29fd98da05.png`,
  '/img/products/sculpting-clay.png': `${BASE}/hf_20261014_112926_5514fafe-a541-4973-b1ea-3c560e84d0f9.png`,
  '/img/products/styling-powder.png': `${BASE}/hf_20261014_112928_52b9db27-4407-4791-9f79-0bc7a25979db.png`,
  '/img/products/salt-spray.png': `${BASE}/hf_20261014_112927_93e04af4-c886-4ad3-92af-5af2c546cc83.png`,
  '/img/rewards/haircut.png': `${BASE}/hf_20261014_112927_6c2c1943-77a1-4333-b6c7-9c2a73ff1c49.png`,
  '/img/rewards/beard.png': `${BASE}/hf_20261014_112927_46f5fd6a-8864-433a-81d5-6148aae88d0a.png`,
  '/img/rewards/vip.png': `${BASE}/hf_20261014_112926_2f5250dc-5431-4b2e-9777-a65a7fa72add.png`,
  '/video/hero.mp4': `${BASE}/hf_20261014_113226_91216230-872d-4d92-b978-81ee406caf85.mp4`,
  '/video/sculpting-clay.mp4': `${BASE}/hf_20261014_113231_5db10b32-eaf6-4c29-a417-0e1d53916edc.mp4`,
  '/video/styling-powder.mp4': `${BASE}/hf_20261014_113225_82aeebc8-0535-491e-aff5-b939efbb0e5b.mp4`,
  '/video/salt-spray.mp4': `${BASE}/hf_20261014_113225_d4727e52-cee4-4a5b-b242-b354097cc210.mp4`,
};
