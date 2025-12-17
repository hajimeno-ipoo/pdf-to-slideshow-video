## 2025-12-17
- 右パネルの要素一覧で「ドラッグで並び替え（=レイヤー順）」を実装。
  - 一覧は“上ほど手前(前面)”として表示（`overlays` を reverse して描画）。
  - ドロップ時は、表示順で並び替え→内部の `overlays` 配列へは reverse して保存し、描画順（後ろが上）と整合。
- 追加: `utils/overlayUtils.js` に `reorderOverlaysById`。
- テスト: `tests/overlayUtils.test.js` に並び替えテスト追加。
- `npm test` pass。