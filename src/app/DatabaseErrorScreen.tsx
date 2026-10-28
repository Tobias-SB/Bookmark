import { Pressable, Text, View } from 'react-native';

import { t } from '@/shared/i18n';

// Spec §8.5. shortcut: "Export database file" waits for the files adapter in Phase 1.
export function DatabaseErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface p-6">
      <Text role="heading" className="text-center text-xl text-on-surface">
        {t('database.error.title')}
      </Text>
      <Text className="text-center text-on-surface-variant">{t('database.error.body')}</Text>
      <Pressable role="button" onPress={onRetry} className="min-h-12 justify-center rounded-lg bg-primary px-6">
        <Text className="text-on-primary">{t('common.tryAgain')}</Text>
      </Pressable>
    </View>
  );
}
