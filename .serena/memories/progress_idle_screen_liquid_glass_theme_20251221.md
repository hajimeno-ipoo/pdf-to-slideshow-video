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
