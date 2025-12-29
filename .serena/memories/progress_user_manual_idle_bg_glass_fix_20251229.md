# 進捗: USER_MANUAL の idle ガラス背景が弱く見える件 (2025-12-29)

## 症状
- `public/user_manual.html?theme=idle` だけ、ページ上部で背景の青いグラデ（ガラス感）がほぼ見えず、`public/privacy.html?theme=idle` 等と見た目が揃わない。

## 原因
- 背景の `radial-gradient(... at 12% 18%)` の **18% / 80% がページ全体の高さ 기준** になるため、ユーザーマニュアルは本文が長くてページが縦に長い → グラデの中心がかなり下に行く → 上の方が白っぽく見えてしまう。

## 対応
- `scripts/generate-user-manual.mjs` の `html.theme-idle body` に `background-attachment: fixed;` を追加して、背景を画面に固定（どれだけ長いページでも上部でガラス感が出る）。
- `node scripts/generate-user-manual.mjs` を実行して `public/user_manual.html` を再生成。

## 確認
- Playwrightで `user_manual.html?theme=idle` を確認し、ページ上部でも背景の青いグラデが見えるようになった（規約ページと揃う）。