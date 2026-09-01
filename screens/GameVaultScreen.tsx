import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import {
  MAX_ACCUMULATED_MINUTES,
  PARENT_GRANT_OPTIONS,
} from '../constants/mockData';
import {
  CONTENT_MAX_WIDTH,
  TABLET_BREAKPOINT,
  colors,
  radius,
  spacing,
} from '../constants/theme';
import { formatClock, usePlaytime } from '../context/PlaytimeContext';
import type { GameId, RootTabParamList, SyncState } from '../types';
import { GAMES } from './games/catalog';
import ColorSortGame from './games/ColorSortGame';
import MarioMiniGame from './games/MarioMiniGame';
import PenaltyGame from './games/PenaltyGame';

export default function GameVaultScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const {
    totalPoints,
    availableSeconds,
    availableMinutes,
    isPlaying,
    isLocked,
    startPlaying,
    pausePlaying,
    hydrated,
    isOnline,
  } = usePlaytime();

  // Hiệu ứng "thở" của đồng hồ khi đang chạy
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isPlaying) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPlaying, pulseAnim]);

  const goToQuiz = useCallback(() => navigation.navigate('HocTap'), [navigation]);

  // ----- Mở / đóng trò chơi -----
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const openGame = useCallback(
    (gameId: GameId) => {
      setActiveGame(gameId);
      // Mở game là bắt đầu tiêu thời gian
      startPlaying();
    },
    [startPlaying],
  );

  const closeGame = useCallback(() => {
    setActiveGame(null);
    pausePlaying();
  }, [pausePlaying]);

  // Hết thời gian → tự đóng game đang chơi, quay về màn hình khoá
  useEffect(() => {
    if (isLocked && activeGame !== null) {
      setActiveGame(null);
    }
  }, [isLocked, activeGame]);

  // Quay lại ứng dụng mà game vẫn đang mở → cho đồng hồ chạy tiếp
  useEffect(() => {
    if (activeGame === null) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') startPlaying();
    });
    return () => subscription.remove();
  }, [activeGame, startPlaying]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Góc Game 🎮</Text>
            <Text style={styles.headerSubtitle}>
              Thời gian chơi được đổi từ việc học bài
            </Text>
          </View>
          <View style={styles.pointChip}>
            <Text style={styles.pointChipEmoji}>⭐</Text>
            <Text style={styles.pointChipText}>{hydrated ? totalPoints : '…'}</Text>
          </View>
        </View>

        {/* ----- Đồng hồ đếm ngược ----- */}
        <Animated.View
          style={[
            styles.clockCard,
            isPlaying && styles.clockCardActive,
            isLocked && styles.clockCardLocked,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.clockLabel}>Thời gian chơi game khả dụng</Text>
          <Text style={[styles.clockValue, isTablet && styles.clockValueTablet]}>
            {hydrated ? formatClock(availableSeconds) : '--:--'}
          </Text>
          <Text style={styles.clockHint}>
            {isLocked
              ? 'Đã hết giờ — hãy học bài để kiếm thêm'
              : isPlaying
                ? 'Đang chơi... thời gian đang chạy!'
                : `Còn khoảng ${availableMinutes} phút, sẵn sàng chơi`}
          </Text>
        </Animated.View>

        {/* ----- Hết giờ: khoá lại. Còn giờ: hiện lưới trò chơi ----- */}
        {!hydrated ? null : isLocked ? (
          <LockedPanel onGoToQuiz={goToQuiz} />
        ) : (
          <>
            <GameGrid onOpenGame={openGame} />

            <Pressable
              onPress={isPlaying ? pausePlaying : startPlaying}
              accessibilityRole="button"
              accessibilityLabel={
                isPlaying ? 'Tạm dừng đồng hồ' : 'Bấm giờ chơi game ngoài ứng dụng'
              }
              style={({ pressed }) => [styles.timerOnlyButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'timer-outline'}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.timerOnlyText}>
                {isPlaying
                  ? 'Tạm dừng đồng hồ'
                  : 'Chỉ bấm giờ (chơi game ngoài ứng dụng)'}
              </Text>
            </Pressable>

            <View style={styles.noteCard}>
              <Ionicons
                name={isOnline ? 'information-circle' : 'cloud-offline-outline'}
                size={20}
                color={isOnline ? colors.primary : colors.warning}
              />
              <Text style={styles.noteText}>
                {isOnline
                  ? 'Đồng hồ chỉ chạy khi em đang chơi, và tự tạm dừng khi em thoát ứng dụng — nên em không bị mất giờ chơi oan nhé!'
                  : 'Đang mất mạng nhưng em vẫn học và chơi bình thường nhé — mọi thứ được lưu ngay trên máy và sẽ tự đồng bộ khi có mạng.'}
              </Text>
            </View>
          </>
        )}

        {/* ----- Khu vực phụ huynh ----- */}
        <ParentPanel />
      </ScrollView>

      {/* ----- Trò chơi mở toàn màn hình ----- */}
      <Modal
        visible={activeGame !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeGame}
      >
        {activeGame === 'mario-mini' && <MarioMiniGame onExit={closeGame} />}
        {activeGame === 'color-sort' && <ColorSortGame onExit={closeGame} />}
        {activeGame === 'penalty' && <PenaltyGame onExit={closeGame} />}
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Lưới trò chơi (2 cột)                                               */
/* ------------------------------------------------------------------ */

const GameGrid = React.memo(function GameGrid({
  onOpenGame,
}: {
  onOpenGame: (gameId: GameId) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Chọn trò chơi</Text>

      <View style={styles.gameGrid}>
        {GAMES.map((game) => (
          <Pressable
            key={game.id}
            onPress={() => onOpenGame(game.id)}
            accessibilityRole="button"
            accessibilityLabel={`Chơi ngay ${game.name}`}
            style={({ pressed }) => [
              styles.gameCard,
              { backgroundColor: game.softColor, borderColor: game.color },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.gameEmoji}>{game.emoji}</Text>
            <Text style={[styles.gameName, { color: game.color }]} numberOfLines={1}>
              {game.name}
            </Text>
            <Text style={styles.gameDescription} numberOfLines={3}>
              {game.description}
            </Text>

            <View style={[styles.gamePlayButton, { backgroundColor: game.color }]}>
              <Ionicons name="play" size={14} color={colors.textOnPrimary} />
              <Text style={styles.gamePlayText}>Chơi ngay</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Bảng thông báo khi hết giờ                                          */
/* ------------------------------------------------------------------ */

function LockedPanel({ onGoToQuiz }: { onGoToQuiz: () => void }) {
  return (
    <View style={styles.lockedCard}>
      <Text style={styles.lockedEmoji}>🔒</Text>
      <Text style={styles.lockedTitle}>Hết giờ chơi!</Text>
      <Text style={styles.lockedMessage}>
        Hãy làm bài tập Lớp 3 để kiếm thêm phút chơi game.
      </Text>

      <Pressable
        onPress={onGoToQuiz}
        accessibilityRole="button"
        style={({ pressed }) => [styles.lockedButton, pressed && styles.pressed]}
      >
        <Ionicons name="school" size={22} color={colors.primary} />
        <Text style={styles.lockedButtonText}>Đi học bài ngay</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Khu vực "Phụ huynh cấp thêm giờ"                                    */
/* ------------------------------------------------------------------ */

function ParentPanel() {
  const { grantMinutesByParent, resetProgress, syncState, pendingChanges } =
    usePlaytime();

  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [minutes, setMinutes] = useState<string>(String(PARENT_GRANT_OPTIONS[1]));
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Hiệu ứng rung khi nhập sai PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const playShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const translateX = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-8, 8],
  });

  const handleGrant = useCallback(() => {
    Keyboard.dismiss();
    const parsedMinutes = Number.parseInt(minutes, 10);

    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setMessage({ type: 'error', text: 'Số phút phải là số nguyên lớn hơn 0.' });
      return;
    }

    const granted = grantMinutesByParent(parsedMinutes, pin);
    if (!granted) {
      playShake();
      setMessage({ type: 'error', text: 'Mã PIN không đúng. Vui lòng thử lại.' });
      return;
    }

    setPin('');
    setMessage({
      type: 'success',
      text: `Đã cấp thêm ${parsedMinutes} phút chơi game.`,
    });
  }, [grantMinutesByParent, minutes, pin, playShake]);

  const handleReset = useCallback(() => {
    Keyboard.dismiss();
    const done = resetProgress(pin);
    if (!done) {
      playShake();
      setMessage({ type: 'error', text: 'Mã PIN không đúng. Vui lòng thử lại.' });
      return;
    }
    setPin('');
    setMessage({ type: 'success', text: 'Đã đặt lại điểm và thời gian chơi game.' });
  }, [pin, playShake, resetProgress]);


  return (
    <View style={styles.parentCard}>
      <Pressable
        onPress={() => setIsOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Mở khu vực phụ huynh cấp thêm giờ"
        style={styles.parentHeader}
      >
        <Ionicons name="shield-checkmark" size={22} color={colors.warning} />
        <Text style={styles.parentTitle}>Phụ huynh cấp thêm giờ</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {isOpen && (
        <Animated.View style={[styles.parentBody, { transform: [{ translateX }] }]}>
          <Text style={styles.fieldLabel}>Mã PIN phụ huynh</Text>
          <TextInput
            value={pin}
            onChangeText={(text) => {
              setPin(text.replace(/[^0-9]/g, ''));
              setMessage(null);
            }}
            placeholder="Nhập 4 số"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={styles.input}
            accessibilityLabel="Mã PIN phụ huynh"
          />

          <Text style={styles.fieldLabel}>Số phút muốn cấp thêm</Text>
          <View style={styles.chipRow}>
            {PARENT_GRANT_OPTIONS.map((option) => {
              const isSelected = minutes === String(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => setMinutes(String(option))}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.chipText, isSelected && styles.chipTextSelected]}
                  >
                    +{option}′
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={minutes}
            onChangeText={(text) => {
              setMinutes(text.replace(/[^0-9]/g, ''));
              setMessage(null);
            }}
            placeholder="Hoặc nhập số phút"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={3}
            style={styles.input}
            accessibilityLabel="Số phút cấp thêm"
          />

          {message && (
            <Text
              style={[
                styles.message,
                message.type === 'success' ? styles.messageSuccess : styles.messageError,
              ]}
            >
              {message.text}
            </Text>
          )}

          <Pressable
            onPress={handleGrant}
            accessibilityRole="button"
            style={({ pressed }) => [styles.grantButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-circle" size={22} color={colors.textOnPrimary} />
            <Text style={styles.grantButtonText}>Cấp thêm giờ / Mở khoá</Text>
          </Pressable>

          <View style={styles.accountButton}>
            <Ionicons name="cloud-outline" size={20} color={colors.primary} />
            <Text style={styles.accountButtonText}>
              {SYNC_TEXT[syncState]}
              {pendingChanges > 0 ? ` (${pendingChanges} chờ)` : ''}
            </Text>
            <SyncDot state={syncState} />
          </View>

          <Pressable
            onPress={handleReset}
            accessibilityRole="button"
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.resetButtonText}>Đặt lại điểm & thời gian</Text>
          </Pressable>

          <Text style={styles.parentHint}>
            Tối đa {MAX_ACCUMULATED_MINUTES} phút tích luỹ. Mã PIN mặc định là 1234 —
            phụ huynh nên đổi trong tệp constants/mockData.ts.
          </Text>
        </Animated.View>
      )}

    </View>
  );
}

/** Nhãn trạng thái đồng bộ hiển thị cho phụ huynh */
const SYNC_TEXT: Record<SyncState, string> = {
  disabled: 'Chưa cấu hình máy chủ — chỉ lưu trên máy',
  signedOut: 'Chưa đăng nhập',
  idle: 'Đã lưu trên máy',
  offline: 'Đang offline — sẽ tự đồng bộ khi có mạng',
  syncing: 'Đang đồng bộ...',
  synced: 'Đã đồng bộ với Turso',
  error: 'Đồng bộ thất bại — sẽ tự thử lại',
};

/** Chấm màu thể hiện trạng thái đồng bộ */
function SyncDot({ state }: { state: SyncState }) {
  const color =
    state === 'synced'
      ? colors.success
      : state === 'error'
        ? colors.danger
        : state === 'syncing'
          ? colors.primary
          : colors.textMuted;

  return <View style={[styles.syncDot, { backgroundColor: color }]} />;
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  contentTablet: {
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.xl,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pointChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pointChipEmoji: { fontSize: 15 },
  pointChipText: { fontWeight: '800', color: colors.text, fontSize: 15 },

  // Đồng hồ
  clockCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  clockCardActive: { backgroundColor: colors.success },
  clockCardLocked: { backgroundColor: colors.textMuted },
  clockLabel: { color: '#E4EAFF', fontSize: 14, fontWeight: '700' },
  clockValue: {
    color: colors.textOnPrimary,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  clockValueTablet: { fontSize: 84 },
  clockHint: { color: '#E4EAFF', fontSize: 13, textAlign: 'center' },

  // Lưới trò chơi
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gameCard: {
    // 2 cột: mỗi ô chiếm gần nửa chiều rộng, phần còn lại là khoảng cách
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  gameEmoji: { fontSize: 40 },
  gameName: { fontSize: 16, fontWeight: '800', marginTop: spacing.xs },
  gameDescription: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    minHeight: 51,
  },
  gamePlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  gamePlayText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '800' },

  // Nút chỉ bấm giờ
  timerOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  timerOnlyText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  noteCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noteText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  // Khoá
  lockedCard: {
    backgroundColor: colors.lockOverlay,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedEmoji: { fontSize: 56 },
  lockedTitle: { color: colors.textOnPrimary, fontSize: 24, fontWeight: '800' },
  lockedMessage: {
    color: '#CBD5E1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  lockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  lockedButtonText: { color: colors.primary, fontSize: 16, fontWeight: '800' },

  // Phụ huynh
  parentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  parentTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  parentBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontWeight: '800', color: colors.primary, fontSize: 14 },
  chipTextSelected: { color: colors.textOnPrimary },

  message: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
  messageSuccess: { color: colors.success },
  messageError: { color: colors.danger },

  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  grantButtonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  accountButtonText: { flex: 1, color: colors.primary, fontSize: 15, fontWeight: '700' },
  syncDot: { width: 10, height: 10, borderRadius: radius.pill },

  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  resetButtonText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  parentHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },

  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
