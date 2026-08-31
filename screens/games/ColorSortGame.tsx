import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import {
  CAPACITY,
  canMove,
  cloneBoard,
  generateBoard,
  isSolved,
  levelConfig,
  topOf,
  type Board,
  type BlockColor,
  type Tube,
} from './colorSortLogic';
import GameShell from './GameShell';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ColorSortGame({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState(1);
  const [board, setBoard] = useState<Board>(() => {
    const config = levelConfig(1);
    return generateBoard(config.palette, config.tubeCount, config.scrambleSteps);
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Board[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const palette = useMemo(() => levelConfig(level).palette, [level]);
  const colorByKey = useMemo(() => {
    const map = new Map<string, BlockColor>();
    for (const entry of palette) map.set(entry.key, entry);
    return map;
  }, [palette]);

  const solved = useMemo(() => isSolved(board), [board]);

  const startLevel = useCallback((nextLevel: number) => {
    const config = levelConfig(nextLevel);
    setLevel(nextLevel);
    setBoard(generateBoard(config.palette, config.tubeCount, config.scrambleSteps));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setMessage(null);
  }, []);

  const handleTapTube = useCallback(
    (index: number) => {
      if (solved) return;

      // Chưa chọn ống nguồn
      if (selected === null) {
        if (!board[index].length) {
          setMessage('Ống này đang rỗng, hãy chọn ống có khối màu nhé!');
          return;
        }
        setSelected(index);
        setMessage(null);
        return;
      }

      // Bấm lại chính ống đang chọn → bỏ chọn
      if (selected === index) {
        setSelected(null);
        setMessage(null);
        return;
      }

      if (!canMove(board, selected, index)) {
        const targetTop = topOf(board[index]);
        setMessage(
          board[index].length >= CAPACITY
            ? 'Ống này đã đầy rồi!'
            : targetTop
              ? 'Chỉ chuyển được khi hai khối trên cùng CÙNG MÀU.'
              : 'Chưa chuyển được, thử ống khác xem sao.',
        );
        return;
      }

      setHistory((prev) => [...prev, cloneBoard(board)]);
      const next = cloneBoard(board);
      next[index].push(next[selected].pop() as string);
      setBoard(next);
      setSelected(null);
      setMoves((prev) => prev + 1);
      setMessage(null);
    },
    [board, selected, solved],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      setBoard(prev[prev.length - 1]);
      setSelected(null);
      setMessage(null);
      setMoves((count) => Math.max(0, count - 1));
      return prev.slice(0, -1);
    });
  }, []);

  return (
    <GameShell
      title="Sắp Xếp Màu"
      emoji="🧪"
      color={colors.purple}
      scoreLabel={`Màn ${level}  ·  ${moves} nước đi`}
      onExit={onExit}
    >
      <View style={styles.container}>
        <Text style={styles.goal}>
          Chạm vào một ống để lấy khối trên cùng, rồi chạm ống khác để đặt xuống. Xếp
          mỗi màu về chung một ống là thắng!
        </Text>

        <View style={styles.tubeRow}>
          {board.map((tube, index) => (
            <TubeView
              key={index}
              tube={tube}
              index={index}
              isSelected={selected === index}
              colorByKey={colorByKey}
              compact={board.length >= 5}
              onPress={() => handleTapTube(index)}
            />
          ))}
        </View>

        {message && !solved && <Text style={styles.message}>{message}</Text>}

        {solved ? (
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>🎉</Text>
            <Text style={styles.winTitle}>Giỏi lắm! Xong màn {level}!</Text>
            <Text style={styles.winSubtitle}>Em hoàn thành trong {moves} nước đi.</Text>

            <Pressable
              onPress={() => startLevel(level + 1)}
              accessibilityRole="button"
              accessibilityLabel="Sang màn tiếp theo"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
              <Text style={styles.primaryButtonText}>Màn tiếp theo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleUndo}
              disabled={!history.length}
              accessibilityRole="button"
              accessibilityLabel="Hoàn tác nước đi"
              style={({ pressed }) => [
                styles.secondaryButton,
                !history.length && styles.buttonDisabled,
                pressed && history.length > 0 && styles.pressed,
              ]}
            >
              <Ionicons name="arrow-undo" size={18} color={colors.purple} />
              <Text style={styles.secondaryButtonText}>Hoàn tác</Text>
            </Pressable>

            <Pressable
              onPress={() => startLevel(level)}
              accessibilityRole="button"
              accessibilityLabel="Chơi lại màn này"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={18} color={colors.purple} />
              <Text style={styles.secondaryButtonText}>Đề khác</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GameShell>
  );
}

/** Một ống nghiệm: khối ở đáy vẽ dưới cùng */
function TubeView({
  tube,
  index,
  isSelected,
  colorByKey,
  compact,
  onPress,
}: {
  tube: Tube;
  index: number;
  isSelected: boolean;
  colorByKey: Map<string, BlockColor>;
  /** Thu hẹp ống khi có 5 ống để vẫn vừa màn hình điện thoại */
  compact: boolean;
  onPress: () => void;
}) {
  const topBlock = topOf(tube);
  const topName = topBlock ? colorByKey.get(topBlock)?.name : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        tube.length
          ? `Ống ${index + 1}, ${tube.length} khối, trên cùng màu ${topName ?? ''}`
          : `Ống ${index + 1}, đang rỗng`
      }
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.tube,
        compact && styles.tubeCompact,
        isSelected && styles.tubeSelected,
        pressed && styles.pressed,
      ]}
    >
      {/* Vẽ từ đỉnh xuống đáy: đảo ngược mảng */}
      {[...tube].reverse().map((blockKey, position) => {
        const entry = colorByKey.get(blockKey);
        const isTop = position === 0;
        return (
          <View
            key={`${index}-${tube.length - position}`}
            style={[
              styles.block,
              { backgroundColor: entry?.color ?? colors.textMuted },
              isTop && isSelected && styles.blockLifted,
            ]}
          >
            <Text style={styles.blockSymbol}>{entry?.symbol ?? '?'}</Text>
          </View>
        );
      })}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  goal: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },

  tubeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.sm,
    flex: 1,
    maxHeight: 320,
  },
  tube: {
    width: 62,
    height: CAPACITY * 46 + 16,
    borderWidth: 3,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
    padding: 5,
    gap: 4,
  },
  tubeCompact: { width: 52 },
  tubeSelected: { borderColor: colors.purple, backgroundColor: colors.purpleSoft },

  block: {
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockLifted: { transform: [{ translateY: -8 }], opacity: 0.85 },
  blockSymbol: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  message: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning,
    textAlign: 'center',
  },

  actionRow: { flexDirection: 'row', gap: spacing.md },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.purpleSoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  secondaryButtonText: { color: colors.purple, fontWeight: '800', fontSize: 14 },
  buttonDisabled: { opacity: 0.45 },

  winCard: {
    backgroundColor: colors.successSoft,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  winEmoji: { fontSize: 40 },
  winTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  winSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignSelf: 'stretch',
  },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },

  pressed: { opacity: 0.8 },
});
