import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNote, updateNote, listNotes, deleteNote } from './store.js';

beforeEach(async () => {
  for (const note of await listNotes()) await deleteNote(note.id);
});

describe('IndexedDB notes', () => {
  it('creates, updates, lists and deletes multiple persistent notes', async () => {
    const first = await createNote('# First\nbody');
    const second = await createNote('# Second');
    expect(first.id).not.toBe(second.id);
    expect(await listNotes()).toHaveLength(2);
    await updateNote(first.id, '# Changed\nupdated content');
    expect((await listNotes()).find((note) => note.id === first.id)).toMatchObject({
      content: '# Changed\nupdated content', title: 'Changed',
    });
    await deleteNote(first.id);
    expect((await listNotes()).map((note) => note.id)).toEqual([second.id]);
  });
  it('does not resurrect a deleted note on a delayed update', async () => {
    const note = await createNote();
    expect(note.title).toBe('無題のノート');
    await deleteNote(note.id);
    await expect(updateNote(note.id, 'late')).rejects.toThrow();
    expect(await listNotes()).toEqual([]);
  });
});
