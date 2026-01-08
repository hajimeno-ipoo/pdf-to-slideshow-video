## 2026-01-08

### 症状
- 画像追加/装飾のアニメ設定で「開始時間」を動かすと「表示期間」のスライダーつまみが一緒に動いて見える（表示期間が最大=デフォルトのときは目立たない）。

### 原因
- 「表示期間(Duration)」の range `max` が `slideDuration - startTime` で動的に変わっていたため、同じ duration 秒でもつまみ位置(割合)が変わってしまっていた。

### 対応
- `components/cropModal/OverlaySettingsPanel.tsx` と `components/cropModal/ImageSettingsPanel.tsx` の「表示期間」スライダーを
  - `max={slideDuration}` に固定
  - `duration == null` のときは value を `slideDuration` にして右端=「最後まで」扱い（開始時間を動かしてもつまみが動かない）
  - 変更時は残り時間を超えたら `duration: undefined` に戻す（「最後まで」）
- 開始時間変更時に、duration が残り時間を超える場合は最小限でクランプ。

### テスト
- 追加: `tests/overlayAnimationDurationSliderStable.test.js`
- 実行: `npm test` / `npm run test:coverage`