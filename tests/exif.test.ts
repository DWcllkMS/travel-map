import { describe, it, expect } from 'vitest';
import { withTimeout, StepTimeoutError, extractPhotoMetadata } from '../src/services/exif';

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
});
