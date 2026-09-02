import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { usePlaytime } from '../../context/PlaytimeContext';
import { playGameSound } from '../../lib/gameSound';
import {
  addSpareTube,
  CAPACITY,
  canMove,
  cloneBoard,
  generateLevel,
  isSolved,
  isStuck,
  levelConfig,
  MAX_UNDO,
  SPARE_TUBE_HELPS,
  topOf,
  type Board,
  type BlockColor,
  type Tube,
} from './colorSortLogic';
import GameShell from './GameShell';

/** Khoá lưu tiến độ trò này. Dùng chung tiền tố với các khoá khác của app. */
const SAVE_KEY = '@lop3-study-game/colorsort-v1';

interface SaveData {
  /** Màn đang chơi, để lần sau mở lại là tiếp tục */
  level: number;
  /** Màn cao nhất từng hoàn thành */
  best: number;
}

async function readSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return { level: 1, best: 0 };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const level = Math.max(1, Math.floor(Number(parsed.level) || 1));
    const best = Math.max(0, Math.floor(Number(parsed.best) || 0));
    return { level, best };
  } catch {
    // Dữ liệu hỏng thì chơi lại từ màn 1, hơn là không mở được trò
    return { level: 1, best: 0 };
  }
}

async function writeSave(data: SaveData): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[colorSort] Không lưu được tiến độ:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ColorSortGame({ onExit }: { onExit: () => void }) {
  const { isPlaying } = usePlaytime();

  const [level, setLevel] = useState(1);
  const [board, setBoard] = useState<Board>(() => generateLevel(1));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Board[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  /** Số lần còn được thêm ống hỗ trợ trong màn này */
  const [helps, setHelps] = useState(SPARE_TUBE_HELPS);
  /** Giây còn lại; `null` khi màn này không giới hạn thời gian */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  /** Vì sao thua; `null` là chưa thua */
  const [lost, setLost] = useState<'time' | 'moves' | null>(null);
  const [best, setBest] = useState(0);
  /** Vừa phá kỷ lục ở màn này chưa — để hiện lời chúc mừng riêng */
  const [newRecord, setNewRecord] = useState(false);

  const config = useMemo(() => levelConfig(level), [level]);
  const palette = config.palette;
  const colorByKey = useMemo(() => {
    const map = new Map<string, BlockColor>();
    for (const entry of palette) map.set(entry.key, entry);
    return map;
  }, [palette]);

  const solved = useMemo(() => isSolved(board), [board]);
  const stuck = useMemo(() => !solved && isStuck(board), [board, solved]);

  /** Đã đọc tiến độ đã lưu chưa — chưa đọc thì đừng ghi đè lên nó */
  const loadedRef = useRef(false);

  const startLevel = useCallback((nextLevel: number) => {
    const next = levelConfig(nextLevel);
    setLevel(nextLevel);
    setBoard(generateLevel(nextLevel));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setMessage(null);
    setHelps(SPARE_TUBE_HELPS);
    setSecondsLeft(next.timeLimitSec);
    setLost(null);
    setNewRecord(false);
  }, []);

  /* ---------------- Đọc tiến độ đã lưu, một lần khi mở trò ---------------- */
  useEffect(() => {
    let cancelled = false;
    void readSave().then((saved) => {
      if (cancelled) return;
      loadedRef.current = true;
      setBest(saved.best);
      // `startLevel` lo cả bàn, đồng hồ và số lần trợ giúp của màn đó
      if (saved.level > 1) startLevel(saved.level);
    });
    return () => {
      cancelled = true;
    };
  }, [startLevel]);

  /* ---------------- Lưu màn đang chơi ---------------- */
  useEffect(() => {
    if (!loadedRef.current) return;
    void writeSave({ level, best });
  }, [best, level]);

  /* ---------------- Đếm ngược ở các màn Thách thức ---------------- */
  useEffect(() => {
    if (secondsLeft === null || solved || lost) return;
    // Đồng hồ giờ chơi dừng thì đồng hồ màn cũng dừng: không được ăn mòn thời
    // gian của bé trong lúc trò đang bị lớp phủ "Đang tạm dừng" che lại.
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          setLost('time');
          playGameSound('gameOver');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, lost, secondsLeft, solved]);

  /* ---------------- Thắng màn: lưu kỷ lục và ăn mừng ---------------- */
  useEffect(() => {
    if (!solved) return;
    playGameSound('cheer');
    setBest((prev) => {
      if (level > prev) {
        setNewRecord(true);
        return level;
      }
      return prev;
    });
  }, [level, solved]);

  /* ---------------- Thêm ống hỗ trợ khi bế tắc ---------------- */
  const handleAddTube = useCallback(() => {
    if (helps <= 0) {
      setMessage('Màn này đã dùng hết lượt thêm ống rồi.');
      return;
    }
    setHistory((prev) => [...prev, cloneBoard(board)].slice(-MAX_UNDO));
    setBoard(addSpareTube(board));
    setHelps((prev) => prev - 1);
    setSelected(null);
    setMessage('Đã thêm một ống trống. Cố lên nhé!');
    playGameSound('powerup');
  }, [board, helps]);

  const handleTapTube = useCallback(
    (index: number) => {
      if (solved || lost) return;

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

      // Chỉ giữ MAX_UNDO nước gần nhất: hoàn tác để sửa một chuỗi sai ngắn, chứ
      // không phải để lùi về đầu màn rồi dò từng nhánh.
      setHistory((prev) => [...prev, cloneBoard(board)].slice(-MAX_UNDO));

      const next = cloneBoard(board);
      const movedKey = next[selected].pop() as string;
      next[index].push(movedKey);
      setBoard(next);
      setSelected(null);
      setMessage(null);

      // Vừa xếp xong trọn một ống cùng màu thì thưởng một tiếng riêng
      const filled =
        next[index].length === CAPACITY &&
        next[index].every((block) => block === movedKey);
      playGameSound(filled ? 'gold' : 'hit');

      const nextMoves = moves + 1;
      setMoves(nextMoves);

      /*
       * Chỉ tính thua khi đã hết nước đi VÀ bàn chưa giải xong. Kiểm tra
       * `isSolved(next)` chứ không đọc state `solved` — state đó còn là giá trị
       * của khung hình trước, nên nước đi cuối cùng vừa đủ về đích sẽ bị xử thua oan.
       */
      if (config.moveLimit !== null && nextMoves >= config.moveLimit && !isSolved(next)) {
        setLost('moves');
        playGameSound('gameOver');
      }
    },
    [board, config.moveLimit, lost, moves, selected, solved],
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
      scoreLabel={`Màn ${level} · ${config.band} · ${moves} nước đi${
        best > 0 ? ` · 🏅 cao nhất ${best}` : ''
      }`}
      onExit={onExit}
    >
      <View style={styles.container}>
        {/* Dải độ khó và giới hạn của màn — bé biết trước mình đang ở đâu */}
        <View style={styles.statusRow}>
          <Text style={styles.bandChip}>
            {config.palette.length} màu · {config.emptyTubes} ống trống
          </Text>
          {config.moveLimit !== null && (
            <Text
              style={[
                styles.limitChip,
                config.moveLimit - moves <= 5 && styles.limitChipLow,
              ]}
            >
              🎯 còn {Math.max(0, config.moveLimit - moves)} nước
            </Text>
          )}
          {secondsLeft !== null && (
            <Text style={[styles.limitChip, secondsLeft <= 20 && styles.limitChipLow]}>
              ⏱️ {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, '0')}
            </Text>
          )}
        </View>

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

        {message && !solved && !lost && <Text style={styles.message}>{message}</Text>}

        {/* Bế tắc: mách nước thay vì để bé ngồi thử mãi */}
        {stuck && !lost && (
          <Text style={styles.stuckNote}>
            😕 Hết nước đi rồi! Bấm{' '}
            {helps > 0 ? '"Thêm ống"' : '"Đề khác"'} để tiếp tục nhé.
          </Text>
        )}

        {solved ? (
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>{newRecord ? '🏆🎊' : '🎉'}</Text>
            <Text style={styles.winTitle}>
              {newRecord ? `Kỷ lục mới! Màn ${level}!` : `Giỏi lắm! Xong màn ${level}!`}
            </Text>
            <Text style={styles.winSubtitle}>
              {newRecord
                ? `Em vừa đi xa hơn mọi lần trước — hoàn thành trong ${moves} nước đi.`
                : `Em hoàn thành trong ${moves} nước đi.`}
            </Text>
            {newRecord && <Text style={styles.confetti}>🎊 ✨ 🎈 ✨ 🎊</Text>}

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
        ) : lost ? (
          <View style={styles.winCard}>
            <Text style={styles.winEmoji}>{lost === 'time' ? '⏰' : '🎯'}</Text>
            <Text style={styles.winTitle}>
              {lost === 'time' ? 'Hết thời gian rồi!' : 'Hết số nước đi rồi!'}
            </Text>
            <Text style={styles.winSubtitle}>
              Màn {level} khó thật. Thử lại một đề khác xem sao nhé!
            </Text>

            <Pressable
              onPress={() => startLevel(level)}
              accessibilityRole="button"
              accessibilityLabel="Chơi lại ngay"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={20} color={colors.textOnPrimary} />
              <Text style={styles.primaryButtonText}>Chơi lại ngay</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleUndo}
              disabled={!history.length}
              accessibilityRole="button"
              accessibilityLabel={`Hoàn tác nước đi, còn ${history.length} lượt`}
              style={({ pressed }) => [
                styles.secondaryButton,
                !history.length && styles.buttonDisabled,
                pressed && history.length > 0 && styles.pressed,
              ]}
            >
              <Ionicons name="arrow-undo" size={18} color={colors.purple} />
              <Text style={styles.secondaryButtonText}>Hoàn tác {history.length}</Text>
            </Pressable>

            <Pressable
              onPress={handleAddTube}
              disabled={helps <= 0}
              accessibilityRole="button"
              accessibilityLabel={
                helps > 0 ? 'Thêm một ống trống để trợ giúp' : 'Đã hết lượt thêm ống'
              }
              style={({ pressed }) => [
                styles.secondaryButton,
                helps <= 0 && styles.buttonDisabled,
                // Bế tắc thì làm nút này nổi lên, vì đó là lúc nó cần thiết nhất
                stuck && helps > 0 && styles.secondaryButtonUrgent,
                pressed && helps > 0 && styles.pressed,
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.purple} />
              <Text style={styles.secondaryButtonText}>Thêm ống {helps}</Text>
            </Pressable>

            <Pressable
              onPress={() => startLevel(level)}
              accessibilityRole="button"
              accessibilityLabel="Chơi lại màn này với đề khác"
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

  // ---- Dải độ khó và giới hạn của màn ----
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bandChip: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.purple,
    backgroundColor: colors.purpleSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  limitChip: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  /** Gần hết thời gian / nước đi thì đổi sang màu cảnh báo */
  limitChipLow: { color: colors.danger, backgroundColor: colors.dangerSoft },

  stuckNote: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    textAlign: 'center',
    lineHeight: 18,
  },
  confetti: { fontSize: 18, letterSpacing: 2, marginTop: 2 },
  secondaryButtonUrgent: {
    borderWidth: 2,
    borderColor: colors.purple,
  },
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
