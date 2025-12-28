## 2025-12-28

### 目的
- 一括設定から Slide Audio（スライドのナレーション音声）だけを Δ秒 まとめて移動できるようにする。
- オプション: 移動した分だけスライド表示時間も伸ばす。
- ついで: 一括設定の「モーション」機能を削除。

### 変更
- `components/slideEditor/Toolbar.tsx`
  - 一括設定に「ナレーション」(Δ秒) + 「時間を伸ばす」チェック + 適用ボタンを追加。
  - 一括設定の「モーション（Ken Burns）」を削除（state/handler/UI を除去）。
- `utils/slideAudioBulkShift.js`
  - `applySlideAudioOffsetDelta(slides, deltaSeconds, { extendDuration })` を追加。
  - `audioFile` があるスライドのみ `audioOffset` を更新（0未満は0クランプ）。
  - `extendDuration` がONのとき、実際に動いた分だけ `duration` を加算（負方向は伸ばさない）。

### 反映先
- `audioOffset` / `duration` を更新するだけなので、タイムライン表示・全体プレビュー・書き出し（`cursor + audioOffset`）に自然に反映される。

### テスト
- `tests/slideAudioBulkShift.test.js` 追加
- `npm test` / `npm run build` OK
