const markdownType = { description: 'Markdown', accept: { 'text/markdown': ['.md'] } };

export function supportsFileSystemAccess(operation, scope = window) {
  const method = operation === 'open' ? 'showOpenFilePicker' : 'showSaveFilePicker';
  return typeof scope[method] === 'function';
}

function chooseFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown';
    input.hidden = true;
    function finish(file) {
      input.remove();
      resolve(file);
    }
    input.addEventListener('change', () => finish(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input);
    try {
      input.click();
    } catch (error) {
      input.remove();
      reject(error);
    }
  });
}

export async function openMarkdown() {
  let file;
  try {
    if (supportsFileSystemAccess('open')) {
      const [handle] = await window.showOpenFilePicker({ types: [markdownType], multiple: false });
      file = await handle.getFile();
    } else {
      file = await chooseFile();
    }
    if (!file) return null;
    if (!/\.md$/i.test(file.name)) throw new Error('.md ファイルを選択してください。');
    return { name: file.name, content: await file.text() };
  } catch (error) {
    if (error.name === 'AbortError') return null;
    throw error;
  }
}

export async function saveMarkdown(content, title) {
  const filename = `${(title || 'note').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.md$/i, '').slice(0, 80)}.md`;
  try {
    if (supportsFileSystemAccess('save')) {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [markdownType] });
      const writable = await handle.createWritable();
      try {
        await writable.write(content);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
    } else {
      const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  } catch (error) {
    if (error.name === 'AbortError') return false;
    throw error;
  }
}
