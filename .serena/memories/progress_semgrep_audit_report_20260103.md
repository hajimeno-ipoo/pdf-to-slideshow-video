# semgrep-audit-report 進捗 (2026-01-03)
- 追加: --chart-mode (auto/local/cdn) とローカルChart.js対応、assets/chart.umd.min.js を同梱。
- 追加: .semgrepignore 自動追加（reports/ や out_dir を無視）。
- 変更: HTMLは ./chart.umd.min.js を参照（auto時にコピー）。
- 確認: --sca-mode scan でレポート生成OK、chart.umd.min.js が出力先にコピーされる。
