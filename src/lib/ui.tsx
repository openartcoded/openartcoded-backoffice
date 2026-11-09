import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

export const toast = {
  success: (message: string) => notifications.show({ color: 'green', message, autoClose: 4000 }),
  error: (message: string) => notifications.show({ color: 'red', message, autoClose: 6000 }),
};

/** promise based confirmation dialog (replaces window.confirm) */
export function confirm(message: string, opts: { title?: string; danger?: boolean; confirmLabel?: string } = {}) {
  return new Promise<boolean>((resolve) => {
    modals.openConfirmModal({
      title: opts.title ?? 'Please confirm',
      children: <Text size="sm">{message}</Text>,
      labels: { confirm: opts.confirmLabel ?? 'Confirm', cancel: 'Cancel' },
      confirmProps: { color: opts.danger === false ? 'blue' : 'red' },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      onClose: () => resolve(false),
    });
  });
}

export async function copyToClipboard(text: string | undefined | null, successMessage = 'Copied') {
  if (!text) return;
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard api not available');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (e) {
    toast.error(`error: ${e}`);
  }
}
