import React, {forwardRef, useCallback} from 'react';
import {Pressable} from 'react-native';
import type {GestureResponderEvent, PressableProps, View} from 'react-native';
import {Audio} from '../audio/AudioService';

/**
 * A `Pressable` that plays the UI click when it fires — the one to use for anything
 * the player reads as a button. Plain `Pressable` stays for tap-anywhere surfaces
 * (scrims, dismiss panels, skip-the-animation taps), which should not click.
 *
 * The click rides on `onPress`, so a disabled button stays silent for free.
 */
export const ClickPressable = forwardRef<View, PressableProps>(
  function ClickPressable({onPress, ...rest}, ref) {
    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        Audio.playClick();
        onPress?.(event);
      },
      [onPress],
    );
    return (
      <Pressable ref={ref} {...rest} onPress={onPress ? handlePress : undefined} />
    );
  },
);
