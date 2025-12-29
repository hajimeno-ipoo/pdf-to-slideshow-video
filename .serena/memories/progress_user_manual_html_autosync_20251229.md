USER_MANUAL.md と public/user_manual.html を自動連動に寄せて更新。
- USER_MANUAL.md: タイムラインの「切り替えの長さ（ふわっとする時間）」は、スライド右はしのしましま（Fなど）の左はしをドラッグして調整、と説明。
- scripts/generate-user-manual.mjs: USER_MANUAL.md -> public/user_manual.html を生成、Doc/manual_images -> public/manual_images をコピー。
- public/user_manual.html: 末尾の「※ このページは USER_MANUAL.md を元に作成しています。」文言を削除（生成結果から除外）。
- package.json: predev/prebuild で自動生成 + generate:user-manual コマンド追加。
- vite.config.ts: dev中に USER_MANUAL.md / Doc/manual_images 変更を検知して再生成し、/user_manual.html をフルリロード。
- npm test は通過。