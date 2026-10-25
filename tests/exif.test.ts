import { describe, it, expect } from 'vitest';
import { withTimeout, StepTimeoutError, extractPhotoMetadata, isValidCoordinate, getOrientationTransform } from '../src/services/exif';

class BlobReader {
  result: ArrayBuffer | string | null = null;
  onload: ((ev: { target: BlobReader }) => void) | null = null;
  onloadend: ((ev: { target: BlobReader }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then(
      buf => {
        this.result = buf;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      },
      err => this.onerror?.(err)
    );
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then(
      buf => {
        this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      },
      err => this.onerror?.(err)
    );
  }
}

if (typeof (globalThis as any).FileReader === 'undefined') {
  (globalThis as any).FileReader = BlobReader;
}

const YALTA_JPEG_B64 =
  '/9j/4QDSRXhpZgAATU0AKgAAAAgAAodpAAQAAAABAAAAJoglAAQAAAABAAAASAAAAAAAAZADAAIAAAAUAAAANDIwMjY6MDc6MjUgMTg6MDA6MDAAAAYAAQACAAAAAk4AAAAAAgAFAAAAAwAAAJIAAwACAAAAAkUAAAAABAAFAAAAAwAAAKoABQABAAAAAQAAAAAABgAFAAAAAQAAAMIAAAAsAAAAAQAAAB0AAAABAAAQaAAAAGQAAAAiAAAAAQAAAAkAAAABAAAWgAAAAGQAAAAoAAAAAf/gABBKRklGAAEBAAABAAEAAP/bAEMAAwICAgICAwICAgMDAwMEBgQEBAQECAYGBQYJCAoKCQgJCQoMDwwKCw4LCQkNEQ0ODxAQERAKDBITEhATDxAQEP/bAEMBAwMDBAMECAQECBALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/AABEIAAoACgMBIgACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAABf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAI/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqgBkcb//2Q==';

function yaltaBytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(YALTA_JPEG_B64), c => c.charCodeAt(0));
}

function redactGps(bytes: Uint8Array<ArrayBuffer>, mode: 'zero-denominator' | 'zero'): Uint8Array<ArrayBuffer> {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  const tiff = 12;
  for (const base of [0x92, 0xaa]) {
    for (let i = 0; i < 3; i++) {
      const off = tiff + base + i * 8;
      view.setUint32(off, 0);
      view.setUint32(off + 4, mode === 'zero' ? 1 : 0);
    }
  }
  return out;
}

describe('Upload safety', () => {
  it('rejects a step that never answers', async () => {
    const never = new Promise<number>(() => {});
    await expect(withTimeout(never, 50, 'Чтение координат')).rejects.toBeInstanceOf(StepTimeoutError);
  });

  it('passes through a fast result and a fast error', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, 'шаг')).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(new Error('плохо')), 1000, 'шаг')).rejects.toThrow('плохо');
  });

  it('treats a non-image file as a photo without coordinates', async () => {
    const junk = new Blob([new Uint8Array(2000).map((_, i) => (i * 37) % 251)], { type: 'image/jpeg' });
    const meta = await extractPhotoMetadata(junk);
    expect(meta.lat).toBeUndefined();
    expect(meta.lon).toBeUndefined();
  });

  it('reads real coordinates from a geotagged photo', async () => {
    const meta = await extractPhotoMetadata(new Blob([yaltaBytes()], { type: 'image/jpeg' }));
    expect(meta.lat).toBeCloseTo(44.495, 2);
    expect(meta.lon).toBeCloseTo(34.166, 2);
    expect(meta.gpsRedacted).toBeFalsy();
  });

  it('flags coordinates wiped by the phone instead of failing', async () => {
    for (const mode of ['zero-denominator', 'zero'] as const) {
      const meta = await extractPhotoMetadata(new Blob([redactGps(yaltaBytes(), mode)], { type: 'image/jpeg' }));
      expect(meta.lat).toBeUndefined();
      expect(meta.lon).toBeUndefined();
      expect(meta.gpsRedacted).toBe(true);
    }
  });

  it('accepts only real coordinates', () => {
    expect(isValidCoordinate(44.5, 34.2)).toBe(true);
    expect(isValidCoordinate(NaN, 34.2)).toBe(false);
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate(95, 10)).toBe(false);
    expect(isValidCoordinate(undefined, 10)).toBe(false);
  });
});

describe('Orientation transform matrix', () => {
  const sw = 400;
  const sh = 300;
  const corners: [number, number][] = [
    [0, 0],
    [sw, 0],
    [0, sh],
    [sw, sh]
  ];

  for (let o = 1; o <= 8; o++) {
    it(`transforms dimensions and corners accurately for orientation ${o}`, () => {
      const { width, height, matrix } = getOrientationTransform(o, sw, sh);
      if (o >= 5) {
        expect(width).toBe(sh);
        expect(height).toBe(sw);
      } else {
        expect(width).toBe(sw);
        expect(height).toBe(sh);
      }

      for (const [x, y] of corners) {
        const xPrime = matrix[0] * x + matrix[2] * y + matrix[4];
        const yPrime = matrix[1] * x + matrix[3] * y + matrix[5];
        expect(xPrime).toBeGreaterThanOrEqual(0);
        expect(xPrime).toBeLessThanOrEqual(width);
        expect(yPrime).toBeGreaterThanOrEqual(0);
        expect(yPrime).toBeLessThanOrEqual(height);
      }
    });
  }

  it('handles orientation 6 (90 deg CW)', () => {
    const { width, height, matrix } = getOrientationTransform(6, sw, sh);
    expect(width).toBe(300);
    expect(height).toBe(400);
    const [a, b, c, d, e, f] = matrix;
    expect(a * 0 + c * 0 + e).toBe(300);
    expect(b * 0 + d * 0 + f).toBe(0);
    expect(a * sw + c * 0 + e).toBe(300);
    expect(b * sw + d * 0 + f).toBe(400);
    expect(a * 0 + c * sh + e).toBe(0);
    expect(b * 0 + d * sh + f).toBe(0);
  });

  it('handles orientation 8 (270 deg CW / 90 CCW)', () => {
    const { width, height, matrix } = getOrientationTransform(8, sw, sh);
    expect(width).toBe(300);
    expect(height).toBe(400);
    const [a, b, c, d, e, f] = matrix;
    expect(a * 0 + c * 0 + e).toBe(0);
    expect(b * 0 + d * 0 + f).toBe(400);
    expect(a * sw + c * 0 + e).toBe(0);
    expect(b * sw + d * 0 + f).toBe(0);
    expect(a * 0 + c * sh + e).toBe(300);
    expect(b * 0 + d * sh + f).toBe(400);
  });
});
