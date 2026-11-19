import { type AppUpdateInfo } from '@farmdb/core';
import { APP_ICONS } from '../assets/icons';

interface UpdateAvailableModalProps {
  visible: boolean;
  currentVersion: string;
  update: AppUpdateInfo | null;
  installing: boolean;
  progressPercent: number | null;
  progressLabel: string | null;
  errorText: string | null;
  onInstall: () => void;
  onClose: () => void;
}

function formatPublishedDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function UpdateAvailableModal({
  visible,
  currentVersion,
  update,
  installing,
  progressPercent,
  progressLabel,
  errorText,
  onInstall,
  onClose,
}: UpdateAvailableModalProps) {
  if (!visible || !update) {
    return null;
  }

  const fixes =
    update.fixes.length > 0
      ? update.fixes
      : ['General stability, performance, and offline reliability improvements.'];
  const dateLabel = formatPublishedDate(update.publishedAt);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-update-modal-title"
    >
      <div className="modal-card update-modal-card">
        <div className="modal-header" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className="settings-card-icon">
              <img src={APP_ICONS.downloads} alt="" className="app-icon-md" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="desktop-update-modal-title" className="modal-title">
                Update Available
              </h2>
              <div className="update-modal-meta">
                <span className="update-version-pill">
                  v{currentVersion} → v{update.version}
                </span>
                {dateLabel && (
                  <span className="update-date-pill">Released {dateLabel}</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={installing}
            onClick={onClose}
            aria-label="Close update dialog"
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
          </button>
        </div>

        <div className="update-modal-body">
          {update.summary && (
            <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.5 }}>
              {update.summary}
            </p>
          )}

          <div className="update-fixes-box">
            <h3 className="update-fixes-heading">
              What&apos;s Fixed &amp; Improved in v{update.version}
            </h3>
            <ul className="update-fixes-list">
              {fixes.map((fix, idx) => (
                <li key={`${idx}-${fix.slice(0, 24)}`}>
                  <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                  <span>{fix}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="update-safety-note">
            <img src={APP_ICONS.databaseCheck} alt="" className="app-icon-sm" />
            <span>
              Your local SQLite database, livestock photos, and farm settings remain completely safe.
            </span>
          </div>

          {installing && (
            <div className="update-progress-panel" role="status">
              <div className="update-progress-row">
                <span>{progressLabel || `Installing farmDB v${update.version}...`}</span>
                {progressPercent !== null && <strong>{progressPercent}%</strong>}
              </div>
              <div className="update-progress-track">
                <div
                  className="update-progress-fill"
                  style={{
                    width: `${progressPercent !== null ? Math.max(8, progressPercent) : 45}%`,
                  }}
                />
              </div>
            </div>
          )}

          {errorText && (
            <div className="notice-banner" role="alert">
              <span>{errorText}</span>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={installing}
            onClick={onClose}
          >
            Remind Me Later
          </button>
          {update.canDirectInstall ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={installing}
              onClick={onInstall}
            >
              <img src={APP_ICONS.downloads} alt="" className="app-icon-sm" />
              {installing ? 'Installing Update...' : `Install v${update.version} & Restart`}
            </button>
          ) : (
            <a
              href={update.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <img src={APP_ICONS.downloads} alt="" className="app-icon-sm" />
              Download v{update.version} Installer
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
