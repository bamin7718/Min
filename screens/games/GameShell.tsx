import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../../constants/theme';
import { formatClock, usePlaytime } from '../../context/PlaytimeContext';

/**
 * Khung chung cho mọi trò chơi trong Góc Game.
 *
 * Nhiệm vụ chính: luôn cho học sinh thấy thời gian còn lại đang trừ dần, và
 * đóng băng trò chơi khi đồng hồ bị tạm dừng (ví dụ khi rời khỏi ứng dụng) để
 * không thể chơi mà không mất thời gian.
 */
export default function GameShell({
  title,
  emoji,
  color,
  scoreLabel,
  onExit,
  children,
}: {
  title: string;
  emoji: string;
  color: string;
  /** Thông tin điểm/tiến độ hiển thị ở thanh trên */
  scoreLabel?: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { availableSeconds, isPlaying, startPlaying } = usePlaytime();

  // Còn dưới 1 phút thì đổi màu đồng hồ để nhắc học sinh
  const isRunningLow = availableSeconds <= 60;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Thoát trò chơi"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textOnPrimary} />
        </Pressable>

        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {emoji} {title}
          </Text>
          {scoreLabel ? (
            <Text style={styles.headerScore} numberOfLines={1}>
              {scoreLabel}
            </Text>
          ) : null}
        </View>

        <View style={[styles.clockChip, isRunningLow && styles.clockChipLow]}>
          <Ionicons
            name="time-outline"
            size={16}
            color={isRunningLow ? colors.textOnPrimary : colors.textOnPrimary}
          />
          <Text style={styles.clockText}>{formatClock(availableSeconds)}</Text>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>{children}</View>

      {/* Đồng hồ dừng (thoát app, bị tạm dừng...) → khoá trò chơi lại */}
      {!isPlaying && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseEmoji}>⏸️</Text>
          <Text style={styles.pauseTitle}>Đang tạm dừng</Text>
          <Text style={styles.pauseText}>
            Đồng hồ đã dừng nên trò chơi cũng tạm nghỉ. Bấm để chơi tiếp nhé!
          </Text>

          <Pressable
            onPress={startPlaying}
            accessibilityRole="button"
            accessibilityLabel="Chơi tiếp"
            style={({ pressed }) => [styles.resumeButton, pressed && styles.pressed]}
          >
            <Ionicons name="play" size={20} color={colors.primary} />
            <Text style={styles.resumeText}>Chơi tiếp</Text>
          </Pressable>

          <Pressable
            onPress={onExit}
            accessibilityRole="button"
            accessibilityLabel="Thoát về Góc Game"
            style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}
          >
            <Text style={styles.exitText}>Thoát về Góc Game</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerTextGroup: { flex: 1 },
  headerTitle: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },
  headerScore: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 1 },
  clockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  clockChipLow: { backgroundColor: colors.danger },
  clockText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  body: { flex: 1 },

  pauseOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.lockOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  pauseEmoji: { fontSize: 52 },
  pauseTitle: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '800' },
  pauseText: {
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  resumeText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  exitButton: { paddingVertical: spacing.md },
  exitText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },

  pressed: { opacity: 0.75 },
});
