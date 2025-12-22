## 2025-12-22
- 対象: 「作業の続きから始めますか？」(RestoreModal) / 「サムネ画像を書き出す」(App内サムネ書き出しダイアログ)
- 目的: PDFアップロード/スライド編集と同じ IDLE白ガラス + 文字色の階級 + フォント太さに統一。

### 変更
- RestoreModal
  - overlay/panel に `restore-modal-overlay` / `restore-modal-panel` を追加し、`glass-strong` + `idle-sidebar-typography` で白ガラス寄せ。
  - 更新日時の枠を `glass-thin` にし、日付の緑アクセントを外して文字階級に合わせた。
  - ボタン: 破棄= `idle-btn-glass`、復元= `idle-btn-primary`（IDLE時は青に統一）

- サムネ書き出しダイアログ（App.tsx）
  - overlay/panel に `thumbnail-export-overlay` / `thumbnail-export-panel` を追加し、`glass-strong` + `idle-sidebar-typography` で白ガラス寄せ。
  - モード選択/実行ボタンを青基調にし、IDLE時は `idle-btn-primary` / `idle-btn-glass` で統一。
  - 入力枠のカードは `glass-thin` にして白ガラス感を維持。

- index.css
  - `.screen-idle .restore-modal-overlay/.restore-modal-panel` と `.screen-idle .thumbnail-export-overlay/.thumbnail-export-panel` を追加。
  - overlay は暗幕にならないよう白いスクラム+blur に変更、panel は凹み対策で `::after { inset:-28px; }`。

### テスト
- `npm test` 実行: PASS