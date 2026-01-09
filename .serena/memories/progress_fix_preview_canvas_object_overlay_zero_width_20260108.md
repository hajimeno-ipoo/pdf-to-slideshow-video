## 2026-01-08

### 症状
- インスペクターで画像をスライド外へドラッグして `space: 'canvas'`（ラベル「オブジェクト」）にしたとき、**全画面プレビュー（PreviewPlayer）だけ画像が表示されない/サイズが崩れる**。
- 書き出し完了画面の動画では表示されるため、プレビューと書き出しで見た目が一致しない。

### 再現（最小）
1. `sample/Kling_O1_Unified_Multimodal_Engine.pdf` を読み込み
2. スライド1を選択 → 右の「スライド編集」→「画像」→ `sample/アニメ.png` を追加 →「適用」
3. 画像をスライド外へドラッグして「オブジェクト」にする →「適用」
4. 「全画面プレビュー」→ 画像が出ない（修正前）

### 原因
- `components/PreviewPlayer.tsx` のオーバーレイDOM:
  - ラッパー要素が `position:absolute; left: {x*100}%` なのに **width/height未指定**で `width:auto` のまま。
  - `x=1` など右端に寄ると、絶対配置の **shrink-to-fit が 0px** になり、さらにTailwindの `img { max-width: 100% }` が効いて **imgの幅も0px** になって消える。
  - `translate(-50%, -50%)` も幅0扱いになるため、端での見え方が崩れる。

### 対応
- `components/PreviewPlayer.tsx`：画像/図形など「箱サイズがあるオーバーレイ」は、ラッパーに `width/height(px)` を付与。
  - 画像は `img` を `width/height: 100%` でラッパーにフィットさせ、`objectFit: 'contain'` を維持。

### 検証
- Playwrightで上の再現手順を実施：修正後は全画面プレビューでもオブジェクト画像が表示され、書き出し動画(t=0)と同様に端でクリップされる。
- `npm test` PASS。