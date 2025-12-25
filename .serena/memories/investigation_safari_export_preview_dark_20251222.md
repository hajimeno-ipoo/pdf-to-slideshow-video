## 2025-12-22 Safari: 書き出し画面の動画プレビューが暗い（PiPは明るい）調査メモ

### 現象
- Safariのみ、書き出し完了画面（COMPLETED）の `<video>` プレビューが暗く見える。
- PiP（Picture in Picture）では明るく見え、PiP終了でまた暗くなる。
- ダウンロードした動画は明るい（=生成結果自体は概ね正常）。

### コード上の該当箇所
- `App.tsx` の COMPLETED ビューで `<video>` を表示している（概ね `App.tsx:1161-1174`）。
  - `<video className="rounded-2xl ... shadow-lg ..." ... />`
  - 親は `glass-strong`（ガラスカード）
- `index.css` のガラス共通定義で `overflow: hidden` / `isolation: isolate` 等が入る（`index.css:434-444` 付近）。

### ユーザー確認（重要）
- Safariだけ動画枠の backdrop-filter をOFF、さらに疑似要素（::before/::after）もOFFしても効果なし。
  - よって「backdrop-filterそのもの」や「ガラス疑似要素が上に被る」系が直接原因とは言いにくい。

### もっとも濃い原因仮説
- Safari(WebKit) は動画を “ネイティブのビデオオーバーレイ表示” できる時と、CSS都合で “ページ合成（composited）” で描く時があり、
  後者になると色変換（レンジ/ガンマ/色空間）がズレて暗く見えるケースがある。
- PiP はネイティブ表示ルートなので明るく、ページに戻すと合成ルートに戻って暗くなる挙動と整合。
- 合成ルートに落ちるトリガーとして `border-radius` / `overflow:hidden` / `box-shadow` 等の “切り抜き・合成が必要なCSS” が疑わしい。
  - 本件UIは `<video>` 自体が `rounded-2xl` を持ち、親の `glass-strong` も `overflow:hidden` を持つ。

### 次の切り分け（実機での確認手順）
1) Safari開発者ツールで `<video>` の `border-radius` と `box-shadow` を一時的に外す（+ 親の `overflow:hidden` を外す）→ 明るさが戻るか。
2) Blob URL を新規タブで開いて比較（ページ合成由来かの確認）。
3) `ffprobe` 等で `color_range / color_space / color_transfer / color_primaries` を確認（メタ情報欠落/不整合の可能性）。

### 参考（ライブラリ）
- 生成は `services/videoWorkerScript.ts` で Mediabunny `CanvasSource(codec:'avc')` + `Mp4OutputFormat`。
- Mediabunnyは `decoderConfig.colorSpace(fullRange等)` を扱える（EncodedVideoPacketSource の docs より）。
  → もし Safari 側が colorSpace/レンジ情報を落としている場合、表示ルートによって解釈が揺れる可能性がある。