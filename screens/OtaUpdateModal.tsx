import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AppIcon from '../components/AppIcon';
import { BRAND_SHORT } from '../constants/brand';
import { colors, elevation, radius, spacing, touch } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { downloadAndApplyUpdate, isDemoUpdate } from '../services/updateService';

/**
 * Hộp thoại thông báo có bản cập nhật trong app, hiện ngay sau khi đăng nhập.
 *
 * Khác `screens/UpdateModal.tsx`: file đó dành cho bản cập nhật phải TẢI LẠI APK
 * (thay đổi phần native), còn hộp thoại này chỉ tải mấy megabyte JavaScript rồi
 * mở lại app.
 */
export default function OtaUpdateModal({
  onDismiss,
}: {
  /** Bỏ qua lần này. `undefined` nghĩa là cập nhật bắt buộc, không cho bỏ qua. */
  onDismiss?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo = isDemoUpdate();

  const apply = useCallback(async () => {
    setBusy(true);
    setError(null);

    const result = await downloadAndApplyUpdate();
    // Thành công thì app tự mở lại, phần dưới không chạy tới
    if (result.ok) {
      onDismiss?.();
      return;
    }
    setError(result.error ?? 'Cập nhật thất bại, em thử lại sau nhé!');
    setBusy(false);
  }, [onDismiss]);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <AppIcon size={84} />

        <Text style={styles.title}>🚀 Đã có phiên bản mới!</Text>
        <Text style={styles.body}>
          Hệ thống đã cập nhật tính năng và câu hỏi mới cho {BRAND_SHORT}. Cập nhật
          ngay để trải nghiệm mượt mà hơn!
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Bản đang chạy: v{APP_VERSION}</Text>
          {demo && <Text style={styles.demoTag}>bản thử</Text>}
        </View>

        <Text style={styles.note}>
          Chỉ tải phần mới, không phải cài lại app. Xong là {BRAND_SHORT} tự mở lại.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={() => void apply()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cập nhật ngay"
          style={({ pressed }) => [
            styles.primaryButton,
            busy && styles.buttonBusy,
            pressed && !busy && styles.pressed,
          ]}
        >
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.textOnPrimary} />
              <Text style={styles.primaryText}>Đang tải bản mới...</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>Cập nhật ngay</Text>
          )}
        </Pressable>

        {/* Cập nhật bắt buộc thì không có nút bỏ qua */}
        {onDismiss && !busy && (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Để sau"
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={styles.ghostText}>Để sau</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...elevation(3),
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  demoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    backgroundColor: colors.rewardSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  note: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
  },

  primaryButton: {
    alignSelf: 'stretch',
    minHeight: touch.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    ...elevation(2),
  },
  buttonBusy: { backgroundColor: colors.primaryDark },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primaryText: { fontSize: 16, fontWeight: '800', color: colors.textOnPrimary },
  ghostButton: {
    alignSelf: 'stretch',
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.75 },
});
