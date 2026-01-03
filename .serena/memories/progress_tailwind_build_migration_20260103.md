## 2026-01-03
- Tailwind CDNをやめてビルド方式へ移行。
- 追加: tailwind.config.cjs, postcss.config.cjs
- index.css に @tailwind base/components/utilities を追加。
- index.html から cdn.tailwindcss.com の script を削除。
- 依存追加: tailwindcss@3, postcss, autoprefixer
- npm run build 実行して成功。