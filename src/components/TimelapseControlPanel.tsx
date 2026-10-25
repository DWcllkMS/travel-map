import React from 'react';
import { Play, Pause, X, RotateCcw, Crosshair } from 'lucide-react';
import type { TimelapseStep } from '../services/timelapseService';
import { pluralRu } from '../services/timelineService';

interface TimelapseControlPanelProps {
  step: TimelapseStep;
  stepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  isFinished: boolean;
  speed: number;
  followCamera: boolean;
  notification: string | null;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onToggleFollow: () => void;
  onReplay: () => void;
  onClose: () => void;
}

export const TimelapseControlPanel: React.FC<TimelapseControlPanelProps> = ({
  step,
  stepIndex,
  totalSteps,
  isPlaying,
  isFinished,
  speed,
  followCamera,
  notification,
  onTogglePlay,
  onScrub,
  onSpeedChange,
  onToggleFollow,
  onReplay,
  onClose
}) => {
  return (
    <div className="timelapse-panel-wrapper">
      {notification && (
        <div className="timelapse-discovery-pill">
          {notification}
        </div>
      )}

      {isFinished ? (
        <div className="timelapse-finished-card">
          <div className="finished-header">
            <h3 className="finished-title">История завершена</h3>
            <p className="finished-summary">
              Открыто {pluralRu(step.regionsCount, 'регион', 'региона', 'регионов')}, {pluralRu(step.districtsCount, 'район', 'района', 'районов')}, {pluralRu(step.countriesCount, 'страна', 'страны', 'стран')}
            </p>
          </div>
          <div className="finished-buttons">
            <button type="button" className="finished-btn replay-btn" onClick={onReplay}>
              <RotateCcw size={15} />
              <span>Ещё раз</span>
            </button>
            <button type="button" className="finished-btn close-btn" onClick={onClose}>
              <X size={15} />
              <span>Закрыть</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="timelapse-panel-card">
          <div className="panel-header-row">
            <div className="date-and-counters">
              <span className="timelapse-date">{step.formattedDate}</span>
              <div className="timelapse-counters">
                <span>{pluralRu(step.regionsCount, 'регион', 'региона', 'регионов')}</span>
                <span className="counter-dot">•</span>
                <span>{pluralRu(step.districtsCount, 'район', 'района', 'районов')}</span>
                <span className="counter-dot">•</span>
                <span>{pluralRu(step.countriesCount, 'страна', 'страны', 'стран')}</span>
              </div>
            </div>

            <button
              type="button"
              className="timelapse-close-icon-btn"
              onClick={onClose}
              title="Закрыть"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={stepIndex}
              onChange={e => onScrub(Number(e.target.value))}
              className="timelapse-slider"
              aria-label="Шкала времени"
            />
          </div>

          <div className="panel-controls-row">
            <div className="left-controls">
              <button
                type="button"
                className="play-pause-btn"
                onClick={onTogglePlay}
                title={isPlaying ? 'Пауза' : 'Продолжить'}
                aria-label={isPlaying ? 'Пауза' : 'Продолжить'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button
                type="button"
                className={`follow-toggle-btn ${followCamera ? 'active' : ''}`}
                onClick={onToggleFollow}
                title="Следить камерой"
                aria-label="Следить камерой"
              >
                <Crosshair size={14} />
                <span>Следить</span>
              </button>
            </div>

            <div className="speed-selector">
              {[0.5, 1, 2, 4].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => onSpeedChange(s)}
                >
                  ×{s}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="timelapse-done-btn"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <style>{`
        .timelapse-panel-wrapper {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 620px;
          z-index: 40;
          pointer-events: auto;
          box-sizing: border-box;
        }

        .timelapse-discovery-pill {
          position: absolute;
          top: -44px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-2);
          border: 1px solid var(--accent);
          color: var(--text);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          white-space: nowrap;
          pointer-events: none;
          max-width: 90vw;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .timelapse-panel-card,
        .timelapse-finished-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
        }

        .panel-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .date-and-counters {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .timelapse-date {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.2;
        }

        .timelapse-counters {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
          flex-wrap: wrap;
        }

        .counter-dot {
          opacity: 0.5;
        }

        .timelapse-close-icon-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
        }

        .timelapse-close-icon-btn:hover {
          color: var(--text);
        }

        .slider-container {
          width: 100%;
          display: flex;
          align-items: center;
        }

        .timelapse-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--bg-3);
          outline: none;
          cursor: pointer;
          accent-color: var(--accent);
          -webkit-appearance: none;
          appearance: none;
        }

        .timelapse-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }

        .panel-controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .left-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .play-pause-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: var(--accent);
          color: var(--on-accent);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity var(--transition);
        }

        .play-pause-btn:hover {
          opacity: 0.9;
        }

        .follow-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--muted);
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background var(--transition), color var(--transition), border-color var(--transition);
        }

        .follow-toggle-btn.active {
          border-color: var(--accent);
          color: var(--text);
        }

        .speed-selector {
          display: flex;
          align-items: center;
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .speed-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--transition), color var(--transition);
        }

        .speed-btn.active {
          background: var(--border);
          color: var(--text);
        }

        .timelapse-done-btn {
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--transition);
        }

        .timelapse-done-btn:hover {
          background: var(--border);
        }

        .timelapse-finished-card {
          align-items: center;
          text-align: center;
          padding: 18px 20px;
        }

        .finished-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .finished-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
        }

        .finished-summary {
          font-size: 13px;
          color: var(--muted);
        }

        .finished-buttons {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .finished-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity var(--transition);
        }

        .replay-btn {
          background: var(--accent);
          color: var(--on-accent);
          border: none;
        }

        .replay-btn:hover {
          opacity: 0.9;
        }

        .finished-buttons .close-btn {
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
        }

        .finished-buttons .close-btn:hover {
          background: var(--border);
        }

        @media (max-width: 480px) {
          .timelapse-panel-wrapper {
            bottom: calc(68px + env(safe-area-inset-bottom, 0px));
            width: calc(100% - 16px);
          }

          .timelapse-panel-card,
          .timelapse-finished-card {
            padding: 10px 12px;
            gap: 10px;
          }

          .timelapse-date {
            font-size: 15px;
          }

          .panel-controls-row {
            gap: 8px;
          }

          .speed-btn {
            padding: 5px 6px;
          }
        }
      `}</style>
    </div>
  );
};
