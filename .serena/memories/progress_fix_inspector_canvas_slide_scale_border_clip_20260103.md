## 2026-01-03

### 目的
- インスペクター（装飾/画像/音声のキャンバス表示）で、右下など端が切れて見える問題を修正。
- 方針: `videoSettings.slideScale` を反映して中央寄せ + ステージborder 1px分を内側基準にして 1px切れを無くす。

### 原因
- キャンバスステージの `stageSize` を `getBoundingClientRect()`（border込み）で扱っていたため、子要素（スライド枠）が内側(content)より大きい計算になり、右端が 1px だけ `overflow:hidden` で切れる。
- さらに、デフォルトのスライド枠計算が `slideScale` を無視してステージいっぱい(100%)で表示していたため、端の要素がギリギリになりやすい。

### 対応
- `components/SlideInspector.tsx`
  - ステージサイズ計測を「borderを引いた内寸」に変更（computedStyleのborder幅を差し引く）。
  - `getDefaultSlideRectPx()` で `videoSettings.slideScale` を反映し、ステージ中央に収める。

### 検証
- `npm test` 実行（PASS）
- Playwrightで装飾タブの `slideRect` がステージ内に収まり、`rightOverflow` が正→負（切れ無し）になることを確認。

## 2026-01-04

### 追加の目的
- インスペクター（装飾/画像/音声）のプレビューも「書き出し/全体プレビューと同じ描画パイプライン」に寄せて、見た目（角丸/位置/スケール）を揃える。

### 追加対応
- `services/pdfVideoService.ts`
  - `updateThumbnail()` に `options?: { skipOverlays?: boolean }` を追加。
  - インスペクタープレビュー用に `skipOverlays: true` で「スライド本体だけ」のフレーム画像を生成できるようにした。
- `components/SlideInspector.tsx`
  - `framePreviewUrl` を追加し、`updateThumbnail(..., { skipOverlays: true })` の PNG(640x360) をプレビューに使用。
  - 画像はステージ(=キャンバス)全体を `left=-slideRect.x/top=-slideRect.y` で切り出して、スライド枠にぴったり合わせる。
  - スライド枠の角丸は「表示スケール」に合わせて `stageSize.width / 640` で縮尺（フレーム画像の角丸と一致させる）。

### 追加検証
- Playwright: `sample/Kling_O1_Unified_Multimodal_Engine.pdf` で装飾タブ表示 → 右下ロゴ（NotebookLM）が欠けない＆PNGフレームが使われていることを確認。
- `npm test` 実行（173件PASS）。


## 2026-01-04 (追加)

### 追加の目的（スライド一覧）
- スライド一覧（グリッド）も、インポート直後から「書き出しと同じ描き方」の見た目に揃える。

### 追加対応
- `App.tsx`
  - PDF/画像のインポート後、各スライドに対して `updateThumbnail()` を実行して `thumbnailUrl` をフレームPNG(640x360)に差し替え。
  - `thumbnailIsFrame: true` を付与して、一覧側の二重スケールを防止。

### 追加検証
- Playwright: 一覧の `img[alt="Slide 1"]` が `data:image/png` (640x360) になっていることを確認。
- `npm test` 実行（174件PASS）。

## 2026-01-04 (追加2)

### 追加の目的（プロジェクト設定のリアルタイム反映）
- プロジェクト設定（`slideScale` / `slideBorderRadius`）変更時に、スライド一覧（フレームPNGサムネ）にも見た目がリアルタイムで反映されるようにする。

### 原因
- 一覧サムネをフレームPNGに寄せたことで、`slideScale` / `slideBorderRadius` が「画像に焼き込まれた値」になり、CSSだけでは即時反映できない状態になっていた。

### 対応
- `components/slideEditor/SlideEditorContext.tsx`
  - `slideScale` / `slideBorderRadius` 変更を検知して、フレームPNGサムネを再生成する処理を追加。
  - 連続変更に耐えるため、`inFlight/pending/jobId` で多重実行をガードしつつ、古いジョブはキャンセルする。
  - サムネは「まとめて」ではなく、生成できたスライドから順次 `onUpdateSlides` で反映（体感のリアルタイム性を上げる）。
  - 旧プロジェクト互換のため、`thumbnailIsFrame` が無い場合でも 640x360 PNG の dataURL をフレームサムネとして判定して再生成対象に含める。

### 確認
- Playwright: プロジェクト設定のスライダー操作で、一覧の `img[alt="Slide 1"]` の `src` が短時間で更新されることを確認。
- `npm test` 実行（174件PASS）。
