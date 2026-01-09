## 2026-01-09 調査: 全体ナレーションに合わせてスライド総尺を伸ばしたい

### 現状の原因（なぜ切れるか）
- 書き出し/プレビューどちらも「動画の総尺」は **スライドの duration 合計**で決まっている。
  - 書き出し: `services/pdfVideoService.ts:954` で `totalDuration = slides.reduce(... + s.duration)`。
    - `OfflineAudioContext` の長さも `safeDuration = totalDuration` で作るため、`globalAudioFile` がそれより長いとレンダリングで後半が切れる（+1秒バッファはあるが根本は同じ）。
    - `globalAudioFile` は `src.start(0)` で先頭から鳴らすだけ（`services/pdfVideoService.ts:1018` 付近）。
  - 全画面プレビュー: `components/PreviewPlayer.tsx:691` 付近で `duration = totalDuration` を元に `OfflineAudioContext` を作ってミックスするので同様に切れる。

### できる？
- できるよ。やることは単純で、
  - (A) スライドの合計時間を **全体ナレーションの長さに合わせて伸ばす**
  - もしくは (B) 書き出し/プレビュー側の総尺を `max(スライド合計, 全体ナレーション)` にする
 って選択になる。

### おすすめ方針（要件に一番近い）
- 要件「全体ナレーションを追加した時に、スライド全体の長さを全体ナレーションに合わせたい」なので、
  **グローバル音声を追加したタイミングで slides の duration を更新する**のが一番自然。
  - これならプレビュー/書き出し/タイムライン表示すべてが同じ総尺になり、切れない。

### 実装のやり方（最小変更案）
1) 全体ナレーションの長さ（秒）を取る
   - `globalAudioFile.arrayBuffer()` → `AudioContext.decodeAudioData()` → `audioBuffer.duration` が確実。
   - ここで decode できない形式は、結局プレビュー/書き出しでも鳴らせないので、duration が取れない＝合わせられない。

2) 今のスライド総尺を計算
   - `slides.reduce((acc, s) => acc + s.duration, 0)`

3) 伸ばし方は2案（どっちが良いか要確認）
   - 案1: **均等割り**（既存のBGMの「曲の長さに合わせる」と同じ）
     - `perSlide = globalDuration / slides.length` を全スライドに設定。
     - 既存例: `components/ProjectSettings.tsx:56` の `handleFitToAudio()`
   - 案2: **比率維持でスケール**（ユーザーが調整した duration の比率を保つ）
     - `ratio = globalDuration / slideTotal`、各スライド `duration *= ratio`。
     - 端数は最後のスライドで帳尻合わせ。

4) どこに入れるか
   - 二重実装を避けるなら `components/slideEditor/SlideEditorContext.tsx:385` の `setGlobalAudioFile` 周りに集約が良い。
     - 例: `globalAudioFile` 変更を検知する `useEffect` を置き、
       - その中で duration を取って slides を更新。
       - `updateSlides(updated, false)` を使えば、`setGlobalAudioFile` が積んだ履歴と合わせて「Undo 1回で元に戻る」設計にできる。
   - 逆にUI側でやるなら、`components/ProjectSettings.tsx:33` と `components/slideEditor/SettingsPanel.tsx:32` の `handleGlobalAudioSelect` を両方直す必要がある。

### 仕様（ユーザー確定）
- 全体ナレーションが **長い時は伸ばす / 短い時は縮める**（スライド総尺をナレーション尺に合わせる）。
- **比率維持でスケール**（各スライド duration の比率は保つ）。

### 注意点（実装で気をつける）
- スライド duration には最小値がある（UI側で `0.1s` などに丸め/制限）。
  - ナレーションが極端に短いと、最小値のせいで「完全に一致」できない可能性がある。
- duration を縮めると、スライド音声（個別ナレーション）やトランジションが詰まるので、短すぎるケースは要ガード。
