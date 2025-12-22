## 2025-12-22
- 目的: スライド編集の「全画面プレビュー」(PreviewPlayer) も、IDLE白ガラス（screen-idle）と同じ見た目へ。

### 実装
- `components/PreviewPlayer.tsx`
  - ルートoverlayに `preview-overlay` を付与。
  - 全体コンテナを `preview-panel glass-strong idle-sidebar-typography` にして白ガラス化（ダーク時は従来の `bg-slate-900/80 border-slate-800` で維持）。
  - 再生ステージを `preview-stage glass` にして白ガラス化。
  - 再生コントロールの土台を `glass-thin` に。
  - 閉じるボタンを ProjectManagerModal と同系統の丸ボタン（hover/activeあり）に変更。
  - シークスライダーに `idle-range` を付与。
- `index.css`
  - `.screen-idle .preview-overlay` を白スクラム＋blur に変更（暗幕にしない）。
  - `.screen-idle .preview-panel/.preview-stage` の `border-slate-800` をヘアライン寄せ。
  - `.screen-idle .preview-panel.glass-strong::after` を `inset:-28px` にして端の欠け対策。

### 検証
- `npm test` PASS
