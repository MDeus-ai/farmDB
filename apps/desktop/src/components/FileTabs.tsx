import React from 'react';

export interface FileTabItem<T extends string = string> {
  id: T;
  label: string;
  iconSrc?: string;
}

interface FileTabsProps<T extends string> {
  tabs: readonly FileTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  surface?: 'page' | 'card';
  trailing?: React.ReactNode;
}

/** Binder / file-folder style tab bar anchored flush to the surface below. */
export function FileTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  surface = 'page',
  trailing,
}: FileTabsProps<T>) {
  return (
    <div
      className={`file-tabs-row ${surface === 'card' ? 'surface-card' : 'surface-page'}`}
    >
      <div className="file-tabs-list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`file-tab${active ? ' active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.iconSrc && (
                <img src={tab.iconSrc} alt="" className="app-icon-sm" />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {trailing ? <div className="file-tabs-trailing">{trailing}</div> : null}
    </div>
  );
}
