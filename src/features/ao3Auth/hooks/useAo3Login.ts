// src/features/ao3Auth/hooks/useAo3Login.ts
// Returns a navigateToLogin() function that opens the Ao3LoginScreen modal.
// Must be called from a component inside the NavigationContainer.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function useAo3Login() {
  const navigation = useNavigation<RootNav>();

  function navigateToLogin() {
    navigation.navigate('Ao3Login');
  }

  return { navigateToLogin };
}
