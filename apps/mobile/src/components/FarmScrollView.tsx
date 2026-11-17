import React from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  type FlatListProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface FarmScrollerThemeProps {
  dockAware?: boolean;
  fillParent?: boolean;
  indicatorTopInset?: number;
  indicatorBottomInset?: number;
  surfaceTone?: 'page' | 'card';
  containerStyle?: StyleProp<ViewStyle>;
}

const isWeb = Platform.OS === 'web';

const WEB_SCROLLBAR_CSS = `
* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
*::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
`;

export function installWebScrollbarStyles(): void {
  if (!isWeb) return;
  const g = globalThis as unknown as {
    document?: {
      head?: { appendChild: (node: unknown) => void };
      getElementById: (id: string) => unknown;
      createElement: (tag: string) => { id: string; textContent: string };
    };
  };
  const doc = g.document;
  if (!doc || !doc.head) return;
  const existing = doc.getElementById('farmdb-mobile-web-scrollbars') as
    | { textContent: string }
    | null;
  if (existing) {
    existing.textContent = WEB_SCROLLBAR_CSS;
    return;
  }
  const styleEl = doc.createElement('style');
  styleEl.id = 'farmdb-mobile-web-scrollbars';
  styleEl.textContent = WEB_SCROLLBAR_CSS;
  doc.head.appendChild(styleEl);
}

export function FarmScrollView({
  dockAware: _dockAware = false,
  fillParent = true,
  indicatorTopInset: _indicatorTopInset,
  indicatorBottomInset: _indicatorBottomInset,
  surfaceTone: _surfaceTone,
  containerStyle: _containerStyle,
  style,
  keyboardDismissMode,
  overScrollMode,
  children,
  ...rest
}: ScrollViewProps & FarmScrollerThemeProps) {
  return (
    <ScrollView
      {...rest}
      style={[fillParent ? styles.fill : styles.shrink, style]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      overScrollMode={overScrollMode ?? 'never'}
      keyboardDismissMode={keyboardDismissMode ?? 'on-drag'}
    >
      {children}
    </ScrollView>
  );
}

export function FarmFlatList<ItemT>({
  dockAware: _dockAware = false,
  fillParent = true,
  indicatorTopInset: _indicatorTopInset,
  indicatorBottomInset: _indicatorBottomInset,
  surfaceTone: _surfaceTone,
  containerStyle: _containerStyle,
  style,
  keyboardDismissMode,
  overScrollMode,
  ...rest
}: FlatListProps<ItemT> & FarmScrollerThemeProps) {
  return (
    <FlatList<ItemT>
      {...rest}
      style={[fillParent ? styles.fill : styles.shrink, style]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      overScrollMode={overScrollMode ?? 'never'}
      keyboardDismissMode={keyboardDismissMode ?? 'on-drag'}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
});
