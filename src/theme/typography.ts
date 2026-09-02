import {Platform} from 'react-native';
import type {TextStyle} from 'react-native';
import {theme} from './theme';

/**
 * Poppins/Inter are the design fonts (§10.1). Until the TTFs are linked into
 * android/app/src/main/assets/fonts we fall back to the platform's own faces so
 * nothing renders in a missing-font box. Swap `family()` to the token names once
 * the assets ship — every call site reads from here.
 */
const FONTS_BUNDLED = false;

function family(token: string, weight: TextStyle['fontWeight']) {
  if (FONTS_BUNDLED) {
    return {fontFamily: token} as const;
  }
  return Platform.select<TextStyle>({
    android: {fontFamily: 'sans-serif', fontWeight: weight},
    default: {fontWeight: weight},
  }) as TextStyle;
}

export const type = {
  display: (size: number): TextStyle => ({
    ...family(theme.font.display, '800'),
    fontSize: size,
    letterSpacing: size * 0.02,
    color: theme.text.primary,
  }),
  ui: (size: number): TextStyle => ({
    ...family(theme.font.ui, '600'),
    fontSize: size,
    color: theme.text.primary,
  }),
  body: (size: number): TextStyle => ({
    ...family(theme.font.body, '400'),
    fontSize: size,
    color: theme.text.secondary,
  }),
};
