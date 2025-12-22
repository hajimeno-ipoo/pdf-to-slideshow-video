# API Key Connection Fix Task List

- [x] `services/geminiService.ts` の `getClient` 関数を非同期化 (`async`) する <!-- id: 0 -->
- [x] `getClient` を呼び出している箇所の修正 <!-- id: 1 -->
    - [x] `checkApiConnection` 関数内の呼び出し修正
    - [x] `generateSpeech` 関数内の呼び出し修正
    - [x] `generateImage` 関数内の呼び出し修正
    - [x] `generateSlideScript` 関数内の呼び出し修正
- [x] 動作確認 (APIキー入力後のステータス変化確認) <!-- id: 2 -->
