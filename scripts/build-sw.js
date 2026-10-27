import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function buildServiceWorker(directory = 'dist', base = '/md-pad/') {
  async function walk(path) {
    const entries = await readdir(path, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const next = join(path, entry.name);
      return entry.isDirectory() ? walk(next) : next;
    }))).flat();
  }
  // The worker is generated last; every other built file is included.
  const files = (await walk(directory)).filter((file) => relative(directory, file) !== 'sw.js').sort();
  const hash = createHash('sha256');
  hash.update(await readFile(new URL(import.meta.url)));
  for (const file of files) hash.update(relative(directory, file)).update(await readFile(file));
  const version = hash.digest('hex').slice(0, 16);
  const precache = files.map((file) => base + relative(directory, file).split('\\').join('/'));
  precache.push(base + 'sw.js');
  const worker = `const CACHE = 'md-pad-${version}';
const BASE = ${JSON.stringify(base)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('md-pad-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match(BASE + 'index.html');
    return fetch(event.request);
  })());
});
`;
  await writeFile(join(directory, 'sw.js'), worker);
  console.log(`Service Worker: ${precache.length} precached files (${version})`);
  return precache;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildServiceWorker();
}
