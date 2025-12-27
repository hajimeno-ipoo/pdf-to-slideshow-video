※このメモの「全画面モーダル（previewFullscreenOpen）」案は後で見直して、現在はフローティング窓方式（previewDetachedOpen）に置き換え済み。
最新は memory: progress_inspector_preview_detach_floating_20251227 を参照。

## 2025-12-27

### 目的
- スライド編集（SlideInspector）のプレビューが小さくて編集しにくいので、**アプリ内の全画面モーダル**で編集できるようにする。

### 実装
- `components/SlideInspector.tsx`
  - 状態追加: `previewFullscreenOpen`
  - ヘッダー右側に `最大化` / `戻す` を追加（= アプリ内の全画面モーダル切替）
  - `適用` は既存のまま
  - 全画面中は `Escape` で閉じる（ただし pendingAddType の Escape キャンセル優先）
  - 全画面中はプレビュー領域の高さ制限を緩めて見やすく
  - 全画面は背景クリックでも閉じられる
  - `position: fixed` が親要素の transform でサイドバー内に閉じる環境があったので、overlayは `createPortal` でルート（`.screen-idle`）配下に出して全画面を保証
  - Portal切替で `stageRef` が差し替わるため、`ResizeObserver` が古い要素を見てプレビューが真っ黒になることがあった → stageサイズ追跡Effectを `previewFullscreenOpen` 依存にして付け替え
  - Portalで `.editor-glass` の外に出るとボタンがガラス寄せにならないので、全画面時のパネルに `editor-glass` を付与
  - 全画面切替で cropプレビュー画像の表示サイズが変わっても `onLoad` が走らず、crop矩形だけ“古いサイズ”で計算されて帯状に見えることがあった → 画像サイズも `ResizeObserver` で追跡して再計算
- `index.css`
  - `.screen-idle` の時だけ、全画面SlideInspectorのoverlay/panelを白ガラス寄せ
    - `.inspector-overlay`, `.inspector-panel` を追加

### 検証
- `npm test` PASS
- `npm run build` PASS

### メモ
- いまの「最大化」は、**サイドバー内の拡大じゃなくて**、アプリ内で全画面モーダルに切り替える意味。  

### 追加対応（全画面プレビューの上下切れ + ボタン巨大化）
- `components/SlideInspector.tsx`
  - 全画面時、プレビュー領域が `overflow-hidden` のままなのに、ステージが `w-full + aspect-ratio` で幅基準になり、**高さがはみ出して上下が切れる**ケースがあった。
  - 対策：全画面中だけ、プレビュー領域（`previewAreaRef`）の内寸を `ResizeObserver` で追跡し、
    - `width = min(innerW, innerH * aspect)`
    - `height = width / aspect`
    で **contain（はみ出さない）サイズ**を計算して、ステージに `width/height` を当てる。
  - cropタブも `max-h: 75vh` だとプレビュー領域より大きくなって切れることがあるので、全画面中はプレビュー内寸で `img` の `maxWidth/maxHeight` を制限。
  - 全画面中のプレビュー領域を `flex-[2]` にして、編集プレビューを大きめに確保。
  - 全画面中の設定UIが横に伸びすぎてボタン類が巨大化するので、スクロール領域の中身を `max-w-xl + mx-auto` で中央寄せしてサイズを安定化。

### 検証
- `npm test` PASS
- `npm run build` PASS
- 追記：プレビュー領域の計測は `useLayoutEffect` にして、全画面切替時の一瞬の上下切れ（ちらつき）を出にくくした。
