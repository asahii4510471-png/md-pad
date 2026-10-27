import './style.css';
import { render } from './render.js';

document.querySelector('#app').innerHTML = `
  <header class="toolbar">
    <a class="brand" href="./" aria-label="md-pad ホーム"><span class="brand-mark">m↓</span> md-pad</a>
    <span class="tagline">書く、読む。手元に残す。</span>
    <div class="file-actions">
      <button id="open-file" type="button">.md を開く</button>
      <button id="save-file" type="button">.md を保存</button>
    </div>
  </header>
  <main>
    <section class="notes-bar" aria-label="ノートの管理">
      <label for="notes">ノート</label>
      <select id="notes" aria-label="ノートを選択"></select>
      <button id="new-note" type="button">新規</button>
      <button id="delete-note" type="button">削除</button>
      <span id="status" role="status" aria-live="polite">準備完了</span>
    </section>
    <div class="mobile-tabs" role="group" aria-label="表示する画面">
      <button type="button" data-view="edit" aria-pressed="true">編集</button>
      <button type="button" data-view="preview" aria-pressed="false">表示</button>
    </div>
    <div class="workspace" data-view="edit">
      <section class="pane editor-pane" aria-labelledby="editor-label">
        <h1 id="editor-label" class="pane-heading">編集 <span>MARKDOWN</span></h1>
        <textarea id="editor" aria-label="Markdownを編集" spellcheck="false" placeholder="ここから書きはじめる…"></textarea>
      </section>
      <section class="pane preview-pane" aria-labelledby="preview-label">
        <h2 id="preview-label" class="pane-heading">表示 <span>PREVIEW</span></h2>
        <article id="preview" class="markdown-body"></article>
      </section>
    </div>
  </main>
  <footer>md-pad <span>Markdown for your everyday notes.</span></footer>
`;

const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');
editor.value = '# はじめのノート\n\n思いついたことを、Markdownで。\n\n- [ ] メモを書く\n- [x] md-padを開く\n\n| できること | 書き方 |\n| --- | --- |\n| 太字 | **大切なこと** |\n| 取り消し線 | ~~書き直す~~ |\n\n```js\nconsole.log("Hello, md-pad!");\n```\n';
function updatePreview() {
  preview.innerHTML = render(editor.value);
}
editor.addEventListener('input', updatePreview);
updatePreview();

for (const button of document.querySelectorAll('[data-view]button')) {
  button.addEventListener('click', () => {
    document.querySelector('.workspace').dataset.view = button.dataset.view;
    for (const tab of document.querySelectorAll('[data-view]button')) {
      tab.setAttribute('aria-pressed', String(tab === button));
    }
  });
}
