/**
 * Copia las fuentes de Excalidraw a `public/excalidraw/fonts` para servirlas desde la propia app
 * (sin CDN; ver `src/modules/whiteboard/assetPath.js`). No se suben al repo (14 MB): corre solo
 * después de `npm install` y antes de `dev` y `build`, así siguen a la versión instalada.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const to = resolve(root, 'public/excalidraw/fonts');

if (!existsSync(from)) {
  console.warn('[excalidraw] no están las fuentes del paquete; ¿falta npm install?');
  process.exit(0);
}
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log('[excalidraw] fuentes copiadas a public/excalidraw/fonts');
