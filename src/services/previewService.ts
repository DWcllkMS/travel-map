import { db } from './db';
import { rotateDataUrl90Clockwise } from './exif';

export type PreviewSource = 'photo' | 'group' | 'none';

export interface ResolvedPreview {
  dataUrl?: string;
  source: PreviewSource;
  key?: string;
}

export function resolvePreview(
  photo: { id: string; thumbId?: string },
  photoThumbsMap?: Record<string, string>,
  groupThumbsMap?: Record<string, string>
): ResolvedPreview {
  const photoData = photoThumbsMap?.[photo.id];
  if (photoData) {
    return { dataUrl: photoData, source: 'photo', key: photo.id };
  }
  if (photo.thumbId) {
    const groupData = groupThumbsMap?.[photo.thumbId];
    if (groupData) {
      return { dataUrl: groupData, source: 'group', key: photo.thumbId };
    }
  }
  return { dataUrl: undefined, source: 'none' };
}

export async function getPhotoPreview(photo: { id: string; thumbId?: string }): Promise<ResolvedPreview> {
  try {
    const pt = await db.photoThumbs.get(photo.id);
    if (pt?.dataUrl) {
      return { dataUrl: pt.dataUrl, source: 'photo', key: photo.id };
    }
  } catch {}

  if (photo.thumbId) {
    try {
      const gt = await db.thumbs.get(photo.thumbId);
      if (gt?.dataUrl) {
        return { dataUrl: gt.dataUrl, source: 'group', key: photo.thumbId };
      }
    } catch {}
  }

  return { dataUrl: undefined, source: 'none' };
}

export async function rotatePhotoPreview(preview: ResolvedPreview): Promise<{ dataUrl: string; source: 'photo' | 'group'; key: string } | null> {
  if (!preview.dataUrl || !preview.key || preview.source === 'none') {
    return null;
  }

  const rotated = await rotateDataUrl90Clockwise(preview.dataUrl);

  if (preview.source === 'photo') {
    await db.photoThumbs.put({ id: preview.key, dataUrl: rotated });
  } else if (preview.source === 'group') {
    await db.thumbs.update(preview.key, { dataUrl: rotated });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('thumb-updated', {
        detail: { id: preview.key, type: preview.source, dataUrl: rotated }
      })
    );
  }

  return { dataUrl: rotated, source: preview.source, key: preview.key };
}
