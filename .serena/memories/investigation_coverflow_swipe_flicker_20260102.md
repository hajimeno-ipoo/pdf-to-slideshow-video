## 2026-01-02 調査: カバーフローのスワイプ中だけ画面がちらつく（ボタン移動では出ない）

### 現象
- カバーフローでトラックパッドスワイプ中にフラッシュ/ちらつきが残る。
- 前/次ボタン（scrollIntoView smooth）では目立たない。

### 関連実装
- `components/slideEditor/SlideGrid.tsx`
  - coverflow scroller の `scroll` で `.screen-idle` に `data-coverflow-scrolling="true"` を付与。
  - 最終 scroll から 140ms 後に属性を解除。
- `index.css`
  - `.screen-idle[data-coverflow-scrolling="true"] .editor-glass::after` の間だけ `filter:url(#glass-distortion)` を `none` にして歪み停止。

### Playwrightでの観測
- ボタン移動:
  - scroll が連続するため `data-coverflow-scrolling` はほぼ連続して true のまま維持され、最後に 1 回だけ解除（filter が 1 回だけ戻る）。
- 短い「小刻みスクロール」(scrollLeft を段階的に変える/短いスワイプ想定):
  - scroll が 1 回だけ発生→140ms後に属性解除→次の小スクロールで再付与…を繰り返し。
  - 結果として filter が `none` ⇄ `url(#glass-distortion)` を短時間で往復し、視覚的に点滅(ちらつき)になりやすい。

### 原因の当たり
- 「スクロール終了」を 140ms タイマーで判定しているため、スワイプが小刻み/一瞬止まるタイプだと `data-coverflow-scrolling` が ON/OFF を繰り返し、歪みフィルタの切り替えが点滅に見える可能性が高い。

### 修正案（OK後）
- 解除猶予を延ばす（例: 140ms→300〜500ms）または最小ON時間（ヒステリシス）を設け、短い間隔のスワイプでON/OFFが起きないようにする。
- 追加で `dataset` を毎 scroll で書き直さず、未設定時のみ set することで不要な style invalidation を減らす。
