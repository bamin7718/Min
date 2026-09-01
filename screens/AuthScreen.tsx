import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

type Mode = 'signIn' | 'signUp';

interface FormMessage {
  type: 'error' | 'info';
  text: string;
}

/**
 * Màn hình Đăng nhập / Đăng ký.
 *
 * Mọi việc xác thực diễn ra ở `api/auth` — app chỉ gửi tên đăng nhập và mật
 * khẩu qua HTTPS rồi nhận về session token. App không giữ token database và
 * không tự truy vấn bảng `users`.
 */
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { isConfigured, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    setMessage(null);

    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên đăng nhập.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      return;
    }
    if (mode === 'signUp' && role === 'parent' && !/^\d{4}$/.test(pin)) {
      setMessage({ type: 'error', text: 'Phụ huynh cần nhập mã PIN gồm đúng 4 chữ số.' });
      return;
    }

    setBusy(true);
    const result =
      mode === 'signIn'
        ? await signIn(username, password)
        : await signUp({ username, password, role, pin: role === 'parent' ? pin : undefined });
    setBusy(false);

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Có lỗi xảy ra, thử lại nhé.' });
      return;
    }
    // Thành công: AuthProvider đổi session, App.tsx tự chuyển sang màn chính
    setPassword('');
    setPin('');
  }, [mode, password, pin, role, signIn, signUp, username]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>📚🎮</Text>
          <Text style={styles.heroTitle}>Học tập & Góc Game</Text>
          <Text style={styles.heroSubtitle}>Dành cho học sinh Lớp 3</Text>
        </View>

        {!isConfigured && (
          <View style={styles.warnCard}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
            <Text style={styles.warnText}>
              Chưa cấu hình máy chủ. Hãy điền EXPO_PUBLIC_PROGRESS_API_URL trong tệp
              .env rồi chạy lại: npx expo start -c
            </Text>
          </View>
        )}

        <View style={styles.card}>
          {/* Tab switcher Đăng nhập / Đăng ký */}
          <View style={styles.segmented}>
            {(['signIn', 'signUp'] as Mode[]).map((option) => {
              const isActive = mode === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => switchMode(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={
                    option === 'signIn' ? 'Chuyển sang Đăng nhập' : 'Chuyển sang Đăng ký'
                  }
                  style={({ pressed }) => [
                    styles.segment,
                    isActive && styles.segmentActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.segmentText, isActive && styles.segmentTextActive]}
                  >
                    {option === 'signIn' ? 'Đăng nhập' : 'Đăng ký'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Tên đăng nhập</Text>
          <TextInput
            value={username}
            onChangeText={(text) => {
              // Lọc ngay khi gõ để khớp đúng ràng buộc của server
              setUsername(text.replace(/[^a-zA-Z0-9_.-]/g, ''));
              setMessage(null);
            }}
            placeholder="vidu: minh.anh"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            editable={!busy}
            style={styles.input}
            accessibilityLabel="Tên đăng nhập"
          />

          <Text style={styles.fieldLabel}>Mật khẩu</Text>
          <TextInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setMessage(null);
            }}
            placeholder="Ít nhất 6 ký tự"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            editable={!busy}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            style={styles.input}
            accessibilityLabel="Mật khẩu"
          />

          {/* Chọn vai trò — chỉ khi đăng ký */}
          {mode === 'signUp' && (
            <>
              <Text style={styles.fieldLabel}>Em là ai?</Text>
              <View style={styles.roleRow}>
                <RoleCard
                  label="Học sinh"
                  emoji="🧑‍🎓"
                  description="Làm bài và đổi giờ chơi game"
                  isActive={role === 'student'}
                  onPress={() => {
                    setRole('student');
                    setMessage(null);
                  }}
                />
                <RoleCard
                  label="Phụ huynh"
                  emoji="👨‍👩‍👧"
                  description="Cấp thêm giờ, cần mã PIN"
                  isActive={role === 'parent'}
                  onPress={() => {
                    setRole('parent');
                    setMessage(null);
                  }}
                />
              </View>

              {role === 'parent' && (
                <>
                  <Text style={styles.fieldLabel}>Mã PIN phụ huynh (4 số)</Text>
                  <TextInput
                    value={pin}
                    onChangeText={(text) => {
                      setPin(text.replace(/[^0-9]/g, ''));
                      setMessage(null);
                    }}
                    placeholder="4 chữ số"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    editable={!busy}
                    style={styles.input}
                    accessibilityLabel="Mã PIN phụ huynh"
                  />
                  <Text style={styles.hint}>
                    PIN này dùng để cấp thêm giờ chơi game và mở khu vực tài khoản.
                  </Text>
                </>
              )}
            </>
          )}

          {message && (
            <Text
              style={[
                styles.message,
                message.type === 'error' ? styles.messageError : styles.messageInfo,
              ]}
            >
              {message.text}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signIn' ? 'Xác nhận đăng nhập' : 'Xác nhận đăng ký'}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.buttonDisabled,
              pressed && !busy && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'signIn' ? 'log-in-outline' : 'person-add-outline'}
                  size={20}
                  color={colors.textOnPrimary}
                />
                <Text style={styles.primaryButtonText}>
                  {mode === 'signIn' ? 'Đăng nhập' : 'Tạo tài khoản'}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.hint}>
            {mode === 'signIn'
              ? 'Chưa có tài khoản? Bấm "Đăng ký" ở trên.'
              : 'Mỗi tài khoản có điểm và giờ chơi game riêng, không lẫn với bạn khác.'}
          </Text>
        </View>

        <Text style={styles.versionLabel}>Phiên bản v{APP_VERSION}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({
  label,
  emoji,
  description,
  isActive,
  onPress,
}: {
  label: string;
  emoji: string;
  description: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`Chọn vai trò ${label}`}
      style={({ pressed }) => [
        styles.roleCard,
        isActive && styles.roleCardActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <Text style={[styles.roleLabel, isActive && styles.roleLabelActive]}>{label}</Text>
      <Text style={styles.roleDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  hero: { alignItems: 'center', gap: spacing.xs },
  heroEmoji: { fontSize: 48 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  heroSubtitle: { fontSize: 14, color: colors.textMuted },

  warnCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warnText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  segmentTextActive: { color: colors.textOnPrimary },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },

  roleRow: { flexDirection: 'row', gap: spacing.md },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.surface,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleEmoji: { fontSize: 28 },
  roleLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  roleLabelActive: { color: colors.primary },
  roleDescription: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },

  message: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm, lineHeight: 19 },
  messageError: { color: colors.danger },
  messageInfo: { color: colors.primary },

  primaryButton: {
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
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },

  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },
  versionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.78 },
});
