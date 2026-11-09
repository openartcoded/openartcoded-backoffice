import type { ReactNode } from 'react';
import { modals } from '@mantine/modals';
import type { MantineSize, MantineTransition } from '@mantine/core';

export interface OpenModalOptions {
  title: ReactNode;
  size?: MantineSize | string | number;
  fullScreen?: boolean;
  /** forms with unsaved data should not be closed by a click outside */
  closeOnClickOutside?: boolean;
  onClose?: () => void;
  /** mantine transition of the modal (fade-down by default) */
  transition?: MantineTransition;
  render: (close: () => void) => ReactNode;
}

/**
 * Opens a modal rendered by the mantine modal manager.
 * The content receives a close callback. Returns the close function.
 */
export function openModal({ title, size = 'lg', fullScreen, closeOnClickOutside = true, onClose, transition, render }: OpenModalOptions) {
  const modalId = `modal-${Math.random().toString(36).slice(2)}`;
  const close = () => modals.close(modalId);
  modals.open({
    modalId,
    title,
    size,
    fullScreen,
    closeOnClickOutside,
    closeOnEscape: closeOnClickOutside,
    onClose,
    transitionProps: transition ? { transition } : undefined,
    children: render(close),
  });
  return close;
}

/** true when a modal is currently displayed (keyboard shortcuts are then ignored) */
export function hasOpenModal(): boolean {
  return !!document.querySelector('[role="dialog"]');
}
