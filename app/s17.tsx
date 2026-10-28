import * as AlertDialog from '@rn-primitives/alert-dialog';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';

const THEMES = ['light', 'dark', 'black'] as const;

export default function S17Screen() {
  const { theme } = useUniwind();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface p-4">
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <View className="w-full max-w-md gap-2 rounded-xl border border-outline p-4">
        <Text className="text-lg text-on-surface">S17 themed card</Text>
        <Text className="text-on-surface">Current theme: {theme}</Text>
      </View>
      <View className="flex-row gap-2">
        {THEMES.map((name) => (
          <Pressable
            key={name}
            role="button"
            accessibilityState={{ selected: theme === name }}
            onPress={() => Uniwind.setTheme(name)}
            className="min-h-12 min-w-12 justify-center rounded-lg bg-primary px-4"
          >
            <Text className="text-on-primary">{name}</Text>
          </Pressable>
        ))}
      </View>
      <AlertDialog.Root>
        <AlertDialog.Trigger className="min-h-12 justify-center rounded-lg border border-outline px-4">
          <Text className="text-on-surface">Open dialog</Text>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="absolute inset-0 items-center justify-center bg-surface/80 p-4">
            <AlertDialog.Content className="w-full max-w-sm gap-4 rounded-xl border border-outline bg-surface p-4">
              <AlertDialog.Title className="text-lg text-on-surface">Delete this?</AlertDialog.Title>
              <AlertDialog.Description className="text-on-surface">
                Spike dialog for focus and role checks.
              </AlertDialog.Description>
              <View className="flex-row justify-end gap-2">
                <AlertDialog.Cancel className="min-h-12 justify-center rounded-lg border border-outline px-4">
                  <Text className="text-on-surface">Cancel</Text>
                </AlertDialog.Cancel>
                <AlertDialog.Action className="min-h-12 justify-center rounded-lg bg-primary px-4">
                  <Text className="text-on-primary">Delete</Text>
                </AlertDialog.Action>
              </View>
            </AlertDialog.Content>
          </AlertDialog.Overlay>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </View>
  );
}
