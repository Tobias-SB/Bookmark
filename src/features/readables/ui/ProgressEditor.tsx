// src/features/readables/ui/ProgressEditor.tsx
// §9 — Inline progress editor modal for the detail screen.
// Opened from ReadableDetailScreen. The calling screen owns the mutation —
// this component only validates input and calls onSave with the result.
//
// Uses RHF + Zod with the same string → number | null transform as the
// add/edit form (§10). keyboardType="number-pad" on both fields (§10).
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

import React, { useEffect, useRef } from 'react';
import { StyleSheet, TextInput as RNTextInput } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAppTheme } from '../../../app/theme';
import type { Readable } from '../domain/readable';
import { progressNumberField } from './addEditSchema';

// ── Schema ────────────────────────────────────────────────────────────────────

const progressEditorSchema = z.object({
  current: progressNumberField,
  total: progressNumberField,
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
  /** Called with validated (number | null) values on submit. */
  onSave: (progressCurrent: number | null, progressTotal: number | null) => void;
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
  const totalRef = useRef<RNTextInput>(null);

  const { control, handleSubmit, reset } = useForm<
    ProgressEditorValues,
    unknown,
    ProgressEditorOutput
  >({
    resolver: zodResolver(progressEditorSchema),
    defaultValues: {
      current: toFormString(readable.progressCurrent),
      total: toFormString(readable.progressTotal),
    },
  });

  // Re-populate the form each time the dialog opens so it reflects the
  // latest saved values (e.g. after a previous successful edit + query refetch).
  useEffect(() => {
    if (visible) {
      reset({
        current: toFormString(readable.progressCurrent),
        total: toFormString(readable.progressTotal),
      });
    }
  }, [visible, readable.progressCurrent, readable.progressTotal, reset]);

  const onSubmit = handleSubmit((data: ProgressEditorOutput) => {
    onSave(data.current, data.total);
  });

  const unit = readable.progressUnit;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Edit Progress</Dialog.Title>
        <Dialog.Content style={styles.content}>

          {/* Current */}
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
                  returnKeyType="next"
                  onSubmitEditing={() => totalRef.current?.focus()}
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

          {/* Total */}
          <Controller
            control={control}
            name="total"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  ref={totalRef}
                  label={`Total ${unit} (optional)`}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={!!fieldState.error}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                  mode="outlined"
                  style={styles.input}
                  accessibilityLabel={`Total ${unit}, optional`}
                />
                {fieldState.error && (
                  <HelperText type="error" visible>
                    {fieldState.error.message}
                  </HelperText>
                )}
              </>
            )}
          />

          {/* Save error — shown inline so the user can retry without re-opening */}
          {errorMessage && (
            <Text
              variant="bodySmall"
              style={[styles.saveError, { color: theme.colors.error }]}
            >
              {errorMessage}
            </Text>
          )}

        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={isSaving}>
            Cancel
          </Button>
          <Button onPress={onSubmit} disabled={isSaving} loading={isSaving}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    gap: 4,
  },
  input: {
    // Paper TextInput handles internal padding
  },
  saveError: {
    marginTop: 8,
  },
});
