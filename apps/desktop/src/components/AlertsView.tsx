import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  ALERT_KIND_HINTS,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  formatDisplayDate,
  getAlertUrgency,
  getTodayIsoDate,
  validateNewAlert,
  type AlertEntryKind,
  type AlertItem,
  type NewAlertInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  AlertValidationError,
  useAlertList,
  useCreateAlert,
  useDeleteAlert,
  useFarmSettings,
  useLivestockList,
  useModulePermissions,
  useToggleAlertResolved,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

interface AlertsViewProps {
  onCheckDueNow: () => Promise<number>;
}

export function AlertsView({ onCheckDueNow }: AlertsViewProps) {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('alerts');
  const allAlertsQuery = useAlertList({});

  const [kindFilter, setKindFilter] = useState<AlertEntryKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>(
    'open'
  );
  const [search, setSearch] = useState('');

  const filteredAlertsQuery = useAlertList({
    entryKind: kindFilter,
    status: statusFilter,
    search: search || undefined,
  });

  const createMutation = useCreateAlert();
  const toggleMutation = useToggleAlertResolved();
  const deleteMutation = useDeleteAlert();

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const linkedAnimalOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'General Farm', iconSrc: APP_ICONS.barnAlt },
      ...animals.map((a) =>
        buildAnimalSelectOption(a, {
          dateFormat: settings.dateFormat,
          label: `${a.tagNumber}${a.name ? ` — ${a.name}` : ''}`,
        })
      ),
    ],
    [animals, settings.dateFormat]
  );

  const kindOptions = useMemo<ModernSelectOption<AlertEntryKind | 'all'>[]>(
    () => [
      { value: 'all', label: 'Alerts & Notes', iconSrc: APP_ICONS.pin },
      { value: 'alert', label: 'Alerts Only', iconSrc: APP_ICONS.notification },
      { value: 'note', label: 'Notes Only', iconSrc: APP_ICONS.stickyNote },
    ],
    []
  );

  const statusOptions = useMemo<ModernSelectOption<'all' | 'open' | 'resolved'>[]>(
    () => [
      { value: 'open', label: 'Open', iconSrc: APP_ICONS.notification },
      { value: 'resolved', label: 'Resolved', iconSrc: APP_ICONS.checkmark },
      { value: 'all', label: 'All Statuses', iconSrc: APP_ICONS.calendar },
    ],
    []
  );

  const [entryKind, setEntryKind] = useState<AlertEntryKind>('alert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [livestockId, setLivestockId] = useState('');
  const [triggerDate, setTriggerDate] = useState(() => getTodayIsoDate());
  const [errors, setErrors] = useState<ValidationErrors<NewAlertInput>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkingDue, setCheckingDue] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allItems = allAlertsQuery.data ?? [];
  const visibleItems = filteredAlertsQuery.data ?? [];
  const todayIso = getTodayIsoDate();

  const counts = useMemo(() => {
    let openAlerts = 0;
    let dueOrOverdue = 0;
    let notes = 0;
    let resolved = 0;

    for (const item of allItems) {
      if (item.isResolved) {
        resolved += 1;
        continue;
      }
      if (item.entryKind === 'note') {
        notes += 1;
      } else {
        openAlerts += 1;
        if (item.triggerDate <= todayIso) {
          dueOrOverdue += 1;
        }
      }
    }

    return { openAlerts, dueOrOverdue, notes, resolved };
  }, [allItems, todayIso]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatusMessage(null);

    const check = validateNewAlert({
      entryKind,
      title,
      description,
      livestockId: livestockId || null,
      triggerDate: entryKind === 'note' ? getTodayIsoDate() : triggerDate,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const created = await createMutation.mutateAsync(check.data);
      setTitle('');
      setDescription('');
      setStatusMessage(
        created.entryKind === 'alert'
          ? `Alert scheduled for ${created.triggerDate}.`
          : 'Note saved locally.'
      );
      if (created.entryKind === 'alert' && created.triggerDate <= getTodayIsoDate()) {
        await onCheckDueNow();
      }
    } catch (err) {
      if (err instanceof AlertValidationError) {
        setErrors(err.errors);
      } else {
        setStatusMessage(
          err instanceof Error ? err.message : 'Failed to save entry.'
        );
      }
    }
  }

  async function handleRunDueCheck() {
    setCheckingDue(true);
    setStatusMessage(null);
    try {
      const count = await onCheckDueNow();
      setStatusMessage(
        count > 0
          ? `Dispatched ${count} due alert notification(s).`
          : 'No unnotified due alerts right now.'
      );
    } finally {
      setCheckingDue(false);
    }
  }

  function renderUrgencyBadge(item: AlertItem) {
    const urgency = getAlertUrgency(item, todayIso);
    switch (urgency) {
      case 'overdue':
        return <span className="status-pill status-deceased">Overdue</span>;
      case 'due_today':
        return <span className="status-pill status-sold">Due Today</span>;
      case 'upcoming':
        return <span className="status-pill status-active">Upcoming</span>;
      case 'note':
        return <span className="tag-chip">Note</span>;
      case 'resolved':
        return <span className="tag-chip">Resolved</span>;
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts &amp; Notes</h1>
        </div>

        <div className="row-actions">
          {(!canEdit || !canDelete) && (
            <span className="status-pill status-sold">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleRunDueCheck()}
            disabled={checkingDue}
          >
            <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
            {checkingDue ? 'Checking...' : 'Check Due Alerts Now'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Open Alerts</p>
          <p className="stat-value">{counts.openAlerts}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Due Today / Overdue</p>
          <p
            className="stat-value"
            style={{
              color: counts.dueOrOverdue > 0 ? 'var(--danger)' : 'var(--text)',
            }}
          >
            {counts.dueOrOverdue}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Active Notes</p>
          <p className="stat-value">{counts.notes}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Resolved</p>
          <p className="stat-value">{counts.resolved}</p>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <h2 className="card-section-title">New Alert or Note</h2>

          {!canEdit ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              View-Only Access: Your account can review reminders and notes, but cannot schedule or resolve entries.
            </p>
          ) : (
            <>
          <div className="view-toggle" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={entryKind === 'alert' ? 'active' : ''}
              title={ALERT_KIND_HINTS.alert}
              onClick={() => setEntryKind('alert')}
              style={{ padding: '8px 14px', display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <img src={APP_ICONS.notification} alt="" className="app-icon-sm" />
              <span>Alert</span>
            </button>
            <button
              type="button"
              className={entryKind === 'note' ? 'active' : ''}
              title={ALERT_KIND_HINTS.note}
              onClick={() => setEntryKind('note')}
              style={{ padding: '8px 14px', display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <img src={APP_ICONS.stickyNote} alt="" className="app-icon-sm" />
              <span>Note</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label" htmlFor="alert-title">
                  Title *
                </label>
                <input
                  id="alert-title"
                  className="input"
                  placeholder={
                    entryKind === 'alert'
                      ? 'e.g. Due for vaccination'
                      : 'e.g. Pasture rotation note'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {errors.title && (
                  <span className="field-error">{errors.title}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="alert-animal">
                  Animal (Optional)
                </label>
                <ModernSelect
                  id="alert-animal"
                  fullWidth
                  searchable
                  ariaLabel="Linked animal"
                  value={livestockId}
                  options={linkedAnimalOptions}
                  onChange={setLivestockId}
                />
              </div>

              {entryKind === 'alert' && (
                <div className="form-field">
                  <label className="form-label" htmlFor="alert-trigger-date">
                    Trigger Date *
                  </label>
                  <ModernDatePicker
                    id="alert-trigger-date"
                    ariaLabel="Alert trigger date"
                    value={triggerDate}
                    onChange={setTriggerDate}
                  />
                  {errors.triggerDate && (
                    <span className="field-error">{errors.triggerDate}</span>
                  )}
                </div>
              )}

              <div className="form-field full">
                <label className="form-label" htmlFor="alert-desc">
                  Details
                </label>
                <input
                  id="alert-desc"
                  className="input"
                  placeholder="Optional instructions or observations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {statusMessage && (
              <p className="success-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                {statusMessage}
              </p>
            )}

            <div style={{ marginTop: 14 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending}
              >
                <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                {createMutation.isPending
                  ? 'Saving...'
                  : entryKind === 'alert'
                    ? 'Schedule Alert'
                    : 'Save Note'}
              </button>
            </div>
          </form>
            </>
          )}
        </div>

        <div className="card">
          <div className="toolbar">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input
                className="input"
                placeholder="Search alerts and notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ModernSelect
              ariaLabel="Filter by entry kind"
              value={kindFilter}
              options={kindOptions}
              onChange={setKindFilter}
            />

            <ModernSelect
              ariaLabel="Filter by resolved status"
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
            />
          </div>

          {visibleItems.length === 0 ? (
            <div className="empty-state">
              No matching alerts or notes.
            </div>
          ) : (
            <div className="alert-list">
              {visibleItems.map((item) => {
                const animal = item.livestockId
                  ? animalsById.get(item.livestockId)
                  : null;
                return (
                  <div key={item.id} className="alert-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {renderUrgencyBadge(item)}
                        {animal && (
                          <>
                            <span className="tag-chip">{animal.tagNumber}</span>
                            <AnimalEyeButton livestockId={animal.id} />
                          </>
                        )}
                        <strong>{item.title}</strong>
                      </div>
                      {item.description && (
                        <p style={{ margin: '5px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                          {item.description}
                        </p>
                      )}
                      <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.entryKind === 'alert'
                          ? `Trigger: ${formatDisplayDate(item.triggerDate, settings.dateFormat)}${item.notifiedAt ? ' · Notified' : ''}`
                          : `Logged: ${formatDisplayDate(item.triggerDate, settings.dateFormat)}`}
                      </p>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="row-actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              void toggleMutation.mutateAsync({
                                id: item.id,
                                isResolved: !item.isResolved,
                              })
                            }
                            title={item.isResolved ? 'Reopen' : 'Mark Resolved'}
                          >
                            {item.isResolved ? (
                              <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
                            ) : (
                              <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                            )}
                          </button>
                        )}
                        {canDelete &&
                          (confirmDeleteId === item.id ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  void deleteMutation.mutateAsync(item.id);
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (settings.confirmBeforeDelete) {
                                  setConfirmDeleteId(item.id);
                                } else {
                                  void deleteMutation.mutateAsync(item.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              aria-label="Delete alert or note"
                            >
                              <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
