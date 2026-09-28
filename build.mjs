import { mkdir, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('.', import.meta.url);
const out = new URL('./dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'SETUP.md']) {
  await copyFile(new URL(file, root), new URL(file, out));
}
