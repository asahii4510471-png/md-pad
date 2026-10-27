import './style.css';
import { openMarkdown, saveMarkdown, registerFileHandler } from './files.js';
import { render } from './render.js';
import { createNote, updateNote, listNotes, deleteNote } from './store.js';

document.querySelector('#app').innerHTML = `
  <header class="toolbar">
    <a class="brand" href="./" aria-label="md-pad ホーム">md-pad</a>
    <div class="file-actions">
      <button id="open-file" type="button" aria-label="Markdownファイルを開く">開く</button>
      <button id="save-file" type="button" aria-label="Markdownファイルを書き出す">書き出す</button>
    </div>
  </header>
  <main>
    <section class="notes-bar" aria-label="ノートの管理">
      <label class="visually-hidden" for="notes">ノート</label>
      <select id="notes" aria-label="ノートを選択"></select>
      <button id="new-note" type="button"><span aria-hidden="true">＋</span> 新規</button>
      <button id="delete-note" type="button">削除</button>
      <span id="status" role="status" aria-live="polite">読込中</span>
    </section>
    <div class="mobile-tabs" role="group" aria-label="表示する画面">
      <button type="button" data-view="edit" aria-pressed="true">編集</button>
      <button type="button" data-view="preview" aria-pressed="false">プレビュー</button>
    </div>
    <div class="workspace" data-view="edit">
      <section class="pane editor-pane" aria-labelledby="editor-label">
        <h1 id="editor-label" class="pane-heading">編集</h1>
        <textarea id="editor" aria-label="Markdownを編集" spellcheck="false" placeholder="本文"></textarea>
      </section>
      <section class="pane preview-pane" aria-labelledby="preview-label">
        <h2 id="preview-label" class="pane-heading">プレビュー</h2>
        <article id="preview" class="markdown-body"></article>
      </section>
    </div>
  </main>
`;

const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');

function updatePreview() {
  preview.innerHTML = render(editor.value);
}
editor.addEventListener('input', updatePreview);
updatePreview();

for (const button of document.querySelectorAll('button[data-view]')) {
  button.addEventListener('click', () => {
    document.querySelector('.workspace').dataset.view = button.dataset.view;
    for (const tab of document.querySelectorAll('button[data-view]')) {
      tab.setAttribute('aria-pressed', String(tab === button));
    }
  });
}

const notesSelect = document.querySelector('#notes');
const status = document.querySelector('#status');
const noteControls = ['#notes', '#new-note', '#delete-note'].map((selector) => document.querySelector(selector));
let currentNote = null;
let saveTimer;
let pendingSave = Promise.resolve();
let revision = 0;
let savedRevision = 0;
let pendingAction = Promise.resolve();

function report(error) {
  console.error(error);
  status.textContent = '保存・操作に失敗しました。.md を保存して内容を保護し、再試行してください。';
}

async function refreshNotes() {
  const notes = await listNotes();
  notesSelect.replaceChildren(...notes.map((note) => {
    const option = document.createElement('option');
    option.value = note.id;
    option.textContent = note.title;
    return option;
  }));
  if (currentNote) notesSelect.value = currentNote.id;
  return notes;
}

function loadNote(note) {
  currentNote = note;
  editor.value = note.content;
  revision = savedRevision = 0;
  notesSelect.value = note.id;
  updatePreview();
  status.textContent = '保存済み';
}

function saveCurrent() {
  clearTimeout(saveTimer);
  if (!currentNote || revision === savedRevision) return pendingSave;
  const id = currentNote.id;
  const content = editor.value;
  const savingRevision = revision;
  // Serialize writes so an older transaction cannot overwrite a newer edit.
  pendingSave = pendingSave.catch(() => {}).then(async () => {
    const note = await updateNote(id, content);
    if (currentNote?.id === id) {
      currentNote = note;
      savedRevision = savingRevision;
      if (revision === savingRevision) status.textContent = '保存済み';
      await refreshNotes();
    }
  });
  return pendingSave;
}

function noteAction(action) {
  // File launches and toolbar operations share one queue to preserve edits.
  pendingAction = pendingAction.then(async () => {
    noteControls.forEach((control) => { control.disabled = true; });
    editor.readOnly = true;
    try {
      await saveCurrent();
      await action();
    } catch (error) {
      if (currentNote) notesSelect.value = currentNote.id;
      report(error);
    } finally {
      editor.readOnly = false;
      noteControls.forEach((control) => { control.disabled = !currentNote; });
    }
  });
  return pendingAction;
}

function importMarkdown(file) {
  return noteAction(async () => {
    loadNote(await createNote(file.content));
    await refreshNotes();
  });
}

editor.addEventListener('input', () => {
  if (!currentNote) return;
  revision += 1;
  status.textContent = '未保存…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveCurrent().catch(report); }, 500);
});

notesSelect.addEventListener('change', () => {
  const selectedId = notesSelect.value;
  noteAction(async () => {
    const notes = await listNotes();
    const selected = notes.find((note) => note.id === selectedId);
    if (!selected) throw new Error('ノートが見つかりません。');
    loadNote(selected);
  });
});

document.querySelector('#new-note').addEventListener('click', () => {
  noteAction(async () => {
    loadNote(await createNote());
    await refreshNotes();
    editor.focus();
  });
});

document.querySelector('#delete-note').addEventListener('click', () => {
  if (!currentNote || !confirm(`「${currentNote.title}」を削除しますか？この操作は取り消せません。`)) return;
  noteAction(async () => {
    await deleteNote(currentNote.id);
    currentNote = null;
    const notes = await refreshNotes();
    loadNote(notes[0] || await createNote());
    await refreshNotes();
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveCurrent().catch(report);
});
window.addEventListener('beforeunload', (event) => {
  if (revision !== savedRevision) {
    event.preventDefault();
    event.returnValue = '';
  }
});

noteControls.forEach((control) => { control.disabled = true; });
editor.readOnly = true;
try {
  const notes = await listNotes();
  loadNote(notes[0] || await createNote(editor.value));
  await refreshNotes();
  noteControls.forEach((control) => { control.disabled = false; });
} catch (error) {
  report(error);
} finally {
  editor.readOnly = false;
}

// Launches wait in the browser until IndexedDB and the editor are ready.
registerFileHandler(importMarkdown, (error) => {
  console.error(error);
  status.textContent = 'ファイルを開けませんでした。権限と拡張子を確認してください。';
});

document.querySelector('#open-file').addEventListener('click', async () => {
  try {
    // Invoke the picker during the click's user activation.
    const file = await openMarkdown();
    if (!file) return;
    await importMarkdown(file);
  } catch (error) {
    report(error);
  }
});

document.querySelector('#save-file').addEventListener('click', async () => {
  try {
    const title = editor.value.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim();
    if (await saveMarkdown(editor.value, title)) status.textContent = '書き出し済み';
  } catch (error) {
    report(error);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((error) => {
      console.error(error);
      status.textContent = 'オフライン準備に失敗しました。接続を確認して再読み込みしてください。';
    });
  };
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
}
