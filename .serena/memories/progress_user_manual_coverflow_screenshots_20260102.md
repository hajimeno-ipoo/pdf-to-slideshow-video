## 2026-01-02 USER_MANUAL.md 更新（スクショ追加）

### 対応内容
- `USER_MANUAL.md`
  - スライド一覧に「表示の切り替え（グリッド / カバーフロー）」の説明を追加
  - スライドカードの「画像を保存」ボタン（ホバーで表示）のスクショを追加
  - 「自動保存と復元」のスクショを追加

### 追加/更新したスクショ
- `Doc/manual_images/05_editor_main.png`（現状UIに合わせて更新）
- `Doc/manual_images/14_restore_modal.png`
- `Doc/manual_images/15_slide_list_coverflow.png`
- `Doc/manual_images/16_slide_card_download_hover.png`

### 生成物更新
- `npm run generate:user-manual` を実行して `public/user_manual.html` と `public/manual_images/*` を同期済み
