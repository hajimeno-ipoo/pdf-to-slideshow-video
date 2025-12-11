## 2025-12-11
- 症状: Safari 等で crypto.randomUUID が undefined となりエラーバナー表示。
- 対応: utils/uuid.ts に safeRandomUUID を追加し、全ての ID 生成箇所で使用。対象ファイル: components/SlideInspector.tsx, components/CropModal.tsx, components/slideEditor/SlideGrid.tsx, services/pdfVideoService.ts。
- テスト: npm run build OK。