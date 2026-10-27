import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { listNotes, deleteNote } from './store.js';

it('initializes the app, debounces saves, flushes before switching, and manages notes', async () => {
  for (const note of await listNotes()) await deleteNote(note.id);
  document.body.innerHTML = '<div id="app"></div>';
  await import('./main.js');
  const editor = document.querySelector('#editor');
  const select = document.querySelector('#notes');
  const originalId = select.value;
  expect(select.options).toHaveLength(1);
  expect(editor.value).toBe('');
  expect(document.querySelector('#new-note').disabled).toBe(false);
  editor.value = '# Debounced';
  editor.dispatchEvent(new Event('input'));
  expect(document.querySelector('#status').textContent).toBe('未保存…');
  expect((await listNotes())[0].content).not.toBe('# Debounced');
  await vi.waitFor(async () => {
    expect((await listNotes())[0].content).toBe('# Debounced');
  }, { timeout: 2000 });
  editor.value = '# Flushed on switch';
  editor.dispatchEvent(new Event('input'));
  document.querySelector('#new-note').click();
  await vi.waitFor(() => {
    expect(select.options).toHaveLength(2);
    expect(editor.value).toBe('');
    expect(document.querySelector('#new-note').disabled).toBe(false);
  });
  expect((await listNotes()).find((note) => note.id === originalId).content).toBe('# Flushed on switch');
  select.value = originalId;
  select.dispatchEvent(new Event('change'));
  await vi.waitFor(() => {
    expect(editor.value).toBe('# Flushed on switch');
    expect(document.querySelector('#new-note').disabled).toBe(false);
  });
  document.querySelector('button[data-view="preview"]').click();
  expect(document.querySelector('.workspace').dataset.view).toBe('preview');
  expect(document.querySelector('button[data-view="preview"]').getAttribute('aria-pressed')).toBe('true');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  document.querySelector('#delete-note').click();
  await vi.waitFor(() => {
    expect(select.options).toHaveLength(1);
    expect(editor.value).toBe('');
  });
});
