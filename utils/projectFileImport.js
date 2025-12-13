export const getProjectImportError = (file) => {
  if (!file) return 'ファイルが選ばれてないよ。';

  const size = Number(file.size);
  if (Number.isFinite(size) && size <= 0) return 'ファイルが空っぽだよ。';

  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  const isJson =
    name.endsWith('.json') || type === 'application/json' || type === 'text/json';
  if (!isJson) return 'プロジェクト（.json）のファイルを選んでね。';

  return null;
};

