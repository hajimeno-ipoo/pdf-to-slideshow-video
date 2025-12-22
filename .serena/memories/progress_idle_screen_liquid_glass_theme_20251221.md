## 2025-12-21
- 目的: レイアウト大工事は避けつつ、アプリ最初の画面（AppStatus.IDLE / PDFアップロード画面）だけを AppleのLiquid Glass/Glassmorphism寄りの“ガラス素材”見た目に寄せる。

### 方針
- 影響範囲をIDLEに限定（`.screen-idle` スコープ）。他画面（編集/書き出し等）は従来のダーク基調を維持。
- 既存の `index.html` 内「ダーク用パレット上書きCSS」に干渉しないよう、IDLEの必要部分だけ文字色を戻す（`.idle-surface` 配下で限定的に `!important`）。
- ガラス表現は `backdrop-filter`/`-webkit-backdrop-filter` + 半透明白 + 1px相当の縁（inset shadow） + 上側ハイライト（ツヤ） + 弱いドロップシャドウ。
- `@supports` で blur 非対応時は白板フォールバック。

### 実装
- `index.css` を新規作成し、IDLE用の背景（抽象グラデ）とガラス素材クラス（`glass-thin`/`glass`/`glass-strong`）を追加。
- `App.tsx`:
  - `isIdle` を導入し、ルートに IDLE時だけ `screen-idle` を付与。
  - IDLE用の外枠に `idle-surface` を付与。
  - IDLE内のボタン1つを `idle-btn-glass` に置換。
- `components/FileUpload.tsx`:
  - 設定カードなどのダーク指定を外し `glass` を使用。
  - ドロップ枠は `glass-strong`、ドラッグ中は青で強調（`border-blue-500`）。
  - 見出しのホバーは青寄せ。
- `tests/idleGlassTheme.test.js` を追加（存在チェックのスモークテスト）。

### 検証
- `npm test` 実行でPASS（node --test）。

### 変更ファイル
- 追加: `index.css`, `tests/idleGlassTheme.test.js`
- 変更: `App.tsx`, `components/FileUpload.tsx`

### 追記（ProjectManagerModal）
- `components/ProjectManagerModal.tsx`:
  - IDLE時だけモーダルの暗幕/境界線を調整できるよう、`project-manager-overlay` / `project-manager-panel` を付与。
  - パネルに `glass-strong` を付与して、IDLE時はガラス素材で表示。
  - IDLE時の見た目を揃えるため、操作ボタンに `idle-btn-glass` を付与。
- `index.css`:
  - `.screen-idle .project-manager-overlay` で暗幕を弱める。
  - `.screen-idle .project-manager-panel.border-slate-800` で境界線をヘアライン寄せ。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: 文言削除/フッター色）
- `components/ProjectManagerModal.tsx`:
  - ヘッダー補足文「最近のプロジェクトから選んで開けるよ〜」を削除。
  - フッター補足文「クリックで選択 → 「読込」ボタンでも開けるよ。」を削除。
  - フッターの `bg-slate-950/30` を外して、ヘッダーと同じ見え方（ガラス面の上で統一）に。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: ボタン配置移動/見出し削除）
- `components/ProjectManagerModal.tsx`:
  - 「JSONから読込」「更新」をヘッダー右側へ移動（閉じるボタンの左）。
  - 「最近のプロジェクト」見出しを削除。
  - フッターの「新規作成/削除/読込」ボタン群を右寄せに。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: フッター左へ移動/閉じる改善/フィルタ範囲）
- `components/ProjectManagerModal.tsx`:
  - 「JSONから読込」「更新」をフッター左へ移動。
  - 閉じるボタンを見やすく（背景・枠・hover/activeで色変化）。
- `index.html`:
  - `#glass-distortion` の filter 領域を拡張（端の欠け/凹み見え対策）。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: 端の凹み見え対策）
- `index.html`: `#glass-distortion` の歪み強度（scale）を 14 → 8 に弱めた。
- `index.css`: `.screen-idle .project-manager-panel.glass-strong::after` を `inset: -28px` にして、端が欠けて“凹んで見える”のを抑制。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: カード下部の文字）
- `components/ProjectManagerModal.tsx`:
  - プロジェクトカード下部の「更新/容量/ダブルクリック」テキストを白寄せ（`text-white/80` 等）にして視認性UP。
  - フォントサイズを少し小さく（13px/10px/9px）。
- 検証: `npm test` PASS


### 追記（ProjectManagerModal: カード縮小/文言削除）
- `components/ProjectManagerModal.tsx`:
  - 「ダブルクリックで開くよ」を削除。
  - カードを少し小さく（`lg:grid-cols-4` + `gap-2` + `p-2`）。
  - 更新/容量の文字サイズを見やすい方向に調整（11px）。
- 検証: `npm test` PASS


### 追記（ApiKeyModal: IDLEガラス寄せ）
- `components/ApiKeyModal.tsx`:
  - IDLE時だけ調整できるよう、`api-key-overlay` / `api-key-panel` を付与。
  - パネルに `glass-strong` を付与して、IDLE時はガラス素材で表示。
- `index.css`:
  - `.screen-idle .api-key-overlay` で暗幕を弱め＋軽いblur。
  - `.screen-idle .api-key-panel.border-slate-800` で境界線をヘアライン寄せ。
  - `.screen-idle .api-key-panel.glass-strong::after` を `inset:-28px` にして端の欠けを抑制。
- 検証: `npm test` PASS


### 追記（ApiKeyModal: 中身の配色/閉じるボタン）
- `components/ApiKeyModal.tsx`:
  - 閉じるボタンを ProjectManager と同じ丸ボタン（hover/activeあり）へ変更。
  - 「APIキー」「保存先」ラベルを白文字＋太字。
  - 注意文「キーはサーバーに送信しません…」を赤文字＋太字。
  - 入力/小ボタン/保存先ボタン用のフッククラス（`api-key-control`/`api-key-control-btn`/`api-key-mode-btn`）を追加。
  - 「保存して使う」に `idle-btn-primary` を付与（IDLE時は青のPrimary）。
- `index.css`:
  - IDLE時だけ、ApiKeyModal内の入力/ボタンをガラス寄せ配色に上書き。
- 検証: `npm test` PASS


### 追記（Header: IDLE時の右上コントロールをガラス化）
- `components/Header.tsx`:
  - Dev Modeトグル、APIキー、Dev stats にフッククラスを追加（`idle-header-*`）。
- `index.css`:
  - `.screen-idle header` スコープで、上記コントロールをガラス寄せ（背景/枠/文字/トグルON色を青に）。
- 検証: `npm test` PASS


### 追記（Header: APIキーボタンをアイコン化）
- `components/Header.tsx`:
  - 「APIキー」テキストボタンをアイコンボタンに変更（アクセシビリティ用に `aria-label`）。
  - ボタンを一番右（Dev stats の右）へ移動。
- 検証: `npm test` PASS


### 追記（Public docs: IDLE時だけガラス寄せ）
- `components/Header.tsx` / `App.tsx`:
  - IDLE時だけ `usage.html / terms.html / privacy.html` のURLに `?theme=idle` を付けて開く（hrefにも反映）。
- `public/usage.html`, `public/terms.html`, `public/privacy.html`:
  - `theme=idle` のとき `html.theme-idle` を付与。
  - `theme-idle` 時だけ、ライト背景（抽象グラデ）＋ガラスカード（blur + 内側ハイライト）に切替。
- 検証: `npm test` PASS


### 追記（IDLE Hero タイトルの可読性）
- `App.tsx`: タイトル文字（「PDF資料を…に変換」）を `.idle-title-glass` で包んで、背景写真でも読めるように“ほぼ透明ガラス板”を追加。
- `index.css`: `.screen-idle .idle-title-glass` を追加（低い白透過 + blur + 内側ハイライト）。
- 検証: `npm test` PASS


### 追記（IDLE Hero タイトル: 案C / Appleっぽい寄せ）
- `index.css`: `.idle-title-glass` を“Appleっぽい”方向に調整（歪みfilterを外して、blur/saturate/brightness強め + ピル形状 + ヘアライン/ハイライトを強化）。
- 検証: `npm test` PASS


### 追記（IDLE Hero タイトル: 元に戻して白文字3D）
- `App.tsx`: IDLEタイトルのガラス板（`.idle-title-glass`）を撤去し、文言を「PDF資料を動画ファイルに変換」に統一。
- `index.css`: `.idle-title-glass` を削除し、白文字＋立体感用の `.idle-title-3d`（text-shadow）を追加。
- 検証: `npm test` PASS


### 追記（編集画面: ガラス寄せ）
- `App.tsx`: 編集画面（AppStatus.EDITING）でも背景に `screen-idle`（写真背景）を適用し、ヘッダーの docs も `?theme=idle` を付けて統一。
- `components/SlideEditor.tsx`: 外枠と主要パネルに `editor-glass` / `editor-glass-pane` を付与し、背景を透過寄せに調整。
- `index.css`: `editor-glass` / `editor-glass-pane` に `backdrop-filter`（blur + saturate）と上側ハイライトを追加。
- 検証: `npm test` PASS


### 追記（編集画面: 背景画像も見えるように）
- `components/SlideEditor.tsx`: 主要パネルの背景を `bg-transparent` にして、`editor-glass` / `editor-glass-pane` のガラス膜が効くように調整。
- `index.css`: `editor-glass` / `editor-glass-pane` に暗め透過の背景色（画像が透ける）を付与。
- 検証: `npm test` PASS


### 追記（編集画面: 4カード分割）
- `components/SlideEditor.tsx`: 編集画面を4カードに分割（上: ボタン＋一括設定＋追加 / グリッド / タイムライン / サイドバー）。
  - サイドバーを閉じた時、デスクトップで枠線だけ残らないよう `lg:border-0` / `lg:shadow-none` を追加。
- 検証: `npm test` PASS


### 追記（編集画面: 4カードもIDLE同等のガラス構造へ）
- `index.css`:
  - `.screen-idle .editor-glass` を、IDLEの `glass-*` と同じ構造（`::before`=内側の光 / `::after`=blur+distortion）に変更。
  - Timeline用に `overflow-visible` のときは `::after` の `inset` を 0 にしてはみ出しを防止。
- 検証: `npm test` PASS


### 追記（編集画面: 中身のベタ塗りを減らしてガラスが見えるように）
- `components/TimelineEditor.tsx`:
  - タイムライン全体/スクロール部/主要トラックの `bg-slate-*` を `bg-transparent` に寄せ、ヘアライン（`border-white/10`）で区切る。
- `components/ProjectSettings.tsx`:
  - ルート/ヘッダーの `bg-slate-900` を `bg-transparent` に変更。
- `components/SlideInspector.tsx`:
  - ルート/ヘッダー/スクロール部の `bg-slate-900` を `bg-transparent` に変更。
  - タブバーを `bg-black/15 + border-white/10` にして、ガラス上でも境界が分かるように。
- `components/slideEditor/Toolbar.tsx`:
  - ツールバー全体の `bg-slate-900` を `bg-transparent` に変更。
- `components/slideEditor/SlideGrid.tsx`:
  - スライドカード本体と下部バーの `bg-slate-*` を `bg-transparent` に変更。
- 検証: `npm test` PASS


### 追記（編集画面: ボタン/入力もIDLE寄せのガラスに統一）
- `index.css`:
  - `.screen-idle .editor-glass` 配下の `button` と `input/select/textarea` にガラス寄せ（半透明+blur+ヘアライン）を追加。
  - `idle-btn-primary`（青Primary）は除外して優先できるようにした。
- `components/SlideEditor.tsx`:
  - 「書き出し」ボタンを `idle-btn-primary`（青Primary）に変更。
- `components/SlideInspector.tsx`:
  - 「適用」ボタンを `idle-btn-primary`（青Primary）に変更。
- 検証: `npm test` PASS


### 追記（編集画面: 暗いベタ塗りパネル（bg-slate）もガラス寄せ）
- `index.css`:
  - `.screen-idle .editor-glass` 内の `bg-slate-*` を半透明（白うっすら）に上書きして、ガラス面が見えるようにした。
  - hover の `hover:bg-slate-*` で暗さが戻らないよう、hover時の背景も上書きした。
  - `border-slate-*` を白のヘアライン寄せに統一した。
  - `w-px/h-px` の区切り線だけ、見えるように少し濃くした。
- 検証: `npm test` PASS


### 追記（編集画面: ガラスを3段階に分けて読みやすさを改善）
- `index.css`:
  - `.screen-idle .editor-glass` を `editor-glass--thin / --mid / --strong` の3段階に分けた（背景色/blur/ツヤを段階化）。
  - `bg-slate-*` の上書きも3段階っぽく調整して、全部が同じ明るさにならないようにした。
  - 内側の面用に `editor-glass-pane--thin / --mid / --strong` を追加（タイムラインの行などに使える）。
- `components/SlideEditor.tsx`:
  - 4カードに `editor-glass--thin/mid/strong` を割り当て（Grid=thin / Top=mid / Timeline=strong / Sidebar=strong）。
  - Card1ヘッダーに `editor-glass-pane--strong` を付与。
- `components/TimelineEditor.tsx`:
  - Slide Audio / Global Audio / BGM 行を `editor-glass-pane--strong` にして、BGM/ナレーション部分が見やすいようにした。
- 検証: `npm test` PASS


### 追記（タイムライン波形: 暗いベタ塗りを撤去してガラス面を見せる）
- `components/TimelineEditor.tsx`:
  - 波形canvasの背景 `fillRect('#0f172a')` をやめて透明にし、親のガラス（pane）が透けるようにした。
  - グリッド線を白うっすら（`rgba(255,255,255,0.12)`）に変更して、ガラス上でも見えるようにした。
- `index.css`:
  - `editor-glass-pane` に “うっすら枠” の inset shadow を追加した。
- 検証: `npm test` PASS


### 追記（スライダー: ProjectSettings/インスペクタ系のデザイン統一）
- `index.css`:
  - IDLE用のApple寄せレンジスライダー（`idle-range`）を追加（トラック/つまみ/フォーカスリングを統一）。
- `components/ProjectSettings.tsx`:
  - `type="range"` に `idle-range` を付与（スライド縮小/角丸/標準切替時間/ダッキング量）。
- `components/BgmWaveformEditor.tsx`:
  - 音量スライダーに `idle-range` を付与。
- `components/cropModal/AudioSettingsPanel.tsx` / `components/cropModal/ImageSettingsPanel.tsx` / `components/cropModal/OverlaySettingsPanel.tsx`:
  - 各rangeに `idle-range` を付与して、インスペクタ周りのスライダー見た目を統一。
- 検証: `npm test` PASS
