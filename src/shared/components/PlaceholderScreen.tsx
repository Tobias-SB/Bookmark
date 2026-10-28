import { Text, View } from 'react-native';

// shortcut: stand-in for tab screens until their Phase 1 features land; delete with the last one.
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface p-4">
      <Text role="heading" className="text-2xl text-on-surface">
        {title}
      </Text>
    </View>
  );
}
