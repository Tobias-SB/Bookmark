// src/shared/components/ConfirmDialog.tsx
// §9, §12 — Reusable confirmation dialog for destructive actions (e.g. delete).
// Backed by React Native Paper's Dialog + Portal.
// The confirm button uses the theme error color to signal the destructive nature.
//
// NOTE: This establishes a second component in src/shared/components/ alongside
// EmptyState. Future reusable dialog primitives should follow this as a template.

import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useAppTheme } from '../../app/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Disables both buttons while an async action is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useAppTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onPress={onConfirm}
            disabled={loading}
            loading={loading}
            textColor={theme.colors.error}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
