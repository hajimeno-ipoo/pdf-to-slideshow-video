## 2026-01-02 対応: カバーフローのスワイプ中ちらつき軽減（glass-distortion切替の点滅対策）

### 変更点
- `components/slideEditor/SlideGrid.tsx`
  - `data-coverflow-scrolling` の解除タイマーを `140ms → 350ms` に延長。
  - `data-coverflow-scrolling` を毎scrollで上書きせず、未設定時のみ `"true"` をセット（不要な属性更新/スタイル更新を減らす）。

### 期待する効果
- 小刻みスワイプ（短い間隔でscrollが途切れる）でも `data-coverflow-scrolling` がOFFになりにくくなり、
  `filter: none` ⇄ `filter: url(#glass-distortion)` の往復が減って、見た目の点滅（ちらつき）を抑える。

### 動作確認
- Playwrightで「250ms間隔の段階スクロール」でも `data-coverflow-scrolling` が true→null の2回だけになり、filterの往復が増えないことを確認。
- `npm test` PASS。
