const SAMPLE_RATE_INDEX = new Map([
  [96000, 0],
  [88200, 1],
  [64000, 2],
  [48000, 3],
  [44100, 4],
  [32000, 5],
  [24000, 6],
  [22050, 7],
  [16000, 8],
  [12000, 9],
  [11025, 10],
  [8000, 11],
  [7350, 12]
]);

export const createAacLcAudioSpecificConfig = (sampleRate, numberOfChannels) => {
  const sr = Number(sampleRate);
  const ch = Number(numberOfChannels);

  if (!Number.isFinite(sr) || sr <= 0) throw new Error('invalid sampleRate');
  if (!Number.isFinite(ch) || ch <= 0 || ch > 7) throw new Error('invalid numberOfChannels');

  const samplingFrequencyIndex = SAMPLE_RATE_INDEX.get(sr);
  if (samplingFrequencyIndex === undefined) throw new Error('unsupported sampleRate');

  // AAC-LC
  const audioObjectType = 2;
  const b0 = (audioObjectType << 3) | (samplingFrequencyIndex >> 1);
  const b1 = ((samplingFrequencyIndex & 1) << 7) | (ch << 3);
  return new Uint8Array([b0 & 0xff, b1 & 0xff]);
};

