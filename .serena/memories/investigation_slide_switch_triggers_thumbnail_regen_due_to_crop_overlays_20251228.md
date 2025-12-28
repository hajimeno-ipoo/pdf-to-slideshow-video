## 2025-12-28 調査（新問題：インスペクター開いたままのスライド切替でサムネPNG化）

### 症状
- SlideInspector を開いた状態で別スライドを選択すると、スライド一覧サムネが **JPEG(300x167) → PNG(640x360)** に差し替わり、黒帯が増えて「縮小した」ように見える。
- インスペクターを閉じた状態で最初に選択した時は発生しにくい（＝マウント時はOK、マウント後の切替で発生）。

### 再現（Playwright）
- PDFを読み込み → Slide 1 を選択して SlideInspector を表示（ここではサムネ変化しない）
- そのまま Slide 2 をクリック → `img[alt="Slide 2"]` が `data:image/png...` / 640x360 に変化

### “編集扱い”になってる値（確定）
- `SlideInspector` の auto thumbnail 判定で **crop と overlays** が動いて「編集した扱い」になっている。
- layerOrder / slideLayout / solidColor はこの再現では変化していない（l/sl/sc=false）。

### 計測方法（React内部）
- SlideInspector の `lastThumbnailInputsRef.current` への代入タイミングを、ブラウザ側で setter 置換してログ化。
- ログ例（スライド切替時に2回走る）：
  - 1回目: `c=false o=false l=false sl=false sc=false`（skipNext の回。値がまだ旧状態のまま）
  - 2回目: `c=true o=true l=false sl=false sc=false`（prop同期で crop/overlays の state が入れ替わった後。ここで didChange 扱い→ `scheduleThumbnailUpdate(0)`）

### 原因（コード上）
- `components/SlideInspector.tsx`
  - prop同期 `useEffect([slide])` で `skipNextThumbnailRef.current = true` にしてから `setCrop(slide.crop)` / `setOverlays(...)` 等を実行。
  - ただし state 更新は次レンダーで反映されるため、同じコミットの effect フラッシュで走る auto thumbnail effect（`useEffect([...])`）は **旧stateのまま skipNext を消費**し、`lastThumbnailInputsRef.current` を旧stateで更新して return。
  - 次のレンダーで crop/overlays の state が反映されると、skipNext は既に false なので `didChange` が true になり、`scheduleThumbnailUpdate(0)` が走って PNG サムネへ差し替え。

### 直近修正との関係
- 12/28 の layerOrder 参照固定（prop同期 setLayerOrder を同一内容なら prev 返す）は「選択だけで layerOrder が新配列扱いになる」系の原因を潰したもの。
- 今回は **crop/overlays が“次レンダーで反映される”こと**が原因なので、別ルート。

### 修正方針案（報告用）
- 「prop同期の次state（slide.crop / nextOverlays / nextLayerOrder / nextLayout / nextColor）」を ref に保存し、auto thumbnail effect の skipNext 分岐では **現在stateではなく“次state”を lastThumbnailInputsRef に入れる**（=2回目で didChange にならない）。
- もしくは prop同期を `useLayoutEffect` 側に寄せて、state反映を先に済ませた上で useEffect の比較が走るようにする（ただし負荷と影響範囲に注意）。
