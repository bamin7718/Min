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
import { useAuth } from '../context/AuthContext';
import { usePlaytime } from '../context/PlaytimeContext';
import type { SyncState } from '../types';

type Mode = 'signIn' | 'signUp';

interface FormMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

/**
 * Màn hình tài khoản dành cho phụ huynh: đăng nhập Supabase để đồng bộ tiến độ
 * của con giữa nhiều thiết bị. Ứng dụng vẫn dùng được bình thường khi không
 * đăng nhập — lúc đó dữ liệu chỉ nằm trên máy.
 */
export default function AuthScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { isConfigured, initializing, user } = useAuth();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Tài khoản & Đồng bộ</Text>
          <Text style={styles.headerSubtitle}>Khu vực dành cho phụ huynh</Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={24} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SyncStatusCard />

        {!isConfigured ? (
          <NotConfiguredCard />
        ) : initializing ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.mutedText}>Đang kiểm tra đăng nhập...</Text>
          </View>
        ) : user ? (
          <AccountCard />
        ) : (
          <AuthForm />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ trạng thái đồng bộ                                              */
/* ------------------------------------------------------------------ */

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SYNC_LABELS: Record<
  SyncState,
  { icon: IoniconName; text: string; color: string }
> = {
  disabled: {
    icon: 'cloud-offline-outline',
    text: 'Chưa cấu hình Supabase — chạy offline',
    color: colors.textMuted,
  },
  signedOut: {
    icon: 'cloud-outline',
    text: 'Chưa đăng nhập — dữ liệu chỉ lưu trên máy này',
    color: colors.warning,
  },
  syncing: {
    icon: 'sync-outline',
    text: 'Đang đồng bộ...',
    color: colors.primary,
  },
  synced: {
    icon: 'cloud-done-outline',
    text: 'Đã đồng bộ với Supabase',
    color: colors.success,
  },
  error: {
    icon: 'alert-circle-outline',
    text: 'Đồng bộ thất bại',
    color: colors.danger,
  },
};

function SyncStatusCard() {
  const { syncState, syncError, lastSyncedAt } = usePlaytime();
  const label = SYNC_LABELS[syncState];

  return (
    <View style={[styles.statusCard, { borderColor: label.color }]}>
      <Ionicons name={label.icon} size={22} color={label.color} />
      <View style={styles.statusTextGroup}>
        <Text style={[styles.statusText, { color: label.color }]}>{label.text}</Text>
        {syncState === 'error' && syncError && (
          <Text style={styles.statusDetail}>{syncError}</Text>
        )}
        {syncState === 'synced' && lastSyncedAt && (
          <Text style={styles.statusDetail}>
            Lần cuối: {new Date(lastSyncedAt).toLocaleTimeString('vi-VN')}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Chưa cấu hình Supabase                                              */
/* ------------------------------------------------------------------ */

function NotConfiguredCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chưa bật đồng bộ</Text>
      <Text style={styles.cardBody}>
        Ứng dụng đang chạy hoàn toàn offline và vẫn hoạt động đầy đủ — điểm và thời
        gian chơi game được lưu ngay trên máy.
      </Text>
      <Text style={styles.cardBody}>Để bật đồng bộ nhiều thiết bị:</Text>
      <Text style={styles.codeBlock}>
        {'1. Mở tệp .env\n' +
          '2. Điền EXPO_PUBLIC_SUPABASE_URL\n' +
          '   và EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
          '3. Chạy lại: npx expo start -c'}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Biểu mẫu đăng nhập / đăng ký                                        */
/* ------------------------------------------------------------------ */

function AuthForm() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập email.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      return;
    }

    setBusy(true);
    setMessage(null);

    const result =
      mode === 'signIn'
        ? await signIn(email, password)
        : await signUp(email, password);

    setBusy(false);

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Có lỗi xảy ra.' });
      return;
    }

    if (result.needsEmailConfirmation) {
      setMessage({
        type: 'info',
        text:
          'Đã tạo tài khoản. Vui lòng mở email và bấm liên kết xác nhận, ' +
          'sau đó quay lại đăng nhập.',
      });
      setPassword('');
      return;
    }

    // Đăng nhập thành công: onAuthStateChange sẽ tự đổi giao diện sang AccountCard.
    setPassword('');
  }, [email, mode, password, signIn, signUp]);

  return (
    <View style={styles.card}>
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
                option === 'signIn'
                  ? 'Chuyển sang Đăng nhập'
                  : 'Chuyển sang Tạo tài khoản'
              }
              style={({ pressed }) => [
                styles.segment,
                isActive && styles.segmentActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {option === 'signIn' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Email phụ huynh</Text>
      <TextInput
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setMessage(null);
        }}
        placeholder="phuhuynh@email.com"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Email phụ huynh"
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
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
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
            message.type === 'error' && styles.messageError,
            message.type === 'success' && styles.messageSuccess,
            message.type === 'info' && styles.messageInfo,
          ]}
        >
          {message.text}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          mode === 'signIn' ? 'Xác nhận đăng nhập' : 'Xác nhận tạo tài khoản'
        }
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
        Đăng nhập là tuỳ chọn. Không đăng nhập thì tiến độ vẫn được lưu trên máy, chỉ
        là không đồng bộ sang thiết bị khác.
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Đã đăng nhập                                                        */
/* ------------------------------------------------------------------ */

function AccountCard() {
  const { user, signOut } = useAuth();
  const { syncNow, syncState } = usePlaytime();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const handleSyncNow = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    await syncNow();
    setBusy(false);
  }, [syncNow]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await signOut();
    setBusy(false);

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Không đăng xuất được.' });
    }
  }, [signOut]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Đang đăng nhập</Text>

      <View style={styles.accountRow}>
        <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
        <View style={styles.accountTextGroup}>
          <Text style={styles.accountEmail}>{user?.email ?? '—'}</Text>
          <Text style={styles.accountMeta}>
            Tiến độ của con được đồng bộ tự động lên Supabase.
          </Text>
        </View>
      </View>

      {message && <Text style={[styles.message, styles.messageError]}>{message.text}</Text>}

      <Pressable
        onPress={handleSyncNow}
        disabled={busy || syncState === 'syncing'}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primaryButton,
          (busy || syncState === 'syncing') && styles.buttonDisabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        {busy || syncState === 'syncing' ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <>
            <Ionicons name="sync" size={20} color={colors.textOnPrimary} />
            <Text style={styles.primaryButtonText}>Đồng bộ ngay</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={handleSignOut}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.dangerButtonText}>Đăng xuất</Text>
      </Pressable>

      <Text style={styles.hint}>
        Đăng xuất không làm mất tiến độ trên máy này — chỉ dừng đồng bộ.
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTextGroup: { flex: 1 },
  headerTitle: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#DBE4FF', fontSize: 13, marginTop: 2 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  centerBlock: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  mutedText: { color: colors.textMuted, fontSize: 14 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  statusTextGroup: { flex: 1 },
  statusText: { fontSize: 14, fontWeight: '700' },
  statusDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  codeBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 18,
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
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.primary },
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

  message: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm, lineHeight: 19 },
  messageError: { color: colors.danger },
  messageSuccess: { color: colors.success },
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
    minHeight: 50,
  },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },

  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  dangerButtonText: { color: colors.danger, fontSize: 14, fontWeight: '700' },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  accountTextGroup: { flex: 1 },
  accountEmail: { fontSize: 15, fontWeight: '800', color: colors.text },
  accountMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },

  pressed: { opacity: 0.75 },
});
