## 2026-01-08

### 依頼
- 画像追加/装飾のアニメ設定で、開始時間/表示期間スライダーの挙動を「普通の挙動」に戻す。

### 原因
- 「表示期間(Duration)」の range `max` を `slideDuration` 固定にすると、開始時間が後ろ側のときに目盛り感（最大値）が残り時間とズレて不自然になる。

### 対応
- `components/cropModal/OverlaySettingsPanel.tsx`
- `components/cropModal/ImageSettingsPanel.tsx`

上記2箇所の「表示期間」スライダーを
- `max` を **残り時間**（`Math.max(0.5, slideDuration - startTime)`）に戻す
- 右端（最大値）のときは `duration: undefined` にして「最後まで」扱いに戻せるようにする
- 開始時間変更で `duration` が残り時間を超える場合は `duration: undefined` に寄せる

### テスト
- 更新: `tests/overlayAnimationDurationSliderStable.test.js`
- 実行: `npm test` / `npm run test:coverage`（OK）
