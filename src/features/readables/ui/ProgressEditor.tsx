// src/features/readables/ui/ProgressEditor.tsx
// §9 — Inline progress editor modal for the detail screen.
// Opened from ReadableDetailScreen. The calling screen owns the mutation —
// this component only validates input and calls onSave with the result.
//
// Only edits progressCurrent. totalUnits is edited via the full AddEditScreen.
//
// Uses RHF + Zod with the same string → number | null transform as the
// add/edit form (§10). keyboardType="number-pad" on the current field.
// Re-populates from readable each time the dialog opens so it always
// reflects the current saved state.
//
// errorMessage: passed by the parent when a save fails. Rendered inline
// so the user's typed values are preserved and they can retry without
// re-opening the modal.
//
// NOTE: This establishes the first feature-internal UI sub-component pattern.
// It is not exported from features/readables/index.ts — only ReadableDetailScreen
// imports it directly (same feature, same ui/ folder).

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAppTheme } from '../../../app/theme';
import { AppModal, AppModalButton } from '../../../shared/components/AppModal';
import type { Readable } from '../domain/readable';
import { progressNumberField } from './addEditSchema';

// ── Schema ────────────────────────────────────────────────────────────────────

const progressEditorSchema = z.object({
  current: progressNumberField,
});

type ProgressEditorValues = z.input<typeof progressEditorSchema>;
type ProgressEditorOutput = z.output<typeof progressEditorSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFormString(n: number | null): string {
  return n != null ? String(n) : '';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ProgressEditorProps {
  visible: boolean;
  /** Provides progressUnit and current values for pre-fill. */
  readable: Readable;
  /** Disables both buttons while the parent mutation is in flight. */
  isSaving: boolean;
  /**
   * Save error message from the parent mutation. Rendered inline so the
   * user's typed values are preserved and they can retry without re-opening.
   * Parent clears this at the start of each save attempt.
   */
  errorMessage?: string;
  onDismiss: () => void;
  /** Called with the validated progressCurrent value on submit. */
  onSave: (progressCurrent: number | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProgressEditor({
  visible,
  readable,
  isSaving,
  errorMessage,
  onDismiss,
  onSave,
}: ProgressEditorProps) {
  const theme = useAppTheme();

  const { control, handleSubmit, reset } = useForm<
    ProgressEditorValues,
    unknown,
    ProgressEditorOutput
  >({
    resolver: zodResolver(progressEditorSchema),
    defaultValues: {
      current: toFormString(readable.progressCurrent),
    },
  });

  // Re-populate the form each time the dialog opens so it reflects the
  // latest saved values (e.g. after a previous successful edit + query refetch).
  useEffect(() => {
    if (visible) {
      reset({
        current: toFormString(readable.progressCurrent),
      });
    }
  }, [visible, readable.progressCurrent, reset]);

  const onSubmit = handleSubmit((data: ProgressEditorOutput) => {
    onSave(data.current);
  });

  const unit = readable.progressUnit;

  return (
    <AppModal
      visible={visible}
      onDismiss={onDismiss}
      title="Edit Progress"
      dismissable={!isSaving}
    >
      <Controller
        control={control}
        name="current"
        render={({ field, fieldState }) => (
          <>
            <TextInput
              label={`Current ${unit}`}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={!!fieldState.error}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              mode="outlined"
              style={styles.input}
              accessibilityLabel={`Current ${unit}`}
            />
            {fieldState.error && (
              <HelperText type="error" visible>
                {fieldState.error.message}
              </HelperText>
            )}
          </>
        )}
      />

      {errorMessage && (
        <Text style={[styles.saveError, { color: theme.colors.danger }]}>
          {errorMessage}
        </Text>
      )}

      <AppModal.Actions>
        <AppModalButton
          label="Cancel"
          onPress={onDismiss}
          disabled={isSaving}
        />
        <AppModalButton
          label="Save"
          onPress={onSubmit}
          disabled={isSaving}
          loading={isSaving}
          variant="primary"
        />
      </AppModal.Actions>
    </AppModal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  input: {
    marginBottom: 4,
  },
  saveError: {
    fontSize: 13,
    marginTop: 8,
  },
});
