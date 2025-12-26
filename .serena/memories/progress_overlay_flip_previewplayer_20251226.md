## 2025-12-26
- 不具合: 反転（flipX/flipY）が「全体プレビュー（PreviewPlayer）」に反映されていなかった。
- 原因: `components/PreviewPlayer.tsx` のDOMオーバーレイ描画で `transform` が回転+スケールのみで、flipX/flipY を見ていなかった。wipe系 clipPath も反転を考慮していなかった。
- 対応:
  - `components/PreviewPlayer.tsx` の OverlayLayer で、`scale(${scaleX}, ${scaleY})` に変更して `flipX/flipY` を反映。
  - wipeアニメ（wipe-right / wipe-down）は、flip時に inset の左右/上下を入れ替えて見た目の方向が自然になるよう調整。
- テスト:
  - `tests/overlayFlipPreview.test.js` を追加（PreviewPlayerが flipX/flipY を transform に反映していることを確認）。
- 検証:
  - `npm test` / `npm run build` OK。