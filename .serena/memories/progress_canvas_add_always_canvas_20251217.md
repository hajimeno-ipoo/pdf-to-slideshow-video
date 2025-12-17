## 2025-12-17
- 方針確定: キャンバス編集ON中に追加するオブジェクトは**常に背景（`space:'canvas'`）**として作る（スライドに追従しない）。

### 変更
- `components/SlideInspector.tsx`
  - 画像追加（ボタン/ファイル選択）で作るオーバーレイの `space` を `isCanvasMode ? 'canvas' : undefined` に変更。
  - キャンバス編集ON中のダブルクリック配置も、スライド内外判定をやめて**常にキャンバス座標**で配置し、`space:'canvas'` 固定に変更。

### 検証
- `npm test` / `npm run build` 成功。