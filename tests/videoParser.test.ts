import { describe, it, expect } from 'vitest';
import { parseMoovBuffer, parseIso6709 } from '../src/services/videoParser';

function makeAtom(fourcc: string, data: Uint8Array): Uint8Array {
  const size = data.length + 8;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = fourcc.charCodeAt(i);
  }
  out.set(data, 8);
  return out;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

describe('MP4 Video Parser on synthetic bytes', () => {
  it('parses ISO 6709 coordinate strings correctly', () => {
    const loc = parseIso6709('+43.3500+042.4500/');
    expect(loc).toBeDefined();
    expect(loc?.lat).toBeCloseTo(43.35);
    expect(loc?.lon).toBeCloseTo(42.45);
    expect(loc?.alt).toBeUndefined();

    const locWithAlt = parseIso6709('+43.2570+042.5110+2100/');
    expect(locWithAlt).toBeDefined();
    expect(locWithAlt?.lat).toBeCloseTo(43.257);
    expect(locWithAlt?.lon).toBeCloseTo(42.511);
    expect(locWithAlt?.alt).toBe(2100);
  });

  it('extracts GPS location and date from synthetic moov atom', () => {
    const mvhdData = new Uint8Array(100);
    const mvhdView = new DataView(mvhdData.buffer);
    mvhdView.setUint8(0, 0);
    const testEpochSeconds = 1718000000;
    const macEpochSeconds = testEpochSeconds + 2082844800;
    mvhdView.setUint32(4, macEpochSeconds);
    const mvhdAtom = makeAtom('mvhd', mvhdData);

    const locString = '+43.2570+042.5110+2100/';
    const locBytes = new TextEncoder().encode(locString);
    const xyzAtom = makeAtom('\xa9xyz', locBytes);
    const udtaAtom = makeAtom('udta', xyzAtom);

    const moovPayload = concatBuffers(mvhdAtom, udtaAtom);
    const parsed = parseMoovBuffer(moovPayload);

    expect(parsed.lat).toBeCloseTo(43.257);
    expect(parsed.lon).toBeCloseTo(42.511);
    expect(parsed.alt).toBe(2100);
    expect(parsed.takenAt).toBeDefined();
    expect(new Date(parsed.takenAt!).getTime()).toBe(testEpochSeconds * 1000);
  });
});
