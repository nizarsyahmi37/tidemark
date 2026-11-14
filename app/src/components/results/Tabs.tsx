'use client';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem { id: string; label: string; hint?: string }

/** Accessible tab list: arrow keys / Home / End move between tabs. */
export function TabList({ items, active, onChange, label, variant = 'main' }: { items: TabItem[]; active: string; onChange: (id: string) => void; label: string; variant?: 'main' | 'pills' }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    refs.current[items[next].id]?.focus();
  };
  return (
    <div className={variant === 'main' ? 'tabbar' : 'pillbar'} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id} ref={(el) => { refs.current[item.id] = el; }} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`}
          aria-selected={active === item.id} tabIndex={active === item.id ? 0 : -1} className={active === item.id ? 'on' : ''}
          onClick={() => onChange(item.id)} onKeyDown={(event) => move(event, index)}
        >
          <span>{item.label}</span>{item.hint && <small>{item.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function Panel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  return <section role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={active !== id} className="tab-panel">{children}</section>;
}

/** Pills + panels in one go; all panels stay mounted (charts keep their size and state) but only one is visible. */
export function SubTabs({ items, active, onChange, label, children }: { items: TabItem[]; active: string; onChange: (id: string) => void; label: string; children: ReactNode }) {
  return <><TabList items={items} active={active} onChange={onChange} label={label} variant="pills" />{children}</>;
}
