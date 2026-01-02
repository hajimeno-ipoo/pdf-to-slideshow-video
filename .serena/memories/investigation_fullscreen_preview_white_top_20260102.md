# 調査: 全画面プレビュー上部が白く見える（2026-01-02）

## 現象
- 編集画面で「全画面プレビュー」を開くと、動画枠（canvas）の上下に余白が出て、その **上部が白っぽく** 見える。

## 再現（Playwright）
1) PDFを読み込み
2) 編集画面 → 「全画面プレビュー」
3) 動画枠の上下に余白があり、上側が白く見える

## 原因（当たり）
### 1) ルートが編集時も `.screen-idle` のため、IDLE用のCSS上書きが効く
- `App.tsx:1029` で編集時も `screen-idle` を付けている。
  - その結果、IDLEテーマ用の「白いスクラム＋blur」系のCSSが、全画面プレビューにも適用される。

### 2) Previewのオーバーレイが“暗幕”ではなく“白いスクラム”になる
- `index.css:838-843` の `.screen-idle .preview-overlay` が `background: rgba(255,255,255,0.06) !important` に上書きしている。
- `PreviewPlayer.tsx:1180` では本来 `bg-black/95` だが、上のCSSで白寄りになる。

### 3) preview-stage が `glass` で、余白が“白いガラス面”として見える
- `PreviewPlayer.tsx:1197-1200` の `preview-stage` に `glass` クラスが付いている。
- `index.css:522-555` の `.screen-idle .glass::after` が白い背景＋backdrop-filter blur（＋distortion）を作る。
- 動画枠（canvas）はアスペクト比を保って中央配置なので、ステージが縦長だと上下に余白が出て、その余白部分が「白いガラス」になりやすい。

## 追加確認（DevToolsでの一発切り分け）
- `.screen-idle .preview-overlay` を黒に戻す/ `preview-stage` の `glass` をOFFにすると、上部の白さは消える（余白が黒くなる）。

## 修正案（最小案の候補）
- ① `preview-stage` だけはガラスを外して、余白背景を黒にする（見た目が一番わかりやすく安定）
- ② `.screen-idle .preview-overlay` の「暗幕にしない」上書きを、IDLE画面だけに限定（編集時の全画面プレビューは暗幕に戻す）
- ③ `preview-stage` を動画枠のアスペクト比に合わせる（余白そのものを減らす）
