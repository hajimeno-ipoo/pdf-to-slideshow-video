## 2025-12-28 調査メモ（確証）

### 再現（Playwright / Chrome DevTools）
- 編集画面（右はプロジェクト設定、スライド未選択）で `Slide 1` サムネは **JPEG**
  - `img[alt="Slide 1"]`:
    - `src` prefix: `data:image/jpeg...`
    - `naturalWidth/Height`: **300x167**
- `Slide 1` をクリックして SlideInspector を開くと、短時間で **PNG** に差し替わる
  - `img[alt="Slide 1"]`:
    - `src` prefix: `data:image/png...`
    - `naturalWidth/Height`: **640x360**
    - `transparentRatio`（alpha==0）: **0.1033159722**
  - `img[alt="Slide 2"]` はクリックするまで JPEG のまま（クリック後に同様に PNG 化）

### 見え方が変わる理由
- `updateThumbnail` 生成 PNG は `videoSettings.slideScale`（例: 95%）が反映され、
  周囲に **透明余白**ができる（`1 - 0.95^2 = 0.0975` に近い 0.1033）。
- スライド一覧（SlideGrid）は **CSS でも slideScale を `transform: scale(...)` で適用**しているため、
  「PNG内の縮小（透明余白） + CSS縮小」が重なり、選択スライドだけ黒帯（背景）が増えて“縮小”に見える。

### 該当コード
- `components/SlideInspector.tsx`
  - `scheduleThumbnailUpdate` が `updateThumbnail(..., videoSettings)` を呼び、`slide.thumbnailUrl` を差し替え: 254-273
  - 自動サムネ更新の effect から `scheduleThumbnailUpdate(0)` が呼ばれる: 359-382
- `services/pdfVideoService.ts`
  - `updateThumbnail` は **640x360** の canvas を作り、PNG を返す: 612-614, 742-743
  - `drawSlideFrame(..., vs)` に `settings`（= videoSettings）を渡す: 711-724
- `components/slideEditor/SlideGrid.tsx`
  - `transform: scale(videoSettings.slideScale/100)` を常に適用: 309
  - `img src={slide.thumbnailUrl}` を表示: 321-325

### 参考（ポータル）
- `createPortal` は DOM の配置先を変えるだけ（Reactツリー上は子のまま）なので、
  本件の「サムネ差し替え」は portal 自体が原因ではない。
