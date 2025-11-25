// src/features/suggestions/components/SuggestionReasonBlock.tsx
import React from 'react';
import { Text } from 'react-native-paper';

interface Props {
  reason: string;
}

const SuggestionReasonBlock: React.FC<Props> = ({ reason }) => {
  return <Text variant="bodySmall">{reason}</Text>;
};

export default SuggestionReasonBlock;
