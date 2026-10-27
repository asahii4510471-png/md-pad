import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : path;
  }))).flat();
}

const files = (await filesIn('dist')).filter((file) => /\.(js|css|html)$/.test(file));
let total = 0;
for (const file of files) {
  const bytes = gzipSync(await readFile(file)).byteLength;
  total += bytes;
  console.log(`${file}: ${(bytes / 1000).toFixed(2)} KB gzip`);
}
console.log(`Total: ${(total / 1000).toFixed(2)} KB gzip (limit: <150 KB)`);
if (total >= 150_000) process.exitCode = 1;
