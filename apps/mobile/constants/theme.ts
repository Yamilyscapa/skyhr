/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#D4E1FF';
const tintColorDark = '#A3BFFF';

export const Colors = {
  light: {
    text: '#000',
    background: '#fff',
    card: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#0051FE',
    neutral: '#E0E0E0',
  },
  dark: {
    text: '#fff',
    background: '#151718',
    card: '#1E1E1E',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: '#0041CC',
    neutral: '#595959',
  },
};

export const TextSize = {
  h1: 36,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  p: 14,
  small: 12,
};

export const Fonts = Platform.select({
  ios: {
    /** Inter font family */
    sans: 'Inter_400Regular',
    /** Inter Medium */
    medium: 'Inter_500Medium',
    /** Inter SemiBold */
    semiBold: 'Inter_600SemiBold',
    /** Inter Bold */
    bold: 'Inter_700Bold',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    /** Inter font family */
    sans: 'Inter_400Regular',
    /** Inter Medium */
    medium: 'Inter_500Medium',
    /** Inter SemiBold */
    semiBold: 'Inter_600SemiBold',
    /** Inter Bold */
    bold: 'Inter_700Bold',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    medium: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    semiBold: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    bold: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
