## 2025-12-28 修正

### 目的
- SlideInspector を開いたまま別スライドを選択しても、
  **サムネ（SlideGrid/Inspector）が勝手に作り直されない**ようにする。
- 「選択だけ」では編集扱い（auto-apply/auto-thumbnail）にならず、
  **編集した時だけ**サムネ更新が走る状態に揃える。

### 原因（確定）
- `components/SlideInspector.tsx` の prop同期 `useEffect([slide])` で `skipNextAutoApplyRef/skipNextThumbnailRef` を立てた後、
  `setCrop/setOverlays/...` を行うが、state反映は次レンダー。
- そのため同一フラッシュで走る auto-apply / auto-thumbnail の `skipNext` 分岐が
  **旧stateの値で last*InputsRef を更新して skipNext を消費**してしまう。
- 次レンダーで state が新スライドに入れ替わると、`didChange` が true になり
  `scheduleAutoApplyUpdate()` と `scheduleThumbnailUpdate()` が発火 → 選択だけでサムネPNG化が起きる。

### 対応
- prop同期時に「次のスライドの入力値」を ref に退避しておき、
  auto-apply / auto-thumbnail の `skipNext` 分岐では **現在stateではなく“次の値”**で last*InputsRef を初期化するように変更。
- 追加した ref:
  - `pendingAutoApplyInputsRef`
  - `pendingThumbnailInputsRef`

### 変更ファイル
- `components/SlideInspector.tsx`
  - prop同期で next値（crop/overlays/layerOrder/layout/solidColor/audio/duration）を pending ref にセット
  - auto-apply / auto-thumbnail の skipNext 分岐で pending ref を優先して last*InputsRef を更新
- `tests/inspectorAutoApplyUndoRedo.test.js`
  - pending ref の存在/使用をチェックする最小テストを追加

### 確認
- `npm test` PASS
- Playwright で確認:
  - インスペクターを開いたまま `Slide 1 -> 2 -> 3 -> 4` と切替しても、スライド一覧サムネは JPEG(300x167) のまま
  - 編集（例: `範囲リセット`）した時だけ PNG(640x360) に更新される
