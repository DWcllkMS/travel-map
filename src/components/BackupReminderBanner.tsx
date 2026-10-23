import React from 'react';
import { Save } from 'lucide-react';

interface BackupReminderBannerProps {
  onExport: () => void;
  onDismiss: () => void;
}

export const BackupReminderBanner: React.FC<BackupReminderBannerProps> = ({
  onExport,
  onDismiss
}) => {
  return (
    <div className="backup-banner">
      <Save size={16} className="banner-icon" color="var(--accent)" />
      <span className="banner-text">
        Сохрани бэкап — данные хранятся только на этом устройстве
      </span>
      <div className="banner-actions">
        <button className="banner-action-btn primary" onClick={onExport}>
          Сохранить
        </button>
        <button className="banner-action-btn secondary" onClick={onDismiss}>
          Позже
        </button>
      </div>

      <style>{`
        .backup-banner {
          position: fixed;
          bottom: 76px;
          left: 12px;
          right: 12px;
          max-width: 520px;
          margin: 0 auto;
          background: var(--bg-2);
          border: 1px solid var(--accent);
          border-radius: var(--radius);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 25;
          animation: bannerIn var(--transition);
        }

        @keyframes bannerIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .banner-icon {
          flex-shrink: 0;
        }

        .banner-text {
          font-size: 12px;
          color: var(--text);
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .banner-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .banner-action-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
        }

        .banner-action-btn.primary {
          background: var(--accent);
          color: var(--text);
        }

        .banner-action-btn.secondary {
          background: var(--bg-3);
          color: var(--muted);
        }

        @media (min-width: 768px) {
          .backup-banner {
            bottom: 24px;
            right: 24px;
            margin: 0;
            left: auto;
          }
        }
      `}</style>
    </div>
  );
};
