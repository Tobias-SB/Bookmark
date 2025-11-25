// src/components/common/PrimaryButton.tsx
import React from 'react';
import { Button } from 'react-native-paper';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, onPress, disabled }) => {
  return (
    <Button mode="contained" onPress={onPress} disabled={disabled}>
      {label}
    </Button>
  );
};

export default PrimaryButton;
