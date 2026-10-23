import exifr from 'exifr';

export interface ExifExtractionResult {
  lat?: number;
  lon?: number;
  alt?: number;
  takenAt?: string;
  thumbnailDataUrl?: string;
}

export async function extractPhotoMetadata(file: File | Blob): Promise<ExifExtractionResult> {
  const result: ExifExtractionResult = {};

  try {
    const data = await exifr.parse(file, {
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
    });

    if (data) {
      if (data.latitude !== undefined && data.longitude !== undefined) {
        result.lat = Number(data.latitude);
        result.lon = Number(data.longitude);
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
  } catch {
  }

  try {
    const thumbBuffer = await exifr.thumbnail(file);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const blob = new Blob([thumbBuffer as any], { type: 'image/jpeg' });
      result.thumbnailDataUrl = await blobToDataUrl(blob);
      return result;
    }
  } catch {
  }

  if (typeof createImageBitmap !== 'undefined' && typeof document !== 'undefined') {
    try {
      const isHeic = (file as File).name?.toLowerCase().endsWith('.heic') || file.type.includes('heic');
      if (!isHeic) {
        const bitmap = await createImageBitmap(file, {
          resizeWidth: 320,
          resizeQuality: 'medium'
        });
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          result.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        }
      }
    } catch {
    }
  }

  return result;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
