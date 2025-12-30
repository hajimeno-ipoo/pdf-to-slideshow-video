## 2025-12-30
- 要望: インスペクターのトリミング/装飾/画像/音声の反映を「自動反映」ではなく「適用ボタンで反映」に戻したい。
- 追加条件: インスペクター内プレビューは即時更新OK／適用後はUndoで戻せる／閉じたら未適用編集は破棄。

### 対応
- `components/SlideInspector.tsx`
  - 自動反映(auto apply)と自動サムネ更新(auto thumbnail)の `useEffect` を削除。
  - `handleApplyChanges` で `onUpdateRef.current(updatedSlide, true)` を呼び、適用＝履歴あり(Undo可)で反映。
  - インスペクタが閉じられた時に未適用編集を破棄するため、`isOpen` prop を追加して `isOpen===false` でローカルstateを `slide` に戻す。
  - モバイルの「閉じる」ボタンも破棄→close の順に実行。
- `components/SlideEditor.tsx`
  - `SlideInspector` に `isOpen={isInspectorOpen}` を渡す。
- `tests/inspectorAutoApplyUndoRedo.test.js`
  - 自動反映前提のテストを「適用で反映/Undo可」前提に更新。

### テスト
- `npm test` PASS
- `npm run build` PASS