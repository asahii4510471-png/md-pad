# md-pad

PCとスマホで使える、軽量なMarkdownリーダー / エディタです。Vite + vanilla JavaScriptで構成した静的PWAで、バックエンドはありません。

## 機能

- CommonMarkをベースに、GFMの表・タスクリスト・コードブロック・取り消し線を表示。
- 768px以上は編集と表示を左右に配置。768px未満は「編集」「表示」ボタンで切り替え。
- `<textarea>` に入力し、500ms入力が止まるとIndexedDBへ自動保存。ノートの新規作成・選択・削除に対応。
- ノート名は本文の最初の空でない行から作成。切替・新規作成の前にも現在の内容を保存。
- `.md` を開くと新しいノートとして取り込み。保存は編集中のノートを `.md` に書き出し。
- File System Access API対応時はOSのファイルピッカーを使用。非対応時はファイル入力とダウンロードを使用。
- OSの `prefers-color-scheme` に合わせたダークモード。
- インストール可能なPWA。オンラインで初回読み込み後、オフラインでも起動・編集・保存が可能。

ノートは同じブラウザ・同じオリジンのIndexedDBに保存します。ログイン・同期・アクセス解析・外部API・CDNは使いません。ブラウザのサイトデータを消すとノートも消えるため、残したいノートは `.md` で書き出してください。ファイルの上書き保存は毎回保存先を選びます。

## 開発

Node.js LTS（推奨: 24、最低: 22.12）とnpmを使用します。

```sh
npm ci
npm run dev
```

開発サーバーで表示されたURLの `/md-pad/` を開きます。

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（Service Workerは登録しない） |
| `npm run build` | `dist/` にビルドし、Service Worker生成とPWA構成チェックを実行 |
| `npm run preview` | `dist/` をローカル配信。PWA確認用の `/md-pad/` を開く |
| `npm test` | Vitestを一度実行。Markdown、XSS、IndexedDB、ファイルAPI、画面操作を検証 |
| `npm run size` | ビルド済みJS・CSS・HTMLを個別にgzipし合計KBを表示。150 KB以上で失敗 |
| `node scripts/generate-icons.js` | 同梱の180 / 192 / 512px PNGアイコンを再生成 |

`size` のKBは1,000バイト単位です。Service WorkerもJSに含みます。アイコン・manifestを含む全配信ファイルのgzip合計も併記し、こちらも150 KB未満を確認します。HTTPヘッダーは含みません。初期実装の測定値はJS・CSS・HTMLが **59.05 KB**、全配信ファイルが **63.72 KB** です。

実行時依存は `markdown-it`、`dompurify`、`markdown-it-task-lists` の3つだけです。開発依存は `vite`、`vitest`、`jsdom`、`fake-indexeddb` です。

## 描画と安全性

MarkdownからHTMLを作る処理は `src/render.js` の `render()` にまとめています。`markdown-it` は `html: false` とし、結果を必ずDOMPurifyに通してからプレビューの `innerHTML` に設定します。

生のHTMLは実行せず文字として表示します。たとえば `<img src=x onerror=alert(1)>` は画像要素にならず、`[x](javascript:alert(1))` はリンクになりません。これらの文字列は無害な本文・コード例として残る場合があります。XSSテストでは実際のDOMに `onerror` 属性や `javascript:` URL属性が存在しないことを確認します。

保存処理は `src/store.js`、ファイル操作は `src/files.js` に分離しています。IndexedDBへの書き込みは直列に実行し、古い保存で新しい編集を上書きしないようにしています。

## インストール

公開済みのHTTPSサイトで操作します。ローカルの `localhost` / `127.0.0.1` もPWA確認に使えます。初回はオンラインで開き、Service Workerのインストールが完了してからオフラインで使ってください。

### PC: Chrome / Edge

1. md-padを開く。
2. アドレスバーのインストールボタンを押す。表示されない場合は、ブラウザメニューの「アプリをインストール」などを選ぶ。
3. インストールすると、独立したウィンドウで起動できます。

### iPhone: Safari

1. Safariでmd-padを開く。
2. 共有ボタンを押す。
3. 「ホーム画面に追加」を選び、「追加」を押す。
4. ホーム画面のmd-padアイコンから開く。

`apple-touch-icon`、`apple-mobile-web-app-capable`、`viewport` を設定済みです。実機でのインストールとiPhone上の表示・ファイル操作は未確認です。

## オフライン動作の確認

```sh
npm run build
npm run preview
```

1. 表示されたURLの `/md-pad/` をChromeで開く。
2. DevTools → Application → Service Workersで `sw.js` が `activated` になっていることを確認。
3. ノートを編集して「保存済み」を確認。
4. DevToolsのNetworkをOfflineにして再読み込みし、アプリと保存した内容が開くことを確認。

ビルド時に、HTML・JS・CSS・manifest・すべてのアイコン・Service Worker自体を含む全配信ファイルをプリキャッシュします。キャッシュ名はビルド内容から生成し、Service Workerが更新されると古いmd-padキャッシュを削除します。IndexedDBのノートはこの削除の対象外です。

Chromiumのheadless実行で、Service Workerの有効化・オフライン再読み込み・ノート復元、768pxの左右表示、390pxのタブ表示、ダークモード、ノートの作成・選択・削除を確認しています。headlessでの確認は実機インストールの確認を含みません。

## GitHub Pagesでの公開手順（管理者が後で実行）

このPRでは公開設定を変更せず、ワークフローも起動しません。`vite.config.js` の `base`、manifestの `start_url` / `scope`、Service Workerの登録パスは `/md-pad/` です。

1. この変更をレビューし、`main` にマージする前に、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定する。
2. `main` へ変更がpushされると `.github/workflows/deploy.yml` がビルド・テスト・サイズ確認を実行。
3. 公式の `actions/upload-pages-artifact` で `dist/` をアップロードし、`actions/deploy-pages` で公開する。
4. Actionsの完了後に [GitHub Pagesの予定URL](https://asahii4510471-png.github.io/md-pad/) を開く。

初回の公開前には上のURLは利用できない場合があります。環境の承認が必要な設定の場合は、管理者がActions上で承認してください。Secretの追加は不要です。ブランチのpushだけでは公開せず、`main` へのpushだけを公開のトリガーにしています。
