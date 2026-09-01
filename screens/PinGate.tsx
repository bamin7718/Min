import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

/**
 * Màn hình yêu cầu nhập mã PIN phụ huynh.
 *
 * PIN được xác thực Ở SERVER (`/api/account?action=verify-pin`) chứ không so
 * sánh trong app, nên không thể đọc PIN từ bundle. Đổi lại là **cần có mạng** —
 * đây là đánh đổi có chủ ý, xem ghi chú trong README.
 */
export default function PinGate({
  title,
  description,
  onCancel,
}: {
  title: string;
  description: string;
  /** Bỏ trống nếu không cho phép thoát (ví dụ khoá ngay khi mở app) */
  onCancel?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { verifyPin, signOut } = useAuth();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const playShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const submit = useCallback(async () => {
    Keyboard.dismiss();
    if (!/^\d{4}$/.test(pin)) {
      setError('Mã PIN gồm đúng 4 chữ số.');
      playShake();
      return;
    }

    setBusy(true);
    setError(null);
    const result = await verifyPin(pin);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Mã PIN không đúng.');
      setPin('');
      playShake();
    }
    // Thành công: AuthContext bật pinUnlocked, màn hình gọi sẽ tự đóng gate
  }, [pin, playShake, verifyPin]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl }]}>
      <Animated.View style={[styles.card, { transform: [{ translateX }] }]}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <TextInput
          value={pin}
          onChangeText={(text) => {
            setPin(text.replace(/[^0-9]/g, ''));
            setError(null);
          }}
          placeholder="• • • •"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          editable={!busy}
          onSubmitEditing={submit}
          style={styles.input}
          accessibilityLabel="Mã PIN phụ huynh"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Xác nhận mã PIN"
          style={({ pressed }) => [
            styles.primaryButton,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="lock-open-outline" size={20} color={colors.textOnPrimary} />
              <Text style={styles.primaryText}>Mở khoá</Text>
            </>
          )}
        </Pressable>

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Quay lại</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất"
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Đăng xuất tài khoản khác</Text>
          </Pressable>
        )}

        <Text style={styles.hint}>
          Mã PIN được kiểm tra trên máy chủ nên cần có mạng. Quên PIN thì đăng xuất rồi
          đăng nhập lại bằng tài khoản phụ huynh khác.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    fontSize: 26,
    letterSpacing: 12,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  primaryButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    minHeight: 52,
  },
  primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  textButton: { paddingVertical: spacing.md },
  textButtonLabel: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: { opacity: 0.78 },
});
