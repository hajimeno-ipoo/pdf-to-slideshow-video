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