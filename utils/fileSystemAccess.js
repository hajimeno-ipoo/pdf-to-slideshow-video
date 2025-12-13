export const isFileSystemAccessSupported = (win) => {
  return (
    !!win &&
    !!win.isSecureContext &&
    typeof win.showSaveFilePicker === 'function'
  );
};

export const getVideoSaveFilePickerOptions = (format) => {
  const isMov = format === 'mov';
  return {
    suggestedName: isMov ? 'slideshow.mov' : 'slideshow.mp4',
    types: [
      {
        description: isMov ? 'MOV Video' : 'MP4 Video',
        accept: isMov ? { 'video/quicktime': ['.mov'] } : { 'video/mp4': ['.mp4'] }
      }
    ]
  };
};

export const ensureWritePermission = async (handle) => {
  if (!handle) return false;
  try {
    const queryPermission = handle?.queryPermission;
    const requestPermission = handle?.requestPermission;

    if (typeof queryPermission === 'function') {
      const q = await queryPermission.call(handle, { mode: 'readwrite' });
      if (q === 'granted') return true;
    }

    if (typeof requestPermission === 'function') {
      const r = await requestPermission.call(handle, { mode: 'readwrite' });
      return r === 'granted';
    }

    return true;
  } catch {
    return false;
  }
};
