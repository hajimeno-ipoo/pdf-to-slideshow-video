## 2026-01-08

### 要望
- 開始時間スライダーは開始時間だけ、終了時間スライダーは終了時間だけを設定。
- 片方を動かしたときに、もう片方を内部計算で勝手に変更しない。

### 対応
- `types.ts`: `Overlay` に `endTime?: number` を追加（開始/終了を独立して保持）
- `components/cropModal/OverlaySettingsPanel.tsx` / `components/cropModal/ImageSettingsPanel.tsx`:
  - 開始スライダーは `onUpdateOverlay({ startTime })` のみ
  - 終了スライダーは `onUpdateOverlay({ endTime })` のみ
  - 旧データ互換として、`endTime` 未設定の場合は一度だけ `duration` から `endTime` を初期化（意味を変えない移行）
- `components/PreviewPlayer.tsx` / `services/videoWorkerScript.ts`:
  - 表示区間の判定は `endTime` 優先、無ければ従来通り `duration` を使用

### テスト
- 更新: `tests/overlayAnimationDurationSliderStable.test.js`
- `npm test` / `npm run test:coverage` OK