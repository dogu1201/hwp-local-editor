import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const from = path.join(root, 'node_modules', '@rhwp', 'core', 'rhwp_bg.wasm');
const publicDir = path.join(root, 'public');
const to = path.join(publicDir, 'rhwp_bg.wasm');

await mkdir(publicDir, { recursive: true });
await copyFile(from, to);
console.log(`WASM copied: ${to}`);
