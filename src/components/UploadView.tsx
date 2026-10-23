import React, { useState, useRef } from 'react';
import { UploadCloud, Award, AlertTriangle, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { extractPhotoMetadata, withTimeout, isValidCoordinate } from '../services/exif';
import { parseMp4File } from '../services/videoParser';
import { computeGroupKey } from '../services/previewGrouper';
import { latLngToCell } from 'h3-js';
import { db } from '../services/db';
import { globalGeoIndex } from '../services/geoIndex';
import type { PhotoRecord, ThumbnailRecord, GeoDistrict } from '../types';
import type { UnlocatedPhotoItem } from './SilverVerificationModal';

interface ContestedItem {
  id: string;
  lat: number;
  lon: number;
  candidates: GeoDistrict[];
  selectedDistrictId?: string;
}

interface FailedFile {
  name: string;
  reason: string;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotReadableError') return 'Телефон не дал прочитать файл — попробуй выбрать его через «Файлы», а не через галерею';
    if (err.name === 'QuotaExceededError') return 'Закончилось место для данных сайта в браузере';
    return err.message || err.name;
  }
  return String(err);
}

interface UploadViewProps {
  geoReady: boolean;
  onImportDone: () => void;
  onRequestSilverVerification: (photo: UnlocatedPhotoItem) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  geoReady,
  onImportDone,
  onRequestSilverVerification
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesPickerRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [contestedList, setContestedList] = useState<ContestedItem[]>([]);
  const [unlocatedList, setUnlocatedList] = useState<UnlocatedPhotoItem[]>([]);
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    withGps: number;
    withoutGps: number;
    contested: number;
    newThumbs: number;
    gpsRedacted: number;
  } | null>(null);

  const processFile = async (
    file: File,
    index: number,
    seenGroupKeys: Map<string, string>,
    pendingPhotos: PhotoRecord[],
    pendingThumbs: ThumbnailRecord[],
    pendingUnlocated: UnlocatedPhotoItem[],
    pendingContested: ContestedItem[],
    redactedCounter: { count: number }
  ) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name);
    let lat: number | undefined;
    let lon: number | undefined;
    let alt: number | undefined;
    let takenAt: string | undefined;
    let thumbUrl: string | undefined;

    if (isVideo) {
      const meta = await withTimeout(parseMp4File(file), 20000, 'Чтение видео');
      lat = meta.lat;
      lon = meta.lon;
      alt = meta.alt;
      takenAt = meta.takenAt;
    } else {
      const meta = await extractPhotoMetadata(file);
      lat = meta.lat;
      lon = meta.lon;
      alt = meta.alt;
      takenAt = meta.takenAt;
      thumbUrl = meta.thumbnailDataUrl;
      if (meta.gpsRedacted) redactedCounter.count++;
    }

    if (!isValidCoordinate(lat, lon)) {
      lat = undefined;
      lon = undefined;
    }

    if (!takenAt) {
      takenAt = new Date(file.lastModified || Date.now()).toISOString();
    }

    const photoId = `photo-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;

    if (lat !== undefined && lon !== undefined) {
      const h3Cell = latLngToCell(lat, lon, 6);
      const groupKey = computeGroupKey(lat, lon, takenAt);

      let thumbId: string | undefined;
      if (thumbUrl) {
        if (!seenGroupKeys.has(groupKey)) {
          thumbId = `thumb-${Date.now()}-${index}`;
          seenGroupKeys.set(groupKey, thumbId);
          pendingThumbs.push({
            id: thumbId,
            groupKey,
            dataUrl: thumbUrl,
            takenAt
          });
        } else {
          thumbId = seenGroupKeys.get(groupKey);
        }
      }

      const match = globalGeoIndex.findDistrictAndRegion(lat, lon);
      const districtId = match.district?.id;
      const regionId = match.region?.id || match.district?.regionId || 'UNKNOWN';
      const country = match.country || match.district?.country || 'RUS';

      if (match.isContested && match.contestedDistricts && match.contestedDistricts.length > 1) {
        pendingContested.push({
          id: photoId,
          lat,
          lon,
          candidates: match.contestedDistricts,
          selectedDistrictId: match.district?.id
        });
      }

      pendingPhotos.push({
        id: photoId,
        lat,
        lon,
        alt,
        takenAt,
        createdAt: new Date().toISOString(),
        districtId,
        regionId,
        country,
        h3: h3Cell,
        proof: 'gold',
        thumbId,
        isContested: match.isContested,
        contestedDistricts: match.contestedDistricts?.map(d => d.id)
      });
    } else {
      pendingUnlocated.push({
        id: photoId,
        name: file.name,
        dataUrl: thumbUrl,
        file,
        takenAt
      });
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    setContestedList([]);
    setUnlocatedList([]);
    setImportSummary(null);
    setFailedFiles([]);
    setFatalError(null);

    const totalFiles = files.length;
    setProgress({ current: 0, total: totalFiles });

    const seenGroupKeys = new Map<string, string>();
    const pendingPhotos: PhotoRecord[] = [];
    const pendingThumbs: ThumbnailRecord[] = [];
    const pendingUnlocated: UnlocatedPhotoItem[] = [];
    const pendingContested: ContestedItem[] = [];
    const failed: FailedFile[] = [];
    const redactedCounter = { count: 0 };
    let done = 0;

    const CONCURRENCY = 4;
    let nextIndex = 0;

    const runWorker = async () => {
      while (nextIndex < totalFiles) {
        const idx = nextIndex++;
        const file = files[idx];
        try {
          await processFile(
            file,
            idx,
            seenGroupKeys,
            pendingPhotos,
            pendingThumbs,
            pendingUnlocated,
            pendingContested,
            redactedCounter
          );
        } catch (err) {
          failed.push({ name: file.name, reason: describeError(err) });
        }
        done++;
        setProgress({ current: done, total: totalFiles });
      }
    };

    try {
      const workers = Array.from({ length: Math.min(CONCURRENCY, totalFiles) }, () => runWorker());
      await Promise.all(workers);

      await withTimeout(
        db.transaction('rw', [db.photos, db.thumbs], async () => {
          if (pendingThumbs.length > 0) {
            await db.thumbs.bulkPut(pendingThumbs);
          }
          if (pendingPhotos.length > 0) {
            await db.photos.bulkPut(pendingPhotos);
          }
        }),
        30000,
        'Сохранение в память браузера'
      );

      setContestedList(pendingContested);
      setUnlocatedList(pendingUnlocated);
      setImportSummary({
        total: totalFiles,
        withGps: pendingPhotos.length,
        withoutGps: pendingUnlocated.length,
        contested: pendingContested.length,
        newThumbs: pendingThumbs.length,
        gpsRedacted: redactedCounter.count
      });
      onImportDone();
    } catch (err) {
      setFatalError(describeError(err));
    } finally {
      setFailedFiles(failed);
      setProcessing(false);
      setProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (filesPickerRef.current) {
        filesPickerRef.current.value = '';
      }
    }
  };

  const handleResolveContested = async (item: ContestedItem, chosenDistrictId: string) => {
    await db.photos.update(item.id, {
      districtId: chosenDistrictId,
      isContested: false
    });
    setContestedList(prev => prev.filter(c => c.id !== item.id));
    onImportDone();
  };

  return (
    <div className="upload-view-container custom-scrollbar">
      <div className="upload-card">
        <h2 className="view-title">Загрузка путешествий</h2>
        <p className="view-subtitle">
          Загрузи фотографии или видео из своей галереи. Координаты и даты будут считаны локально в браузере без отправки на сервер.
        </p>

        <div
          className={`dropzone-box ${!geoReady ? 'dropzone-disabled' : ''}`}
          onClick={() => geoReady && !processing && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
            disabled={processing || !geoReady}
          />
          <div className="dropzone-icon">
            <UploadCloud size={40} color="var(--accent)" />
          </div>
          <div className="dropzone-text">
            {geoReady ? (
              <><strong>Нажми для выбора файлов</strong> или перетащи их сюда</>
            ) : (
              <strong>Загружаю карту регионов…</strong>
            )}
          </div>
          <div className="dropzone-hint">
            Поддерживаются JPEG, HEIC, MP4, MOV (до 3000+ файлов за раз)
          </div>
        </div>

        <div className="files-picker-row">
          <button
            type="button"
            className="files-picker-btn"
            disabled={processing || !geoReady}
            onClick={() => filesPickerRef.current?.click()}
          >
            <FolderOpen size={16} />
            Выбрать через «Файлы»
          </button>
          <span className="files-picker-hint">
            Если на Android у фото пропадают координаты — выбирай так, а не через галерею.
          </span>
          <input
            ref={filesPickerRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
            disabled={processing || !geoReady}
          />
        </div>

        {processing && progress && (
          <div className="progress-container">
            <div className="progress-status">
              <span>Обработка файлов...</span>
              <span className="progress-numbers">
                {progress.current} из {progress.total}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {fatalError && (
          <div className="upload-error-box">
            <AlertTriangle size={18} color="var(--accent)" />
            <div>
              <strong>Обработка прервалась.</strong> {fatalError}
            </div>
          </div>
        )}

        {importSummary && importSummary.gpsRedacted > 0 && (
          <div className="upload-error-box">
            <AlertTriangle size={18} color="var(--badge-gold)" />
            <div>
              <strong>У {importSummary.gpsRedacted} фото телефон стёр координаты.</strong> Android убирает местоположение,
              когда фото выбирают через галерею. Нажми «Выбрать через „Файлы“», открой папку DCIM/Camera и выбери фото там —
              тогда координаты сохранятся. Если и так пусто — проверь, что в настройках камеры включено «Сохранять местоположение».
            </div>
          </div>
        )}

        {failedFiles.length > 0 && (
          <div className="upload-error-box">
            <AlertTriangle size={18} color="var(--badge-gold)" />
            <div>
              <strong>Не удалось обработать файлов: {failedFiles.length}</strong>
              <ul className="failed-list">
                {failedFiles.slice(0, 10).map((f, i) => (
                  <li key={i}>
                    {f.name} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {importSummary && (
          <div className="summary-box">
            <h3 className="summary-title">Итоги обработки</h3>
            <div className="summary-grid">
              <div className="summary-stat">
                <span className="stat-label">Всего файлов</span>
                <span className="stat-val">{importSummary.total}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Award size={14} color="var(--badge-gold)" /> С координатами
                </span>
                <span className="stat-val accent-text">{importSummary.withGps}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Без геотегов</span>
                <span className="stat-val">{importSummary.withoutGps}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Сохранено превью</span>
                <span className="stat-val">{importSummary.newThumbs}</span>
              </div>
            </div>
          </div>
        )}

        {contestedList.length > 0 && (
          <div className="contested-section">
            <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--accent-2)" />
              <h3 className="section-title">Спорные точки на границе районов ({contestedList.length})</h3>
            </div>
            <p className="section-desc">
              Точки сняты ближе 2 км к границе нескольких районов. Выбери точный район:
            </p>
            <div className="contested-items-list">
              {contestedList.map(item => (
                <div key={item.id} className="contested-item-card">
                  <span className="item-coords">{item.lat.toFixed(4)}, {item.lon.toFixed(4)}</span>
                  <div className="candidates-options">
                    {item.candidates.map(cand => (
                      <button
                        key={cand.id}
                        className="candidate-choice-btn"
                        onClick={() => handleResolveContested(item, cand.id)}
                      >
                        {cand.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {unlocatedList.length > 0 && (
          <div className="unlocated-section">
            <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} color="var(--badge-silver)" />
              <h3 className="section-title">Снимки без координат ({unlocatedList.length})</h3>
            </div>
            <p className="section-desc">
              Подтверди место съёмки через нейросеть CLIP (сравнение с фото Wikimedia Commons вокруг точки):
            </p>
            <div className="unlocated-grid">
              {unlocatedList.map(photo => (
                <div key={photo.id} className="unlocated-card">
                  {photo.dataUrl ? (
                    <img src={photo.dataUrl} alt={photo.name} className="unlocated-thumb" />
                  ) : (
                    <div className="unlocated-placeholder">
                      <ImageIcon size={24} color="var(--muted)" />
                    </div>
                  )}
                  <div className="unlocated-name">{photo.name}</div>
                  <button
                    className="locate-btn"
                    onClick={() => onRequestSilverVerification(photo)}
                  >
                    Указать место
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .upload-view-container {
          flex: 1;
          height: 100%;
          overflow-y: auto;
          padding: 24px 16px 80px;
          display: flex;
          justify-content: center;
        }

        .upload-card {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .view-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
        }

        .view-subtitle {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
        }

        .dropzone-box {
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          padding: 36px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          background: var(--bg-2);
          transition: border-color var(--transition), background var(--transition);
        }

        .dropzone-box:hover {
          border-color: var(--accent);
          background: var(--bg-3);
        }

        .dropzone-icon {
          font-size: 36px;
        }

        .dropzone-text {
          font-size: 14px;
          color: var(--text);
        }

        .dropzone-hint {
          font-size: 12px;
          color: var(--muted);
        }

        .progress-container {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .progress-status {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 500;
        }

        .progress-numbers {
          color: var(--accent);
          font-weight: 700;
        }

        .progress-bar {
          height: 8px;
          background: var(--bg-3);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 4px;
          transition: width 0.1s linear;
        }

        .files-picker-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 0.75rem;
          margin-top: 0.75rem;
        }

        .files-picker-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.9rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--bg-2);
          color: var(--text);
          font: inherit;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .files-picker-btn:hover:not(:disabled) {
          border-color: var(--accent);
        }

        .files-picker-btn:disabled {
          opacity: 0.6;
          cursor: progress;
        }

        .files-picker-hint {
          flex: 1 1 16rem;
          min-width: 0;
          color: var(--muted);
          font-size: 0.8125rem;
        }

        .dropzone-disabled {
          opacity: 0.6;
          cursor: progress;
        }

        .upload-error-box {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
          background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
          border-radius: var(--radius);
          color: var(--text);
          font-size: 0.875rem;
          line-height: 1.4;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .failed-list {
          margin: 0.5rem 0 0;
          padding-left: 1.1rem;
          color: var(--muted);
        }

        .summary-box {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        .summary-stat {
          background: var(--bg-3);
          padding: 10px;
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: var(--muted);
        }

        .stat-val {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
        }

        .accent-text {
          color: var(--accent);
        }

        .contested-section, .unlocated-section {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
        }

        .section-desc {
          font-size: 12px;
          color: var(--muted);
        }

        .contested-items-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .contested-item-card {
          background: var(--bg-3);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item-coords {
          font-size: 12px;
          color: var(--muted);
          font-family: monospace;
        }

        .candidates-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .candidate-choice-btn {
          padding: 6px 12px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text);
          font-size: 12px;
          font-weight: 600;
        }

        .candidate-choice-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .unlocated-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }

        .unlocated-card {
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .unlocated-thumb {
          width: 100%;
          height: 90px;
          object-fit: cover;
          border-radius: 4px;
        }

        .unlocated-placeholder {
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          border-radius: 4px;
          font-size: 24px;
          color: var(--muted);
        }

        .unlocated-name {
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .locate-btn {
          padding: 6px;
          background: var(--accent);
          color: var(--text);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }

        @media (min-width: 768px) {
          .upload-view-container {
            padding-bottom: 24px;
          }
        }
      `}</style>
    </div>
  );
};
