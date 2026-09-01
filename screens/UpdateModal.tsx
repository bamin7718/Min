import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../constants/theme';
import type { UpdateInfo } from '../lib/updateChecker';

/**
 * Thông báo có bản cập nhật mới.
 *
 * Khi `forceUpdate` bật, modal KHÔNG có cách đóng — người dùng buộc phải tải
 * bản mới. Dùng cho những bản vá bắt buộc (ví dụ đổi định dạng dữ liệu).
 */
export default function UpdateModal({
  info,
  currentVersion,
  onDismiss,
}: {
  info: UpdateInfo;
  currentVersion: string;
  /** Bỏ trống khi bắt buộc cập nhật */
  onDismiss?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    if (!info.apkUrl) {
      setError('Bản phát hành chưa có đường dẫn tải. Liên hệ người quản trị giúp em.');
      return;
    }
    try {
      await Linking.openURL(info.apkUrl);
    } catch {
      setError('Không mở được trang tải về.');
    }
  }, [info.apkUrl]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl }]}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🎁</Text>
        <Text style={styles.title}>Đã có bản cập nhật mới (v{info.version})!</Text>
        <Text style={styles.subtitle}>Em đang dùng bản v{currentVersion}</Text>

        {info.forceUpdate && (
          <View style={styles.forceBadge}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.forceText}>Bản cập nhật bắt buộc</Text>
          </View>
        )}

        {info.releaseNotes ? (
          <ScrollView style={styles.notesBox} contentContainerStyle={styles.notesContent}>
            <Text style={styles.notesLabel}>Có gì mới</Text>
            <Text style={styles.notesText}>{info.releaseNotes}</Text>
          </ScrollView>
        ) : null}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={download}
          accessibilityRole="button"
          accessibilityLabel="Tải về và cập nhật ngay"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Ionicons name="download-outline" size={20} color={colors.textOnPrimary} />
          <Text style={styles.primaryText}>Tải về & Cập nhật ngay</Text>
        </Pressable>

        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Để sau"
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Để sau</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>
            Bản này bắt buộc cập nhật nên chưa vào ứng dụng được. Tải xong rồi mở lại
            giúp em nhé.
          </Text>
        )}
      </View>
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
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },

  forceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  forceText: { color: colors.danger, fontSize: 12, fontWeight: '800' },

  notesBox: {
    alignSelf: 'stretch',
    maxHeight: 180,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  notesContent: { padding: spacing.md, gap: spacing.xs },
  notesLabel: { fontSize: 12, fontWeight: '800', color: colors.primary },
  notesText: { fontSize: 14, color: colors.text, lineHeight: 21 },

  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: spacing.sm },

  primaryButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    minHeight: 52,
  },
  primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  textButton: { paddingVertical: spacing.md },
  textButtonLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.78 },
});
