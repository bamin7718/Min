import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_SPACE,
  colors,
  elevation,
  radius,
  spacing,
  touch,
} from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { useAuth } from '../context/AuthContext';
import { usePlaytime } from '../context/PlaytimeContext';
import { checkAppUpdate, type UpdateInfo } from '../lib/updateChecker';
import {
  checkOta,
  downloadAndApplyOta,
  isOtaSupported,
  runningUpdateLabel,
} from '../lib/otaUpdates';
import PinGate from './PinGate';
import UpdateModal from './UpdateModal';

/** Đường dẫn tải APK, đặt trong .env */
const APK_URL = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL?.trim();

interface Message {
  type: 'ok' | 'error';
  text: string;
}

/**
 * @param embedded Màn này mở được từ hai chỗ: modal bánh răng (chiếm cả màn hình
 *   nên phải tự chừa tai thỏ) và tab "Cài Đặt" (nằm dưới thanh header cố định,
 *   phần tai thỏ đã được chừa sẵn). `embedded` phân biệt hai trường hợp đó để
 *   không chừa khoảng trắng hai lần.
 */
export default function SettingsScreen({
  onClose,
  embedded = false,
}: {
  onClose: () => void;
  embedded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const isParent = session?.role === 'parent';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: (embedded ? 0 : insets.top) + spacing.md },
        ]}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng cài đặt"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textOnPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cài đặt</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_SPACE },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <NameSection />
        {/* Mục PIN chỉ tồn tại với tài khoản phụ huynh */}
        {isParent && <PinSection />}
        {isParent && <AppLockSection />}
        <UpdateSection />
        <SignOutSection onClose={onClose} />

        <Text style={styles.footerVersion}>
          📚🎮 Học tập & Góc Game Lớp 3 · v{APP_VERSION}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Mục 1: Tên người dùng                                               */
/* ------------------------------------------------------------------ */

function NameSection() {
  const { session, updateUserName } = useAuth();
  const [name, setName] = useState(session?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const save = useCallback(async () => {
    Keyboard.dismiss();
    setBusy(true);
    setMessage(null);

    const result = await updateUserName(name);
    setBusy(false);
    setMessage(
      result.ok
        ? { type: 'ok', text: 'Đã lưu tên mới.' }
        : { type: 'error', text: result.error ?? 'Không lưu được tên.' },
    );
  }, [name, updateUserName]);

  return (
    <Section icon="person-outline" title="Tên người dùng">
      <TextInput
        value={name}
        onChangeText={(text) => {
          setName(text.replace(/[^a-zA-Z0-9_.-]/g, ''));
          setMessage(null);
        }}
        placeholder="Tên hiển thị"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        maxLength={24}
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Tên người dùng"
      />
      {message && <Message message={message} />}

      <ActionButton
        label="Lưu tên"
        icon="save-outline"
        busy={busy}
        onPress={save}
        accessibilityLabel="Lưu tên người dùng"
      />
      <Text style={styles.hint}>
        Tên được lưu xuống máy và đồng bộ lên Turso, hiện ngay trên đầu ứng dụng.
      </Text>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Mục 2: Đổi mã PIN — chỉ phụ huynh                                   */
/* ------------------------------------------------------------------ */

function PinSection() {
  const { changePin } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const save = useCallback(async () => {
    Keyboard.dismiss();
    if (!/^\d{4}$/.test(newPin)) {
      setMessage({ type: 'error', text: 'Mã PIN mới phải gồm đúng 4 chữ số.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await changePin(oldPin, newPin);
    setBusy(false);

    if (result.ok) {
      setOldPin('');
      setNewPin('');
      setMessage({ type: 'ok', text: 'Đã đổi mã PIN.' });
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Không đổi được mã PIN.' });
    }
  }, [changePin, newPin, oldPin]);

  return (
    <Section icon="key-outline" title="Mã PIN phụ huynh">
      <Text style={styles.label}>Mã PIN hiện tại</Text>
      <TextInput
        value={oldPin}
        onChangeText={(t) => {
          setOldPin(t.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        placeholder="4 chữ số"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Mã PIN hiện tại"
      />

      <Text style={styles.label}>Mã PIN mới</Text>
      <TextInput
        value={newPin}
        onChangeText={(t) => {
          setNewPin(t.replace(/[^0-9]/g, ''));
          setMessage(null);
        }}
        placeholder="4 chữ số"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
        style={styles.input}
        accessibilityLabel="Mã PIN mới"
      />

      {message && <Message message={message} />}
      <ActionButton
        label="Đổi mã PIN"
        icon="key-outline"
        busy={busy}
        onPress={save}
        accessibilityLabel="Xác nhận đổi mã PIN"
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Khoá ứng dụng bằng PIN                                              */
/* ------------------------------------------------------------------ */

function AppLockSection() {
  const { appLockEnabled, setAppLockEnabled } = useAuth();

  return (
    <Section icon="lock-closed-outline" title="Khoá ứng dụng">
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Hỏi mã PIN mỗi khi mở ứng dụng</Text>
        <Switch
          value={appLockEnabled}
          onValueChange={(value) => void setAppLockEnabled(value)}
          accessibilityLabel="Bật khoá ứng dụng bằng mã PIN"
        />
      </View>
      <Text style={styles.hint}>
        Bật mục này thì mỗi lần mở ứng dụng đều phải nhập PIN phụ huynh — kể cả con
        muốn vào học. Chỉ nên bật khi máy dùng chung.
      </Text>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Mục 3: Tải bản cập nhật                                             */
/* ------------------------------------------------------------------ */

function UpdateSection() {
  const [message, setMessage] = useState<Message | null>(null);
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<UpdateInfo | null>(null);
  const [otaBusy, setOtaBusy] = useState(false);

  /**
   * Kiểm tra bản CẬP NHẬT NHANH (chỉ phần JavaScript).
   *
   * Khác hẳn nút tải APK ngay dưới: bản này vài megabyte, tải xong app tự mở
   * lại; còn APK là cài lại cả ứng dụng, chỉ cần khi phần native thay đổi.
   */
  const quickUpdate = useCallback(async () => {
    setOtaBusy(true);
    setMessage(null);

    const found = await checkOta();
    if (found.status === 'unsupported') {
      setOtaBusy(false);
      setMessage({
        type: 'error',
        text: 'Cập nhật nhanh chỉ hoạt động trên bản app đã cài (APK).',
      });
      return;
    }
    if (found.status === 'up-to-date') {
      setOtaBusy(false);
      setMessage({ type: 'ok', text: 'Bạn đang dùng bản mới nhất!' });
      return;
    }
    if (found.status === 'error') {
      setOtaBusy(false);
      setMessage({
        type: 'error',
        text: found.error ?? 'Không hỏi được máy chủ cập nhật.',
      });
      return;
    }

    // Có bản mới: tải rồi mở lại app luôn. Thành công thì code dưới không chạy tới.
    const applied = await downloadAndApplyOta();
    setOtaBusy(false);
    if (applied.status === 'error') {
      setMessage({ type: 'error', text: applied.error ?? 'Cập nhật thất bại.' });
    }
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setMessage(null);
    const result = await checkAppUpdate();
    setChecking(false);

    if (result.status === 'update-available' && result.latest) {
      setFound(result.latest);
      return;
    }
    if (result.status === 'up-to-date') {
      setMessage({ type: 'ok', text: 'Bạn đang sử dụng phiên bản mới nhất!' });
      return;
    }
    setMessage({
      type: 'error',
      text:
        result.error ??
        (result.status === 'not-configured'
          ? 'Chưa cấu hình máy chủ cập nhật.'
          : 'Không kiểm tra được bản cập nhật.'),
    });
  }, []);

  const download = useCallback(async () => {
    if (!APK_URL) {
      setMessage({
        type: 'error',
        text: 'Chưa cấu hình EXPO_PUBLIC_APK_DOWNLOAD_URL trong tệp .env.',
      });
      return;
    }
    try {
      const supported = await Linking.canOpenURL(APK_URL);
      if (!supported) {
        setMessage({ type: 'error', text: 'Thiết bị không mở được đường dẫn này.' });
        return;
      }
      await Linking.openURL(APK_URL);
    } catch {
      setMessage({ type: 'error', text: 'Không mở được trang tải về.' });
    }
  }, []);

  return (
    <Section icon="cloud-download-outline" title="Phiên bản & cập nhật">
      <View style={styles.versionRow}>
        <Text style={styles.versionLabel}>Phiên bản ứng dụng</Text>
        <Text style={styles.versionValue}>v{APP_VERSION}</Text>
      </View>

      {isOtaSupported() && (
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>Bản đang chạy</Text>
          <Text style={styles.versionValue}>{runningUpdateLabel()}</Text>
        </View>
      )}

      {message && <Message message={message} />}

      {/* Cập nhật nhanh: chỉ tải phần mới, đặt lên trước vì gần như lúc nào cũng
          là cách nên dùng — tải APK chỉ cần khi phần native thay đổi. */}
      <ActionButton
        label={otaBusy ? 'Đang cập nhật nhanh...' : '⚡ Cập nhật nhanh (không cần tải lại app)'}
        icon="flash-outline"
        busy={otaBusy}
        onPress={() => void quickUpdate()}
        accessibilityLabel="Cập nhật nhanh"
      />

      <ActionButton
        label={checking ? 'Đang kiểm tra...' : 'Kiểm tra bản cập nhật'}
        icon="refresh-outline"
        busy={checking}
        onPress={() => void check()}
        accessibilityLabel="Kiểm tra bản cập nhật"
      />

      <Pressable
        onPress={() => void download()}
        accessibilityRole="button"
        accessibilityLabel="Tải bản cập nhật APK mới nhất"
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      >
        <Ionicons name="download-outline" size={18} color={colors.primary} />
        <Text style={styles.secondaryText}>Tải bản cập nhật APK mới nhất</Text>
      </Pressable>

      <Text style={styles.hint}>
        {APK_URL
          ? `Nút tải sẽ mở: ${APK_URL}`
          : 'Điền EXPO_PUBLIC_APK_DOWNLOAD_URL vào .env rồi khởi động lại để dùng nút tải.'}
      </Text>

      <Modal
        visible={found !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFound(null)}
      >
        {found && (
          <UpdateModal
            info={found}
            currentVersion={APP_VERSION}
            onDismiss={() => setFound(null)}
          />
        )}
      </Modal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Mục 4: Đăng xuất                                                    */
/* ------------------------------------------------------------------ */

function SignOutSection({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const { pendingChanges } = usePlaytime();
  const [busy, setBusy] = useState(false);

  const handle = useCallback(async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    onClose();
  }, [onClose, signOut]);

  return (
    <Section icon="log-out-outline" title="Tài khoản">
      {pendingChanges > 0 && (
        <Text style={styles.warn}>
          Còn {pendingChanges} thay đổi chưa đồng bộ. Tiến độ vẫn được giữ trên máy này.
        </Text>
      )}
      <Pressable
        onPress={handle}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Đăng xuất tài khoản"
        style={({ pressed }) => [
          styles.dangerButton,
          busy && styles.disabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.dangerText}>Đăng xuất tài khoản</Text>
          </>
        )}
      </Pressable>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Thành phần dùng lại                                                 */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Message({ message }: { message: Message }) {
  return (
    <Text style={[styles.message, message.type === 'ok' ? styles.ok : styles.error]}>
      {message.text}
    </Text>
  );
}

function ActionButton({
  label,
  icon,
  busy,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  busy: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
          <Ionicons name={icon} size={18} color={colors.textOnPrimary} />
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Cổng PIN bọc quanh màn hình Cài đặt cho tài khoản phụ huynh */
export function SettingsWithPinGate({
  onClose,
  embedded = false,
}: {
  onClose: () => void;
  embedded?: boolean;
}) {
  const { session, pinUnlocked } = useAuth();

  // Học sinh vào thẳng: mục PIN và cấp giờ vốn đã bị ẩn nên không có gì để bảo vệ
  if (session?.role !== 'parent' || pinUnlocked) {
    return <SettingsScreen onClose={onClose} embedded={embedded} />;
  }
  return (
    <PinGate
      title="Khu vực phụ huynh"
      description="Nhập mã PIN để mở phần Cài đặt."
      onCancel={onClose}
    />
  );
}

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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerTitle: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '800' },

  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },

  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
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

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },

  message: { fontSize: 13, fontWeight: '700', marginTop: spacing.xs, lineHeight: 19 },
  ok: { color: colors.success },
  error: { color: colors.danger },
  warn: { fontSize: 12, color: colors.warning, fontWeight: '700', lineHeight: 18 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    minHeight: touch.primary,
    ...elevation(1),
  },
  primaryText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1.5,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: touch.min,
  },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  versionValue: { fontSize: 14, color: colors.primary, fontWeight: '800' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: touch.min,
  },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },
  footerVersion: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.78 },
});
