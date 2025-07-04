/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#000',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    error: '#dc2626', // Adding error color (red-600)
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    icon: '#fff',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    error: '#ef4444', // Adding error color (red-500 for dark mode)
  },
} as const;
