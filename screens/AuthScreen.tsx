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

import { colors, radius, spacing, touch } from '../constants/theme';
import { BRAND_FOOTER, BRAND_SHORT, BRAND_TAGLINE } from '../constants/brand';
import AppIcon from '../components/AppIcon';
import GradePicker, { gradeLabel } from '../components/GradePicker';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_GRADE } from '../types';

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
 *
 * Form đăng ký KHÔNG còn phần chọn vai trò và KHÔNG còn ô mã PIN:
 *  - Mọi tài khoản mới là học sinh. Vai trò được chốt ở server chứ không đọc từ
 *    body, nếu không thì gửi `{"role":"parent"}` bằng curl là tự cấp quyền được.
 *  - Mã PIN phụ huynh đặt sau, trong Cài đặt → Khu vực phụ huynh. Bắt bé 8 tuổi
 *    nghĩ ra và nhớ thêm một mã 4 số ngay lúc đăng ký chỉ làm bé bỏ dở.
 */
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const [password, setPassword] = useState('');
  const [gradePickerOpen, setGradePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    setMessage(null);

    if (mode === 'signUp' && displayName.trim().length < 2) {
      setMessage({ type: 'error', text: 'Con nhập họ và tên giúp cô nhé.' });
      return;
    }
    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên đăng nhập.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      return;
    }

    setBusy(true);
    const result =
      mode === 'signIn'
        ? await signIn(username, password)
        : await signUp({
            username,
            password,
            displayName: displayName.trim(),
            grade,
          });
    setBusy(false);

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Có lỗi xảy ra, thử lại nhé.' });
      return;
    }
    // Thành công: AuthProvider đổi session, App.tsx tự chuyển sang màn chính
    setPassword('');
  }, [displayName, grade, mode, password, signIn, signUp, username]);

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
          <AppIcon size={96} />
          <Text style={styles.heroTitle}>{BRAND_SHORT}</Text>
          <Text style={styles.heroSubtitle}>{BRAND_TAGLINE}</Text>
        </View>

        {/*
          Không còn banner "Chưa cấu hình máy chủ": thiếu máy chủ không phải lỗi.
          App tự chạy Local Mode (tài khoản và tiến độ nằm trong AsyncStorage),
          nên nhắc người dùng sửa .env chỉ làm màn hình đăng nhập rối thêm.
        */}
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

          {/* Họ và tên — chỉ khi đăng ký. Đặt đầu tiên vì đây là ô dễ nhất. */}
          {mode === 'signUp' && (
            <>
              <Text style={styles.fieldLabel}>Họ và tên của con</Text>
              <TextInput
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setMessage(null);
                }}
                placeholder="vidu: Nguyễn Minh Khang"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                maxLength={48}
                editable={!busy}
                style={styles.input}
                accessibilityLabel="Họ và tên"
              />
              <Text style={styles.hint}>Tên này sẽ hiện ở đầu ứng dụng.</Text>
            </>
          )}

          <Text style={styles.fieldLabel}>Tên đăng nhập</Text>
          <TextInput
            value={username}
            onChangeText={(text) => {
              // Lọc ngay khi gõ để khớp đúng ràng buộc của server
              setUsername(text.replace(/[^a-zA-Z0-9_.-]/g, ''));
              setMessage(null);
            }}
            placeholder="vidu: minhkhang2026"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            editable={!busy}
            style={styles.input}
            accessibilityLabel="Tên đăng nhập"
          />
          {mode === 'signUp' && (
            <Text style={styles.hint}>Viết liền, không dấu — dùng để vào app.</Text>
          )}

          {/* Khối lớp — chỉ khi đăng ký */}
          {mode === 'signUp' && (
            <>
              <Text style={styles.fieldLabel}>Khối lớp</Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setGradePickerOpen(true);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Khối lớp hiện chọn: ${gradeLabel(grade)}. Bấm để đổi.`}
                style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
              >
                <Text style={styles.selectorText}>🎓 {gradeLabel(grade)}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.primary} />
              </Pressable>
            </>
          )}

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
              : 'Mỗi tài khoản có điểm và giờ chơi game riêng, không lẫn với bạn khác. Phụ huynh đặt mã PIN sau, trong Cài đặt.'}
          </Text>
        </View>

        <Text style={styles.versionLabel}>{BRAND_FOOTER}</Text>
      </ScrollView>

      <GradePicker
        visible={gradePickerOpen}
        value={grade}
        onSelect={setGrade}
        onClose={() => setGradePickerOpen(false)}
      />
    </KeyboardAvoidingView>
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

  hero: { alignItems: 'center', gap: spacing.sm },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  heroSubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

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

  /** Ô bấm mở hộp thoại chọn khối lớp — trông như input để cùng một hàng lối */
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.primary,
    backgroundColor: colors.background,
  },
  selectorText: { fontSize: 16, fontWeight: '700', color: colors.text },

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
    minHeight: touch.primary,
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
