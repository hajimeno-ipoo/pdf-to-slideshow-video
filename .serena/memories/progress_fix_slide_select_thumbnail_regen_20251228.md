## 2025-12-28
### 修正
- スライドを“選んだだけ”で SlideInspector 側の auto thumbnail update が走り、`slide.thumbnailUrl` が `updateThumbnail` 生成(16:9フレーム＋slideScale適用)に差し替わって黒帯が増える問題を修正。

### 原因
- `components/SlideInspector.tsx` の「Keep layerOrder in sync with overlays」effect が、`overlays` 変化のたびに `layerOrder` を必ず新規配列として返していた。
- その結果、見た目は同じでも `layerOrder` の参照が変わり、auto thumbnail update の `didChange` 判定が true → `scheduleThumbnailUpdate` が発火していた。

### 対応
- 同effect内で、算出した `next` が `prev` と同一内容なら `prev` を返して参照を維持するように変更（不要な state 更新を抑止）。
- これにより“選択だけ”ではサムネ再生成が走らず、編集した時だけ走る。

### 該当
- `components/SlideInspector.tsx`

### テスト
- `npm test` PASS