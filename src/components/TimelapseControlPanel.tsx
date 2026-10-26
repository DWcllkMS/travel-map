import React from 'react';
import { Play, Pause, X, RotateCcw, LocateFixed, MapPin } from 'lucide-react';
import type { TimelapseStep } from '../services/timelapseService';
import { pluralRu } from '../services/timelineService';

interface TimelapseControlPanelProps {
  step: TimelapseStep;
  stepIndex: number;
  totalSteps: number;
  startLabel: string;
  endLabel: string;
  isPlaying: boolean;
  isFinished: boolean;
  speed: number;
  followCamera: boolean;
  notification: { key: number; items: string[] } | null;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onToggleFollow: () => void;
  onReplay: () => void;
  onClose: () => void;
}

const wordOnly = (n: number, one: string, few: string, many: string) => pluralRu(n, one, few, many).replace(/^\d+\s/, '');

const SPEEDS = [0.5, 1, 2, 4];

export const TimelapseControlPanel: React.FC<TimelapseControlPanelProps> = ({
  step,
  stepIndex,
  totalSteps,
  startLabel,
  endLabel,
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
  const progress = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 100;
  const stats = [
    { value: step.countriesCount, label: wordOnly(step.countriesCount, 'страна', 'страны', 'стран') },
    { value: step.regionsCount, label: wordOnly(step.regionsCount, 'регион', 'региона', 'регионов') },
    { value: step.districtsCount, label: wordOnly(step.districtsCount, 'район', 'района', 'районов') }
  ];
  const shown = notification ? notification.items.slice(0, 3) : [];
  const rest = notification ? notification.items.length - shown.length : 0;

  return (
    <div className="tl-wrap">
      {!isFinished && notification && (
        <div className="tl-toasts" key={notification.key} aria-live="polite">
          {shown.map((text, i) => (
            <div className="tl-toast" key={i} style={{ animationDelay: `${i * 90}ms, ${2200 + i * 90}ms` }}>
              <MapPin size={14} />
              <span>{text.replace(/^\+\s*/, '')}</span>
            </div>
          ))}
          {rest > 0 && (
            <div className="tl-toast tl-toast-more" style={{ animationDelay: `${shown.length * 90}ms, ${2200 + shown.length * 90}ms` }}>
              <span>и ещё {rest}</span>
            </div>
          )}
        </div>
      )}

      {isFinished ? (
        <div className="tl-card tl-finished">
          <div className="tl-finished-head">
            <span className="tl-eyebrow">{startLabel} — {endLabel}</span>
            <h3 className="tl-finished-title">Вот твоя история</h3>
          </div>
          <div className="tl-stats tl-stats-big">
            {stats.map(s => (
              <div className="tl-stat" key={s.label}>
                <span className="tl-stat-value">{s.value.toLocaleString('ru-RU')}</span>
                <span className="tl-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="tl-finished-actions">
            <button type="button" className="tl-btn tl-btn-accent" onClick={onReplay}>
              <RotateCcw size={16} />
              <span>Ещё раз</span>
            </button>
            <button type="button" className="tl-btn" onClick={onClose}>
              <X size={16} />
              <span>Закрыть</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tl-card">
          <div className="tl-head">
            <div className="tl-date-block">
              <span className="tl-eyebrow">Таймлапс</span>
              <span className="tl-date" key={step.date}>{step.formattedDate}</span>
            </div>
            <button type="button" className="tl-icon-btn" onClick={onClose} title="Закрыть" aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="tl-stats">
            {stats.map(s => (
              <div className="tl-stat" key={s.label}>
                <span className="tl-stat-value" key={s.value}>{s.value.toLocaleString('ru-RU')}</span>
                <span className="tl-stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="tl-track-block">
            <div className="tl-track">
              <div className="tl-track-fill" style={{ width: `${progress}%` }} />
              <div className="tl-track-thumb" style={{ left: `${progress}%` }} />
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSteps - 1)}
                value={stepIndex}
                onChange={e => onScrub(Number(e.target.value))}
                className="tl-range"
                aria-label="Шкала времени"
              />
            </div>
            <div className="tl-track-labels">
              <span>{startLabel}</span>
              <span>{endLabel}</span>
            </div>
          </div>

          <div className="tl-controls">
            <button
              type="button"
              className="tl-play"
              onClick={onTogglePlay}
              title={isPlaying ? 'Пауза' : 'Играть'}
              aria-label={isPlaying ? 'Пауза' : 'Играть'}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <button
              type="button"
              className={`tl-follow ${followCamera ? 'active' : ''}`}
              onClick={onToggleFollow}
              aria-pressed={followCamera}
              title="Камера следит за поездками"
            >
              <LocateFixed size={16} />
              <span>Следить</span>
            </button>

            <div className="tl-speed" role="group" aria-label="Скорость">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`tl-speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => onSpeedChange(s)}
                  aria-pressed={speed === s}
                >
                  ×{s.toLocaleString('ru-RU')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tl-wrap {
          position: absolute;
          left: 50%;
          bottom: 1.25rem;
          transform: translateX(-50%);
          width: calc(100% - 2rem);
          max-width: 34rem;
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          pointer-events: none;
        }

        .tl-toasts {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          max-width: 100%;
        }

        .tl-toast {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          max-width: 100%;
          padding: 0.375rem 0.75rem 0.375rem 0.625rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--bg-2) 92%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
          color: var(--text);
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.2;
          box-shadow: 0 6px 20px color-mix(in srgb, var(--bg) 60%, transparent);
          backdrop-filter: blur(8px);
          opacity: 0;
          animation: tlToastIn 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards, tlToastOut 0.5s ease forwards;
        }

        .tl-toast svg {
          color: var(--accent);
          flex-shrink: 0;
        }

        .tl-toast span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tl-toast-more {
          color: var(--muted);
          font-weight: 500;
          border-color: var(--border);
        }

        @keyframes tlToastIn {
          from { opacity: 0; transform: translateY(0.5rem) scale(0.96); }
          to { opacity: 1; transform: none; }
        }

        @keyframes tlToastOut {
          from { opacity: 1; }
          to { opacity: 0; transform: translateY(-0.25rem); }
        }

        .tl-card {
          pointer-events: auto;
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          padding: 1rem 1.125rem;
          border-radius: var(--radius-lg);
          background: color-mix(in srgb, var(--bg-2) 94%, transparent);
          border: 1px solid var(--border);
          box-shadow: 0 16px 40px color-mix(in srgb, var(--bg) 70%, transparent);
          backdrop-filter: blur(12px);
        }

        .tl-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .tl-date-block {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .tl-eyebrow {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .tl-date {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.2;
          color: var(--text);
          font-variant-numeric: tabular-nums;
          animation: tlDateIn 0.35s cubic-bezier(0.2, 0, 0, 1);
        }

        @keyframes tlDateIn {
          from { opacity: 0.2; transform: translateY(0.25rem); }
          to { opacity: 1; transform: none; }
        }

        .tl-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          flex-shrink: 0;
          border-radius: var(--radius-sm);
          color: var(--muted);
          transition: background var(--transition), color var(--transition);
        }

        .tl-icon-btn:hover {
          background: var(--bg-3);
          color: var(--text);
        }

        .tl-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .tl-stat {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          padding: 0.5rem 0.625rem;
          border-radius: var(--radius-sm);
          background: var(--bg-3);
          min-width: 0;
        }

        .tl-stat-value {
          font-size: 1.125rem;
          font-weight: 700;
          line-height: 1.15;
          color: var(--text);
          font-variant-numeric: tabular-nums;
          animation: tlBump 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3);
        }

        @keyframes tlBump {
          0% { color: var(--accent-2); transform: scale(1.18); }
          100% { color: var(--text); transform: none; }
        }

        .tl-stat-label {
          font-size: 0.75rem;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tl-track-block {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .tl-track {
          position: relative;
          height: 1.5rem;
          display: flex;
          align-items: center;
        }

        .tl-track::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          border-radius: 999px;
          background: var(--bg-3);
        }

        .tl-track-fill {
          position: absolute;
          left: 0;
          height: 4px;
          border-radius: 999px;
          background: var(--accent);
          transition: width 0.3s linear;
        }

        .tl-track-thumb {
          position: absolute;
          width: 0.875rem;
          height: 0.875rem;
          margin-left: -0.4375rem;
          border-radius: 999px;
          background: var(--accent);
          border: 2px solid var(--bg-2);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
          transition: left 0.3s linear;
          pointer-events: none;
        }

        .tl-range {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          opacity: 0;
          cursor: pointer;
          border: none;
        }

        .tl-track-labels {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          font-size: 0.6875rem;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
        }

        .tl-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tl-play {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.75rem;
          height: 2.75rem;
          flex-shrink: 0;
          border-radius: 999px;
          background: var(--accent);
          color: var(--on-accent);
          box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent);
          transition: transform var(--transition), filter var(--transition);
        }

        .tl-play:hover {
          filter: brightness(1.08);
        }

        .tl-play:active {
          transform: scale(0.94);
        }

        .tl-follow {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          height: 2.25rem;
          padding: 0 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-3);
          color: var(--muted);
          font-size: 0.8125rem;
          font-weight: 600;
          transition: color var(--transition), border-color var(--transition), background var(--transition);
        }

        .tl-follow.active {
          color: var(--text);
          border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
          background: color-mix(in srgb, var(--accent) 12%, var(--bg-3));
        }

        .tl-follow.active svg {
          color: var(--accent);
        }

        .tl-speed {
          display: inline-flex;
          align-items: center;
          margin-left: auto;
          height: 2.25rem;
          padding: 0.1875rem;
          border-radius: 999px;
          background: var(--bg-3);
          border: 1px solid var(--border);
        }

        .tl-speed-btn {
          height: 100%;
          min-width: 2.375rem;
          padding: 0 0.5rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
          transition: background var(--transition), color var(--transition);
        }

        .tl-speed-btn.active {
          background: var(--bg-2);
          color: var(--text);
          box-shadow: 0 1px 3px color-mix(in srgb, var(--bg) 60%, transparent);
        }

        .tl-finished {
          align-items: stretch;
          text-align: center;
          animation: tlFinish 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1);
        }

        @keyframes tlFinish {
          from { opacity: 0; transform: translateY(0.75rem) scale(0.98); }
          to { opacity: 1; transform: none; }
        }

        .tl-finished-head {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .tl-finished-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text);
        }

        .tl-stats-big .tl-stat {
          align-items: center;
          padding: 0.75rem 0.5rem;
        }

        .tl-stats-big .tl-stat-value {
          font-size: 1.5rem;
          color: var(--accent);
          animation: none;
        }

        .tl-finished-actions {
          display: flex;
          gap: 0.5rem;
        }

        .tl-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          height: 2.75rem;
          padding: 0 1rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--bg-3);
          color: var(--text);
          font-size: 0.875rem;
          font-weight: 600;
          transition: filter var(--transition), border-color var(--transition);
        }

        .tl-btn:hover {
          border-color: var(--muted);
        }

        .tl-btn-accent {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--on-accent);
        }

        .tl-btn-accent:hover {
          filter: brightness(1.08);
          border-color: var(--accent);
        }

        @media (max-width: 767px) {
          .tl-wrap {
            bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
            width: calc(100% - 1rem);
          }

          .tl-card {
            padding: 0.75rem 0.875rem;
            gap: 0.625rem;
          }

          .tl-date {
            font-size: 1.0625rem;
          }

          .tl-stat {
            padding: 0.375rem 0.5rem;
          }

          .tl-stat-value {
            font-size: 1rem;
          }

          .tl-speed-btn {
            min-width: 2rem;
            padding: 0 0.375rem;
          }
        }

        @media (max-width: 359px) {
          .tl-follow span {
            display: none;
          }

          .tl-follow {
            width: 2.25rem;
            padding: 0;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};
