import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppIcon from './AppIcon';
import { gradeLabel } from './GradePicker';
import { BRAND_SHORT } from '../constants/brand';
import { colors, elevation, radius, spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { usePlaytime } from '../context/PlaytimeContext';

/**
 * Thanh trên cùng, gói gọn trong MỘT hàng: bên trái là thương hiệu và hồ sơ học
 * sinh (avatar, họ tên, khối lớp), bên phải là hai chỉ số (điểm, phút chơi game)
 * và nút Cài đặt.
 *
 * Trước đây phần này nằm ngay trong `App.tsx` dưới tên `AccountBar`. Tách ra
 * thành component riêng vì nó đã có đủ ba nguồn dữ liệu (auth, playtime, kích cỡ
 * màn hình) và phần hiển thị hồ sơ sẽ còn đổi tiếp — để trong `App.tsx` thì file
 * điều hướng gốc phải mang theo cả bảng style của header.
 *
 * Hiện **họ và tên** chứ không hiện tên đăng nhập: tên đăng nhập là chuỗi không
 * dấu kiểu "minhkhang2026", đọc lên không phải tên của ai cả. Tên đăng nhập chỉ
 * xuất hiện ở màn hình Cài đặt, dạng chỉ đọc.
 */
export default function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { syncState, availableMinutes, totalPoints, hydrated } = usePlaytime();

  if (!session) return null;

  /** Máy hẹp thì bỏ chữ "điểm"/"phút" trong chip để một hàng vẫn vừa */
  const compact = width < 380;

  const syncColor =
    syncState === 'synced'
      ? colors.success
      : syncState === 'error'
        ? colors.danger
        : syncState === 'syncing'
          ? colors.warning
          : 'rgba(255,255,255,0.45)';

  return (
    <View style={[styles.accountBar, { paddingTop: insets.top + spacing.sm }]}>
      {/* Logo thương hiệu, kèm đốm nhỏ báo trạng thái đồng bộ */}
      <View style={styles.logoWrap}>
        <AppIcon size={34} withBadge={false} />
        <View style={[styles.syncDot, { backgroundColor: syncColor }]} />
      </View>

      <View style={styles.accountTextGroup}>
        <Text style={styles.brandName} numberOfLines={1}>
          {BRAND_SHORT}
        </Text>
        <View style={styles.accountRow}>
          <Text style={styles.avatar}>{session.avatar}</Text>
          <Text style={styles.accountName} numberOfLines={1}>
            {session.displayName}
          </Text>
          <Text style={styles.gradeBadge}>🎓 {gradeLabel(session.grade)}</Text>
        </View>
      </View>

      {/* Điểm tích luỹ */}
      <View style={[styles.statChip, styles.statChipPoints]}>
        <Text style={styles.statEmoji}>⭐</Text>
        <Text style={styles.statValue}>{hydrated ? totalPoints : '…'}</Text>
        {compact ? null : <Text style={styles.statUnit}>điểm</Text>}
      </View>

      {/* Phút chơi game còn lại */}
      <View style={[styles.statChip, styles.statChipMinutes]}>
        <Text style={styles.statEmoji}>⏱️</Text>
        <Text style={styles.statValue}>{hydrated ? availableMinutes : '…'}</Text>
        {compact ? null : <Text style={styles.statUnit}>phút</Text>}
      </View>

      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Mở cài đặt"
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={18} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...elevation(2),
  },
  logoWrap: { width: 34, height: 34 },
  /** Đốm báo đồng bộ nằm ở góc logo để không chiếm thêm chỗ trên hàng */
  syncDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },

  accountTextGroup: { flex: 1, gap: 1, minWidth: 0 },
  brandName: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  avatar: { fontSize: 12 },
  accountName: { color: '#C7D2FE', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  gradeBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },

  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statChipPoints: { backgroundColor: 'rgba(255,255,255,0.22)' },
  statChipMinutes: { backgroundColor: colors.reward },
  statEmoji: { fontSize: 12 },
  statValue: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  statUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700' },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  pressed: { opacity: 0.75 },
});
