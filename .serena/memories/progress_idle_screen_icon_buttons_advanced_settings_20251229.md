起動画面の「プロジェクト管理」「こだわり設定」をアップロード直下の丸アイコンボタンに変更。
- components/FileUpload.tsx: onOpenProjectManager を受け取り、フォルダアイコンの丸ボタンで ProjectManager を開く。
- components/FileUpload.tsx: こだわり設定は初期は非表示にして、スライダー風アイコンの丸ボタンで開閉（aria-pressed付き）。
- App.tsx: FileUpload に onOpenProjectManager を渡す。
- npm test は通過。