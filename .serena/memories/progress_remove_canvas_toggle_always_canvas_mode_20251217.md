## 2025-12-17
- 要望: キャンバス編集ボタンを無くして、最初からキャンバス編集状態にしたい（ただしトリミング中は従来どおり）。

### 変更
- `components/SlideInspector.tsx`
  - `isCanvasMode` の state とトグルボタンを撤去。
  - `isCanvasMode` は `activeTab !== 'crop'`（トリミング以外は常にキャンバス編集扱い）として扱う。
  - これにより、トリミングは今まで通りの表示/操作のまま、それ以外のタブは常にキャンバス編集UIになる。

### 検証
- `npm test` / `npm run build` 成功。