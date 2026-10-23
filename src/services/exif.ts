import exifr from 'exifr';

export interface ExifExtractionResult {
  lat?: number;
  lon?: number;
  alt?: number;
  takenAt?: string;
  thumbnailDataUrl?: string;
  gpsRedacted?: boolean;
}

export function isValidCoordinate(lat: number | undefined, lon: number | undefined): boolean {
  if (lat === undefined || lon === undefined) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  return !(lat === 0 && lon === 0);
}

export class StepTimeoutError extends Error {
  constructor(step: string, ms: number) {
    super(`${step}: нет ответа за ${Math.round(ms / 1000)} с`);
    this.name = 'StepTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StepTimeoutError(step, ms)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const METADATA_TIMEOUT_MS = 20000;
const THUMBNAIL_TIMEOUT_MS = 10000;
const MAX_BITMAP_SOURCE_BYTES = 25 * 1024 * 1024;

export async function extractPhotoMetadata(file: File | Blob): Promise<ExifExtractionResult> {
  const result: ExifExtractionResult = {};

  let data: any;
  try {
    data = await withTimeout(
      exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: true,
        pick: [
          'DateTimeOriginal',
          'CreateDate',
          'ModifyDate',
          'latitude',
          'longitude',
          'GPSLatitude',
          'GPSLatitudeRef',
          'GPSLongitude',
          'GPSLongitudeRef',
          'GPSAltitude',
          'GPSAltitudeRef'
        ]
      }),
      METADATA_TIMEOUT_MS,
      'Чтение координат'
    );
  } catch (err) {
    if (err instanceof StepTimeoutError) throw err;
    data = undefined;
  }

  if (data) {
    const hasGpsTags =
      data.latitude !== undefined || data.longitude !== undefined ||
      data.GPSLatitude !== undefined || data.GPSLongitude !== undefined;
    const lat = data.latitude !== undefined ? Number(data.latitude) : undefined;
    const lon = data.longitude !== undefined ? Number(data.longitude) : undefined;
    if (isValidCoordinate(lat, lon)) {
      result.lat = lat;
      result.lon = lon;
    } else if (hasGpsTags) {
      result.gpsRedacted = true;
    }
    if (data.GPSAltitude !== undefined) {
      result.alt = Math.round(Number(data.GPSAltitude));
    }
    const rawDate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      result.takenAt = rawDate.toISOString();
    } else if (typeof rawDate === 'string') {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        result.takenAt = parsed.toISOString();
      }
    }
  }

  try {
    result.thumbnailDataUrl = await withTimeout(buildThumbnail(file), THUMBNAIL_TIMEOUT_MS, 'Превью');
  } catch {
    result.thumbnailDataUrl = undefined;
  }

  return result;
}

async function buildThumbnail(file: File | Blob): Promise<string | undefined> {
  try {
    const thumbBuffer = await exifr.thumbnail(file);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const blob = new Blob([thumbBuffer as any], { type: 'image/jpeg' });
      return await blobToDataUrl(blob);
    }
  } catch {
  }

  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return undefined;
  const isHeic = (file as File).name?.toLowerCase().endsWith('.heic') || file.type.includes('heic');
  if (isHeic || file.size > MAX_BITMAP_SOURCE_BYTES) return undefined;

  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 320,
      resizeQuality: 'medium'
    });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
