## 2026-01-03
- 対象: 全画面プレビューのシークバー（PreviewPlayer）の進捗色が出ない
- 原因: 再生中は `currentTime` をプログラム更新するだけで `input` イベントが発火せず、`--idle-range-progress` が更新されない
- 対応: `components/PreviewPlayer.tsx` に `seekRangeRef` を追加し、`currentTime/totalDuration/isOpen` 変化で `--idle-range-progress` を再計算して `style.setProperty`
- 変更点:
  - `components/PreviewPlayer.tsx`: `seekRangeRef` + `useEffect` で進捗CSS変数更新、`<input type=range>` に `ref` 付与
- テスト: `npm test -- --runTestsByPath tests/idleRangeProgress.test.js` 実行（PASS）