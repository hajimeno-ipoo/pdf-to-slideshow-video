const MP4_CONTAINER_TYPES = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'edts',
  'dinf',
  'udta',
  'meta',
  'ilst',
  'moof',
  'traf',
  'mfra',
  'tref',
  'mvex',
  'stsd',
  'avc1',
  'encv',
]);

const AVC_HIGH_PROFILE_IDS = new Set([
  100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135, 144,
]);

const readU32 = (bytes, offset) => {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
};

const readU64 = (bytes, offset) => {
  const hi = readU32(bytes, offset);
  const lo = readU32(bytes, offset + 4);
  return hi * 2 ** 32 + lo;
};

const readU16 = (bytes, offset) => {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
};

const readType = (bytes, offset) => {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
};

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitOffset = 0;
  }

  get position() {
    return this.bitOffset;
  }

  readBit() {
    if (this.bitOffset >= this.bytes.length * 8) {
      throw new Error('unexpected eof');
    }
    const byte = this.bytes[this.bitOffset >> 3];
    const bit = (byte >> (7 - (this.bitOffset & 7))) & 1;
    this.bitOffset += 1;
    return bit;
  }

  readBits(n) {
    let out = 0;
    for (let i = 0; i < n; i++) {
      out = (out << 1) | this.readBit();
    }
    return out >>> 0;
  }

  readUE() {
    let leadingZeros = 0;
    while (this.readBit() === 0) {
      leadingZeros += 1;
      if (leadingZeros > 31) {
        throw new Error('ue too large');
      }
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

const setBitsInNal = (nalBytes, rbspByteToNalByte, bitPos, bitLen, value) => {
  const v = value >>> 0;
  for (let i = 0; i < bitLen; i++) {
    const bit = (v >> (bitLen - 1 - i)) & 1;
    const bitIndex = bitPos + i;
    const rbspByteIndex = bitIndex >> 3;
    const bitInByte = 7 - (bitIndex & 7);
    const nalByteIndex = rbspByteToNalByte[rbspByteIndex];
    const mask = 1 << bitInByte;
    if (bit) {
      nalBytes[nalByteIndex] |= mask;
    } else {
      nalBytes[nalByteIndex] &= ~mask;
    }
  }
};

const buildRbspByteMapFromNalPayload = (nalBytes) => {
  const rbsp = new Uint8Array(nalBytes.length);
  const map = new Int32Array(nalBytes.length);
  let rbspLen = 0;
  let zeros = 0;

  for (let i = 0; i < nalBytes.length; i++) {
    const b = nalBytes[i];
    if (zeros === 2 && b === 0x03) {
      zeros = 0;
      continue;
    }
    rbsp[rbspLen] = b;
    map[rbspLen] = i;
    rbspLen += 1;
    zeros = b === 0 ? zeros + 1 : 0;
  }

  return { rbsp: rbsp.subarray(0, rbspLen), rbspToNal: map.subarray(0, rbspLen) };
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

const patchSpsNalToBt709TvInPlace = (spsNalBytes) => {
  if (!(spsNalBytes instanceof Uint8Array)) return false;
  if (spsNalBytes.length < 2) return false;

  const nalType = spsNalBytes[0] & 0x1f;
  if (nalType !== 7) return false;

  const payload = spsNalBytes.subarray(1);
  const { rbsp, rbspToNal } = buildRbspByteMapFromNalPayload(payload);
  const br = new BitReader(rbsp);

  try {
    const profileIdc = br.readBits(8);
    br.readBits(8); // constraint_set flags + reserved
    br.readBits(8); // level_idc
    br.readUE(); // seq_parameter_set_id

    let chromaFormatIdc = 1;
    if (AVC_HIGH_PROFILE_IDS.has(profileIdc)) {
      chromaFormatIdc = br.readUE();
      if (chromaFormatIdc === 3) {
        br.readBit(); // separate_colour_plane_flag
      }
      br.readUE(); // bit_depth_luma_minus8
      br.readUE(); // bit_depth_chroma_minus8
      br.readBit(); // qpprime_y_zero_transform_bypass_flag
      const seqScalingMatrixPresentFlag = br.readBit();
      if (seqScalingMatrixPresentFlag) {
        const scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
        for (let i = 0; i < scalingListCount; i++) {
          const seqScalingListPresentFlag = br.readBit();
          if (seqScalingListPresentFlag) {
            skipScalingList(br, i < 6 ? 16 : 64);
          }
        }
      }
    }

    br.readUE(); // log2_max_frame_num_minus4
    const picOrderCntType = br.readUE();
    if (picOrderCntType === 0) {
      br.readUE(); // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      br.readBit(); // delta_pic_order_always_zero_flag
      br.readSE(); // offset_for_non_ref_pic
      br.readSE(); // offset_for_top_to_bottom_field
      const numRefFramesInCycle = br.readUE();
      for (let i = 0; i < numRefFramesInCycle; i++) {
        br.readSE(); // offset_for_ref_frame[i]
      }
    }

    br.readUE(); // max_num_ref_frames
    br.readBit(); // gaps_in_frame_num_value_allowed_flag
    br.readUE(); // pic_width_in_mbs_minus1
    br.readUE(); // pic_height_in_map_units_minus1
    const frameMbsOnlyFlag = br.readBit();
    if (!frameMbsOnlyFlag) {
      br.readBit(); // mb_adaptive_frame_field_flag
    }
    br.readBit(); // direct_8x8_inference_flag
    const frameCroppingFlag = br.readBit();
    if (frameCroppingFlag) {
      br.readUE();
      br.readUE();
      br.readUE();
      br.readUE();
    }

    const vuiParametersPresentFlag = br.readBit();
    if (!vuiParametersPresentFlag) return false;

    const aspectRatioInfoPresentFlag = br.readBit();
    if (aspectRatioInfoPresentFlag) {
      const aspectRatioIdc = br.readBits(8);
      if (aspectRatioIdc === 255) {
        br.readBits(16); // sar_width
        br.readBits(16); // sar_height
      }
    }

    const overscanInfoPresentFlag = br.readBit();
    if (overscanInfoPresentFlag) {
      br.readBit(); // overscan_appropriate_flag
    }

    const videoSignalTypePresentFlag = br.readBit();
    if (!videoSignalTypePresentFlag) return false;

    br.readBits(3); // video_format

    const fullRangeFlagBitPos = br.position;
    const fullRangeFlag = br.readBit();

    const colourDescriptionPresentFlag = br.readBit();

    let changed = false;
    if (fullRangeFlag !== 0) {
      setBitsInNal(payload, rbspToNal, fullRangeFlagBitPos, 1, 0);
      changed = true;
    }

    if (colourDescriptionPresentFlag) {
      const colourPrimariesBitPos = br.position;
      const colourPrimaries = br.readBits(8);
      const transferBitPos = br.position;
      const transfer = br.readBits(8);
      const matrixBitPos = br.position;
      const matrix = br.readBits(8);

      if (colourPrimaries !== 1) {
        setBitsInNal(payload, rbspToNal, colourPrimariesBitPos, 8, 1);
        changed = true;
      }
      if (transfer !== 1) {
        setBitsInNal(payload, rbspToNal, transferBitPos, 8, 1);
        changed = true;
      }
      if (matrix !== 1) {
        setBitsInNal(payload, rbspToNal, matrixBitPos, 8, 1);
        changed = true;
      }
    }

    return changed;
  } catch (_err) {
    return false;
  }
};

const patchAvcCBoxInPlace = (bytes, boxStart, headerSize, boxEnd) => {
  let p = boxStart + headerSize;
  if (p + 6 > boxEnd) return false;

  const configurationVersion = bytes[p];
  if (configurationVersion !== 1) return false;

  p += 4; // version, profile, compat, level
  p += 1; // lengthSizeMinusOne
  const numSps = bytes[p] & 0x1f;
  p += 1;

  let changed = false;
  for (let i = 0; i < numSps; i++) {
    if (p + 2 > boxEnd) return changed;
    const spsLen = readU16(bytes, p);
    p += 2;
    if (p + spsLen > boxEnd) return changed;
    const spsNal = bytes.subarray(p, p + spsLen);
    if (patchSpsNalToBt709TvInPlace(spsNal)) {
      changed = true;
    }
    p += spsLen;
  }

  return changed;
};

const scanBoxesAndPatch = (bytes, start, end) => {
  let changed = false;
  let offset = start;

  while (offset + 8 <= end) {
    const size32 = readU32(bytes, offset);
    const type = readType(bytes, offset + 4);

    let headerSize = 8;
    let size = size32;

    if (size32 === 1) {
      if (offset + 16 > end) break;
      size = readU64(bytes, offset + 8);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - offset;
    }

    if (!Number.isFinite(size) || size < headerSize || offset + size > end) break;

    const boxStart = offset;
    const boxEnd = offset + size;

    if (type === 'avcC') {
      if (patchAvcCBoxInPlace(bytes, boxStart, headerSize, boxEnd)) {
        changed = true;
      }
    }

    if (MP4_CONTAINER_TYPES.has(type)) {
      let childStart = boxStart + headerSize;
      if (type === 'stsd') {
        childStart = boxStart + headerSize + 8; // version/flags + entry_count
      } else if (type === 'avc1' || type === 'encv') {
        childStart = boxStart + headerSize + 78; // VisualSampleEntry
      } else if (type === 'meta') {
        childStart = boxStart + headerSize + 4; // version/flags
      }

      if (childStart < boxEnd) {
        if (scanBoxesAndPatch(bytes, childStart, boxEnd)) {
          changed = true;
        }
      }
    }

    offset = boxEnd;
  }

  return changed;
};

export const patchMp4AvcColorToBt709TvInPlace = (buffer) => {
  let bytes = null;
  if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  if (!bytes || bytes.length < 8) return false;
  return scanBoxesAndPatch(bytes, 0, bytes.length);
};

