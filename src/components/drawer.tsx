import { useSyncExternalStore, type ReactNode } from 'react';
import { Drawer } from '@mantine/core';

export interface OpenDrawerOptions {
  title: ReactNode;
  /** width of the drawer, 'xl' by default (details with tables need room) */
  size?: string | number;
  /** forms with unsaved data should not be closed by a click outside */
  closeOnClickOutside?: boolean;
  onClose?: () => void;
  render: (close: () => void) => ReactNode;
}

interface DrawerEntry extends OpenDrawerOptions {
  id: string;
  opened: boolean;
  close: () => void;
}

/**
 * Details (invoice, expense, client...) open in a drawer on the right: the list stays visible behind.
 * Same api as openModal. Drawers can be stacked (e.g. timesheet -> invoice).
 */
let entries: DrawerEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function update(next: DrawerEntry[]) {
  entries = next;
  emit();
}

export function openDrawer(options: OpenDrawerOptions) {
  const id = `drawer-${Math.random().toString(36).slice(2)}`;
  const close = () => {
    const entry = entries.find((e) => e.id === id);
    if (!entry?.opened) return;
    // keep it mounted during the closing transition
    update(entries.map((e) => (e.id === id ? { ...e, opened: false } : e)));
    entry.onClose?.();
    setTimeout(() => update(entries.filter((e) => e.id !== id)), 300);
  };
  update([...entries, { ...options, id, opened: true, close }]);
  return close;
}

export function closeAllDrawers() {
  update([]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** rendered once inside the providers (see App) */
export function DrawerHost() {
  const current = useSyncExternalStore(subscribe, () => entries);
  return (
    <>
      {current.map((d, i) => (
        <Drawer
          key={d.id}
          opened={d.opened}
          onClose={d.close}
          title={d.title}
          position="right"
          size={d.size ?? 'xl'}
          // below the modals (200): a drawer can open a confirmation, a mail form, a pdf...
          zIndex={150 + i}
          closeOnClickOutside={d.closeOnClickOutside ?? true}
          closeOnEscape={i === current.length - 1}
          styles={{ title: { fontWeight: 600 } }}
        >
          {d.render(d.close)}
        </Drawer>
      ))}
    </>
  );
}
