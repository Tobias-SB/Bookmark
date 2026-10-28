import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text } from 'react-native';

type TabItemProps = Pick<TabTriggerSlotProps, 'isFocused' | 'onPress' | 'onLongPress' | 'href'> & {
  label: string;
  /** `bar` items share the row equally; `rail` items keep their natural height. */
  layout: 'bar' | 'rail';
};

// Rendered as the child of `<TabTrigger asChild>`, which supplies focus state and press handlers.
export function TabItem({ label, layout, isFocused = false, onPress, onLongPress, href }: TabItemProps) {
  return (
    <Pressable
      role="tab"
      aria-selected={isFocused}
      aria-label={label}
      onPress={onPress}
      onLongPress={onLongPress}
      // Not in PressableProps; React Native Web renders it as a real link, so each tab has a URL.
      {...{ href }}
      className={`min-h-12 min-w-12 ${layout === 'bar' ? 'flex-1' : ''} items-center justify-center rounded-lg px-2 py-1 ${isFocused ? 'bg-primary' : ''}`}
    >
      <Text className={isFocused ? 'text-on-primary' : 'text-on-surface'}>
        {label}
      </Text>
    </Pressable>
  );
}
