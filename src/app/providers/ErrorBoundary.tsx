// src/app/providers/ErrorBoundary.tsx
// App-root error boundary for unexpected runtime crashes only — not for
// repository errors, validation errors, metadata failures, or navigation
// errors, which are all handled at the hook/screen level.
//
// Placement in App.tsx: inside PaperProvider, outside QueryClientProvider.
// This lets the fallback UI access Paper components and theme tokens while
// still catching crashes anywhere in the provider/screen tree below.
//
// Pattern: class component (required by React) delegates fallback rendering to
// a functional ErrorFallback component so that useAppTheme() can be called
// normally — hooks cannot run inside class component render methods.
//
// NOTE: This establishes the ErrorBoundary pattern in src/app/providers/.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useAppTheme } from '../theme';

// ── Fallback UI ───────────────────────────────────────────────────────────────
// Functional component — has full access to hooks including useAppTheme.

interface FallbackProps {
  onReset: () => void;
}

function ErrorFallback({ onReset }: FallbackProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.textPrimary }]}
      >
        Something went wrong
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: theme.colors.textSecondary }]}
      >
        An unexpected error occurred. Please try again.
      </Text>
      <Button mode="contained" onPress={onReset}>
        Try again
      </Button>
    </View>
  );
}

// ── Error boundary class ──────────────────────────────────────────────────────
// Class component is required — React only supports error boundaries as classes.

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // In a production app this would forward to a crash reporter (e.g. Sentry).
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
