## 2025-12-30

### 症状
- トリミング指定→「適用」後、スライド一覧/書き出しは正しいのに、インスペクターの装飾タブ（Canvas表示）のプレビューだけトリミング位置とズレる。

### 再現（Playwright）
- PDFを読込 → スライド1選択 → トリミングで枠を縮小 → 適用 → 装飾タブ
- 装飾タブの `img[alt="Slide"]` が横方向に拡大できず、縦横比が崩れて見える。

### 原因
- Tailwind の preflight により `img { max-width: 100%; }` が効いていて、
  Canvas表示で使っている背景 `img`（absolute + cropLayout）を **親要素より大きくできない**。
- その結果、cropLayout が想定する「横に拡大して切り抜く」が成立せず、ズレ/歪みが発生。

### 対応
- `components/SlideInspector.tsx`
  - Canvas表示の背景 `img` に `max-w-none max-h-none` を追加してクランプ解除。

### 検証
- `npm test` PASS
- Playwright上で `getComputedStyle(img).maxWidth === 'none'` を確認し、装飾プレビューが一覧と一致することを確認。
