## 2025-12-26
### 症状
- インスペクタ変更がスライド一覧サムネに反映されない。
- 装飾操作後の移動が重い／全体プレビューが出ない。

### 原因（推定）
- `SlideInspector` の auto-apply `useEffect` が `onUpdate`/`slide` の変化に引っ張られて、編集してない時でも `scheduleAutoApplyUpdate()` が回り続ける可能性があった（結果として再描画が過剰になり、プレビューや操作が重くなる）。

### 対応
- `components/SlideInspector.tsx`
  - `slideRef`/`onUpdateRef` を導入し、auto-apply の内部コールを ref 経由にして循環更新を抑制。
  - サムネ更新を「見た目に関係する変更だけ」に限定するため、auto-apply と thumbnail 更新を useEffect で分離。
  - `lastAutoApplyInputsRef` / `lastThumbnailInputsRef` で “実際に編集値が変わった時だけ” スケジュールするようガード。
  - `scheduleThumbnailUpdate` は `sourceFile === null` でも動くよう early return を撤去（solid/customImage でも更新可）。
  - 「適用」ボタンは従来通り `addToHistory=false` で thumbnailUrl を更新。60ms デバウンス中に押した場合だけ auto-apply を先に flush。
- `tests/inspectorAutoApplyUndoRedo.test.js`
  - `onUpdateRef.current(...)` に合わせて文字列テストを更新。

### 確認
- `npm test` PASS
- `npm run build` PASS（vite の .vite-temp 書き込みは権限が必要な場合あり）
