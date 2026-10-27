# md-pad

PCとスマホで使える、軽量なMarkdownリーダー / エディタです。Vite + vanilla JavaScriptで構成した静的PWAで、バックエンドはありません。

## 機能

- CommonMarkをベースに、GFMの表・タスクリスト・コードブロック・取り消し線を表示。
- 768px以上は編集と表示を左右に配置。768px未満は「編集」「プレビュー」ボタンで切り替え。
- `<textarea>` に入力し、500ms入力が止まるとIndexedDBへ自動保存。ノートの新規作成・選択・削除に対応。
- 初回は空のノートから開始。ノート名は本文の最初の空でない行から作成。切替・新規作成の前にも現在の内容を保存。
- `.md` を開くと新しいノートとして取り込み。保存は編集中のノートを `.md` に書き出し。
- WindowsのChrome / Edgeにインストールすると、`.md` の「プログラムから開く」や既定のアプリに登録可能。
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

`size` のKBは1,000バイト単位です。Service WorkerもJSに含みます。アイコン・manifestを含む全配信ファイルのgzip合計も併記し、こちらも150 KB未満を確認します。HTTPヘッダーは含みません。初期実装の測定値はJS・CSS・HTMLが **59.14 KB**、全配信ファイルが **63.80 KB** です。

実行時依存は `markdown-it`、`dompurify`、`markdown-it-task-lists` の3つだけです。開発依存は `vite`、`vitest`、`jsdom`、`fake-indexeddb` です。

## 描画と安全性

MarkdownからHTMLを作る処理は `src/render.js` の `render()` にまとめています。`markdown-it` は `html: false` とし、結果を必ずDOMPurifyに通してからプレビューの `innerHTML` に設定します。

本文中の生HTMLは表示から除去します。コードブロック・インラインコード内のHTML例は文字として保持します。URLはMarkdownとして解析した後、DOMPurifyが危険なリンク先を除去します。XSSテストでは `<img src=x onerror=alert(1)>` と `[x](javascript:alert(1))` の描画結果に、それぞれ `onerror` と `javascript:` が残らないこと、および実行可能なDOM属性を作らないことを確認します。

保存処理は `src/store.js`、ファイル操作は `src/files.js` に分離しています。IndexedDBへの書き込みは直列に実行し、古い保存で新しい編集を上書きしないようにしています。

## インストール

公開済みのHTTPSサイトで操作します。ローカルの `localhost` / `127.0.0.1` もPWA確認に使えます。初回はオンラインで開き、Service Workerのインストールが完了してからオフラインで使ってください。

### PC: Chrome / Edge

1. md-padを開く。
2. アドレスバーのインストールボタンを押す。表示されない場合は、ブラウザメニューの「アプリをインストール」などを選ぶ。
3. インストールすると、独立したウィンドウで起動できます。

### Windowsで .md の既定のアプリにする

1. Windowsの最新版ChromeまたはEdgeで [md-pad](https://asahii4510471-png.github.io/md-pad/) を開き、PWAとしてインストールする。
2. エクスプローラーで `.md` を右クリック →「プログラムから開く」→「別のプログラムを選択」→ md-padを選び、「常に使う」を選択する。初回にブラウザがファイルを開く許可を求めたら許可する。
3. またはWindowsの「設定 → アプリ → 既定のアプリ」で `.md` を検索し、md-padを選択する。
4. 別の `.md` をダブルクリックして、内容が表示されることを確認する。

すでにインストール済みの場合、オンラインでmd-padを開き、更新後にすべてのmd-padウィンドウ・タブを閉じて開き直してください。ブラウザによるmanifest更新には時間がかかる場合があります。候補に出ない場合は、ファイルを開く権限をブラウザのアプリ設定で確認し、必要ならPWAを再インストールします。再インストールの際はサイトデータを削除しないでください。残したいノートは事前に書き出してください。

OSから渡された `.md` は新しいノートとして取り込みます。起動中のアプリがある場合は再利用し、編集中の内容をIndexedDBへ保存してから開きます。複数ファイル・連続起動も順に処理します。編集後の自動保存先はIndexedDBで、元ファイルを自動で上書きしません。元ファイルに反映する場合は「書き出す」で保存先を選びます。

この関連付けはFile Handling API対応のデスクトップブラウザ向けです。未対応ブラウザやiPhoneでは、従来の「開く」を使えます。WebページからWindowsの既定アプリを自動変更することはできないため、選択はWindows側で行います。Windows実機での登録・許可ダイアログ・ダブルクリック起動は未確認です。

参照: [Microsoft Edgeのファイルハンドラー](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/handle-files)、[Windowsの既定アプリの変更](https://support.microsoft.com/en-us/windows/apps/change-default-apps-in-windows)。

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
