export const CLIP_SIMILARITY_THRESHOLD = 0.24;

export interface CommonsCandidateImage {
  title: string;
  url: string;
  thumbUrl: string;
  author: string;
  license: string;
  score?: number;
}

export interface ClipVerificationResult {
  isMatch: boolean;
  score: number;
  threshold: number;
  bestImage?: CommonsCandidateImage;
  comparedImages: CommonsCandidateImage[];
}

let clipExtractor: any = null;

export async function loadClipModel(onProgress?: (percent: number) => void): Promise<any> {
  if (clipExtractor) return clipExtractor;

  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  clipExtractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
    progress_callback: (info: any) => {
      if (info && info.progress && onProgress) {
        onProgress(Math.round(info.progress));
      }
    }
  });

  return clipExtractor;
}

export async function fetchCommonsPhotosAround(lat: number, lon: number): Promise<CommonsCandidateImage[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggscoord=${lat}|${lon}&ggsradius=10000&ggslimit=15&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&format=json&origin=*`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.query || !data.query.pages) return [];

    const pages = Object.values(data.query.pages) as any[];
    const candidates: CommonsCandidateImage[] = [];

    for (const page of pages) {
      const info = page.imageinfo && page.imageinfo[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const author = meta.Artist ? meta.Artist.value.replace(/<[^>]+>/g, '').trim() : 'Неизвестный автор';
      const license = meta.LicenseShortName ? meta.LicenseShortName.value : (meta.UsageTerms ? meta.UsageTerms.value : 'CC BY-SA');

      candidates.push({
        title: page.title.replace('File:', ''),
        url: info.url,
        thumbUrl: info.thumburl || info.url,
        author,
        license
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function norm(a: number[] | Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const nA = norm(a);
  const nB = norm(b);
  if (nA === 0 || nB === 0) return 0;
  return dotProduct(a, b) / (nA * nB);
}

export async function verifyPhotoWithClip(
  userPhotoUrl: string,
  lat: number,
  lon: number,
  onModelProgress?: (p: number) => void
): Promise<ClipVerificationResult> {
  const extractor = await loadClipModel(onModelProgress);
  const commonsList = await fetchCommonsPhotosAround(lat, lon);

  if (commonsList.length === 0) {
    return {
      isMatch: false,
      score: 0,
      threshold: CLIP_SIMILARITY_THRESHOLD,
      comparedImages: []
    };
  }

  const userOutput = await extractor(userPhotoUrl);
  const userVec = userOutput.data;

  let bestScore = -1;
  let bestImage: CommonsCandidateImage | undefined;

  for (const cand of commonsList.slice(0, 8)) {
    try {
      const candOutput = await extractor(cand.thumbUrl);
      const candVec = candOutput.data;
      const score = cosineSimilarity(userVec, candVec);
      cand.score = parseFloat(score.toFixed(3));
      if (score > bestScore) {
        bestScore = score;
        bestImage = cand;
      }
    } catch {
    }
  }

  const roundedScore = parseFloat(bestScore.toFixed(3));
  const isMatch = roundedScore >= CLIP_SIMILARITY_THRESHOLD;

  return {
    isMatch,
    score: roundedScore,
    threshold: CLIP_SIMILARITY_THRESHOLD,
    bestImage,
    comparedImages: commonsList.filter(c => c.score !== undefined)
  };
}
