/**
 * HapticTab
 *
 * Custom tab bar button with soft haptic feedback on press.
 * Uses React Native Pressable directly to avoid @react-navigation imports
 * which are banned in expo-router SDK 56+.
 */

import { Pressable, type GestureResponderEvent, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

// Minimal type that matches what expo-router's Tabs tabBarButton prop expects
type TabBarButtonProps = PressableProps & {
  children?: React.ReactNode;
};

export function HapticTab({ onPressIn, ...props }: TabBarButtonProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev: GestureResponderEvent) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
