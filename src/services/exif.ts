import exifr from 'exifr';

export interface ExifExtractionResult {
  lat?: number;
  lon?: number;
  alt?: number;
  takenAt?: string;
  thumbnailDataUrl?: string;
  gpsRedacted?: boolean;
  orientation?: number;
}

export interface OrientationTransform {
  width: number;
  height: number;
  matrix: [number, number, number, number, number, number];
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

export function getOrientationTransform(orientation: number, width: number, height: number): OrientationTransform {
  switch (orientation) {
    case 2:
      return { width, height, matrix: [-1, 0, 0, 1, width, 0] };
    case 3:
      return { width, height, matrix: [-1, 0, 0, -1, width, height] };
    case 4:
      return { width, height, matrix: [1, 0, 0, -1, 0, height] };
    case 5:
      return { width: height, height: width, matrix: [0, 1, 1, 0, 0, 0] };
    case 6:
      return { width: height, height: width, matrix: [0, 1, -1, 0, height, 0] };
    case 7:
      return { width: height, height: width, matrix: [0, -1, -1, 0, height, width] };
    case 8:
      return { width: height, height: width, matrix: [0, -1, 1, 0, 0, width] };
    case 1:
    default:
      return { width, height, matrix: [1, 0, 0, 1, 0, 0] };
  }
}

export function rotateDataUrl90Clockwise(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight || img.height;
      canvas.height = img.naturalWidth || img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Не удалось повернуть изображение'));
    img.src = dataUrl;
  });
}

function orientThumbnailBlob(blob: Blob, orientation: number): Promise<string> {
  if (orientation <= 1 || orientation > 8 || typeof document === 'undefined') {
    return blobToDataUrl(blob);
  }
  return new Promise<string>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sw = img.naturalWidth || img.width;
      const sh = img.naturalHeight || img.height;
      const { width, height, matrix } = getOrientationTransform(orientation, sw, sh);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        blobToDataUrl(blob).then(resolve).catch(() => resolve(''));
        return;
      }
      ctx.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      blobToDataUrl(blob).then(resolve).catch(() => resolve(''));
    };
    img.src = url;
  });
}

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
          'Orientation',
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

  let orientation = 1;
  if (data?.Orientation !== undefined) {
    let parsed = Number(data.Orientation);
    if (!Number.isInteger(parsed)) {
      try {
        parsed = Number(await exifr.orientation(file));
      } catch {
        parsed = 1;
      }
    }
    if (parsed >= 1 && parsed <= 8) {
      orientation = parsed;
    }
  }
  result.orientation = orientation;

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
    result.thumbnailDataUrl = await withTimeout(buildThumbnail(file, orientation), THUMBNAIL_TIMEOUT_MS, 'Превью');
  } catch {
    result.thumbnailDataUrl = undefined;
  }

  return result;
}

async function buildThumbnail(file: File | Blob, orientation: number = 1): Promise<string | undefined> {
  try {
    const thumbBuffer = await exifr.thumbnail(file);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const blob = new Blob([thumbBuffer as any], { type: 'image/jpeg' });
      return await orientThumbnailBlob(blob, orientation);
    }
  } catch {
  }

  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return undefined;
  const isHeic = (file as File).name?.toLowerCase().endsWith('.heic') || file.type.includes('heic');
  if (isHeic || file.size > MAX_BITMAP_SOURCE_BYTES) return undefined;

  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 320,
      resizeQuality: 'medium',
      imageOrientation: 'from-image'
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


export async function buildVideoThumbnail(file: File | Blob): Promise<string | undefined> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL === 'undefined') {
    return undefined;
  }
  let objectUrl: string | undefined;
  try {
    objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const capture = new Promise<string>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      const onLoaded = () => {
        const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        const target = Math.min(0.5, dur * 0.1);
        video.currentTime = Math.max(0, target);
      };
      const onSeeked = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          const vw = video.videoWidth || 320;
          const vh = video.videoHeight || 180;
          const aspect = vh / vw;
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = Math.max(1, Math.round(320 * aspect));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (err) {
          reject(err);
        }
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Video load failed'));
      };

      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.src = objectUrl!;
    });

    return await withTimeout(capture, 10000, 'Превью видео');
  } catch {
    return undefined;
  } finally {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }
  }
}