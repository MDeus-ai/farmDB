import type { AppSectionMeta } from '@farmdb/core';

interface SectionPlaceholderProps {
  section: AppSectionMeta;
  recordCount: number;
  tableName: string;
}

export function SectionPlaceholder({
  section,
  recordCount,
  tableName,
}: SectionPlaceholderProps) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{section.label}</h1>
          <p className="page-subtitle">{section.description}</p>
        </div>
      </div>

      <div className="card">
        <p style={{ marginTop: 0, fontWeight: 600 }}>
          Scheduled for Phase {section.phase}
        </p>
        <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          The underlying SQLite table <code>{tableName}</code> and Drizzle ORM
          schema are already initialized and migrated on this device.
        </p>
        <div className="stat-card" style={{ maxWidth: 240 }}>
          <p className="stat-label">Current Rows in {tableName}</p>
          <p className="stat-value">{recordCount}</p>
        </div>
      </div>
    </>
  );
}
