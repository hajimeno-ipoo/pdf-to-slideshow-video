## 2025-12-25

### 要望
1) 「比率 1:1」ボタンを比率選択（複数プリセット）に変更し、選択した比率で枠（crop）を作り直す。
   - デフォルトは「元（スライド比率）」。
2) Shift押下での一時ロックは無し。
3) トリミングのハンドルを左右上下にも追加。
4) ガイド線を枠と同じ色に。

### 対応
- `components/SlideInspector.tsx`
  - 追加: `CropDragMode`（n/s/e/w + 角）
  - 追加: `CropAspectPreset`（slide/16:9/4:3/1:1/9:16/free）
  - 追加: `cropAspectPreset` state（デフォルト 'slide'）
  - 追加: `handleSelectCropAspectPreset()` + `applyCropAspectRatio()`
    - 比率選択時、スライド内で最大になる比率枠を中央に作成
  - 変更: crop リサイズ処理を n/s/e/w にも対応
  - 変更: 比率ロックは選択プリセットで決定（Shiftは未使用）
  - 変更: ガイド線を `border-emerald-400/70`（枠色に合わせ）
  - UI: トリミングタブに比率プリセット（2段）を追加（元/16:9/4:3 + 1:1/9:16/フリー）

### テスト
- 更新: `tests/cropGuidesAndAspectLock.test.js`
- 実行: `npm test` 成功