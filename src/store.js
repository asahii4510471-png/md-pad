const DATABASE = 'md-pad';
const NOTES = 'notes';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(NOTES, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('他のタブを閉じて再試行してください。'));
  });
}

async function transaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(NOTES, mode);
    let result;
    try {
      result = operation(tx.objectStore(NOTES));
    } catch (error) {
      tx.abort();
      database.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      database.close();
      resolve(result());
    };
    tx.onabort = tx.onerror = () => {
      database.close();
      reject(tx.error || new Error('ノートを保存できませんでした。'));
    };
  });
}

function titleOf(content) {
  return content.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim().slice(0, 80) || '無題のノート';
}

export function createNote(content = '') {
  const note = { id: crypto.randomUUID(), content, title: titleOf(content), updatedAt: Date.now() };
  return transaction('readwrite', (store) => {
    store.add(note);
    return () => note;
  });
}

export function updateNote(id, content) {
  return transaction('readwrite', (store) => {
    const request = store.get(id);
    let updated;
    request.onsuccess = () => {
      if (!request.result) {
        request.transaction.abort();
        return;
      }
      updated = { ...request.result, content, title: titleOf(content), updatedAt: Date.now() };
      store.put(updated);
    };
    return () => updated;
  });
}

export function listNotes() {
  return transaction('readonly', (store) => {
    const request = store.getAll();
    return () => request.result.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  });
}

export function deleteNote(id) {
  return transaction('readwrite', (store) => {
    store.delete(id);
    return () => undefined;
  });
}
