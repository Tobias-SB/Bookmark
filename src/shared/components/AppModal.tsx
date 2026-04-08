// src/shared/components/AppModal.tsx
// NOTE: This establishes the AppModal pattern in src/shared/components/.
// A fully themed modal that bypasses Paper's MD3 elevation system entirely,
// avoiding purple/primary-colour surface tinting on Dialog backgrounds.
//
// Usage:
//   <AppModal visible={visible} onDismiss={onDismiss} title="Edit Progress">
//     {/* content */}
//     <AppModal.Actions>
//       <AppModalButton label="Cancel" onPress={onDismiss} />
//       <AppModalButton label="Save" onPress={onSave} variant="primary" loading={isSaving} />
//     </AppModal.Actions>
//   </AppModal>
//
// AppModalButton variants:
//   default     — text-only, textMeta colour (Cancel / secondary)
//   primary     — filled pill, antiquarian gold (Save / confirm)
//   destructive — filled pill, danger red (Delete / irreversible)

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '../../app/theme';

// ── AppModalButton ────────────────────────────────────────────────────────────

export interface AppModalButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'destructive';
}

export function AppModalButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'default',
}: AppModalButtonProps) {
  const theme = useAppTheme();

  const isFilled = variant === 'primary' || variant === 'destructive';
  const fillColor =
    variant === 'primary' ? theme.colors.statusCompletedBorder :
    variant === 'destructive' ? theme.colors.danger :
    undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.button,
        isFilled && { backgroundColor: fillColor },
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFilled ? '#FFFFFF' : theme.colors.textMeta}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isFilled
              ? { color: '#FFFFFF', fontWeight: '600' }
              : { color: theme.colors.kindBook },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── AppModal.Actions ──────────────────────────────────────────────────────────

function AppModalActions({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.actions,
        { borderTopColor: theme.colors.backgroundBorder },
      ]}
    >
      {children}
    </View>
  );
}

// ── AppModal ──────────────────────────────────────────────────────────────────

export interface AppModalProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** Set false to prevent backdrop tap from dismissing. */
  dismissable?: boolean;
  children: React.ReactNode;
}

export function AppModal({
  visible,
  onDismiss,
  title,
  dismissable = true,
  children,
}: AppModalProps) {
  const theme = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop — tapping outside dismisses when dismissable */}
      <Pressable
        style={styles.backdrop}
        onPress={dismissable ? onDismiss : undefined}
      >
        {/* Card — inner Pressable stops touch propagation to the backdrop */}
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.backgroundCard,
              borderRadius: theme.radii.card,
              ...theme.shadows.card,
            },
          ]}
        >
          {/* Title */}
          <View
            style={[
              styles.titleRow,
              { borderBottomColor: theme.colors.backgroundBorder },
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.kindFanfic }]}>
              {title}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Attach Actions as a static property so callers use <AppModal.Actions>
AppModal.Actions = AppModalActions;

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  buttonText: {
    fontSize: 14,
  },
});
