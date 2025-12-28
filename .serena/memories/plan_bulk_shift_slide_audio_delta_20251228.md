## 2025-12-28

### 目的
- 一括設定（Toolbar の「一括設定 (全スライド適用)」）から、Slide Audio（スライド個別ナレーション）だけを **Δ秒** まとめて移動できるようにする。
- 追加オプション: 「移動した分だけスライドの表示時間も伸ばす」。
- ついで: 一括設定の「モーション（Ken Burns）」を削除。

### 実装方針（最小変更）
- 既存データ構造はそのまま使う（`Slide.audioOffset` / `Slide.duration`）。
- UI/処理の設置場所は `components/slideEditor/Toolbar.tsx` の「一括設定」アコーディオン内。
- 一括移動の対象は **slide.audioFile があるスライドのみ**（Slide Audio 行に出るものだけ）。
- Δは小数対応（例: 1.5秒）。
- 左に動かす（Δが負）も許可はできるが、`audioOffset` は 0 未満にできないため 0 で止める。

### 適用ロジック案
- 1スライドごとに
  - `oldOffset = slide.audioOffset ?? 0`
  - `newOffset = Math.max(0, oldOffset + delta)`
  - `appliedShift = newOffset - oldOffset`（クランプで実際の移動量が変わるため）
  - オプションONかつ `appliedShift > 0` のときだけ `duration = slide.duration + appliedShift`

### テスト方針
- Reactコンポーネント直接テストは重いので、ロジックを小さい純関数に切り出して node:test で検証する案が安全。
  - 例: `utils/applySlideAudioOffsetDelta.ts` を作り、
    - 音声なしスライドは不変
    - Δ>0 で offset が増える
    - Δ<0 で 0 にクランプ
    - オプションONで duration が増える（実際に動いた分だけ）
  - `tests/bulkShiftSlideAudio.test.js` で分岐100%を狙う。

### ついで対応（モーション削除）
- `Toolbar.tsx` の
  - `globalEffectType` state
  - `handleApplyGlobalEffect`
  - UIブロック「モーション」
  を削除。
- それに伴い `EffectType` の import も不要なら削除。

### 影響範囲
- UI: 一括設定だけ
- 動作: `audioOffset` と `duration` の更新なので、タイムライン表示・プレビュー・書き出し（`cursor + audioOffset`）に自然に反映される。
