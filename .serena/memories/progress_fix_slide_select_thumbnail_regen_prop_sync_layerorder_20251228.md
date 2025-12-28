## 2025-12-28 修正

### 目的
- スライドを「選択しただけ」で SlideInspector の auto thumbnail update が走り、スライド一覧の見た目（黒帯増→縮小っぽい）が変わる問題を止める。

### 原因（確定）
- `components/SlideInspector.tsx` の prop同期(useEffect)で `setLayerOrder(slide.layerOrder || [...])` が毎回新しい配列を作り、
  mount直後に `layerOrder` 参照が変化 → auto thumbnail の didChange 判定が true になり `scheduleThumbnailUpdate(0)` が発火。

### 対応
- `components/SlideInspector.tsx` の prop同期内 `setLayerOrder` を updater 形式にし、
  算出した `next` と `prev` が同一内容なら `prev` を返して参照更新しないようにした。

### テスト/確認
- `npm test` PASS
- Playwright で確認: スライド選択だけでは `img[alt="Slide 1"]` の `src` が JPEG(300x167) のまま。
  編集（例: 範囲リセット）時のみ PNG(640x360) に更新される。