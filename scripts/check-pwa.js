import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, '/md-pad/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.file_handlers.length, 1);
assert.equal(manifest.file_handlers[0].action, manifest.start_url);
assert.deepEqual(manifest.file_handlers[0].accept, { 'text/markdown': ['.md'] });
assert.equal(manifest.file_handlers[0].launch_type, 'single-client');
assert.equal(manifest.launch_handler.client_mode, 'focus-existing');
assert(manifest.icons.some((icon) => icon.purpose === 'maskable'));
const worker = await readFile('dist/sw.js', 'utf8');
const precache = JSON.parse(worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
assert(precache.includes('/md-pad/index.html'));
assert(precache.includes('/md-pad/sw.js'));
assert(precache.includes('/md-pad/manifest.webmanifest'));
for (const asset of await readdir('dist/assets')) {
  assert(precache.includes(`/md-pad/assets/${asset}`), `Missing precache asset: ${asset}`);
}
assert(precache.some((file) => file.endsWith('.js')));
assert(precache.some((file) => file.endsWith('.css')));
for (const icon of manifest.icons) {
  assert(precache.includes(icon.src));
  const data = await readFile('dist/' + icon.src.replace('/md-pad/', ''));
  const [width, height] = icon.sizes.split('x').map(Number);
  assert.equal(data.readUInt32BE(16), width);
  assert.equal(data.readUInt32BE(20), height);
}
console.log('PWA check passed: manifest, .md file handler, icon dimensions, index.html and all JS/CSS are precached.');
