// src/shared/components/ConfirmDialog.tsx
// §9, §12 — Reusable confirmation dialog for destructive actions (e.g. delete).
// Migrated from Paper Dialog/Portal to AppModal for full Scholar's Library
// theme control and to avoid MD3 elevation surface tinting.

import React from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '../../app/theme';
import { AppModal, AppModalButton } from './AppModal';

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
    <AppModal
      visible={visible}
      onDismiss={onCancel}
      title={title}
      dismissable={!loading}
    >
      <Text style={{ color: theme.colors.textBody, fontSize: 15, lineHeight: 22 }}>
        {message}
      </Text>

      <AppModal.Actions>
        <AppModalButton
          label="Cancel"
          onPress={onCancel}
          disabled={loading}
        />
        <AppModalButton
          label={confirmLabel}
          onPress={onConfirm}
          disabled={loading}
          loading={loading}
          variant="destructive"
        />
      </AppModal.Actions>
    </AppModal>
  );
}
