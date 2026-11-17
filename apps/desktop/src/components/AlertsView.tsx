import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import {
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
  useLivestockList,
  useToggleAlertResolved,
} from '@farmdb/db';

interface AlertsViewProps {
  onCheckDueNow: () => Promise<number>;
}

export function AlertsView({ onCheckDueNow }: AlertsViewProps) {
  const livestockQuery = useLivestockList({});
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

  const [entryKind, setEntryKind] = useState<AlertEntryKind>('alert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [livestockId, setLivestockId] = useState('');
  const [triggerDate, setTriggerDate] = useState(() => getTodayIsoDate());
  const [errors, setErrors] = useState<ValidationErrors<NewAlertInput>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkingDue, setCheckingDue] = useState(false);

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
          <p className="page-subtitle">
            Schedule reminders monitored every 60 seconds by the background worker, or save farm &amp; animal notes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void handleRunDueCheck()}
          disabled={checkingDue}
        >
          <BellRing size={16} />
          {checkingDue ? 'Checking...' : 'Check Due Alerts Now'}
        </button>
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

          <div className="view-toggle" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={entryKind === 'alert' ? 'active' : ''}
              onClick={() => setEntryKind('alert')}
              style={{ padding: '8px 14px', display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <Bell size={15} />
              <span>Alert</span>
            </button>
            <button
              type="button"
              className={entryKind === 'note' ? 'active' : ''}
              onClick={() => setEntryKind('note')}
              style={{ padding: '8px 14px', display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <StickyNote size={15} />
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
                <select
                  id="alert-animal"
                  className="select"
                  value={livestockId}
                  onChange={(e) => setLivestockId(e.target.value)}
                >
                  <option value="">General Farm</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tagNumber}
                      {a.name ? ` — ${a.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {entryKind === 'alert' && (
                <div className="form-field">
                  <label className="form-label" htmlFor="alert-trigger-date">
                    Trigger Date *
                  </label>
                  <input
                    id="alert-trigger-date"
                    type="date"
                    className="input"
                    value={triggerDate}
                    onChange={(e) => setTriggerDate(e.target.value)}
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
                <Plus size={16} />
                {createMutation.isPending
                  ? 'Saving...'
                  : entryKind === 'alert'
                    ? 'Schedule Alert'
                    : 'Save Note'}
              </button>
            </div>
          </form>
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

            <select
              className="select"
              aria-label="Filter by entry kind"
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as AlertEntryKind | 'all')
              }
            >
              <option value="all">Alerts &amp; Notes</option>
              <option value="alert">Alerts Only</option>
              <option value="note">Notes Only</option>
            </select>

            <select
              className="select"
              aria-label="Filter by resolved status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'open' | 'resolved')
              }
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
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
                          <span className="tag-chip">{animal.tagNumber}</span>
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
                          ? `Trigger: ${item.triggerDate}${item.notifiedAt ? ' · Notified' : ''}`
                          : `Logged: ${item.triggerDate}`}
                      </p>
                    </div>

                    <div className="row-actions">
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
                          <RotateCcw size={14} />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void deleteMutation.mutateAsync(item.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="Delete alert or note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
