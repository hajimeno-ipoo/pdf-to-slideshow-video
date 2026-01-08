## 2026-01-08

### 依頼
- 「開始時間」と「表示時間(表示期間)」が連動して見えるのはNG。
- 代替案として C: 「終了時間スライダー」に変更を採用。

### 対応
- `components/cropModal/OverlaySettingsPanel.tsx`
- `components/cropModal/ImageSettingsPanel.tsx`

変更点:
- 「表示期間(Duration)」スライダーを廃止し、「終了時間(End Time)」スライダーに置き換え。
- `endTime` は `duration == null` のとき `slideDuration`、それ以外は `startTime + duration` を `slideDuration` でクランプ。
- 終了時間を右端にしたら `duration: undefined`（=最後まで）に戻る。
- 開始時間を動かしたときは、終了時間が勝手に動かないように `duration` を再計算（endTime固定）。
- 制約: `startTime <= endTime - 0.5` を満たすよう start slider の max を調整。

### テスト
- 更新: `tests/overlayAnimationDurationSliderStable.test.js`
- 実行: `npm test` / `npm run test:coverage`（OK）
