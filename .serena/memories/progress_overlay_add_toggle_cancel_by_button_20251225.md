## 2025-12-25

### 要望
- インスペクタの装飾追加（ダブルクリック配置モード）の解除が ESC だけなのを改善。
- 画像の各ボタン（テキスト/線/矢印/四角/丸）を「もう一回クリック」でも解除できるようにする。

### 対応
- `components/SlideInspector.tsx`
  - `handleAddOverlay` の pending モード設定で、同じ type を再クリックしたら `pendingAddType` を `null` にして解除する分岐を追加。
  - 解除時は `selectedOverlayId/selectedLayerId` を触らない（選択中がある場合に消さないため）。

### テスト
- 追加: `tests/pendingAddOverlayToggle.test.js`
- 実行: `npm test` 成功