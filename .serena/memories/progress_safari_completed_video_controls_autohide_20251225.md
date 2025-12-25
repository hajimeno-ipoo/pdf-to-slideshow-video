# 2025-12-25 書き出し完了画面：Safariでコントローラー表示中だけ暗くなる対策

## 背景
- Safariはネイティブのvideo controls(シークバー等)が表示されている間、映像が暗く見えることがある。
- 切り分けで `video.controls=false` にすると明るく戻ることを確認。

## 対応
- 完了画面の `<video>` を常時 `controls` から変更し、"触ってる間だけ controls=true、少ししたら controls=false" の挙動にした。
- 実装: `App.tsx`
  - `COMPLETED_VIDEO_CONTROLS_HIDE_DELAY_MS = 2000`（ポインタ操作）
  - `COMPLETED_VIDEO_CONTROLS_HIDE_DELAY_FOCUS_KEY_MS = 1000`（フォーカス/キー操作）
  - `completedVideoControls` state と `completedVideoControlsHideTimerRef` を追加
  - ポインタ操作では `controls` を一時的にONにし、2秒でOFF
  - ポインターが動画枠から出たら即OFF（明暗切り替えのラグ軽減）
  - フォーカス/キー操作では `controls` を一時的にONにし、1秒でOFF
  - 画面遷移でタイマーをクリア

## テスト
- `tests/completedVideoControlsAutohide.test.js` を追加（実装の存在確認）
- `npm test` / `npm run test:coverage` 実行しパス