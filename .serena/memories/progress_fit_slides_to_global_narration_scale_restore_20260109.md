## 2026-01-09 進捗: 全体ナレーション尺に合わせてスライド総尺をスケール（比率維持）+ 削除時に元の尺へ復元

### 目的
- 全体ナレーション（globalAudioFile）がスライド総尺より長い/短い場合でも、動画の総尺がナレーション尺に合うようにする。
- 比率維持で各スライド duration をスケール。
- 全体ナレーションを外したら、スライドを「追加前の元の尺」に戻す。

### 実装内容
- `types.ts`:
  - `Slide` に `durationBeforeGlobalAudioFit?: number` を追加（全体ナレーションfitの復元用）。

- `utils/globalNarrationFit.js`（新規）:
  - `fitSlidesToGlobalNarrationDuration(slides, targetSeconds)`
    - baseKey（デフォルト `durationBeforeGlobalAudioFit`）が無い場合、fit前の duration を保存。
    - スライドdurationを比率維持で targetSeconds に合うように割り当て（minSeconds=0.1, tickSeconds=0.01）。
    - minに引っかかる場合は、足切りしつつ残りを比率維持で再配分。
  - `restoreSlidesFromGlobalNarrationFit(slides)`
    - baseKey を使って duration を復元し、baseKey を削除。

- `components/slideEditor/SlideEditorContext.tsx`:
  - `setGlobalAudioFile(file)` 内に処理を集約（UI二重実装を避ける）。
  - `file` 設定/変更時:
    - `AudioContext.decodeAudioData` で音声 duration を取得し、`fitSlidesToGlobalNarrationDuration` で slides.duration を更新。
  - `file` 削除時:
    - `restoreSlidesFromGlobalNarrationFit` で元の尺に戻す。
  - Undo/Redo:
    - `pushHistoryGrouped()` は従来どおり。
    - fit/restore による `updateSlides(..., false)` で履歴が二重に積まれないようにして、Undo 1回で戻せる挙動を維持。
    - 非同期decodeの競合は `globalNarrationFitJobIdRef` で最新のみ反映。

### テスト
- `tests/globalNarrationFit.test.js`（新規）:
  - fit/restore の主要分岐をカバー。
  - `npm test` / `npm run test:coverage` 実行して確認。
  - `utils/globalNarrationFit.js` は line/branch/funcs すべて 100% を達成。

### 注意
- ナレーションが極端に短くて `minSeconds * slides.length` 未満の場合は、物理的に一致できないため、最小durationに揃える（結果として総尺はナレーションより長くなる）。
