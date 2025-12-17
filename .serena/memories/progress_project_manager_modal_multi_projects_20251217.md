## 2025-12-17
- 目的: 起動時にプロジェクト管理モーダルを開き、複数プロジェクト（名前付き）を一覧から読込/削除できるようにする。
- 変更:
  - `services/projectStorage.ts`: IndexedDB を v2 に上げ、`projectMeta` ストア追加。複数プロジェクト用に `listProjectMetas/loadProjectById/saveNamedProject/deleteProjectById` を追加（既存 autosave は維持）。
  - `components/ProjectManagerModal.tsx`: 一覧（選択→読込ボタン、サムネのダブルクリックで即読込）、削除（選択→下の削除ボタン）、JSONから読込も追加。
  - `App.tsx`: `AppStatus.IDLE` へ遷移した初回にモーダルを自動オープン。
  - `components/SlideEditor.tsx`: 編集画面に「名前をつけて保存」ボタン追加（`saveNamedProject` 呼び出し）。
- 確認: `npm run build` / `npm test` OK。