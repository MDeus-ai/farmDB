import React, { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface FarmScrollerThemeProps {
  dockAware?: boolean;
  fillParent?: boolean;
  keyboardAware?: boolean;
  indicatorTopInset?: number;
  indicatorBottomInset?: number;
  surfaceTone?: 'page' | 'card';
  containerStyle?: StyleProp<ViewStyle>;
}

interface FocusableNativeNode {
  measureInWindow?: (
    cb: (x: number, y: number, width: number, height: number) => void
  ) => void;
}

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(Math.max(0, e.endCoordinates?.height ?? 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
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
  keyboardAware = true,
  indicatorTopInset: _indicatorTopInset,
  indicatorBottomInset: _indicatorBottomInset,
  surfaceTone: _surfaceTone,
  containerStyle: _containerStyle,
  style,
  contentContainerStyle,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  automaticallyAdjustKeyboardInsets,
  overScrollMode,
  onScroll,
  scrollEventThrottle,
  children,
  ...rest
}: ScrollViewProps & FarmScrollerThemeProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const scrollYRef = useRef(0);
  const keyboardHeight = useKeyboardHeight();
  const isVerticalKeyboardAware = Boolean(keyboardAware && !rest.horizontal);

  useEffect(() => {
    if (!isVerticalKeyboardAware || Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = Math.max(0, e.endCoordinates?.height ?? 0);
      if (kbHeight <= 0) return;
      const winHeight = Dimensions.get('window').height;
      const keyboardTop =
        e.endCoordinates?.screenY && e.endCoordinates.screenY > 0
          ? e.endCoordinates.screenY
          : winHeight - kbHeight;

      setTimeout(() => {
        try {
          const textInputState = (
            TextInput as unknown as {
              State?: { currentlyFocusedInput?: () => FocusableNativeNode | null };
            }
          ).State;
          const focused = textInputState?.currentlyFocusedInput?.();
          const scroller = scrollRef.current as unknown as FocusableNativeNode | null;
          if (
            !focused ||
            typeof focused.measureInWindow !== 'function' ||
            !scroller ||
            typeof scroller.measureInWindow !== 'function'
          ) {
            return;
          }
          scroller.measureInWindow((_sx, sy, _sw, sh) => {
            focused.measureInWindow?.((_ix, iy, _iw, ih) => {
              if (ih <= 0) return;
              // Ensure the focused input actually belongs within this vertical scroll container
              if (iy < sy - 24 || iy > sy + sh + kbHeight) return;
              const inputBottom = iy + ih;
              const safeBottom = keyboardTop - 24;
              if (inputBottom > safeBottom) {
                const delta = inputBottom - safeBottom;
                scrollRef.current?.scrollTo({
                  y: Math.max(0, scrollYRef.current + delta),
                  animated: true,
                });
              }
            });
          });
        } catch {
          // Safe no-op if native view detached while closing keyboard/modal.
        }
      }, 65);
    });
    return () => {
      sub.remove();
    };
  }, [isVerticalKeyboardAware]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll]
  );

  let effectiveContentStyle: StyleProp<ViewStyle> = contentContainerStyle;
  if (isVerticalKeyboardAware && keyboardHeight > 0) {
    const flat = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
    const baseBottom =
      typeof flat?.paddingBottom === 'number'
        ? flat.paddingBottom
        : typeof flat?.paddingVertical === 'number'
          ? flat.paddingVertical
          : typeof flat?.padding === 'number'
            ? flat.padding
            : 0;
    effectiveContentStyle = [
      contentContainerStyle,
      { paddingBottom: baseBottom + keyboardHeight + 32 },
    ];
  }

  return (
    <ScrollView
      ref={scrollRef}
      {...rest}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      style={[fillParent ? styles.fill : styles.shrink, style]}
      contentContainerStyle={effectiveContentStyle}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      overScrollMode={overScrollMode ?? 'never'}
      keyboardDismissMode={keyboardDismissMode ?? 'on-drag'}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets ?? true}
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
