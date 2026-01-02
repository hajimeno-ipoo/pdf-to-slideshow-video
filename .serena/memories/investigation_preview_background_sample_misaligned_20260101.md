## 2026-01-01 調査: 背景処理(画像)の全体プレビュー表示が崩れる

### 現象
- 背景処理を「画像」にして sample(=PNG/WebP系) を設定すると、全体プレビュー(PreviewPlayer)で背景がズレたり黒い帯が出る（アスペクト比変更でも同様）

### 再現（Playwright）
1) 編集画面 → プロジェクト設定 → 背景処理「画像」
2) PNG を選択（例: `public/manual_images/10_fullscreen_preview.png`）
3) 「全画面 プレビュー」→ 背景が動画枠(キャンバス)と一致しない

計測例（DOM Rect）:
- preview-stage: 990x815
- canvas(動画枠): 988x556
- bgAnim `<img>`: stage 全面に表示され `objectFit: contain`

### 原因
- `components/PreviewPlayer.tsx` の `isAnimBackground` が `image/png` と `image/webp` を「アニメ背景」と判定してしまう（APNG/animated WebP 想定だが静止PNGも含む）
  - `components/PreviewPlayer.tsx:41`
- アニメ背景モード（`bgAnimUrl`）では
  - `drawFrame` で `renderBackground` を呼ばず `ctx.clearRect` だけ（キャンバス背景が透明）
    - `components/PreviewPlayer.tsx:949`
  - 背景は `<img>` を preview-stage 全面に `objectFit: contain` で敷く
    - `components/PreviewPlayer.tsx:1211`
- その結果、背景が「動画枠(キャンバス)」ではなく「プレビュー枠(stage)」基準になり、アスペクト比が違うと黒帯/ズレが出る

### 備考
- 静止背景をキャンバス側で描く `renderBackground` は cover 相当で、動画枠に合わせて正しくクロップする（`services/pdfVideoService.ts:325`）
- つまり、プレビューの『bgAnimUrl（アニメ背景）表示』パスが動画枠と一致していないのが根本