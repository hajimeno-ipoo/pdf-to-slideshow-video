import test from 'node:test';
import assert from 'node:assert/strict';

import { patchMp4AvcColorToBt709TvInPlace } from '../utils/mp4AvcColorPatch.js';

const AVC_HIGH_PROFILE_IDS = new Set([
  100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135, 144,
]);

const u32be = (n) => {
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
};

const u64be = (n) => {
  const hi = Math.floor(n / 2 ** 32);
  const lo = n >>> 0;
  return new Uint8Array([
    (hi >>> 24) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 8) & 0xff,
    hi & 0xff,
    (lo >>> 24) & 0xff,
    (lo >>> 16) & 0xff,
    (lo >>> 8) & 0xff,
    lo & 0xff,
  ]);
};

const fourcc = (type) => {
  assert.equal(type.length, 4);
  return new Uint8Array([
    type.charCodeAt(0) & 0xff,
    type.charCodeAt(1) & 0xff,
    type.charCodeAt(2) & 0xff,
    type.charCodeAt(3) & 0xff,
  ]);
};

const concatBytes = (...parts) => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const makeBox = (type, payload, options = {}) => {
  const t = fourcc(type);
  const p = payload || new Uint8Array();

  if (options.large) {
    const size = 16 + p.length;
    return concatBytes(u32be(1), t, u64be(size), p);
  }

  const size = 8 + p.length;
  return concatBytes(u32be(size), t, p);
};

class BitWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.bits = 0;
  }

  writeBit(bit) {
    this.current = (this.current << 1) | (bit ? 1 : 0);
    this.bits += 1;
    if (this.bits === 8) {
      this.bytes.push(this.current & 0xff);
      this.current = 0;
      this.bits = 0;
    }
  }

  writeBits(value, n) {
    for (let i = n - 1; i >= 0; i--) {
      this.writeBit((value >> i) & 1);
    }
  }

  writeUE(v) {
    const value = Number(v);
    assert.ok(Number.isInteger(value) && value >= 0);
    const codeNum = value + 1;
    const leadingZeros = Math.floor(Math.log2(codeNum));
    for (let i = 0; i < leadingZeros; i++) this.writeBit(0);
    this.writeBit(1);
    this.writeBits(codeNum - (1 << leadingZeros), leadingZeros);
  }

  writeSE(v) {
    const value = Number(v);
    assert.ok(Number.isInteger(value));
    if (value === 0) return this.writeUE(0);
    const ue = value > 0 ? (value * 2 - 1) : (-value * 2);
    return this.writeUE(ue);
  }

  finishRbsp() {
    this.writeBit(1); // rbsp_stop_one_bit
    while (this.bits !== 0) this.writeBit(0);
    return new Uint8Array(this.bytes);
  }
}

const buildSpsNal = ({
  profileIdc,
  levelIdc,
  fullRangeFlag,
  colourPrimaries,
  transferCharacteristics,
  matrixCoefficients,
  scalingMatrix,
  scalingList0Deltas,
  chromaFormatIdc,
  separateColourPlaneFlag,
  picOrderCntType,
  numRefFramesInCycle,
  offsetForRefFrames,
  frameMbsOnlyFlag,
  frameCroppingFlag,
  vuiParametersPresentFlag,
  aspectRatioInfoPresentFlag,
  aspectRatioIdc,
  sarWidth,
  sarHeight,
  overscanInfoPresentFlag,
  overscanAppropriateFlag,
  videoSignalTypePresentFlag,
  colourDescriptionPresentFlag,
}) => {
  const bw = new BitWriter();
  bw.writeBits(profileIdc, 8);
  bw.writeBits(0, 8); // constraint flags + reserved
  bw.writeBits(levelIdc, 8);
  bw.writeUE(0); // seq_parameter_set_id

  if (AVC_HIGH_PROFILE_IDS.has(profileIdc)) {
    const cf = chromaFormatIdc ?? 1;
    bw.writeUE(cf); // chroma_format_idc
    if (cf === 3) bw.writeBit(separateColourPlaneFlag ? 1 : 0);
    bw.writeUE(0); // bit_depth_luma_minus8
    bw.writeUE(0); // bit_depth_chroma_minus8
    bw.writeBit(0); // qpprime_y_zero_transform_bypass_flag
    bw.writeBit(scalingMatrix ? 1 : 0); // seq_scaling_matrix_present_flag
    if (scalingMatrix) {
      const listCount = cf !== 3 ? 8 : 12;
      for (let i = 0; i < listCount; i++) {
        const present = i === 0 && Array.isArray(scalingList0Deltas) ? 1 : 0;
        bw.writeBit(present); // seq_scaling_list_present_flag[i]
        if (present) {
          for (const delta of scalingList0Deltas) bw.writeSE(delta);
        }
      }
    }
  }

  bw.writeUE(0); // log2_max_frame_num_minus4
  const pocType = picOrderCntType ?? 0;
  bw.writeUE(pocType); // pic_order_cnt_type
  if (pocType === 0) {
    bw.writeUE(0); // log2_max_pic_order_cnt_lsb_minus4
  } else if (pocType === 1) {
    bw.writeBit(0); // delta_pic_order_always_zero_flag
    bw.writeSE(0); // offset_for_non_ref_pic
    bw.writeSE(0); // offset_for_top_to_bottom_field
    const cycle = numRefFramesInCycle ?? 0;
    bw.writeUE(cycle); // num_ref_frames_in_pic_order_cnt_cycle
    for (let i = 0; i < cycle; i++) {
      const v = Array.isArray(offsetForRefFrames) ? (offsetForRefFrames[i] ?? 0) : 0;
      bw.writeSE(v);
    }
  }
  bw.writeUE(0); // max_num_ref_frames
  bw.writeBit(0); // gaps_in_frame_num_value_allowed_flag
  bw.writeUE(0); // pic_width_in_mbs_minus1
  bw.writeUE(0); // pic_height_in_map_units_minus1
  const frameOnly = frameMbsOnlyFlag ?? 1;
  bw.writeBit(frameOnly ? 1 : 0); // frame_mbs_only_flag
  if (!frameOnly) bw.writeBit(0); // mb_adaptive_frame_field_flag
  bw.writeBit(1); // direct_8x8_inference_flag
  const cropping = !!frameCroppingFlag;
  bw.writeBit(cropping ? 1 : 0); // frame_cropping_flag
  if (cropping) {
    bw.writeUE(0);
    bw.writeUE(0);
    bw.writeUE(0);
    bw.writeUE(0);
  }

  const hasVui = vuiParametersPresentFlag !== undefined ? !!vuiParametersPresentFlag : true;
  bw.writeBit(hasVui ? 1 : 0); // vui_parameters_present_flag

  if (hasVui) {
    const ar = !!aspectRatioInfoPresentFlag;
    const os = !!overscanInfoPresentFlag;
    const vs = videoSignalTypePresentFlag !== undefined ? !!videoSignalTypePresentFlag : true;
    const cd = colourDescriptionPresentFlag !== undefined ? !!colourDescriptionPresentFlag : true;

    bw.writeBit(ar ? 1 : 0); // aspect_ratio_info_present_flag
    if (ar) {
      const idc = aspectRatioIdc ?? 1;
      bw.writeBits(idc, 8);
      if (idc === 255) {
        bw.writeBits((sarWidth ?? 1) & 0xffff, 16);
        bw.writeBits((sarHeight ?? 1) & 0xffff, 16);
      }
    }

    bw.writeBit(os ? 1 : 0); // overscan_info_present_flag
    if (os) bw.writeBit(overscanAppropriateFlag ? 1 : 0);

    bw.writeBit(vs ? 1 : 0); // video_signal_type_present_flag
    if (vs) {
      bw.writeBits(5, 3); // video_format (unspecified)
      bw.writeBit(fullRangeFlag ? 1 : 0); // video_full_range_flag
      bw.writeBit(cd ? 1 : 0); // colour_description_present_flag
      if (cd) {
        bw.writeBits(colourPrimaries, 8);
        bw.writeBits(transferCharacteristics, 8);
        bw.writeBits(matrixCoefficients, 8);
      }
    }
  }

  const rbsp = bw.finishRbsp();
  const nal = concatBytes(new Uint8Array([0x67]), rbsp, new Uint8Array([0x00, 0x00, 0x03, 0x00]));
  return nal;
};

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitOffset = 0;
  }

  readBit() {
    if (this.bitOffset >= this.bytes.length * 8) throw new Error('eof');
    const b = this.bytes[this.bitOffset >> 3];
    const out = (b >> (7 - (this.bitOffset & 7))) & 1;
    this.bitOffset += 1;
    return out;
  }

  readBits(n) {
    let out = 0;
    for (let i = 0; i < n; i++) out = (out << 1) | this.readBit();
    return out >>> 0;
  }

  readUE() {
    let leadingZeros = 0;
    while (this.readBit() === 0) {
      leadingZeros += 1;
      if (leadingZeros > 31) throw new Error('ue too large');
    }
    const info = leadingZeros ? this.readBits(leadingZeros) : 0;
    return ((1 << leadingZeros) - 1 + info) >>> 0;
  }

  readSE() {
    const ue = this.readUE();
    const m = (ue + 1) >> 1;
    return ue % 2 === 0 ? -m : m;
  }
}

const removeEmulationPreventionBytes = (bytes) => {
  const out = new Uint8Array(bytes.length);
  let outLen = 0;
  let zeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (zeros === 2 && b === 0x03) {
      zeros = 0;
      continue;
    }
    out[outLen++] = b;
    zeros = b === 0 ? zeros + 1 : 0;
  }
  return out.subarray(0, outLen);
};

const skipScalingList = (br, sizeOfScalingList) => {
  let lastScale = 8;
  let nextScale = 8;
  for (let j = 0; j < sizeOfScalingList; j++) {
    if (nextScale !== 0) {
      const deltaScale = br.readSE();
      nextScale = (lastScale + deltaScale + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
};

const parseSpsVuiColorInfo = (spsNal) => {
  assert.ok(spsNal instanceof Uint8Array);
  assert.equal(spsNal[0] & 0x1f, 7);

  const rbsp = removeEmulationPreventionBytes(spsNal.subarray(1));
  const br = new BitReader(rbsp);

  const profileIdc = br.readBits(8);
  br.readBits(8);
  br.readBits(8);
  br.readUE();

  let chromaFormatIdc = 1;
  if (AVC_HIGH_PROFILE_IDS.has(profileIdc)) {
    chromaFormatIdc = br.readUE();
    if (chromaFormatIdc === 3) br.readBit();
    br.readUE();
    br.readUE();
    br.readBit();
    const scaling = br.readBit();
    if (scaling) {
      const count = chromaFormatIdc !== 3 ? 8 : 12;
      for (let i = 0; i < count; i++) {
        const present = br.readBit();
        if (present) skipScalingList(br, i < 6 ? 16 : 64);
      }
    }
  }

  br.readUE();
  const pocType = br.readUE();
  if (pocType === 0) br.readUE();
  else if (pocType === 1) {
    br.readBit();
    br.readSE();
    br.readSE();
    const n = br.readUE();
    for (let i = 0; i < n; i++) br.readSE();
  }

  br.readUE();
  br.readBit();
  br.readUE();
  br.readUE();
  const frameOnly = br.readBit();
  if (!frameOnly) br.readBit();
  br.readBit();
  const cropping = br.readBit();
  if (cropping) {
    br.readUE();
    br.readUE();
    br.readUE();
    br.readUE();
  }

  const vuiPresent = br.readBit();
  assert.equal(vuiPresent, 1);

  const aspect = br.readBit();
  if (aspect) {
    const idc = br.readBits(8);
    if (idc === 255) {
      br.readBits(16);
      br.readBits(16);
    }
  }
  const overscan = br.readBit();
  if (overscan) br.readBit();
  const videoSig = br.readBit();
  if (!videoSig) {
    return { hasVideoSignal: false };
  }
  br.readBits(3);
  const fullRange = br.readBit();
  const colourDesc = br.readBit();
  if (!colourDesc) {
    return { hasVideoSignal: true, fullRange, hasColourDesc: false };
  }

  const colourPrimaries = br.readBits(8);
  const transferCharacteristics = br.readBits(8);
  const matrixCoefficients = br.readBits(8);

  return { hasVideoSignal: true, fullRange, hasColourDesc: true, colourPrimaries, transferCharacteristics, matrixCoefficients };
};

const buildMp4WithNestedAvcC = ({ spsNal, profileIdc, levelIdc }) => {
  const ppsNal = new Uint8Array([0x68, 0x00]);

  const avcCBody = concatBytes(
    new Uint8Array([1, profileIdc & 0xff, 0x00, levelIdc & 0xff, 0xff, 0xe1]),
    new Uint8Array([(spsNal.length >>> 8) & 0xff, spsNal.length & 0xff]),
    spsNal,
    new Uint8Array([1, (ppsNal.length >>> 8) & 0xff, ppsNal.length & 0xff]),
    ppsNal
  );

  const avcCBox = makeBox('avcC', avcCBody);
  const avc1Payload = concatBytes(new Uint8Array(78), avcCBox);
  const avc1Box = makeBox('avc1', avc1Payload);
  const stsdPayload = concatBytes(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), avc1Box);
  const stsdBox = makeBox('stsd', stsdPayload);

  const stbl = makeBox('stbl', stsdBox);
  const minf = makeBox('minf', stbl);
  const mdia = makeBox('mdia', minf);
  const trak = makeBox('trak', mdia);
  const moov = makeBox('moov', trak, { large: true });

  return moov;
};

const extractFirstSpsNalFromMp4 = (mp4Bytes) => {
  const needle = new Uint8Array([0x61, 0x76, 0x63, 0x43]); // 'avcC'
  for (let i = 4; i + 4 <= mp4Bytes.length; i++) {
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (mp4Bytes[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    const boxStart = i - 4;
    if (boxStart < 0) continue;
    const size = ((mp4Bytes[boxStart] << 24) |
      (mp4Bytes[boxStart + 1] << 16) |
      (mp4Bytes[boxStart + 2] << 8) |
      mp4Bytes[boxStart + 3]) >>> 0;
    if (size < 16 || boxStart + size > mp4Bytes.length) continue;

    let p = boxStart + 8;
    if (mp4Bytes[p] !== 1) continue;
    p += 4;
    p += 1;
    const numSps = mp4Bytes[p] & 0x1f;
    p += 1;
    if (numSps < 1) continue;

    const spsLen = ((mp4Bytes[p] << 8) | mp4Bytes[p + 1]) >>> 0;
    p += 2;
    return mp4Bytes.subarray(p, p + spsLen);
  }
  throw new Error('avcC/sps not found');
};

test('patchMp4AvcColorToBt709TvInPlace: patches full-range + sRGB transfer to bt709/tv', () => {
  const profileIdc = 100;
  const levelIdc = 30;

  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    scalingMatrix: true,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);

  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), true);

  const patchedSps = extractFirstSpsNalFromMp4(new Uint8Array(buf));
  const info = parseSpsVuiColorInfo(patchedSps);
  assert.equal(info.hasVideoSignal, true);
  assert.equal(info.hasColourDesc, true);
  assert.equal(info.fullRange, 0);
  assert.equal(info.colourPrimaries, 1);
  assert.equal(info.transferCharacteristics, 1);
  assert.equal(info.matrixCoefficients, 1);

  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), false);
});

test('patchMp4AvcColorToBt709TvInPlace: covers SPS branches (chroma_format_idc=3, scaling list, POC type 1, interlaced, crop, sar, overscan)', () => {
  const profileIdc = 100;
  const levelIdc = 30;

  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    chromaFormatIdc: 3,
    separateColourPlaneFlag: 0,
    scalingMatrix: true,
    scalingList0Deltas: [0, -8],
    picOrderCntType: 1,
    numRefFramesInCycle: 1,
    offsetForRefFrames: [0],
    frameMbsOnlyFlag: 0,
    frameCroppingFlag: true,
    vuiParametersPresentFlag: true,
    aspectRatioInfoPresentFlag: true,
    aspectRatioIdc: 255,
    sarWidth: 1,
    sarHeight: 1,
    overscanInfoPresentFlag: true,
    overscanAppropriateFlag: 0,
    videoSignalTypePresentFlag: true,
    colourDescriptionPresentFlag: true,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);

  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), true);

  const patchedSps = extractFirstSpsNalFromMp4(new Uint8Array(buf));
  const info = parseSpsVuiColorInfo(patchedSps);
  assert.equal(info.hasVideoSignal, true);
  assert.equal(info.hasColourDesc, true);
  assert.equal(info.fullRange, 0);
  assert.equal(info.colourPrimaries, 1);
  assert.equal(info.transferCharacteristics, 1);
  assert.equal(info.matrixCoefficients, 1);
});

test('patchMp4AvcColorToBt709TvInPlace: colour_description absent still patches full-range', () => {
  const profileIdc = 66;
  const levelIdc = 30;
  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    vuiParametersPresentFlag: true,
    videoSignalTypePresentFlag: true,
    colourDescriptionPresentFlag: false,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const bytes = mp4.slice();
  assert.equal(patchMp4AvcColorToBt709TvInPlace(bytes), true);
  const patchedSps = extractFirstSpsNalFromMp4(bytes);
  const info = parseSpsVuiColorInfo(patchedSps);
  assert.equal(info.hasVideoSignal, true);
  assert.equal(info.hasColourDesc, false);
  assert.equal(info.fullRange, 0);
});

test('patchMp4AvcColorToBt709TvInPlace: video_signal_type absent -> false', () => {
  const profileIdc = 66;
  const levelIdc = 30;
  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    vuiParametersPresentFlag: true,
    videoSignalTypePresentFlag: false,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), false);
});

test('patchMp4AvcColorToBt709TvInPlace: VUI absent -> false', () => {
  const profileIdc = 66;
  const levelIdc = 30;
  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    vuiParametersPresentFlag: false,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), false);
});

test('patchMp4AvcColorToBt709TvInPlace: meta container + DataView input works', () => {
  const profileIdc = 100;
  const levelIdc = 30;
  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    scalingMatrix: false,
  });

  const avcCBody = concatBytes(
    new Uint8Array([1, profileIdc & 0xff, 0x00, levelIdc & 0xff, 0xff, 0xe1]),
    new Uint8Array([(spsNal.length >>> 8) & 0xff, spsNal.length & 0xff]),
    spsNal
  );
  const avcCBox = makeBox('avcC', avcCBody);
  const meta = makeBox('meta', concatBytes(new Uint8Array([0, 0, 0, 0]), avcCBox));

  const buf = meta.buffer.slice(meta.byteOffset, meta.byteOffset + meta.byteLength);
  const view = new DataView(buf);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(view), true);
});

test('patchMp4AvcColorToBt709TvInPlace: size=0 box does not throw', () => {
  const size0Free = concatBytes(u32be(0), fourcc('free'), new Uint8Array([1, 2, 3, 4]));
  assert.equal(patchMp4AvcColorToBt709TvInPlace(size0Free), false);
});

test('patchMp4AvcColorToBt709TvInPlace: invalid SPS is safely ignored (ue too large / eof)', () => {
  const badSpsTooManyZeros = concatBytes(
    new Uint8Array([0x67, 0x42, 0x00, 0x1e]),
    new Uint8Array(8).fill(0x00)
  );
  const badSpsEof = new Uint8Array([0x67, 0x42]);

  const buildTopAvcC = (spsNal) => {
    const body = concatBytes(
      new Uint8Array([1, 66, 0, 30, 0xff, 0xe1]),
      new Uint8Array([(spsNal.length >>> 8) & 0xff, spsNal.length & 0xff]),
      spsNal
    );
    return makeBox('avcC', body);
  };

  assert.equal(patchMp4AvcColorToBt709TvInPlace(buildTopAvcC(badSpsTooManyZeros)), false);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(buildTopAvcC(badSpsEof)), false);
});

test('patchMp4AvcColorToBt709TvInPlace: no avcC -> false', () => {
  const mp4 = makeBox('free', new Uint8Array([1, 2, 3, 4]));
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), false);
});

test('patchMp4AvcColorToBt709TvInPlace: invalid input -> false', () => {
  assert.equal(patchMp4AvcColorToBt709TvInPlace(null), false);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(undefined), false);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(123), false);
});

test('patchMp4AvcColorToBt709TvInPlace: aspect_ratio_idc != 255 path', () => {
  const profileIdc = 100;
  const levelIdc = 30;

  const spsNal = buildSpsNal({
    profileIdc,
    levelIdc,
    fullRangeFlag: 1,
    colourPrimaries: 13,
    transferCharacteristics: 13,
    matrixCoefficients: 13,
    scalingMatrix: false,
    vuiParametersPresentFlag: true,
    aspectRatioInfoPresentFlag: true,
    aspectRatioIdc: 1,
    overscanInfoPresentFlag: false,
    videoSignalTypePresentFlag: true,
    colourDescriptionPresentFlag: true,
  });

  const mp4 = buildMp4WithNestedAvcC({ spsNal, profileIdc, levelIdc });
  const buf = mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength);
  assert.equal(patchMp4AvcColorToBt709TvInPlace(buf), true);
});

test('patchMp4AvcColorToBt709TvInPlace: avcC configVersion != 1 -> false', () => {
  const avcCBox = makeBox('avcC', new Uint8Array([0, 0, 0, 0, 0, 0]));
  assert.equal(patchMp4AvcColorToBt709TvInPlace(avcCBox), false);
});

test('patchMp4AvcColorToBt709TvInPlace: truncated avcC is ignored', () => {
  const truncated = concatBytes(u32be(12), fourcc('avcC'), new Uint8Array([1, 2, 3, 4]));
  assert.equal(patchMp4AvcColorToBt709TvInPlace(truncated), false);
});

test('patchMp4AvcColorToBt709TvInPlace: invalid box size does not throw', () => {
  const badSize = concatBytes(u32be(4), fourcc('free'), new Uint8Array([1, 2, 3, 4]));
  assert.equal(patchMp4AvcColorToBt709TvInPlace(badSize), false);
});

test('patchMp4AvcColorToBt709TvInPlace: too small buffer -> false', () => {
  assert.equal(patchMp4AvcColorToBt709TvInPlace(new Uint8Array([1, 2, 3])), false);
});

test('patchMp4AvcColorToBt709TvInPlace: meta with no children is ok', () => {
  const metaEmpty = makeBox('meta', new Uint8Array([0, 0, 0, 0]));
  assert.equal(patchMp4AvcColorToBt709TvInPlace(metaEmpty), false);
});
