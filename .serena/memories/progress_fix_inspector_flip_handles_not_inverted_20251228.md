## 2025-12-28

### 目的
- インスペクター（SlideInspector）で「左右/上下反転」をONにしたあと、
  拡大縮小（ドラッグでサイズ変更）の動きが“逆”に感じる問題を直す。

### 原因
- 反転（flipX/flipY）を、オーバーレイの外側ラッパーに `scale(-1, 1)` / `scale(1, -1)` として当てていたため、
  枠・つまみ（リサイズハンドル）まで鏡になってしまい、ドラッグ方向と計算がズレていた。

### 対応
- `components/SlideInspector.tsx`
  - 外側（位置/回転/つまみ）の `transform` から flip の `scale(...)` を削除。
  - 代わりに「中身だけ」を包む内側ラッパー `contentStyle` に `scale(flipX, flipY)` を適用。
  - これで枠/つまみは通常の向きのまま、中身だけ反転する。

### テスト
- `tests/overlayFlipInspectorHandles.test.js` を追加
  - SlideInspector の外側 transform に flip scale が入っていないこと
  - 中身側には flip scale が残っていること
- `npm test` / `npm run build` OK
