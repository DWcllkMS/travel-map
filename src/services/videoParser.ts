export interface ParsedVideoMeta {
  lat?: number;
  lon?: number;
  alt?: number;
  takenAt?: string;
}

export function parseIso6709(str: string): { lat: number; lon: number; alt?: number } | null {
  const match = str.match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);
  const alt = match[3] ? parseFloat(match[3]) : undefined;
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon, alt };
}

function parseMvhdDate(buffer: Uint8Array, offset: number, size: number): string | undefined {
  if (size < 12) return undefined;
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, size);
  const version = view.getUint8(0);
  let creationSeconds = 0;
  if (version === 0) {
    creationSeconds = view.getUint32(4);
  } else if (version === 1) {
    const high = view.getUint32(4);
    const low = view.getUint32(8);
    creationSeconds = high * 4294967296 + low;
  }
  if (!creationSeconds) return undefined;
  const epochDiff = 2082844800;
  const unixMs = (creationSeconds - epochDiff) * 1000;
  if (unixMs > 0 && unixMs < 4102444800000) {
    return new Date(unixMs).toISOString();
  }
  return undefined;
}

function parseUdtaOrMeta(buffer: Uint8Array, offset: number, size: number): { lat?: number; lon?: number; alt?: number } | null {
  const textDecoder = new TextDecoder('latin1');
  const slice = buffer.subarray(offset, offset + size);
  const text = textDecoder.decode(slice);

  const locMatch = text.match(/[+-]\d{2,3}(?:\.\d+)?[+-]\d{2,3}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?\/?/);
  if (locMatch) {
    return parseIso6709(locMatch[0]);
  }
  return null;
}

export function parseMoovBuffer(buffer: Uint8Array): ParsedVideoMeta {
  const result: ParsedVideoMeta = {};
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    let atomSize = view.getUint32(offset);
    const atomType = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7]
    );

    if (atomSize === 1 && offset + 16 <= buffer.length) {
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      atomSize = high * 4294967296 + low;
      offset += 8;
    } else if (atomSize === 0) {
      atomSize = buffer.length - offset;
    }

    if (atomSize < 8 || offset + atomSize > buffer.length) {
      break;
    }

    const payloadOffset = offset + 8;
    const payloadSize = atomSize - 8;

    if (atomType === 'mvhd') {
      const date = parseMvhdDate(buffer, payloadOffset, payloadSize);
      if (date) result.takenAt = date;
    } else if (atomType === 'udta' || atomType === 'meta') {
      const loc = parseUdtaOrMeta(buffer, payloadOffset, payloadSize);
      if (loc) {
        result.lat = loc.lat;
        result.lon = loc.lon;
        if (loc.alt !== undefined) result.alt = loc.alt;
      }
    } else if (atomType === 'trak' || atomType === 'mdia' || atomType === 'minf') {
      const subResult = parseMoovBuffer(buffer.subarray(payloadOffset, payloadOffset + payloadSize));
      if (!result.takenAt && subResult.takenAt) result.takenAt = subResult.takenAt;
      if (result.lat === undefined && subResult.lat !== undefined) {
        result.lat = subResult.lat;
        result.lon = subResult.lon;
        result.alt = subResult.alt;
      }
    }

    offset += atomSize;
  }

  return result;
}

export async function parseMp4File(file: File | Blob | Uint8Array | ArrayBuffer): Promise<ParsedVideoMeta> {
  if (file instanceof Uint8Array) {
    return parseMoovFromFullBytes(file);
  }
  if (file instanceof ArrayBuffer) {
    return parseMoovFromFullBytes(new Uint8Array(file));
  }

  const fileSize = file.size;
  let offset = 0;

  while (offset < fileSize) {
    const headSlice = file.slice(offset, Math.min(offset + 16, fileSize));
    const headBuf = new Uint8Array(await headSlice.arrayBuffer());
    if (headBuf.length < 8) break;

    const view = new DataView(headBuf.buffer);
    let atomSize = view.getUint32(0);
    const atomType = String.fromCharCode(headBuf[4], headBuf[5], headBuf[6], headBuf[7]);

    if (atomSize === 1) {
      if (headBuf.length < 16) break;
      const high = view.getUint32(8);
      const low = view.getUint32(12);
      atomSize = high * 4294967296 + low;
    } else if (atomSize === 0) {
      atomSize = fileSize - offset;
    }

    if (atomType === 'moov') {
      const moovSlice = file.slice(offset + 8, offset + atomSize);
      const moovBuf = new Uint8Array(await moovSlice.arrayBuffer());
      return parseMoovBuffer(moovBuf);
    }

    if (atomSize <= 0) break;
    offset += atomSize;

    if (offset + 8 >= fileSize) {
      const tailSize = Math.min(2 * 1024 * 1024, fileSize);
      const tailSlice = file.slice(fileSize - tailSize, fileSize);
      const tailBuf = new Uint8Array(await tailSlice.arrayBuffer());
      return findAndParseMoovInBytes(tailBuf);
    }
  }

  return {};
}

function parseMoovFromFullBytes(bytes: Uint8Array): ParsedVideoMeta {
  return findAndParseMoovInBytes(bytes);
}

function findAndParseMoovInBytes(bytes: Uint8Array): ParsedVideoMeta {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (size === 1 && offset + 16 <= bytes.length) {
      size = view.getUint32(offset + 12);
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (size < 8 || offset + size > bytes.length) {
      offset += 1;
      continue;
    }
    if (type === 'moov') {
      return parseMoovBuffer(bytes.subarray(offset + 8, offset + size));
    }
    offset += size;
  }
  return {};
}
