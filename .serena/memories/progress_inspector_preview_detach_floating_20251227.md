## 2025-12-27

### 目的
- スライド編集（SlideInspector）で「プレビューだけ」をインスペクターから切り離して、
  **フローティング窓（ドラッグ移動 + 自由リサイズ）**で大きく編集できるようにする。
- 追加（装飾/画像など）や `適用` は、これまで通り **インスペクター側**で行う。
- 位置/サイズの保存（localStorage）はしない（開くたび中央・初期幅720px）。

### 実装
- `components/SlideInspector.tsx`
  - 状態追加: `previewDetachedOpen`, `previewFloatRect`
  - ヘッダー右側のボタンを `プレビュー窓 / 戻す` に変更
  - プレビューは **1箇所のみ**表示：
    - 通常時：インスペクター内
    - 切り離し中：`createPortal` で `.screen-idle` 配下にフローティング窓として表示
  - フローティング窓
    - 初期幅: 720px（画面が小さい場合は収まる範囲で縮める）
    - 初期高さ: スライド比率（`videoSettings.aspectRatio`）から計算
    - 初期位置: 中央
    - ドラッグ移動: ヘッダーを `pointerdown → pointermove` で移動
    - リサイズ: フチ/角をドラッグ（`pointerdown → pointermove`）で自由リサイズ（右下つまみ無し）
    - 画面外に完全に消えないように clamp
  - 切り離し中のプレビューは上下が切れないように、
    `previewAreaRef` の内寸を `ResizeObserver` で追跡し、
    `width=min(innerW, innerH*aspect)` / `height=width/aspect` の contain サイズでステージを描画

### 追加修正（中央表示とレイアウト崩れ防止）
- 画面下に出てレイアウト（タイムライン/グリッド）を押しつぶす問題があり、原因は `.screen-idle .editor-glass { position: relative; }` が `fixed` を上書きしていたため。
- フローティング窓の外枠に `style={{ position: 'fixed' }}` を付けて、必ず“重なって表示”になるように修正。
- 初期位置は「画面全体のど真ん中」を基準に戻す（`getViewportRect()` を使用）。

### 検証
- `npm test` PASS
- `npm run build` PASS
