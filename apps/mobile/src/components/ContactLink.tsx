import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { FARMDB_COLORS, FARMDB_FONTS } from '../theme/uiScale';

export async function openPhoneLink(phone: string): Promise<void> {
  const trimmed = phone.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return;
  const target = `tel:${hasLeadingPlus ? `+${digits}` : digits}`;
  try {
    await Linking.openURL(target);
  } catch {
    // No dialer registered or simulator runtime without tel: handler
  }
}

export async function openEmailLink(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) return;
  try {
    await Linking.openURL(`mailto:${trimmed}`);
  } catch {
    // No mail app registered on current runtime
  }
}

export function PhoneLink({
  phone,
  fontSize = 12,
  style,
}: {
  phone: string;
  fontSize?: number;
  style?: StyleProp<TextStyle>;
}) {
  const clean = phone.trim();
  if (!clean) return null;
  return (
    <Pressable
      onPress={() => void openPhoneLink(clean)}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={`Call ${clean}`}
      style={({ pressed }) => [styles.inlineWrap, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, { fontSize }, style]}>{clean}</Text>
    </Pressable>
  );
}

export function EmailLink({
  email,
  fontSize = 12,
  style,
}: {
  email: string;
  fontSize?: number;
  style?: StyleProp<TextStyle>;
}) {
  const clean = email.trim();
  if (!clean) return null;
  return (
    <Pressable
      onPress={() => void openEmailLink(clean)}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={`Email ${clean}`}
      style={({ pressed }) => [styles.inlineWrap, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, { fontSize }, style]}>{clean}</Text>
    </Pressable>
  );
}

const CONTACT_TOKEN_REGEX =
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\+?\d[\d\s\-().]{5,}\d)/g;

export function SmartContactLink({
  value,
  fontSize = 12,
  textStyle,
  linkStyle,
}: {
  value: string;
  fontSize?: number;
  textStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}) {
  const parts: Array<{ kind: 'text' | 'email' | 'phone'; text: string }> = [];
  let lastIndex = 0;

  for (const match of value.matchAll(CONTACT_TOKEN_REGEX)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ kind: 'text', text: value.slice(lastIndex, start) });
    }
    if (token.includes('@')) {
      parts.push({ kind: 'email', text: token });
    } else if (token.replace(/\D/g, '').length >= 7) {
      parts.push({ kind: 'phone', text: token });
    } else {
      parts.push({ kind: 'text', text: token });
    }
    lastIndex = start + token.length;
  }
  if (lastIndex < value.length) {
    parts.push({ kind: 'text', text: value.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <View style={styles.rowWrap}>
      {parts.map((part, idx) => {
        if (part.kind === 'email') {
          return (
            <EmailLink
              key={`email-${idx}`}
              email={part.text}
              fontSize={fontSize}
              style={linkStyle}
            />
          );
        }
        if (part.kind === 'phone') {
          return (
            <PhoneLink
              key={`phone-${idx}`}
              phone={part.text}
              fontSize={fontSize}
              style={linkStyle}
            />
          );
        }
        return (
          <Text
            key={`text-${idx}`}
            style={[styles.plainText, { fontSize }, textStyle]}
          >
            {part.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  inlineWrap: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.65,
  },
  linkText: {
    color: FARMDB_COLORS.accent,
    fontFamily: FARMDB_FONTS.semibold,
    textDecorationLine: 'underline',
  },
  plainText: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.regular,
  },
});
