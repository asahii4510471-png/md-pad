import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { listNotes, deleteNote } from './store.js';

afterEach(() => { vi.unstubAllGlobals(); });

it('opens a cold-start file and preserves edits across toolbar actions and later OS launches', async () => {
  for (const note of await listNotes()) await deleteNote(note.id);
  document.body.innerHTML = '<div id="app"></div>';
  const handle = (name, content) => ({ getFile: async () => ({ name, text: async () => content }) });
  let launch;
  let startup;
  vi.stubGlobal('launchQueue', {
    setConsumer(consumer) {
      launch = consumer;
      // A real browser queues the initial launch until the consumer is set.
      startup = consumer({ files: [handle('startup.md', '# Startup')] });
    },
  });
  await import('./main.js');
  await startup;
  const editor = document.querySelector('#editor');
  const notes = document.querySelector('#notes');
  expect(editor.value).toBe('# Startup');
  expect(document.querySelector('#preview h1').textContent).toBe('Startup');
  const draftId = notes.value;
  editor.value = '# Pending draft';
  editor.dispatchEvent(new Event('input'));
  document.querySelector('#new-note').click();
  const second = launch({ files: [handle('second.md', '# Second')] });
  const third = launch({ files: [handle('third.md', '# Third')] });
  await Promise.all([second, third]);
  const stored = await listNotes();
  expect(stored.find((note) => note.id === draftId).content).toBe('# Pending draft');
  expect(stored.some((note) => note.content === '# Second')).toBe(true);
  expect(stored.some((note) => note.content === '# Third')).toBe(true);
  expect(editor.value).toBe('# Third');
  expect(document.querySelector('#preview h1').textContent).toBe('Third');
  expect(editor.readOnly).toBe(false);
  expect(notes.disabled).toBe(false);
});
