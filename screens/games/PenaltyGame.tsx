import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import GameShell from './GameShell';

/* ------------------------------------------------------------------ */
/* Cấu hình                                                            */
/* ------------------------------------------------------------------ */

/** Số lượt sút của một trận */
const TOTAL_SHOTS = 5;

const BALL_SIZE = 30;
const KEEPER_W = 54;
const KEEPER_H = 62;

/** Thời gian bóng bay và thủ môn đổ người (ms) */
const SHOT_MS = 520;
/** Thời gian hiện kết quả trước khi vào lượt sau (ms) */
const RESULT_MS = 1200;

/**
 * Xác suất thủ môn vẫn cản được khi đổ ĐÚNG CỘT nhưng SAI TẦM cao/thấp.
 *
 * Nếu chỉ cản khi trùng đúng ô thì tỉ lệ cản chỉ 1/6, sút gần như luôn vào và
 * trò chơi mất hết cảm giác hồi hộp. Với con số này tỉ lệ cản khoảng 22%.
 */
const SAVE_ON_SAME_COLUMN = 0.35;

type Column = 0 | 1 | 2; // trái, giữa, phải
type Row = 0 | 1; // trên, dưới

interface Zone {
  column: Column;
  row: Row;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

/** 6 góc sút, xếp theo đúng thứ tự hiển thị trên bảng điều khiển */
const ZONES: Zone[] = [
  { column: 0, row: 0, label: 'Trên bên trái', icon: 'arrow-up-outline' },
  { column: 1, row: 0, label: 'Trên chính giữa', icon: 'arrow-up-outline' },
  { column: 2, row: 0, label: 'Trên bên phải', icon: 'arrow-up-outline' },
  { column: 0, row: 1, label: 'Dưới bên trái', icon: 'arrow-down-outline' },
  { column: 1, row: 1, label: 'Dưới chính giữa', icon: 'arrow-down-outline' },
  { column: 2, row: 1, label: 'Dưới bên phải', icon: 'arrow-down-outline' },
];

const COLUMN_NAMES = ['bên trái', 'chính giữa', 'bên phải'] as const;

type Phase = 'aiming' | 'shooting' | 'result' | 'finished';

interface ShotResult {
  isGoal: boolean;
  keeper: { column: Column; row: Row };
}

/* ------------------------------------------------------------------ */

export default function PenaltyGame({ onExit }: { onExit: () => void }) {
  const { isPlaying } = usePlaytime();
  const windowSize = useWindowDimensions();

  /**
   * Kích thước sân. Khởi tạo bằng ước lượng rồi mới chỉnh theo `onLayout` —
   * nếu chờ `onLayout` mới vẽ thì màn hình sẽ trắng khi sự kiện đó bị chậm.
   */
  const [area, setArea] = useState(() => ({
    width: Math.max(260, windowSize.width - spacing.md * 2),
    height: Math.max(220, Math.min(340, windowSize.height * 0.44)),
  }));

  const [phase, setPhase] = useState<Phase>('aiming');
  const [shotsTaken, setShotsTaken] = useState(0);
  const [goals, setGoals] = useState(0);
  const [best, setBest] = useState(0);
  const [lastResult, setLastResult] = useState<ShotResult | null>(null);

  const ballAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ballScale = useRef(new Animated.Value(1)).current;
  const keeperAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const celebrate = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setArea((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  }, []);

  // Dọn hết timer khi rời trò chơi để không setState trên component đã gỡ
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  /* ---------------- Toạ độ khung thành ---------------- */

  const layout = useMemo(() => {
    const goalWidth = area.width * 0.84;
    const goalHeight = area.height * 0.46;
    const goalLeft = (area.width - goalWidth) / 2;
    const goalTop = area.height * 0.08;

    return {
      goalWidth,
      goalHeight,
      goalLeft,
      goalTop,
      /** Vị trí chấm 11m, cũng là chỗ bóng nằm ban đầu */
      spotX: area.width / 2 - BALL_SIZE / 2,
      spotY: area.height - BALL_SIZE - area.height * 0.1,
      /** Thủ môn đứng giữa vạch vôi */
      keeperX: area.width / 2 - KEEPER_W / 2,
      keeperY: goalTop + goalHeight - KEEPER_H,
    };
  }, [area]);

  /** Tâm của một ô trong khung thành */
  const zoneCenter = useCallback(
    (column: Column, row: Row) => ({
      x: layout.goalLeft + layout.goalWidth * ((column + 0.5) / 3),
      y: layout.goalTop + layout.goalHeight * ((row + 0.5) / 2),
    }),
    [layout],
  );

  /* ---------------- Sút ---------------- */

  const resetPositions = useCallback(() => {
    ballAnim.setValue({ x: 0, y: 0 });
    ballScale.setValue(1);
    keeperAnim.setValue({ x: 0, y: 0 });
    celebrate.setValue(0);
  }, [ballAnim, ballScale, keeperAnim, celebrate]);

  const shoot = useCallback(
    (zone: Zone) => {
      // Đồng hồ dừng thì không cho sút (lớp phủ tạm dừng cũng đã chặn chạm)
      if (phase !== 'aiming' || !isPlaying) return;

      // Thủ môn chọn ngẫu nhiên một góc để đổ người
      const keeperColumn = Math.floor(Math.random() * 3) as Column;
      const keeperRow = Math.floor(Math.random() * 2) as Row;

      const exactMatch = keeperColumn === zone.column && keeperRow === zone.row;
      const sameColumn = keeperColumn === zone.column && keeperRow !== zone.row;
      const saved = exactMatch || (sameColumn && Math.random() < SAVE_ON_SAME_COLUMN);
      const isGoal = !saved;

      setPhase('shooting');

      const target = zoneCenter(zone.column, zone.row);
      const keeperTarget = zoneCenter(keeperColumn, keeperRow);

      Animated.parallel([
        Animated.timing(ballAnim, {
          toValue: {
            x: target.x - (layout.spotX + BALL_SIZE / 2),
            y: target.y - (layout.spotY + BALL_SIZE / 2),
          },
          duration: SHOT_MS,
          useNativeDriver: true,
        }),
        // Bóng nhỏ dần cho cảm giác bay ra xa
        Animated.timing(ballScale, {
          toValue: 0.62,
          duration: SHOT_MS,
          useNativeDriver: true,
        }),
        Animated.timing(keeperAnim, {
          toValue: {
            x: keeperTarget.x - (layout.keeperX + KEEPER_W / 2),
            y: keeperTarget.y - (layout.keeperY + KEEPER_H / 2),
          },
          duration: SHOT_MS * 0.85,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setLastResult({ isGoal, keeper: { column: keeperColumn, row: keeperRow } });
        setPhase('result');

        if (isGoal) {
          setGoals((prev) => prev + 1);
          Animated.spring(celebrate, {
            toValue: 1,
            friction: 4,
            tension: 90,
            useNativeDriver: true,
          }).start();
        }

        const nextShots = shotsTaken + 1;
        setShotsTaken(nextShots);

        const timer = setTimeout(() => {
          if (nextShots >= TOTAL_SHOTS) {
            setPhase('finished');
          } else {
            resetPositions();
            setLastResult(null);
            setPhase('aiming');
          }
        }, RESULT_MS);
        timers.current.push(timer);
      });
    },
    [
      phase,
      isPlaying,
      zoneCenter,
      layout,
      ballAnim,
      ballScale,
      keeperAnim,
      celebrate,
      shotsTaken,
      resetPositions,
    ],
  );

  const startNewMatch = useCallback(() => {
    setBest((prev) => Math.max(prev, goals));
    setShotsTaken(0);
    setGoals(0);
    setLastResult(null);
    resetPositions();
    setPhase('aiming');
  }, [goals, resetPositions]);

  /* ---------------- Giao diện ---------------- */

  const celebrateScale = celebrate.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <GameShell
      title="Đá Penalty"
      emoji="⚽"
      color={colors.success}
      scoreLabel={`Lượt ${Math.min(shotsTaken + (phase === 'finished' ? 0 : 1), TOTAL_SHOTS)}/${TOTAL_SHOTS}  ·  ⚽ ${goals} bàn${best > 0 ? `  ·  Cao nhất: ${best}` : ''}`}
      onExit={onExit}
    >
      <View style={styles.container}>
        {/* Bảng tỷ số */}
        <View style={styles.scoreboard}>
          {Array.from({ length: TOTAL_SHOTS }, (_, index) => {
            const done = index < shotsTaken;
            const isGoalMark = done && index < goals;
            return (
              <View
                key={index}
                style={[
                  styles.shotDot,
                  done && (isGoalMark ? styles.shotGoal : styles.shotMiss),
                ]}
              >
                <Text style={styles.shotDotText}>
                  {done ? (isGoalMark ? '⚽' : '✋') : index + 1}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Sân */}
        <View style={styles.pitch} onLayout={handleLayout}>
          {area.height > 0 && (
            <>
              {/* Khung thành */}
              <View
                style={[
                  styles.goal,
                  {
                    left: layout.goalLeft,
                    top: layout.goalTop,
                    width: layout.goalWidth,
                    height: layout.goalHeight,
                  },
                ]}
              >
                <View style={styles.goalNetRow} />
                <View style={styles.goalNetRow} />
                <View style={styles.goalNetColumn} />
                <View style={[styles.goalNetColumn, { left: '66%' }]} />
              </View>

              {/* Chấm 11m */}
              <View
                style={[
                  styles.penaltySpot,
                  { left: area.width / 2 - 4, top: layout.spotY + BALL_SIZE + 6 },
                ]}
              />

              {/* Thủ môn */}
              <Animated.View
                style={[
                  styles.keeper,
                  {
                    left: layout.keeperX,
                    top: layout.keeperY,
                    transform: keeperAnim.getTranslateTransform(),
                  },
                ]}
              >
                <Text style={styles.keeperEmoji}>🧤</Text>
              </Animated.View>

              {/* Bóng */}
              <Animated.Text
                style={[
                  styles.ball,
                  {
                    left: layout.spotX,
                    top: layout.spotY,
                    transform: [...ballAnim.getTranslateTransform(), { scale: ballScale }],
                  },
                ]}
              >
                ⚽
              </Animated.Text>

              {/* Kết quả lượt sút */}
              {lastResult && (
                <Animated.View
                  style={[
                    styles.resultBanner,
                    lastResult.isGoal ? styles.resultGoal : styles.resultSave,
                    lastResult.isGoal && { transform: [{ scale: celebrateScale }] },
                  ]}
                >
                  <Text style={styles.resultText}>
                    {lastResult.isGoal ? '🎉 GOAL! 🎉' : '✋ Thủ môn cản được!'}
                  </Text>
                  <Text style={styles.resultSub}>
                    Thủ môn đổ về {COLUMN_NAMES[lastResult.keeper.column]}
                  </Text>
                </Animated.View>
              )}

              {/* Kết thúc trận */}
              {phase === 'finished' && (
                <View style={styles.finishOverlay}>
                  <Text style={styles.finishEmoji}>
                    {goals === TOTAL_SHOTS ? '🏆' : goals >= 3 ? '🎉' : '💪'}
                  </Text>
                  <Text style={styles.finishTitle}>
                    {goals === TOTAL_SHOTS
                      ? 'Tuyệt vời! Ghi bàn cả 5 lượt!'
                      : `Ghi được ${goals}/${TOTAL_SHOTS} bàn`}
                  </Text>
                  {best > 0 && <Text style={styles.finishSub}>Cao nhất: {best} bàn</Text>}

                  <Pressable
                    onPress={startNewMatch}
                    accessibilityRole="button"
                    accessibilityLabel="Đá lại trận mới"
                    style={({ pressed }) => [styles.replayButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="refresh" size={20} color={colors.success} />
                    <Text style={styles.replayText}>Đá lại</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Bảng chọn góc sút */}
        <View style={styles.aimGrid}>
          {ZONES.map((zone) => (
            <AimButton
              key={`${zone.column}-${zone.row}`}
              zone={zone}
              disabled={phase !== 'aiming'}
              onSelect={shoot}
            />
          ))}
        </View>

        <Text style={styles.hint}>
          {phase === 'aiming'
            ? 'Chạm vào góc em muốn sút — thủ môn không biết trước đâu!'
            : phase === 'finished'
              ? 'Hết 5 lượt rồi, bấm "Đá lại" để chơi tiếp nhé.'
              : 'Đang sút...'}
        </Text>
      </View>
    </GameShell>
  );
}

/** Một ô chọn góc sút. Memo để 6 nút không vẽ lại theo đồng hồ mỗi giây. */
const AimButton = React.memo(function AimButton({
  zone,
  disabled,
  onSelect,
}: {
  zone: Zone;
  disabled: boolean;
  /** Nhận cả zone thay vì closure, để prop không đổi giữa các lần render */
  onSelect: (zone: Zone) => void;
}) {
  const handlePress = useCallback(() => onSelect(zone), [onSelect, zone]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`Sút góc ${zone.label}`}
      style={({ pressed }) => [
        styles.aimButton,
        disabled && styles.aimButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={zone.icon} size={20} color={colors.success} />
      <Text style={styles.aimLabel}>{zone.label}</Text>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },

  scoreboard: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  shotDot: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotGoal: { backgroundColor: colors.successSoft, borderColor: colors.success },
  shotMiss: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  shotDotText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },

  pitch: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#4ADE80',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  goal: {
    position: 'absolute',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    borderBottomWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  goalNetRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  goalNetColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  penaltySpot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },

  keeper: {
    position: 'absolute',
    width: KEEPER_W,
    height: KEEPER_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keeperEmoji: { fontSize: 40 },

  ball: { position: 'absolute', fontSize: BALL_SIZE },

  resultBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '38%',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  resultGoal: { backgroundColor: 'rgba(34,197,94,0.95)' },
  resultSave: { backgroundColor: 'rgba(239,68,68,0.95)' },
  resultText: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '800' },
  resultSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },

  finishOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  finishEmoji: { fontSize: 46 },
  finishTitle: {
    color: colors.textOnPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  finishSub: { color: '#CBD5E1', fontSize: 13, marginBottom: spacing.md },
  replayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  replayText: { color: colors.success, fontSize: 16, fontWeight: '800' },

  aimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  aimButton: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  aimButtonDisabled: { opacity: 0.45 },
  aimLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },

  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
